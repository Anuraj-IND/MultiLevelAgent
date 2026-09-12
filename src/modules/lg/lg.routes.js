const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { query } = require('../../config/db');
const { audit, emitEvent } = require('../../middleware/audit');
const { auth, signLg } = require('../../middleware/auth');
const { PAN_RE, PHONE_RE, IFSC_RE, PINCODE_RE, sha256, encryptPii, maskAadhaar } = require('../../common/validators');
const { sendOtp, verifyOtp } = require('../../common/otp');
const { verifyIfsc } = require('../../common/ifsc');
const { uploadDoc } = require('../../common/storage');
const { toCsv } = require('../../common/csv');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => {
    if (f.mimetype.startsWith('image/') || f.mimetype === 'application/pdf') cb(null, true);
    else cb(Object.assign(new Error('only image or pdf'), { status: 400 }));
  },
});

const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
const randName = (p) => `${p}-${Math.floor(1000 + Math.random() * 9000)}`;

/**
 * @openapi
 * /api/lg/register/init:
 *   post:
 *     tags: [LG]
 *     summary: Step 1 - name, phone, mail, PAN + trigger OTP
 */
router.post('/register/init', async (req, res, next) => {
  try {
    const { name, phone, email, pan_no } = req.body || {};
    if (!name || !phone || !email || !pan_no) return res.status(400).json({ error: 'name, phone, email, pan_no required' });
    if (!PHONE_RE.test(phone)) return res.status(400).json({ error: 'invalid phone' });
    if (!emailOk(email)) return res.status(400).json({ error: 'invalid email' });
    const pan = String(pan_no).toUpperCase().trim();
    if (!PAN_RE.test(pan)) return res.status(400).json({ error: 'invalid PAN' });
    const dup = await query(`SELECT 1 FROM lgs WHERE pan_no=$1 OR phone=$2 LIMIT 1`, [pan, phone]);
    if (dup.rowCount) return res.status(409).json({ error: 'PAN or phone already registered' });
    const d = await query(
      `INSERT INTO registration_drafts(name,phone,email,pan_no) VALUES ($1,$2,$3,$4) RETURNING id, expires_at`,
      [name.trim(), phone, email.trim(), pan]
    );
    const otp = await sendOtp(phone, 'register');
    await audit({ action: 'lg.register.init', entity: 'registration_draft', entityId: d.rows[0].id, newValue: { phone } });
    res.status(201).json({ draft_id: d.rows[0].id, expires_at: d.rows[0].expires_at, otp });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/lg/otp/send:
 *   post:
 *     tags: [LG]
 *     summary: Send OTP
 */
router.post('/otp/send', async (req, res, next) => {
  try {
    const { phone, purpose } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'phone required' });
    res.json(await sendOtp(phone, purpose || 'register'));
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/lg/otp/verify:
 *   post:
 *     tags: [LG]
 *     summary: Verify OTP (dev bypass 123456)
 */
router.post('/otp/verify', async (req, res, next) => {
  try {
    const { phone, otp, purpose } = req.body || {};
    if (!phone || !otp) return res.status(400).json({ error: 'phone+otp required' });
    res.json(await verifyOtp(phone, otp, purpose || 'register'));
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/lg/register/{draftId}:
 *   get:
 *     tags: [LG]
 *     summary: Read-only echo of Step 1 + progress
 */
router.get('/register/:draftId', async (req, res, next) => {
  try {
    const d = await query(`SELECT id,name,phone,email,pan_no,phone_verified,status FROM registration_drafts WHERE id=$1`, [req.params.draftId]);
    if (!d.rowCount) return res.status(404).json({ error: 'draft not found' });
    const docs = await query(`SELECT doc_type,file_url,mime,version,created_at FROM lg_documents WHERE draft_id=$1`, [req.params.draftId]);
    const tos = await query(`SELECT tos_version,accepted_at FROM tos_acceptances WHERE draft_id=$1`, [req.params.draftId]);
    res.json({ draft: d.rows[0], documents: docs.rows, tos: tos.rows[0] || null });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/lg/register/{draftId}:
 *   patch:
 *     tags: [LG]
 *     summary: Step 2 - address + RM + banking + aadhaar_no
 */
router.patch('/register/:draftId', async (req, res, next) => {
  try {
    const { address_aadhaar, pincode, current_address, rm_name, rm_number, aadhaar_no, banking } = req.body || {};
    const d = await query(`SELECT * FROM registration_drafts WHERE id=$1`, [req.params.draftId]);
    if (!d.rowCount) return res.status(404).json({ error: 'draft not found' });
    if (d.rows[0].status !== 'open') return res.status(400).json({ error: 'draft not open' });
    if (pincode && !PINCODE_RE.test(pincode)) return res.status(400).json({ error: 'invalid pincode' });
    if (banking?.ifsc && !IFSC_RE.test(String(banking.ifsc).toUpperCase())) return res.status(400).json({ error: 'invalid IFSC' });

    let rmId = null;
    if (rm_number) {
      const f = await query(`SELECT id FROM rms WHERE phone=$1`, [rm_number]);
      if (f.rowCount) rmId = f.rows[0].id;
      else {
        const c = await query(`INSERT INTO rms(name,phone) VALUES ($1,$2) RETURNING id`, [rm_name || 'RM', rm_number]);
        rmId = c.rows[0].id;
      }
    }
    // stash step-2 in draft via type-specific temp table: store in tos_acceptances? No - create temp lg row? Use events payload:
    // Simplest: keep in registration_drafts-adjacent JSON via audit newValue + return; persist fully at submit.
    // To keep it queryable, store pending JSON in events_outbox (type draft.updated).
    const pending = { address_aadhaar, pincode, current_address, rm_name, rm_number, rm_id: rmId, aadhaar_no: aadhaar_no || null, banking: banking || null };
    await emitEvent('draft.updated', { draft_id: req.params.draftId, ...pending });
    await audit({ action: 'lg.register.step2', entity: 'registration_draft', entityId: req.params.draftId, newValue: pending });
    res.json({ ok: true, rm_id: rmId, pending });
  } catch (e) { next(e); }
});

const DOC_FIELDS = [
  { name: 'aadhaar_front', maxCount: 1 }, { name: 'aadhaar_back', maxCount: 1 },
  { name: 'pan_card', maxCount: 1 }, { name: 'cheque', maxCount: 1 },
];

/**
 * @openapi
 * /api/lg/register/{draftId}/documents:
 *   post:
 *     tags: [LG]
 *     summary: Upload aadhaar front/back, pan, cheque (image/pdf <=5MB)
 */
router.post('/register/:draftId/documents', upload.fields(DOC_FIELDS), async (req, res, next) => {
  try {
    const d = await query(`SELECT * FROM registration_drafts WHERE id=$1`, [req.params.draftId]);
    if (!d.rowCount) return res.status(404).json({ error: 'draft not found' });
    const out = [];
    for (const f of DOC_FIELDS) {
      const arr = req.files?.[f.name] || [];
      if (!arr.length) continue;
      const file = arr[0];
      const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      const key = `${req.params.draftId}/${f.name}-v${Date.now()}-${file.originalname}`;
      const url = await uploadDoc({ buffer: file.buffer, filename: file.originalname, mime: file.mimetype, key });
      const v = await query(`SELECT COALESCE(MAX(version),0)+1 AS v FROM lg_documents WHERE draft_id=$1 AND doc_type=$2`, [req.params.draftId, f.name]);
      const ins = await query(
        `INSERT INTO lg_documents(draft_id,doc_type,file_url,file_hash,mime,size_bytes,version) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,file_url,version`,
        [req.params.draftId, f.name, url, hash, file.mimetype, file.size, v.rows[0].v]
      );
      out.push({ doc_type: f.name, ...ins.rows[0] });
    }
    if (!out.length) return res.status(400).json({ error: 'no files (fields: aadhaar_front, aadhaar_back, pan_card, cheque)' });
    await audit({ action: 'lg.register.documents', entity: 'registration_draft', entityId: req.params.draftId, newValue: { docs: out.map((o) => o.doc_type) } });
    res.status(201).json({ uploaded: out });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/lg/register/{draftId}/tos-accept:
 *   post:
 *     tags: [LG]
 *     summary: Accept TOS after overlay scroll (stores name + timestamp + ip)
 */
router.post('/register/:draftId/tos-accept', async (req, res, next) => {
  try {
    const { name, tos_version, scrolled_complete } = req.body || {};
    if (!name || !tos_version) return res.status(400).json({ error: 'name + tos_version required' });
    if (scrolled_complete !== true) return res.status(400).json({ error: 'overlay must be fully scrolled' });
    const t = await query(`SELECT version FROM tos_versions WHERE version=$1`, [tos_version]);
    if (!t.rowCount) return res.status(400).json({ error: 'unknown tos_version' });
    const ins = await query(
      `INSERT INTO tos_acceptances(draft_id,tos_version,name_snapshot,ip,user_agent) VALUES ($1,$2,$3,$4,$5) RETURNING id,accepted_at`,
      [req.params.draftId, tos_version, name, req.ip, req.headers['user-agent'] || null]
    );
    await audit({ action: 'lg.register.tos', entity: 'registration_draft', entityId: req.params.draftId, newValue: { tos_version } });
    res.status(201).json(ins.rows[0]);
  } catch (e) { next(e); }
});

function latestDraftPayload(events) {
  const merged = {};
  for (const e of events) Object.assign(merged, e.payload || {});
  return merged;
}

/**
 * @openapi
 * /api/lg/register/{draftId}/submit:
 *   post:
 *     tags: [LG]
 *     summary: Final submit (gated on OTP + docs + TOS + banking + IFSC)
 */
router.post('/register/:draftId/submit', async (req, res, next) => {
  try {
    const d = await query(`SELECT * FROM registration_drafts WHERE id=$1`, [req.params.draftId]);
    if (!d.rowCount) return res.status(404).json({ error: 'draft not found' });
    const draft = d.rows[0];
    if (draft.status === 'submitted') {
      const ex = await query(`SELECT id,lg_seq FROM lgs WHERE draft_id=$1`, [draft.id]);
      return res.json({ already: true, ...ex.rows[0] });
    }
    if (!draft.phone_verified) return res.status(400).json({ error: 'phone OTP not verified' });
    const ev = await query(`SELECT payload FROM events_outbox WHERE type='draft.updated' AND payload->>'draft_id'=$1 ORDER BY created_at`, [draft.id]);
    const p = latestDraftPayload(ev.rows);
    if (!p.address_aadhaar || !p.pincode || !p.current_address) return res.status(400).json({ error: 'address_aadhaar, pincode, current_address required' });
    if (!p.banking?.bank_name || !p.banking?.ifsc || !p.banking?.account_number) return res.status(400).json({ error: 'banking bank_name, ifsc, account_number required' });
    let ifscInfo = null;
    try { ifscInfo = await verifyIfsc(p.banking.ifsc); }
    catch { return res.status(400).json({ error: 'IFSC verification failed' }); }
    const docs = await query(`SELECT DISTINCT doc_type FROM lg_documents WHERE draft_id=$1`, [draft.id]);
    const have = new Set(docs.rows.map((r) => r.doc_type));
    for (const need of ['aadhaar_front', 'aadhaar_back', 'pan_card', 'cheque'])
      if (!have.has(need)) return res.status(400).json({ error: `missing document: ${need}` });
    const tos = await query(`SELECT * FROM tos_acceptances WHERE draft_id=$1`, [draft.id]);
    if (!tos.rowCount) return res.status(400).json({ error: 'TOS not accepted' });

    const lg = await query(
      `INSERT INTO lgs(lg_type,name,phone,email,pan_no,aadhaar_no_encrypted,address_aadhaar,pincode,current_address,
        source_rm_id,isp_name,po_name,verification_status,is_active,draft_id,type_specific_data)
       VALUES ('INDIVIDUAL',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',FALSE,$12,$13)
       RETURNING id,lg_seq`,
      [draft.name, draft.phone, draft.email, draft.pan_no,
        p.aadhaar_no ? encryptPii(p.aadhaar_no) : null,
        p.address_aadhaar, p.pincode, p.current_address, p.rm_id || null,
        randName('ISP'), randName('PO'), draft.id,
        { rm_name: p.rm_name || null, rm_number: p.rm_number || null }]
    );
    const lgId = lg.rows[0].id;
    await query(
      `INSERT INTO lg_bank_accounts(lg_id,bank_name,branch,ifsc,account_no_encrypted,bank_address,ifsc_verified,ifsc_response)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)`,
      [lgId, p.banking.bank_name, p.banking.branch || null, String(p.banking.ifsc).toUpperCase(),
        encryptPii(p.banking.account_number), p.banking.bank_address || null, ifscInfo]
    );
    await query(`UPDATE lg_documents SET lg_id=$1 WHERE draft_id=$2`, [lgId, draft.id]);
    await query(`UPDATE tos_acceptances SET lg_id=$1 WHERE draft_id=$2`, [lgId, draft.id]);
    await query(`UPDATE registration_drafts SET status='submitted' WHERE id=$1`, [draft.id]);
    await emitEvent('lg.created', { lg_id: lgId, lg_seq: lg.rows[0].lg_seq });
    await audit({ action: 'lg.register.submit', entity: 'lg', entityId: lgId, newValue: { lg_seq: lg.rows[0].lg_seq } });
    res.status(201).json({ lg_id: lgId, lg_seq: lg.rows[0].lg_seq, verification_status: 'pending' });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/lg/login/verify:
 *   post:
 *     tags: [LG]
 *     summary: LG phone-OTP login -> JWT
 */
router.post('/login/verify', async (req, res, next) => {
  try {
    const { phone, otp } = req.body || {};
    await verifyOtp(phone, otp, 'login').catch((e) => { throw e; });
    const r = await query(`SELECT * FROM lgs WHERE phone=$1 AND deleted_at IS NULL`, [phone]);
    if (!r.rowCount) return res.status(404).json({ error: 'LG not found, register first' });
    res.json({ token: signLg(r.rows[0]), lg_seq: r.rows[0].lg_seq, id: r.rows[0].id });
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/lg/me/dashboard:
 *   get:
 *     tags: [LG]
 *     summary: LG dashboard (LG-ID, name, phone, aadhaar, mail, RM, ISP, PO)
 */
router.get('/me/dashboard', auth(), async (req, res, next) => {
  try {
    const id = req.user.sub;
    const r = await query(
      `SELECT l.*, r.name AS rm_name, r.phone AS rm_phone FROM lgs l LEFT JOIN rms r ON r.id=l.source_rm_id WHERE l.id=$1`,
      [id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'not found' });
    const l = r.rows[0];
    // NOTE: decrypt omitted (one-way demo); store masked + return masked. Full decrypt needs KMS - flagged.
    res.json({
      lg_id: l.lg_seq, lg_uuid: l.id, name: l.name, phone: l.phone, email: l.email,
      aadhaar_masked: l.aadhaar_no_encrypted ? 'XXXX-XXXX-**** (encrypted at rest)' : null,
      rm_name: l.rm_name, rm_phone: l.rm_phone, isp_name: l.isp_name, po_name: l.po_name,
      verification_status: l.verification_status, is_active: l.is_active,
    });
  } catch (e) { next(e); }
});

/** Stubs: bottom nav + sell hub (final shape, empty data) */
router.get('/me/leads', auth(), async (req, res) => res.json({ data: [], page: 1, total: 0, note: 'full Lead module later' }));
router.get('/me/renewals', auth(), async (req, res) => res.json({ data: [], buckets: { d30: 0, d60: 0, d90: 0 }, note: 'renewal engine later' }));
router.get('/me/performance', auth(), async (req, res) => res.json({ leads_generated: 0, conversion_pct: 0, commission_earned: 0, note: 'feeds ISP/Accounts later' }));

router.get('/catalog/insurance', async (_req, res) => res.json([
  { category: 'life', title: 'Life Insurance', detail: 'full page+api later' },
  { category: 'motor', title: 'Motor Insurance', detail: 'full page+api later' },
  { category: 'health', title: 'Health Insurance', detail: 'full page+api later' },
]));

router.post('/intents/policy', auth(), async (req, res, next) => {
  try {
    const { category, payload } = req.body || {};
    if (!['life', 'motor', 'health'].includes(category)) return res.status(400).json({ error: 'category life|motor|health' });
    const r = await query(`INSERT INTO policy_intents(lg_id,category,payload) VALUES ($1,$2,$3) RETURNING id,created_at`, [req.user.sub, category, payload || {}]);
    await audit({ actorId: req.user.sub, actorType: 'LG', action: 'intent.create', entity: 'policy_intent', entityId: r.rows[0].id, newValue: { category } });
    res.status(201).json(r.rows[0]);
  } catch (e) { next(e); }
});

/** Admin/RM: list + verify + active + CSV export */
router.get('/', auth(), async (req, res, next) => {
  try {
    const { type, verification, search, page = 1, limit = 20 } = req.query;
    const cond = [`l.deleted_at IS NULL`]; const vals = []; let i = 1;
    if (type) { cond.push(`l.lg_type=$${i++}`); vals.push(type); }
    if (verification) { cond.push(`l.verification_status=$${i++}`); vals.push(verification); }
    if (search) { cond.push(`(l.name ILIKE $${i} OR l.phone ILIKE $${i} OR l.pan_no ILIKE $${i})`); vals.push(`%${search}%`); i++; }
    const off = (Number(page) - 1) * Number(limit);
    const rows = await query(`SELECT l.id,l.lg_seq,l.name,l.phone,l.email,l.pan_no,l.verification_status,l.is_active,l.created_at FROM lgs l WHERE ${cond.join(' AND ')} ORDER BY l.created_at DESC LIMIT $${i++} OFFSET $${i++}`, [...vals, Number(limit), off]);
    const cnt = await query(`SELECT COUNT(*) FROM lgs l WHERE ${cond.join(' AND ')}`, vals);
    res.json({ data: rows.rows, total: Number(cnt.rows[0].count), page: Number(page) });
  } catch (e) { next(e); }
});

router.get('/export', auth(), async (req, res, next) => {
  try {
    const r = await query(`SELECT lg_seq,name,phone,email,pan_no,verification_status,is_active,created_at FROM lgs WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5000`);
    await audit({ actorId: req.user.sub, actorType: req.user.role, action: 'lg.export', entity: 'lg', newValue: { count: r.rowCount, filters: req.query } });
    const csv = toCsv(r.rows, ['lg_seq', 'name', 'phone', 'email', 'pan_no', 'verification_status', 'is_active', 'created_at']);
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="Covermint_LG_Report_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});

router.patch('/:id/verify', auth(), async (req, res, next) => {
  try {
    const { decision } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision approved|rejected' });
    const old = await query(`SELECT verification_status FROM lgs WHERE id=$1`, [req.params.id]);
    await query(`UPDATE lgs SET verification_status=$1, verified_by=$2, verified_at=now(), updated_at=now() WHERE id=$3`, [decision, req.user.sub, req.params.id]);
    await emitEvent('lg.verified', { lg_id: req.params.id, decision });
    await audit({ actorId: req.user.sub, actorType: req.user.role, action: 'lg.verify', entity: 'lg', entityId: req.params.id, oldValue: old.rows[0], newValue: { decision } });
    res.json({ ok: true, verification_status: decision });
  } catch (e) { next(e); }
});

router.patch('/:id/active', auth(), async (req, res, next) => {
  try {
    const { is_active } = req.body || {};
    const cur = await query(`SELECT verification_status,is_active FROM lgs WHERE id=$1`, [req.params.id]);
    if (!cur.rowCount) return res.status(404).json({ error: 'not found' });
    if (is_active === true && cur.rows[0].verification_status !== 'approved')
      return res.status(400).json({ error: 'cannot activate before verification approval (FR-LG-04)' });
    await query(`UPDATE lgs SET is_active=$1, updated_at=now() WHERE id=$2`, [!!is_active, req.params.id]);
    await audit({ actorId: req.user.sub, actorType: req.user.role, action: 'lg.active', entity: 'lg', entityId: req.params.id, oldValue: cur.rows[0], newValue: { is_active } });
    res.json({ ok: true, is_active: !!is_active });
  } catch (e) { next(e); }
});

module.exports = router;

// End-to-end LC pass. Run: node e2e-lc.js (server must be up on :10000)
require('dotenv').config();
const BASE = 'http://localhost:10000';
const PHONE = '9876543211';

async function req(method, path, body, token, form) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : form });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* csv etc */ }
  return { status: r.status, json, text };
}

(async () => {
  const step = (n, s, j) => console.log(`${n} [${s}]`, JSON.stringify(j).slice(0, 220));

  let r = await req('POST', '/api/lg/register/init', { name: 'E2E Tester', phone: PHONE, email: 'e2e@test.com', pan_no: 'ABCDE1235G' });
  step('init', r.status, r.json); const draft = r.json.draft_id;

  r = await req('POST', '/api/lg/otp/verify', { phone: PHONE, otp: '123456' });
  step('otp ', r.status, r.json);

  r = await req('GET', `/api/lg/register/${draft}`);
  step('echo', r.status, r.json.draft);

  r = await req('PATCH', `/api/lg/register/${draft}`, {
    address_aadhaar: '12 MG Road, Bengaluru', pincode: '560001', current_address: '12 MG Road, Bengaluru',
    rm_name: 'Ravi RM', rm_number: '9811111111', aadhaar_no: '123412341234',
    banking: { bank_name: 'HDFC Bank', branch: 'MG Road', ifsc: 'HDFC0001233', account_number: '50100123456789', bank_address: 'MG Road Bengaluru' },
  });
  step('step2', r.status, r.json);

  const fd = new FormData();
  const pdf = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });
  fd.append('aadhaar_front', pdf, 'a-front.pdf');
  fd.append('aadhaar_back', pdf, 'a-back.pdf');
  fd.append('pan_card', pdf, 'pan.pdf');
  fd.append('cheque', pdf, 'cheque.pdf');
  r = await req('POST', `/api/lg/register/${draft}/documents`, null, null, fd);
  step('docs', r.status, r.json);

  r = await req('GET', '/api/tos?version=latest');
  step('tos ', r.status, { version: r.json.version });
  r = await req('POST', `/api/lg/register/${draft}/tos-accept`, { name: 'E2E Tester', tos_version: 'v1', scrolled_complete: true });
  step('acc ', r.status, r.json);

  r = await req('POST', `/api/lg/register/${draft}/submit`);
  step('subm', r.status, r.json);

  r = await req('POST', '/api/lg/otp/send', { phone: PHONE, purpose: 'login' });
  r = await req('POST', '/api/lg/login/verify', { phone: PHONE, otp: '123456' });
  step('logi', r.status, { lg_seq: r.json.lg_seq });
  const token = r.json.token;

  r = await req('GET', '/api/lg/me/dashboard', null, token);
  step('dash', r.status, r.json);

  r = await req('GET', '/api/lg/catalog/insurance');
  step('cat ', r.status, r.json);
  r = await req('POST', '/api/lg/intents/policy', { category: 'health', payload: { sum: 500000 } }, token);
  step('inte', r.status, r.json);
  r = await req('GET', '/api/lg/me/performance', null, token);
  step('perf', r.status, r.json);

  // staff actions (mint checker token directly)
  const { signStaff } = require('./src/middleware/auth');
  const staff = signStaff({ id: 'e2e-admin', role: 'Admin' });
  const lgId = (await req('GET', '/api/lg/me/dashboard', null, token)).json.lg_uuid;
  r = await req('PATCH', `/api/lg/${lgId}/verify`, { decision: 'approved' }, staff);
  step('veri', r.status, r.json);
  r = await req('PATCH', `/api/lg/${lgId}/active`, { is_active: true }, staff);
  step('acti', r.status, r.json);
  r = await req('GET', '/api/lg?page=1&limit=5', null, staff);
  step('list', r.status, { total: r.json.total });
  r = await req('GET', '/api/lg/export', null, staff);
  console.log('export', `[${r.status}]`, r.text.split('\n').slice(0, 2).join(' | ').slice(0, 200));
  console.log('E2E DONE');
})().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1); });

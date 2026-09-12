const express = require('express');
const { query } = require('../../config/db');
const { verifyIfsc } = require('../../common/ifsc');

const router = express.Router();

/**
 * @openapi
 * /api/utils/ifsc/verify:
 *   post:
 *     tags: [Utils]
 *     summary: Verify IFSC via free Razorpay API (proxied + cached)
 */
router.post('/ifsc/verify', async (req, res, next) => {
  try {
    const { ifsc } = req.body || {};
    if (!ifsc) return res.status(400).json({ error: 'ifsc required' });
    res.json(await verifyIfsc(ifsc));
  } catch (e) { next(e); }
});

/**
 * @openapi
 * /api/tos:
 *   get:
 *     tags: [Utils]
 *     summary: Get TOS text by version (overlay content)
 */
router.get('/tos', async (req, res, next) => {
  try {
    const v = req.query.version && req.query.version !== 'latest' ? req.query.version : process.env.TOS_VERSION || 'v1';
    const r = await query(`SELECT version,text,text_hash,created_at FROM tos_versions WHERE version=$1`, [v]);
    if (!r.rowCount) return res.status(404).json({ error: 'tos version not found' });
    res.json(r.rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;

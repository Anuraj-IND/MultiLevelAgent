const crypto = require('crypto');
const { query } = require('../config/db');
const { sha256 } = require('./validators');

const DEV_BYPASS = '123456';

async function sendOtp(phone, purpose = 'register') {
  if ((process.env.OTP_MODE || 'dev') === 'dev') return { dev: true, hint: 'use 123456' };
  // Prod: plug MSG91/Twilio/Firebase here, then store hash below
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  await query(
    `INSERT INTO otp_verifications(phone,otp_hash,purpose) VALUES ($1,$2,$3)`,
    [phone, sha256(otp), purpose]
  );
  // TODO: send via provider
  return { dev: false };
}

async function verifyOtp(phone, otp, purpose = 'register') {
  if ((process.env.OTP_MODE || 'dev') === 'dev') {
    if (String(otp) !== DEV_BYPASS) throw Object.assign(new Error('bad otp'), { status: 400 });
    await query(`UPDATE registration_drafts SET phone_verified=TRUE, phone_verified_at=now() WHERE phone=$1 AND status='open'`, [phone]);
    return { ok: true, dev: true, phone_verified_token: sha256(phone + '|verified|' + Date.now()) };
  }
  const r = await query(
    `SELECT * FROM otp_verifications WHERE phone=$1 AND purpose=$2 AND consumed_at IS NULL AND expires_at>now() ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose]
  );
  const row = r.rows[0];
  if (!row) throw Object.assign(new Error('otp expired'), { status: 400 });
  if (row.attempts >= 5) throw Object.assign(new Error('too many attempts'), { status: 429 });
  await query(`UPDATE otp_verifications SET attempts=attempts+1 WHERE id=$1`, [row.id]);
  if (row.otp_hash !== sha256(String(otp))) throw Object.assign(new Error('bad otp'), { status: 400 });
  await query(`UPDATE otp_verifications SET consumed_at=now() WHERE id=$1`, [row.id]);
  await query(`UPDATE registration_drafts SET phone_verified=TRUE, phone_verified_at=now() WHERE phone=$1 AND status='open'`, [phone]);
  return { ok: true };
}

module.exports = { sendOtp, verifyOtp };

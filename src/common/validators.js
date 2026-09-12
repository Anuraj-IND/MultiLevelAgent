const crypto = require('crypto');

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST_RE = /^\d{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const PHONE_RE = /^[6-9]\d{9}$/; // India 10-digit, adjust if needed

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// Reversible obfuscation for PII at rest (NOT full KMS; upgrade to KMS later)
// Format: enc:<iv>:<cipher> with key from JWT_SECRET
function encryptPii(plain) {
  if (!plain) return null;
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'dev').digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `enc:${iv.toString('hex')}:${enc.toString('hex')}:${c.getAuthTag().toString('hex')}`;
}

function maskAadhaar(aadhaar) {
  if (!aadhaar) return null;
  const d = String(aadhaar).replace(/\D/g, '');
  return `XXXX-XXXX-${d.slice(-4)}`;
}

module.exports = { PAN_RE, GST_RE, IFSC_RE, PINCODE_RE, PHONE_RE, sha256, encryptPii, maskAadhaar };

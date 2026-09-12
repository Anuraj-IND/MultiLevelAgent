// Free IFSC lookup via Razorpay (no key). Backend proxies + caches in-memory 30d.
const cache = new Map();

async function verifyIfsc(ifsc) {
  const code = String(ifsc || '').toUpperCase().trim();
  if (cache.has(code)) return { ...cache.get(code), cached: true };
  const res = await fetch(`https://ifsc.razorpay.com/${code}`);
  if (!res.ok) throw Object.assign(new Error('ifsc not found'), { status: 400 });
  const j = await res.json();
  const out = { bank: j.BANK, branch: j.BRANCH, address: j.ADDRESS, ifsc: j.IFSC, verified: true };
  cache.set(code, out);
  setTimeout(() => cache.delete(code), 30 * 24 * 3600 * 1000).unref?.();
  return out;
}

module.exports = { verifyIfsc };

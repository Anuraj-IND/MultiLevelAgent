const jwt = require('jsonwebtoken');

function signLg(lg) {
  return jwt.sign(
    { sub: lg.id, lg_seq: lg.lg_seq, phone: lg.phone, role: 'LG' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function signStaff({ id, role }) {
  return jwt.sign({ sub: id, role }, process.env.JWT_SECRET, { expiresIn: '12h' });
}

function auth(required = true) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: 'missing token' });
    }
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      return res.status(401).json({ error: 'invalid token' });
    }
  };
}

// LG owner can only touch own record; RM/Admin (staff JWT) bypass for verify steps
function requireLgOwnerOrStaff(req, res, next) {
  const { id } = req.params;
  if (req.user?.role && req.user.role !== 'LG') return next(); // staff
  if (req.user?.sub === id || req.user?.lg_seq?.toString() === id) return next();
  // /me routes set req.lgId from token
  if (req.lgId && (req.lgId === id || req.params.lgId === req.lgId)) return next();
  return res.status(403).json({ error: 'forbidden' });
}

module.exports = { signLg, signStaff, auth, requireLgOwnerOrStaff };

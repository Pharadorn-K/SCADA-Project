// backend/node/middleware/requireRole.js
function requireRole(requiredRole) {
  return (req, res, next) => {
    const role = req.session?.role;

    if (!role) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (role !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

module.exports = { requireRole };

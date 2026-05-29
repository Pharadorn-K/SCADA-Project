// backend/node/middleware/requireRole.js
// function requireRole(requiredRole) {
//   return (req, res, next) => {
//     const role = req.session?.role;

//     if (!role) {
//       return res.status(401).json({ error: 'Not authenticated' });
//     }

//     if (role !== requiredRole) {
//       return res.status(403).json({ error: 'Forbidden' });
//     }

//     next();
//   };
// }

// module.exports = { requireRole };
// backend/node/middleware/requireRole.js

// Higher number = higher privilege.
// A user whose level is >= the required level is allowed through.
const ROLE_LEVEL = {
  operator:   1,
  supervisor: 2,
  admin:      3,
};

/**
 * requireRole('operator')   → operator, supervisor, admin  ✓
 * requireRole('supervisor') → supervisor, admin            ✓
 * requireRole('admin')      → admin only                   ✓
 */
function requireRole(requiredRole) {
  return (req, res, next) => {
    const role = req.session?.role;

    if (!role) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userLevel     = ROLE_LEVEL[role]         ?? 0;
    const requiredLevel = ROLE_LEVEL[requiredRole] ?? 99;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}

module.exports = { requireRole, ROLE_LEVEL };
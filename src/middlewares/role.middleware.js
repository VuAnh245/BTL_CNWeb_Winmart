'use strict';

const { MSG, get } = require('../constants/messages');
const { ROLES, hasAtLeastRole } = require('../constants/roles');

/**
 * Middleware kiểm tra quyền truy cập theo vai trò
 * @param {string|string[]} allowedRoles - Vai trò được phép (hoặc mảng)
 * @returns {Function} Express middleware
 * 
 * @example
 * router.use('/admin', role('ADMIN'));
 * router.use('/staff', role(['STAFF', 'ADMIN']));
 * router.use('/customer-only', role('CUSTOMER'));
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: MSG.AUTH.UNAUTHORIZED,
      });
    }
    
    if (!roles.includes(userRole)) {
      // Log attempt for audit (admin-only actions)
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[RBAC DENIED] User ${req.user?.id} (${userRole}) tried to access ${req.originalUrl}`);
      }
      
      return res.status(403).json({
        success: false,
        message: MSG.AUTH.FORBIDDEN,
        requiredRole: roles.join(' or '),
        currentRole: userRole,
      });
    }
    
    next();
  };
}

/**
 * Middleware kiểm tra "ít nhất quyền X" dựa trên hierarchy
 * Ví dụ: requireAtLeastRole('STAFF') → ADMIN và STAFF đều qua, CUSTOMER bị chặn
 */
function requireAtLeastRole(minRole) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole || !hasAtLeastRole(userRole, minRole)) {
      return res.status(403).json({
        success: false,
        message: MSG.AUTH.FORBIDDEN,
        requiredMinRole: minRole,
        currentRole: userRole,
      });
    }
    
    next();
  };
}

/**
 * Middleware inject role vào res.locals cho EJS views
 * Dùng để conditionally render menu/button theo quyền
 */
function injectRoleForViews(req, res, next) {
  res.locals.userRole = req.session?.userRole || null;
  res.locals.isAuthenticated = !!req.session?.userId;
  res.locals.ROLES = ROLES; // Export constants to views
  next();
}

module.exports = {
  requireRole,
  requireAtLeastRole,
  injectRoleForViews,
};
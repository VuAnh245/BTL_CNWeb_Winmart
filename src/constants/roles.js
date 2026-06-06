'use strict';

/**
 * Vai trò người dùng trong hệ thống
 * Đồng bộ với ENUM `NhanVien.VaiTro` trong MySQL
 * Traceability: UC-C01, UC-S01, UC-A01, FN-Auth
 */
const ROLES = Object.freeze({
  CUSTOMER: 'CUSTOMER', // Khách hàng: xem SP, đặt hàng, xem điểm
  STAFF: 'STAFF',       // Nhân viên: POS, xem báo cáo cửa hàng
  ADMIN: 'ADMIN',       // Quản trị: cấu hình hệ thống, xem toàn cục
});

/**
 * Label hiển thị cho UI
 */
const ROLE_LABELS = Object.freeze({
  [ROLES.CUSTOMER]: 'Khách hàng',
  [ROLES.STAFF]: 'Nhân viên',
  [ROLES.ADMIN]: 'Quản trị viên',
});

/**
 * Phân cấp quyền: ADMIN > STAFF > CUSTOMER
 * Dùng để check "ít nhất quyền X"
 */
const ROLE_HIERARCHY = Object.freeze({
  [ROLES.CUSTOMER]: 1,
  [ROLES.STAFF]: 2,
  [ROLES.ADMIN]: 3,
});

/**
 * Kiểm tra giá trị hợp lệ
 */
function isValid(value) {
  return Object.values(ROLES).includes(value);
}

/**
 * Kiểm tra role có ít nhất quyền bằng requiredRole
 * @param {string} currentRole
 * @param {string} requiredRole
 * @returns {boolean}
 * 
 * @example
 * hasAtLeastRole('ADMIN', 'STAFF') → true
 * hasAtLeastRole('CUSTOMER', 'STAFF') → false
 */
function hasAtLeastRole(currentRole, requiredRole) {
  return (ROLE_HIERARCHY[currentRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

/**
 * Danh sách route/public path không cần auth
 */
const PUBLIC_ROUTES = Object.freeze([
  '/',
  '/login',
  '/register',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/products',
  '/api/v1/products/:id',
  '/ping',
]);

/**
 * Map role → permissions (có thể mở rộng sau)
 */
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.CUSTOMER]: ['view_products', 'create_order', 'view_own_orders'],
  [ROLES.STAFF]: ['view_products', 'create_order', 'view_store_reports', 'pos_checkout'],
  [ROLES.ADMIN]: ['*'], // All permissions
});

module.exports = {
  ROLES,
  ROLE_LABELS,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  PUBLIC_ROUTES,
  isValid,
  hasAtLeastRole,
};
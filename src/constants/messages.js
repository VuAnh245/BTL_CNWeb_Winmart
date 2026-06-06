'use strict';

/**
 * Kho message chuẩn hóa cho toàn hệ thống
 * Hỗ trợ placeholder {variable} và format tiếng Việt
 * Traceability: NFP-UX, Maintainability
 */
const MSG = Object.freeze({
  // =============================================
  // AUTH & SESSION (UC-C01, UC-S01)
  // =============================================
  AUTH: {
    LOGIN_SUCCESS: 'Đăng nhập thành công.',
    LOGIN_FAIL: 'Email/SĐT hoặc mật khẩu không đúng.',
    LOGIN_LOCKED: 'Tài khoản bị khóa tạm thời do nhập sai nhiều lần. Vui lòng thử lại sau {minutes} phút.',
    LOGOUT_SUCCESS: 'Đã đăng xuất.',
    REGISTER_SUCCESS: 'Đăng ký tài khoản thành công. Vui lòng đăng nhập.',
    EMAIL_EXISTED: 'Email này đã được sử dụng.',
    PHONE_EXISTED: 'Số điện thoại này đã được sử dụng.',
    ACCOUNT_LOCKED: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
    UNAUTHORIZED: 'Bạn cần đăng nhập để thực hiện thao tác này.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    PASSWORD_WEAK: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, số và ký tự đặc biệt.',
  },

  // =============================================
  // PRODUCT & CATALOG (UC-C02, UC-A01)
  // =============================================
  PRODUCT: {
    NOT_FOUND: 'Không tìm thấy sản phẩm.',
    CREATED: 'Thêm sản phẩm thành công.',
    UPDATED: 'Cập nhật sản phẩm thành công.',
    DELETED: 'Đã ngừng kinh doanh sản phẩm.', // Soft delete
    OUT_OF_STOCK: 'Sản phẩm "{name}" hiện không còn hàng.',
    LOW_STOCK: 'Sản phẩm "{name}" chỉ còn {qty} sản phẩm.',
    INVALID_BARCODE: 'Mã vạch không hợp lệ hoặc không tồn tại.',
  },

  // =============================================
  // CART & CHECKOUT (UC-C03, UC-C04)
  // =============================================
  CART: {
    UPDATED: 'Giỏ hàng đã được cập nhật.',
    EMPTY: 'Giỏ hàng của bạn đang trống.',
    ITEM_REMOVED: 'Đã xóa sản phẩm khỏi giỏ hàng.',
  },
  CHECKOUT: {
    SUCCESS: 'Thanh toán thành công! Mã đơn: {code}. Cảm ơn bạn đã mua hàng.',
    FAIL: 'Thanh toán thất bại. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
    PENDING: 'Đơn hàng đang được xử lý. Mã đơn: {code}.',
    CANCELLED: 'Đơn hàng đã được hủy.',
    TIMEOUT: 'Đơn hàng hết hạn thanh toán và đã tự động hủy.',
  },

  // =============================================
  // INVENTORY & RECEIPT (UC-A02)
  // =============================================
  INVENTORY: {
    RECEIPT_CREATED: 'Tạo phiếu nhập hàng thành công.',
    RECEIPT_APPROVED: 'Duyệt phiếu nhập thành công. Tồn kho đã cập nhật.',
    RECEIPT_REJECTED: 'Từ chối phiếu nhập. Vui lòng kiểm tra lại thông tin.',
    BATCH_EXPIRY_WARN: '⚠️ Lô "{batch}" của sản phẩm "{product}" sắp hết hạn trong {days} ngày.',
    BATCH_EXPIRED: 'Lô "{batch}" đã hết hạn và không thể bán.',
    STOCK_RESERVED: 'Đã giữ {qty} sản phẩm "{name}" trong {minutes} phút.',
    STOCK_RELEASED: 'Đã hủy giữ hàng. Sản phẩm "{name}" đã được trả lại kho.',
  },

  // =============================================
  // LOYALTY & CUSTOMER (UC-C05, UC-A03)
  // =============================================
  LOYALTY: {
    POINTS_ADDED: 'Cộng {points} điểm thành công.',
    POINTS_USED: 'Sử dụng {points} điểm thành công.',
    POINTS_ADJUSTED: 'Điều chỉnh điểm thành công.',
    POINTS_NOT_ENOUGH: 'Điểm tích lũy không đủ. Bạn cần thêm {needed} điểm.',
    VIP_UPGRADED: '🎉 Chúc mừng! Bạn đã lên hạng {tier}.',
    VIP_DOWNGRADE_WARN: '⚠️ Điểm của bạn sắp giảm hạng. Hãy mua sắm thêm để giữ nguyên quyền lợi.',
  },

  // =============================================
  // POS & OFFLINE (UC-S02, UC-S03)
  // =============================================
  POS: {
    SYNC_SUCCESS: 'Đồng bộ {count} đơn thành công.',
    SYNC_FAIL: 'Không thể đồng bộ. Vui lòng kiểm tra kết nối mạng.',
    OFFLINE_MODE: '📴 Đang chạy offline. Đơn sẽ được đồng bộ khi có mạng.',
    PRINT_SUCCESS: 'In hóa đơn thành công.',
    PRINT_FAIL: 'Không thể in hóa đơn. Vui lòng kiểm tra máy in.',
  },

  // =============================================
  // GENERAL & SYSTEM
  // =============================================
  GENERAL: {
    SAVE_SUCCESS: 'Lưu thành công.',
    UPDATE_SUCCESS: 'Cập nhật thành công.',
    DELETE_SUCCESS: 'Xóa thành công.',
    VALIDATION_ERROR: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
    SERVER_ERROR: 'Lỗi hệ thống. Vui lòng thử lại sau.',
    NOT_FOUND: 'Không tìm thấy trang yêu cầu.',
    NETWORK_ERROR: 'Mất kết nối mạng. Vui lòng kiểm tra lại.',
    RATE_LIMIT: 'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau.',
  },
});

/**
 * Thay thế placeholder trong message template
 * @param {string} template - VD: 'Sản phẩm "{name}" không đủ hàng.'
 * @param {Object} vars - VD: { name: 'Mì Hảo Hảo', qty: 5 }
 * @returns {string} Message đã format
 * 
 * @example
 * format(MSG.PRODUCT.OUT_OF_STOCK, { name: 'Mì Hảo Hảo' })
 * // → 'Sản phẩm "Mì Hảo Hảo" hiện không còn hàng.'
 */
function format(template, vars = {}) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

/**
 * Helper: Lấy message theo path dạng 'AUTH.LOGIN_SUCCESS'
 * @param {string} path
 * @param {Object} vars
 * @returns {string}
 */
function get(path, vars = {}) {
  const keys = path.split('.');
  let result = MSG;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return `Missing message: ${path}`;
    }
  }
  
  return typeof result === 'string' ? format(result, vars) : result;
}

module.exports = { MSG, format, get };
'use strict';

/**
 * Trạng thái vòng đời đơn hàng
 * Đồng bộ với ENUM `HoaDonBanHang.TrangThai` trong MySQL
 * Traceability: UC-C04, UC-S02, FN-Order
 */
const ORDER_STATUS = Object.freeze({
  PENDING: 'Pending',    // Đã tạo, chờ thanh toán
  PAID: 'Paid',          // Đã thanh toán, chờ xử lý
  DELIVERING: 'Delivering', // Đang giao hàng (từ ĐVVC)
  COMPLETED: 'Completed',// Đã giao/nhận, hoàn tất
  CANCELLED: 'Cancelled',// Đã hủy (khách/tự động)
  CANCELLED_RETURN: 'Cancelled_Return', // Hủy và hoàn hàng (từ ĐVVC)
  REFUNDED: 'Refunded',  // Đã hoàn tiền (VNPay/MoMo/Chuyển khoản)
});

/**
 * Label hiển thị cho UI
 */
const ORDER_STATUS_LABELS = Object.freeze({
  [ORDER_STATUS.PENDING]: 'Chờ thanh toán',
  [ORDER_STATUS.PAID]: 'Đã thanh toán',
  [ORDER_STATUS.DELIVERING]: 'Đang giao hàng',
  [ORDER_STATUS.COMPLETED]: 'Hoàn tất',
  [ORDER_STATUS.CANCELLED]: 'Đã hủy',
  [ORDER_STATUS.CANCELLED_RETURN]: 'Hủy & Hoàn hàng',
  [ORDER_STATUS.REFUNDED]: 'Đã hoàn tiền',
});

/**
 * Màu badge cho UI (Tailwind/Bootstrap)
 */
const ORDER_STATUS_COLORS = Object.freeze({
  [ORDER_STATUS.PENDING]: 'bg-yellow-100 text-yellow-800',
  [ORDER_STATUS.PAID]: 'bg-blue-100 text-blue-800',
  [ORDER_STATUS.DELIVERING]: 'bg-purple-100 text-purple-800',
  [ORDER_STATUS.COMPLETED]: 'bg-green-100 text-green-800',
  [ORDER_STATUS.CANCELLED]: 'bg-red-100 text-red-800',
  [ORDER_STATUS.CANCELLED_RETURN]: 'bg-orange-100 text-orange-800',
  [ORDER_STATUS.REFUNDED]: 'bg-gray-100 text-gray-800',
});

/**
 * Kiểm tra giá trị hợp lệ
 * @param {string} value
 * @returns {boolean}
 */
function isValid(value) {
  return Object.values(ORDER_STATUS).includes(value);
}

/**
 * Các trạng thái có thể chuyển tiếp từ trạng thái hiện tại
 * @param {string} currentStatus
 * @returns {Array<string>} Danh sách trạng thái hợp lệ tiếp theo
 */
function getNextAllowed(currentStatus) {
  const transitions = {
    [ORDER_STATUS.PENDING]: [ORDER_STATUS.PAID, ORDER_STATUS.DELIVERING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.DELIVERING, ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.CANCELLED_RETURN],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED_RETURN],
    [ORDER_STATUS.COMPLETED]: [], // Terminal state
    [ORDER_STATUS.CANCELLED]: [ORDER_STATUS.REFUNDED], 
    [ORDER_STATUS.CANCELLED_RETURN]: [ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.REFUNDED]: [], // Terminal state
  };
  return transitions[currentStatus] || [];
}

module.exports = {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  isValid,
  getNextAllowed,
};
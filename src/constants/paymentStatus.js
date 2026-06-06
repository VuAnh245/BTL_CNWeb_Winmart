'use strict';

/**
 * Trạng thái thanh toán hóa đơn
 * Lưu ý: Khác với ORDER_STATUS - một đơn có thể PAID nhưng chưa COMPLETED
 * Traceability: UC-C04, UC-S02
 */
const PAYMENT_STATUS = Object.freeze({
  UNPAID: 'UNPAID',    // Chưa thanh toán
  PAID: 'PAID',        // Đã thanh toán thành công
  REFUNDED: 'REFUNDED',// Đã hoàn tiền
});

/**
 * Label hiển thị cho UI
 */
const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.UNPAID]: 'Chưa thanh toán',
  [PAYMENT_STATUS.PAID]: 'Đã thanh toán',
  [PAYMENT_STATUS.REFUNDED]: 'Đã hoàn tiền',
});

/**
 * Kiểm tra giá trị hợp lệ
 */
function isValid(value) {
  return Object.values(PAYMENT_STATUS).includes(value);
}

module.exports = { PAYMENT_STATUS, PAYMENT_STATUS_LABELS, isValid };
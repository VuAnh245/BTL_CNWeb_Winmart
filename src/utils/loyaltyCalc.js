'use strict';

const appConfig = require('../config/app.config');
const { LOYALTY_TIER } = require('../constants/loyaltyTier');

/**
 * Tính điểm tích lũy từ tổng tiền sau khuyến mãi
 * Công thức: floor(totalAfterDiscount × rate × bonusMultiplier)
 * 
 * @param {number} totalAfterDiscount - Tổng tiền sau khi áp KM
 * @param {string} currentTier - Hạng VIP hiện tại ('Thuong', 'VIP1', ...)
 * @returns {number} Điểm tích lũy (luôn >= 0)
 */
function calcEarnPoints(totalAfterDiscount, currentTier = LOYALTY_TIER.THUONG) {
  const amount = Math.max(0, Number(totalAfterDiscount) || 0);
  const base = Math.floor(amount * appConfig.loyalty.rate);
  
  // Bonus multiplier theo tier: VIP2 = 1.1x, VIP3 = 1.2x
  const bonusMap = {
    [LOYALTY_TIER.THUONG]: 1.0,
    [LOYALTY_TIER.VIP1]: 1.0,
    [LOYALTY_TIER.VIP2]: 1.1,
    [LOYALTY_TIER.VIP3]: 1.2,
  };
  const multiplier = bonusMap[currentTier] || 1.0;
  
  return Math.floor(base * multiplier);
}

/**
 * Tính hạng VIP dựa trên tổng điểm tích lũy
 * @param {number} totalPoints
 * @returns {string} Tier name
 */
function calcTier(totalPoints) {
  const pts = Math.max(0, Number(totalPoints) || 0);
  const thresholds = appConfig.loyalty.thresholds;
  
  if (pts >= thresholds.VIP3) return LOYALTY_TIER.VIP3;
  if (pts >= thresholds.VIP2) return LOYALTY_TIER.VIP2;
  if (pts >= thresholds.VIP1) return LOYALTY_TIER.VIP1;
  return LOYALTY_TIER.THUONG;
}

/**
 * Quy đổi điểm sang tiền để trừ khi thanh toán
 * 1 điểm = 1.000đ (cấu hình trong appConfig)
 * @param {number} points
 * @returns {number} Số tiền tương đương (VNĐ)
 */
function pointsToMoney(points) {
  const pts = Math.max(0, Math.floor(Number(points) || 0));
  return pts * 1; // 1 point = 1 VND
}

/**
 * Tính số điểm tối đa có thể dùng cho đơn hàng
 * Rule: Không dùng quá 50% giá trị đơn + không vượt số điểm hiện có
 * @param {number} orderTotal - Tổng đơn hàng
 * @param {number} availablePoints - Số điểm khách đang có
 * @returns {number} Số điểm tối đa được dùng
 */
function calcMaxUsablePoints(orderTotal, availablePoints) {
  const total = Math.max(0, Number(orderTotal) || 0);
  const maxByOrder = Math.floor(total * 0.5); // Tối đa 50% đơn
  const maxByPoints = Math.floor(availablePoints);
  return Math.min(maxByOrder, maxByPoints);
}

module.exports = { calcEarnPoints, calcTier, pointsToMoney, calcMaxUsablePoints };
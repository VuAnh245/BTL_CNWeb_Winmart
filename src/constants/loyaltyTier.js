'use strict';

/**
 * Các cấp độ VIP của khách hàng
 * Đồng bộ với ENUM `KhachHang.CapDoVIP` trong MySQL
 */
const LOYALTY_TIER = Object.freeze({
  THUONG: 'Thuong',
  VIP1: 'VIP1',
  VIP2: 'VIP2',
  VIP3: 'VIP3',
});

const TIER_THRESHOLDS = Object.freeze({
  [LOYALTY_TIER.THUONG]: 0,
  [LOYALTY_TIER.VIP1]: 10000,
  [LOYALTY_TIER.VIP2]: 50000,
  [LOYALTY_TIER.VIP3]: 200000,
});

module.exports = { LOYALTY_TIER, TIER_THRESHOLDS };
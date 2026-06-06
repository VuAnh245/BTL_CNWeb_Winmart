'use strict';

/**
 * Loại hình giao hàng / nhận hàng
 * Đồng bộ với ENUM `HoaDonBanHang.LoaiGiao` trong MySQL
 */
const FULFILLMENT_TYPE = Object.freeze({
  SHIP: 'Ship',    // Giao tận nơi (bắt buộc DiaChiNhan)
  PICKUP: 'TuLay', // Khách tự lấy tại cửa hàng
});

const FULFILLMENT_LABELS = Object.freeze({
  [FULFILLMENT_TYPE.SHIP]: 'Giao hàng tận nơi',
  [FULFILLMENT_TYPE.PICKUP]: 'Tự lấy tại cửa hàng',
});

function isValid(value) {
  return Object.values(FULFILLMENT_TYPE).includes(value);
}

module.exports = { FULFILLMENT_TYPE, FULFILLMENT_LABELS, isValid };
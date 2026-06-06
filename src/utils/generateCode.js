'use strict';

/**
 * Sinh mã theo định dạng: [PREFIX][YYMM][RANDOM]
 * Tránh trùng lặp trong cùng ngày bằng random 4-6 ký tự
 * Không dùng AUTO_INCREMENT vì không an toàn với multi-instance
 * 
 * @param {string} prefix - VD: 'HD', 'PN', 'SP'
 * @param {number} randomLength - Độ dài phần random (default: 4)
 * @returns {string}
 */
function generateCode(prefix, randomLength = 4) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const random = Array.from({ length: randomLength }, () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Loại bỏ I,O,0,1 dễ nhầm
    return chars[Math.floor(Math.random() * chars.length)];
  }).join('');
  
  return `${prefix}${yy}${mm}${random}`;
}

/** HD2405-ABCD - Hóa đơn bán hàng */
function generateInvoiceCode() {
  return generateCode('HD', 4);
}

/** PN2405-ABCD - Phiếu nhập hàng */
function generateReceiptCode() {
  return generateCode('PN', 4);
}

/** SP-ABCD12 - Sản phẩm (random dài hơn) */
function generateProductCode() {
  return generateCode('SP', 6);
}

/** VC-ABCD12 - Voucher/khuyến mãi */
function generateVoucherCode() {
  return generateCode('VC', 6);
}

/** ORD-ABCD1234 - Đơn hàng online */
function generateOrderCode() {
  return generateCode('ORD', 8);
}

/** NV2405-ABCD - Mã nhân viên */
function generateEmployeeCode() {
  return generateCode('NV', 4);
}

/**
 * Sinh mã vạch EAN-13 chuẩn quốc tế (Mã quốc gia VN: 893)
 * Thuật toán: Random 9 số tiếp theo và tính Checksum bằng Modulo 10
 */
function generateEAN13() {
  const prefix = '893';
  // Generate 9 random digits
  const randomStr = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  const base = prefix + randomStr;
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  
  const checksum = (10 - (sum % 10)) % 10;
  return base + checksum;
}

/** GD2405-ABCD - Giao dịch điểm tích lũy */
function generateLoyaltyCode() {
  return generateCode('GD', 4);
}

module.exports = {
  generateCode,      // Export base function để custom
  generateInvoiceCode,
  generateReceiptCode,
  generateProductCode,
  generateVoucherCode,
  generateOrderCode,
  generateLoyaltyCode,
  generateEmployeeCode,
  generateEAN13,
};
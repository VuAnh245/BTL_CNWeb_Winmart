'use strict';

const { pool } = require('../config/db');
const { MSG } = require('../constants/messages');
const { formatCurrency } = require('../utils/formatCurrency');

/**
 * Lấy thông tin hóa đơn để in
 * @param {number} hoaDonId 
 * @returns {Promise<Object>} Invoice data for thermal print
 */
async function getInvoiceForPrint(hoaDonId) {
  const [orders] = await pool.query(
    `SELECT 
       hd.MaHoaDon, hd.NgayLap, hd.TrangThai, hd.PhuongThucTT,
       hd.TongTienTruocKM, hd.TongTienSauKM, hd.DiemSuDung,
       hd.LoaiGiao, hd.DiaChiNhan, hd.PhiShip,
       kh.HoTen as tenKhachHang, kh.SoDienThoai as sdtKhachHang,
       nv.HoTen as tenNhanVien
     FROM HoaDonBanHang hd
     LEFT JOIN KhachHang kh ON hd.KhachHangId = kh.KhachHangId
     LEFT JOIN NhanVien nv ON hd.NhanVienId = nv.NhanVienId
     WHERE hd.HoaDonId = ?`,
    [hoaDonId]
  );
  
  if (orders.length === 0) {
    throw new Error(MSG.ORDER.NOT_FOUND);
  }
  
  const order = orders[0];
  
  // Get items
  const [items] = await pool.query(
    `SELECT 
       cthd.SoLuong, cthd.DonGiaGoc, cthd.PhanTramGiam, 
       cthd.ThueVATApDung, cthd.ThanhTienCuoi,
       sp.TenSanPham, sp.Barcode
     FROM ChiTietHoaDon cthd
     JOIN SanPham sp ON cthd.SanPhamId = sp.SanPhamId
     WHERE cthd.HoaDonId = ?`,
    [hoaDonId]
  );
  
  // Calculate summary
  const tongVAT = items.reduce((sum, item) => {
    const base = item.SoLuong * item.DonGiaGoc * (1 - item.PhanTramGiam/100);
    return sum + base * (item.ThueVATApDung / 100);
  }, 0);
  
  return {
    ...order,
    items,
    summary: {
      tongTruocKM: formatCurrency(order.TongTienTruocKM),
      tongGiamGia: formatCurrency(order.TongTienTruocKM - order.TongTienSauKM + (order.DiemSuDung * 1000)),
      tienDiemTru: formatCurrency(order.DiemSuDung * 1000),
      phiShip: formatCurrency(order.PhiShip),
      tongSauKM: formatCurrency(order.TongTienSauKM),
      tongVAT: formatCurrency(tongVAT),
      tienKhachTra: formatCurrency(order.TongTienSauKM), // Simplified
    },
    footer: {
      storeName: process.env.APP_NAME || 'WinMart POS',
      address: '123 Đường ABC, Quận 1, TP.HCM',
      phone: '1900-xxxx',
      taxCode: '0123456789',
      note: 'Cảm ơn quý khách đã mua sắm!',
    }
  };
}

/**
 * Generate HTML for thermal printer (80mm)
 */
function generateThermalHTML(invoice) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @media print {
      body { width: 80mm; margin: 0; font-family: monospace; font-size: 10px; }
      .center { text-align: center; }
      .right { text-align: right; }
      .line { border-bottom: 1px dashed #000; margin: 5px 0; }
      .item { display: flex; justify-content: space-between; margin: 2px 0; }
      .total { font-weight: bold; font-size: 12px; }
    }
  </style>
</head>
<body onload="window.print()">
  <div class="center">
    <strong>${invoice.footer.storeName}</strong><br>
    ${invoice.footer.address}<br>
    MST: ${invoice.footer.taxCode} | ĐT: ${invoice.footer.phone}
  </div>
  <div class="line"></div>
  <div><strong>HÓA ĐƠN:</strong> ${invoice.MaHoaDon}</div>
  <div>Ngày: ${new Date(invoice.NgayLap).toLocaleString('vi-VN')}</div>
  <div>NV: ${invoice.tenNhanVien}</div>
  ${invoice.tenKhachHang ? `<div>Khách: ${invoice.tenKhachHang}</div>` : ''}
  <div class="line"></div>
  ${invoice.items.map(item => `
    <div class="item">
      <span>${item.TenSanPham}<br>x${item.SoLuong}</span>
      <span class="right">${formatCurrency(item.ThanhTienCuoi)}</span>
    </div>
  `).join('')}
  <div class="line"></div>
  <div class="item total">
    <span>TỔNG CỘNG:</span>
    <span>${invoice.summary.tongSauKM}</span>
  </div>
  <div class="item">
    <span>Thanh toán:</span>
    <span>${invoice.PhuongThucTT}</span>
  </div>
  ${invoice.LoaiGiao === 'Ship' ? `<div>Giao: ${invoice.DiaChiNhan}</div>` : ''}
  <div class="line"></div>
  <div class="center">${invoice.footer.note}</div>
</body>
</html>`;
}

/**
 * Log invoice print event for audit
 */
async function logPrintEvent(hoaDonId, printerName = 'thermal') {
  // Optional: store in InvoicePrintLog table if needed
  console.log(`[Invoice] Printed #${hoaDonId} on ${printerName}`);
  return true;
}

module.exports = {
  getInvoiceForPrint,
  generateThermalHTML,
  logPrintEvent,
};
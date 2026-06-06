'use strict';

const { pool } = require('../config/db');
const { withTransaction, executeWithRetry } = require('../utils/transaction');
const { generateCode } = require('../utils/generateCode');
const { formatCurrency } = require('../utils/formatCurrency');
const { calcEarnPoints, pointsToMoney, calcMaxUsablePoints } = require('../utils/loyaltyCalc');
const { MSG, format } = require('../constants/messages');
const { ORDER_STATUS } = require('../constants/orderStatus');
const { LOYALTY_TIER } = require('../constants/loyaltyTier');
const appConfig = require('../config/app.config');

// Import batch & loyalty services
const batchService = require('./batch.service');
const loyaltyService = require('./loyalty.service');
const promotionService = require('./promotion.service');
const emailService = require('./email.service');

/**
 * Execute complete checkout flow with ACID transaction
 * Flow: Validate → Reserve FEFO → Calc total → Create Order → Deduct stock → Loyalty
 * 
 * @param {Object} params
 * @param {number} params.khachHangId - Optional for guest checkout
 * @param {Array} params.cartItems - [{ sanPhamId, soLuong, donGia, thueVAT, phanTramGiam }]
 * @param {string} params.phuongThucTT - 'TienMat' | 'ChuyenKhoan' | 'QR'
 * @param {string} params.loaiGiao - 'Ship' | 'TuLay'
 * @param {string} params.diaChiNhan - Required if loaiGiao='Ship'
 * @param {string} params.maGiamGia - Optional discount code
 * @param {number} params.diemSuDung - Points to redeem (0 if none)
 * @param {number} params.nhanVienId - Staff who processed (POS) or null (online)
 * @returns {Promise<{ hoaDonId, maHoaDon, total, pointsEarned }>}
 */
async function executeCheckout(params) {
  const {
    khachHangId,
    cartItems,
    phuongThucTT,
    loaiGiao,
    diaChiNhan,
    maGiamGia,
    diemSuDung,
    nhanVienId,
    maLoaiHinh = 'POS',
    trangThai = ORDER_STATUS.COMPLETED
  } = params;
  
  return withTransaction(async (conn) => {
    // 1️⃣ Validate input
    if (cartItems.length === 0) {
      throw new Error('Giỏ hàng trống');
    }
    if (loaiGiao === 'Ship' && !diaChiNhan?.trim()) {
      throw new Error('Vui lòng nhập địa chỉ nhận hàng');
    }
    
    // 2️⃣ Reserve FEFO stock for all items
    const batchAllocations = {}; // { sanPhamId: [{ batchId, takeQty }] }
    
    for (const item of cartItems) {
      const allocations = await batchService.getFEFOBatches(
        item.sanPhamId, 
        item.soLuong, 
        conn
      );
      batchAllocations[item.sanPhamId] = allocations;
      
      // Reserve immediately to prevent race condition
      await batchService.reserveStock(allocations, conn);
    }
    
    try {
      // 3️⃣ Calculate totals
      let tongTruocKM = 0;
      let tongGiamGia = 0;
      let tongVAT = 0;
      
      for (const item of cartItems) {
        const itemTotal = item.soLuong * item.donGia;
        const itemDiscount = item.phanTramGiam 
          ? itemTotal * (item.phanTramGiam / 100) 
          : 0;
        
        // Calculate VAT for this item based on discounted price
        const vatRate = item.thueVAT !== undefined ? item.thueVAT : appConfig.vat.default;
        const itemVAT = (itemTotal - itemDiscount) * (vatRate / 100);
        
        tongTruocKM += itemTotal;
        tongGiamGia += itemDiscount;
        tongVAT += itemVAT;
      }
      
      // Apply promo code using promotion.service
      let maGiamGiaId = null;
      if (maGiamGia) {
        try {
          const promo = await promotionService.validateCode(maGiamGia, tongTruocKM + tongVAT, khachHangId);
          tongGiamGia += promo.discountValue;
          maGiamGiaId = promo.promoId;
        } catch (err) {
          throw new Error(`Mã giảm giá không hợp lệ: ${err.message}`);
        }
      }
      
      // Apply loyalty points
      let tienDiemTru = 0;
      let pointsToUse = 0;
      if (khachHangId && diemSuDung > 0) {
        // Calculate max points allowed
        const [customer] = await executeWithRetry(conn, 'SELECT TongDiemTichLuy FROM KhachHang WHERE KhachHangId = ?', [khachHangId]);
        const maxUsable = calcMaxUsablePoints(
          tongTruocKM - tongGiamGia + tongVAT, // Can use points to pay for VAT too
          customer[0]?.TongDiemTichLuy || 0
        );
        pointsToUse = Math.min(diemSuDung, maxUsable);
        tienDiemTru = pointsToMoney(pointsToUse);
      }
      
      // Total after discount, plus VAT, minus loyalty points
      const tongSauKM = Math.max(0, tongTruocKM - tongGiamGia + tongVAT - tienDiemTru);
      
      // 4️⃣ Create Order
      const maHoaDon = generateCode('HD', 6);
      const [orderResult] = await executeWithRetry(conn,
        `INSERT INTO HoaDonBanHang 
         (MaHoaDon, KhachHangId, NhanVienId, MaGiamGiaId,
          MaLoaiHinh, LoaiGiao, DiaChiNhan, PhiShip,
          TongTienTruocKM, TongTienSauKM, DiemSuDung,
          PhuongThucTT, TrangThai)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          maHoaDon,
          khachHangId || null,
          nhanVienId,
          maGiamGiaId,
          maLoaiHinh,
          loaiGiao,
          loaiGiao === 'Ship' ? diaChiNhan : null,
          loaiGiao === 'Ship' ? 15000 : 0, // Example shipping fee
          tongTruocKM, // Note: This is pre-tax, pre-discount
          tongSauKM,   // Note: This is post-tax, post-discount, post-points
          pointsToUse > 0 ? pointsToUse : 0,
          phuongThucTT,
          trangThai,
        ]
      );
      const hoaDonId = orderResult.insertId;
      
      // 5️⃣ Create Order Items + Deduct Stock
      for (const item of cartItems) {
        const allocations = batchAllocations[item.sanPhamId];
        
        const vatRate = item.thueVAT !== undefined ? item.thueVAT : appConfig.vat.default;
        
        // Insert order item
        const thanhTien = item.soLuong * item.donGia 
          * (1 - (item.phanTramGiam || 0) / 100)
          * (1 + vatRate / 100);
        
        await executeWithRetry(conn,
          `INSERT INTO ChiTietHoaDon 
           (HoaDonId, SanPhamId, SoLuong, DonGiaGoc, 
            PhanTramGiam, ThueVATApDung, ThanhTienCuoi)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            hoaDonId,
            item.sanPhamId,
            item.soLuong,
            item.donGia,
            item.phanTramGiam || 0,
            vatRate,
            thanhTien,
          ]
        );
        
        // Deduct actual stock
        await batchService.deductStock(allocations, conn);
      }
      
      // 6️⃣ Loyalty: Earn points & Increment Promo usage
      let pointsEarned = 0;
      
      if (maGiamGiaId) {
        await promotionService.incrementUsage(maGiamGiaId, conn);
      }

      if (khachHangId) {
        // Deduct used points first
        if (pointsToUse > 0) {
          await loyaltyService.deductPoints(
            khachHangId, 
            pointsToUse,
            hoaDonId, 
            `Sử dụng điểm cho đơn ${maHoaDon}`,
            conn
          );
        }
        
        // Earn points based on TongTienSauKM ONLY if Completed
        if (trangThai === 'Completed') {
          const [customer] = await conn.query('SELECT CapDoVIP FROM KhachHang WHERE KhachHangId = ?', [khachHangId]);
          pointsEarned = calcEarnPoints(tongSauKM, customer[0]?.CapDoVIP || 'Thuong');
          if (pointsEarned > 0) {
            await loyaltyService.earnPoints(khachHangId, pointsEarned, hoaDonId, `Tích điểm đơn ${maHoaDon}`, conn);
            await loyaltyService.checkAndUpgradeTier(khachHangId, conn);
          }
        }
      }
      
      // 7️⃣ Return result
      const resultData = {
        hoaDonId,
        maHoaDon,
        total: tongSauKM,
        totalFormatted: formatCurrency(tongSauKM),
        pointsEarned,
        items: cartItems.length,
      };
      
      // 8️⃣ Auto-Email Notification (Asynchronous)
      if (loaiGiao === 'Ship' && khachHangId) {
        // Fire and forget
        (async () => {
          try {
            // Check setting
            const [storeRows] = await pool.query('SELECT GuiEmailTuDong FROM cuahang LIMIT 1');
            if (storeRows.length > 0 && storeRows[0].GuiEmailTuDong === 1) {
                // Get Customer Email & Name
                const [customerRows] = await pool.query('SELECT HoTen, Email FROM KhachHang WHERE KhachHangId = ?', [khachHangId]);
                if (customerRows.length > 0 && customerRows[0].Email) {
                    const customer = customerRows[0];
                    
                    // Fetch full item details for email
                    const itemDetails = [];
                    for (const item of cartItems) {
                        const [productRows] = await pool.query('SELECT TenSanPham FROM SanPham WHERE SanPhamId = ?', [item.sanPhamId]);
                        itemDetails.push({
                            ten: productRows.length > 0 ? productRows[0].TenSanPham : 'Sản phẩm',
                            qty: item.soLuong,
                            priceFormatted: formatCurrency(item.soLuong * item.donGia)
                        });
                    }
                    
                    const orderEmailData = {
                        maHoaDon: maHoaDon,
                        hoTen: customer.HoTen,
                        ngayDat: new Date().toLocaleString('vi-VN'),
                        diaChiNhan: diaChiNhan,
                        items: itemDetails,
                        totalFormatted: formatCurrency(tongSauKM),
                        pointsEarned: pointsEarned,
                        storeUrl: 'http://localhost:3000'
                    };
                    
                    await emailService.sendOrderSuccess(customer.Email, orderEmailData);
                }
            }
          } catch (e) {
              console.error('Lỗi khi gửi email tự động:', e);
          }
        })();
      }
      
      return resultData;
      
    } catch (err) {
      // On error: release all reserved stock before re-throw
      for (const allocations of Object.values(batchAllocations)) {
        await batchService.releaseStock(allocations, conn);
      }
      throw err;
    }
  });
}

module.exports = { executeCheckout };
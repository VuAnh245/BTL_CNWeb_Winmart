'use strict';

const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { buildWhere, buildOrderBy } = require('../utils/queryBuilder');
const { paginate } = require('../utils/pagination');
const { ORDER_STATUS, getNextAllowed } = require('../constants/orderStatus');
const { MSG, format } = require('../constants/messages');

/**
 * Lấy danh sách đơn hàng với filter
 * @param {Object} filters - { TrangThai, KhachHangId, NhanVienId, dateFrom, dateTo }
 * @param {Object} pagination 
 * @param {string} requesterRole - Để filter data theo quyền
 * @returns {Promise<{ items: Array, meta: Object }>}
 */
async function getAll(filters = {}, pagination = {}, requesterRole = 'ADMIN') {
  const { where, params } = buildWhere(filters, { tableAlias: 'hd' });
  const { limit, offset, meta } = paginate(pagination.page, pagination.limit);
  const orderBy = buildOrderBy(
    pagination.sortBy ? { column: pagination.sortBy, direction: pagination.direction } : null, 
    ['NgayLap', 'TongTienSauKM']
  );
  
  // Role-based filter
  if (requesterRole === 'STAFF' && filters.storeId) {
    // Future: multi-store support
  }
  
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) as total FROM HoaDonBanHang hd ${where}`,
    params
  );
  
  const [rows] = await pool.query(
    `SELECT 
       hd.*, 
       kh.HoTen as tenKhachHang, kh.SoDienThoai,
       nv.HoTen as tenNhanVien,
       (SELECT COUNT(*) FROM ChiTietHoaDon WHERE HoaDonId = hd.HoaDonId) as soMatHang
     FROM HoaDonBanHang hd
     LEFT JOIN KhachHang kh ON hd.KhachHangId = kh.KhachHangId
     LEFT JOIN NhanVien nv ON hd.NhanVienId = nv.NhanVienId
     ${where} ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  
  return { items: rows, meta: meta(total) };
}

/**
 * Lấy chi tiết đơn hàng + items
 */
async function getById(hoaDonId, requesterId, requesterRole) {
  // Permission check: Customer chỉ xem đơn của mình
  const [orders] = await pool.query(
    `SELECT hd.*, kh.HoTen as tenKhachHang, kh.SoDienThoai, kh.Email,
            nv.HoTen as tenNhanVien, nv.VaiTro
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
  
  // Check permission
  if (requesterRole === 'CUSTOMER' && order.KhachHangId !== requesterId) {
    throw new Error(MSG.AUTH.FORBIDDEN);
  }
  
  // Get order items (including columns needed for shipping breakdown)
  const [items] = await pool.query(
    `SELECT cthd.*, sp.TenSanPham, sp.Barcode, sp.HinhAnh, sp.CanNang, sp.CanDongGoiDacBiet, sp.DanhMucId
     FROM ChiTietHoaDon cthd
     JOIN SanPham sp ON cthd.SanPhamId = sp.SanPhamId
     WHERE cthd.HoaDonId = ?`,
    [hoaDonId]
  );

  // Calculate shipping breakdown
  let totalWeight = 0;
  let specialPackagingCount = 0;
  let freshFoodValue = 0;
  let packagingFee = 0;
  let freshFee = 0;
  let baseFee = 0;
  let discount = 0;
  
  if (order.LoaiGiao === 'Ship') {
    items.forEach(item => {
      const weight = item.CanNang || 500;
      totalWeight += weight * item.SoLuong;
      if (item.CanDongGoiDacBiet) {
        specialPackagingCount += item.SoLuong;
      }
      if (item.DanhMucId === 4) {
        freshFoodValue += item.DonGiaGoc * item.SoLuong;
      }
    });

    // Load store configurations to get fee rates
    const [storeRows] = await pool.query('SELECT * FROM CuaHang WHERE is_active = 1 LIMIT 1');
    const config = storeRows[0] || { FreeShipThreshold: 300000, PackagingFee: 5000, FreshTier1Fee: 15000, FreshTier2Fee: 25000, FreshTier2Threshold: 200000 };

    packagingFee = specialPackagingCount * config.PackagingFee;
    if (freshFoodValue > 0) {
      if (freshFoodValue >= config.FreshTier2Threshold) {
        freshFee = config.FreshTier2Fee;
      } else {
        freshFee = config.FreshTier1Fee;
      }
    }

    const phiShip = parseFloat(order.PhiShip || 0);

    if (phiShip > 0) {
      baseFee = Math.max(0, phiShip - freshFee - packagingFee);
    } else {
      // Free ship case: estimate baseFee
      const ghnService = require('./ghn.service');
      try {
        if (order.ToDistrictId && order.ToWardCode) {
          baseFee = await ghnService.calculateGHNBaseFee(order.ToDistrictId, order.ToWardCode, totalWeight);
        } else {
          baseFee = 15000;
        }
      } catch (e) {
        baseFee = 15000;
      }
      discount = baseFee + freshFee + packagingFee;
    }
  }
  
  return { 
    ...order, 
    items,
    baseFee,
    freshFee,
    packagingFee,
    discount,
    totalWeight
  };
}

/**
 * Cập nhật trạng thái đơn hàng
 */
async function updateStatus(hoaDonId, newStatus, reason = '', updaterId) {
  if (!Object.values(ORDER_STATUS).includes(newStatus)) {
    throw new Error('Trạng thái không hợp lệ');
  }
  
  // Validate state transition
    const [order] = await pool.query(
      'SELECT TrangThai, KhachHangId, TongTienSauKM, MaHoaDon, DiemSuDung, PhuongThucTT FROM HoaDonBanHang WHERE HoaDonId = ?',
      [hoaDonId]
    );
  
  if (order.length === 0) {
    throw new Error(MSG.ORDER.NOT_FOUND);
  }
  
  const currentStatus = order[0].TrangThai;
  
  const allowed = getNextAllowed(currentStatus);
  if (!allowed.includes(newStatus)) {
    throw new Error(`Không thể chuyển từ ${currentStatus} sang ${newStatus}`);
  }
  
  const success = await withTransaction(async (conn) => {
    // Nếu chuyển sang CANCELLED, hoàn trả số lượng vào kho (Lỗi thất thoát kho)
    if (newStatus === ORDER_STATUS.CANCELLED) {
      // 1. Lấy danh sách sản phẩm trong đơn hàng
      const [items] = await conn.query(
        `SELECT SanPhamId, SoLuong FROM ChiTietHoaDon WHERE HoaDonId = ?`,
        [hoaDonId]
      );
      
      // 2. Hoàn trả số lượng cho từng sản phẩm
      for (const item of items) {
        // Tìm lô hàng phù hợp nhất để cộng trả (Ưu tiên lô chưa hết hạn, FEFO)
        const [batches] = await conn.query(
          `SELECT LoHangId 
           FROM LoHangTonKho 
           WHERE SanPhamId = ? AND NgayHetHan >= CURDATE()
           ORDER BY NgayHetHan ASC LIMIT 1`,
          [item.SanPhamId]
        );
        
        let targetBatchId;
        if (batches.length > 0) {
          targetBatchId = batches[0].LoHangId;
        } else {
          // Nếu không có lô nào còn hạn, đành cộng vào lô mới nhất
          const [fallback] = await conn.query(
            `SELECT LoHangId FROM LoHangTonKho WHERE SanPhamId = ? ORDER BY LoHangId DESC LIMIT 1`,
            [item.SanPhamId]
          );
          if (fallback.length > 0) targetBatchId = fallback[0].LoHangId;
        }
        
        if (targetBatchId) {
          await conn.query(
            `UPDATE LoHangTonKho 
             SET SoLuongHienTai = SoLuongHienTai + ?, TrangThai = 'Available'
             WHERE LoHangId = ?`,
            [item.SoLuong, targetBatchId]
          );
        }
      }
      
      // 3. Hoàn trả điểm thành viên nếu có
      if (order[0].KhachHangId && order[0].DiemSuDung > 0) {
        const loyaltyService = require('./loyalty.service');
        await loyaltyService.refundPoints(
          order[0].KhachHangId,
          order[0].DiemSuDung,
          hoaDonId,
          `Hoàn điểm do hủy đơn: ${reason}`,
          conn
        );
      }
    }
    
    let transitionReason = reason;
    if (!transitionReason) {
      const getStatusLabelVi = (statusVal) => {
        if (statusVal === 'Pending') {
          return order[0].PhuongThucTT === 'TienMat' ? 'Chờ xử lý' : 'Chờ thanh toán';
        }
        if (statusVal === 'Paid') return 'Đã thanh toán';
        if (statusVal === 'Delivering') return 'Đang giao hàng';
        if (statusVal === 'Completed') return 'Hoàn thành';
        if (statusVal === 'Cancelled') return 'Đã hủy';
        if (statusVal === 'Cancelled_Return') return 'Hủy & Hoàn hàng';
        if (statusVal === 'Refunded') return 'Đã hoàn tiền';
        return statusVal;
      };
      transitionReason = `Chuyển trạng thái: ${getStatusLabelVi(currentStatus)} → ${getStatusLabelVi(newStatus)}`;
    }

    const [result] = await conn.query(
      `UPDATE HoaDonBanHang 
       SET TrangThai = ?, GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] ', ?),
           NgayCapNhat = CURRENT_TIMESTAMP
       WHERE HoaDonId = ?`,
      [newStatus, transitionReason, hoaDonId]
    );
    
    // 4. Tích điểm nếu chuyển sang COMPLETED
    if (newStatus === ORDER_STATUS.COMPLETED && order[0].KhachHangId) {
      const [customer] = await conn.query('SELECT CapDoVIP FROM KhachHang WHERE KhachHangId = ?', [order[0].KhachHangId]);
      const loyaltyService = require('./loyalty.service');
      const { calcEarnPoints } = require('../utils/loyaltyCalc');
      const pointsEarned = calcEarnPoints(order[0].TongTienSauKM, customer[0]?.CapDoVIP || 'Thuong');
      if (pointsEarned > 0) {
          await loyaltyService.earnPoints(order[0].KhachHangId, pointsEarned, hoaDonId, `Tích điểm đơn ${order[0].MaHoaDon}`, conn);
          await loyaltyService.checkAndUpgradeTier(order[0].KhachHangId, conn);
      }
    }
    
    return result.affectedRows > 0;
  });

  if (success) {
    try {
      await checkAndTriggerGHNOrder(hoaDonId, newStatus);
    } catch (err) {
      console.error('[GHN Hook Error in updateStatus]:', err.message);
    }
  }

  return success;
}

/**
 * Tự động tạo đơn hàng sang GHN khi chuyển trạng thái phù hợp
 */
async function checkAndTriggerGHNOrder(hoaDonId, newStatus) {
  // Lấy thông tin đơn hàng
  const [orders] = await pool.query(
    `SELECT * FROM HoaDonBanHang WHERE HoaDonId = ?`,
    [hoaDonId]
  );
  if (orders.length === 0) return;
  const order = orders[0];

  // Hủy đơn hàng trên GHN khi đơn WinMart bị HỦY và đã có GHNOrderCode
  const isCancelTrigger = (newStatus === ORDER_STATUS.CANCELLED || newStatus === ORDER_STATUS.CANCELLED_RETURN);
  if (isCancelTrigger && order.GHNOrderCode) {
    console.log(`[GHN Hook] Hủy đơn GHN tự động cho hóa đơn #${hoaDonId} (${order.MaHoaDon}) do đơn bị hủy.`);
    try {
      const ghnService = require('./ghn.service');
      await ghnService.cancelGHNOrder(order.GHNOrderCode);
      await pool.query(
        `UPDATE HoaDonBanHang 
         SET GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] Đã hủy đơn vận chuyển GHN: ', ?) 
         WHERE HoaDonId = ?`,
        [order.GHNOrderCode, hoaDonId]
      );
    } catch (error) {
      console.error(`[GHN Hook Error] Không thể hủy đơn GHN ${order.GHNOrderCode}:`, error.message);
      await pool.query(
        `UPDATE HoaDonBanHang 
         SET GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] Lỗi hủy đơn GHN: ', ?) 
         WHERE HoaDonId = ?`,
        [error.message.substring(0, 200), hoaDonId]
      );
    }
    return;
  }

  // Chỉ tạo đơn GHN khi:
  // - Hình thức giao hàng là Ship (LoaiGiao === 'Ship')
  // - Chưa có mã vận đơn GHN (GHNOrderCode IS NULL)
  // - Có đủ thông tin địa chỉ GHN (ToDistrictId, ToWardCode)
  if (order.LoaiGiao !== 'Ship' || order.GHNOrderCode || !order.ToDistrictId || !order.ToWardCode) {
    return;
  }

  // Luồng tạo tự động:
  // 1. Nếu đơn hàng chuyển sang 'Paid' (Đã thanh toán Online/Bank transfer)
  // 2. Hoặc nếu đơn hàng chuyển sang 'Delivering' và thanh toán COD (PhuongThucTT === 'TienMat')
  const isPaidTrigger = (newStatus === ORDER_STATUS.PAID);
  const isCODTrigger = (newStatus === ORDER_STATUS.DELIVERING && order.PhuongThucTT === 'TienMat');

  if (isPaidTrigger || isCODTrigger) {
    console.log(`[GHN Hook] Bắt đầu tạo đơn GHN tự động cho hóa đơn #${hoaDonId} (${order.MaHoaDon}). Trạng thái mới: ${newStatus}`);
    try {
      // Lấy chi tiết các sản phẩm trong đơn để tính cân nặng và danh sách hàng gửi
      const [items] = await pool.query(
        `SELECT cthd.*, sp.TenSanPham, sp.Barcode, sp.CanNang, sp.CanDongGoiDacBiet
         FROM ChiTietHoaDon cthd
         JOIN SanPham sp ON cthd.SanPhamId = sp.SanPhamId
         WHERE cthd.HoaDonId = ?`,
        [hoaDonId]
      );

      let totalWeight = 0;
      items.forEach(item => {
        totalWeight += (item.CanNang || 500) * item.SoLuong;
      });

      const ghnService = require('./ghn.service');
      const ghnRes = await ghnService.createGHNOrder(order, items, totalWeight);

      if (ghnRes && ghnRes.order_code) {
        await pool.query(
          `UPDATE HoaDonBanHang 
           SET GHNOrderCode = ?, 
               GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] Đã tạo đơn vận chuyển GHN: ', ?) 
           WHERE HoaDonId = ?`,
          [ghnRes.order_code, ghnRes.order_code, hoaDonId]
        );
        console.log(`[GHN Hook] Tạo đơn GHN thành công. Mã vận đơn: ${ghnRes.order_code}`);
      }
    } catch (error) {
      console.error(`[GHN Hook Error] Không thể tự động tạo đơn GHN cho đơn #${order.MaHoaDon}:`, error.message);
      // Ghi nhận lỗi vào ghi chú đơn hàng để admin dễ theo dõi và bấm tạo lại bằng tay
      await pool.query(
        `UPDATE HoaDonBanHang 
         SET GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] Lỗi tạo đơn GHN tự động: ', ?) 
         WHERE HoaDonId = ?`,
        [error.message.substring(0, 200), hoaDonId]
      );
    }
  }
}

/**
 * Cancel order với release stock
 */
async function cancelOrder(hoaDonId, reason, requesterId) {
  return updateStatus(hoaDonId, ORDER_STATUS.CANCELLED, reason, requesterId);
}

/**
 * Cron job: Auto-cancel pending orders > 24h
 */
async function autoCancelPendingOrders() {
  const cutoff = new Date(Date.now() - appConfig.order.autoCancelHours * 60 * 60 * 1000);
  
  const [pending] = await pool.query(
    `SELECT HoaDonId, KhachHangId, DiemSuDung 
     FROM HoaDonBanHang 
     WHERE TrangThai = ? AND NgayLap < ?`,
    [ORDER_STATUS.PENDING, cutoff]
  );
  
  let cancelled = 0;
  
  for (const order of pending) {
    try {
      await cancelOrder(order.HoaDonId, 'Tự động hủy do quá hạn thanh toán');
      cancelled++;
    } catch (err) {
      console.error(`[Order] Failed to cancel order ${order.HoaDonId}:`, err.message);
    }
  }
  
  if (cancelled > 0) {
    console.log(`[Order] Auto-cancelled ${cancelled} pending orders`);
  }
  
  return cancelled;
}

/**
 * Export order data for reporting
 */
async function exportOrders(filters = {}) {
  const { where, params } = buildWhere(filters, { tableAlias: 'hd' });
  
  const [rows] = await pool.query(
    `SELECT 
       hd.MaHoaDon, hd.NgayLap, hd.TrangThai,
       kh.HoTen as KhachHang, kh.SoDienThoai,
       hd.TongTienTruocKM, hd.TongTienSauKM, hd.PhuongThucTT,
       hd.LoaiGiao, hd.DiaChiNhan,
       nv.HoTen as NhanVien
     FROM HoaDonBanHang hd
     LEFT JOIN KhachHang kh ON hd.KhachHangId = kh.KhachHangId
     LEFT JOIN NhanVien nv ON hd.NhanVienId = nv.NhanVienId
     ${where}
     ORDER BY hd.NgayLap DESC`,
    params
  );
  
  return rows;
}

module.exports = {
  getAll,
  getById,
  updateStatus,
  cancelOrder,
  autoCancelPendingOrders,
  exportOrders,
};
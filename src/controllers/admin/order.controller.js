'use strict';

const orderService = require('../../services/order.service');

// GET /admin/orders
async function list(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const filters = {};
    if (status) filters.TrangThai = status;
    // Tương lai: Add search by MaHoaDon if supported by query builder
    if (search) filters.MaHoaDon = { $like: `%${search}%` };

    const result = await orderService.getAll(
      filters, 
      { page, limit: 15, sortBy: 'NgayLap', direction: 'DESC' },
      'ADMIN'
    );

    res.render('admin/orders/list', {
      title: 'Quản lý Đơn hàng - WinMart',
      orders: result.items,
      meta: result.meta,
      search,
      currentStatus: status
    });
  } catch (error) {
    next(error);
  }
}

// GET /admin/orders/:id
async function getDetail(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;
    const adminRole = req.session.user.VaiTro || 'ADMIN';
    
    const order = await orderService.getById(id, adminId, adminRole);
    
    res.render('admin/orders/detail', {
      title: `Chi tiết Đơn hàng ${order.MaHoaDon}`,
      currentRoute: '/admin/orders',
      order,
      user: req.session.user
    });
  } catch (error) {
    req.flash('error', error.message || 'Không tìm thấy đơn hàng.');
    res.redirect('/admin/orders');
  }
}

// POST /admin/orders/:id/status
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.session.user.id;
    
    await orderService.updateStatus(id, status, reason, adminId);
    
    req.flash('success', 'Cập nhật trạng thái đơn hàng thành công!');
    res.redirect(req.get('Referrer') || '/admin/orders');
  } catch (error) {
    req.flash('error', error.message || 'Lỗi cập nhật trạng thái.');
    res.redirect(req.get('Referrer') || '/admin/orders');
  }
}

// GET /admin/orders/:id/print
async function printReceipt(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;
    const adminRole = req.session.user.VaiTro || 'ADMIN';
    
    const order = await orderService.getById(id, adminId, adminRole);
    
    // Fetch store info for receipt (Single Store configuration)
    const db = require('../../config/db');
    const [storeRows] = await db.pool.query('SELECT TenCuaHang, DiaChi FROM cuahang LIMIT 1');
    const store = storeRows.length > 0 ? storeRows[0] : { TenCuaHang: 'WinMart Store', DiaChi: '123 Đường ABC, Quận XYZ' };
    
    // Disable layout for print page
    res.locals.layout = false;
    res.render('admin/orders/print', { 
      layout: false,
      title: `In Hóa Đơn ${order.MaHoaDon}`,
      order,
      store
    });
  } catch (error) {
    next(error);
  }
}

// POST /admin/orders/:id/refund
async function processRefund(req, res, next) {
  try {
    const { id } = req.params;
    const { type } = req.body;
    const adminId = req.session.user.id;
    
    // Fetch order details
    const order = await orderService.getById(id, adminId, 'ADMIN');
    if (!order) throw new Error('Không tìm thấy đơn hàng');
    
    if (type === 'auto') {
        const paymentService = require('../../services/payment.service');
        let refundResult = { success: false, message: 'Phương thức thanh toán không hỗ trợ hoàn tiền tự động' };
        
        if (order.PhuongThucTT === 'VNPay') {
            const transDate = new Date(order.NgayLap);
            const dateStr = transDate.getFullYear().toString() + 
                            (transDate.getMonth()+1).toString().padStart(2, '0') + 
                            transDate.getDate().toString().padStart(2, '0') + 
                            transDate.getHours().toString().padStart(2, '0') + 
                            transDate.getMinutes().toString().padStart(2, '0') + 
                            transDate.getSeconds().toString().padStart(2, '0');
            refundResult = await paymentService.refundVNPay(order.MaHoaDon, order.TongTienSauKM, dateStr, req.session.user.HoTen);
        } else if (order.PhuongThucTT === 'MoMo') {
            // Missing TransId in DB currently, we might need to store it when webhook hits, 
            // but for now let's pass a placeholder or try to use OrderCode
            refundResult = await paymentService.refundMoMo(order.MaHoaDon, order.TongTienSauKM, order.MaHoaDon); 
        }
        
        if (!refundResult.success) {
            req.flash('error', 'Hoàn tiền tự động thất bại: ' + refundResult.message);
            return res.redirect(req.get('Referrer') || '/admin/orders');
        }
    }
    
    // Update status to Refunded
    await orderService.updateStatus(id, 'Refunded', 'Hoàn tiền (' + type + ')', adminId);
    req.flash('success', 'Hoàn tiền thành công!');
    res.redirect(req.get('Referrer') || '/admin/orders');
  } catch (error) {
    req.flash('error', error.message || 'Lỗi hoàn tiền.');
    res.redirect(req.get('Referrer') || '/admin/orders');
  }
}

// POST /admin/orders/:id/ghn/create
async function createGHNOrderManual(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;
    
    // Fetch order details
    const order = await orderService.getById(id, adminId, 'ADMIN');
    if (!order) throw new Error('Không tìm thấy đơn hàng');
    
    if (order.GHNOrderCode) {
      throw new Error('Đơn hàng đã được tạo trên GHN trước đó.');
    }
    
    if (!order.ToDistrictId || !order.ToWardCode) {
      throw new Error('Đơn hàng thiếu thông tin Quận/Huyện, Phường/Xã để tạo đơn GHN.');
    }
    
    // Calculate total weight
    let totalWeight = 0;
    order.items.forEach(item => {
      totalWeight += (item.CanNang || 500) * item.SoLuong;
    });
    
    const ghnService = require('../../services/ghn.service');
    const ghnRes = await ghnService.createGHNOrder(order, order.items, totalWeight);
    
    if (ghnRes && ghnRes.order_code) {
      const db = require('../../config/db');
      await db.pool.query(
        `UPDATE HoaDonBanHang 
         SET GHNOrderCode = ?, 
             GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] Admin tạo đơn GHN thủ công: ', ?) 
         WHERE HoaDonId = ?`,
        [ghnRes.order_code, ghnRes.order_code, id]
      );
      req.flash('success', `Tạo đơn GHN thành công! Mã vận đơn: ${ghnRes.order_code}`);
    } else {
      throw new Error('Không nhận được mã vận đơn từ GHN');
    }
    res.redirect(req.get('Referrer') || `/admin/orders/${id}`);
  } catch (error) {
    req.flash('error', 'Tạo đơn GHN thất bại: ' + error.message);
    res.redirect(req.get('Referrer') || `/admin/orders/${id}`);
  }
}

// POST /admin/orders/:id/ghn/cancel
async function cancelGHNOrderManual(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;
    
    const order = await orderService.getById(id, adminId, 'ADMIN');
    if (!order) throw new Error('Không tìm thấy đơn hàng');
    
    if (!order.GHNOrderCode) {
      throw new Error('Đơn hàng chưa được tạo trên GHN.');
    }
    
    const ghnService = require('../../services/ghn.service');
    await ghnService.cancelGHNOrder(order.GHNOrderCode);
    
    const db = require('../../config/db');
    await db.pool.query(
      `UPDATE HoaDonBanHang 
       SET GHNOrderCode = NULL, 
           GhiChu = CONCAT(IFNULL(GhiChu,''), '\n[', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] Admin hủy đơn GHN thủ công: ', ?) 
       WHERE HoaDonId = ?`,
      [order.GHNOrderCode, id]
    );
    
    req.flash('success', `Hủy đơn vận chuyển GHN ${order.GHNOrderCode} thành công!`);
    res.redirect(req.get('Referrer') || `/admin/orders/${id}`);
  } catch (error) {
    req.flash('error', 'Hủy đơn GHN thất bại: ' + error.message);
    res.redirect(req.get('Referrer') || `/admin/orders/${id}`);
  }
}

// POST /admin/orders/:id/ghn/sync
async function syncGHNStatus(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;
    
    const order = await orderService.getById(id, adminId, 'ADMIN');
    if (!order) throw new Error('Không tìm thấy đơn hàng');
    
    if (!order.GHNOrderCode) {
      throw new Error('Đơn hàng chưa có mã vận đơn GHN.');
    }
    
    const ghnService = require('../../services/ghn.service');
    const ghnDetails = await ghnService.getGHNOrderDetails(order.GHNOrderCode);
    
    const ghnStatus = ghnDetails.status;
    let systemStatus = null;
    
    const ghnStatusMap = {
      'ready_to_pick': 'Chờ lấy hàng',
      'picking': 'Đang lấy hàng',
      'picked': 'Đã lấy hàng',
      'storing': 'Lưu kho',
      'transporting': 'Đang trung chuyển',
      'sorting': 'Đang phân loại',
      'delivering': 'Đang giao hàng',
      'money_collect_delivering': 'Đang giao hàng thu tiền',
      'delivered': 'Giao hàng thành công',
      'cancel': 'Hủy đơn',
      'return': 'Trả hàng',
      'returning': 'Đang trả hàng',
      'returned': 'Đã trả hàng'
    };
    const ghnStatusVi = ghnStatusMap[ghnStatus] || ghnStatus;
    let reason = `Đồng bộ trạng thái từ GHN: ${ghnStatusVi}`;
    
    if (ghnStatus === 'delivered') {
      systemStatus = 'Completed';
    } else if (ghnStatus === 'cancel') {
      systemStatus = 'Cancelled';
    } else if (['return', 'returning', 'returned'].includes(ghnStatus)) {
      systemStatus = 'Cancelled_Return';
    } else if (['ready_to_pick', 'picking', 'picked', 'storing', 'transporting', 'sorting', 'delivering', 'money_collect_delivering'].includes(ghnStatus)) {
      systemStatus = 'Delivering';
    }
    
    if (systemStatus && systemStatus !== order.TrangThai) {
      const { getNextAllowed } = require('../../constants/orderStatus');
      const allowed = getNextAllowed(order.TrangThai);
      if (allowed.includes(systemStatus)) {
        await orderService.updateStatus(id, systemStatus, reason, adminId);
        req.flash('success', `Đồng bộ trạng thái GHN thành công! Trạng thái đơn hàng chuyển thành: ${systemStatus}`);
      } else {
        req.flash('info', `Trạng thái GHN hiện tại: ${ghnStatus}. Không thay đổi trạng thái đơn hàng vì chuyển đổi từ ${order.TrangThai} sang ${systemStatus} không hợp lệ.`);
      }
    } else {
      req.flash('info', `Trạng thái GHN hiện tại: ${ghnStatus}. Không cần thay đổi trạng thái đơn hàng.`);
    }
    
    res.redirect(`/admin/orders/${id}`);
  } catch (error) {
    req.flash('error', 'Đồng bộ trạng thái GHN thất bại: ' + error.message);
    res.redirect(req.get('Referrer') || `/admin/orders/${id}`);
  }
}

module.exports = {
  list,
  getDetail,
  updateStatus,
  printReceipt,
  processRefund,
  createGHNOrderManual,
  cancelGHNOrderManual,
  syncGHNStatus
};

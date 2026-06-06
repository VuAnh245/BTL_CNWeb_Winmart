'use strict';

/**
 * GET: Hiển thị trang tất cả thông báo
 */
async function index(req, res, next) {
  try {
    // Dữ liệu mô phỏng (Placeholder)
    const notifications = [
      {
        id: 1,
        title: 'Có đơn hàng mới đang chờ xử lý',
        description: 'Đơn hàng #HD12345 từ Nguyễn Văn A vừa được thanh toán thành công.',
        type: 'info',
        time: '10 phút trước',
        read: false
      },
      {
        id: 2,
        title: 'Cảnh báo: Sản phẩm sắp hết hạn',
        description: 'Sữa chua Vinamilk nha đam (Mã: SP-0023) chỉ còn 5 ngày sử dụng.',
        type: 'warning',
        time: '1 giờ trước',
        read: false
      },
      {
        id: 3,
        title: 'Báo cáo doanh thu tuần',
        description: 'Doanh thu tuần này tăng 15% so với tuần trước. Nhấp để xem chi tiết.',
        type: 'success',
        time: 'Hôm qua',
        read: true
      },
      {
        id: 4,
        title: 'Lỗi đồng bộ tồn kho',
        description: 'Không thể đồng bộ tồn kho với máy chủ lúc 00:00. Vui lòng kiểm tra lại.',
        type: 'error',
        time: '2 ngày trước',
        read: true
      }
    ];

    res.render('admin/notifications/index', {
      title: 'Tất cả thông báo',
      currentPath: '/admin/notifications',
      notifications,
      user: req.session.user
    });
  } catch (error) {
    next(error);
  }
}

const db = require('../../config/db');

async function checkNewOrders(req, res) {
    try {
        const lastCheckTime = req.query.lastCheckTime || new Date(Date.now() - 60000).toISOString();
        
        // 1. Check store settings first
        const [storeRows] = await db.pool.query('SELECT AmBaoDonHang FROM cuahang LIMIT 1');
        const playSound = storeRows.length > 0 && storeRows[0].AmBaoDonHang === 1;

        // 2. Count new web orders since lastCheckTime
        const [orderRows] = await db.pool.query(`
            SELECT COUNT(HoaDonId) as newCount 
            FROM HoaDonBanHang 
            WHERE NgayTao > ? AND MaLoaiHinh = 'Web'
        `, [lastCheckTime]);

        const newCount = orderRows[0].newCount;

        res.json({
            success: true,
            hasNew: newCount > 0,
            count: newCount,
            playSound: playSound && newCount > 0,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Lỗi checkNewOrders:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
}

module.exports = {
  index,
  checkNewOrders
};

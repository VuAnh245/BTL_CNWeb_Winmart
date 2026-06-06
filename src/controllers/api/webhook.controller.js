'use strict';

const orderService = require('../../services/order.service');

// API Nhận Webhook từ GHN / Ahamove
exports.shippingWebhook = async (req, res, next) => {
    try {
        // 1. Xác thực bảo mật (Ví dụ Signature / HMAC từ đối tác)
        // const signature = req.headers['x-shipping-signature'];
        // if (!verifySignature(req.body, signature)) return res.status(401).send('Unauthorized');
        
        const payload = req.body;
        
        // Ví dụ cấu trúc Webhook của Ahamove / GHN
        // payload = { order_code: "HD123", status: "DELIVERED", ... }
        const orderCode = payload.client_order_code || payload.order_code || payload.OrderCode;
        const shippingStatus = payload.status || payload.Status;
        
        if (!orderCode || !shippingStatus) {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }
        
        // Lấy thông tin đơn hàng trong hệ thống
        const { pool } = require('../../config/db');
        const [orders] = await pool.query('SELECT HoaDonId, TrangThai FROM HoaDonBanHang WHERE MaHoaDon = ? OR GHNOrderCode = ?', [orderCode, orderCode]);
        
        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        
        const orderId = orders[0].HoaDonId;
        const currentStatus = orders[0].TrangThai;
        
        // Ánh xạ trạng thái ĐVVC sang trạng thái hệ thống
        let newStatus = null;
        let reason = 'Webhook ĐVVC cập nhật: ' + shippingStatus;
        
        // Map examples
        switch (shippingStatus.toUpperCase()) {
            case 'DELIVERING':
            case 'PICKED_UP':
                newStatus = 'Delivering';
                break;
            case 'DELIVERED':
            case 'COMPLETED':
                newStatus = 'Completed';
                break;
            case 'RETURNED':
            case 'CANCELLED':
            case 'FAILED':
                newStatus = 'Cancelled_Return';
                break;
            default:
                // Trạng thái không cần xử lý (VD: IN_TRANSIT, WAREHOUSE...)
                return res.json({ success: true, message: 'Status ignored' });
        }
        
        // Chỉ cập nhật nếu trạng thái thay đổi
        if (newStatus && currentStatus !== newStatus) {
            // Lưu ý: UpdateStatus sẽ tự động cộng điểm nếu status mới là Completed
            await orderService.updateStatus(orderId, newStatus, reason, null); // AdminId = null (System API)
            console.log(`[Webhook] Tự động cập nhật đơn ${orderCode} -> ${newStatus}`);
        }
        
        res.json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        console.error('[Webhook Error]', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

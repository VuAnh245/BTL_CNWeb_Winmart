'use strict';
const promotionService = require('../../services/promotion.service');

// Danh sách mã giảm giá
async function index(req, res, next) {
    try {
        await promotionService.autoExpirePromotions();
        
        const page = parseInt(req.query.page) || 1;
        const result = await promotionService.getAll({ is_active: 1 }, { page, limit: 50, sortBy: 'NgayTao', direction: 'DESC' });
        
        const promotions = result.items.map(p => {
            const now = new Date();
            const start = new Date(p.NgayBatDau);
            const end = new Date(p.NgayKetThuc);
            
            if (p.TrangThai === 'BiKhoa' || p.TrangThai === 'HetHieuLuc') {
                p.HienThiTrangThai = 'Hết hiệu lực';
                p.StatusColor = 'bg-gray-100 text-gray-700';
            } else if (now < start) {
                p.HienThiTrangThai = 'Sắp diễn ra';
                p.StatusColor = 'bg-blue-100 text-blue-700';
            } else if (now > end) {
                p.HienThiTrangThai = 'Đã kết thúc';
                p.StatusColor = 'bg-gray-100 text-gray-700';
            } else if (p.GioiHanSuDung > 0 && p.SoLanDaSuDung >= p.GioiHanSuDung) {
                p.HienThiTrangThai = 'Hết lượt';
                p.StatusColor = 'bg-red-100 text-red-700';
            } else {
                p.HienThiTrangThai = 'Đang diễn ra';
                p.StatusColor = 'bg-green-100 text-green-700';
            }
            return p;
        });

        res.render('admin/promotions/list', {
            title: 'Quản lý Mã Giảm Giá',
            currentRoute: '/admin/promotions',
            user: req.session.user,
            promotions
        });
    } catch (error) {
        next(error);
    }
}

// Giao diện tạo mã giảm giá
async function getCreate(req, res, next) {
    try {
        await promotionService.autoExpirePromotions();
        
        const page = parseInt(req.query.page) || 1;
        const result = await promotionService.getAll({ is_active: 1 }, { page, limit: 50, sortBy: 'NgayTao', direction: 'DESC' });
        
        const promotions = result.items.map(p => {
            const now = new Date();
            const start = new Date(p.NgayBatDau);
            const end = new Date(p.NgayKetThuc);
            
            if (p.TrangThai === 'BiKhoa' || p.TrangThai === 'HetHieuLuc') {
                p.HienThiTrangThai = 'Hết hiệu lực';
                p.StatusColor = 'bg-gray-100 text-gray-700';
            } else if (now < start) {
                p.HienThiTrangThai = 'Sắp diễn ra';
                p.StatusColor = 'bg-blue-100 text-blue-700';
            } else if (now > end) {
                p.HienThiTrangThai = 'Đã kết thúc';
                p.StatusColor = 'bg-gray-100 text-gray-700';
            } else if (p.GioiHanSuDung > 0 && p.SoLanDaSuDung >= p.GioiHanSuDung) {
                p.HienThiTrangThai = 'Hết lượt';
                p.StatusColor = 'bg-red-100 text-red-700';
            } else {
                p.HienThiTrangThai = 'Đang diễn ra';
                p.StatusColor = 'bg-green-100 text-green-700';
            }
            return p;
        });

        res.render('admin/promotions/list', {
            title: 'Tạo Mã Giảm Giá',
            currentRoute: '/admin/promotions',
            user: req.session.user,
            promotions,
            openSlideOver: true
        });
    } catch (error) {
        next(error);
    }
}

// Lưu mã giảm giá
async function postCreate(req, res, next) {
    try {
        const {
            MaCode, TenMaGiamGia, LoaiGiamGia, GiaTri, PhanTramToiDa,
            GiaTriDonHangToiThieu, NgayBatDau, NgayKetThuc, GioiHanSuDung
        } = req.body;

        if (!MaCode || !TenMaGiamGia || !LoaiGiamGia || !GiaTri || !NgayBatDau || !NgayKetThuc) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đủ các trường bắt buộc' });
        }

        const data = {
            MaCode: MaCode.toUpperCase(),
            TenMaGiamGia,
            LoaiGiamGia,
            GiaTri,
            PhanTramToiDa: PhanTramToiDa || null,
            GiaTriDonHangToiThieu: GiaTriDonHangToiThieu || 0,
            NgayBatDau,
            NgayKetThuc,
            GioiHanSuDung: GioiHanSuDung || null
        };

        await promotionService.create(data, req.session.user.id);

        res.json({ success: true, message: 'Tạo mã giảm giá thành công!', redirectUrl: '/admin/promotions' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

// Giao diện sửa mã giảm giá
async function getEdit(req, res, next) {
    try {
        const { id } = req.params;
        const editPromotion = await promotionService.getById(id);
        
        if (!editPromotion) {
            req.flash('error', 'Không tìm thấy mã giảm giá');
            return res.redirect('/admin/promotions');
        }

        await promotionService.autoExpirePromotions();
        
        const page = parseInt(req.query.page) || 1;
        const result = await promotionService.getAll({ is_active: 1 }, { page, limit: 50, sortBy: 'NgayTao', direction: 'DESC' });
        
        const promotions = result.items.map(p => {
            const now = new Date();
            const start = new Date(p.NgayBatDau);
            const end = new Date(p.NgayKetThuc);
            
            if (p.TrangThai === 'BiKhoa' || p.TrangThai === 'HetHieuLuc') {
                p.HienThiTrangThai = 'Hết hiệu lực';
                p.StatusColor = 'bg-gray-100 text-gray-700';
            } else if (now < start) {
                p.HienThiTrangThai = 'Sắp diễn ra';
                p.StatusColor = 'bg-blue-100 text-blue-700';
            } else if (now > end) {
                p.HienThiTrangThai = 'Đã kết thúc';
                p.StatusColor = 'bg-gray-100 text-gray-700';
            } else if (p.GioiHanSuDung > 0 && p.SoLanDaSuDung >= p.GioiHanSuDung) {
                p.HienThiTrangThai = 'Hết lượt';
                p.StatusColor = 'bg-red-100 text-red-700';
            } else {
                p.HienThiTrangThai = 'Đang diễn ra';
                p.StatusColor = 'bg-green-100 text-green-700';
            }
            return p;
        });

        res.render('admin/promotions/list', {
            title: 'Sửa Mã Giảm Giá',
            currentRoute: '/admin/promotions',
            user: req.session.user,
            promotions,
            openSlideOver: true,
            editPromotion
        });
    } catch (error) {
        next(error);
    }
}

// Lưu cập nhật mã giảm giá
async function postEdit(req, res, next) {
    try {
        const { id } = req.params;
        const {
            TenMaGiamGia, GiaTri, PhanTramToiDa,
            GiaTriDonHangToiThieu, NgayBatDau, NgayKetThuc, GioiHanSuDung
        } = req.body;

        if (!TenMaGiamGia || !GiaTri || !NgayBatDau || !NgayKetThuc) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đủ các trường bắt buộc' });
        }

        const data = {
            TenMaGiamGia,
            GiaTri,
            PhanTramToiDa: PhanTramToiDa || null,
            GiaTriDonHangToiThieu: GiaTriDonHangToiThieu || 0,
            NgayBatDau,
            NgayKetThuc,
            GioiHanSuDung: GioiHanSuDung || null
        };

        await promotionService.update(id, data, req.session.user.id);

        res.json({ success: true, message: 'Cập nhật mã giảm giá thành công!', redirectUrl: '/admin/promotions' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

// Thay đổi trạng thái/Xóa mềm
async function postToggle(req, res, next) {
    try {
        const { id } = req.params;
        await promotionService.softDelete(id, req.session.user.id);
        res.json({ success: true, message: 'Đã hủy mã giảm giá' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
}

// Phát (Broadcast) mã giảm giá qua Email Queue
async function postBroadcast(req, res, next) {
    try {
        const { id } = req.params;
        const { targetAudience } = req.body; // 'all' hoặc 'vip'
        
        const promotion = await promotionService.getById(id);
        if (!promotion) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá' });
        }

        const db = require('../../config/db');
        let query = `SELECT HoTen, Email, TongDiemTichLuy, CapDoVIP FROM KhachHang WHERE is_active = 1 AND Email IS NOT NULL AND Email != ''`;
        if (targetAudience === 'vip') {
            query += ` AND CapDoVIP != 'Thuong'`;
        }

        const [customers] = await db.pool.query(query);
        
        if (customers.length === 0) {
            return res.status(400).json({ success: false, message: 'Không có khách hàng nào phù hợp để gửi email.' });
        }

        const emailQueueService = require('../../services/emailQueue.service');
        emailQueueService.addPromoBroadcast(customers, promotion);

        res.json({ success: true, message: `Đã đưa ${customers.length} email vào hàng đợi gửi đi!` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

// Lấy tiến độ gửi email
async function getQueueStatus(req, res, next) {
    try {
        const emailQueueService = require('../../services/emailQueue.service');
        res.json({
            success: true,
            pending: emailQueueService.queue.length,
            isProcessing: emailQueueService.isProcessing,
            stats: emailQueueService.stats
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    index,
    getCreate,
    postCreate,
    getEdit,
    postEdit,
    postToggle,
    postBroadcast,
    getQueueStatus
};

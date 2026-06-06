const db = require('../../config/db');
const appConfig = require('../../config/app.config');
const { LOYALTY_TIER } = require('../../constants/loyaltyTier');
const orderService = require('../../services/order.service');

exports.index = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const role = req.session.user.role;
        
        let profileData = {};
        let totalSpent = 0;

        if (role === 'CUSTOMER') {
            const [users] = await db.pool.query('SELECT * FROM KhachHang WHERE KhachHangId = ?', [userId]);
            if (users.length > 0) {
                profileData = users[0];
            }
            
            // Calculate total spent from completed orders
            const [orders] = await db.pool.query('SELECT SUM(TongTienSauKM) as total FROM HoaDonBanHang WHERE KhachHangId = ? AND TrangThai = "Completed"', [userId]);
            if (orders.length > 0 && orders[0].total) {
                totalSpent = parseFloat(orders[0].total);
            }
        } else {
            // For NhanVien testing frontend
            const [users] = await db.pool.query('SELECT * FROM NhanVien WHERE NhanVienId = ?', [userId]);
            if (users.length > 0) {
                profileData = {
                    HoTen: users[0].HoTen,
                    SoDienThoai: users[0].SoDienThoai,
                    Email: users[0].Email,
                    TongDiemTichLuy: 0,
                    CapDoVIP: 'Nhân viên'
                };
            }
        }

        res.render('client/profile/index', {
            title: 'Hồ sơ cá nhân',
            profileData: profileData,
            totalSpent: totalSpent,
            appConfig: appConfig,
            LOYALTY_TIER: LOYALTY_TIER,
            activePage: 'profile'
        });
    } catch (error) {
        console.error('Lỗi trang hồ sơ:', error);
        req.flash('error', 'Đã xảy ra lỗi khi tải hồ sơ.');
        res.redirect('/');
    }
};

exports.update = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const role = req.session.user.role;
        const { fullName, phone, email } = req.body;

        if (role !== 'CUSTOMER') {
            req.flash('error', 'Chỉ tài khoản khách hàng mới có thể cập nhật thông tin tại đây.');
            return res.redirect('/profile');
        }

        // 1. Validate đầu vào
        if (!fullName || fullName.trim().length < 2) {
            req.flash('error', 'Họ tên phải có ít nhất 2 ký tự.');
            return res.redirect('/profile');
        }

        const phoneRegex = /^0[3|5|7|8|9]\d{8}$/;
        if (phone && !phoneRegex.test(phone)) {
            req.flash('error', 'Số điện thoại không hợp lệ (VD: 0912345678).');
            return res.redirect('/profile');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            req.flash('error', 'Email không hợp lệ.');
            return res.redirect('/profile');
        }

        // 2. Kiểm tra trùng lặp SĐT hoặc Email (với người khác)
        const [existing] = await db.pool.query(
            `SELECT KhachHangId, SoDienThoai, Email FROM KhachHang 
             WHERE (SoDienThoai = ? OR Email = ?) AND KhachHangId != ? AND is_active = 1`,
            [phone || null, email || null, userId]
        );

        if (existing.length > 0) {
            req.flash('error', 'Số điện thoại hoặc Email đã được sử dụng bởi tài khoản khác.');
            return res.redirect('/profile');
        }

        // 3. Cập nhật
        await db.pool.query(
            'UPDATE KhachHang SET HoTen = ?, SoDienThoai = ?, Email = ? WHERE KhachHangId = ?',
            [fullName.trim(), phone || null, email || null, userId]
        );
        
        // Cập nhật session data
        req.session.user.name = fullName.trim();
        req.session.user.phone = phone || null;
        req.session.user.email = email || null;
        
        req.flash('success', 'Cập nhật thông tin thành công!');
        res.redirect('/profile');
    } catch (error) {
        console.error('Lỗi cập nhật hồ sơ:', error);
        req.flash('error', 'Đã xảy ra lỗi khi cập nhật thông tin.');
        res.redirect('/profile');
    }
};

exports.orders = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const role = req.session.user.role;
        
        let query = `
            SELECT 
                h.HoaDonId, h.MaHoaDon, h.NgayLap, h.TongTienSauKM, 
                h.PhuongThucTT, h.TrangThai, h.DiaChiNhan,
                COUNT(c.ChiTietHoaDonId) as SoLuongSanPham
            FROM HoaDonBanHang h
            LEFT JOIN ChiTietHoaDon c ON h.HoaDonId = c.HoaDonId
        `;
        
        const params = [];
        
        if (role === 'CUSTOMER') {
            query += ` WHERE h.KhachHangId = ?`;
            params.push(userId);
        } else {
            // For staff/admin ordering online (test purpose)
            query += ` WHERE h.NhanVienId = ?`;
            params.push(userId);
        }
        
        query += ` GROUP BY h.HoaDonId ORDER BY h.NgayLap DESC`;
        
        const [orders] = await db.pool.query(query, params);
        
        // Formatter function for status
        const getStatusBadge = (status, paymentMethod = '') => {
            switch(status) {
                case 'Pending': 
                    if (paymentMethod === 'TienMat') {
                        return '<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Chờ xử lý</span>';
                    }
                    return '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Chờ thanh toán</span>';
                case 'Paid': return '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đã thanh toán</span>';
                case 'Delivering': return '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đang giao hàng</span>';
                case 'Completed': return '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Hoàn thành</span>';
                case 'Cancelled': return '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đã hủy</span>';
                case 'Cancelled_Return': return '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Hủy & Hoàn hàng</span>';
                case 'Refunded': return '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đã hoàn tiền</span>';
                default: return '<span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Không xác định</span>';
            }
        };

        res.render('client/profile/orders', {
            title: 'Lịch sử đơn hàng',
            orders: orders,
            getStatusBadge: getStatusBadge,
            activePage: 'profile'
        });
        
    } catch (error) {
        console.error('Lỗi lấy danh sách đơn hàng:', error);
        req.flash('error', 'Đã xảy ra lỗi khi lấy danh sách đơn hàng.');
        res.redirect('/');
    }
};

exports.orderDetail = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user.id;
        const role = req.session.user.role;
        
        // 1. Fetch Order using orderService to load calculated shipping breakdown and verify permission
        const order = await orderService.getById(orderId, userId, role);
        const details = order.items;
        
        const getStatusBadge = (status, paymentMethod = '') => {
            switch(status) {
                case 'Pending': 
                    if (paymentMethod === 'TienMat') {
                        return '<span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Chờ xử lý</span>';
                    }
                    return '<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Chờ thanh toán</span>';
                case 'Paid': return '<span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đã thanh toán</span>';
                case 'Delivering': return '<span class="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đang giao hàng</span>';
                case 'Completed': return '<span class="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Hoàn thành</span>';
                case 'Cancelled': return '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đã hủy</span>';
                case 'Cancelled_Return': return '<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Hủy & Hoàn hàng</span>';
                case 'Refunded': return '<span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Đã hoàn tiền</span>';
                default: return '<span class="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">Không xác định</span>';
            }
        };

        res.render('client/profile/orderDetail', {
            title: 'Chi tiết đơn hàng ' + order.MaHoaDon,
            order: order,
            details: details,
            getStatusBadge: getStatusBadge,
            activePage: 'profile'
        });
        
    } catch (error) {
        console.error('Lỗi lấy chi tiết đơn hàng:', error);
        req.flash('error', 'Đã xảy ra lỗi khi lấy chi tiết đơn hàng.');
        res.redirect('/profile/orders');
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.session.user.id;
        const role = req.session.user.role;
        
        // 1. Verify ownership
        let orderQuery = `SELECT * FROM HoaDonBanHang WHERE HoaDonId = ?`;
        const params = [orderId];
        if (role === 'CUSTOMER') {
            orderQuery += ` AND KhachHangId = ?`;
            params.push(userId);
        } else {
            orderQuery += ` AND NhanVienId = ?`;
            params.push(userId);
        }
        
        const [orders] = await db.pool.query(orderQuery, params);
        if (orders.length === 0) {
            req.flash('error', 'Không tìm thấy đơn hàng hoặc bạn không có quyền hủy.');
            return res.redirect('/profile/orders');
        }
        
        const order = orders[0];
        if (order.TrangThai !== 'Pending') {
            req.flash('error', 'Chỉ có thể hủy đơn hàng đang chờ xử lý (Pending).');
            return res.redirect('/profile/orders/' + orderId);
        }
        
        // 2. Cancel order & restore stock
        const orderService = require('../../services/order.service');
        const userReason = req.body.cancelReason ? req.body.cancelReason.trim() : '';
        const reasonText = userReason ? `Khách tự hủy: ${userReason}` : 'Khách hàng tự hủy trên web';
        
        await orderService.updateStatus(orderId, 'Cancelled', reasonText);
        
        req.flash('success', 'Hủy đơn hàng thành công và trả lại số lượng kho.');
        res.redirect('/profile/orders/' + orderId);
        
    } catch (error) {
        console.error('Lỗi hủy đơn hàng:', error);
        req.flash('error', error.message || 'Đã xảy ra lỗi khi hủy đơn hàng.');
        res.redirect('/profile/orders/' + req.params.id);
    }
};

exports.wishlist = async (req, res) => {
    try {
        const idsStr = req.query.ids;
        let products = [];
        
        if (idsStr) {
            let ids = [];
            try {
                ids = JSON.parse(idsStr);
            } catch(e) {}
            
            if (Array.isArray(ids) && ids.length > 0) {
                // Lọc bỏ phần tử không phải số hợp lệ
                ids = ids.map(id => Number(id)).filter(id => !isNaN(id));
                if (ids.length > 0) {
                    const placeholders = ids.map(() => '?').join(',');
                    const [rows] = await db.pool.query(
                        `SELECT * FROM SanPham WHERE SanPhamId IN (${placeholders}) AND is_active = 1`,
                        ids
                    );
                    products = rows;
                }
            }
        }
        
        res.render('client/profile/wishlist', {
            title: 'Sản phẩm yêu thích',
            products: products,
            activePage: 'wishlist'
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách wishlist:', error);
        req.flash('error', 'Đã xảy ra lỗi khi tải danh sách yêu thích.');
        res.redirect('/profile');
    }
};

exports.address = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const role = req.session.user.role;
        
        let addresses = [];
        
        if (role === 'CUSTOMER') {
            const [rows] = await db.pool.query(
                `SELECT DISTINCT DiaChiNhan 
                 FROM HoaDonBanHang 
                 WHERE KhachHangId = ? AND DiaChiNhan IS NOT NULL AND DiaChiNhan != ''
                 ORDER BY NgayLap DESC`,
                [userId]
            );
            addresses = rows.map(r => r.DiaChiNhan);
        } else {
            const [rows] = await db.pool.query(
                `SELECT DISTINCT DiaChiNhan 
                 FROM HoaDonBanHang 
                 WHERE NhanVienId = ? AND DiaChiNhan IS NOT NULL AND DiaChiNhan != ''
                 ORDER BY NgayLap DESC`,
                [userId]
            );
            addresses = rows.map(r => r.DiaChiNhan);
        }
        
        res.render('client/profile/address', {
            title: 'Sổ địa chỉ',
            addresses: addresses,
            activePage: 'address'
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách địa chỉ:', error);
        req.flash('error', 'Đã xảy ra lỗi khi tải sổ địa chỉ.');
        res.redirect('/profile');
    }
};

exports.getChangePassword = async (req, res) => {
    try {
        res.render('client/profile/change-password', {
            title: 'Đổi mật khẩu',
            activePage: 'profile'
        });
    } catch (error) {
        req.flash('error', 'Lỗi hiển thị trang đổi mật khẩu');
        res.redirect('/profile');
    }
};

exports.postChangePassword = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const role = req.session.user.role;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (role !== 'CUSTOMER') {
            return res.status(403).json({ success: false, message: 'Chỉ khách hàng mới có thể đổi mật khẩu tại đây.' });
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không khớp.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
        }

        const [users] = await db.pool.query('SELECT MatKhauHash FROM KhachHang WHERE KhachHangId = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }

        const customer = users[0];
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(currentPassword, customer.MatKhauHash);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await db.pool.query('UPDATE KhachHang SET MatKhauHash = ? WHERE KhachHangId = ?', [newHash, userId]);

        res.json({ success: true, message: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại.' });
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống.' });
    }
};

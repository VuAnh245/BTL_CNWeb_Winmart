const db = require('../../config/db');
const bcrypt = require('bcryptjs');

exports.getProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [users] = await db.pool.query('SELECT HoTen, Email, SoDienThoai, VaiTro FROM NhanVien WHERE NhanVienId = ?', [userId]);
        
        if (users.length === 0) {
            req.flash('error', 'Không tìm thấy tài khoản');
            return res.redirect('/admin');
        }

        res.render('admin/profile', {
            title: 'Hồ sơ cá nhân',
            userProfile: users[0],
            currentPath: '/admin/profile'
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        req.flash('error', 'Lỗi hệ thống khi tải hồ sơ');
        res.redirect('/admin');
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { HoTen, SoDienThoai, currentPassword, newPassword, confirmPassword } = req.body;

        // Cập nhật thông tin cơ bản
        await db.pool.query('UPDATE NhanVien SET HoTen = ?, SoDienThoai = ? WHERE NhanVienId = ?', [HoTen, SoDienThoai, userId]);

        // Cập nhật session name
        req.session.user.name = HoTen;

        // Xử lý đổi mật khẩu nếu có nhập currentPassword
        if (currentPassword) {
            if (newPassword !== confirmPassword) {
                req.flash('error', 'Mật khẩu xác nhận không khớp');
                return res.redirect('/admin/profile');
            }

            const [users] = await db.pool.query('SELECT MatKhauHash FROM NhanVien WHERE NhanVienId = ?', [userId]);
            const validPassword = await bcrypt.compare(currentPassword, users[0].MatKhauHash);
            
            if (!validPassword) {
                req.flash('error', 'Mật khẩu hiện tại không đúng');
                return res.redirect('/admin/profile');
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            await db.pool.query('UPDATE NhanVien SET MatKhauHash = ? WHERE NhanVienId = ?', [hashedPassword, userId]);
            
            req.flash('success', 'Cập nhật thông tin và đổi mật khẩu thành công');
        } else {
            req.flash('success', 'Cập nhật thông tin thành công');
        }

        res.redirect('/admin/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error', 'Lỗi hệ thống khi cập nhật hồ sơ');
        res.redirect('/admin/profile');
    }
};

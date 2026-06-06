// src/config/passport.js - Cấu hình Google OAuth 2.0 Strategy
'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./db');

// =============================================
// SERIALIZE / DESERIALIZE
// =============================================
// Lưu thông tin tối thiểu vào session
passport.serializeUser((user, done) => {
    done(null, { id: user.KhachHangId, source: 'customer' });
});

// Đọc lại thông tin đầy đủ từ DB khi cần
passport.deserializeUser(async (sessionData, done) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT KhachHangId, MaKhachHang, HoTen, SoDienThoai, Email,
                    CapDoVIP, TongDiemTichLuy, TongChiTieu
             FROM KhachHang WHERE KhachHangId = ? AND is_active = 1`,
            [sessionData.id]
        );
        if (rows.length === 0) return done(null, false);
        done(null, rows[0]);
    } catch (err) {
        done(err, null);
    }
});

// =============================================
// GOOGLE STRATEGY
// =============================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',
        scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value || null;
            const displayName = profile.displayName || 'Khách hàng Google';

            console.log('🔐 [GOOGLE AUTH] Profile:', { googleId, email, displayName });

            // Bước 1: Tìm bằng GoogleId (đã liên kết trước đó)
            let [rows] = await db.pool.query(
                'SELECT * FROM KhachHang WHERE GoogleId = ? AND is_active = 1 LIMIT 1',
                [googleId]
            );

            if (rows.length > 0) {
                console.log('✅ [GOOGLE AUTH] Tài khoản đã liên kết Google, đăng nhập ngay');
                return done(null, rows[0]);
            }

            // Bước 2: Tìm bằng Email (đã đăng ký thủ công trước đó)
            if (email) {
                [rows] = await db.pool.query(
                    'SELECT * FROM KhachHang WHERE Email = ? AND is_active = 1 LIMIT 1',
                    [email]
                );

                if (rows.length > 0) {
                    // Liên kết GoogleId vào tài khoản hiện có
                    await db.pool.query(
                        'UPDATE KhachHang SET GoogleId = ? WHERE KhachHangId = ?',
                        [googleId, rows[0].KhachHangId]
                    );
                    console.log(`✅ [GOOGLE AUTH] Liên kết Google vào tài khoản cũ: ${rows[0].HoTen}`);
                    rows[0].GoogleId = googleId;
                    return done(null, rows[0]);
                }
            }

            // Bước 3: Tạo tài khoản KhachHang mới (không cần mật khẩu)
            const maKhachHang = `KH${Date.now()}`;
            const [result] = await db.pool.query(
                `INSERT INTO KhachHang (MaKhachHang, HoTen, Email, GoogleId, CapDoVIP, is_active)
                 VALUES (?, ?, ?, ?, 'Thuong', 1)`,
                [maKhachHang, displayName, email, googleId]
            );

            const [newUser] = await db.pool.query(
                'SELECT * FROM KhachHang WHERE KhachHangId = ?',
                [result.insertId]
            );

            console.log(`✅ [GOOGLE AUTH] Tạo tài khoản mới: ${displayName} (ID: ${result.insertId})`);
            return done(null, newUser[0]);

        } catch (err) {
            console.error('❌ [GOOGLE AUTH ERROR]:', err.message);
            return done(err, null);
        }
    }));

    console.log('🔑 Google OAuth Strategy đã được khởi tạo');
} else {
    console.log('⚠️  Google OAuth chưa được cấu hình (thiếu GOOGLE_CLIENT_ID trong .env)');
}

module.exports = passport;

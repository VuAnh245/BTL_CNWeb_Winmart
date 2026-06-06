-- =========================================================
-- HỆ THỐNG WEB BÁN HÀNG WINMART - MYSQL SCHEMA
-- Tương thích: XAMPP (MariaDB 10.4+ / MySQL 8.0+)
-- Charset: utf8mb4_unicode_ci | Soft-delete: is_active
-- Traceability: UC-C01..C05, UC-S01..S03, UC-A01..A04
-- =========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. DANH MỤC (UC-A01)
CREATE TABLE IF NOT EXISTS DanhMuc (
    DanhMucId INT AUTO_INCREMENT PRIMARY KEY,
    MaDanhMuc VARCHAR(10) NOT NULL UNIQUE COMMENT 'App generate: DM202405001',
    TenDanhMuc VARCHAR(100) NOT NULL UNIQUE,
    MoTa VARCHAR(255),
    is_active TINYINT(1) DEFAULT 1 COMMENT '1: Còn bán, 0: Ngừng kinh doanh',
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. NHÀ CUNG CẤP (UC-A02)
CREATE TABLE IF NOT EXISTS NhaCungCap (
    NhaCungCapId INT AUTO_INCREMENT PRIMARY KEY,
    MaNhaCungCap VARCHAR(10) NOT NULL UNIQUE COMMENT 'App generate: NCC202405001',
    TenNhaCungCap VARCHAR(100) NOT NULL,
    SoDienThoai VARCHAR(15) UNIQUE,
    Email VARCHAR(100) UNIQUE,
    DiaChi VARCHAR(255),
    MaSoThue VARCHAR(20),
    is_active TINYINT(1) DEFAULT 1,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT CK_Email_NCC CHECK (Email IS NULL OR Email REGEXP '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. NHÂN VIÊN (UC-C01, UC-S01, UC-A01)
CREATE TABLE IF NOT EXISTS NhanVien (
    NhanVienId INT AUTO_INCREMENT PRIMARY KEY,
    MaNhanVien VARCHAR(10) NOT NULL UNIQUE COMMENT 'App generate: NV202405001',
    HoTen VARCHAR(100) NOT NULL,
    TenDangNhap VARCHAR(50) NOT NULL UNIQUE,
    MatKhauHash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
    VaiTro ENUM('CUSTOMER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'STAFF',
    SoDienThoai VARCHAR(15) UNIQUE,
    Email VARCHAR(100) UNIQUE,
    NgayVaoLam DATE,
    TrangThai ENUM('DangLam', 'NghiViec', 'KhoaTam') DEFAULT 'DangLam',
    is_active TINYINT(1) DEFAULT 1,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. KHÁCH HÀNG (UC-C01, UC-C05, UC-A03)
CREATE TABLE IF NOT EXISTS KhachHang (
    KhachHangId INT AUTO_INCREMENT PRIMARY KEY,
    MaKhachHang VARCHAR(10) NOT NULL UNIQUE COMMENT 'App generate: KH202405001',
    SoDienThoai VARCHAR(15) UNIQUE,
    HoTen VARCHAR(100) NOT NULL,
    Email VARCHAR(100) UNIQUE,
    MatKhauHash VARCHAR(255) NULL COMMENT 'bcrypt hash, NULL nếu đăng nhập Google',
    GoogleId VARCHAR(255) UNIQUE DEFAULT NULL COMMENT 'Google OAuth2 subject ID',
    CapDoVIP ENUM('Thuong', 'VIP1', 'VIP2', 'VIP3') DEFAULT 'Thuong' COMMENT 'WinMart Plus tiers',
    TongDiemTichLuy INT DEFAULT 0,
    TongChiTieu DECIMAL(18,2) DEFAULT 0.00,
    is_active TINYINT(1) DEFAULT 1,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. SẢN PHẨM FMCG (UC-A01, UC-C02)
CREATE TABLE IF NOT EXISTS SanPham (
    SanPhamId INT AUTO_INCREMENT PRIMARY KEY,
    MaSanPham VARCHAR(10) NOT NULL UNIQUE COMMENT 'App generate: SP202405001',
    TenSanPham VARCHAR(255) NOT NULL,
    DanhMucId INT NOT NULL,
    NhaCungCapId INT,
    DonViTinh VARCHAR(20) DEFAULT 'Cái',
    Barcode VARCHAR(50) UNIQUE COMMENT 'EAN-13 / Mã vạch',
    GiaBan DECIMAL(18,2) NOT NULL CHECK (GiaBan > 0),
    GiaNhapGoc DECIMAL(18,2) NOT NULL CHECK (GiaNhapGoc >= 0),
    ThueVAT TINYINT DEFAULT 10 CHECK (ThueVAT IN (0, 8, 10)),
    HinhAnh VARCHAR(255),
    MucCanDat INT DEFAULT 10,
    TrangThai ENUM('DangBan', 'NgungBan', 'HetHang') DEFAULT 'DangBan',
    is_active TINYINT(1) DEFAULT 1,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_barcode (Barcode),
    INDEX idx_trangthai (TrangThai, is_active),
    FOREIGN KEY (DanhMucId) REFERENCES DanhMuc(DanhMucId) ON DELETE RESTRICT,
    FOREIGN KEY (NhaCungCapId) REFERENCES NhaCungCap(NhaCungCapId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. TỒN KHO THEO LÔ FEFO (UC-A02, NFP-Consistency)
CREATE TABLE IF NOT EXISTS LoHangTonKho (
    LoHangId INT AUTO_INCREMENT PRIMARY KEY,
    SanPhamId INT NOT NULL,
    MaLo VARCHAR(20) NOT NULL COMMENT 'Mã lô nhập từ NCC',
    SoLuongNhap INT NOT NULL CHECK (SoLuongNhap >= 0),
    SoLuongHienTai INT NOT NULL CHECK (SoLuongHienTai >= 0),
    SoLuongDuTru INT DEFAULT 0 COMMENT 'Đang giữ chờ thanh toán (5p timeout)',
    NgayNhap DATE NOT NULL,
    NgayHetHan DATE NOT NULL,
    TrangThai ENUM('Available', 'Reserved', 'SoldOut', 'Expired') DEFAULT 'Available',
    INDEX idx_fefo (SanPhamId, NgayHetHan ASC, TrangThai),
    FOREIGN KEY (SanPhamId) REFERENCES SanPham(SanPhamId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. MÃ GIẢM GIÁ / KHUYẾN MÃI (UC-C04, UC-S02)
CREATE TABLE IF NOT EXISTS MaGiamGia (
    MaGiamGiaId INT AUTO_INCREMENT PRIMARY KEY,
    MaCode VARCHAR(20) NOT NULL UNIQUE COMMENT 'Mã áp dụng: SUMMER24, VIP50...',
    TenMaGiamGia VARCHAR(100),
    LoaiGiamGia ENUM('PhanTram', 'GiaTri') DEFAULT 'PhanTram',
    GiaTri DECIMAL(18,2) NOT NULL CHECK (GiaTri > 0),
    PhanTramToiDa DECIMAL(5,2),
    GiaTriDonHangToiThieu DECIMAL(18,2) DEFAULT 0,
    NgayBatDau DATETIME NOT NULL,
    NgayKetThuc DATETIME NOT NULL CHECK (NgayKetThuc >= NgayBatDau),
    GioiHanSuDung INT CHECK (GioiHanSuDung > 0),
    SoLanDaSuDung INT DEFAULT 0,
    TrangThai ENUM('HieuLuc', 'HetHieuLuc', 'BiKhoa') DEFAULT 'HieuLuc',
    is_active TINYINT(1) DEFAULT 1,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. PHIẾU NHẬP HÀNG (UC-A02)
CREATE TABLE IF NOT EXISTS PhieuNhapHang (
    PhieuNhapId INT AUTO_INCREMENT PRIMARY KEY,
    MaPhieuNhap VARCHAR(12) NOT NULL UNIQUE COMMENT 'App generate: PN202405001',
    NhaCungCapId INT NOT NULL,
    NhanVienId INT NOT NULL COMMENT 'Nhân viên duyệt nhập',
    NgayLap DATETIME DEFAULT CURRENT_TIMESTAMP,
    NgayNhapVe DATETIME,
    TrangThai ENUM('DangCho', 'DaNhan', 'DaHuy') DEFAULT 'DangCho',
    TongTienNhap DECIMAL(18,2) DEFAULT 0.00,
    TongVATDauVao DECIMAL(18,2) DEFAULT 0.00,
    GhiChu VARCHAR(500),
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (NhaCungCapId) REFERENCES NhaCungCap(NhaCungCapId),
    FOREIGN KEY (NhanVienId) REFERENCES NhanVien(NhanVienId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. CHI TIẾT PHIẾU NHẬP (UC-A02)
CREATE TABLE IF NOT EXISTS ChiTietPhieuNhap (
    ChiTietId INT AUTO_INCREMENT PRIMARY KEY,
    PhieuNhapId INT NOT NULL,
    SanPhamId INT NOT NULL,
    MaLo VARCHAR(20) NOT NULL COMMENT 'Trùng với LoHangTonKho.MaLo',
    SoLuong INT NOT NULL CHECK (SoLuong > 0),
    GiaNhapDonVi DECIMAL(18,2) NOT NULL CHECK (GiaNhapDonVi > 0),
    ThueVATDauVao TINYINT DEFAULT 0,
    INDEX idx_phieu (PhieuNhapId),
    FOREIGN KEY (PhieuNhapId) REFERENCES PhieuNhapHang(PhieuNhapId) ON DELETE CASCADE,
    FOREIGN KEY (SanPhamId) REFERENCES SanPham(SanPhamId) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. HÓA ĐƠN BÁN HÀNG / ORDER (UC-C04, UC-S02)
CREATE TABLE IF NOT EXISTS HoaDonBanHang (
    HoaDonId INT AUTO_INCREMENT PRIMARY KEY,
    MaHoaDon VARCHAR(15) NOT NULL UNIQUE COMMENT 'App generate: HD202405001',
    KhachHangId INT,
    NhanVienId INT NOT NULL COMMENT 'Nhân viên bán / POS',
    MaGiamGiaId INT,
    MaLoaiHinh ENUM('Online', 'POS') DEFAULT 'POS',
    NgayLap DATETIME DEFAULT CURRENT_TIMESTAMP,
    TongTienTruocKM DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    TongTienSauKM DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    DiemSuDung INT DEFAULT 0,
    PhuongThucTT ENUM('TienMat', 'ChuyenKhoan', 'QR') NOT NULL,
    TrangThai ENUM('Pending', 'Paid', 'Completed', 'Cancelled') DEFAULT 'Pending',
    LoaiGiao ENUM('Ship', 'TuLay') DEFAULT 'TuLay',
    DiaChiNhan VARCHAR(255) COMMENT 'Bắt buộc nếu LoaiGiao=Ship',
    PhiShip DECIMAL(18,2) DEFAULT 0.00,
    GhiChu VARCHAR(500),
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_trangthai_ngaylap (TrangThai, NgayLap DESC),
    FOREIGN KEY (KhachHangId) REFERENCES KhachHang(KhachHangId) ON DELETE SET NULL,
    FOREIGN KEY (NhanVienId) REFERENCES NhanVien(NhanVienId),
    FOREIGN KEY (MaGiamGiaId) REFERENCES MaGiamGia(MaGiamGiaId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. CHI TIẾT HÓA ĐƠN (UC-C04, UC-S02)
CREATE TABLE IF NOT EXISTS ChiTietHoaDon (
    ChiTietHoaDonId INT AUTO_INCREMENT PRIMARY KEY,
    HoaDonId INT NOT NULL,
    SanPhamId INT NOT NULL,
    SoLuong INT NOT NULL CHECK (SoLuong > 0),
    DonGiaGoc DECIMAL(18,2) NOT NULL,
    PhanTramGiam DECIMAL(5,2) DEFAULT 0,
    ThueVATApDung TINYINT DEFAULT 10,
    ThanhTienCuoi DECIMAL(18,2) NOT NULL,
    INDEX idx_hoadon (HoaDonId),
    FOREIGN KEY (HoaDonId) REFERENCES HoaDonBanHang(HoaDonId) ON DELETE CASCADE,
    FOREIGN KEY (SanPhamId) REFERENCES SanPham(SanPhamId) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. GIAO DỊCH ĐIỂM TÍCH LŨY WINMART PLUS (UC-C05, UC-A03)
CREATE TABLE IF NOT EXISTS DiemTichLuy (
    GiaoDichId INT AUTO_INCREMENT PRIMARY KEY,
    MaGiaoDich VARCHAR(15) NOT NULL UNIQUE COMMENT 'App generate: GD202405001',
    KhachHangId INT NOT NULL,
    HoaDonId INT,
    LoaiGiaoDich ENUM('TichDiem', 'SuDungDiem', 'DieuChinh') NOT NULL,
    SoDiemThayDoi INT NOT NULL COMMENT 'Dương: Cộng, Âm: Trừ',
    SoDiemSauGiaoDich INT NOT NULL COMMENT 'Snapshot balance tại thời điểm GD',
    GhiChu VARCHAR(500) COMMENT 'Bắt buộc nếu LoaiGiaoDich=DieuChinh',
    NgayGiaoDich DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_khachhang_ngay (KhachHangId, NgayGiaoDich DESC),
    FOREIGN KEY (KhachHangId) REFERENCES KhachHang(KhachHangId),
    FOREIGN KEY (HoaDonId) REFERENCES HoaDonBanHang(HoaDonId) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. CỬA HÀNG (STORES)
CREATE TABLE IF NOT EXISTS CuaHang (
    CuaHangId INT AUTO_INCREMENT PRIMARY KEY,
    TenCuaHang VARCHAR(255) NOT NULL,
    DiaChi VARCHAR(255) DEFAULT NULL,
    SoDienThoai VARCHAR(20) DEFAULT '',
    Email VARCHAR(100) DEFAULT '',
    Lat DECIMAL(10,8) DEFAULT NULL,
    Lng DECIMAL(11,8) DEFAULT NULL,
    is_active TINYINT(1) DEFAULT 1,
    BaoTriHeThong TINYINT(1) DEFAULT 0,
    AmBaoDonHang TINYINT(1) DEFAULT 1,
    GuiEmailTuDong TINYINT(1) DEFAULT 1,
    NgayCapNhat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 🔒 TRIGGER NGĂN XÓA CỨNG (NFP-Consistency)
DELIMITER //
CREATE TRIGGER TR_PreventHardDelete_SanPham
BEFORE DELETE ON SanPham
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Khong duoc phep xoa cung. Vui long cap nhat is_active = 0 hoac TrangThai = "NgungBan" trong ung dung.';
END//
CREATE TRIGGER TR_PreventHardDelete_DanhMuc
BEFORE DELETE ON DanhMuc
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Khong duoc phep xoa cung danh muc. Vui long dat is_active = 0.';
END//
CREATE TRIGGER TR_PreventHardDelete_NhanVien
BEFORE DELETE ON NhanVien
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Khong duoc phep xoa cung nhan vien. Vui long dat TrangThai = "NghiViec" hoac is_active = 0.';
END//
CREATE TRIGGER TR_PreventHardDelete_KhachHang
BEFORE DELETE ON KhachHang
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Khong duoc phep xoa cung khach hang. Vui long dat is_active = 0.';
END//
DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

-- ✅ HOÀN TẤT SCHEMA. SẴN SÀNG CHO EXPRESSJS + MYSQL2/POOL
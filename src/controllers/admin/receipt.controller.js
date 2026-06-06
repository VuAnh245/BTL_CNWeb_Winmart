'use strict';
const db = require('../../config/db');
const { generateReceiptCode } = require('../../utils/generateCode');

// Lấy danh sách phiếu nhập và tồn kho
async function index(req, res, next) {
    try {
        const [receipts] = await db.pool.query(`
            SELECT p.*, 
                   ncc.TenNhaCungCap, 
                   nv.HoTen as TenNhanVien,
                   (SELECT SUM(SoLuong) FROM ChiTietPhieuNhap WHERE PhieuNhapId = p.PhieuNhapId) as TongSoLuong
            FROM PhieuNhapHang p
            LEFT JOIN NhaCungCap ncc ON p.NhaCungCapId = ncc.NhaCungCapId
            LEFT JOIN NhanVien nv ON p.NhanVienId = nv.NhanVienId
            ORDER BY p.NgayTao DESC
        `);

        // Fetch current inventory overview
        const [inventoryList] = await db.pool.query(`
            SELECT p.SanPhamId, p.MaSanPham, p.TenSanPham, dm.TenDanhMuc, p.GiaBan, p.MucCanDat,
                   COALESCE(SUM(l.SoLuongHienTai), 0) as TongTonKho
            FROM SanPham p
            LEFT JOIN DanhMuc dm ON p.DanhMucId = dm.DanhMucId
            LEFT JOIN LoHangTonKho l ON p.SanPhamId = l.SanPhamId AND l.TrangThai = 'Available'
            GROUP BY p.SanPhamId, p.MaSanPham, p.TenSanPham, dm.TenDanhMuc, p.GiaBan, p.MucCanDat
            ORDER BY TongTonKho DESC
        `);

        const [suppliers] = await db.pool.query('SELECT NhaCungCapId, TenNhaCungCap FROM NhaCungCap WHERE is_active = 1');
        const [products] = await db.pool.query(`
            SELECT sp.SanPhamId, sp.MaSanPham, sp.TenSanPham, sp.GiaNhapGoc, sp.DonViTinh, sp.ThueVAT,
                   COALESCE(SUM(l.SoLuongHienTai), 0) as TongTonKho
            FROM SanPham sp
            LEFT JOIN LoHangTonKho l ON sp.SanPhamId = l.SanPhamId AND l.TrangThai = 'Available'
            WHERE sp.is_active = 1
            GROUP BY sp.SanPhamId, sp.MaSanPham, sp.TenSanPham, sp.GiaNhapGoc, sp.DonViTinh, sp.ThueVAT
        `);

        res.render('admin/imports/list', {
            title: 'Quản lý Kho Hàng',
            currentRoute: '/admin/inventory',
            user: req.session.user,
            receipts: receipts,
            inventoryList: inventoryList,
            suppliers: suppliers,
            products: products
        });
    } catch (error) {
        next(error);
    }
}

// Giao diện tạo phiếu nhập mới
async function getCreate(req, res, next) {
    try {
        const [receipts] = await db.pool.query(`
            SELECT p.*, 
                   ncc.TenNhaCungCap, 
                   nv.HoTen as TenNhanVien,
                   (SELECT SUM(SoLuong) FROM ChiTietPhieuNhap WHERE PhieuNhapId = p.PhieuNhapId) as TongSoLuong
            FROM PhieuNhapHang p
            LEFT JOIN NhaCungCap ncc ON p.NhaCungCapId = ncc.NhaCungCapId
            LEFT JOIN NhanVien nv ON p.NhanVienId = nv.NhanVienId
            ORDER BY p.NgayTao DESC
        `);

        // Fetch current inventory overview
        const [inventoryList] = await db.pool.query(`
            SELECT p.SanPhamId, p.MaSanPham, p.TenSanPham, dm.TenDanhMuc, p.GiaBan,
                   COALESCE(SUM(l.SoLuongHienTai), 0) as TongTonKho
            FROM SanPham p
            LEFT JOIN DanhMuc dm ON p.DanhMucId = dm.DanhMucId
            LEFT JOIN LoHangTonKho l ON p.SanPhamId = l.SanPhamId AND l.TrangThai = 'Available'
            GROUP BY p.SanPhamId, p.MaSanPham, p.TenSanPham, dm.TenDanhMuc, p.GiaBan
            ORDER BY TongTonKho DESC
        `);

        const [suppliers] = await db.pool.query('SELECT NhaCungCapId, TenNhaCungCap FROM NhaCungCap WHERE is_active = 1');
        
        const [products] = await db.pool.query(`
            SELECT sp.SanPhamId, sp.MaSanPham, sp.TenSanPham, sp.GiaNhapGoc, sp.DonViTinh, sp.ThueVAT,
                   COALESCE(SUM(l.SoLuongHienTai), 0) as TongTonKho
            FROM SanPham sp
            LEFT JOIN LoHangTonKho l ON sp.SanPhamId = l.SanPhamId AND l.TrangThai = 'Available'
            WHERE sp.is_active = 1
            GROUP BY sp.SanPhamId, sp.MaSanPham, sp.TenSanPham, sp.GiaNhapGoc, sp.DonViTinh, sp.ThueVAT
        `);

        res.render('admin/imports/list', {
            title: 'Tạo Phiếu Nhập Kho',
            currentRoute: '/admin/inventory',
            user: req.session.user,
            receipts: receipts,
            inventoryList: inventoryList,
            suppliers: suppliers,
            products: products,
            openSlideOver: true
        });
    } catch (error) {
        next(error);
    }
}

// Xử lý tạo phiếu nhập và lô hàng
async function postCreate(req, res, next) {
    const connection = await db.pool.getConnection();
    try {
        const { nhaCungCapId, ghiChu, ngayNhapVe, items } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 sản phẩm' });
        }

        await connection.beginTransaction();

        const maPhieuNhap = generateReceiptCode();
        let tongTienNhap = 0;
        let tongVATDauVao = 0;

        // Tính tổng tiền và VAT
        items.forEach(item => {
            const thanhTien = Number(item.soLuong) * Number(item.giaNhapDonVi);
            tongTienNhap += thanhTien;
            
            const vat = Number(item.thueVAT) || 0;
            tongVATDauVao += thanhTien * (vat / 100);
        });

        // 1. Tạo Phiếu Nhập
        const [insertReceipt] = await connection.query(`
            INSERT INTO PhieuNhapHang 
            (MaPhieuNhap, NhaCungCapId, NhanVienId, NgayLap, NgayNhapVe, TrangThai, TongTienNhap, TongVATDauVao, GhiChu)
            VALUES (?, ?, ?, NOW(), ?, 'DangCho', ?, ?, ?)
        `, [maPhieuNhap, nhaCungCapId || null, req.session.user.id, ngayNhapVe || new Date(), tongTienNhap, tongVATDauVao, ghiChu]);

        const phieuNhapId = insertReceipt.insertId;

        // 2. Thêm Chi tiết Phiếu Nhập (Lô hàng sẽ được tạo khi Quản lý duyệt)
        for (const item of items) {
            // Sinh mã lô dự kiến dựa vào mã phiếu nhập và mã sản phẩm
            const maLo = `${maPhieuNhap}-${item.sanPhamId}`;

            // Chi tiết
            await connection.query(`
                INSERT INTO ChiTietPhieuNhap
                (PhieuNhapId, SanPhamId, MaLo, SoLuong, GiaNhapDonVi, NgayHetHan, ThueVATDauVao)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [phieuNhapId, item.sanPhamId, maLo, item.soLuong, item.giaNhapDonVi, item.ngayHetHan || null, Number(item.thueVAT) || 0]);
        }

        await connection.commit();
        res.json({ success: true, message: 'Tạo phiếu nhập thành công!', redirectUrl: '/admin/inventory' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
}

// Giao diện chi tiết phiếu nhập
async function getDetail(req, res, next) {
    try {
        const id = req.params.id;
        const [receiptRows] = await db.pool.query(`
            SELECT p.*, ncc.TenNhaCungCap, nv.HoTen as TenNhanVien
            FROM PhieuNhapHang p
            LEFT JOIN NhaCungCap ncc ON p.NhaCungCapId = ncc.NhaCungCapId
            LEFT JOIN NhanVien nv ON p.NhanVienId = nv.NhanVienId
            WHERE p.PhieuNhapId = ?
        `, [id]);

        if (receiptRows.length === 0) {
            return res.redirect('/admin/inventory');
        }

        const [details] = await db.pool.query(`
            SELECT c.*, sp.TenSanPham, sp.MaSanPham, lh.NgayHetHan
            FROM ChiTietPhieuNhap c
            JOIN SanPham sp ON c.SanPhamId = sp.SanPhamId
            LEFT JOIN LoHangTonKho lh ON lh.MaLo = c.MaLo
            WHERE c.PhieuNhapId = ?
        `, [id]);

        res.render('admin/imports/detail', {
            title: `Chi tiết Phiếu Nhập ${receiptRows[0].MaPhieuNhap}`,
            currentRoute: '/admin/inventory',
            user: req.session.user,
            receipt: receiptRows[0],
            details: details
        });
    } catch (error) {
        next(error);
    }
}

// Duyệt phiếu nhập (Chuyển trạng thái DaNhan và tạo LoHangTonKho)
async function approveReceipt(req, res, next) {
    const connection = await db.pool.getConnection();
    try {
        const phieuNhapId = req.params.id;
        
        await connection.beginTransaction();

        // Kiểm tra trạng thái hiện tại
        const [receiptRows] = await connection.query('SELECT TrangThai, NgayNhapVe FROM PhieuNhapHang WHERE PhieuNhapId = ?', [phieuNhapId]);
        if (receiptRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
        }
        
        if (receiptRows[0].TrangThai !== 'DangCho') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể duyệt phiếu đang ở trạng thái Chờ' });
        }

        const ngayNhapVe = receiptRows[0].NgayNhapVe || new Date();

        // Lấy danh sách chi tiết
        const [details] = await connection.query('SELECT SanPhamId, MaLo, SoLuong, NgayHetHan FROM ChiTietPhieuNhap WHERE PhieuNhapId = ?', [phieuNhapId]);
        
        for (const item of details) {
            // Lô hàng
            await connection.query(`
                INSERT INTO LoHangTonKho
                (SanPhamId, MaLo, SoLuongNhap, SoLuongHienTai, SoLuongDuTru, NgayNhap, NgayHetHan, TrangThai)
                VALUES (?, ?, ?, ?, 0, ?, ?, 'Available')
            `, [
                item.SanPhamId, 
                item.MaLo, 
                item.SoLuong, 
                item.SoLuong, 
                ngayNhapVe, 
                item.NgayHetHan || null
            ]);
        }

        // Cập nhật trạng thái phiếu nhập
        await connection.query('UPDATE PhieuNhapHang SET TrangThai = "DaNhan" WHERE PhieuNhapId = ?', [phieuNhapId]);

        await connection.commit();
        res.json({ success: true, message: 'Duyệt phiếu nhập thành công! Tồn kho đã được cập nhật.' });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
}

// Hủy phiếu nhập
async function cancelReceipt(req, res, next) {
    try {
        const phieuNhapId = req.params.id;
        
        // Kiểm tra trạng thái hiện tại
        const [receiptRows] = await db.pool.query('SELECT TrangThai FROM PhieuNhapHang WHERE PhieuNhapId = ?', [phieuNhapId]);
        if (receiptRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
        }
        
        if (receiptRows[0].TrangThai !== 'DangCho') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy phiếu đang ở trạng thái Chờ' });
        }

        await db.pool.query('UPDATE PhieuNhapHang SET TrangThai = "DaHuy" WHERE PhieuNhapId = ?', [phieuNhapId]);
        res.json({ success: true, message: 'Đã hủy phiếu nhập.' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    index,
    getCreate,
    postCreate,
    getDetail,
    approveReceipt,
    cancelReceipt
};

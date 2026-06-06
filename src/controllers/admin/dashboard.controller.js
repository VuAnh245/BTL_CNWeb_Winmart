'use strict';
const db = require('../../config/db');

// Controller for Admin Dashboard
const getDashboard = async (req, res) => {
  try {
    // 1. Doanh thu & Tổng số đơn hàng (Tháng này)
    const [revenueRow] = await db.pool.query(`
      SELECT 
        SUM(TongTienSauKM) as totalRevenue,
        COUNT(HoaDonId) as totalOrders
      FROM HoaDonBanHang 
      WHERE MONTH(NgayLap) = MONTH(CURRENT_DATE()) 
        AND YEAR(NgayLap) = YEAR(CURRENT_DATE())
        AND TrangThai = 'Completed'
    `);
    
    const doanhThu = revenueRow[0].totalRevenue || 0;
    const donHang = revenueRow[0].totalOrders || 0;
    const aov = donHang > 0 ? (doanhThu / donHang) : 0;

    // 2. Tính Giá vốn hàng bán (COGS) để suy ra Lợi nhuận gộp
    const [cogsRow] = await db.pool.query(`
      SELECT SUM(sp.GiaNhapGoc * ct.SoLuong) as totalCogs
      FROM ChiTietHoaDon ct
      JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
      JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
      WHERE MONTH(hd.NgayLap) = MONTH(CURRENT_DATE()) 
        AND YEAR(hd.NgayLap) = YEAR(CURRENT_DATE())
        AND hd.TrangThai = 'Completed'
    `);
    const cogs = cogsRow[0].totalCogs || 0;
    const loiNhuanGop = doanhThu - cogs;

    // 3. Số sản phẩm đang hoạt động (Tồn kho)
    const [productsRow] = await db.pool.query(`
      SELECT COUNT(*) as totalProducts 
      FROM SanPham 
      WHERE is_active = 1
    `);
    const sanPham = productsRow[0].totalProducts || 0;

    // 4. Kênh bán hàng (Online vs POS)
    const [channelRows] = await db.pool.query(`
      SELECT MaLoaiHinh, COUNT(HoaDonId) as Count
      FROM HoaDonBanHang
      WHERE MONTH(NgayLap) = MONTH(CURRENT_DATE()) 
        AND YEAR(NgayLap) = YEAR(CURRENT_DATE())
        AND TrangThai = 'Completed'
      GROUP BY MaLoaiHinh
    `);
    let onlineCount = 0;
    let posCount = 0;
    channelRows.forEach(row => {
      if (row.MaLoaiHinh === 'POS') posCount = row.Count;
      else onlineCount += row.Count;
    });

    // 5. Đơn hàng gần đây (5 đơn)
    const [recentOrders] = await db.pool.query(`
      SELECT hd.MaHoaDon, hd.TongTienSauKM, hd.TrangThai, hd.NgayLap,
             kh.HoTen as TenKhachHang, nv.HoTen as TenNhanVien
      FROM HoaDonBanHang hd
      LEFT JOIN KhachHang kh ON hd.KhachHangId = kh.KhachHangId
      LEFT JOIN NhanVien nv ON hd.NhanVienId = nv.NhanVienId
      ORDER BY hd.NgayLap DESC
      LIMIT 5
    `);

    // 6. Top 5 sản phẩm bán chạy nhất tháng
    const [topProducts] = await db.pool.query(`
      SELECT sp.TenSanPham, sp.HinhAnh, SUM(ct.SoLuong) as TotalSold
      FROM ChiTietHoaDon ct
      JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
      JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
      WHERE MONTH(hd.NgayLap) = MONTH(CURRENT_DATE()) 
        AND YEAR(hd.NgayLap) = YEAR(CURRENT_DATE())
        AND hd.TrangThai = 'Completed'
      GROUP BY sp.SanPhamId
      ORDER BY TotalSold DESC
      LIMIT 5
    `);

    // 7. Sản phẩm sắp hết hàng (Low Stock)
    const [lowStockProducts] = await db.pool.query(`
      SELECT sp.SanPhamId, sp.TenSanPham, sp.Barcode, sp.HinhAnh, SUM(lh.SoLuongHienTai) as SoLuongTon
      FROM SanPham sp
      LEFT JOIN LoHangTonKho lh ON sp.SanPhamId = lh.SanPhamId
      WHERE sp.is_active = 1
      GROUP BY sp.SanPhamId
      HAVING SoLuongTon < 20 OR SoLuongTon IS NULL
      ORDER BY SoLuongTon ASC
      LIMIT 5
    `);

    // 7b. Phiếu nhập đang chờ duyệt
    const [pendingReceipts] = await db.pool.query(`
      SELECT p.PhieuNhapId, p.MaPhieuNhap, p.NgayLap, p.TongTienNhap, p.TongVATDauVao, ncc.TenNhaCungCap
      FROM PhieuNhapHang p
      LEFT JOIN NhaCungCap ncc ON p.NhaCungCapId = ncc.NhaCungCapId
      WHERE p.TrangThai = 'DangCho'
      ORDER BY p.NgayLap ASC
      LIMIT 5
    `);
    // 7c. Lô hàng sắp hết hạn
    const [expiringProducts] = await db.pool.query(`
      SELECT sp.SanPhamId, sp.TenSanPham, sp.HinhAnh, lh.MaLo, lh.NgayHetHan, lh.SoLuongHienTai
      FROM LoHangTonKho lh
      JOIN SanPham sp ON lh.SanPhamId = sp.SanPhamId
      WHERE lh.TrangThai = 'Available' AND lh.SoLuongHienTai > 0 AND lh.NgayHetHan IS NOT NULL
      ORDER BY lh.NgayHetHan ASC
      LIMIT 5
    `);
    // 8. Biểu đồ doanh thu (Tuần hoặc Tháng)
    const period = req.query.period || 'week';
    const daysToFetch = period === 'month' ? 29 : 6;
    
    const [chartDataRow] = await db.pool.query(`
      SELECT DATE(NgayLap) as date, SUM(TongTienSauKM) as dailyRevenue
      FROM HoaDonBanHang
      WHERE TrangThai = 'Completed' 
        AND NgayLap >= DATE_SUB(CURRENT_DATE(), INTERVAL ${daysToFetch} DAY)
      GROUP BY DATE(NgayLap)
      ORDER BY DATE(NgayLap) ASC
    `);
    
    const chartLabels = [];
    const chartValues = [];
    for (let i = daysToFetch; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('en-CA'); // YYYY-MM-DD
      
      // Định dạng nhãn (label)
      if (period === 'month') {
          // Hiển thị ngày (ví dụ: 15, 16...) để tránh nhãn quá dài
          chartLabels.push(d.getDate().toString());
      } else {
          chartLabels.push(d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));
      }
      
      const found = chartDataRow.find(r => r.date && new Date(r.date).toLocaleDateString('en-CA') === dateString);
      chartValues.push(found ? Number(found.dailyRevenue) : 0);
    }

    // Format dữ liệu
    const stats = {
      doanhThu: doanhThu,
      loiNhuanGop: loiNhuanGop,
      aov: aov,
      sanPham: sanPham
    };

    const chartData = {
      labels: chartLabels,
      values: chartValues,
      onlineCount: onlineCount,
      posCount: posCount
    };

    res.render('admin/dashboard', {
      title: 'Dashboard - WinMart Admin',
      user: req.session.user,
      currentPath: req.path,
      period: period,
      stats: stats,
      chartData: chartData,
      recentOrders: recentOrders,
      topProducts: topProducts,
      lowStockProducts: lowStockProducts,
      pendingReceipts: pendingReceipts,
      expiringProducts: expiringProducts
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Lỗi tải trang Dashboard");
  }
};

module.exports = {
  getDashboard
};

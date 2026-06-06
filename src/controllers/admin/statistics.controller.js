'use strict';
const db = require('../../config/db');

/**
 * Trang thống kê chính - Báo cáo & Thống kê
 * Hỗ trợ lọc theo tháng/năm qua query params: ?month=5&year=2026
 */
async function index(req, res, next) {
    try {
        const connection = await db.pool.getConnection();

        // Lấy tháng/năm từ query params, mặc định là tháng/năm hiện tại
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        // Tính ngày đầu tháng và cuối tháng theo bộ lọc
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const firstDayStr = firstDay.toISOString().split('T')[0] + ' 00:00:00';
        const lastDayStr = lastDay.toISOString().split('T')[0] + ' 23:59:59';

        // 1. Tổng doanh thu tháng đã chọn
        const [revenueRows] = await connection.query(`
            SELECT SUM(TongTienSauKM) as TotalRevenue 
            FROM HoaDonBanHang 
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
        `, [firstDayStr, lastDayStr]);
        const totalRevenue = revenueRows[0].TotalRevenue || 0;

        // 2. Tổng số đơn hàng hoàn thành
        const [orderRows] = await connection.query(`
            SELECT COUNT(HoaDonId) as TotalOrders 
            FROM HoaDonBanHang 
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
        `, [firstDayStr, lastDayStr]);
        const totalOrders = orderRows[0].TotalOrders || 0;

        // 3. Tổng số khách hàng mua hàng trong tháng (Bao gồm khách định danh + khách vãng lai)
        const [customerRows] = await connection.query(`
            SELECT 
                COUNT(DISTINCT KhachHangId) as RegisteredCustomers,
                SUM(CASE WHEN KhachHangId IS NULL THEN 1 ELSE 0 END) as WalkInCustomers
            FROM HoaDonBanHang 
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
        `, [firstDayStr, lastDayStr]);
        const totalCustomers = (Number(customerRows[0].RegisteredCustomers) || 0) + (Number(customerRows[0].WalkInCustomers) || 0);

        // 4. Biểu đồ doanh thu theo ngày trong tháng
        const [chartDataRows] = await connection.query(`
            SELECT DATE(NgayLap) as Date, SUM(TongTienSauKM) as DailyRevenue
            FROM HoaDonBanHang
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
            GROUP BY DATE(NgayLap)
            ORDER BY DATE(NgayLap) ASC
        `, [firstDayStr, lastDayStr]);

        const labels = [];
        const data = [];
        // Tạo mảng đủ các ngày trong tháng (1 đến lastDay.getDate())
        const daysInMonth = lastDay.getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month - 1, i);
            const dateStr = d.toISOString().split('T')[0];
            labels.push(i.toString() + '/' + month.toString());

            // Tìm doanh thu của ngày này
            const found = chartDataRows.find(r => {
                const dbDate = new Date(r.Date);
                dbDate.setMinutes(dbDate.getMinutes() - dbDate.getTimezoneOffset());
                return dbDate.toISOString().split('T')[0] === dateStr;
            });
            data.push(found ? Number(found.DailyRevenue) : 0);
        }

        // 5. Tỉ lệ Online vs POS (Tháng đã chọn)
        const [typeRows] = await connection.query(`
            SELECT MaLoaiHinh, COUNT(HoaDonId) as Count
            FROM HoaDonBanHang
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
            GROUP BY MaLoaiHinh
        `, [firstDayStr, lastDayStr]);

        let onlineCount = 0;
        let posCount = 0;
        typeRows.forEach(row => {
            if (row.MaLoaiHinh === 'POS') posCount = row.Count;
            else onlineCount += row.Count;
        });

        // 6. Top 5 sản phẩm bán chạy nhất tháng
        const [topProducts] = await connection.query(`
            SELECT sp.TenSanPham, SUM(ct.SoLuong) as TotalSold, SUM(ct.ThanhTienCuoi) as TotalMoney
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY sp.SanPhamId, sp.TenSanPham
            ORDER BY TotalSold DESC
            LIMIT 5
        `, [firstDayStr, lastDayStr]);

        // 7. Lợi nhuận gộp = Doanh thu thực tế (TotalRevenue) - Giá vốn (GiaNhapGoc * SoLuong)
        const [profitRows] = await connection.query(`
            SELECT 
                SUM(sp.GiaNhapGoc * ct.SoLuong) as TotalCost
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
        `, [firstDayStr, lastDayStr]);
        const totalCost = profitRows[0].TotalCost || 0;
        const grossProfit = totalRevenue - totalCost;

        // 8. Thống kê phương thức thanh toán (TienMat, ChuyenKhoan, QR)
        const [paymentRows] = await connection.query(`
            SELECT PhuongThucTT, COUNT(HoaDonId) as Count, SUM(TongTienSauKM) as Total
            FROM HoaDonBanHang
            WHERE TrangThai = 'Completed'
            AND NgayLap >= ? AND NgayLap <= ?
            GROUP BY PhuongThucTT
        `, [firstDayStr, lastDayStr]);

        const paymentMethods = paymentRows;

        // 9. Doanh thu theo danh mục sản phẩm
        const [categoryRows] = await connection.query(`
            SELECT dm.TenDanhMuc, SUM(ct.ThanhTienCuoi) as Revenue, SUM(ct.SoLuong) as TotalSold
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            JOIN DanhMuc dm ON sp.DanhMucId = dm.DanhMucId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY dm.DanhMucId, dm.TenDanhMuc
            ORDER BY Revenue DESC
        `, [firstDayStr, lastDayStr]);
        const categoryRevenue = categoryRows;

        // 10. Hiệu suất nhân viên - Số đơn và doanh thu theo nhân viên
        const [employeeRows] = await connection.query(`
            SELECT nv.HoTen, nv.MaNhanVien, 
                   COUNT(hd.HoaDonId) as TotalOrders, 
                   SUM(hd.TongTienSauKM) as TotalRevenue
            FROM HoaDonBanHang hd
            JOIN NhanVien nv ON hd.NhanVienId = nv.NhanVienId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY nv.NhanVienId, nv.HoTen, nv.MaNhanVien
            ORDER BY TotalRevenue DESC
        `, [firstDayStr, lastDayStr]);
        const employeePerformance = employeeRows;

        // 11. Thống kê mã giảm giá - Top mã được sử dụng nhiều nhất
        const [promoRows] = await connection.query(`
            SELECT mg.MaCode, mg.TenMaGiamGia, mg.LoaiGiamGia, mg.GiaTri,
                   COUNT(hd.HoaDonId) as UsageCount,
                   SUM(hd.TongTienTruocKM - hd.TongTienSauKM) as TotalDiscount
            FROM HoaDonBanHang hd
            JOIN MaGiamGia mg ON hd.MaGiamGiaId = mg.MaGiamGiaId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY mg.MaGiamGiaId, mg.MaCode, mg.TenMaGiamGia, mg.LoaiGiamGia, mg.GiaTri
            ORDER BY UsageCount DESC
            LIMIT 10
        `, [firstDayStr, lastDayStr]);
        const promotionStats = promoRows;



        connection.release();

        // Render trang thống kê với toàn bộ dữ liệu
        res.render('admin/statistics/index', {
            title: 'Báo cáo & Thống kê',
            currentRoute: '/admin/statistics',
            user: req.session.user,
            // Bộ lọc tháng/năm
            selectedMonth: month,
            selectedYear: year,
            // Thống kê tổng quan
            stats: {
                totalRevenue,
                totalOrders,
                totalCustomers,
                grossProfit
            },
            // Biểu đồ doanh thu theo ngày
            chart: {
                labels: JSON.stringify(labels),
                data: JSON.stringify(data),
                onlineCount,
                posCount
            },
            // Dữ liệu chi tiết
            topProducts,
            paymentMethods,
            categoryRevenue,
            employeePerformance,
            promotionStats
        });
    } catch (error) {
        next(error);
    }
}

/**
 * Xuất báo cáo Excel (HTML table với content-type Excel)
 * Route: GET /admin/statistics/export/excel?month=5&year=2026
 */
async function exportExcel(req, res, next) {
    try {
        const connection = await db.pool.getConnection();

        // Lấy tháng/năm từ query params
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const firstDayStr = firstDay.toISOString().split('T')[0] + ' 00:00:00';
        const lastDayStr = lastDay.toISOString().split('T')[0] + ' 23:59:59';

        // Truy vấn tổng quan
        const [revenueRows] = await connection.query(`
            SELECT SUM(TongTienSauKM) as TotalRevenue, COUNT(HoaDonId) as TotalOrders
            FROM HoaDonBanHang 
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
        `, [firstDayStr, lastDayStr]);

        // Lợi nhuận gộp
        const [profitRows] = await connection.query(`
            SELECT SUM(sp.GiaNhapGoc * ct.SoLuong) as TotalCost
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
        `, [firstDayStr, lastDayStr]);

        // Doanh thu theo ngày
        const [dailyRows] = await connection.query(`
            SELECT DATE(NgayLap) as Ngay, 
                   COUNT(HoaDonId) as SoDon,
                   SUM(TongTienSauKM) as DoanhThu
            FROM HoaDonBanHang
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
            GROUP BY DATE(NgayLap)
            ORDER BY DATE(NgayLap) ASC
        `, [firstDayStr, lastDayStr]);

        // Top sản phẩm
        const [topProducts] = await connection.query(`
            SELECT sp.MaSanPham, sp.TenSanPham, SUM(ct.SoLuong) as TotalSold, 
                   SUM(ct.ThanhTienCuoi) as TotalMoney
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY sp.SanPhamId, sp.MaSanPham, sp.TenSanPham
            ORDER BY TotalSold DESC
            LIMIT 10
        `, [firstDayStr, lastDayStr]);

        // Hiệu suất nhân viên
        const [employeeRows] = await connection.query(`
            SELECT nv.MaNhanVien, nv.HoTen, 
                   COUNT(hd.HoaDonId) as TotalOrders, 
                   SUM(hd.TongTienSauKM) as TotalRevenue
            FROM HoaDonBanHang hd
            JOIN NhanVien nv ON hd.NhanVienId = nv.NhanVienId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY nv.NhanVienId, nv.MaNhanVien, nv.HoTen
            ORDER BY TotalRevenue DESC
        `, [firstDayStr, lastDayStr]);

        connection.release();

        // Tạo nội dung HTML table cho Excel
        const totalRevenue = revenueRows[0].TotalRevenue || 0;
        const totalOrders = revenueRows[0].TotalOrders || 0;
        const grossProfit = totalRevenue - (profitRows[0].TotalCost || 0);

        const formatVND = (val) => Number(val).toLocaleString('vi-VN');

        let html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:x="urn:schemas-microsoft-com:office:excel" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <style>
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th, td { border: 1px solid #333; padding: 8px; text-align: left; }
                th { background-color: #E31837; color: #fff; font-weight: bold; }
                h2 { color: #E31837; margin-top: 30px; }
                .summary-value { font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <h1>BÁO CÁO THỐNG KÊ WINMART - Tháng ${month}/${year}</h1>
            <p>Ngày xuất: ${new Date().toLocaleString('vi-VN')}</p>

            <h2>I. TỔNG QUAN</h2>
            <table>
                <tr><th>Chỉ số</th><th>Giá trị</th></tr>
                <tr><td>Tổng doanh thu</td><td class="summary-value">${formatVND(totalRevenue)} đ</td></tr>
                <tr><td>Tổng đơn hàng</td><td class="summary-value">${totalOrders}</td></tr>
                <tr><td>Lợi nhuận gộp</td><td class="summary-value">${formatVND(grossProfit)} đ</td></tr>
            </table>

            <h2>II. DOANH THU THEO NGÀY</h2>
            <table>
                <tr><th>Ngày</th><th>Số đơn</th><th>Doanh thu (đ)</th></tr>
                ${dailyRows.map(r => {
                    const d = new Date(r.Ngay);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    return `<tr>
                        <td>${d.toISOString().split('T')[0]}</td>
                        <td>${r.SoDon}</td>
                        <td>${formatVND(r.DoanhThu)}</td>
                    </tr>`;
                }).join('')}
            </table>

            <h2>III. TOP SẢN PHẨM BÁN CHẠY</h2>
            <table>
                <tr><th>Mã SP</th><th>Tên sản phẩm</th><th>SL bán</th><th>Doanh thu (đ)</th></tr>
                ${topProducts.map(p => `<tr>
                    <td>${p.MaSanPham}</td>
                    <td>${p.TenSanPham}</td>
                    <td>${p.TotalSold}</td>
                    <td>${formatVND(p.TotalMoney)}</td>
                </tr>`).join('')}
            </table>

            <h2>IV. HIỆU SUẤT NHÂN VIÊN</h2>
            <table>
                <tr><th>Mã NV</th><th>Họ tên</th><th>Số đơn</th><th>Doanh thu (đ)</th></tr>
                ${employeeRows.map(e => `<tr>
                    <td>${e.MaNhanVien}</td>
                    <td>${e.HoTen}</td>
                    <td>${e.TotalOrders}</td>
                    <td>${formatVND(e.TotalRevenue)}</td>
                </tr>`).join('')}
            </table>
        </body>
        </html>`;

        // Thiết lập header để trình duyệt tải về file Excel
        const filename = `BaoCao_WinMart_T${month}_${year}.xls`;
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(html);
    } catch (error) {
        next(error);
    }
}

/**
 * Xuất báo cáo PDF (HTML với CSS in ấn, tự động gọi window.print())
 * Route: GET /admin/statistics/export/pdf?month=5&year=2026
 */
async function exportPdf(req, res, next) {
    try {
        const connection = await db.pool.getConnection();

        // Lấy tháng/năm từ query params
        const now = new Date();
        const month = parseInt(req.query.month) || (now.getMonth() + 1);
        const year = parseInt(req.query.year) || now.getFullYear();

        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const firstDayStr = firstDay.toISOString().split('T')[0] + ' 00:00:00';
        const lastDayStr = lastDay.toISOString().split('T')[0] + ' 23:59:59';

        // Truy vấn tổng quan
        const [revenueRows] = await connection.query(`
            SELECT SUM(TongTienSauKM) as TotalRevenue, COUNT(HoaDonId) as TotalOrders
            FROM HoaDonBanHang 
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
        `, [firstDayStr, lastDayStr]);

        // Lợi nhuận gộp
        const [profitRows] = await connection.query(`
            SELECT SUM(ct.ThanhTienCuoi) as TotalRevenue,
                   SUM(sp.GiaNhapGoc * ct.SoLuong) as TotalCost
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
        `, [firstDayStr, lastDayStr]);

        // Doanh thu theo ngày
        const [dailyRows] = await connection.query(`
            SELECT DATE(NgayLap) as Ngay, 
                   COUNT(HoaDonId) as SoDon,
                   SUM(TongTienSauKM) as DoanhThu
            FROM HoaDonBanHang
            WHERE TrangThai = 'Completed' 
            AND NgayLap >= ? AND NgayLap <= ?
            GROUP BY DATE(NgayLap)
            ORDER BY DATE(NgayLap) ASC
        `, [firstDayStr, lastDayStr]);

        // Top sản phẩm
        const [topProducts] = await connection.query(`
            SELECT sp.MaSanPham, sp.TenSanPham, SUM(ct.SoLuong) as TotalSold, 
                   SUM(ct.ThanhTienCuoi) as TotalMoney
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY sp.SanPhamId, sp.MaSanPham, sp.TenSanPham
            ORDER BY TotalSold DESC
            LIMIT 10
        `, [firstDayStr, lastDayStr]);

        // Doanh thu theo danh mục
        const [categoryRows] = await connection.query(`
            SELECT dm.TenDanhMuc, SUM(ct.ThanhTienCuoi) as Revenue, SUM(ct.SoLuong) as TotalSold
            FROM ChiTietHoaDon ct
            JOIN HoaDonBanHang hd ON ct.HoaDonId = hd.HoaDonId
            JOIN SanPham sp ON ct.SanPhamId = sp.SanPhamId
            JOIN DanhMuc dm ON sp.DanhMucId = dm.DanhMucId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY dm.DanhMucId, dm.TenDanhMuc
            ORDER BY Revenue DESC
        `, [firstDayStr, lastDayStr]);

        // Hiệu suất nhân viên
        const [employeeRows] = await connection.query(`
            SELECT nv.MaNhanVien, nv.HoTen, 
                   COUNT(hd.HoaDonId) as TotalOrders, 
                   SUM(hd.TongTienSauKM) as TotalRevenue
            FROM HoaDonBanHang hd
            JOIN NhanVien nv ON hd.NhanVienId = nv.NhanVienId
            WHERE hd.TrangThai = 'Completed'
            AND hd.NgayLap >= ? AND hd.NgayLap <= ?
            GROUP BY nv.NhanVienId, nv.MaNhanVien, nv.HoTen
            ORDER BY TotalRevenue DESC
        `, [firstDayStr, lastDayStr]);

        connection.release();

        // Tạo dữ liệu hiển thị
        const totalRevenue = revenueRows[0].TotalRevenue || 0;
        const totalOrders = revenueRows[0].TotalOrders || 0;
        const grossProfit = totalRevenue - (profitRows[0].TotalCost || 0);

        const formatVND = (val) => Number(val).toLocaleString('vi-VN');

        // Render trang HTML tối ưu cho in ấn
        let html = `<!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="utf-8">
            <title>Báo cáo WinMart - Tháng ${month}/${year}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 30px; max-width: 1000px; margin: 0 auto; }
                h1 { color: #E31837; text-align: center; margin-bottom: 5px; font-size: 24px; }
                .subtitle { text-align: center; color: #666; margin-bottom: 30px; font-size: 14px; }
                h2 { color: #E31837; border-bottom: 2px solid #E31837; padding-bottom: 5px; margin: 25px 0 15px; font-size: 18px; }
                
                .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
                .summary-card { background: #f9f9f9; border: 1px solid #ddd; border-radius: 8px; padding: 15px; text-align: center; }
                .summary-card .label { font-size: 12px; color: #666; text-transform: uppercase; }
                .summary-card .value { font-size: 20px; font-weight: bold; color: #E31837; margin-top: 5px; }
                
                table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; font-size: 13px; }
                th { background-color: #E31837; color: #fff; font-weight: 600; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .footer { text-align: center; color: #999; margin-top: 40px; font-size: 11px; border-top: 1px solid #eee; padding-top: 10px; }
                
                /* Nút điều khiển - ẩn khi in */
                .no-print { text-align: center; margin-bottom: 20px; }
                .no-print button { 
                    background: #E31837; color: #fff; border: none; padding: 10px 30px; 
                    border-radius: 6px; font-size: 14px; cursor: pointer; margin: 0 5px;
                }
                .no-print button:hover { background: #c01530; }
                .no-print button.secondary { background: #666; }
                .no-print button.secondary:hover { background: #555; }

                @media print {
                    .no-print { display: none !important; }
                    body { padding: 15px; }
                    h1 { font-size: 20px; }
                    @page { margin: 15mm; size: A4; }
                }
            </style>
        </head>
        <body>
            <div class="no-print">
                <button onclick="window.print()">🖨️ In / Lưu PDF</button>
                <button class="secondary" onclick="window.close()">✕ Đóng</button>
            </div>

            <h1>BÁO CÁO THỐNG KÊ WINMART</h1>
            <p class="subtitle">Tháng ${month}/${year} | Ngày xuất: ${new Date().toLocaleString('vi-VN')}</p>

            <h2>I. TỔNG QUAN</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="label">Tổng doanh thu</div>
                    <div class="value">${formatVND(totalRevenue)} đ</div>
                </div>
                <div class="summary-card">
                    <div class="label">Tổng đơn hàng</div>
                    <div class="value">${totalOrders}</div>
                </div>
                <div class="summary-card">
                    <div class="label">Lợi nhuận gộp</div>
                    <div class="value">${formatVND(grossProfit)} đ</div>
                </div>
            </div>

            <h2>II. DOANH THU THEO NGÀY</h2>
            <table>
                <tr><th>Ngày</th><th class="text-center">Số đơn</th><th class="text-right">Doanh thu (đ)</th></tr>
                ${dailyRows.map(r => {
                    const d = new Date(r.Ngay);
                    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                    return `<tr>
                        <td>${d.toISOString().split('T')[0]}</td>
                        <td class="text-center">${r.SoDon}</td>
                        <td class="text-right">${formatVND(r.DoanhThu)}</td>
                    </tr>`;
                }).join('')}
            </table>

            <h2>III. TOP SẢN PHẨM BÁN CHẠY</h2>
            <table>
                <tr><th>Mã SP</th><th>Tên sản phẩm</th><th class="text-center">SL bán</th><th class="text-right">Doanh thu (đ)</th></tr>
                ${topProducts.map(p => `<tr>
                    <td>${p.MaSanPham}</td>
                    <td>${p.TenSanPham}</td>
                    <td class="text-center">${p.TotalSold}</td>
                    <td class="text-right">${formatVND(p.TotalMoney)}</td>
                </tr>`).join('')}
            </table>

            <h2>IV. DOANH THU THEO DANH MỤC</h2>
            <table>
                <tr><th>Danh mục</th><th class="text-center">SL bán</th><th class="text-right">Doanh thu (đ)</th></tr>
                ${categoryRows.map(c => `<tr>
                    <td>${c.TenDanhMuc}</td>
                    <td class="text-center">${c.TotalSold}</td>
                    <td class="text-right">${formatVND(c.Revenue)}</td>
                </tr>`).join('')}
            </table>

            <h2>V. HIỆU SUẤT NHÂN VIÊN</h2>
            <table>
                <tr><th>Mã NV</th><th>Họ tên</th><th class="text-center">Số đơn</th><th class="text-right">Doanh thu (đ)</th></tr>
                ${employeeRows.map(e => `<tr>
                    <td>${e.MaNhanVien}</td>
                    <td>${e.HoTen}</td>
                    <td class="text-center">${e.TotalOrders}</td>
                    <td class="text-right">${formatVND(e.TotalRevenue)}</td>
                </tr>`).join('')}
            </table>

            <div class="footer">
                <p>WinMart POS &mdash; Báo cáo tự động tạo bởi hệ thống</p>
            </div>
        </body>
        </html>`;

        res.send(html);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    index,
    exportExcel,
    exportPdf
};

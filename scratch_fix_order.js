const db = require('./src/config/db');

async function fixOrder() {
    try {
        const maHoaDon = 'HD202605233934';
        const [orders] = await db.pool.query(`SELECT * FROM HoaDonBanHang WHERE MaHoaDon = ?`, [maHoaDon]);
        
        if (orders.length === 0) {
            console.log("Order not found");
            process.exit(1);
        }
        
        const order = orders[0];
        const hoaDonId = order.HoaDonId;
        
        const [items] = await db.pool.query(`SELECT * FROM ChiTietHoaDon WHERE HoaDonId = ?`, [hoaDonId]);
        
        let tongVAT = 0;
        let tongTruocKM = 0;
        
        // Fix items
        for (const item of items) {
            const itemTotal = item.SoLuong * parseFloat(item.DonGiaGoc);
            const discountRate = parseFloat(item.PhanTramGiam || 0) / 100;
            const vatRate = parseFloat(item.ThueVATApDung || 0) / 100;
            
            const itemDiscount = itemTotal * discountRate;
            const itemVAT = (itemTotal - itemDiscount) * vatRate;
            
            const thanhTienCuoi = itemTotal - itemDiscount + itemVAT;
            
            tongTruocKM += itemTotal;
            tongVAT += itemVAT;
            
            await db.pool.query(
                `UPDATE ChiTietHoaDon SET ThanhTienCuoi = ? WHERE ChiTietHoaDonId = ?`,
                [thanhTienCuoi, item.ChiTietHoaDonId]
            );
            console.log(`Updated Item ${item.ChiTietHoaDonId}: ThanhTienCuoi = ${thanhTienCuoi}`);
        }
        
        // Fix Order Total
        // Assuming no order-level discount or points used for this specific test order based on previous data
        // Previous data: TongTienTruocKM: '145000.00', DiemSuDung: 0, TongTienSauKM: '145000.00'
        
        const tongSauKM = tongTruocKM + tongVAT; // Simplified since we know no discount/points
        
        await db.pool.query(
            `UPDATE HoaDonBanHang SET TongTienSauKM = ? WHERE HoaDonId = ?`,
            [tongSauKM, hoaDonId]
        );
        console.log(`Updated Order ${maHoaDon}: TongTienSauKM = ${tongSauKM}`);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
fixOrder();

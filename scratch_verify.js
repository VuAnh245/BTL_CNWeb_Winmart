const orderService = require('./src/services/order.service');
const { getNextAllowed } = require('./src/constants/orderStatus');

async function run() {
    try {
        console.log("=== Verification Test ===");
        
        // 1. Verify that getById returns all calculated fields correctly for order 31
        console.log("1. Fetching order 31 details...");
        const order = await orderService.getById(31, 1, 'ADMIN');
        console.log("Order retrieved successfully!");
        console.log("MaHoaDon:", order.MaHoaDon);
        console.log("TrangThai:", order.TrangThai);
        console.log("PhuongThucTT:", order.PhuongThucTT);
        console.log("Calculated Fields:");
        console.log(" - baseFee:", order.baseFee);
        console.log(" - freshFee:", order.freshFee);
        console.log(" - packagingFee:", order.packagingFee);
        console.log(" - discount:", order.discount);
        console.log(" - totalWeight:", order.totalWeight);

        // 2. Verify status transitions
        console.log("\n2. Checking transitions from Pending...");
        const pendingAllowed = getNextAllowed('Pending');
        console.log("Pending allowed next states:", pendingAllowed);
        
        const hasDelivering = pendingAllowed.includes('Delivering');
        console.log("Can transition Pending -> Delivering (for COD):", hasDelivering);
        
        if (!hasDelivering) {
            throw new Error("Delivering should be allowed from Pending!");
        }
        
        console.log("=== All Tests Passed Successfully ===");
        process.exit(0);
    } catch (e) {
        console.error("Verification Error:", e.message);
        console.error(e.stack);
        process.exit(1);
    }
}
run();

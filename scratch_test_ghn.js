const db = require('./src/config/db');
const ghnService = require('./src/services/ghn.service');
const orderService = require('./src/services/order.service');

(async () => {
    try {
        const orderId = 31;
        const order = await orderService.getById(orderId, 1, 'ADMIN');
        console.log('Order retrieved:', order.MaHoaDon);
        console.log('ToDistrictId:', order.ToDistrictId, 'ToWardCode:', order.ToWardCode);
        
        console.log('Testing createGHNOrder...');
        const result = await ghnService.createGHNOrder(order, order.items, order.totalWeight);
        console.log('Success result:', result);
    } catch (e) {
        console.error('Error details:', e);
    } finally {
        process.exit(0);
    }
})();

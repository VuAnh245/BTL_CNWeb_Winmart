'use strict';

const orderService = require('../../services/order.service');

async function listInvoices(req, res, next) {
  try {
    const { keyword } = req.query;
    const pagination = { page: 1, limit: 50, sortBy: 'NgayLap_desc' };
    const filters = {}; 
    
    if (keyword) {
      filters.keyword = keyword; // Triggers search by MaHoaDon or Phone/Name depending on order.service implementation
    }

    const ordersData = await orderService.getAll(filters, pagination, 'STAFF');
    
    res.render('staff/orders/index', {
      title: 'Danh sách Đơn hàng - WinMart POS',
      currentRoute: '/staff/orders',
      orders: ordersData.items,
      keyword: keyword || '',
      user: req.session.user
    });
  } catch (error) {
    next(error);
  }
}

async function printInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const order = await orderService.getById(id, req.session.user.id, 'STAFF');
    
    // Sử dụng layout in dành riêng cho Thu ngân
    res.render('staff/orders/print', {
      layout: false, // Print page has its own full HTML structure
      title: 'In hóa đơn - WinMart POS',
      order
    });
  } catch (error) {
    next(error);
  }
}

async function getOrderDetailAPI(req, res) {
  try {
    const { id } = req.params;
    const order = await orderService.getById(id, req.session.user.id, 'STAFF');
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  listInvoices,
  printInvoice,
  getOrderDetailAPI
};

'use strict';

const customerService = require('../../services/customer.service');

async function listCustomers(req, res, next) {
  try {
    const { keyword } = req.query;
    
    const filters = {};
    if (keyword) filters.keyword = keyword; // customerService.getAll uses buildWhere which handles keyword for HoTen/SoDienThoai
    
    const pagination = { page: 1, limit: 100, sortBy: 'HoTen_asc' };
    
    const customersData = await customerService.getAll(filters, pagination);
    
    res.render('staff/customers/index', {
      title: 'Quản lý Khách hàng - WinMart POS',
      currentRoute: '/staff/customers',
      customers: customersData.items,
      user: req.session.user,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
}

async function getCustomerDetailAPI(req, res) {
  try {
    const { id } = req.params;
    const customer = await customerService.getById(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Khách hàng không tồn tại' });
    }
    res.json({ success: true, customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  listCustomers,
  getCustomerDetailAPI
};

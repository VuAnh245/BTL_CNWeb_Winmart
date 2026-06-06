const customerService = require('../../services/customer.service');
const { LOYALTY_TIER } = require('../../constants/loyaltyTier');

exports.list = async (req, res) => {
  try {
    const { search, tier, page = 1 } = req.query;
    
    const filters = {}; // Removed is_active: 1 to show all customers
    if (search) {
      // Tìm theo SĐT hoặc Tên
      filters.HoTen = { op: 'LIKE', value: `%${search}%` };
    }
    if (tier) filters.CapDoVIP = tier;

    const result = await customerService.getAll(filters, { page, limit: 10 });

    res.render('admin/customers/index', {
      title: 'Quản lý Khách Hàng',
      customers: result.items,
      meta: result.meta,
      filters: req.query,
      activeMenu: 'customers',
      LOYALTY_TIER,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi tải danh sách khách hàng');
    res.redirect('/admin');
  }
};

exports.detail = async (req, res) => {
  try {
    const customer = await customerService.getById(req.params.id);
    if (!customer) {
      req.flash('error', 'Không tìm thấy khách hàng');
      return res.redirect('/admin/customers');
    }

    res.render('admin/customers/detail', {
      title: 'Chi tiết khách hàng',
      customer,
      activeMenu: 'customers',
      LOYALTY_TIER,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Lỗi tải chi tiết khách hàng');
    res.redirect('/admin/customers');
  }
};

exports.updateTier = async (req, res) => {
  try {
    const { CapDoVIP } = req.body;
    await customerService.update(req.params.id, { CapDoVIP }, req.session.user.id);
    res.json({ success: true, message: 'Cập nhật cấp độ VIP thành công' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi cập nhật hạng thành viên' });
  }
};

exports.create = async (req, res) => {
  try {
    const data = req.body;
    const adminId = req.session.user.id;
    await customerService.create(data, adminId);
    res.json({ success: true, message: 'Thêm khách hàng thành công' });
  } catch (error) {
    res.json({ success: false, message: error.message || 'Lỗi thêm khách hàng' });
  }
};

exports.update = async (req, res) => {
  try {
    const data = req.body;
    const adminId = req.session.user.id;
    await customerService.update(req.params.id, data, adminId);
    res.json({ success: true, message: 'Cập nhật thông tin thành công' });
  } catch (error) {
    res.json({ success: false, message: error.message || 'Lỗi cập nhật khách hàng' });
  }
};

exports.toggleStatus = async (req, res) => {
  try {
    const adminId = req.session.user.id;
    const { newStatus } = await customerService.toggleStatus(req.params.id, adminId);
    res.json({ 
      success: true, 
      message: newStatus ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản'
    });
  } catch (error) {
    res.json({ success: false, message: error.message || 'Lỗi đổi trạng thái' });
  }
};

exports.adjustPoints = async (req, res) => {
  try {
    const { SoDiemThayDoi, GhiChu } = req.body;
    const adminId = req.session.user.id;
    
    if (!SoDiemThayDoi || isNaN(SoDiemThayDoi)) {
      return res.json({ success: false, message: 'Số điểm không hợp lệ' });
    }
    
    await customerService.adjustPoints(req.params.id, parseInt(SoDiemThayDoi), GhiChu, adminId);
    res.json({ success: true, message: 'Điều chỉnh điểm thành công' });
  } catch (error) {
    res.json({ success: false, message: error.message || 'Lỗi điều chỉnh điểm' });
  }
};

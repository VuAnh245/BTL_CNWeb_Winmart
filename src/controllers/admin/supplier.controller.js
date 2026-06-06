'use strict';

const supplierService = require('../../services/supplier.service');

// Lấy danh sách nhà cung cấp
async function list(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const filters = {};
    if (search) filters.TenNhaCungCap = { $like: `%${search}%` };

    const result = await supplierService.getAll(filters, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });

    res.render('admin/suppliers/list', {
      title: 'Quản lý Nhà cung cấp - WinMart',
      suppliers: result.items,
      meta: result.meta,
      search
    });
  } catch (error) {
    next(error);
  }
}

// Hiển thị form thêm mới (Mở slide-over trên trang list)
async function showCreateForm(req, res, next) {
  try {
    const page = 1;
    const result = await supplierService.getAll({}, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });
    
    res.render('admin/suppliers/list', {
      title: 'Thêm mới Nhà cung cấp - WinMart',
      suppliers: result.items,
      meta: result.meta,
      search: '',
      openSlideOver: true,
      editSupplier: null
    });
  } catch (error) {
    next(error);
  }
}

// Xử lý tạo mới
async function create(req, res, next) {
  try {
    const data = req.body;
    const adminId = req.session.user.id;
    
    await supplierService.create(data, adminId);
    
    res.json({ success: true, message: 'Thêm mới nhà cung cấp thành công!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi thêm mới nhà cung cấp.' });
  }
}

// Hiển thị form chỉnh sửa (Mở slide-over trên trang list)
async function showEditForm(req, res, next) {
  try {
    const { id } = req.params;
    const supplier = await supplierService.getById(id);
    
    if (!supplier) {
      req.flash('error', 'Không tìm thấy nhà cung cấp!');
      return res.redirect('/admin/suppliers');
    }

    const page = 1;
    const result = await supplierService.getAll({}, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });

    res.render('admin/suppliers/list', {
      title: 'Sửa Nhà cung cấp - WinMart',
      suppliers: result.items,
      meta: result.meta,
      search: '',
      openSlideOver: true,
      editSupplier: supplier
    });
  } catch (error) {
    next(error);
  }
}

// Xử lý cập nhật
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const data = req.body;
    const adminId = req.session.user.id;

    await supplierService.update(id, data, adminId);

    res.json({ success: true, message: 'Cập nhật nhà cung cấp thành công!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật nhà cung cấp.' });
  }
}

// Xử lý xóa mềm
async function deleteSupplier(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;

    await supplierService.softDelete(id, adminId);
    
    res.json({ success: true, message: 'Ngừng hợp tác thành công!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi thao tác.' });
  }
}

module.exports = {
  list,
  showCreateForm,
  create,
  showEditForm,
  update,
  deleteSupplier
};


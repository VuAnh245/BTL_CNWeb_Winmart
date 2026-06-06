'use strict';

const categoryService = require('../../services/category.service');

// Lấy danh sách danh mục
async function list(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const filters = {};
    if (search) filters.TenDanhMuc = { $like: `%${search}%` };
    // Bỏ filter is_active = 1 để hiển thị cả các danh mục đã khóa (xóa mềm)
    // filters.is_active = 1;

    const result = await categoryService.getAll(filters, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });

    res.render('admin/categories/list', {
      title: 'Quản lý Danh mục - WinMart',
      categories: result.items,
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
    // Fetch list data to render the background
    const page = 1;
    const result = await categoryService.getAll({ is_active: 1 }, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });
    
    res.render('admin/categories/list', {
      title: 'Thêm mới Danh mục - WinMart',
      categories: result.items,
      meta: result.meta,
      search: '',
      openSlideOver: true,
      editCategory: null
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
    
    await categoryService.create(data, adminId);
    
    res.json({ success: true, message: 'Thêm mới danh mục thành công!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi thêm mới danh mục.' });
  }
}

// Hiển thị form chỉnh sửa (Mở slide-over trên trang list)
async function showEditForm(req, res, next) {
  try {
    const { id } = req.params;
    const category = await categoryService.getById(id);
    
    if (!category) {
      req.flash('error', 'Không tìm thấy danh mục!');
      return res.redirect('/admin/categories');
    }

    // Fetch list data to render the background
    const page = 1;
    const result = await categoryService.getAll({ is_active: 1 }, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });

    res.render('admin/categories/list', {
      title: 'Sửa Danh mục - WinMart',
      categories: result.items,
      meta: result.meta,
      search: '',
      openSlideOver: true,
      editCategory: category
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

    await categoryService.update(id, data, adminId);

    res.json({ success: true, message: 'Cập nhật danh mục thành công!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật danh mục.' });
  }
}

// Xử lý xóa mềm
async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;

    await categoryService.softDelete(id, adminId);
    
    res.json({ success: true, message: 'Xóa danh mục thành công!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa danh mục.' });
  }
}

module.exports = {
  list,
  showCreateForm,
  create,
  showEditForm,
  update,
  deleteCategory
};


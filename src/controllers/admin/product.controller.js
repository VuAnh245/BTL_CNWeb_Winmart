'use strict';

const productService = require('../../services/product.service');
const categoryService = require('../../services/category.service');
const supplierService = require('../../services/supplier.service');
const { deleteUploadedFile } = require('../../middlewares/upload.middleware');
const db = require('../../config/db');

// Lấy danh sách sản phẩm
async function list(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const DanhMucId = req.query.category || '';

    const filters = {};
    if (search) filters.TenSanPham = `%${search}%`;
    if (DanhMucId) filters.DanhMucId = DanhMucId;
    
    // Bỏ filter is_active = 1 để Admin thấy được cả sản phẩm Ngừng bán

    const result = await productService.getAll(filters, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });
    const categories = await categoryService.getAll({ is_active: 1 }, { limit: 100 });
    const suppliers = await supplierService.getAll({ is_active: 1 }, { limit: 100 });

    res.render('admin/products/list', {
      title: 'Quản lý Sản phẩm - WinMart',
      products: result.items,
      meta: result.meta,
      search,
      currentCategory: DanhMucId,
      categories: categories.items,
      suppliers: suppliers.items
    });
  } catch (error) {
    next(error);
  }
}

// Hiển thị form thêm mới (Mở slide-over trên trang list)
async function showCreateForm(req, res, next) {
  try {
    const categoriesList = await categoryService.getAll({ is_active: 1 }, { limit: 100 });
    const suppliersList = await supplierService.getAll({ is_active: 1 }, { limit: 100 });
    
    // Fetch list data to render the background
    const page = 1;
    const result = await productService.getAll({}, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });

    res.render('admin/products/list', {
      title: 'Thêm mới Sản phẩm - WinMart',
      products: result.items,
      meta: result.meta,
      search: '',
      currentCategory: '',
      categories: categoriesList.items,
      suppliers: suppliersList.items,
      openSlideOver: true,
      editProduct: null
    });
  } catch (error) {
    next(error);
  }
}

// Xử lý tạo mới
async function create(req, res, next) {
  try {
    const data = req.body;
    
    // Checkbox fallback
    data.CanDongGoiDacBiet = req.body.CanDongGoiDacBiet ? 1 : 0;
    
    // Nếu có file upload
    if (req.file) {
      data.HinhAnh = req.file.filename;
    }

    const adminId = req.session.user.id;
    await productService.create(data, adminId);
    
    res.json({ success: true, message: 'Thêm mới sản phẩm thành công!' });
  } catch (error) {
    // Nếu lỗi mà có file vừa upload thì nên xóa file
    if (req.file) {
      await deleteUploadedFile(req.file.filename);
    }
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi thêm mới sản phẩm.' });
  }
}

// Hiển thị form chỉnh sửa (Mở slide-over trên trang list)
async function showEditForm(req, res, next) {
  try {
    const { id } = req.params;
    const product = await productService.getById(id);
    if (!product) {
      req.flash('error', 'Không tìm thấy sản phẩm!');
      return res.redirect('/admin/products');
    }

    const categoriesList = await categoryService.getAll({ is_active: 1 }, { limit: 100 });
    const suppliersList = await supplierService.getAll({ is_active: 1 }, { limit: 100 });

    // Fetch list data to render the background
    const page = 1;
    const result = await productService.getAll({}, { page, limit: 10, sortBy: 'NgayCapNhat', direction: 'DESC' });

    res.render('admin/products/list', {
      title: 'Sửa Sản phẩm - WinMart',
      products: result.items,
      meta: result.meta,
      search: '',
      currentCategory: '',
      categories: categoriesList.items,
      suppliers: suppliersList.items,
      openSlideOver: true,
      editProduct: product
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
    
    // Checkbox fallback
    data.CanDongGoiDacBiet = req.body.CanDongGoiDacBiet ? 1 : 0;
    
    // Nếu có file upload mới
    if (req.file) {
      data.HinhAnh = req.file.filename;
    }

    const adminId = req.session.user.id;
    await productService.update(id, data, adminId);

    res.json({ success: true, message: 'Cập nhật sản phẩm thành công!' });
  } catch (error) {
    if (req.file) {
      await deleteUploadedFile(req.file.filename);
    }
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi cập nhật sản phẩm.' });
  }
}

// Xử lý xóa mềm
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const adminId = req.session.user.id;

    await productService.softDelete(id, adminId);
    
    res.json({ success: true, message: 'Xóa sản phẩm thành công!' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Lỗi khi xóa sản phẩm.' });
  }
}

// Render trang in tem mã vạch
async function printBarcode(req, res, next) {
  try {
    const { id } = req.params;
    const product = await productService.getById(id);
    
    if (!product) {
      req.flash('error', 'Không tìm thấy sản phẩm!');
      return res.redirect('/admin/products');
    }

    if (!product.Barcode) {
      req.flash('error', 'Sản phẩm này chưa có Mã vạch để in!');
      return res.redirect('/admin/products');
    }

    // Giao diện in ấn thường không cần layout chung (sidebar, header)
    res.render('admin/products/print-barcode', {
      layout: false,
      product
    });
  } catch (error) {
    next(error);
  }
}

// Hiển thị chi tiết sản phẩm
async function getDetail(req, res, next) {
    try {
        const id = req.params.id;
        const [rows] = await db.pool.query(`
            SELECT p.*, c.TenDanhMuc 
            FROM SanPham p 
            LEFT JOIN DanhMuc c ON p.DanhMucId = c.DanhMucId 
            WHERE p.SanPhamId = ?
        `, [id]);

        if (rows.length === 0) {
            req.flash('error', 'Không tìm thấy sản phẩm');
            return res.redirect('/admin/products');
        }

        const product = rows[0];

        // Lấy lịch sử lô hàng (cả Available và OutOfStock)
        const [batches] = await db.pool.query(`
            SELECT MaLo, SoLuongNhap, SoLuongHienTai, NgayNhap, NgayHetHan, TrangThai
            FROM LoHangTonKho
            WHERE SanPhamId = ?
            ORDER BY NgayNhap DESC
        `, [id]);

        res.render('admin/products/detail', {
            title: 'Chi tiết sản phẩm',
            product,
            batches,
            activeMenu: 'products'
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
  list,
  showCreateForm,
  create,
  showEditForm,
  update,
  deleteProduct,
  printBarcode,
  getDetail
};

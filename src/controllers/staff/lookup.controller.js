'use strict';

const productService = require('../../services/product.service');
const categoryService = require('../../services/category.service');

async function listInventory(req, res, next) {
  try {
    const { keyword, categoryId } = req.query;
    
    const filters = { is_active: 1 };
    if (keyword) filters.keyword = keyword;
    if (categoryId) filters.CategoryId = categoryId;
    
    const pagination = { page: 1, limit: 100, sortBy: 'TenSanPham_asc' };
    
    const [productsData, categoriesData] = await Promise.all([
      productService.getAll(filters, pagination),
      categoryService.getAll({ is_active: 1 }, { limit: 100 })
    ]);
    
    res.render('staff/inventory/index', {
      title: 'Tra cứu Kho - WinMart POS',
      currentRoute: '/staff/inventory',
      products: productsData.items,
      categories: categoriesData.items,
      user: req.session.user,
      query: req.query
    });
  } catch (error) {
    next(error);
  }
}

async function getProductDetailAPI(req, res) {
  try {
    const { id } = req.params;
    const product = await productService.getById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' });
    }
    // Lọc lại chỉ lấy batch Available nếu cần, getById đã lấy 'Available'
    res.json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  listInventory,
  getProductDetailAPI
};

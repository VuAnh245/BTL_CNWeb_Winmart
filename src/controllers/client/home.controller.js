const productService = require('../../services/product.service');
const categoryService = require('../../services/category.service');
const promotionService = require('../../services/promotion.service');

exports.index = async (req, res) => {
  try {
    // Lấy dữ liệu song song để tối ưu hiệu năng
    const [categories, featuredProducts, activePromotions, flashSaleProducts] = await Promise.all([
      categoryService.getAll({ is_active: 1 }, { limit: 8 }),
      productService.getAll({ TrangThai: 'DangBan', is_active: 1 }, { limit: 8, sortBy: 'NgayTao', direction: 'DESC' }),
      promotionService.getAllActiveFlashSales(),
      productService.getExpiringProducts(4)
    ]);

    res.render('client/home', {
      title: 'Trang chủ',
      categories: categories.items,
      products: featuredProducts.items,
      activePromotions: activePromotions || [],
      flashSaleProducts: flashSaleProducts || [],
      activePage: 'home'
    });
  } catch (error) {
    req.flash('error', 'Không thể tải dữ liệu trang chủ.');
    res.render('client/home', { title: 'Trang chủ', products: [], categories: [], activePromotions: [] });
  }
};

exports.promotions = async (req, res) => {
  try {
    const vouchers = await promotionService.getAllActiveFlashSales();
    res.render('client/promotions', {
      title: 'Khuyến mãi | WinMart',
      currentPath: req.path,
      vouchers: vouchers || []
    });
  } catch (error) {
    console.error('Error in promotions controller:', error);
    res.render('client/promotions', {
      title: 'Khuyến mãi | WinMart',
      currentPath: req.path,
      vouchers: []
    });
  }
};

exports.contact = (req, res) => {
  res.render('client/contact', {
    title: 'Liên hệ | WinMart',
    currentPath: req.path
  });
};
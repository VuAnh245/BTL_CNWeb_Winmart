const productService = require('../../services/product.service');
const categoryService = require('../../services/category.service');

exports.list = async (req, res) => {
  try {
    const { search, category, minPrice, maxPrice, page = 1 } = req.query;
    
    // Build filters
    const filters = { TrangThai: 'DangBan', is_active: 1 };
    if (search) filters.TenSanPham = { op: 'LIKE', value: `%${search}%` };
    if (category) filters.DanhMucId = category;
    if (minPrice) filters.GiaBan = { op: '>=', value: minPrice };
    if (maxPrice) filters.GiaBan = { op: '<=', value: maxPrice };

    const [products, categories] = await Promise.all([
      productService.getAll(filters, { page, limit: 12, sortBy: 'NgayTao', direction: 'DESC' }),
      categoryService.getAll({ is_active: 1 }, { limit: 100 })
    ]);

    res.render('client/products/list', {
      title: 'Sản phẩm',
      products: products.items,
      meta: products.meta,
      categories: categories.items,
      activePage: 'products',
      filters: req.query
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Lỗi tải danh sách sản phẩm');
  }
};

exports.detail = async (req, res) => {
  try {
    const product = await productService.getById(req.params.id);
    if (!product) {
      return res.status(404).render('errors/404', { title: 'Không tìm thấy', url: req.originalUrl });
    }
    res.render('client/products/detail', { title: product.TenSanPham, product });
  } catch (error) {
    console.error("Lỗi detail product:", error);
    res.status(500).send('Lỗi chi tiết sản phẩm');
  }
};
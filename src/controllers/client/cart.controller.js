const productService = require('../../services/product.service');

exports.add = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        
        if (!req.session.cart) {
            req.session.cart = [];
        }

        // Kiểm tra sản phẩm
        const product = await productService.getById(productId);
        if (!product || product.TrangThai !== 'DangBan') {
            return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại hoặc ngừng bán.' });
        }

        // Kiểm tra tồn kho
        const totalStock = product.batches ? product.batches.reduce((sum, b) => sum + b.soLuong, 0) : 0;
        if (totalStock < quantity) {
            return res.status(400).json({ success: false, message: 'Sản phẩm vượt quá số lượng tồn kho.' });
        }

        // Kiểm tra xem đã có trong giỏ hàng chưa
        const existingItem = req.session.cart.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += parseInt(quantity);
        } else {
            req.session.cart.push({
                productId,
                quantity: parseInt(quantity),
                name: product.TenSanPham,
                price: product.GiaBan,
                vat: product.ThueVAT || 0,
                image: product.HinhAnh
            });
        }

        const totalItems = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
        
        // Update header middleware cart count implicitly happens since it reads req.session.cart
        req.session.cartCount = totalItems;

        return res.json({ 
            success: true, 
            message: 'Đã thêm vào giỏ hàng!',
            cartCount: totalItems
        });
    } catch (error) {
        console.error('Lỗi thêm giỏ hàng:', error);
        return res.status(500).json({ success: false, message: 'Đã xảy ra lỗi hệ thống.' });
    }
};

exports.index = (req, res) => {
    const cart = req.session.cart || [];
    res.render('client/cart/index', {
        title: 'Giỏ hàng',
        cart: cart,
        activePage: 'cart'
    });
};

exports.update = async (req, res) => {
    try {
        const { productId, change } = req.body;
        if (!req.session.cart) req.session.cart = [];
        
        const existingItem = req.session.cart.find(item => item.productId.toString() === productId.toString());
        if (!existingItem) {
            return res.status(404).json({ success: false, message: 'Sản phẩm không có trong giỏ hàng.' });
        }

        const newQuantity = existingItem.quantity + parseInt(change);
        
        if (newQuantity <= 0) {
            // Remove item if quantity goes to 0
            req.session.cart = req.session.cart.filter(item => item.productId.toString() !== productId.toString());
        } else {
            // Check stock before increasing
            if (parseInt(change) > 0) {
                const product = await productService.getById(productId);
                const totalStock = product && product.batches ? product.batches.reduce((sum, b) => sum + b.soLuong, 0) : 0;
                if (totalStock < newQuantity) {
                    return res.status(400).json({ success: false, message: 'Vượt quá số lượng tồn kho.' });
                }
            }
            existingItem.quantity = newQuantity;
        }

        const totalItems = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
        req.session.cartCount = totalItems;

        return res.json({ success: true, message: 'Đã cập nhật giỏ hàng.', cartCount: totalItems });
    } catch (error) {
        console.error('Lỗi cập nhật giỏ hàng:', error);
        return res.status(500).json({ success: false, message: 'Lỗi hệ thống.' });
    }
};

exports.remove = async (req, res) => {
    try {
        const { productId } = req.body;
        if (req.session.cart) {
            req.session.cart = req.session.cart.filter(item => item.productId.toString() !== productId.toString());
            const totalItems = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
            req.session.cartCount = totalItems;
            return res.json({ success: true, message: 'Đã xóa sản phẩm khỏi giỏ hàng.', cartCount: totalItems });
        }
        return res.status(404).json({ success: false, message: 'Giỏ hàng trống.' });
    } catch (error) {
        console.error('Lỗi xóa giỏ hàng:', error);
        return res.status(500).json({ success: false, message: 'Lỗi hệ thống.' });
    }
};

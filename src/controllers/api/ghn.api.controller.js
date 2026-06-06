'use strict';

const ghnService = require('../../services/ghn.service');
const db = require('../../config/db');

/**
 * Lấy danh sách Tỉnh/Thành
 */
exports.getProvinces = async (req, res, next) => {
    try {
        const provinces = await ghnService.getProvinces();
        res.json({ success: true, data: provinces });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Lấy danh sách Quận/Huyện theo Tỉnh
 */
exports.getDistricts = async (req, res, next) => {
    try {
        const { provinceId } = req.params;
        const districts = await ghnService.getDistricts(provinceId);
        res.json({ success: true, data: districts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Lấy danh sách Phường/Xã theo Quận/Huyện
 */
exports.getWards = async (req, res, next) => {
    try {
        const { districtId } = req.params;
        const wards = await ghnService.getWards(districtId);
        res.json({ success: true, data: wards });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Tính toán phí giao hàng Hybrid cho giỏ hàng hiện tại
 */
exports.calculateCartFee = async (req, res, next) => {
    try {
        const { toDistrictId, toWardCode } = req.body;
        if (!toDistrictId || !toWardCode) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin Quận/Huyện hoặc Phường/Xã giao hàng' });
        }

        const cart = req.session.cart || [];
        if (cart.length === 0) {
            return res.json({
                success: true,
                baseFee: 0,
                freshFee: 0,
                packagingFee: 0,
                totalFee: 0,
                discount: 0,
                finalFee: 0,
                totalWeight: 0,
                freeShipThreshold: 300000
            });
        }

        // Lấy cấu hình cửa hàng
        const config = await ghnService.getGHNConfig();

        // Lấy thông tin chi tiết các sản phẩm trong giỏ hàng để tính toán trọng lượng và phụ phí
        const productIds = cart.map(item => item.productId);
        const [products] = await db.pool.query(
            `SELECT SanPhamId, DanhMucId, CanNang, CanDongGoiDacBiet, GiaBan, ThueVAT FROM SanPham WHERE SanPhamId IN (?)`,
            [productIds]
        );

        let totalWeight = 0;
        let specialPackagingCount = 0;
        let freshFoodValue = 0;
        let cartSubtotal = 0; // Tổng tiền hàng chưa ship (gồm VAT)

        cart.forEach(item => {
            const product = products.find(p => p.SanPhamId.toString() === item.productId.toString());
            if (product) {
                const weight = product.CanNang || 500;
                totalWeight += weight * item.quantity;

                if (product.CanDongGoiDacBiet) {
                    specialPackagingCount += item.quantity;
                }

                // Nếu thuộc danh mục hàng tươi sống (DanhMucId = 4)
                if (product.DanhMucId === 4) {
                    freshFoodValue += product.GiaBan * item.quantity;
                }

                // Tính tạm tính (đã gồm VAT)
                const vatMultiplier = 1 + ((product.ThueVAT || 0) / 100);
                cartSubtotal += (product.GiaBan * item.quantity) * vatMultiplier;
            }
        });

        // 1. Gọi GHN API để tính phí nền
        let ghnBaseFee = 0;
        try {
            ghnBaseFee = await ghnService.calculateGHNBaseFee(toDistrictId, toWardCode, totalWeight);
        } catch (e) {
            console.error('Lỗi khi tính phí nền GHN, sử dụng phí dự phòng 15.000đ:', e.message);
            ghnBaseFee = 15000; // Fallback
        }

        // 2. Tính phụ thu hàng tươi sống (chia theo bậc)
        let freshFee = 0;
        if (freshFoodValue > 0) {
            if (freshFoodValue >= config.FreshTier2Threshold) {
                freshFee = config.FreshTier2Fee;
            } else {
                freshFee = config.FreshTier1Fee;
            }
        }

        // 3. Tính phụ thu đóng gói đặc biệt
        const packagingFee = specialPackagingCount * config.PackagingFee;

        // 4. Tổng chi phí trước khuyến mãi/ngưỡng
        const totalFee = ghnBaseFee + freshFee + packagingFee;

        // 5. Kiểm tra chính sách miễn phí ship đơn hàng lớn
        let discount = 0;
        let finalFee = totalFee;
        if (cartSubtotal >= config.FreeShipThreshold) {
            discount = totalFee;
            finalFee = 0;
        }

        res.json({
            success: true,
            baseFee: ghnBaseFee,
            freshFee,
            packagingFee,
            totalFee,
            discount,
            finalFee,
            totalWeight,
            freeShipThreshold: config.FreeShipThreshold
        });

    } catch (error) {
        console.error('Lỗi tính phí giao hàng:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi tính phí giao hàng' });
    }
};

/**
 * Test kết nối GHN (kiểm tra token hợp lệ)
 */
exports.testConnection = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Thiếu API Token' });
        }

        // Gọi thử API lấy danh sách tỉnh với token vừa nhập
        const baseUrl = ghnService.getBaseUrl(token);
        const url = `${baseUrl}master-data/province`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Token': token
            }
        });

        const result = await response.json();
        if (response.ok && result.code === 200) {
            return res.json({ success: true, message: 'Kết nối thành công tới Giao Hàng Nhanh!' });
        } else {
            return res.status(400).json({ success: false, message: result.message || 'Token không hợp lệ hoặc hết hạn' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

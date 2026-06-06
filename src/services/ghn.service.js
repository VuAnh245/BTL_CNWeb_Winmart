'use strict';

const db = require('../config/db');

// Xác định base URL dựa trên môi trường hoặc token
function getBaseUrl(token) {
    if (process.env.GHN_ENV === 'production') {
        return 'https://online-gateway.ghn.vn/shiip/public-api/';
    }
    if (process.env.GHN_ENV === 'sandbox' || (token && token.toLowerCase().includes('sandbox')) || process.env.NODE_ENV === 'development') {
        return 'https://dev-online-gateway.ghn.vn/shiip/public-api/';
    }
    return 'https://online-gateway.ghn.vn/shiip/public-api/';
}

/**
 * Lấy cấu hình GHN từ bảng CuaHang
 */
async function getGHNConfig() {
    const [rows] = await db.pool.query('SELECT * FROM CuaHang WHERE is_active = 1 LIMIT 1');
    if (rows.length === 0) {
        throw new Error('Không tìm thấy cửa hàng hoạt động để lấy cấu hình GHN');
    }
    return rows[0];
}

/**
 * Gọi API GHN chung
 */
async function callGHNApi(endpoint, method = 'GET', body = null, customToken = null, customShopId = null) {
    let token = customToken;
    let shopId = customShopId;

    if (!token) {
        const config = await getGHNConfig();
        token = config.GHNToken;
        shopId = config.GHNShopId;
    }

    if (!token) {
        throw new Error('Chưa cấu hình GHN API Token trong hệ thống');
    }

    const baseUrl = getBaseUrl(token);
    const url = `${baseUrl}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
        'Token': token
    };

    if (shopId) {
        headers['ShopId'] = shopId.toString();
    }

    const options = {
        method,
        headers
    };

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const result = await response.json();

    if (!response.ok || result.code !== 200) {
        const errMsg = result.message || `Lỗi API GHN: ${response.statusText}`;
        console.error(`[GHN Error] Endpoint: ${endpoint}, Msg: ${errMsg}`, result);
        throw new Error(errMsg);
    }

    return result.data;
}

/**
 * Lấy danh sách Tỉnh/Thành
 */
async function getProvinces() {
    // Có một số trường hợp API tỉnh không cần Token/ShopId, nhưng để an toàn cứ truyền
    return callGHNApi('master-data/province', 'GET');
}

/**
 * Lấy danh sách Quận/Huyện theo Tỉnh
 */
async function getDistricts(provinceId) {
    return callGHNApi('master-data/district', 'POST', { province_id: parseInt(provinceId, 10) });
}

/**
 * Lấy danh sách Phường/Xã theo Quận/Huyện
 */
async function getWards(districtId) {
    return callGHNApi('master-data/ward', 'POST', { district_id: parseInt(districtId, 10) });
}

/**
 * Lấy danh sách các dịch vụ vận chuyển khả dụng
 */
async function getAvailableServices(fromDistrictId, toDistrictId) {
    try {
        const config = await getGHNConfig();
        return callGHNApi('v2/shipping-order/available-services', 'POST', {
            shop_id: parseInt(config.GHNShopId, 10),
            from_district: parseInt(fromDistrictId, 10),
            to_district: parseInt(toDistrictId, 10)
        });
    } catch (e) {
        console.warn('Lỗi khi lấy danh sách dịch vụ khả dụng của GHN:', e.message);
        return [];
    }
}

/**
 * Tính phí giao hàng từ GHN
 */
async function calculateGHNBaseFee(toDistrictId, toWardCode, weightGrams = 500) {
    const config = await getGHNConfig();
    const fromDistrictId = config.GHNDistrictId || 1486; // Mặc định Hai Bà Trưng nếu chưa lưu
    const fromWardCode = config.GHNWardCode || "1A0101"; // Mặc định Lê Đại Hành nếu chưa lưu
    
    const weight = Math.max(10, weightGrams); // GHN yêu cầu trọng lượng > 0 (gram)

    // Lấy service_id phù hợp hoặc dùng service_type_id = 2 (Chuẩn/E-commerce)
    let serviceId = 0;
    const services = await getAvailableServices(fromDistrictId, toDistrictId);
    const activeService = services.find(s => s.service_type_id === 2) || services[0];
    
    if (activeService) {
        serviceId = activeService.service_id;
    }

    const payload = {
        from_district_id: parseInt(fromDistrictId, 10),
        from_ward_code: fromWardCode,
        to_district_id: parseInt(toDistrictId, 10),
        to_ward_code: toWardCode.toString(),
        weight: parseInt(weight, 10),
        height: 10,
        length: 10,
        width: 10
    };

    if (serviceId) {
        payload.service_id = parseInt(serviceId, 10);
    } else {
        payload.service_type_id = 2; // Fallback
    }

    const result = await callGHNApi('v2/shipping-order/fee', 'POST', payload);
    return result.total;
}

/**
 * Tạo đơn vận chuyển trên GHN
 */
async function createGHNOrder(order, items, weightGrams = 500) {
    const config = await getGHNConfig();
    const fromDistrictId = config.GHNDistrictId || 1486;
    const fromWardCode = config.GHNWardCode || "1A0101";

    const payload = {
        client_order_code: order.MaHoaDon || null,
        payment_type_id: 1, // 1: Cửa hàng trả phí ship, 2: Người nhận trả phí ship. Ở đây ta thu khách rồi trả GHN
        note: order.GhiChu || "Giao hàng WinMart",
        required_note: "KHONGCHOXEMHANG", // KHONGCHOXEMHANG, CHOXEMHANGKHONGTHU, CHOPHETHUHANG
        return_phone: config.SoDienThoai || "0347465650",
        return_address: config.DiaChi || "191 Bà Triệu, Lê Đại Hành, Hai Bà Trưng, Hà Nội",
        return_district_id: parseInt(fromDistrictId, 10),
        return_ward_code: fromWardCode,
        
        to_name: order.TenNguoiNhan || order.fullName || "Khách hàng WinMart",
        to_phone: order.SdtNguoiNhan || order.phone || "0999999999",
        to_address: order.DiaChiNhan || "Địa chỉ nhận hàng",
        to_district_id: parseInt(order.ToDistrictId, 10),
        to_ward_code: order.ToWardCode.toString(),
        
        weight: parseInt(weightGrams, 10),
        length: 15,
        width: 15,
        height: 15,
        
        // Dịch vụ
        service_type_id: 2, // Standard
        
        // COD
        cod_amount: order.PhuongThucTT === 'TienMat' ? Math.round(order.TongTienSauKM) : 0,
        
        // Danh sách mặt hàng
        items: items.map(item => ({
            name: item.TenSanPham || item.name,
            code: item.MaSanPham || item.productId?.toString(),
            quantity: parseInt(item.quantity || item.SoLuong, 10),
            weight: parseInt(item.CanNang || 500, 10)
        }))
    };

    const result = await callGHNApi('v2/shipping-order/create', 'POST', payload);
    return result; // Trả về thông tin đơn hàng GHN (bao gồm order_code)
}

/**
 * Hủy đơn hàng trên GHN
 */
async function cancelGHNOrder(orderCode) {
    return callGHNApi('v2/shipping-order/cancel', 'POST', {
        order_codes: [orderCode]
    });
}

/**
 * Lấy thông tin đơn hàng chi tiết từ GHN (để tracking)
 */
async function getGHNOrderDetails(orderCode) {
    return callGHNApi('v2/shipping-order/detail', 'POST', {
        order_code: orderCode
    });
}

module.exports = {
    getProvinces,
    getDistricts,
    getWards,
    getAvailableServices,
    calculateGHNBaseFee,
    createGHNOrder,
    cancelGHNOrder,
    getGHNOrderDetails,
    getGHNConfig,
    getBaseUrl
};

'use strict';

const { pool } = require('../config/db');
const { withTransaction } = require('../utils/transaction');
const { MSG, format } = require('../constants/messages');
const appConfig = require('../config/app.config');

/**
 * Lấy giỏ hàng của khách (từ session hoặc DB cart)
 * @param {number} khachHangId - Optional cho guest cart (dùng session)
 * @param {string} sessionId - Fallback cho guest
 * @returns {Promise<Array>} List of { sanPhamId, tenSP, soLuong, donGia, thanhTien, tonKho }
 */
async function getCart(khachHangId = null, sessionId = null) {
  // Ưu tiên cart của registered user
  if (khachHangId) {
    const [rows] = await pool.query(
      `SELECT 
         c.CartId, c.KhachHangId,
         ci.CartItemId, ci.SanPhamId, ci.SoLuong, ci.NgayThem,
         sp.TenSanPham, sp.GiaBan, sp.Barcode, sp.HinhAnh,
         (SELECT SUM(SoLuongHienTai) FROM LoHangTonKho WHERE SanPhamId = sp.SanPhamId AND TrangThai = 'Available') as tonKho
       FROM Cart c
       JOIN CartItem ci ON c.CartId = ci.CartId
       JOIN SanPham sp ON ci.SanPhamId = sp.SanPhamId
       WHERE c.KhachHangId = ? AND sp.is_active = 1 AND sp.TrangThai = 'DangBan'
       ORDER BY ci.NgayThem DESC`,
      [khachHangId]
    );
    return rows;
  }
  
  // Guest cart: lưu trong session (controller sẽ handle)
  // Service trả về empty hoặc throw nếu cần DB persistence
  return [];
}

/**
 * Thêm sản phẩm vào giỏ
 * @param {Object} params - { khachHangId?, sanPhamId, soLuong, sessionId? }
 * @returns {Promise<{ cartItemId, message }>}
 */
async function addToCart(params) {
  const { khachHangId, sanPhamId, soLuong = 1, sessionId } = params;
  
  if (!khachHangId && !sessionId) {
    throw new Error('Cần đăng nhập hoặc có session để thêm vào giỏ');
  }
  
  return withTransaction(async (conn) => {
    // Check product exists & available
    const [product] = await conn.query(
      `SELECT SanPhamId, TenSanPham, GiaBan, TrangThai, is_active,
              (SELECT SUM(SoLuongHienTai) FROM LoHangTonKho WHERE SanPhamId = ? AND TrangThai = 'Available') as tonKho
       FROM SanPham WHERE SanPhamId = ? AND is_active = 1 AND TrangThai = 'DangBan'`,
      [sanPhamId, sanPhamId]
    );
    
    if (product.length === 0) {
      throw new Error(MSG.PRODUCT.NOT_FOUND);
    }
    
    if (product[0].tonKho < soLuong) {
      throw new Error(format(MSG.PRODUCT.OUT_OF_STOCK, { 
        name: product[0].TenSanPham, 
        qty: product[0].tonKho 
      }));
    }
    
    // Get or create cart
    let cartId;
    
    if (khachHangId) {
      const [carts] = await conn.query(
        'SELECT CartId FROM Cart WHERE KhachHangId = ? LIMIT 1',
        [khachHangId]
      );
      
      if (carts.length === 0) {
        const [result] = await conn.query(
          'INSERT INTO Cart (KhachHangId) VALUES (?)',
          [khachHangId]
        );
        cartId = result.insertId;
      } else {
        cartId = carts[0].CartId;
      }
    }
    // Guest cart: handle in controller via session
    
    // Check if item already in cart
    const [existing] = await conn.query(
      'SELECT CartItemId, SoLuong FROM CartItem WHERE CartId = ? AND SanPhamId = ?',
      [cartId, sanPhamId]
    );
    
    if (existing.length > 0) {
      // Update quantity
      const newQty = existing[0].SoLuong + soLuong;
      await conn.query(
        'UPDATE CartItem SET SoLuong = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE CartItemId = ?',
        [newQty, existing[0].CartItemId]
      );
      return { cartItemId: existing[0].CartItemId, message: 'Đã cập nhật số lượng' };
    }
    
    // Insert new item
    const [result] = await conn.query(
      `INSERT INTO CartItem (CartId, SanPhamId, SoLuong, DonGiaApDung)
       VALUES (?, ?, ?, ?)`,
      [cartId, sanPhamId, soLuong, product[0].GiaBan]
    );
    
    return { cartItemId: result.insertId, message: 'Đã thêm vào giỏ hàng' };
  });
}

/**
 * Cập nhật số lượng trong giỏ
 */
async function updateCartItem(cartItemId, soLuong, khachHangId) {
  if (soLuong <= 0) {
    return removeCartItem(cartItemId, khachHangId);
  }
  
  // Verify ownership
  const [item] = await pool.query(
    `SELECT ci.*, c.KhachHangId, sp.tonKho
     FROM CartItem ci
     JOIN Cart c ON ci.CartId = c.CartId
     JOIN SanPham sp ON ci.SanPhamId = sp.SanPhamId
     WHERE ci.CartItemId = ? AND c.KhachHangId = ?`,
    [cartItemId, khachHangId]
  );
  
  if (item.length === 0) {
    throw new Error('Mặt hàng không tồn tại trong giỏ của bạn');
  }
  
  if (item[0].tonKho < soLuong) {
    throw new Error(format(MSG.PRODUCT.OUT_OF_STOCK, { 
      name: `SP#${item[0].SanPhamId}`, 
      qty: item[0].tonKho 
    }));
  }
  
  const [result] = await pool.query(
    'UPDATE CartItem SET SoLuong = ?, NgayCapNhat = CURRENT_TIMESTAMP WHERE CartItemId = ?',
    [soLuong, cartItemId]
  );
  
  return result.affectedRows > 0;
}

/**
 * Xóa item khỏi giỏ
 */
async function removeCartItem(cartItemId, khachHangId) {
  const [result] = await pool.query(
    `DELETE ci FROM CartItem ci
     JOIN Cart c ON ci.CartId = c.CartId
     WHERE ci.CartItemId = ? AND c.KhachHangId = ?`,
    [cartItemId, khachHangId]
  );
  
  return result.affectedRows > 0;
}

/**
 * Xóa toàn bộ giỏ hàng
 */
async function clearCart(khachHangId) {
  const [cart] = await pool.query(
    'SELECT CartId FROM Cart WHERE KhachHangId = ? LIMIT 1',
    [khachHangId]
  );
  
  if (cart.length === 0) return true;
  
  const [result] = await pool.query(
    'DELETE FROM CartItem WHERE CartId = ?',
    [cart[0].CartId]
  );
  
  return result.affectedRows >= 0;
}

/**
 * Tính tổng giỏ hàng (dùng trước khi checkout)
 */
async function calculateCartTotal(khachHangId) {
  const [rows] = await pool.query(
    `SELECT 
       SUM(ci.SoLuong * ci.DonGiaApDung) as tongTruocKM,
       SUM(ci.SoLuong) as tongSoLuong,
       COUNT(DISTINCT ci.SanPhamId) as soMatHang
     FROM CartItem ci
     JOIN Cart c ON ci.CartId = c.CartId
     WHERE c.KhachHangId = ?`,
    [khachHangId]
  );
  
  const total = rows[0].tongTruocKM || 0;
  
  return {
    tongTruocKM: total,
    tongSoLuong: rows[0].tongSoLuong || 0,
    soMatHang: rows[0].soMatHang || 0,
    phiShip: 0, // Calculate based on address later
    tongSauKM: total, // Will apply discount in checkout
  };
}

/**
 * Auto-clear cart after successful checkout
 */
async function clearAfterCheckout(khachHangId) {
  // Called by checkout.service after successful order
  return clearCart(khachHangId);
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  calculateCartTotal,
  clearAfterCheckout,
};
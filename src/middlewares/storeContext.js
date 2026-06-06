'use strict';

/**
 * Middleware inject store_id/region từ session vào req
 * Hỗ trợ multi-store trong tương lai (WinMart chain)
 * Hiện tại: default store_id = 1 (cửa hàng demo)
 * Traceability: UC-S01, FN-MultiStore (future)
 */
function injectStoreContext(req, res, next) {
  // Priority: 1. Session store → 2. Header override (dev) → 3. Default
  const storeId = req.session?.storeId 
    || (process.env.NODE_ENV === 'development' ? req.headers['x-store-id'] : null)
    || 1; // Default store
  
  req.store = {
    id: Number(storeId),
    // Có thể mở rộng: name, region, timezone, config riêng
  };
  
  // Inject vào res.locals cho views
  res.locals.store = req.store;
  
  next();
}

/**
 * Middleware validate store_id tồn tại trong DB (nếu cần)
 * Dùng cho API, không cần cho views vì đã có FK constraint
 */
async function validateStoreExists(req, res, next) {
  // Lazy import để tránh circular dependency
  const { pool } = require('../config/db');
  
  try {
    const [rows] = await pool.query(
      'SELECT store_id, store_name FROM stores WHERE store_id = ? AND is_active = 1',
      [req.store.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cửa hàng không tồn tại hoặc đã ngừng hoạt động.',
      });
    }
    
    // Attach full store info if needed
    req.store.info = rows[0];
    next();
  } catch (err) {
    console.error('[StoreContext] Error:', err.message);
    next(err);
  }
}

module.exports = { injectStoreContext, validateStoreExists };
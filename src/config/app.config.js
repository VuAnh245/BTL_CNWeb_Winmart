'use strict';

/**
 * Cấu hình ứng dụng WinMart POS
 * Load từ .env với fallback values, validate kiểu dữ liệu
 * Traceability: UC-A04 (Cấu hình hệ thống), FN-Loyalty, FN-Inventory
 */

// Helper: Parse boolean từ string ('true'/'false' → boolean)
const parseBool = (val, defaultVal) => {
  if (val === undefined || val === null) return defaultVal;
  return String(val).toLowerCase() === 'true';
};

// Helper: Parse array từ string ('a,b,c' → ['a','b','c'])
const parseArray = (val, defaultVal) => {
  if (!val) return defaultVal;
  return String(val).split(',').map(v => v.trim()).filter(v => v);
};

module.exports = {
  // =============================================
  // FILE UPLOAD (Multer)
  // =============================================
  upload: {
    maxFileSizeMB: Number(process.env.UPLOAD_MAX_SIZE_MB) || 5,
    dest: process.env.UPLOAD_DEST || './src/public/uploads',
    allowedTypes: parseArray(
      process.env.ALLOWED_FILE_TYPES,
      ['image/jpeg', 'image/png', 'image/webp']
    ),
  },

  // =============================================
  // BUSINESS LOGIC DEFAULTS
  // =============================================
  timezone: process.env.TIMEZONE || '+07:00',  // MySQL compatible
  
  // VAT options theo quy định VN: 0%, 8%, 10%
  vat: {
    default: Number(process.env.DEFAULT_VAT) || 10,
    allowed: [0, 8, 10],
  },
  
  // Loyalty WinMart Plus (UC-C05, UC-A03)
  loyalty: {
    rate: parseFloat(process.env.LOYALTY_RATE) || 0.01,  // 1% = 0.01
    expiryDays: Number(process.env.LOYALTY_EXPIRY_DAYS) || 365,
    thresholds: {
      Thuong: 0,
      VIP1: Number(process.env.VIP_THRESHOLD_VIP1) || 10000,
      VIP2: Number(process.env.VIP_THRESHOLD_VIP2) || 50000,
      VIP3: Number(process.env.VIP_THRESHOLD_VIP3) || 200000,
    },
    bonus: {
      VIP1: 1.0,   // Không bonus
      VIP2: 1.1,   // +10% điểm
      VIP3: 1.2,   // +20% điểm
    },
  },
  
  // Inventory & Order (FN-Inventory, UC-C04)
  inventory: {
    reserveTimeoutMinutes: Number(process.env.RESERVE_TIMEOUT_MINUTES) || 5,
    expiryWarnDays: Number(process.env.EXPIRY_WARN_DAYS) || 30,
    fefoSort: 'NgayHetHan ASC',  // First Expire First Out
  },
  
  order: {
    autoCancelHours: Number(process.env.ORDER_EXPIRE_HOURS) || 24,
  },
  
  // =============================================
  // PAGINATION & API
  // =============================================
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
    defaultPage: 1,
  },
  
  // =============================================
  // LOGGING & DEBUG
  // =============================================
  log: {
    level: process.env.LOG_LEVEL || 'info',  // debug | info | warn | error
    enableStack: process.env.NODE_ENV === 'development',
  },
  
  // =============================================
  // APP METADATA
  // =============================================
  appName: process.env.APP_NAME || 'WinMart POS',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
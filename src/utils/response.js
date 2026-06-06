'use strict';

const appConfig = require('../config/app.config');

/**
 * Trả về JSON thành công chuẩn
 * @param {Response} res - Express response object
 * @param {Object} data - Dữ liệu trả về
 * @param {string} message - Message cho client
 * @param {number} statusCode - HTTP status (default: 200)
 */
function success(res, data = {}, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trả về JSON lỗi chuẩn
 * @param {Response} res
 * @param {string} message - Message hiển thị cho user
 * @param {number} statusCode - HTTP status (default: 500)
 * @param {Object|Array} errors - Chi tiết lỗi validation
 */
function error(res, message = 'Lỗi hệ thống', statusCode = 500, errors = null) {
  const body = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };
  if (errors) body.errors = errors;
  
  // Log lỗi chi tiết ở server (không gửi về client)
  if (statusCode >= 500 && appConfig.log.enableStack) {
    console.error(`[ERROR ${statusCode}] ${message}`, errors);
  }
  
  return res.status(statusCode).json(body);
}

/**
 * Set flash message vào session rồi redirect (cho EJS views)
 * @param {Request} req
 * @param {Response} res
 * @param {'success'|'error'|'warning'} type
 * @param {string} message
 * @param {string} redirectUrl
 */
function flashRedirect(req, res, type, message, redirectUrl) {
  req.session.flash = { type, message, timestamp: Date.now() };
  return res.redirect(redirectUrl);
}

/**
 * Trả về pagination response chuẩn
 * @param {Response} res
 * @param {Array} data - Danh sách bản ghi
 * @param {Object} meta - Kết quả từ paginate().meta(total)
 * @param {string} message
 */
function paginated(res, data, meta, message = 'OK') {
  return success(res, { items: data, ...meta }, message, 200);
}

module.exports = { success, error, flashRedirect, paginated };
'use strict';

const { MSG } = require('../constants/messages');

/**
 * Middleware xử lý 404 - Route không tồn tại
 * Đặt CUỐI CÙNG sau tất cả routes
 * Traceability: NFP-UX
 */
function notFoundHandler(req, res, next) {
  // API request → JSON response
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(404).json({
      success: false,
      message: MSG.GENERAL.NOT_FOUND,
      path: req.originalUrl,
      errorCode: 'ROUTE_NOT_FOUND',
    });
  }
  
  // Browser request → Render 404 page
  res.status(404).render('errors/404', {
    title: 'Không tìm thấy trang',
    url: req.originalUrl,
    referer: req.get('referer'),
  });
}

module.exports = { notFoundHandler };
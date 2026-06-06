'use strict';

const appConfig = require('../config/app.config');

/**
 * Global error handling middleware
 * Catch all unhandled errors, log appropriately, send consistent response
 * Must be defined AFTER all routes, with 4 parameters (err, req, res, next)
 * Traceability: NFP-Reliability, NFP-UX
 */
function errorHandler(err, req, res, next) {
  // Default error values
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Lỗi hệ thống. Vui lòng thử lại sau.';
  let errors = null;
  let errorCode = err.code || 'INTERNAL_ERROR';
  
  // Log error with context (dev mode only for stack trace)
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  const logData = {
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
  
  if (appConfig.log.enableStack && err.stack) {
    console[logLevel](`[${errorCode}] ${message}`, { ...logData, stack: err.stack });
  } else {
    console[logLevel](`[${errorCode}] ${message}`, logData);
  }
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Mongoose validation (nếu dùng sau này)
    statusCode = 400;
    errors = Object.values(err.errors).map(e => e.message);
  }
  
  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    // MySQL duplicate key
    statusCode = 409;
    message = 'Dữ liệu đã tồn tại. Vui lòng kiểm tra lại.';
    errorCode = 'DUPLICATE_ENTRY';
  }
  
  if (err.code === 'ER_NO_REFERENCED_ROW' || err.errno === 1452) {
    // MySQL foreign key violation
    statusCode = 400;
    message = 'Thao tác không hợp lệ: tham chiếu đến dữ liệu không tồn tại.';
    errorCode = 'FOREIGN_KEY_VIOLATION';
  }
  
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ.';
    errorCode = 'INVALID_TOKEN';
  }
  
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn. Vui lòng đăng nhập lại.';
    errorCode = 'TOKEN_EXPIRED';
  }
  
  // Prepare response
  const responseBody = {
    success: false,
    message,
    errorCode,
    timestamp: new Date().toISOString(),
  };
  
  // Include errors detail if available
  if (errors) responseBody.errors = errors;
  
  // Include stack trace ONLY in development for debugging
  if (appConfig.log.enableStack && err.stack && statusCode >= 500) {
    responseBody.debug = {
      stack: err.stack.split('\n').slice(0, 10), // First 10 lines
      originalError: err.originalError?.message,
    };
  }
  
  // Send response based on request type
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(statusCode).json(responseBody);
  } else {
    // Render error page for browser requests
    res.locals.error = responseBody;
    res.locals.statusCode = statusCode;
    res.render('errors/500', {
      title: 'Lỗi hệ thống',
      message: statusCode === 404 ? 'Không tìm thấy trang' : message,
      showStack: appConfig.log.enableStack && statusCode >= 500,
      stack: err.stack,
    });
  }
}

/**
 * Async handler wrapper: catch promise rejections in async route handlers
 * Avoids try/catch boilerplate in controllers
 * 
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/users', asyncHandler(UserController.list));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
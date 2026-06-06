'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { nanoid } = require('nanoid');
const appConfig = require('../config/app.config');

/**
 * Cấu hình storage: lưu file với tên ngẫu nhiên, giữ extension gốc
 * Đảm bảo unique filename, tránh collision
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dest = appConfig.upload.dest;
    try {
      // Ensure upload directory exists
      await fs.mkdir(dest, { recursive: true });
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${nanoid(12)}${ext}`;
    cb(null, uniqueName);
  },
});

/**
 * File filter: chỉ chấp nhận image types cấu hình trong .env
 */
function fileFilter(req, file, cb) {
  const allowed = appConfig.upload.allowedTypes;
  const mimetype = file.mimetype;
  
  if (allowed.includes(mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Loại file không được hỗ trợ. Chỉ chấp nhận: ${allowed.join(', ')}`));
  }
}

/**
 * Limits: file size, number of files
 */
const limits = {
  fileSize: appConfig.upload.maxFileSizeMB * 1024 * 1024, // MB → bytes
  files: 1, // Single file upload cho product image
};

// Create multer instance
const upload = multer({ storage, fileFilter, limits });

/**
 * Middleware upload single image với error handling
 * @param {string} fieldName - Name of the form field (e.g., 'image')
 * @returns {Function} Express middleware
 */
function uploadImage(fieldName = 'image') {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        // Multer error
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File quá lớn. Tối đa ${appConfig.upload.maxFileSizeMB}MB.`,
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            message: 'Số lượng file vượt quá giới hạn.',
          });
        }
        // Custom error from fileFilter
        return res.status(400).json({
          success: false,
          message: err.message || 'Lỗi upload file.',
        });
      }
      next();
    });
  };
}

/**
 * Middleware upload multiple images (cho gallery)
 * @param {string} fieldName
 * @param {number} maxCount
 */
function uploadImages(fieldName = 'images', maxCount = 5) {
  const multiUpload = multer({ storage, fileFilter, limits: { ...limits, files: maxCount } });
  
  return (req, res, next) => {
    multiUpload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: `File quá lớn. Tối đa ${appConfig.upload.maxFileSizeMB}MB.`,
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'Lỗi upload file.',
        });
      }
      next();
    });
  };
}

/**
 * Helper: Xóa file upload khi update/delete product
 * @param {string} filename - Tên file (không bao gồm path)
 */
async function deleteUploadedFile(filename) {
  if (!filename) return;
  
  const filePath = path.join(appConfig.upload.dest, filename);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    // Ignore if file not found (already deleted)
    if (err.code !== 'ENOENT') {
      console.warn('[Upload] Failed to delete file:', filename, err.message);
    }
  }
}

module.exports = {
  uploadImage,
  uploadImages,
  deleteUploadedFile,
  storage, // Export để custom nếu cần
};
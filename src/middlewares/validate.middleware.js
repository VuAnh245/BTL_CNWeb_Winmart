'use strict';

const { MSG } = require('../constants/messages');
const { deleteUploadedFile } = require('./upload.middleware');

/**
 * Wrapper middleware cho Joi validation schemas
 * Hỗ trợ tự động dọn rác (file upload) nếu validation thất bại.
 * Xử lý linh hoạt response trả về dựa trên header Accept (JSON vs HTML).
 * 
 * @param {Object} schema - Joi schema (vd: { body: mySchema })
 * @returns {Function} Express middleware
 */
function validate(schema, options = {}) {
    const config = {
        abortEarly: false,
        convert: true,
        allowUnknown: true, // Cho phép các trường không khai báo để tránh lỗi cứng nhắc
        ...options
    };

    return async (req, res, next) => {
        try {
            const validated = {};

            if (schema.params) validated.params = await schema.params.validateAsync(req.params, config);
            if (schema.query) validated.query = await schema.query.validateAsync(req.query, config);
            if (schema.body) validated.body = await schema.body.validateAsync(req.body, config);

            // Gán lại dữ liệu đã qua Joi parse (convert kiểu)
            Object.assign(req, validated);
            next();

        } catch (err) {
            if (err.isJoi) {
                // Xóa file rác nếu upload trước đó bằng multer
                if (req.file && req.file.filename) {
                    await deleteUploadedFile(req.file.filename);
                }
                if (req.files && Array.isArray(req.files)) {
                    for (const f of req.files) {
                        await deleteUploadedFile(f.filename);
                    }
                }

                const errorMessages = err.details.map(detail => detail.message);

                // Nhận diện AJAX vs Form thông thường
                const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

                if (isAjax) {
                    return res.status(400).json({
                        success: false,
                        message: errorMessages.join('<br>')
                    });
                } else {
                    req.flash('error', errorMessages.join(' | '));
                    return res.redirect('back');
                }
            }
            next(err);
        }
    };
}

module.exports = { validate };
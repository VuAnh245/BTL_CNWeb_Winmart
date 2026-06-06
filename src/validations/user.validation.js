'use strict';

const Joi = require('joi');

const userSchema = {
    // Dành cho Nhân viên (Staff/Admin)
    staffCreate: {
        body: Joi.object({
            HoTen: Joi.string().trim().max(100).required().messages({
                'string.empty': 'Họ tên không được để trống',
                'string.max': 'Họ tên tối đa 100 ký tự',
                'any.required': 'Họ tên là bắt buộc'
            }),
            TenDangNhap: Joi.string().trim().max(50).pattern(/^[a-zA-Z0-9_]+$/).required().messages({
                'string.empty': 'Tên đăng nhập không được để trống',
                'string.max': 'Tên đăng nhập tối đa 50 ký tự',
                'string.pattern.base': 'Tên đăng nhập chỉ được chứa chữ, số và dấu gạch dưới',
                'any.required': 'Tên đăng nhập là bắt buộc'
            }),
            MatKhau: Joi.string().min(6).required().messages({
                'string.min': 'Mật khẩu phải dài ít nhất 6 ký tự',
                'any.required': 'Mật khẩu là bắt buộc'
            }),
            VaiTro: Joi.string().valid('STAFF', 'ADMIN').required().messages({
                'any.only': 'Vai trò không hợp lệ'
            }),
            SoDienThoai: Joi.string().trim().pattern(/^0\d{9}$/).allow('', null).messages({
                'string.pattern.base': 'Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số'
            }),
            Email: Joi.string().trim().email().max(100).allow('', null).messages({
                'string.email': 'Email không đúng định dạng',
                'string.max': 'Email tối đa 100 ký tự'
            })
        })
    },
    staffUpdate: {
        body: Joi.object({
            HoTen: Joi.string().trim().max(100).required().messages({
                'string.empty': 'Họ tên không được để trống',
                'string.max': 'Họ tên tối đa 100 ký tự',
                'any.required': 'Họ tên là bắt buộc'
            }),
            VaiTro: Joi.string().valid('STAFF', 'ADMIN').required().messages({
                'any.only': 'Vai trò không hợp lệ'
            }),
            SoDienThoai: Joi.string().trim().pattern(/^0\d{9}$/).allow('', null).messages({
                'string.pattern.base': 'Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số'
            }),
            Email: Joi.string().trim().email().max(100).allow('', null).messages({
                'string.email': 'Email không đúng định dạng',
                'string.max': 'Email tối đa 100 ký tự'
            }),
            // Mat khau khong bat buoc khi update
            MatKhau: Joi.string().min(6).allow('', null).messages({
                'string.min': 'Mật khẩu mới phải dài ít nhất 6 ký tự'
            })
        })
    },

    // Dành cho Khách hàng (Customer)
    customerCreate: {
        body: Joi.object({
            HoTen: Joi.string().trim().max(100).required().messages({
                'string.empty': 'Họ tên không được để trống',
                'string.max': 'Họ tên tối đa 100 ký tự',
                'any.required': 'Họ tên là bắt buộc'
            }),
            SoDienThoai: Joi.string().trim().pattern(/^0\d{9}$/).required().messages({
                'string.pattern.base': 'Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số',
                'any.required': 'Số điện thoại là bắt buộc'
            }),
            Email: Joi.string().trim().email().max(100).allow('', null).messages({
                'string.email': 'Email không đúng định dạng',
                'string.max': 'Email tối đa 100 ký tự'
            }),
            MatKhau: Joi.string().min(6).required().messages({
                'string.min': 'Mật khẩu phải dài ít nhất 6 ký tự',
                'any.required': 'Mật khẩu là bắt buộc'
            })
        })
    },
    customerUpdate: {
        body: Joi.object({
            HoTen: Joi.string().trim().max(100).required().messages({
                'string.empty': 'Họ tên không được để trống',
                'string.max': 'Họ tên tối đa 100 ký tự',
                'any.required': 'Họ tên là bắt buộc'
            }),
            SoDienThoai: Joi.string().trim().pattern(/^0\d{9}$/).required().messages({
                'string.pattern.base': 'Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số',
                'any.required': 'Số điện thoại là bắt buộc'
            }),
            Email: Joi.string().trim().email().max(100).allow('', null).messages({
                'string.email': 'Email không đúng định dạng',
                'string.max': 'Email tối đa 100 ký tự'
            }),
            MatKhau: Joi.string().min(6).allow('', null).messages({
                'string.min': 'Mật khẩu mới phải dài ít nhất 6 ký tự'
            })
        })
    }
};

module.exports = userSchema;

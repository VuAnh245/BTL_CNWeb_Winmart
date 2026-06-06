const Joi = require('joi');
const { MSG } = require('../constants/messages');

const authValidation = {
    login: {
        body: Joi.object({
            identifier: Joi.string().required().messages({
                'string.empty': 'Vui lòng nhập Email, SĐT hoặc Tên đăng nhập',
                'any.required': 'Vui lòng nhập Email, SĐT hoặc Tên đăng nhập'
            }),
            password: Joi.string().required().messages({
                'string.empty': 'Vui lòng nhập mật khẩu',
                'any.required': 'Vui lòng nhập mật khẩu'
            }),
            rememberMe: Joi.any(),
            isAjax: Joi.any()
        })
    },

    register: {
        body: Joi.object({
            fullName: Joi.string().min(2).required().messages({
                'string.empty': 'Vui lòng nhập họ và tên',
                'string.min': 'Họ và tên phải có ít nhất 2 ký tự',
                'any.required': 'Vui lòng nhập họ và tên'
            }),
            phone: Joi.string().pattern(/^0[3|5|7|8|9]\d{8}$/).required().messages({
                'string.empty': 'Vui lòng nhập số điện thoại',
                'string.pattern.base': 'Số điện thoại không hợp lệ (VD: 0912345678)',
                'any.required': 'Vui lòng nhập số điện thoại'
            }),
            email: Joi.string().email().allow('', null).messages({
                'string.email': 'Email không hợp lệ'
            }),
            password: Joi.string().min(6).required().messages({
                'string.empty': 'Vui lòng nhập mật khẩu',
                'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
                'any.required': 'Vui lòng nhập mật khẩu'
            }),
            confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
                'any.only': 'Mật khẩu xác nhận không khớp',
                'any.required': 'Vui lòng xác nhận mật khẩu'
            })
        })
    }
};

module.exports = authValidation;

'use strict';

const Joi = require('joi');

const supplierSchema = {
    create: {
        body: Joi.object({
            TenNhaCungCap: Joi.string().trim().max(100).required().messages({
                'string.empty': 'Tên nhà cung cấp không được để trống',
                'string.max': 'Tên nhà cung cấp tối đa 100 ký tự',
                'any.required': 'Tên nhà cung cấp là bắt buộc'
            }),
            SoDienThoai: Joi.string().trim().pattern(/^0\d{9}$/).allow('', null).messages({
                'string.pattern.base': 'Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số'
            }),
            Email: Joi.string().trim().email().max(100).allow('', null).messages({
                'string.email': 'Email không đúng định dạng',
                'string.max': 'Email tối đa 100 ký tự'
            }),
            DiaChi: Joi.string().trim().max(255).allow('', null).messages({
                'string.max': 'Địa chỉ tối đa 255 ký tự'
            }),
            MaSoThue: Joi.string().trim().max(20).pattern(/^[a-zA-Z0-9]+$/).allow('', null).messages({
                'string.max': 'Mã số thuế tối đa 20 ký tự',
                'string.pattern.base': 'Mã số thuế chỉ được chứa chữ và số'
            })
        })
    },
    update: {
        body: Joi.object({
            TenNhaCungCap: Joi.string().trim().max(100).required().messages({
                'string.empty': 'Tên nhà cung cấp không được để trống',
                'string.max': 'Tên nhà cung cấp tối đa 100 ký tự',
                'any.required': 'Tên nhà cung cấp là bắt buộc'
            }),
            SoDienThoai: Joi.string().trim().pattern(/^0\d{9}$/).allow('', null).messages({
                'string.pattern.base': 'Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số'
            }),
            Email: Joi.string().trim().email().max(100).allow('', null).messages({
                'string.email': 'Email không đúng định dạng',
                'string.max': 'Email tối đa 100 ký tự'
            }),
            DiaChi: Joi.string().trim().max(255).allow('', null).messages({
                'string.max': 'Địa chỉ tối đa 255 ký tự'
            }),
            MaSoThue: Joi.string().trim().max(20).pattern(/^[a-zA-Z0-9]+$/).allow('', null).messages({
                'string.max': 'Mã số thuế tối đa 20 ký tự',
                'string.pattern.base': 'Mã số thuế chỉ được chứa chữ và số'
            })
        })
    }
};

module.exports = supplierSchema;

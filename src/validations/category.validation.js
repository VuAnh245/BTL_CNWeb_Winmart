'use strict';

const Joi = require('joi');

const categorySchema = {
    create: {
        body: Joi.object({
            TenDanhMuc: Joi.string().trim().max(100).pattern(/^[\p{L}0-9\s.,-]+$/u).required().messages({
                'string.empty': 'Tên danh mục không được để trống',
                'string.max': 'Tên danh mục không được vượt quá 100 ký tự',
                'string.pattern.base': 'Tên danh mục không được chứa ký tự đặc biệt lạ',
                'any.required': 'Tên danh mục là bắt buộc'
            }),
            MoTa: Joi.string().trim().max(255).allow('').messages({
                'string.max': 'Mô tả không được vượt quá 255 ký tự'
            })
        })
    },
    update: {
        body: Joi.object({
            TenDanhMuc: Joi.string().trim().max(100).pattern(/^[\p{L}0-9\s.,-]+$/u).required().messages({
                'string.empty': 'Tên danh mục không được để trống',
                'string.max': 'Tên danh mục không được vượt quá 100 ký tự',
                'string.pattern.base': 'Tên danh mục không được chứa ký tự đặc biệt lạ',
                'any.required': 'Tên danh mục là bắt buộc'
            }),
            MoTa: Joi.string().trim().max(255).allow('').messages({
                'string.max': 'Mô tả không được vượt quá 255 ký tự'
            })
        })
    }
};

module.exports = categorySchema;

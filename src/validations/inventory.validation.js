'use strict';

const Joi = require('joi');

const inventorySchema = {
    createReceipt: {
        body: Joi.object({
            nhaCungCapId: Joi.number().integer().required().messages({
                'number.base': 'Nhà cung cấp không hợp lệ',
                'any.required': 'Vui lòng chọn nhà cung cấp'
            }),
            ngayNhapVe: Joi.date().iso().required().messages({
                'date.format': 'Ngày nhập không đúng định dạng',
                'any.required': 'Vui lòng chọn ngày nhập'
            }),
            ghiChu: Joi.string().trim().max(500).allow('', null).messages({
                'string.max': 'Ghi chú tối đa 500 ký tự'
            }),
            items: Joi.array().items(
                Joi.object({
                    sanPhamId: Joi.number().integer().required().messages({
                        'number.base': 'Sản phẩm không hợp lệ',
                        'any.required': 'Sản phẩm là bắt buộc'
                    }),
                    soLuong: Joi.number().integer().greater(0).required().messages({
                        'number.greater': 'Số lượng nhập phải lớn hơn 0',
                        'number.base': 'Số lượng nhập phải là số nguyên',
                        'any.required': 'Vui lòng nhập số lượng'
                    }),
                    giaNhapDonVi: Joi.number().min(0).required().messages({
                        'number.min': 'Giá nhập không được âm',
                        'number.base': 'Giá nhập phải là số',
                        'any.required': 'Vui lòng nhập giá nhập'
                    }),
                    thueVAT: Joi.number().min(0).max(100).allow('', null).messages({
                        'number.min': 'Thuế VAT không được âm',
                        'number.max': 'Thuế VAT tối đa là 100%'
                    }),
                    ngayHetHan: Joi.date().iso().greater('now').allow('', null).messages({
                        'date.format': 'Ngày hết hạn không đúng định dạng',
                        'date.greater': 'Hàng hóa nhập vào không được phép đã hết hạn'
                    })
                })
            ).min(1).required().messages({
                'array.min': 'Phải nhập ít nhất 1 sản phẩm',
                'any.required': 'Danh sách sản phẩm không được trống'
            })
        })
    }
};

module.exports = inventorySchema;

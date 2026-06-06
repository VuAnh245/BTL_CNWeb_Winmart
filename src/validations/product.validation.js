'use strict';

const Joi = require('joi');

const productBodySchema = Joi.object({
    TenSanPham: Joi.string().trim().max(255).pattern(/^[\p{L}0-9\s.,-]+$/u).required().messages({
        'string.empty': 'Tên sản phẩm không được để trống',
        'string.max': 'Tên sản phẩm tối đa 255 ký tự',
        'string.pattern.base': 'Tên sản phẩm không được chứa ký tự đặc biệt lạ',
        'any.required': 'Tên sản phẩm là bắt buộc'
    }),
    DanhMucId: Joi.number().integer().required().messages({
        'number.base': 'Danh mục không hợp lệ',
        'any.required': 'Vui lòng chọn danh mục'
    }),
    NhaCungCapId: Joi.number().integer().required().messages({
        'number.base': 'Nhà cung cấp không hợp lệ',
        'any.required': 'Vui lòng chọn nhà cung cấp'
    }),
    DonViTinh: Joi.string().trim().max(20).pattern(/^[\p{L}\s]+$/u).required().messages({
        'string.empty': 'Đơn vị tính không được để trống',
        'string.max': 'Đơn vị tính tối đa 20 ký tự',
        'string.pattern.base': 'Đơn vị tính không được chứa số hoặc ký tự đặc biệt',
        'any.required': 'Đơn vị tính là bắt buộc'
    }),
    Barcode: Joi.string().trim().max(50).pattern(/^[a-zA-Z0-9]*$/).allow('', null).messages({
        'string.max': 'Mã vạch tối đa 50 ký tự',
        'string.pattern.base': 'Mã vạch chỉ được chứa chữ và số'
    }),
    GiaNhapGoc: Joi.number().greater(0).required().messages({
        'number.greater': 'Giá nhập gốc phải lớn hơn 0',
        'number.base': 'Giá nhập gốc phải là số',
        'any.required': 'Giá nhập gốc là bắt buộc'
    }),
    GiaBan: Joi.number().greater(0).required()
        .custom((value, helpers) => {
            const { GiaNhapGoc } = helpers.state.ancestors[0];
            if (GiaNhapGoc !== undefined && value < GiaNhapGoc) {
                return helpers.message('Giá bán không được nhỏ hơn Giá nhập gốc (bán lỗ)');
            }
            return value;
        })
        .messages({
            'number.greater': 'Giá bán phải lớn hơn 0',
            'number.base': 'Giá bán phải là số',
            'any.required': 'Giá bán là bắt buộc'
        }),
    ThueVAT: Joi.number().greater(0).max(100).required().messages({
        'number.greater': 'Thuế VAT phải lớn hơn 0',
        'number.max': 'Thuế VAT tối đa là 100%',
        'any.required': 'Vui lòng chọn mức thuế VAT'
    }),
    MucCanDat: Joi.number().integer().min(0).allow('', null).messages({
        'number.min': 'Mức cảnh báo tồn kho không được âm'
    }),
    CanNang: Joi.number().integer().min(0).allow('', null).messages({
        'number.base': 'Cân nặng phải là số nguyên',
        'number.min': 'Cân nặng không được nhỏ hơn 0'
    }),
    CanDongGoiDacBiet: Joi.any().optional(),
    TrangThai: Joi.string().valid('DangBan', 'NgungBan', 'HetHang').allow('', null).messages({
        'any.only': 'Trạng thái không hợp lệ'
    })
});

const productSchema = {
    create: {
        body: productBodySchema
    },
    update: {
        body: productBodySchema
    }
};

module.exports = productSchema;

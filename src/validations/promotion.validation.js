'use strict';

const Joi = require('joi');

const promotionBodySchema = Joi.object({
    MaCode: Joi.string().trim().max(20).pattern(/^[a-zA-Z0-9]+$/).required().messages({
        'string.empty': 'Mã khuyến mãi không được để trống',
        'string.max': 'Mã khuyến mãi tối đa 20 ký tự',
        'string.pattern.base': 'Mã khuyến mãi chỉ được chứa chữ và số, không khoảng trắng',
        'any.required': 'Mã khuyến mãi là bắt buộc'
    }),
    TenMaGiamGia: Joi.string().trim().max(100).required().messages({
        'string.empty': 'Tên khuyến mãi không được để trống',
        'string.max': 'Tên khuyến mãi tối đa 100 ký tự',
        'any.required': 'Tên khuyến mãi là bắt buộc'
    }),
    LoaiGiamGia: Joi.string().valid('PhanTram', 'GiaTri').required().messages({
        'any.only': 'Loại giảm giá không hợp lệ',
        'any.required': 'Vui lòng chọn loại giảm giá'
    }),
    GiaTri: Joi.number().greater(0).required()
        .custom((value, helpers) => {
            const { LoaiGiamGia } = helpers.state.ancestors[0];
            if (LoaiGiamGia === 'PhanTram' && value > 100) {
                return helpers.message('Giá trị phần trăm không được lớn hơn 100%');
            }
            return value;
        })
        .messages({
            'number.greater': 'Giá trị giảm phải lớn hơn 0',
            'number.base': 'Giá trị giảm phải là số',
            'any.required': 'Giá trị giảm là bắt buộc'
        }),
    PhanTramToiDa: Joi.number().min(0).max(999.99).allow('', null).messages({
        'number.min': 'Giảm tối đa không được âm',
        'number.max': 'Giảm tối đa không hợp lệ'
    }),
    GiaTriDonHangToiThieu: Joi.number().min(0).allow('', null).messages({
        'number.min': 'Đơn hàng tối thiểu không được âm'
    }),
    NgayBatDau: Joi.date().iso().required().messages({
        'date.format': 'Ngày bắt đầu không đúng định dạng',
        'any.required': 'Ngày bắt đầu là bắt buộc'
    }),
    NgayKetThuc: Joi.date().iso().greater(Joi.ref('NgayBatDau')).required().messages({
        'date.format': 'Ngày kết thúc không đúng định dạng',
        'date.greater': 'Ngày kết thúc phải lớn hơn ngày bắt đầu',
        'any.required': 'Ngày kết thúc là bắt buộc'
    }),
    GioiHanSuDung: Joi.number().integer().min(1).allow('', null).messages({
        'number.min': 'Giới hạn sử dụng phải lớn hơn hoặc bằng 1'
    }),
    TrangThai: Joi.string().valid('HieuLuc', 'HetHieuLuc', 'BiKhoa').allow('', null).messages({
        'any.only': 'Trạng thái không hợp lệ'
    })
});

const promotionSchema = {
    create: {
        body: promotionBodySchema
    },
    update: {
        body: promotionBodySchema
    }
};

module.exports = promotionSchema;

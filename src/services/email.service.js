'use strict';
const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    async init() {
        try {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
            console.log(`✅ Email Service initialized with SMTP: ${process.env.SMTP_USER}`);
        } catch (error) {
            console.error('❌ Failed to initialize Email Service:', error);
        }
    }

    /**
     * Gửi email xác nhận đơn hàng thành công
     * @param {Object} orderData Dữ liệu đơn hàng (Mã, Tổng tiền, Điểm)
     * @param {String} toEmail Địa chỉ email người nhận
     */
    async sendOrderSuccess(toEmail, orderData) {
        if (!this.transporter || !toEmail) return;

        try {
            // Render template EJS ra HTML
            const templatePath = path.join(__dirname, '../views/emails/order_success.ejs');
            const htmlContent = await ejs.renderFile(templatePath, { order: orderData });

            const mailOptions = {
                from: '"WinMart Online" <no-reply@winmart.local>',
                to: toEmail,
                subject: `Xác nhận đơn hàng #${orderData.maHoaDon} đặt thành công!`,
                html: htmlContent
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✉️ Email đơn hàng đã gửi tới: ${toEmail}`);
            console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        } catch (error) {
            console.error('❌ Error sending order success email:', error);
        }
    }
    /**
     * Gửi email khuyến mãi (Marketing)
     * @param {String} toEmail Địa chỉ email người nhận
     * @param {Object} customer Khách hàng (HoTen, DiemTichLuy, CapDoVIP)
     * @param {Object} promoData Dữ liệu mã giảm giá
     */
    async sendPromoEmail(toEmail, customer, promoData) {
        if (!this.transporter || !toEmail) return;

        try {
            // Render template EJS ra HTML
            const templatePath = path.join(__dirname, '../views/emails/promo_email.ejs');
            const htmlContent = await ejs.renderFile(templatePath, { promo: promoData, customer });

            const mailOptions = {
                from: '"WinMart Khuyến Mãi" <promo@winmart.local>',
                to: toEmail,
                subject: `🎁 Tặng bạn mã giảm giá: ${promoData.TenMaGiamGia}!`,
                html: htmlContent
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✉️ MKT Email đã gửi tới: ${toEmail}`);
        } catch (error) {
            console.error(`❌ Error sending promo email to ${toEmail}:`, error);
        }
    }

    /**
     * Gửi mật khẩu mới khi quên mật khẩu
     */
    async sendForgotPasswordEmail(toEmail, customer, newPassword) {
        if (!this.transporter || !toEmail) return;

        try {
            const templatePath = path.join(__dirname, '../views/emails/forgot_password.ejs');
            const htmlContent = await ejs.renderFile(templatePath, { customer, newPassword });

            const mailOptions = {
                from: process.env.SMTP_FROM || '"WinMart Khách Hàng" <no-reply@winmart.local>',
                to: toEmail,
                subject: `🔒 Khôi phục mật khẩu tài khoản WinMart`,
                html: htmlContent
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`✉️ Email quên mật khẩu đã gửi tới: ${toEmail}`);
        } catch (error) {
            console.error(`❌ Error sending forgot password email to ${toEmail}:`, error);
        }
    }

    /**
     * Gửi mật khẩu khi tạo tài khoản mới
     */
    async sendNewAccountEmail(toEmail, customer, password) {
        if (!this.transporter || !toEmail) return;

        try {
            const templatePath = path.join(__dirname, '../views/emails/new_account.ejs');
            const htmlContent = await ejs.renderFile(templatePath, { customer, password });

            const mailOptions = {
                from: process.env.SMTP_FROM || '"WinMart Khách Hàng" <no-reply@winmart.local>',
                to: toEmail,
                subject: `👋 Chào mừng đến với Hệ thống WinMart!`,
                html: htmlContent
            };

            await this.transporter.sendMail(mailOptions);
            console.log(`✉️ Email tài khoản mới đã gửi tới: ${toEmail}`);
        } catch (error) {
            console.error(`❌ Error sending new account email to ${toEmail}:`, error);
        }
    }
}

module.exports = new EmailService();

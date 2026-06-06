'use strict';
const emailService = require('./email.service');

class EmailQueueService {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        // Batch size: số lượng email gửi trong 1 lượt
        this.batchSize = 5;
        // Delay between batches (ms)
        this.delayMs = 3000; 

        this.stats = {
            totalAdded: 0,
            totalSent: 0,
            totalFailed: 0
        };

        // Khởi chạy worker chạy ngầm
        this.startWorker();
    }

    /**
     * Thêm hàng loạt khách hàng vào hàng đợi
     * @param {Array} customers Danh sách khách hàng [{Email, HoTen}]
     * @param {Object} promoData Dữ liệu mã giảm giá
     */
    addPromoBroadcast(customers, promoData) {
        customers.forEach(customer => {
            if (customer.Email) {
                this.queue.push({
                    type: 'promo',
                    toEmail: customer.Email,
                    customer: customer,
                    promoData: promoData
                });
            }
        });
        this.stats.totalAdded += customers.length;
        console.log(`📥 [EMAIL QUEUE] Đã thêm ${customers.length} email vào hàng đợi. Tổng: ${this.queue.length}`);
    }

    async processQueue() {
        if (this.queue.length === 0) return;
        this.isProcessing = true;

        const batch = this.queue.splice(0, this.batchSize);
        console.log(`⏳ [EMAIL QUEUE] Đang xử lý lô ${batch.length} email... (Còn lại: ${this.queue.length})`);

        for (const job of batch) {
            if (job.type === 'promo') {
                try {
                    await emailService.sendPromoEmail(job.toEmail, job.customer, job.promoData);
                    this.stats.totalSent++;
                } catch (err) {
                    console.error(`❌ [EMAIL QUEUE] Lỗi khi gửi cho ${job.toEmail}:`, err.message);
                    this.stats.totalFailed++;
                }
            }
            // Thêm một chút delay nhỏ giữa mỗi email trong lô nếu cần
            await new Promise(res => setTimeout(res, 200)); 
        }

        this.isProcessing = false;
    }

    startWorker() {
        setInterval(() => {
            if (!this.isProcessing && this.queue.length > 0) {
                this.processQueue();
            }
        }, this.delayMs);
    }
}

module.exports = new EmailQueueService();

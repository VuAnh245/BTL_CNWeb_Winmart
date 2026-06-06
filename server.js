'use strict';

// Load environment variables FIRST
require('dotenv').config();

const app = require('./app');
const { testConnection, closePool } = require('./src/config/db');
const cron = require('node-cron');
const orderService = require('./src/services/order.service');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Khởi động server theo quy trình chuẩn:
 * 1. Test DB connection
 * 2. Start HTTP server
 * 3. Register graceful shutdown handlers
 */
async function bootstrap() {
  let server;

  try {
    // 1️⃣ Test database connection trước khi nhận request
    const dbReady = await testConnection();
    if (!dbReady) {
      throw new Error('Không thể kết nối đến MySQL. Kiểm tra .env và XAMPP.');
    }
    console.log('✅ Kết nối database thành công');

    // 2️⃣ Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`🚀 WinMart POS server đang chạy tại http://localhost:${PORT}`);
      console.log(`📌 Môi trường: ${NODE_ENV}`);
      console.log(`🕐 Timezone: ${process.env.TIMEZONE || 'Asia/Ho_Chi_Minh'}`);
      if (NODE_ENV === 'development') {
        console.log(`💡 [Dev Mode] Debug logs enabled`);
      }
    });

    // 2.5️⃣ Start Background Cronjobs
    cron.schedule('0 * * * *', async () => {
      console.log('[Cron] Chạy tự động hủy đơn hàng Pending quá 24h...');
      try {
        await orderService.autoCancelPendingOrders();
      } catch (err) {
        console.error('[Cron Error] Lỗi khi hủy đơn tự động:', err);
      }
    });

    // Handle server-level errors (EADDRINUSE, EACCES...)
    server.on('error', (err) => {
      console.error('❌ Lỗi server:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`💡 Port ${PORT} đang được sử dụng. Hãy đổi PORT trong .env hoặc tắt ứng dụng khác.`);
      }
      shutdown(1);
    });

    // 3️⃣ Register graceful shutdown handlers
    const shutdown = async (exitCode = 0) => {
      console.log('⏹  Nhận tín hiệu dừng. Đang đóng kết nối...');
      
      // Đóng HTTP server
      server?.close(() => {
        console.log('✅ HTTP server đã đóng.');
      });

      // Đóng MySQL connection pool
      try {
        await closePool();
        console.log('✅ MySQL connection pool đã đóng.');
      } catch (err) {
        console.error('⚠️ Lỗi khi đóng pool:', err.message);
      }

      // Thoát process
      process.exit(exitCode);
    };

    // SIGTERM: Docker/K8s stop, hệ thống tắt
    process.on('SIGTERM', () => {
      console.log('📡 SIGTERM received');
      shutdown(0);
    });

    // SIGINT: Ctrl+C trong terminal dev
    process.on('SIGINT', () => {
      console.log('⌨️  SIGINT received (Ctrl+C)');
      shutdown(0);
    });

    // Unhandled Promise Rejection: Tránh crash silent
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection tại:', promise, 'lý do:', reason);
      // Không shutdown ngay, nhưng log để debug
    });

    // Uncaught Exception: Lỗi nghiêm trọng, nên shutdown để tránh corrupt
    process.on('uncaughtException', (err) => {
      console.error('💥 Uncaught Exception:', err.message);
      console.error(err.stack);
      shutdown(1);
    });

  } catch (err) {
    console.error('❌ Không thể khởi động server:', err.message);
    // Đảm bảo đóng pool nếu lỗi xảy ra trước khi listen
    await closePool().catch(() => {});
    process.exit(1);
  }
}

// Start application
bootstrap();
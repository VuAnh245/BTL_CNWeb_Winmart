// app.js - Express Application Configuration
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
require('dotenv').config();

const app = express();

// =============================================
// MIDDLEWARE CORE
// =============================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
  // ✅ FIX: Disable EJS view cache trong development để thấy thay đổi ngay
  app.set('view cache', false);
}

// Static files
app.use(express.static(path.join(__dirname, 'src/public')));

// =============================================
// VIEW ENGINE & LAYOUTS
// =============================================
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // Default layout cho client pages
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// =============================================
// SESSION + FLASH
// =============================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'winmart_secret_dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// ✅ FIX QUAN TRỌNG: Khởi tạo flash TRƯỚC khi đọc để đảm bảo session.flash tồn tại
app.use(flash());

// =============================================
// PASSPORT (Google OAuth)
// =============================================
const passport = require('passport');
require('./src/config/passport'); // Load Google Strategy
app.use(passport.initialize());
app.use(passport.session());

// =============================================
// GLOBAL LOCALS CHO EJS (ĐÃ FIX FLASH MESSAGE)
// =============================================
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path; // Set globally to prevent undefined errors
  
  // Cart count logic
  let cartCount = req.session.cartCount || 0;
  if (!cartCount && req.session.cart) {
      cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
      req.session.cartCount = cartCount;
  }
  res.locals.cartCount = cartCount;
  
  // Sử dụng req.flash() để lấy và XÓA message ngay lập tức
  const successMsgs = req.flash('success');
  const errorMessages = req.flash('error');
  
  // Gán vào locals để view đọc được
  res.locals.success = successMsgs.length > 0 ? successMsgs[0] : '';
  res.locals.error = errorMessages.length > 0 ? errorMessages[0] : '';
  
  // Gán API Key cho views
  res.locals.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
  
  next();
});

// =============================================
// ROUTES
// =============================================
const authRoutes = require('./src/routes/auth');
app.use('/auth', authRoutes);

// ✅ Admin routes (đã có middleware set layout trong file admin.js)
const adminRoutes = require('./src/routes/admin');
app.use('/admin', adminRoutes);

// ✅ Staff routes
const staffRoutes = require('./src/routes/staff');
app.use('/staff', staffRoutes);

// ✅ API routes
const apiRoutes = require('./src/routes/api');
app.use('/api', apiRoutes);

// Health check
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', message: 'WinMart Server Running' });
});

// ==================== CLIENT ROUTES ====================
// Bảo trì hệ thống
const maintenanceMiddleware = require('./src/middlewares/maintenance.middleware');
app.get('/maintenance', (req, res) => {
  res.render('client/maintenance', { layout: false });
});
app.use(maintenanceMiddleware);

const clientRoutes = require('./src/routes/client/index');
app.use('/', clientRoutes);

// =============================================
// ERROR HANDLERS
// =============================================
app.use((req, res) => {
  res.status(404).render('client/errors/404', {
    title: '404 - Không tìm thấy trang'
  });
});

app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).render('client/errors/500', {
    title: '500 - Lỗi Server',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Đã xảy ra lỗi hệ thống'
  });
});

module.exports = app;
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./config/db');

const app = express();

// ================= 1. Middleware พื้นฐาน =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// จัดการ Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= 2. ระบบ Session =================
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: false
    }
}));

// ================= 3. ฟังก์ชันเช็กการล็อกอิน =================
const checkAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        if (req.path.startsWith('/api') || req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ message: "กรุณาล็อกอิน" });
        }
        res.redirect('/');
    }
};

// ================= 4. API สำหรับ Check Session & Logout =================
// app.get('/me', (req, res) => {
//     if (req.session && req.session.user) {
//         res.json({
//             emp_id: req.session.user.id,
//             username: req.session.user.username,
//             emp_fname: req.session.user.fname,
//             emp_lname: req.session.user.lname,
//             role_id: req.session.user.role_id,
//             permissions: req.session.user.permissions || [],
//             emp_img: req.session.user.emp_img
//         });
//     } else {
//         res.status(401).json({ message: "ไม่ได้เข้าสู่ระบบ" });
//     }
// });

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: "Logout failed" });
        res.clearCookie('connect.sid');
        res.json({ message: "ออกจากระบบสำเร็จ" });
    });
});

// ================= 5. รวม API Routes ทั้งหมด (เอามาครบทุกตัวแล้ว) =================

// กลุ่มที่ไม่ต้อง Login ก็เข้าได้ (เช่น หน้า Login)
app.use('/login', require('./routes/loginRoutes'));

// กลุ่มที่ต้อง Login ก่อน (ติด checkAuth ทั้งหมด)
app.use('/home', checkAuth, require('./routes/homeRoutes'));
app.use('/auth', require('./routes/authRoutes'));
app.use('/approve', checkAuth, require('./routes/approveRoutes'));
app.use('/permission-init', require('./routes/permissionInitRoutes')); // สำหรับ setup ครั้งแรก
app.use('/bom', checkAuth, require('./routes/bomRoutes'));
app.use('/employees', checkAuth, require('./routes/employeeRoutes'));
app.use('/layout', checkAuth, require('./routes/layoutRoutes'));
app.use('/permissions', checkAuth, require('./routes/manage_permissionsRoutes'));
app.use('/materials', checkAuth, require('./routes/materialsRoutes'));
app.use('/products', checkAuth, require('./routes/productsRoutes'));
app.use('/purchase', checkAuth, require('./routes/purchaseRoutes'));
app.use('/qc', checkAuth, require('./routes/qcRoutes'));
app.use('/roles', checkAuth, require('./routes/roleRoutes'));
app.use('/sidebar', checkAuth, require('./routes/sidebarRoutes'));
app.use('/stock-summary', checkAuth, require('./routes/stock_summaryRoutes'));
app.use('/stock', checkAuth, require('./routes/stockRoutes'));
app.use('/transactions', checkAuth, require('./routes/transactionsRoutes'));

// ================= 6. Page Routes (ส่งไฟล์ HTML) =================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
});

// ================= 7. Global Error Handler =================
app.use((err, req, res, next) => {
    console.error('❌ SERVER ERROR:', err.stack);
    res.status(500).json({
        status: 'error',
        message: 'เกิดข้อผิดพลาดภายในระบบ!'
    });
});

// ================= 8. Start Server =================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 ERP SYSTEM ONLINE AT http://localhost:${PORT}`);
});

// cd "E:\6511130008\ICE Project2.0\src"
// node server.js
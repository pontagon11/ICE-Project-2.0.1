const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * [POST] /login 
 * ตรวจสอบ User, Password และดึงสิทธิ์การใช้งานเก็บลง Session
 */
router.post("/", async (req, res) => {
    const { username, password } = req.body;

    try {
        // 1. ตรวจสอบ User และดึงข้อมูล Role
        const userRes = await pool.query(`
            SELECT e.*, r.role_name 
            FROM public.employees e
            JOIN public.roles r ON e.role_id = r.role_id
            WHERE e.emp_username = $1 AND e.status = 'active'
        `, [username]);

        if (userRes.rows.length === 0) {
            return res.status(401).json({ message: "ไม่พบชื่อผู้ใช้งาน หรือบัญชีถูกระงับ" });
        }

        const user = userRes.rows[0];

        // 2. เช็ค Password (เปรียบเทียบตรงๆ ตามโครงสร้างที่คุณใช้)
        if (password !== user.emp_password) {
            return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
        }

        // 3. 🆕 ดึง Permissions ทั้งหมดของ Role นี้มาเป็น Array ของชื่อสิทธิ์
        const permRes = await pool.query(`
            SELECT p.perm_name 
            FROM public.role_permissions rp
            JOIN public.permissions p ON rp.perm_id = p.perm_id
            WHERE rp.role_id = $1
        `, [user.role_id]);

        // แปลงผลลัพธ์เป็น Array เช่น ['view_dashboard', 'view_stock']
        const permsArray = permRes.rows.map(row => row.perm_name);

        // 4. ✅ บันทึกข้อมูลลง Session (สำคัญมาก: ต้องมี permissions เพื่อให้หน้า Home ไม่เด้ง)
        req.session.user = {
            id: user.emp_id,
            username: user.emp_username,
            role_id: user.role_id,
            fname: user.emp_fname,
            lname: user.emp_lname,
            permissions: permsArray,
            emp_img: user.emp_img
        };

        // 5. บันทึก Login Log
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await pool.query(
            "INSERT INTO public.login_logs (emp_id, login_time, ip_address) VALUES ($1, NOW(), $2)",
            [user.emp_id, ip]
        );

        // 6. ส่งข้อมูลกลับไปให้ login.js 
        req.session.save((err) => {
            if (err) {
                console.error("Session Save Error:", err);
                return res.status(500).json({ message: "ไม่สามารถบันทึกเซสชันได้" });
            }
            res.json({
                username: user.emp_username,
                role_id: user.role_id,
                role: user.role_name,
                emp_fname: user.emp_fname,
                emp_lname: user.emp_lname,
                emp_img: user.emp_img,
                permissions: permsArray // ส่งไปให้หน้าบ้านเก็บลง localStorage ทันที
            });
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์: " + err.message });
    }
});

/**
 * [GET] /check-status
 * ตรวจสอบว่าถ้า Login ค้างไว้แล้วให้ข้ามหน้า Login ไปหน้า Home
 */
router.get("/check-status", (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, redirect: 'home.html' });
    } else {
        res.json({ loggedIn: false });
    }
});

/**
 * [GET] /history
 * ดึงประวัติการ Login 10 รายการล่าสุด
 */
router.get("/history", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, e.emp_fname, e.emp_lname 
            FROM public.login_logs l
            JOIN public.employees e ON l.emp_id = e.emp_id
            ORDER BY l.login_time DESC 
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("History Error:", err);
        res.status(500).json({ message: "ไม่สามารถดึงประวัติการเข้าใช้งานได้" });
    }
});

module.exports = router;
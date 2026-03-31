const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// [POST] LOGIN
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // ค้นหาพนักงาน พร้อมดึงชื่อ Role มาด้วยเพื่อใช้โชว์ที่หน้าบ้าน
        const result = await pool.query(`
            SELECT e.*, r.role_name 
            FROM employees e
            LEFT JOIN roles r ON e.role_id = r.role_id
            WHERE e.emp_username = $1
        `, [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" });
        }

        const user = result.rows[0];

        // ตรวจสอบรหัสผ่าน (ถ้าใช้การ Hash ควรใช้ bcrypt.compare)
        if (user.emp_password !== password) {
            return res.status(401).json({ message: "รหัสผ่านไม่ถูกต้อง" });
        }

        // บันทึกข้อมูลลงใน Session (ปรับให้ชื่อฟิลด์ตรงกับ sidebarRoutes ที่เราแก้ไป)
        req.session.user = {
            id: user.emp_id,
            username: user.emp_username,
            fname: user.emp_fname,
            lname: user.emp_lname,
            emp_img: user.emp_img,
            role: user.role_id,
            role_name: user.role_name
        };

        // บังคับให้ save session ก่อนตอบกลับ (ป้องกันปัญหา session ไม่ทันบันทึกแต่ redirect แล้ว)
        req.session.save((err) => {
            if (err) throw err;
            res.json({
                status: "success",
                message: "เข้าสู่ระบบสำเร็จ",
                user: req.session.user
            });
        });

    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ message: "เกิดข้อผิดพลาดทางเทคนิค" });
    }
});

// [GET] CHECK SESSION (Me)
router.get("/me", async (req, res) => {
    // 1. ต้องใช้ && เพื่อเช็คว่ามีทั้ง session และ user จริงๆ
    if (req.session && req.session.user) {
        try {
            // 2. ดึง Role ID ออกมา (รองรับทั้งชื่อ role และ role_id)
            const roleId = req.session.user.role || req.session.user.role_id;

            // 3. Query ดึงชื่อสิทธิ์
            // Admin (role_id=1) gets ALL permissions
            let permsArray;
            if (roleId === 1 || roleId === '1') {
                const allPerms = await pool.query(`SELECT perm_name FROM public.permissions`);
                permsArray = allPerms.rows.map(row => row.perm_name);
            } else {
                const permsResult = await pool.query(`
                    SELECT p.perm_name 
                    FROM public.role_permissions rp
                    JOIN public.permissions p ON rp.perm_id = p.perm_id
                    WHERE rp.role_id = $1
                `, [roleId]);
                permsArray = permsResult.rows.map(row => row.perm_name);
            }

            res.json({
                loggedIn: true,
                emp_id: req.session.user.id,
                emp_username: req.session.user.username,
                emp_fname: req.session.user.fname || "",
                emp_lname: req.session.user.lname || "",
                emp_img: req.session.user.emp_img || "",
                role_id: req.session.user.role || req.session.user.role_id || 0,
                permissions: permsArray
            });
        } catch (err) {
            console.error("❌ Error fetching permissions:", err);
            res.status(500).json({ message: "Server Error" });
        }
    } else {
        // ถ้าไม่ได้ Login ให้ส่ง 401 กลับไป
        res.status(401).json({ loggedIn: false, message: "กรุณาเข้าสู่ระบบ" });
    }
});

// [POST] LOGOUT
router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: "Logout ล้มเหลว" });
        }
        res.clearCookie('connect.sid'); // ล้าง Cookie ฝั่ง Browser
        res.json({ message: "ออกจากระบบแล้ว" });
    });
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db');

// [GET] ดึงข้อมูล User สำหรับแสดงใน Layout (เช่น ชื่อและรูปโปรไฟล์ที่มุมขวาบน)
router.get("/user-profile", (req, res) => {
    if (req.session.user) {
        // ดึงข้อมูลจาก Session มาโชว์ได้เลย ไม่ต้องคิวรี DB ใหม่ทุกรอบ
        res.json({
            loggedIn: true,
            fname: req.session.user.fname,
            lname: req.session.user.lname,
            img: req.session.user.img || 'default-avatar.png',
            role_name: req.session.user.role_name
        });
    } else {
        res.status(401).json({ loggedIn: false, message: "กรุณาเข้าสู่ระบบ" });
    }
});

// [GET] ดึงเมนูตามสิทธิ์การใช้งาน (Dynamic Sidebar Menu)
// router.get("/menu", async (req, res) => {
//     if (!req.session.user) {
//         return res.status(401).json({ message: "No access" });
//     }

//     const role_id = req.session.user.role_id;

//     try {
//         const result = await pool.query(`
//             SELECT p.perm_name
//             FROM public.permissions p
//             JOIN public.role_permissions rp ON p.perm_id = rp.perm_id
//             WHERE rp.role_id = $1
//         `, [role_id]);

//         const permissions = result.rows.map(row => row.perm_name);
//         res.json(permissions);
//     } catch (err) {
//         console.error("Layout Menu Error:", err.message);
//         res.status(500).json({ message: "Error loading permissions" });
//     }
// });

// [GET] ดึงการแจ้งเตือน (Notifications) เช่น สินค้าใกล้หมด หรือ PO รออนุมัติ
router.get("/notifications", async (req, res) => {
    try {
        const lowStock = await pool.query("SELECT COUNT(*) FROM materials WHERE mat_qty <= 10");
        const pendingPO = await pool.query("SELECT COUNT(*) FROM purchase WHERE status = 'PENDING'");
        
        res.json({
            lowStockCount: lowStock.rows[0].count,
            pendingPOCount: pendingPO.rows[0].count
        });
    } catch (err) {
        res.status(500).json({ message: "Error loading notifications" });
    }
});

module.exports = router;
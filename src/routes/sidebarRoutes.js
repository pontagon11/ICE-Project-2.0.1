const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// [GET] /sidebar/get-menu - ดึงรายการเมนูตามสิทธิ์การเข้าถึง
router.get("/get-menu", async (req, res) => {
    // 1. ตรวจสอบว่า Login หรือไม่
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "กรุณาเข้าสู่ระบบ" });
    }

    const role_id = req.session.user.role; // ดึง Role ID จาก Session

    try {
        // 2. Query ดึงเมนูที่ Role นี้มีสิทธิ์ View
        const result = await pool.query(`
            SELECT 
                m.menu_id,
                m.menu_name,
                m.menu_link,
                m.menu_icon,
                m.menu_category
            FROM permissions p
            JOIN menus m ON p.menu_id = m.menu_id
            WHERE p.role_id = $1 
              AND p.can_view = true
            ORDER BY m.menu_category, m.menu_order ASC
        `, [role_id]);

        res.json(result.rows);
    } catch (err) {
        console.error('Get Menu Error:', err.message);
        res.status(500).json({ message: "ไม่สามารถดึงข้อมูลเมนูได้" });
    }
});

// [GET] /sidebar/badges - ดึงตัวเลขแจ้งเตือนสำหรับ Sidebar
router.get("/badges", async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                -- นับจำนวน PO ที่สถานะเป็น pending
                (SELECT COUNT(*) FROM purchase WHERE UPPER(status) = 'PENDING') AS pending_po,
                
                -- นับจำนวนสินค้า/วัตถุดิบที่ยอดคงเหลือ (จาก View) ต่ำกว่าเกณฑ์
                (
                    SELECT COUNT(*) 
                    FROM (
                        SELECT m.mat_id 
                        FROM materials m
                        LEFT JOIN v_stock_balance v ON m.mat_id = v.item_id AND v.item_type = 'material'
                        WHERE COALESCE(v.balance, 0) < 10
                        UNION ALL
                        SELECT p.pro_id 
                        FROM products p
                        LEFT JOIN v_stock_balance v ON p.pro_id = v.item_id AND v.item_type = 'product'
                        WHERE COALESCE(v.balance, 0) < 10
                    ) AS low_items
                ) AS low_stock_count
        `);

        res.json(stats.rows[0]);
    } catch (err) {
        console.error('Badges Error:', err.message);
        res.status(500).json({ message: "Error fetching badges" });
    }
});

// *** บรรทัดนี้สำคัญที่สุด ห้ามลืม ห้ามลบ ห้ามสะกดผิด! ***
module.exports = router;
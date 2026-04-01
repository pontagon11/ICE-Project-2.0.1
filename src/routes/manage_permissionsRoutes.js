const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { isAuthenticated } = require('../middleware/auth'); // อย่าลืมใส่ middleware กันคนนอกเข้า

// [GET] / - ดึง permissions ทั้งหมด
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT perm_id, perm_name FROM permissions ORDER BY perm_id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch permissions list error:", err);
        res.status(500).json({ message: "ไม่สามารถดึงรายการสิทธิ์ทั้งหมดได้" });
    }
});

// [GET] /roles - ดึงรายการ Roles ทั้งหมด
router.get("/roles", isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM roles ORDER BY role_id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "ไม่สามารถดึงข้อมูลสิทธิ์ได้" });
    }
});

// [GET] /role/:role_id - ดึงสิทธิ์ของ Role นั้นๆ พร้อมชื่อเมนู
router.get("/role/:role_id", isAuthenticated, async (req, res) => {
    const { role_id } = req.params;
    try {
        const result = await pool.query(`
            SELECT 
                m.menu_id, 
                m.menu_name,
                m.perm_name, -- เพื่อให้ตรงกับ hasPermission('view_stock') ในหน้าบ้าน
                COALESCE(p.can_view, false) as can_view,
                COALESCE(p.can_edit, false) as can_edit
            FROM menus m
            LEFT JOIN permissions p ON m.menu_id = p.menu_id AND p.role_id = $1
            ORDER BY m.menu_order ASC
        `, [role_id]);
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Role Perm Error:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์ของบทบาทนี้" });
    }
});

// [POST] /update - อัปเดตสิทธิ์แบบล้างแล้วเขียนใหม่ (Transaction)
router.post("/update", isAuthenticated, async (req, res) => {
    const { role_id, permissions } = req.body; 
    // โครงสร้าง permissions: [{menu_id: 1, can_view: true, can_edit: false}, ...]
    
    if (!role_id || !Array.isArray(permissions)) {
        return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. ลบสิทธิ์เก่าออกก่อน
        await client.query("DELETE FROM permissions WHERE role_id = $1", [role_id]);

        // 2. เตรียมข้อมูลสำหรับ Insert แบบรวดเดียว (Batch Insert)
        if (permissions.length > 0) {
            const menuIds = permissions.map(p => p.menu_id);
            const canViews = permissions.map(p => p.can_view);
            const canEdits = permissions.map(p => p.can_edit);

            await client.query(`
                INSERT INTO permissions (role_id, menu_id, can_view, can_edit)
                SELECT $1, * FROM UNNEST($2::int[], $3::boolean[], $4::boolean[])
            `, [role_id, menuIds, canViews, canEdits]);
        }

        await client.query("COMMIT");
        res.json({ message: "อัปเดตสิทธิ์การใช้งานเรียบร้อยแล้ว ✅" });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Update Perm Error:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกสิทธิ์" });
    } finally {
        client.release();
    }
});

module.exports = router;
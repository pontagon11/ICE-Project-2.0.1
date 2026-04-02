const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * [POST] /permission-init/setup-permissions
 * สร้างสิทธิ์ที่จำเป็นหากไม่มีในระบบ
 * ใช้เฉพาะเพื่อการ Setup แรก
 */
router.post("/setup-permissions", async (req, res) => {
    try {
        // 1. กำหนดสิทธิ์ที่ต้องการ
        const requiredPermissions = [
            "view_dashboard",
            "view_stock",
            "view_stock_summary",
            "view_materials",
            "create_purchase",
            "view_purchase",
            "edit_purchase",
            "approve_po",
            "create_products",
            "view_products",
            "edit_products",
            "create_qc",
            "view_qc",
            "view_transactions",
            "create_transactions",
            "edit_transactions",
            "create_employee",
            "view_employee",
            "edit_employee",
            "create_bom",
            "view_bom",
            "edit_bom",
            "manage_permissions",
            "create_materials",
            "edit_materials",
            "approve_qc"
        ];

        let created = 0;
        let skipped = 0;

        // 2. เช็คและสร้างสิทธิ์แต่ละตัว
        for (const permName of requiredPermissions) {
            const existCheck = await pool.query(
                "SELECT perm_id FROM public.permissions WHERE perm_name = $1",
                [permName]
            );

            if (existCheck.rows.length === 0) {
                // สร้างสิทธิ์ใหม่
                await pool.query(
                    "INSERT INTO public.permissions (perm_name) VALUES ($1)",
                    [permName]
                );
                created++;
            } else {
                skipped++;
            }
        }

        res.json({
            message: `✅ Setup สำเร็จ: ${created} สิทธิ์สร้างใหม่, ${skipped} สิทธิ์ที่มีอยู่แล้ว`,
            created,
            skipped
        });

    } catch (err) {
        console.error("Permission Setup Error:", err);
        res.status(500).json({ 
            message: "❌ เกิดข้อผิดพลาด: " + err.message 
        });
    }
});

/**
 * [POST] /permission-init/assign-permission
 * กำหนดสิทธิ์ให้กับ Role
 * Body: { role_id: 3, perm_name: "approve_po" }
 */
router.post("/assign-permission", async (req, res) => {
    const { role_id, perm_name } = req.body;

    if (!role_id || !perm_name) {
        return res.status(400).json({ 
            message: "ต้องส่ง role_id และ perm_name" 
        });
    }

    try {
        // 1. ดึง Permission ID
        const permRes = await pool.query(
            "SELECT perm_id FROM public.permissions WHERE perm_name = $1",
            [perm_name]
        );

        if (permRes.rows.length === 0) {
            return res.status(404).json({ 
                message: `ไม่พบสิทธิ์ "${perm_name}"` 
            });
        }

        const perm_id = permRes.rows[0].perm_id;

        // 2. เช็คว่ามีการกำหนดนี้อยู่แล้วหรือไม่
        const existCheck = await pool.query(
            "SELECT * FROM public.role_permissions WHERE role_id = $1 AND perm_id = $2",
            [role_id, perm_id]
        );

        if (existCheck.rows.length > 0) {
            return res.json({ 
                message: `ตัวบทบาท ID ${role_id} มีสิทธิ์ "${perm_name}" อยู่แล้ว` 
            });
        }

        // 3. เพิ่มสิทธิ์
        await pool.query(
            "INSERT INTO public.role_permissions (role_id, perm_id) VALUES ($1, $2)",
            [role_id, perm_id]
        );

        res.json({ 
            message: `✅ กำหนดสิทธิ์ "${perm_name}" ให้กับตัวบทบาท ID ${role_id} สำเร็จ` 
        });

    } catch (err) {
        console.error("Assign Permission Error:", err);
        res.status(500).json({ 
            message: "❌ เกิดข้อผิดพลาด: " + err.message 
        });
    }
});

module.exports = router;

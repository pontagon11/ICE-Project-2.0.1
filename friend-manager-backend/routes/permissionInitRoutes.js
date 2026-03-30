const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * [POST] /permission-init/setup-permissions
 * สร้างสิทธิ์ที่จำเป็นหากไม่มีในระบบ
 * ใช้เฉพาะเพื่อการ Setup แรก
 */
router.post("/setup-permissions", async (req, res) => {
    try {
        // 1. กำหนดสิทธิ์ที่ต้องการ
        const requiredPermissions = [
            { perm_name: "view_dashboard", perm_desc: "ดูหน้าแรก" },
            { perm_name: "view_stock", perm_desc: "ดูข้อมูลคลังสินค้า" },
            { perm_name: "view_stock_summary", perm_desc: "ดูสรุปคลัง" },
            { perm_name: "view_materials", perm_desc: "ดูวัตถุดิบ" },
            { perm_name: "create_purchase", perm_desc: "สร้างใบสั่งซื้อ" },
            { perm_name: "view_purchase", perm_desc: "ดูใบสั่งซื้อ" },
            { perm_name: "edit_purchase", perm_desc: "แก้ไขใบสั่งซื้อ" },
            { perm_name: "approve_po", perm_desc: "อนุมัติใบสั่งซื้อ" },
            { perm_name: "create_products", perm_desc: "สร้างสินค้า" },
            { perm_name: "view_products", perm_desc: "ดูสินค้า" },
            { perm_name: "edit_products", perm_desc: "แก้ไขสินค้า" },
            { perm_name: "create_qc", perm_desc: "สร้าง QC" },
            { perm_name: "view_qc", perm_desc: "ดู QC" },
            { perm_name: "view_transactions", perm_desc: "ดูธุรกรรม" },
            { perm_name: "create_transactions", perm_desc: "สร้างธุรกรรม" },
            { perm_name: "edit_transactions", perm_desc: "แก้ไขธุรกรรม" },
            { perm_name: "create_employee", perm_desc: "สร้างพนักงาน" },
            { perm_name: "view_employee", perm_desc: "ดูพนักงาน" },
            { perm_name: "edit_employee", perm_desc: "แก้ไขพนักงาน" },
            { perm_name: "create_bom", perm_desc: "สร้าง BOM" },
            { perm_name: "view_bom", perm_desc: "ดู BOM" },
            { perm_name: "edit_bom", perm_desc: "แก้ไข BOM" },
            { perm_name: "manage_permissions", perm_desc: "จัดการสิทธิ์" },
            { perm_name: "create_materials", perm_desc: "สร้างวัตถุดิบ" },
            { perm_name: "edit_materials", perm_desc: "แก้ไขวัตถุดิบ" }
        ];

        let created = 0;
        let skipped = 0;

        // 2. เช็คและสร้างสิทธิ์แต่ละตัว
        for (const perm of requiredPermissions) {
            const existCheck = await pool.query(
                "SELECT perm_id FROM public.permissions WHERE perm_name = $1",
                [perm.perm_name]
            );

            if (existCheck.rows.length === 0) {
                // สร้างสิทธิ์ใหม่
                await pool.query(
                    "INSERT INTO public.permissions (perm_name, perm_desc) VALUES ($1, $2)",
                    [perm.perm_name, perm.perm_desc]
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

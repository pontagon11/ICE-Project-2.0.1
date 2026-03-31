const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { isAuthenticated } = require('../middleware/auth'); // ตรวจสอบชื่อไฟล์ middleware ของคุณ

// 1. [GET] ดึงเลขที่ BOM ถัดไปอัตโนมัติ (ต้องวางไว้ก่อนที่มี :id)
router.get("/next-number", isAuthenticated, async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const prefix = `BOM-${currentYear}-`;

        const result = await pool.query(
            `SELECT bom_no FROM bom_head 
             WHERE bom_no LIKE $1 
             ORDER BY bom_no DESC LIMIT 1`,
            [`${prefix}%`]
        );

        let nextNumber = 1;
        if (result.rows.length > 0) {
            const lastBomNo = result.rows[0].bom_no;
            const parts = lastBomNo.split('-');
            const lastId = parseInt(parts[parts.length - 1]);
            nextNumber = lastId + 1;
        }

        const formattedNumber = nextNumber.toString().padStart(4, '0');
        const nextBomNo = `${prefix}${formattedNumber}`;

        res.json({ nextBomNo });
    } catch (err) {
        console.error("Next-Number Error:", err);
        res.status(500).json({ message: "ไม่สามารถรันเลขที่ BOM ได้" });
    }
});

// 2. [GET] ดึงรายการ BOM ทั้งหมด (สำหรับหน้า bom-list.js)
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                bh.bom_id, bh.bom_no, 
                p.pro_no, p.pro_name,
                bd.mat_id, m.mat_no, m.mat_name, bd.usage_qty
            FROM bom_head bh
            JOIN products p ON bh.pro_id = p.pro_id
            LEFT JOIN bom_details bd ON bh.bom_id = bd.bom_id
            LEFT JOIN materials m ON bd.mat_id = m.mat_id
            ORDER BY bh.bom_no DESC, m.mat_no ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Get All BOM Error:", err);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล BOM" });
    }
});

// 3. [GET] ดึงข้อมูล BOM รายตัว (สำหรับหน้า bom-edit.js)
router.get("/:id", isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const head = await pool.query(`
            SELECT bh.*, p.pro_no, p.pro_name 
            FROM bom_head bh 
            JOIN products p ON bh.pro_id = p.pro_id 
            WHERE bh.bom_id = $1`, [id]);

        if (head.rows.length === 0) return res.status(404).json({ message: "ไม่พบสูตรการผลิต" });

        const details = await pool.query(`
            SELECT bd.*, m.mat_no, m.mat_name 
            FROM bom_details bd 
            JOIN materials m ON bd.mat_id = m.mat_id 
            WHERE bd.bom_id = $1`, [id]);

        res.json({ ...head.rows[0], details: details.rows });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 4. [POST] บันทึกสูตรการผลิตใหม่ (สำหรับหน้า bom-add.js)
router.post("/", isAuthenticated, async (req, res) => {
    const { pro_id, details } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // รันเลข BOM No อีกครั้งที่ฝั่ง Server เพื่อความปลอดภัย
        const currentYear = new Date().getFullYear();
        const prefix = `BOM-${currentYear}-`;
        const numRes = await client.query(`SELECT bom_no FROM bom_head WHERE bom_no LIKE $1 ORDER BY bom_no DESC LIMIT 1`, [`${prefix}%`]);
        let nextNum = 1;
        if (numRes.rows.length > 0) nextNum = parseInt(numRes.rows[0].bom_no.split('-')[2]) + 1;
        const bomNo = `${prefix}${nextNum.toString().padStart(4, '0')}`;

        // บันทึกหัวสูตร
        const headRes = await client.query(
            "INSERT INTO bom_head (bom_no, pro_id, created_at) VALUES ($1, $2, NOW()) RETURNING bom_id",
            [bomNo, pro_id]
        );
        const bomId = headRes.rows[0].bom_id;

        // บันทึกรายละเอียดวัตถุดิบ
        for (let item of details) {
            await client.query(
                "INSERT INTO bom_details (bom_id, mat_id, usage_qty) VALUES ($1, $2, $3)",
                [bomId, item.mat_id, item.usage_qty]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "บันทึกสูตรการผลิตเรียบร้อยแล้ว", bom_id: bomId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("POST BOM Error:", err);
        res.status(500).json({ message: "ไม่สามารถบันทึกข้อมูลได้" });
    } finally {
        client.release();
    }
});

// 5. [PUT] แก้ไขสูตรการผลิต (สำหรับหน้า bom-edit.js)
router.put("/:id", isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { details } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // ลบรายละเอียดเดิมแล้วบันทึกใหม่
        await client.query("DELETE FROM bom_details WHERE bom_id = $1", [id]);
        
        for (let item of details) {
            await client.query(
                "INSERT INTO bom_details (bom_id, mat_id, usage_qty) VALUES ($1, $2, $3)",
                [id, item.mat_id, item.usage_qty]
            );
        }

        await client.query('COMMIT');
        res.json({ message: "แก้ไขสูตรการผลิตสำเร็จ ✅" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ message: "แก้ไขไม่สำเร็จ: " + err.message });
    } finally {
        client.release();
    }
});

// 6. [DELETE] ลบสูตรการผลิตทั้งชุด (Group Delete)
router.delete("/group/:id", isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        // เนื่องจากเราตั้ง ON DELETE CASCADE ใน Database ได้ แต่ถ้าไม่ได้ตั้ง ให้ลบสองที่
        await pool.query("DELETE FROM bom_details WHERE bom_id = $1", [id]);
        await pool.query("DELETE FROM bom_head WHERE bom_id = $1", [id]);
        res.json({ message: "ลบสูตรการผลิตสำเร็จ" });
    } catch (err) {
        res.status(500).json({ message: "ลบข้อมูลไม่สำเร็จ" });
    }
});

module.exports = router;
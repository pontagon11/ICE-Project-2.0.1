const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. [GET] ดึงข้อมูล Stock ปัจจุบัน (Current Stock Levels)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.pro_id as id,
                p.pro_name as name,
                'product' as type,
                COALESCE(p.pro_qty, 0) as stock,
                COALESCE(p.qc_status, false) as qc_status
            FROM products p
            
            UNION ALL
            
            SELECT 
                m.mat_id as id,
                m.mat_name as name,
                'material' as type,
                COALESCE(m.mat_qty, 0) as stock,
                COALESCE(m.qc_status, false) as qc_status
            FROM materials m
            
            ORDER BY name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Stock API Error:", err.message);
        res.status(500).json({ message: "ไม่สามารถดึงข้อมูลสต็อกได้" });
    }
});

// 2. [POST] บันทึกการรับเข้า/จ่ายออก (Manual Movement)
router.post("/move", async (req, res) => {
    const { item_id, item_type, move_type, qty, emp_id, remark } = req.body;
    try {
        // tra_no เป็นคอลัมน์ integer ใน DB จึงใช้ running number แบบตัวเลข
        const nextNoRes = await pool.query('SELECT COALESCE(MAX(tra_no), 0) + 1 AS next_no FROM transactions');
        const tra_no = Number(nextNoRes.rows[0].next_no);

        const result = await pool.query(
            `INSERT INTO transactions (tra_no, tra_item_id, tra_item_type, tra_type, tra_qty, emp_id, tra_note, tra_created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
            [tra_no, item_id, item_type, move_type, qty, emp_id, remark || '']
        );
        res.json({ 
            status: "success", 
            message: `บันทึกรายการ ${move_type} เรียบร้อยแล้ว`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกสต็อก" });
    }
});

// 3. [GET] ตรวจสอบยอดคงเหลือของรายการเฉพาะ (Check Balance)
router.get("/balance/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    try {
        const result = await pool.query(
            `SELECT
                COALESCE(SUM(CASE WHEN tra_type = 'IN'  THEN tra_qty ELSE 0 END), 0) -
                COALESCE(SUM(CASE WHEN tra_type = 'OUT' THEN tra_qty ELSE 0 END), 0) AS balance
             FROM transactions
             WHERE tra_item_id = $1 AND tra_item_type = $2`,
            [id, type]
        );
        const balance = result.rows.length > 0 ? result.rows[0].balance : 0;
        res.json({ item_id: id, item_type: type, balance: Number(balance) });
    } catch (err) {
        res.status(500).json({ message: "Error fetching balance" });
    }
});

module.exports = router;
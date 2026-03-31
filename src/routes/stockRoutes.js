const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// 1. [GET] ดึงข้อมูล Stock ปัจจุบัน (Current Stock Levels)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            -- ดึง Current Stock จาก Products พร้อมคำนวณจาก Transactions
            SELECT 
                p.pro_id as id,
                p.pro_name as name,
                'product' as type,
                COALESCE(
                    SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END) - 
                    SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END), 
                    0
                ) as stock,
                false as qc_status
            FROM products p
            LEFT JOIN transactions t ON p.pro_id = t.tra_item_id AND t.tra_item_type = 'product'
            GROUP BY p.pro_id, p.pro_name
            
            UNION ALL
            
            -- ดึง Current Stock จาก Materials พร้อมคำนวณจาก Transactions
            SELECT 
                m.mat_id as id,
                m.mat_name as name,
                'material' as type,
                COALESCE(
                    SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END) - 
                    SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END), 
                    0
                ) as stock,
                false as qc_status
            FROM materials m
            LEFT JOIN transactions t ON m.mat_id = t.tra_item_id AND t.tra_item_type = 'material'
            GROUP BY m.mat_id, m.mat_name
            
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
        const result = await pool.query(
            `INSERT INTO transactions (item_id, item_type, movement_type, qty, emp_id, remark, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [item_id, item_type, move_type, qty, emp_id, remark]
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
        // ใช้ View v_stock_summary ที่เราทำไว้เพื่อให้ข้อมูลแม่นยำที่สุด
        const result = await pool.query(
            `SELECT (total_in - total_out) as balance 
             FROM v_stock_summary 
             WHERE item_id = $1 AND tra_item_type = $2`,
            [id, type]
        );
        
        const balance = result.rows.length > 0 ? result.rows[0].balance : 0;
        res.json({ item_id: id, item_type: type, balance: Number(balance) });
    } catch (err) {
        res.status(500).json({ message: "Error fetching balance" });
    }
});

module.exports = router;
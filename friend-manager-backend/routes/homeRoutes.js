const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. [GET] /home/summary - ดึงตัวเลขสรุป 4 ช่องบน
router.get("/summary", async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM materials) as total_materials,
                (SELECT COALESCE(SUM(tra_qty), 0) FROM transactions WHERE tra_type = 'IN') as total_in,
                (SELECT COALESCE(SUM(balance), 0) FROM v_stock_balance) as total_balance 
            FROM (SELECT 1) AS dummy
        `);
        
        const row = stats.rows[0] || {};
        res.json({
            totalProducts: parseInt(row.total_products) || 0,
            totalMaterials: parseInt(row.total_materials) || 0,
            totalIn: parseFloat(row.total_in) || 0,
            totalOut: parseFloat(row.total_balance) || 0 
        });
    } catch (err) {
        console.error("Summary Error:", err.message);
        res.status(500).json({ message: "Server Error Summary" });
    }
});

// 2. [GET] /home/low-stock - รายการสินค้าสต็อกต่ำ
router.get("/low-stock", async (req, res) => {
    try {
        // ปรับให้ดึงจาก 'balance' และ 'item_name' ตาม View ใหม่
        const result = await pool.query(`
            SELECT item_name, balance 
            FROM v_stock_balance 
            WHERE balance < 10 
            ORDER BY balance ASC 
            LIMIT 5
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("Low Stock Error:", err.message);
        res.status(500).json({ message: "Server Error Low Stock" });
    }
});

// 3. [GET] /home/monthly - ข้อมูลกราฟแท่ง
router.get("/monthly", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                to_char(date_trunc('month', tra_created_at), 'Mon YYYY') as month_label,
                SUM(CASE WHEN tra_type = 'IN' THEN tra_qty ELSE 0 END) as in_qty,
                SUM(CASE WHEN tra_type = 'OUT' THEN tra_qty ELSE 0 END) as out_qty,
                date_trunc('month', tra_created_at) as sort_month
            FROM transactions
            GROUP BY month_label, sort_month
            ORDER BY sort_month ASC
            LIMIT 6
        `);

        res.json({
            labels: result.rows.map(r => r.month_label),
            totalIn: result.rows.map(r => r.in_qty),
            totalOut: result.rows.map(r => r.out_qty)
        });
    } catch (err) {
        console.error("Chart Error:", err.message);
        res.status(500).json({ message: "Server Error Chart Data" });
    }
});

module.exports = router;
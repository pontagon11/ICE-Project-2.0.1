const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// [GET] 1. สรุปภาพรวมสต็อกทั้งหมด (สำหรับหน้า Dashboard / Stock Summary)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                t.tra_item_id AS item_id,
                t.tra_item_type AS tra_item_type,
                COALESCE(p.pro_name, m.mat_name) AS item_name,
                SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END) AS total_in,
                SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END) AS total_out,
                (SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END) - 
                 SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END)) AS balance
            FROM transactions t
            LEFT JOIN products p ON t.tra_item_type = 'product' AND t.tra_item_id = p.pro_id
            LEFT JOIN materials m ON t.tra_item_type = 'material' AND t.tra_item_id = m.mat_id
            GROUP BY t.tra_item_id, t.tra_item_type, p.pro_name, m.mat_name
            ORDER BY tra_item_type, item_name
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "Error fetching stock summary" });
    }
});

// [GET] 2. สรุปยอดคงเหลือวัตถุดิบ + สถานะ (Material Balance & Status)
router.get("/materials", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                m.mat_id, m.mat_name, m.mat_status,
                COALESCE(v.balance, 0) as current_qty,
                CASE 
                    WHEN COALESCE(v.balance, 0) < 10 THEN 'LOW'
                    ELSE 'OK'
                END as stock_status
            FROM materials m
            LEFT JOIN v_stock_balance v ON m.mat_id = v.item_id AND v.item_type = 'material'
            ORDER BY stock_status DESC, m.mat_name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching material summary" });
    }
});

// [GET] 3. สรุปยอดสินค้าสำเร็จรูป + มูลค่าคงคลัง (Product Balance & Value)
router.get("/products", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.pro_id, p.pro_name, p.pro_price, p.pro_status,
                COALESCE(v.balance, 0) as current_qty,
                (COALESCE(v.balance, 0) * p.pro_price) as total_value
            FROM products p
            LEFT JOIN v_stock_balance v ON p.pro_id = v.item_id AND v.item_type = 'product'
            ORDER BY p.pro_name ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching product summary" });
    }
});

// [GET] 4. รายการที่ต้องสั่งเพิ่มด่วน (Reorder Point Alert)
router.get("/reorder-list", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 'material' as type, m.mat_name as name, 10 as min, 
                   COALESCE(v.balance, 0) as current
            FROM materials m
            LEFT JOIN v_stock_balance v ON m.mat_id = v.item_id AND v.item_type = 'material'
            WHERE COALESCE(v.balance, 0) < 10
            
            UNION ALL
            
            SELECT 'product' as type, p.pro_name as name, 10 as min, 
                   COALESCE(v.balance, 0) as current
            FROM products p
            LEFT JOIN v_stock_balance v ON p.pro_id = v.item_id AND v.item_type = 'product'
            WHERE COALESCE(v.balance, 0) < 10
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching reorder list" });
    }
});

module.exports = router;
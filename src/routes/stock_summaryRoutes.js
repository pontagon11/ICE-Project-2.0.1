const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// [GET] 1. สรุปภาพรวมสต็อกทั้งหมด (สำหรับหน้า Dashboard / Stock Summary)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.pro_id AS item_id,
                'product' AS tra_item_type,
                p.pro_name AS item_name,
                COALESCE(SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END), 0) AS total_in,
                COALESCE(SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END), 0) AS total_out,
                COALESCE(p.pro_qty, 0) AS balance
            FROM products p
            LEFT JOIN transactions t ON p.pro_id = t.tra_item_id AND LOWER(t.tra_item_type) = 'product'
            GROUP BY p.pro_id, p.pro_name, p.pro_qty

            UNION ALL

            SELECT 
                m.mat_id AS item_id,
                'material' AS tra_item_type,
                m.mat_name AS item_name,
                COALESCE(SUM(CASE WHEN t.tra_type = 'IN' THEN t.tra_qty ELSE 0 END), 0) AS total_in,
                COALESCE(SUM(CASE WHEN t.tra_type = 'OUT' THEN t.tra_qty ELSE 0 END), 0) AS total_out,
                COALESCE(m.mat_qty, 0) AS balance
            FROM materials m
            LEFT JOIN transactions t ON m.mat_id = t.tra_item_id AND LOWER(t.tra_item_type) = 'material'
            GROUP BY m.mat_id, m.mat_name, m.mat_qty

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
                COALESCE(m.mat_qty, 0) as current_qty,
                CASE 
                    WHEN COALESCE(m.mat_qty, 0) <= 10 THEN 'LOW'
                    ELSE 'OK'
                END as stock_status
            FROM materials m
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
                COALESCE(p.pro_qty, 0) as current_qty,
                (COALESCE(p.pro_qty, 0) * p.pro_price) as total_value
            FROM products p
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
                   COALESCE(m.mat_qty, 0) as current
            FROM materials m
            WHERE COALESCE(m.mat_qty, 0) < 10
            
            UNION ALL
            
            SELECT 'product' as type, p.pro_name as name, 10 as min, 
                   COALESCE(p.pro_qty, 0) as current
            FROM products p
            WHERE COALESCE(p.pro_qty, 0) < 10
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching reorder list" });
    }
});

module.exports = router;
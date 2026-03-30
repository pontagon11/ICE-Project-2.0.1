const express = require('express');
const router = express.Router();
const pool = require('../db');

// [GET] 1. สรุปภาพรวมสต็อกทั้งหมด (สำหรับหน้า Dashboard / Stock Summary)
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                item_id,
                item_type AS tra_item_type,
                CASE 
                    WHEN item_type = 'material' THEN (SELECT mat_name FROM materials WHERE mat_id = item_id)
                    WHEN item_type = 'product' THEN (SELECT pro_name FROM products WHERE pro_id = item_id)
                END AS item_name,
                SUM(CASE WHEN movement_type = 'IN' THEN qty ELSE 0 END) AS total_in,
                SUM(CASE WHEN movement_type = 'OUT' THEN qty ELSE 0 END) AS total_out,
                (SUM(CASE WHEN movement_type = 'IN' THEN qty ELSE 0 END) - 
                 SUM(CASE WHEN movement_type = 'OUT' THEN qty ELSE 0 END)) AS balance
            FROM transactions
            GROUP BY item_id, item_type
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
                m.mat_id, m.mat_name, m.mat_unit, m.mat_min_qty,
                COALESCE(v.total_in - v.total_out, 0) as current_qty,
                CASE 
                    WHEN COALESCE(v.total_in - v.total_out, 0) <= m.mat_min_qty THEN 'LOW'
                    ELSE 'OK'
                END as stock_status
            FROM materials m
            LEFT JOIN (
                SELECT item_id, 
                       SUM(CASE WHEN movement_type = 'IN' THEN qty ELSE 0 END) as total_in,
                       SUM(CASE WHEN movement_type = 'OUT' THEN qty ELSE 0 END) as total_out
                FROM transactions WHERE item_type = 'material'
                GROUP BY item_id
            ) v ON m.mat_id = v.item_id
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
                p.pro_id, p.pro_name, p.pro_price, p.pro_unit,
                COALESCE(v.total_in - v.total_out, 0) as current_qty,
                (COALESCE(v.total_in - v.total_out, 0) * p.pro_price) as total_value
            FROM products p
            LEFT JOIN (
                SELECT item_id, 
                       SUM(CASE WHEN movement_type = 'IN' THEN qty ELSE 0 END) as total_in,
                       SUM(CASE WHEN movement_type = 'OUT' THEN qty ELSE 0 END) as total_out
                FROM transactions WHERE item_type = 'product'
                GROUP BY item_id
            ) v ON p.pro_id = v.item_id
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
            SELECT 'material' as type, mat_name as name, mat_min_qty as min, 
                   COALESCE(v.balance, 0) as current
            FROM materials m
            LEFT JOIN (
                SELECT item_id, SUM(CASE WHEN movement_type = 'IN' THEN qty ELSE -qty END) as balance
                FROM transactions WHERE item_type = 'material' GROUP BY item_id
            ) v ON m.mat_id = v.item_id
            WHERE COALESCE(v.balance, 0) <= m.mat_min_qty
            
            UNION ALL
            
            SELECT 'product' as type, pro_name as name, pro_min_qty as min, 
                   COALESCE(v.balance, 0) as current
            FROM products p
            LEFT JOIN (
                SELECT item_id, SUM(CASE WHEN movement_type = 'IN' THEN qty ELSE -qty END) as balance
                FROM transactions WHERE item_type = 'product' GROUP BY item_id
            ) v ON p.pro_id = v.item_id
            WHERE COALESCE(v.balance, 0) <= p.pro_min_qty
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching reorder list" });
    }
});

module.exports = router;
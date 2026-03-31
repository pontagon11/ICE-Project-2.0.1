const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// [GET] / - ดึงประวัติธุรกรรมทั้งหมดพร้อมระบบกรองข้อมูล
router.get("/", async (req, res) => {
    // รับค่าจาก Query Params
    const { startDate, endDate, itemType, moveType } = req.query;
    
    // หมายเหตุ: ปรับชื่อตารางจาก stock_movement เป็น transactions (ให้มี s ตามมาตรฐานที่เราใช้ก่อนหน้า)
    let query = `
        SELECT 
            sm.move_id,
            sm.created_at AS move_date,
            sm.movement_type AS move_type,
            sm.qty,
            sm.remark,
            sm.item_type,
            e.emp_fname || ' ' || e.emp_lname AS staff_name,
            COALESCE(p.pro_name, m.mat_name) AS item_name,
            COALESCE(p.pro_unit, m.mat_unit) AS unit
        FROM transactions sm
        LEFT JOIN employees e ON sm.emp_id = e.emp_id
        LEFT JOIN products p ON sm.item_id = p.pro_id AND sm.item_type = 'product'
        LEFT JOIN materials m ON sm.item_id = m.mat_id AND sm.item_type = 'material'
        WHERE 1=1
    `;

    const values = [];
    let counter = 1;

    // 🔍 ระบบกรองข้อมูล (Dynamic Filtering)
    if (startDate && endDate) {
        query += ` AND sm.created_at::date BETWEEN $${counter} AND $${counter + 1}`;
        values.push(startDate, endDate);
        counter += 2;
    }
    if (itemType && itemType !== 'all') {
        query += ` AND sm.item_type = $${counter}`;
        values.push(itemType);
        counter++;
    }
    if (moveType && moveType !== 'all') {
        query += ` AND sm.movement_type = $${counter}`;
        values.push(moveType);
        counter++;
    }

    query += ` ORDER BY sm.created_at DESC`;

    try {
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (err) {
        console.error("Query Error:", err.message);
        res.status(500).json({ message: "ไม่สามารถดึงข้อมูลประวัติธุรกรรมได้" });
    }
});

// [GET] /item/:type/:id - ดึงประวัติรายตัว (Stock Card)
router.get("/item/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    try {
        const result = await pool.query(`
            SELECT sm.*, e.emp_fname 
            FROM transactions sm
            JOIN employees e ON sm.emp_id = e.emp_id
            WHERE sm.item_type = $1 AND sm.item_id = $2
            ORDER BY sm.created_at DESC
        `, [type, id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching item transaction history" });
    }
});

module.exports = router;
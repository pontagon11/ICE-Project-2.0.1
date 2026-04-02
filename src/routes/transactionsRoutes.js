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
            t.tra_id,
            t.tra_type,
            t.tra_item_type,
            t.tra_item_id,
            t.tra_qty,
            t.tra_note,
            t.tra_created_at,
            t.tra_no,
            t.emp_id,
            e.emp_fname || ' ' || e.emp_lname AS staff_name,
            COALESCE(p.pro_name, m.mat_name) AS item_name,
            COALESCE(p.pro_no, m.mat_no) AS item_no
        FROM transactions t
        LEFT JOIN employees e ON t.emp_id = e.emp_id
        LEFT JOIN products p ON t.tra_item_id = p.pro_id AND LOWER(t.tra_item_type) IN ('product', 'products')
        LEFT JOIN materials m ON t.tra_item_id = m.mat_id AND LOWER(t.tra_item_type) IN ('material', 'materials')
        WHERE 1=1
    `;

    const values = [];
    let counter = 1;

    // 🔍 ระบบกรองข้อมูล (Dynamic Filtering)
    if (startDate && endDate) {
        query += ` AND t.tra_created_at::date BETWEEN $${counter} AND $${counter + 1}`;
        values.push(startDate, endDate);
        counter += 2;
    }
    if (itemType && itemType !== 'all') {
        query += ` AND t.tra_item_type = $${counter}`;
        values.push(itemType);
        counter++;
    }
    if (moveType && moveType !== 'all') {
        query += ` AND t.tra_type = $${counter}`;
        values.push(moveType);
        counter++;
    }

    query += ` ORDER BY t.tra_created_at DESC`;

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
            SELECT t.*, e.emp_fname 
            FROM transactions t
            LEFT JOIN employees e ON t.emp_id = e.emp_id
            WHERE t.tra_item_type = $1 AND t.tra_item_id = $2
            ORDER BY t.tra_created_at DESC
        `, [type, id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching item transaction history" });
    }
});

// [GET] /:id - ดึงข้อมูลธุรกรรมรายตัว (สำหรับหน้า Edit)
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM transactions WHERE tra_id = $1`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "ไม่พบข้อมูลรายการนี้" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Get transaction by ID error:", err.message);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
    }
});

// [POST] / - บันทึกธุรกรรมใหม่ + อัปเดตยอดสต็อคใน DB
router.post("/", async (req, res) => {
    const { type, itemType, itemId, qty, note } = req.body;
    const empId = req.session?.user?.id || null;

    if (!type || !itemType || !itemId || !qty || qty <= 0) {
        return res.status(400).json({ message: "กรุณาระบุข้อมูลให้ครบถ้วน" });
    }

    try {
        const nextNoRes = await pool.query("SELECT COALESCE(MAX(tra_no), 0) AS max_no FROM transactions");
        const tra_no = Number(nextNoRes.rows[0].max_no) + 1;

        await pool.query(
            `INSERT INTO transactions (tra_no, tra_item_id, tra_item_type, tra_type, tra_qty, emp_id, tra_note, tra_created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [tra_no, itemId, itemType, type, qty, empId, note || null]
        );

        // อัปเดตยอดสต็อคในตารางต้นทาง (materials/products)
        const normalType = type.toUpperCase();
        const normalItemType = itemType.toLowerCase().replace(/s$/, ''); // materials -> material

        if (normalItemType === 'material') {
            if (normalType === 'IN') {
                await pool.query('UPDATE materials SET mat_qty = COALESCE(mat_qty, 0) + $1 WHERE mat_id = $2', [qty, itemId]);
            } else if (normalType === 'OUT') {
                await pool.query('UPDATE materials SET mat_qty = COALESCE(mat_qty, 0) - $1 WHERE mat_id = $2', [qty, itemId]);
            }
        } else if (normalItemType === 'product') {
            if (normalType === 'IN') {
                await pool.query('UPDATE products SET pro_qty = COALESCE(pro_qty, 0) + $1 WHERE pro_id = $2', [qty, itemId]);
            } else if (normalType === 'OUT') {
                await pool.query('UPDATE products SET pro_qty = COALESCE(pro_qty, 0) - $1 WHERE pro_id = $2', [qty, itemId]);
            }
        }

        res.json({ message: "บันทึกรายการสำเร็จ" });
    } catch (err) {
        console.error("Insert transaction error:", err.message);
        res.status(500).json({ message: "ไม่สามารถบันทึกรายการได้: " + err.message });
    }
});

module.exports = router;
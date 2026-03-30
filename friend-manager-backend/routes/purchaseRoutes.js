const express = require('express');
const router = express.Router();
const pool = require('../db');

// --- [GET] ดึงรายการใบสั่งซื้อทั้งหมด ---
// แก้ไขส่วน [GET] / ตรงเริ่มต้น
router.get("/", async (req, res) => {
    // เช็คก่อนว่า Login หรือยัง (ป้องกัน Error ถ้า req.session.user ไม่มีค่า)
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "กรุณาเข้าสู่ระบบใหม่" });
    }

    try {
        const result = await pool.query(`
            SELECT 
                p.po_id, p.po_no, p.status, p.tra_note,
                pi.qty,
                m.mat_name,
                e.emp_fname as emp_name
            FROM purchase p
            JOIN purchase_detail pi ON p.po_id = pi.po_id
            JOIN materials m ON pi.mat_id = m.mat_id
            LEFT JOIN employees e ON p.emp_id = e.emp_id
            ORDER BY p.po_id DESC, m.mat_name ASC
        `);

        // ตรวจสอบว่ามีข้อมูลไหม ถ้าไม่มีให้ส่ง Array ว่าง (ป้องกัน forEach พัง)
        res.json(result.rows || []);

    } catch (err) {
        console.error("🔥 Database Error:", err.message);
        res.status(500).json({ message: "DB Error: " + err.message });
    }
});

// --- [GET] สร้างเลข PO ถัดไป (สำหรับหน้า purchase-add) ---
router.get("/next-po", async (req, res) => {
    try {
        const result = await pool.query("SELECT COUNT(*) FROM purchase");
        const nextId = parseInt(result.rows[0].count) + 1;
        const po_no = `PO-${new Date().getFullYear().toString().substr(-2)}${nextId.toString().padStart(4, '0')}`;
        res.json({ po_no });
    } catch (err) {
        res.json({ po_no: "AUTO" });
    }
});

// --- [POST] สร้างใบสั่งซื้อใหม่ ---
router.post("/", async (req, res) => {
    // รับแค่ emp_id, items, และ note (ตัด sup_id ออก)
    const { emp_id, items, note } = req.body;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. สร้างเลข PO อัตโนมัติ
        const countRes = await client.query("SELECT COUNT(*) FROM purchase");
        const po_no = `PO-${(parseInt(countRes.rows[0].count) + 1).toString().padStart(5, '0')}`;

        // 2. บันทึกหัวเอกสาร (ตัดคอลัมน์ sup_id ออกจาก SQL)
        const purchaseRes = await client.query(
            `INSERT INTO purchase (po_no, emp_id, status, tra_note, po_date) 
             VALUES ($1, $2, 'PENDING', $3, NOW()) RETURNING po_id`,
            [po_no, emp_id, note]
        );
        const po_id = purchaseRes.rows[0].po_id;

        // 3. บันทึกรายละเอียดลงตาราง purchase_detail (ชื่อที่ถูกต้องตาม DB คุณ)
        const itemQuery = `INSERT INTO purchase_detail (po_id, mat_id, qty) VALUES ($1, $2, $3)`;
        for (let item of items) {
            await client.query(itemQuery, [po_id, item.mat_id, item.qty]);
        }

        await client.query("COMMIT");
        res.json({ message: "สร้างใบสั่งซื้อสำเร็จ ✅", po_id });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("🔥 Insert Error:", err.message);
        res.status(500).json({ message: "ไม่สามารถสร้างใบสั่งซื้อได้: " + err.message });
    } finally {
        client.release();
    }
});

// --- [PUT] รับวัตถุดิบเข้าคลัง (หัวใจสำคัญของการอัปเดตสต็อก) ---
router.put("/receive/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. ตรวจสอบสถานะก่อน
        const checkStatus = await client.query("SELECT status FROM purchase WHERE po_id = $1", [id]);
        if (checkStatus.rows[0].status === 'RECEIVED') {
            return res.status(400).json({ message: "รายการนี้ถูกรับเข้าคลังไปแล้ว" });
        }

        // 2. อัปเดตสถานะเป็น 'received'
        await client.query("UPDATE purchase SET status = 'RECEIVED' WHERE po_id = $1", [id]);

        // 3. เพิ่มข้อมูลลง transactions (เพื่อให้ View v_stock_balance คำนวณสต็อกใหม่)
        const itemsRes = await client.query("SELECT mat_id, qty FROM purchase_detail WHERE po_id = $1", [id]);

        const moveQuery = `
            INSERT INTO transactions (item_id, item_type, movement_type, qty, ref_id) 
            VALUES ($1, 'material', 'IN', $2, $3)
        `;

        for (let item of itemsRes.rows) {
            await client.query(moveQuery, [item.mat_id, item.qty, id]);
        }

        await client.query("COMMIT");
        res.json({ message: "รับของเข้าคลังและอัปเดตสต็อกเรียบร้อย ✅" });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการรับของ" });
    } finally {
        client.release();
    }
});

module.exports = router;
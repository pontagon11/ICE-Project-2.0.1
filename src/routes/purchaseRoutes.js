const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// --- [GET] ดึงรายการใบสั่งซื้อทั้งหมด ---
// แก้ไขส่วน [GET] / ตรงเริ่มต้น
router.get("/", async (req, res) => {
    // เช็คก่อนว่า Login หรือยัง (ป้องกัน Error ถ้า req.session.user ไม่มีค่า)
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "กรุณาเข้าสู่ระบบใหม่" });
    }

    try {
        let query = `
            SELECT 
                p.po_id, p.po_no, p.status, p.tra_note,
                pi.qty,
                m.mat_name,
                e.emp_fname as emp_name
            FROM purchase p
            JOIN purchase_detail pi ON p.po_id = pi.po_id
            JOIN materials m ON pi.mat_id = m.mat_id
            LEFT JOIN employees e ON p.emp_id = e.emp_id
        `;
        const values = [];

        // รองรับ query parameter ?status= สำหรับกรองสถานะ (เช่น approved, PENDING)
        if (req.query.status) {
            query += ` WHERE UPPER(p.status) = UPPER($1)`;
            values.push(req.query.status);
        }

        query += ` ORDER BY p.po_id DESC, m.mat_name ASC`;

        const result = await pool.query(query, values);

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

// --- [GET] ดึงรายละเอียด PO เดี่ยว (ต้องอยู่หลัง /next-po เสมอ) ---
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            SELECT
                p.po_id, p.po_no, p.status, p.tra_note, p.po_date,
                pi.qty,
                m.mat_id, m.mat_name, m.mat_no,
                e.emp_fname || ' ' || COALESCE(e.emp_lname, '') AS emp_name
            FROM purchase p
            JOIN purchase_detail pi ON p.po_id = pi.po_id
            JOIN materials m ON pi.mat_id = m.mat_id
            LEFT JOIN employees e ON p.emp_id = e.emp_id
            WHERE p.po_id = $1
            ORDER BY m.mat_name ASC
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "ไม่พบใบสั่งซื้อ" });
        }
        res.json(result.rows);
    } catch (err) {
        console.error("Get PO detail error:", err.message);
        res.status(500).json({ message: "Server Error: " + err.message });
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

        // 3. เพิ่มข้อมูลลง transactions (ใช้คอลัมน์จริงของตาราง transactions)
        const itemsRes = await client.query("SELECT mat_id, qty FROM purchase_detail WHERE po_id = $1", [id]);
        const poHeadRes = await client.query("SELECT emp_id FROM purchase WHERE po_id = $1", [id]);
        const empId = poHeadRes.rows[0]?.emp_id || null;

        const nextNoRes = await client.query("SELECT COALESCE(MAX(tra_no), 0) AS max_no FROM transactions");
        let nextTraNo = Number(nextNoRes.rows[0].max_no) + 1;

        const moveQuery = `
            INSERT INTO transactions (tra_no, tra_item_id, tra_item_type, tra_type, tra_qty, emp_id, tra_note, tra_created_at)
            VALUES ($1, $2, 'material', 'IN', $3, $4, $5, NOW())
        `;

        for (let item of itemsRes.rows) {
            await client.query(moveQuery, [
                nextTraNo,
                item.mat_id,
                item.qty,
                empId,
                `Receive from PO #${id}`
            ]);
            nextTraNo += 1;
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
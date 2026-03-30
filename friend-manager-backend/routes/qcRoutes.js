const express = require('express');
const router = express.Router();
const pool = require('../db');

// --- [GET] ดึงรายการทั้งหมด (สำหรับหน้า qc.html) ---
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                q.qc_id, 
                q.qc_no, 
                q.qc_status, 
                q.qc_date, 
                q.item_type,
                e.emp_fname as emp_name,
                CASE 
                    WHEN q.item_type = 'product' THEN (SELECT pro_name FROM products WHERE pro_id = q.item_id)
                    WHEN q.item_type = 'material' THEN (SELECT mat_name FROM materials WHERE mat_id = q.item_id)
                END as name
            FROM qc_logs q
            LEFT JOIN employees e ON q.qc_by = e.emp_id
            ORDER BY q.qc_date DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching QC data" });
    }
});

// --- [GET] ดึงรายการที่รอตรวจ (Pending จาก PO) ---
router.get("/pending", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT pi.*, p.po_no, m.mat_name, p.po_date
            FROM purchase_items pi
            JOIN purchase p ON pi.po_id = p.po_id
            JOIN materials m ON pi.mat_id = m.mat_id
            WHERE pi.qc_status = 'PENDING'
            ORDER BY p.po_date ASC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error loading pending items" });
    }
});

// --- [POST] บันทึกผลการตรวจสอบ (จากหน้า qc-add.js) ---
router.post("/", async (req, res) => {
    const { item_id, item_type, emp_id, qc_note, po_id } = req.body;
    
    try {
        // สร้างเลข QC อัตโนมัติ
        const countRes = await pool.query("SELECT COUNT(*) FROM qc_logs");
        const qc_no = `QC-${new Date().getFullYear()}-${(parseInt(countRes.rows[0].count) + 1).toString().padStart(4, '0')}`;

        const result = await pool.query(
            `INSERT INTO qc_logs (qc_no, item_id, item_type, qc_status, qc_note, qc_by, po_id, qc_date) 
             VALUES ($1, $2, $3, 'wait', $4, $5, $6, NOW()) RETURNING *`,
            [qc_no, item_id, item_type, qc_note, emp_id, po_id || null]
        );

        res.json({ message: "บันทึกรายการตรวจสอบสำเร็จ", qc_id: result.rows[0].qc_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "ไม่สามารถสร้างรายการ QC ได้" });
    }
});

// --- [PUT] อัปเดตผล PASS/FAIL (จากหน้า qc.js) ---
router.put("/pass/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("UPDATE qc_logs SET qc_status = 'pass' WHERE qc_id = $1", [id]);
        res.json({ message: "Status updated to PASS" });
    } catch (err) {
        res.status(500).json({ message: "Error updating status" });
    }
});

router.put("/fail/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("UPDATE qc_logs SET qc_status = 'fail' WHERE qc_id = $1", [id]);
        res.json({ message: "Status updated to FAIL" });
    } catch (err) {
        res.status(500).json({ message: "Error updating status" });
    }
});

module.exports = router;
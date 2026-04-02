const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

// [GET] / - ดึงรายการ QC ทั้งหมด
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                q.qc_id, q.qc_no, q.qc_status, q.qc_date, q.item_type, q.item_id,
                e.emp_fname || ' ' || e.emp_lname AS emp_name,
                CASE
                    WHEN q.item_type = 'product'  THEN (SELECT pro_name FROM products  WHERE pro_id = q.item_id)
                    WHEN q.item_type = 'material' THEN (SELECT mat_name FROM materials WHERE mat_id = q.item_id)
                END AS name
            FROM qc q
            LEFT JOIN employees e ON q.emp_id = e.emp_id
            ORDER BY q.qc_date DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('GET QC Error:', err.message);
        res.status(500).json({ message: 'Error fetching QC data' });
    }
});

// [GET] /pending - ดึงรายการที่ยังไม่ผ่าน QC
router.get('/pending', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.mat_id AS item_id, 'material' AS item_type, m.mat_name AS item_name, m.mat_no AS item_no
            FROM materials m
            WHERE NOT EXISTS (SELECT 1 FROM qc WHERE item_id = m.mat_id AND item_type = 'material')
            UNION ALL
            SELECT p.pro_id, 'product', p.pro_name, p.pro_no
            FROM products p
            WHERE NOT EXISTS (SELECT 1 FROM qc WHERE item_id = p.pro_id AND item_type = 'product')
            ORDER BY item_type, item_name
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: 'Error loading pending items' });
    }
});

// [POST] / - สร้างรายการ QC ใหม่
router.post('/', isAuthenticated, async (req, res) => {
    const { item_id, item_type, emp_id, qc_note } = req.body;
    try {
        // สร้างเลข QC อัตโนมัติ
        const countRes = await pool.query('SELECT COUNT(*) FROM qc');
        const seq = parseInt(countRes.rows[0].count) + 1;
        const qc_no = `QC-${new Date().getFullYear()}-${seq.toString().padStart(4, '0')}`;

        const result = await pool.query(
            `INSERT INTO qc (qc_no, item_id, item_type, qc_status, emp_id, qc_date)
             VALUES ($1, $2, $3, 'wait', $4, NOW()) RETURNING *`,
            [qc_no, item_id, item_type, emp_id]
        );
        res.json({ message: 'บันทึกรายการตรวจสอบสำเร็จ', qc: result.rows[0] });
    } catch (err) {
        console.error('POST QC:', err.message);
        res.status(500).json({ message: err.message });
    }
});

// [PUT] /pass/:id - อัปเดตผล QC เป็น pass
router.put('/pass/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE qc SET qc_status = $1 WHERE qc_id = $2', ['pass', id]);
        res.json({ message: 'อัปเดตผล QC สำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating QC' });
    }
});

// [PUT] /fail/:id - อัปเดตผล QC เป็น fail
router.put('/fail/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('UPDATE qc SET qc_status = $1 WHERE qc_id = $2', ['fail', id]);
        res.json({ message: 'อัปเดตผล QC สำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating QC' });
    }
});

// [PUT] /:id - อัปเดตผล QC (pass / fail) - generic
router.put('/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { qc_status } = req.body;
    try {
        await pool.query(
            'UPDATE qc SET qc_status = $1 WHERE qc_id = $2',
            [qc_status, id]
        );
        res.json({ message: 'อัปเดตผล QC สำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'Error updating QC' });
    }
});

// [DELETE] /:id - ลบรายการ QC
router.delete('/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM qc WHERE qc_id = $1', [id]);
        res.json({ message: 'ลบสำเร็จ' });
    } catch (err) {
        res.status(500).json({ message: 'ลบไม่สำเร็จ' });
    }
});

module.exports = router;

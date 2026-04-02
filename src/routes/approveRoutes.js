const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { isAuthenticated } = require('../middleware/auth');

/**
 * [GET] /approve/pending
 * ดึงรายการใบสั่งซื้อตามสถานะ (รองรับ ?status= query param)
 */
router.get("/pending", isAuthenticated, async (req, res) => {
    try {
        const statusFilter = (req.query.status || 'PENDING').toUpperCase();
        
        let whereClause = 'WHERE UPPER(p.status) = $1';
        let values = [statusFilter];
        
        // ถ้าเลือก All ให้ดึงทั้งหมด
        if (!statusFilter || statusFilter === 'ALL') {
            whereClause = '';
            values = [];
        }

        const result = await pool.query(`
            SELECT 
                p.po_id, 
                p.po_no, 
                p.po_date, 
                p.status,
                p.tra_note,
                e.emp_fname || ' ' || e.emp_lname AS requester_name,
                COALESCE(SUM(pd.qty), 0) AS total_qty
            FROM purchase p
            LEFT JOIN employees e ON p.emp_id = e.emp_id
            LEFT JOIN purchase_detail pd ON p.po_id = pd.po_id
            ${whereClause}
            GROUP BY p.po_id, p.po_no, p.po_date, p.status, p.tra_note, e.emp_fname, e.emp_lname
            ORDER BY p.po_date DESC
        `, values);
        res.json(result.rows);
    } catch (err) {
        console.error("Fetch Pending Error:", err);
        res.status(500).json({ message: "ไม่สามารถดึงข้อมูลรายการรออนุมัติได้" });
    }
});

/**
 * [PUT] /approve/confirm/:id
 * อนุมัติใบสั่งซื้อ และบันทึกข้อมูลผู้อนุมัติ
 */
router.put("/confirm/:id", isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. ตรวจสอบและล็อคแถวข้อมูล (ป้องกันการอนุมัติซ้อน)
        const check = await client.query(
            "SELECT status FROM purchase WHERE po_id = $1 FOR UPDATE", 
            [id]
        );

        if (check.rows.length === 0) throw new Error("ไม่พบใบสั่งซื้อ");
        if (check.rows[0].status !== 'PENDING') throw new Error("ใบสั่งซื้อนี้ไม่อยู่ในสถานะที่อนุมัติได้");

        // 2. อัปเดตสถานะเป็น APPROVED
        await client.query(
            "UPDATE purchase SET status = 'APPROVED' WHERE po_id = $1",
            [id]
        );

        await client.query("COMMIT");
        res.json({ message: "อนุมัติใบสั่งซื้อเรียบร้อยแล้ว ✅" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Confirm Error:", err.message);
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

/**
 * [PUT] /approve/reject/:id
 * ปฏิเสธการอนุมัติ และบันทึกเหตุผล
 */
router.put("/reject/:id", isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const check = await client.query("SELECT status FROM purchase WHERE po_id = $1 FOR UPDATE", [id]);
        if (check.rows.length === 0) throw new Error("ไม่พบใบสั่งซื้อ");

        await client.query(
            "UPDATE purchase SET status = 'REJECTED', tra_note = $1 WHERE po_id = $2",
            [reason || 'ถูกปฏิเสธโดยผู้อนุมัติ', id]
        );

        await client.query("COMMIT");
        res.json({ message: "ปฏิเสธใบสั่งซื้อเรียบร้อยแล้ว ❌" });

    } catch (err) {
        await client.query("ROLLBACK");
        res.status(400).json({ message: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;
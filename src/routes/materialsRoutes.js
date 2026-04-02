const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- ตั้งค่าการอัปโหลดรูปวัตถุดิบ ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'public', 'img', 'materials');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'mat-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/* ==========================================
   API ENDPOINTS
   ========================================== */

// [GET] / - ดึงรายการพร้อมยอดคงเหลือ
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                mat_id, mat_no, mat_name, mat_qty, mat_price,
                mat_size, mat_weight, mat_status, mat_img, qc_status
            FROM materials 
            ORDER BY mat_id ASC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error("❌ SQL Error Details:", err.message);
        res.status(500).json({
            message: "เกิดข้อผิดพลาดในการดึงข้อมูลวัตถุดิบ",
            error: err.message
        });
    }
});

// [GET] /:id - ดึงข้อมูลรายตัว (ใช้ในหน้า materials-edit.html)
router.get("/:id", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM materials WHERE mat_id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "ไม่พบข้อมูล" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// [POST] / - เพิ่มวัตถุดิบใหม่
router.post("/", upload.single('mat_img'), async (req, res) => {
    const { mat_name, mat_weight, mat_price, mat_size, mat_qty, mat_status } = req.body;
    const mat_img = req.file ? req.file.filename : null;

    try {
        // สร้างรหัส MAT-XXXX อัตโนมัติ (ใช้ MAX ป้องกัน duplicate)
        const maxRes = await pool.query("SELECT COALESCE(MAX(mat_id), 0) + 1 AS next_id FROM materials");
        const mat_no = `MAT-${maxRes.rows[0].next_id.toString().padStart(4, '0')}`;

        const result = await pool.query(
            `INSERT INTO materials (mat_no, mat_name, mat_weight, mat_price, mat_size, mat_qty, mat_status, mat_img) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [mat_no, mat_name, mat_weight || 0, mat_price || 0, mat_size, mat_qty || 0, mat_status, mat_img]
        );
        res.json({ message: "เพิ่มวัตถุดิบสำเร็จ", data: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "ไม่สามารถเพิ่มข้อมูลได้" });
    }
});

// [PUT] /:id - แก้ไขข้อมูล
router.put("/:id", upload.single('mat_img'), async (req, res) => {
    const { id } = req.params;
    const { mat_name, mat_weight, mat_price, mat_size, mat_qty, mat_status } = req.body;

    try {
        let query = "";
        let params = [];

        if (req.file) {
            query = `UPDATE materials SET mat_name=$1, mat_weight=$2, mat_price=$3, mat_size=$4, mat_qty=$5, mat_status=$6, mat_img=$7 WHERE mat_id=$8`;
            params = [mat_name, mat_weight, mat_price, mat_size, mat_qty || 0, mat_status, req.file.filename, id];
        } else {
            query = `UPDATE materials SET mat_name=$1, mat_weight=$2, mat_price=$3, mat_size=$4, mat_qty=$5, mat_status=$6 WHERE mat_id=$7`;
            params = [mat_name, mat_weight, mat_price, mat_size, mat_qty || 0, mat_status, id];
        }

        await pool.query(query, params);
        res.json({ message: "แก้ไขข้อมูลสำเร็จ" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "แก้ไขข้อมูลล้มเหลว" });
    }
});

// [DELETE] /:id
router.delete("/:id", async (req, res) => {
    try {
        // ลบข้อมูลที่เกี่ยวข้องก่อน (transactions, qc, purchase_detail)
        await pool.query("DELETE FROM transactions WHERE tra_item_id = $1 AND tra_item_type = 'material'", [req.params.id]);
        await pool.query("DELETE FROM qc WHERE item_id = $1 AND item_type = 'material'", [req.params.id]);
        await pool.query("DELETE FROM purchase_detail WHERE mat_id = $1", [req.params.id]);
        await pool.query("DELETE FROM materials WHERE mat_id = $1", [req.params.id]);
        res.json({ message: "ลบวัตถุดิบสำเร็จ" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "ลบข้อมูลไม่สำเร็จ: " + err.message });
    }
});

module.exports = router;
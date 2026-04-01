const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- ตั้งค่าการอัปโหลดรูปสินค้า ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/img/products/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'pro-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

/* ==========================================
   API ENDPOINTS
   ========================================== */

// [GET] / - ดึงรายการสินค้าทั้งหมด + ยอดคงเหลือ
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                p.*, 
                COALESCE(v.balance, 0) as pro_qty -- ใช้คอลัมน์จริงจาก v_stock_balance
            FROM products p
            LEFT JOIN v_stock_balance v ON p.pro_id = v.item_id AND v.item_type = 'product'
            ORDER BY p.pro_id DESC
        `);
        
        // ปรับ Path รูปภาพให้ Frontend (products.js) แสดงผลได้ทันที
        const data = result.rows.map(item => ({
            ...item,
            pro_img: item.pro_img ? `/img/products/${item.pro_img}` : null
        }));
        
        res.json(data);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า" });
    }
});

// [GET] /:id - ดึงข้อมูลรายตัว (สำหรับหน้า Edit)
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM products WHERE pro_id = $1", [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "ไม่พบสินค้า" });
        
        const product = result.rows[0];
        // แปลง path รูปเพื่อให้ previewImg.src ทำงานได้
        if (product.pro_img) product.pro_img = `/img/products/${product.pro_img}`;
        
        res.json(product);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

// [POST] / - เพิ่มสินค้าใหม่
router.post("/", upload.single('pro_img'), async (req, res) => {
    // รับค่าตามชื่อที่ส่งมาจาก FormData ใน products-add.js
    const { pro_name, pro_weight, pro_price, pro_status } = req.body;
    const pro_img = req.file ? req.file.filename : null;

    try {
        // สร้าง pro_no อัตโนมัติ (เช่น P-0001)
        const countRes = await pool.query("SELECT COUNT(*) FROM products");
        const pro_no = `P-${(parseInt(countRes.rows[0].count) + 1).toString().padStart(4, '0')}`;

        await pool.query(
            `INSERT INTO products (pro_no, pro_name, pro_weight, pro_price, pro_status, pro_img) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [pro_no, pro_name, pro_weight || 0, pro_price || 0, pro_status, pro_img]
        );
        res.status(201).json({ message: "เพิ่มสินค้าใหม่สำเร็จ" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: "ไม่สามารถเพิ่มสินค้าได้" });
    }
});

// [PUT] /:id - แก้ไขข้อมูลสินค้า
router.put("/:id", upload.single('pro_img'), async (req, res) => {
    const { id } = req.params;
    const { pro_name, pro_weight, pro_price, pro_status } = req.body;
    
    try {
        let query = "";
        let params = [];

        if (req.file) {
            // อัปเดตรูปใหม่ + ลบรูปเก่า (Optional แต่อนะนำ)
            query = `UPDATE products SET pro_name=$1, pro_weight=$2, pro_price=$3, pro_status=$4, pro_img=$5 WHERE pro_id=$6`;
            params = [pro_name, pro_weight, pro_price, pro_status, req.file.filename, id];
        } else {
            query = `UPDATE products SET pro_name=$1, pro_weight=$2, pro_price=$3, pro_status=$4 WHERE pro_id=$5`;
            params = [pro_name, pro_weight, pro_price, pro_status, id];
        }

        await pool.query(query, params);
        res.json({ message: "แก้ไขข้อมูลสินค้าสำเร็จ" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "แก้ไขข้อมูลล้มเหลว" });
    }
});

// [DELETE] /:id
router.delete("/:id", async (req, res) => {
    try {
        await pool.query("DELETE FROM products WHERE pro_id = $1", [req.params.id]);
        res.json({ message: "ลบสินค้าสำเร็จ" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "ลบข้อมูลไม่สำเร็จ" });
    }
});

module.exports = router;
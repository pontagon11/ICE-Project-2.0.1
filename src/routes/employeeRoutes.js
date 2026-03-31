const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAuthenticated } = require('../middleware/auth');

// --- ตั้งค่าการเก็บรูปภาพ ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'employees');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'emp-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 } // จำกัด 2MB ตามที่หน้าบ้านเช็ค
});

/* ============================================================
   ROUTES
   ============================================================ */

// 1. [GET] ดึงรายชื่อพนักงานทั้งหมด (JOIN แผนกและตำแหน่ง)
router.get("/", isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.*, d.dept_name, r.role_name 
            FROM employees e
            LEFT JOIN departments d ON e.dept_id = d.dept_id
            LEFT JOIN roles r ON e.role_id = r.role_id
            ORDER BY e.emp_id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ message: "Error fetching employees" });
    }
});

// 2. [GET] ดึงข้อมูลพนักงานรายบุคคล (สำหรับหน้า Edit)
router.get("/:id", isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query("SELECT * FROM employees WHERE emp_id = $1", [id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Employee not found" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// 3. [POST] เพิ่มพนักงานใหม่
router.post("/", isAuthenticated, upload.single('emp_img'), async (req, res) => {
    const { emp_fname, emp_lname, emp_email, emp_tel, dept_id, role_id, emp_username, emp_password } = req.body;
    const emp_img = req.file ? req.file.filename : null;

    try {
        // เข้ารหัสรหัสผ่าน
        const hashedPassword = await bcrypt.hash(emp_password, 10);

        const result = await pool.query(
            `INSERT INTO employees 
            (emp_fname, emp_lname, emp_email, emp_tel, dept_id, role_id, emp_username, emp_password, emp_img, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active') RETURNING emp_id`,
            [emp_fname, emp_lname, emp_email, emp_tel, dept_id, role_id, emp_username, hashedPassword, emp_img]
        );

        res.json({ message: "Employee added successfully", emp_id: result.rows[0].emp_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Username หรือ Email อาจมีอยู่แล้วในระบบ" });
    }
});

// 4. [PUT] อัปเดตข้อมูลพนักงาน
router.put("/:id", isAuthenticated, upload.single('emp_img'), async (req, res) => {
    const { id } = req.params;
    const { emp_fname, emp_lname, emp_email, emp_tel, dept_id, role_id, emp_username, emp_password, status } = req.body;
    
    try {
        let query = "UPDATE employees SET emp_fname=$1, emp_lname=$2, emp_email=$3, emp_tel=$4, dept_id=$5, role_id=$6, emp_username=$7, status=$8";
        let params = [emp_fname, emp_lname, emp_email, emp_tel, dept_id, role_id, emp_username, status];

        // ถ้ามีการอัปโหลดรูปใหม่
        if (req.file) {
            params.push(req.file.filename);
            query += `, emp_img=$${params.length}`;
        }

        // ถ้ามีการเปลี่ยนรหัสผ่าน
        if (emp_password) {
            const hashed = await bcrypt.hash(emp_password, 10);
            params.push(hashed);
            query += `, emp_password=$${params.length}`;
        }

        params.push(id);
        query += ` WHERE emp_id=$${params.length}`;

        await pool.query(query, params);
        res.json({ message: "Updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Update failed" });
    }
});

// 5. [DELETE] ลบพนักงาน
router.delete("/:id", isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM employees WHERE emp_id = $1", [id]);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "ไม่สามารถลบได้ เนื่องจากพนักงานมีประวัติในระบบ" });
    }
});

module.exports = router;
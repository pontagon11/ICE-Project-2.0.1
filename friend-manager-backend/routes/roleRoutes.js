// routes/roleRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:id/permissions', async (req, res) => {
    const roleId = req.params.id;
    try {
        const result = await pool.query(`
            SELECT p.perm_name 
            FROM public.role_permissions rp
            JOIN public.permissions p ON rp.perm_id = p.perm_id
            WHERE rp.role_id = $1
        `, [roleId]);

        // แปลงจาก [{perm_name: 'view_stock'}] เป็น ['view_stock'] เพื่อให้หน้าบ้านเช็คง่าย
        const perms = result.rows.map(row => row.perm_name);
        res.json(perms); 
    } catch (err) {
        console.error('Error:', err.message);
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;
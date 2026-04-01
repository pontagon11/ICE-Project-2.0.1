// routes/roleRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// [GET] / - ดึงรายชื่อ Role ทั้งหมด (สำหรับ Dropdown ในหน้า Add/Edit Employee)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT role_id, role_name FROM roles ORDER BY role_id');
        res.json(result.rows);
    } catch (err) {
        console.error('Get roles error:', err.message);
        res.status(500).json({ message: 'Server Error' });
    }
});

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

router.put('/:id/permissions', async (req, res) => {
    const roleId = req.params.id;
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM public.role_permissions WHERE role_id = $1', [roleId]);

        if (permissions.length > 0) {
            await client.query(
                `INSERT INTO public.role_permissions (role_id, perm_id)
                 SELECT $1, UNNEST($2::int[])`,
                [roleId, permissions]
            );
        }

        await client.query('COMMIT');
        res.json({ message: 'Permissions updated successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error updating role permissions:', err.message);
        res.status(500).json({ message: 'Server Error' });
    } finally {
        client.release();
    }
});

module.exports = router;
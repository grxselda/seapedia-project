const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/authMiddleware'); // <--- Kita taruh di atas dengan rapi

// ==================== 1. REGISTRASI (Mendukung Multi-role) ====================
router.post('/register', async (req, res) => {
    const { username, email, password, roles } = req.body; 

    if (!username || !email || !password || !roles || !Array.isArray(roles)) {
        return res.status(400).json({ message: 'Data tidak valid! Kolom roles harus berupa array.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('BEGIN');

        const userQuery = `
            INSERT INTO users (username, email, password) 
            VALUES ($1, $2, $3) RETURNING id, username, email
        `;
        const userResult = await db.query(userQuery, [username, email, hashedPassword]);
        const newUser = userResult.rows[0];

        for (let roleId of roles) {
            await db.query(
                'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
                [newUser.id, roleId]
            );
        }

        await db.query('COMMIT');

        res.status(201).json({
            message: 'Registrasi berhasil dengan dukungan multi-role!',
            user: { ...newUser, roles }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Email sudah terdaftar!' });
        }
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 2. LOGIN (Mengambil Semua Role User) ====================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password wajib diisi!' });
    }

    try {
        const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Email atau password salah!' });
        }

        const user = userResult.rows[0];
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email atau password salah!' });
        }

        const rolesResult = await db.query(
            `SELECT ur.role_id, r.role_name 
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $1`,
            [user.id]
        );
        
        const userRoleIds = rolesResult.rows.map(row => row.role_id);
        const userRoleNames = rolesResult.rows.map(row => row.role_name);

        const token = jwt.sign(
            { id: user.id, roles: userRoleIds },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({
            message: 'Login berhasil!',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role_ids: userRoleIds,
                role_names: userRoleNames
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 3. USER PROFILE ====================
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const userResult = await db.query(
            'SELECT id, username, email FROM users WHERE id = $1', 
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        const user = userResult.rows[0];

        const rolesResult = await db.query(
            `SELECT r.role_name 
             FROM user_roles ur
             JOIN roles r ON ur.role_id = r.id
             WHERE ur.user_id = $1`,
            [user.id]
        );
        
        const userRoleNames = rolesResult.rows.map(row => row.role_name);

        res.status(200).json({
            message: 'Profil user berhasil diambil!',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                roles: userRoleNames
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
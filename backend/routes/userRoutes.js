const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 

// ==================== 1. JALUR REGISTRASI ====================
router.post('/register', async (req, res) => {
    const { username, email, password, role_id } = req.body;
    if (!username || !email || !password || !role_id) {
        return res.status(400).json({ message: 'Semua kolom wajib diisi!' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const queryText = `
            INSERT INTO users (username, email, password, role_id) 
            VALUES ($1, $2, $3, $4) 
            RETURNING id, username, email, role_id
        `;
        const values = [username, email, hashedPassword, role_id];
        const result = await db.query(queryText, values);
        res.status(201).json({
            message: 'Registrasi berhasil dan akun Anda aman!',
            user: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Email sudah terdaftar!' });
        }
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 2. JALUR LOGIN (BARU) ====================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan password wajib diisi!' });
    }

    try {
        const queryText = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(queryText, [email]);

        // Jika email tidak ditemukan
        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Email atau password salah!' });
        }

        const user = result.rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);

        // Jika password salah
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email atau password salah!' });
        }

        const token = jwt.sign(
            { id: user.id, role_id: user.role_id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Tiket hangus dalam waktu 1 hari
        );

        res.status(200).json({
            message: 'Login berhasil!',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role_id: user.role_id
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ==================== 1. ADMIN ENDPOINTS: CREATE VOUCHER ====================
router.post('/vouchers', verifyToken, async (req, res) => {
    const { code, discount_type, discount_value, min_checkout_delivery, max_discount, expiry_date, remaining_usage } = req.body;

    if (!code || !discount_type || !discount_value || !expiry_date) {
        return res.status(400).json({ message: 'Kolom kode, tipe diskon, nilai, dan tanggal kedaluwarsa wajib diisi!' });
    }

    try {
        const queryText = `
            INSERT INTO vouchers (code, discount_type, discount_value, min_checkout_delivery, max_discount, expiry_date, remaining_usage)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `;
        const result = await db.query(queryText, [
            code.toUpperCase(), discount_type, discount_value, min_checkout_delivery || 0, max_discount || null, expiry_date, remaining_usage || 1
        ]);
        res.status(201).json({ message: 'Voucher berhasil dibuat!', voucher: result.rows[0] });
    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Kode voucher sudah terdaftar!' });
        }
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 2. ADMIN ENDPOINTS: CREATE PROMO ====================
router.post('/promos', verifyToken, async (req, res) => {
    const { name, discount_type, discount_value, start_date, end_date } = req.body;

    if (!name || !discount_type || !discount_value || !start_date || !end_date) {
        return res.status(400).json({ message: 'Semua kolom data promo wajib diisi!' });
    }

    try {
        const queryText = `
            INSERT INTO promos (name, discount_type, discount_value, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const result = await db.query(queryText, [name, discount_type, discount_value, start_date, end_date]);
        res.status(201).json({ message: 'Promo otomatis berhasil dibuat!', promo: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 3. PUBLIC LISTING ENDPOINTS: GET ACTIVE VOUCHERS ====================
router.get('/vouchers', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM vouchers WHERE remaining_usage > 0 AND expiry_date > NOW() ORDER BY id DESC'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 4. PUBLIC LISTING ENDPOINTS: GET ACTIVE PROMOS ====================
router.get('/promos', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM promos WHERE NOW() BETWEEN start_date AND end_date ORDER BY id DESC'
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
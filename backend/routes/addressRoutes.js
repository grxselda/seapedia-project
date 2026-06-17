const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken, async (req, res) => {
    const { label, recipient_name, phone_number, full_address } = req.body;
    const user_id = req.user.id;

    if (!label || !recipient_name || !phone_number || !full_address) {
        return res.status(400).json({ message: 'Semua kolom alamat wajib diisi!' });
    }

    try {
        const queryText = `
            INSERT INTO addresses (user_id, label, recipient_name, phone_number, full_address)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const result = await db.query(queryText, [user_id, label, recipient_name, phone_number, full_address]);
        res.status(201).json({ message: 'Alamat berhasil ditambahkan!', address: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

router.get('/', verifyToken, async (req, res) => {
    const user_id = req.user.id;
    try {
        const result = await db.query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY id DESC', [user_id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

router.put('/:id', verifyToken, async (req, res) => {
    const addressId = req.params.id;
    const { label, recipient_name, phone_number, full_address } = req.body;
    const user_id = req.user.id;

    try {
        // Validasi kepemilikan alamat
        const check = await db.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [addressId, user_id]);
        if (check.rows.length === 0) {
            return res.status(403).json({ message: 'Akses ditolak! Alamat tidak ditemukan.' });
        }

        const updateQuery = `
            UPDATE addresses 
            SET label = $1, recipient_name = $2, phone_number = $3, full_address = $4 
            WHERE id = $5 RETURNING *
        `;
        const result = await db.query(updateQuery, [label, recipient_name, phone_number, full_address, addressId]);
        res.status(200).json({ message: 'Alamat berhasil diperbarui!', address: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

router.delete('/:id', verifyToken, async (req, res) => {
    const addressId = req.params.id;
    const user_id = req.user.id;

    try {
        const check = await db.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [addressId, user_id]);
        if (check.rows.length === 0) {
            return res.status(403).json({ message: 'Akses ditolak! Alamat tidak ditemukan.' });
        }

        await db.query('DELETE FROM addresses WHERE id = $1', [addressId]);
        res.status(200).json({ message: 'Alamat berhasil dihapus!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
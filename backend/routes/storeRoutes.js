const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware');

// ==================== 1. CREATE / UPDATE STORE ====================
router.post('/', verifyToken, async (req, res) => {
    const { store_name, description, location } = req.body;
    const seller_id = req.user.id; 

    if (!store_name) {
        return res.status(400).json({ message: 'Nama toko wajib diisi!' });
    }

    try {
        
        const checkStore = await db.query('SELECT * FROM stores WHERE seller_id = $1', [seller_id]);

        if (checkStore.rows.length > 0) {
            const updateQuery = `
                UPDATE stores 
                SET store_name = $1, description = $2, location = $3 
                WHERE seller_id = $4 RETURNING *
            `;
            const updatedStore = await db.query(updateQuery, [store_name, description, location, seller_id]);
            return res.status(200).json({
                message: 'Profil toko Anda berhasil diperbarui!',
                store: updatedStore.rows[0]
            });
        }

        const insertQuery = `
            INSERT INTO stores (seller_id, store_name, description, location)
            VALUES ($1, $2, $3, $4) RETURNING *
        `;
        const newStore = await db.query(insertQuery, [seller_id, store_name, description, location]);
        
        res.status(201).json({
            message: 'Toko berhasil dibuat!',
            store: newStore.rows[0]
        });

    } catch (error) {
        console.error(error);
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Nama toko sudah digunakan, silakan cari nama lain!' });
        }
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;

// ==================== 2. PUBLIC STORE ENDPOINT ====================
router.get('/:id', async (req, res) => {
    const storeId = req.params.id;

    try {
        const storeResult = await db.query(
            `SELECT s.id, s.store_name, s.description, s.location, s.created_at, u.username as owner_name 
             FROM stores s
             JOIN users u ON s.seller_id = u.id
             WHERE s.id = $1`,
            [storeId]
        );

        if (storeResult.rows.length === 0) {
            return res.status(404).json({ message: 'Toko tidak ditemukan!' });
        }

        res.status(200).json({
            message: 'Profil toko berhasil diambil!',
            store: storeResult.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});
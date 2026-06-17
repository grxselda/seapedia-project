const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkRole } = require('../middleware/authMiddleware'); // <--- Diubah jadi objek destruct

router.post('/', verifyToken, checkRole([1, 2]), async (req, res) => {
    const { name, description, price, stock, image_url } = req.body;
    const seller_id = req.user.id; 

    if (!name || !price || stock === undefined) {
        return res.status(400).json({ message: 'Nama, harga, dan stok wajib diisi!' });
    }

    try {
        const queryText = `
            INSERT INTO products (name, description, price, stock, image_url, seller_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const values = [name, description, price, stock, image_url, seller_id];
        const result = await db.query(queryText, values);

        res.status(201).json({
            message: 'Produk berhasil ditambahkan oleh Seller sah!',
            product: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;

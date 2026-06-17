const express = require('express');
const router = express.Router();
const db = require('../db');
const verifyToken = require('../middleware/authMiddleware'); 

router.post('/', verifyToken, async (req, res) => {
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
            message: 'Produk berhasil ditambahkan!',
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

router.put('/:id', verifyToken, async (req, res) => {
    const productId = req.params.id;
    const { name, description, price, stock, image_url } = req.body;
    const seller_id = req.user.id; // Ambil ID dari token JWT

    try {
        const checkProduct = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (checkProduct.rows.length === 0) {
            return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }

        if (checkProduct.rows[0].seller_id !== seller_id) {
            return res.status(403).json({ message: 'Akses ditolak! Anda bukan pemilik produk ini.' });
        }

        const queryText = `
            UPDATE products 
            SET name = $1, description = $2, price = $3, stock = $4, image_url = $5
            WHERE id = $6 RETURNING *
        `;
        const values = [name, description, price, stock, image_url, productId];
        const result = await db.query(queryText, values);

        res.status(200).json({
            message: 'Produk berhasil diperbarui!',
            product: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

router.delete('/:id', verifyToken, async (req, res) => {
    const productId = req.params.id;
    const seller_id = req.user.id;

    try {
        const checkProduct = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        
        if (checkProduct.rows.length === 0) {
            return res.status(404).json({ message: 'Produk tidak ditemukan.' });
        }

        if (checkProduct.rows[0].seller_id !== seller_id) {
            return res.status(403).json({ message: 'Akses ditolak! Anda bukan pemilik produk ini.' });
        }

        await db.query('DELETE FROM products WHERE id = $1', [productId]);

        res.status(200).json({ message: 'Produk berhasil dihapus dari toko.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});
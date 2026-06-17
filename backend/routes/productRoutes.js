const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ==================== 1. CREATE PRODUCT ====================
router.post('/', verifyToken, async (req, res) => {
    const { name, description, price, stock } = req.body;
    const seller_id = req.user.id;

    if (!name || !price || !stock) {
        return res.status(400).json({ message: 'Nama, harga, dan stok wajib diisi!' });
    }

    try {
        const storeResult = await db.query('SELECT id FROM stores WHERE seller_id = $1', [seller_id]);
        
        if (storeResult.rows.length === 0) {
            return res.status(400).json({ message: 'Anda harus membuat toko terlebih dahulu sebelum menambahkan produk!' });
        }

        const store_id = storeResult.rows[0].id;

        const queryText = `
            INSERT INTO products (name, description, price, stock, store_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const result = await db.query(queryText, [name, description, price, stock, store_id]);

        res.status(201).json({
            message: 'Produk berhasil ditambahkan ke toko Anda!',
            product: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 2. READ ALL PRODUCTS (Task 2.3.1) ====================
// Mengambil semua produk lengkap dengan informasi nama tokonya
router.get('/', async (req, res) => {
    try {
        const queryText = `
            SELECT p.*, s.store_name, s.location as store_location 
            FROM products p
            LEFT JOIN stores s ON p.store_id = s.id
            ORDER BY p.id DESC
        `;
        const result = await db.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 2.5 READ ONE PRODUCT DETAIL (Task 2.3.2) ====================
router.get('/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const queryText = `
            SELECT p.*, s.store_name, s.description as store_description, s.location as store_location
            FROM products p
            LEFT JOIN stores s ON p.store_id = s.id
            WHERE p.id = $1
        `;
        const result = await db.query(queryText, [productId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Produk tidak ditemukan!' });
        }

        res.status(200).json({
            message: 'Detail produk berhasil diambil!',
            product: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 3. UPDATE PRODUCT  ====================
router.put('/:id', verifyToken, async (req, res) => {
    const productId = req.params.id;
    const { name, description, price, stock } = req.body;
    const seller_id = req.user.id;

    try {
        const productCheck = await db.query(
            `SELECT p.* FROM products p 
             JOIN stores s ON p.store_id = s.id 
             WHERE p.id = $1 AND s.seller_id = $2`,
            [productId, seller_id]
        );

        if (productCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Anda tidak memiliki hak untuk mengubah produk ini!' });
        }

        const updateQuery = `
            UPDATE products 
            SET name = $1, description = $2, price = $3, stock = $4 
            WHERE id = $5 RETURNING *
        `;
        const updatedResult = await db.query(updateQuery, [name, description, price, stock, productId]);

        res.status(200).json({
            message: 'Produk berhasil diperbarui!',
            product: updatedResult.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 4. DELETE PRODUCT ====================
router.delete('/:id', verifyToken, async (req, res) => {
    const productId = req.params.id;
    const seller_id = req.user.id;

    try {
        const productCheck = await db.query(
            `SELECT p.* FROM products p 
             JOIN stores s ON p.store_id = s.id 
             WHERE p.id = $1 AND s.seller_id = $2`,
            [productId, seller_id]
        );

        if (productCheck.rows.length === 0) {
            return res.status(403).json({ message: 'Anda tidak memiliki hak untuk menghapus produk ini!' });
        }

        await db.query('DELETE FROM products WHERE id = $1', [productId]);

        res.status(200).json({ message: 'Produk berhasil dihapus dari toko!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
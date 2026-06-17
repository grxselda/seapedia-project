const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ==================== 1. ADD TO CART & SINGLE-STORE RULE ====================
router.post('/', verifyToken, async (req, res) => {
    const { product_id, quantity } = req.body;
    const user_id = req.user.id;
    const qty = quantity ? parseInt(quantity) : 1;

    if (!product_id || qty <= 0) {
        return res.status(400).json({ message: 'Product ID dan kuantitas valid wajib diisi!' });
    }

    try {
        const targetProduct = await db.query('SELECT store_id FROM products WHERE id = $1', [product_id]);
        if (targetProduct.rows.length === 0) {
            return res.status(404).json({ message: 'Produk tidak ditemukan!' });
        }
        const targetStoreId = targetProduct.rows[0].store_id;

        const currentCart = await db.query(
            `SELECT p.store_id FROM carts c
             JOIN products p ON c.product_id = p.id
             WHERE c.user_id = $1 LIMIT 1`,
            [user_id]
        );

        if (currentCart.rows.length > 0) {
            const existingStoreId = currentCart.rows[0].store_id;
            if (existingStoreId !== targetStoreId) {
                return res.status(400).json({ 
                    message: 'Gagal menambahkan! Keranjang Anda hanya boleh berisi produk dari satu toko yang sama. Silakan kosongkan keranjang Anda terlebih dahulu.' 
                });
            }
        }

        const insertQuery = `
            INSERT INTO carts (user_id, product_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, product_id)
            DO UPDATE SET quantity = carts.quantity + EXCLUDED.quantity
            RETURNING *
        `;
        const result = await db.query(insertQuery, [user_id, product_id, qty]);

        res.status(201).json({
            message: 'Produk berhasil ditambahkan ke keranjang!',
            cart: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 2. UPDATE QUANTITY ====================
router.put('/:id', verifyToken, async (req, res) => {
    const cartId = req.params.id;
    const { quantity } = req.body;
    const user_id = req.user.id;

    if (!quantity || parseInt(quantity) <= 0) {
        return res.status(400).json({ message: 'Kuantitas harus lebih besar dari 0!' });
    }

    try {
        const updateResult = await db.query(
            'UPDATE carts SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
            [parseInt(quantity), cartId, user_id]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ message: 'Item di keranjang tidak ditemukan atau akses ditolak!' });
        }

        res.status(200).json({ message: 'Jumlah produk berhasil diubah!', cart: updateResult.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 3. REMOVE FROM CART ==================== //
router.delete('/:id', verifyToken, async (req, res) => {
    const cartId = req.params.id;
    const user_id = req.user.id;

    try {
        const deleteResult = await db.query(
            'DELETE FROM carts WHERE id = $1 AND user_id = $2 RETURNING *',
            [cartId, user_id]
        );

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ message: 'Item di keranjang tidak ditemukan atau akses ditolak!' });
        }

        res.status(200).json({ message: 'Produk berhasil dihapus dari keranjang!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 4. CART SUMMARY ====================//
router.get('/summary', verifyToken, async (req, res) => {
    const user_id = req.user.id;

    try {
        const queryText = `
            SELECT c.id as cart_id, c.quantity, p.id as product_id, p.name as product_name, 
                   p.price, (c.quantity * p.price) as subtotal, s.store_name
            FROM carts c
            JOIN products p ON c.product_id = p.id
            LEFT JOIN stores s ON p.store_id = s.id
            WHERE c.user_id = $1
            ORDER BY c.id ASC
        `;
        const cartItems = await db.query(queryText, [user_id]);

        
        const totalBill = cartItems.rows.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

        res.status(200).json({
            items: cartItems.rows,
            total_items: cartItems.rows.length,
            total_bill: totalBill
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ==================== CHECKOUT ENDPOINT ====================
router.post('/checkout', verifyToken, async (req, res) => {
    const { address_id, delivery_method } = req.body;
    const user_id = req.user.id;

    if (!address_id || !delivery_method) {
        return res.status(400).json({ message: 'Alamat pengiriman dan metode pengiriman wajib dipilih!' });
    }

    let delivery_fee = 0;
    const method = delivery_method.toLowerCase();
    if (method === 'instant') delivery_fee = 50000;
    else if (method === 'next day') delivery_fee = 25000;
    else if (method === 'regular') delivery_fee = 15000;
    else return res.status(400).json({ message: 'Metode pengiriman tidak valid!' });

    try {
        await db.query('BEGIN');

        const cartQuery = `
            SELECT c.*, p.price, p.stock, p.name as product_name, p.store_id 
            FROM carts c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = $1
        `;
        const cartItems = await db.query(cartQuery, [user_id]);

        if (cartItems.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Keranjang belanja Anda kosong!' });
        }

        const store_id = cartItems.rows[0].store_id;

        let subtotal = 0;
        for (let item of cartItems.rows) {
            if (parseInt(item.stock) < parseInt(item.quantity)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `Stok produk "${item.product_name}" tidak mencukupi! Sisa stok: ${item.stock}` 
                });
            }
            subtotal += parseFloat(item.price) * parseInt(item.quantity);
        }

        const ppn = subtotal * 0.12;
        const total_price = subtotal + delivery_fee + ppn;

        const walletQuery = await db.query('SELECT * FROM wallets WHERE user_id = $1', [user_id]);
        if (walletQuery.rows.length === 0 || parseFloat(walletQuery.rows[0].balance) < total_price) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Saldo dompet (Wallet) Anda tidak mencukupi untuk melakukan checkout ini!' });
        }
        const wallet_id = walletQuery.rows[0].id;

        const newBalance = parseFloat(walletQuery.rows[0].balance) - total_price;
        await db.query('UPDATE wallets SET balance = $1 WHERE id = $2', [newBalance, wallet_id]);
        await db.query(
            `INSERT INTO wallet_histories (wallet_id, type, amount, description) 
             VALUES ($1, 'payment', $2, $3)`,
            [wallet_id, total_price, `Pembelian produk kuliner laut di SEAPEDIA`]
        );

        for (let item of cartItems.rows) {
            await db.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [parseInt(item.quantity), item.product_id]
            );
        }

        const orderInsertQuery = `
            INSERT INTO orders (user_id, store_id, address_id, delivery_method, delivery_fee, subtotal, ppn, total_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `;
        const orderResult = await db.query(orderInsertQuery, [
            user_id, store_id, address_id, delivery_method, delivery_fee, subtotal, ppn, total_price
        ]);
        const order_id = orderResult.rows[0].id;

        for (let item of cartItems.rows) {
            await db.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price) 
                 VALUES ($1, $2, $3, $4)`,
                [order_id, item.product_id, item.quantity, item.price]
            );
        }

        await db.query('DELETE FROM carts WHERE user_id = $1', [user_id]);

        await db.query('COMMIT');

        res.status(201).json({
            message: 'Checkout berhasil! Pesanan Anda telah diteruskan ke toko tujuan.',
            order_details: orderResult.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Terjadi kegagalan sistem saat memproses checkout.' });
    }
});

module.exports = router;
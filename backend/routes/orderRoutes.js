const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ==================== CHECKOUT WITH VOUCHER INTEGRATION ====================
router.post('/checkout', verifyToken, async (req, res) => {
    const { address_id, delivery_method, voucher_code } = req.body; // <--- Menambahkan voucher_code
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
                return res.status(400).json({ message: `Stok produk "${item.product_name}" tidak mencukupi!` });
            }
            subtotal += parseFloat(item.price) * parseInt(item.quantity);
        }

        let discount_amount = 0;
        let db_voucher_id = null;

        if (voucher_code) {
            const voucherQuery = await db.query(
                'SELECT * FROM vouchers WHERE code = $1 AND remaining_usage > 0 AND expiry_date > NOW()',
                [voucher_code.toUpperCase()]
            );

            if (voucherQuery.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: 'Voucher tidak valid atau sudah kedaluwarsa!' });
            }

            const voucher = voucherQuery.rows[0];

            if (subtotal < parseFloat(voucher.min_checkout_delivery)) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: `Minimal belanja untuk voucher ini adalah Rp ${parseFloat(voucher.min_checkout_delivery).toLocaleString('id-ID')}` });
            }

            db_voucher_id = voucher.id;
            if (voucher.discount_type === 'fixed') {
                discount_amount = parseFloat(voucher.discount_value);
            } else if (voucher.discount_type === 'percentage') {
                discount_amount = subtotal * (parseFloat(voucher.discount_value) / 100);
                if (voucher.max_discount && discount_amount > parseFloat(voucher.max_discount)) {
                    discount_amount = parseFloat(voucher.max_discount);
                }
            }

            await db.query('UPDATE vouchers SET remaining_usage = remaining_usage - 1 WHERE id = $1', [db_voucher_id]);
        }

        const ppn = subtotal * 0.12;
        let total_price = subtotal - discount_amount + delivery_fee + ppn;
        if (total_price < 0) total_price = 0; // Mencegah harga minus

        const walletQuery = await db.query('SELECT * FROM wallets WHERE user_id = $1', [user_id]);
        if (walletQuery.rows.length === 0 || parseFloat(walletQuery.rows[0].balance) < total_price) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Saldo dompet Anda tidak mencukupi!' });
        }
        const wallet_id = walletQuery.rows[0].id;

        const newBalance = parseFloat(walletQuery.rows[0].balance) - total_price;
        await db.query('UPDATE wallets SET balance = $1 WHERE id = $2', [newBalance, wallet_id]);
        await db.query(
            `INSERT INTO wallet_histories (wallet_id, type, amount, description) 
             VALUES ($1, 'payment', $2, $3)`,
            [wallet_id, total_price, `Pembelian dengan diskon voucher di SEAPEDIA`]
        );

        for (let item of cartItems.rows) {
            await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [parseInt(item.quantity), item.product_id]);
        }

        const orderInsertQuery = `
            INSERT INTO orders (user_id, store_id, address_id, delivery_method, delivery_fee, subtotal, ppn, total_price, voucher_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `;
        const orderResult = await db.query(orderInsertQuery, [
            user_id, store_id, address_id, delivery_method, delivery_fee, subtotal, ppn, total_price, db_voucher_id
        ]);
        const order_id = orderResult.rows[0].id;

        for (let item of cartItems.rows) {
            await db.query(`INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`, [order_id, item.product_id, item.quantity, item.price]);
        }
        await db.query('DELETE FROM carts WHERE user_id = $1', [user_id]);

        await db.query('COMMIT');

        res.status(201).json({
            message: 'Checkout dengan voucher berhasil!',
            discount_applied: discount_amount,
            order_details: orderResult.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Terjadi kegagalan sistem saat memproses checkout.' });
    }
});

module.exports = router;

// ==================== SELLER PROCESS ORDER ====================
router.put('/:id/process', verifyToken, async (req, res) => {
    const orderId = req.params.id;

    try {
        await db.query('BEGIN');

        const orderCheck = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);

        if (orderCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Pesanan tidak ditemukan.' });
        }

        const currentStatus = orderCheck.rows[0].status;

        if (currentStatus !== 'Sedang Dikemas') {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: `Gagal memproses! Status pesanan saat ini adalah "${currentStatus}".` });
        }

        const nextStatus = 'Menunggu Pengirim';

        await db.query('UPDATE orders SET status = $1 WHERE id = $2', [nextStatus, orderId]);

        await db.query(
            'INSERT INTO order_status_histories (order_id, status) VALUES ($1, $2)',
            [orderId, nextStatus]
        );

        await db.query('COMMIT');

        res.status(200).json({
            message: 'Pesanan berhasil diproses! Status kini diperbarui.',
            order_id: orderId,
            new_status: nextStatus
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan sistem saat memproses status pesanan.' });
    }
});
const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ==================== 1. GET WALLET BALANCE (Task 3.1.1) ====================
router.get('/balance', verifyToken, async (req, res) => {
    const user_id = req.user.id;

    try {
        let wallet = await db.query('SELECT * FROM wallets WHERE user_id = $1', [user_id]);

        if (wallet.rows.length === 0) {
            const newWallet = await db.query(
                'INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) RETURNING *',
                [user_id]
            );
            return res.status(200).json({ balance: newWallet.rows[0].balance });
        }

        res.status(200).json({ balance: wallet.rows[0].balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 2. DUMMY TOP-UP ====================
router.post('/topup', verifyToken, async (req, res) => {
    const { amount } = req.body;
    const user_id = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Jumlah top-up harus lebih besar dari 0!' });
    }

    try {
        let wallet = await db.query('SELECT * FROM wallets WHERE user_id = $1', [user_id]);
        let walletId;
        let currentBalance = 0;

        if (wallet.rows.length === 0) {
            const newWallet = await db.query(
                'INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00) RETURNING *',
                [user_id]
            );
            walletId = newWallet.rows[0].id;
        } else {
            walletId = wallet.rows[0].id;
            currentBalance = parseFloat(wallet.rows[0].balance);
        }

        const newBalance = currentBalance + parseFloat(amount);

        await db.query('UPDATE wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newBalance, walletId]);

        await db.query(
            `INSERT INTO wallet_histories (wallet_id, type, amount, description) 
             VALUES ($1, 'topup', $2, $3)`,
            [walletId, amount, `Top-up saldo sebesar Rp ${Number(amount).toLocaleString('id-ID')}`]
        );

        res.status(200).json({
            message: 'Top-up berhasil!',
            current_balance: newBalance
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

// ==================== 3. TRANSACTION HISTORY ====================
router.get('/history', verifyToken, async (req, res) => {
    const user_id = req.user.id;

    try {
        const queryText = `
            SELECT wh.id, wh.type, wh.amount, wh.description, wh.created_at 
            FROM wallet_histories wh
            JOIN wallets w ON wh.wallet_id = w.id
            WHERE w.user_id = $1
            ORDER BY wh.created_at DESC
        `;
        const result = await db.query(queryText, [user_id]);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
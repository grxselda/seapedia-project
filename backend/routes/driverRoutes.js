const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ==================== 1. LIST AVAILABLE JOBS (Task 5.1.2 & 5.1.4) ====================
router.get('/jobs', verifyToken, async (req, res) => {
    try {
        const queryText = `
            SELECT dj.id as job_id, dj.status as job_status, 
                   o.id as order_id, o.delivery_method, o.delivery_fee, o.store_id
            FROM delivery_jobs dj
            JOIN orders o ON dj.order_id = o.id
            WHERE dj.driver_id IS NULL AND o.status = 'Menunggu Pengirim'
            ORDER BY dj.created_at DESC
        `;
        const result = await db.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan sistem saat mengambil lowongan pekerjaan.' });
    }
});

// ==================== 2. JOB DETAILS ENDPOINT (Task 5.1.3) ====================
router.get('/jobs/:id', verifyToken, async (req, res) => {
    const jobId = req.params.id;

    try {
        const queryText = `
            SELECT dj.id as job_id, dj.status as job_status,
                   o.id as order_id, o.delivery_method, o.total_price, o.address_id, o.store_id
            FROM delivery_jobs dj
            JOIN orders o ON dj.order_id = o.id
            WHERE dj.id = $1
        `;
        const result = await db.query(queryText, [jobId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Detail pekerjaan tidak ditemukan.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan sistem saat mengambil detail pekerjaan.' });
    }
});

// ==================== 3. TAKE JOB ACTION WITH LOCKING (Task 5.2.1 & 5.2.2) ====================
router.put('/jobs/:id/take', verifyToken, async (req, res) => {
    const jobId = req.params.id;
    const driverId = req.user.id;

    try {
        await db.query('BEGIN');

        const jobCheck = await db.query(
            'SELECT * FROM delivery_jobs WHERE id = $1 FOR UPDATE',
            [jobId]
        );

        if (jobCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Pekerjaan tidak ditemukan.' });
        }

        const job = jobCheck.rows[0];

        if (job.driver_id !== null) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Maaf, pekerjaan pengiriman ini sudah diambil oleh driver lain!' });
        }

        const nextStatus = 'Sedang Dikirim';

        await db.query(
            'UPDATE delivery_jobs SET driver_id = $1, status = $2 WHERE id = $3',
            [driverId, nextStatus, jobId]
        );

        await db.query(
            'UPDATE orders SET status = $1 WHERE id = $2',
            [nextStatus, job.order_id]
        );

        await db.query(
            'INSERT INTO order_status_histories (order_id, status) VALUES ($1, $2)',
            [job.order_id, nextStatus]
        );

        await db.query('COMMIT');

        res.status(200).json({
            message: 'Pekerjaan berhasil diambil! Silakan ambil paket di toko dan antarkan ke pembeli.',
            job_id: jobId,
            status: nextStatus
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan sistem saat mengambil pekerjaan pengiriman.' });
    }
});

// ==================== 4. CONFIRM COMPLETED ACTION (Task 5.2.3) ====================
router.put('/jobs/:id/complete', verifyToken, async (req, res) => {
    const jobId = req.params.id;
    const driverId = req.user.id;

    try {
        await db.query('BEGIN');

        const jobCheck = await db.query('SELECT * FROM delivery_jobs WHERE id = $1', [jobId]);

        if (jobCheck.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Pekerjaan tidak ditemukan.' });
        }

        const job = jobCheck.rows[0];

        if (job.driver_id !== driverId) {
            await db.query('ROLLBACK');
            return res.status(403).json({ message: 'Akses ditolak! Anda bukan driver yang ditugaskan untuk paket ini.' });
        }

        if (job.status !== 'Sedang Dikirim') {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Pekerjaan belum berjalan atau sudah selesai sebelumnya.' });
        }

        const finalStatus = 'Pesanan Selesai';

        await db.query('UPDATE delivery_jobs SET status = $1 WHERE id = $2', [finalStatus, jobId]);
        await db.query('UPDATE orders SET status = $1 WHERE id = $2', [finalStatus, job.order_id]);
        await db.query(
            'INSERT INTO order_status_histories (order_id, status) VALUES ($1, $2)',
            [job.order_id, finalStatus]
        );

        await db.query('COMMIT');

        res.status(200).json({
            message: 'Konfirmasi sukses! Paket telah sampai dan pesanan dinyatakan Selesai.',
            job_id: jobId,
            status: finalStatus
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan sistem saat menyelesaikan pengiriman.' });
    }
});

// ==================== 5. DRIVER EARNING CALCULATION (Task 5.3.2) ====================
router.get('/earnings', verifyToken, async (req, res) => {
    const driverId = req.user.id;

    try {
        const queryText = `
            SELECT COALESCE(SUM(o.delivery_fee), 0) as total_earnings,
                   COUNT(dj.id) as completed_jobs
            FROM delivery_jobs dj
            JOIN orders o ON dj.order_id = o.id
            WHERE dj.driver_id = $1 AND dj.status = 'Pesanan Selesai'
        `;
        const result = await db.query(queryText, [driverId]);
        
        res.status(200).json({
            message: 'Data pendapatan driver berhasil dihitung.',
            driver_id: driverId,
            total_earnings: result.rows[0].total_earnings,
            completed_jobs: parseInt(result.rows[0].completed_jobs)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan sistem saat menghitung pendapatan.' });
    }
});

module.exports = router;
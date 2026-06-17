const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/', async (req, res) => {
    const { name, rating, comment } = req.body;

    if (!name || !rating || !comment) {
        return res.status(400).json({ message: 'Nama, rating, dan komentar wajib diisi!' });
    }

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating harus berkisar antara 1 sampai 5!' });
    }

    try {
        const queryText = `
            INSERT INTO reviews (name, rating, comment)
            VALUES ($1, $2, $3)
            RETURNING *
        `;
        const result = await db.query(queryText, [name, rating, comment]);

        res.status(201).json({
            message: 'Review berhasil disimpan ke database!',
            review: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM reviews ORDER BY created_at DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
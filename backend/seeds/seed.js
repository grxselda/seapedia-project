const db = require('../db');
const bcrypt = require('bcrypt');

async function runSeed() {
    try {
        const hashedPassword = await bcrypt.hash('password123', 10);
        
        await db.query('BEGIN');
        
        // Seed Admin
        await db.query(`INSERT INTO users (username, email, password) VALUES ('admin_seapedia', 'admin@seapedia.com', $1)`, [hashedPassword]);
        
        // (Tambahkan insert untuk Seller, Buyer, Driver di sini...)
        
        await db.query('COMMIT');
        console.log('Seed data berhasil dimasukkan!');
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Gagal seeding:', err);
    }
}

runSeed();
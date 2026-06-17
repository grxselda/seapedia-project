const express = require('express');

const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send("Selamat datang! Gudang belakang layar SEAPEDIA sudah aktif!");
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Mesin sudah menyala dan berjaga di pintu nomor ${PORT}`);
});
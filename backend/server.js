require('dotenv').config(); 
const db = require('./db'); 

const express = require('express');
const cors = require('cors');
const app = express();

const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes'); 

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes); 
app.get('/', (req, res) => {
    res.send("Selamat datang! Gudang belakang layar SEAPEDIA sudah aktif!");
});

const PORT = process.env.PORT || 5000; 
app.listen(PORT, () => {
    console.log(`Mesin sudah menyala dan berjaga di pintu nomor ${PORT}`);
});
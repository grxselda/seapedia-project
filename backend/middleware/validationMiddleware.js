const { body, validationResult } = require('express-validator');

const validateResult = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: `Gagal memproses data! ${errors.array()[0].msg}` 
        });
    }
    next();
};

const validateAuth = [
    body('email').isEmail().withMessage('Format email tidak valid.').normalizeEmail(),
    body('phone').optional().isMobilePhone('id-ID').withMessage('Nomor telepon harus format Indonesia yang valid.'),
    validateResult
];

const validateProduct = [
    body('name').trim().escape().notEmpty().withMessage('Nama produk tidak boleh kosong.'),
    body('price').isFloat({ min: 0 }).withMessage('Harga harus berupa angka dan tidak boleh negatif.'),
    body('stock').isInt({ min: 0 }).withMessage('Stok harus berupa angka bulat dan tidak boleh negatif.'),
    validateResult
];

const validateCart = [
    body('product_id').isInt().withMessage('ID Produk harus berupa angka bulat.'),
    body('quantity').isInt({ min: 1 }).withMessage('Jumlah barang minimal adalah 1.'),
    validateResult
];

const validateDiscount = [
    body('code').trim().escape().notEmpty().withMessage('Kode promo tidak boleh kosong.'),
    body('discount_value').isFloat({ min: 0 }).withMessage('Nilai diskon harus berupa angka positif.'),
    validateResult
];

module.exports = {
    validateAuth,
    validateProduct,
    validateCart,
    validateDiscount
};
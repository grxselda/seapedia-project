const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Akses ditolak! Anda harus menyertakan token autentikasi.' });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified; // Menyimpan data id dan roles dari token ke objek 'req.user'
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa.' });
    }
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        const userRoles = req.user.roles; 

        const hasPermission = userRoles.some(role => allowedRoles.includes(role));

        if (!hasPermission) {
            return res.status(403).json({ 
                message: 'Akses ditolak! Peran (role) Anda tidak memiliki izin untuk mengakses rute ini.' 
            });
        }

        next(); 
    };
};

module.exports = { verifyToken, checkRole };
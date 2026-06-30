const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const sequelize = require('./sequelize/index');

const app = express();

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend assets (css/js/images referenced inside the html files), but not the html files themselves
app.use(express.static(path.join(__dirname, 'views'), { index: false }));

// Routes
const productRoutes = require('./routes/products');
const authRoutes = require('./routes/auth');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');

const indexController = require('./controllers/indexController');

// Page routes (clean URLs, no .html)
app.get('/', indexController.showIndex);
app.get('/login', indexController.showLogin);
app.get('/register', indexController.showRegister);
app.get('/shop', indexController.showShop);
app.get('/cart', indexController.showCart);
app.get('/products', indexController.showProducts);
app.get('/orders', indexController.showOrders);
app.get('/users', indexController.showUsers);
app.get('/charts', indexController.showCharts);
app.get('/setup-profile', indexController.showSetupProfile);

// API routes
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// Test Sequelize connection
sequelize.authenticate()
    .then(() => console.log('Sequelize connected to database!'))
    .catch(err => console.log('Sequelize connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
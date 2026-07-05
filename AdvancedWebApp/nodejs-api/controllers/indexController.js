const path = require('path');

const viewsPath = path.join(__dirname, '../views');

function showIndex(req, res) {
    res.sendFile(path.join(viewsPath, 'index.html'));
}

function showLogin(req, res) {
    res.sendFile(path.join(viewsPath, 'login.html'));
}

function showRegister(req, res) {
    res.sendFile(path.join(viewsPath, 'register.html'));
}

function showShop(req, res) {
    res.sendFile(path.join(viewsPath, 'shop.html'));
}

function showCart(req, res) {
    res.sendFile(path.join(viewsPath, 'cart.html'));
}

function showCheckout(req, res) {
    res.sendFile(path.join(viewsPath, 'checkout.html'));
}

function showProductDetail(req, res) {
    res.sendFile(path.join(viewsPath, 'product-detail.html'));
}

function showProfileOrders(req, res) {
    res.sendFile(path.join(viewsPath, 'profile-orders.html'));
}

function showReview(req, res) {
    res.sendFile(path.join(viewsPath, 'review.html'));
}

function showProducts(req, res) {
    res.sendFile(path.join(viewsPath, 'products.html'));
}

function showOrders(req, res) {
    res.sendFile(path.join(viewsPath, 'orders.html'));
}

function showUsers(req, res) {
    res.sendFile(path.join(viewsPath, 'users.html'));
}

function showCharts(req, res) {
    res.sendFile(path.join(viewsPath, 'charts.html'));
}

function showSetupProfile(req, res) {
    res.sendFile(path.join(viewsPath, 'setup-profile.html'));
}

function showDeletedProducts(req, res) {
    res.sendFile(path.join(viewsPath, 'deleted-products.html'));
}

module.exports = {
    showIndex,
    showLogin,
    showRegister,
    showShop,
    showCart,
    showCheckout,
    showProductDetail,
    showProfileOrders,
    showReview,
    showProducts,
    showOrders,
    showUsers,
    showCharts,
    showSetupProfile,
    showDeletedProducts   // add this
};
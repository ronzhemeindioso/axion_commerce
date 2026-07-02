const User = require('./models/User');
const Order = require('./models/Order');
const OrderItem = require('./models/OrderItem');
const Product = require('./models/Product');
const Cart = require('./models/Cart');

User.hasMany(Order, { foreignKey: 'user_id' });
Order.belongsTo(User, { foreignKey: 'user_id' });

Order.hasMany(OrderItem, { foreignKey: 'order_id' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id' });

Product.hasMany(OrderItem, { foreignKey: 'product_id' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id' });

User.hasMany(Cart, { foreignKey: 'user_id' });
Cart.belongsTo(User, { foreignKey: 'user_id' });

Product.hasMany(Cart, { foreignKey: 'product_id' });
Cart.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = {};
// seeders/productSeeder.js
// Run with: node seeders/productSeeder.js
// Add --force to wipe existing products first: node seeders/productSeeder.js --force

const sequelize = require('../sequelize/index');
const Product = require('../sequelize/models/Product');

const sampleProducts = [
    {
        name: 'Canon PowerShot G7X',
        description: 'Compact point-and-shoot with a fast lens, great for everyday carry.',
        price: 249.99,
        stock: 15,
        category: 'camera',
        images: ''
    },
    {
        name: 'Sony RX1R II',
        description: 'Full-frame compact camera with a fixed Zeiss lens.',
        price: 599.00,
        stock: 8,
        category: 'camera',
        images: ''
    },
    {
        name: 'Nikon Z50',
        description: 'Mirrorless APS-C camera built for travel and vlogging.',
        price: 349.50,
        stock: 12,
        category: 'camera',
        images: ''
    },
    {
        name: '35mm f/1.8 Prime Lens',
        description: 'Sharp, lightweight prime lens ideal for portraits and street photography.',
        price: 129.00,
        stock: 20,
        category: 'lenses',
        images: ''
    },
    {
        name: '70-200mm f/2.8 Zoom Lens',
        description: 'Professional telephoto zoom for sports and wildlife.',
        price: 899.00,
        stock: 5,
        category: 'lenses',
        images: ''
    },
    {
        name: 'Weatherproof Camera Backpack',
        description: 'Padded, water-resistant backpack with dedicated lens compartments.',
        price: 79.99,
        stock: 30,
        category: 'bags',
        images: ''
    },
    {
        name: 'Compact Sling Camera Bag',
        description: 'Quick-access sling bag for one body and two lenses.',
        price: 45.00,
        stock: 25,
        category: 'bags',
        images: ''
    },
    {
        name: '64GB SD Memory Card',
        description: 'High-speed UHS-II card for fast burst shooting and 4K video.',
        price: 24.99,
        stock: 50,
        category: 'accessories',
        images: ''
    },
    {
        name: 'Carbon Fiber Tripod',
        description: 'Lightweight tripod rated for up to 15kg, folds down to 40cm.',
        price: 139.00,
        stock: 10,
        category: 'accessories',
        images: ''
    },
    {
        name: 'Spare Camera Battery',
        description: 'OEM-compatible rechargeable battery pack.',
        price: 19.99,
        stock: 40,
        category: 'accessories',
        images: ''
    }
];

async function seed() {
    const force = process.argv.includes('--force');

    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const existingCount = await Product.count();

        if (existingCount > 0 && !force) {
            console.log(`Products table already has ${existingCount} row(s). Skipping seed.`);
            console.log('Run "node seeders/productSeeder.js --force" to wipe and reseed.');
            process.exit(0);
        }

        if (force && existingCount > 0) {
            await Product.destroy({ where: {}, truncate: true, force: true });
            console.log(`Cleared ${existingCount} existing product(s).`);
        }

        const created = await Product.bulkCreate(sampleProducts);
        console.log(`Seeded ${created.length} product(s) successfully.`);
        process.exit(0);
    } catch (err) {
        console.error('Seeder failed:', err.message);
        process.exit(1);
    }
}

seed();
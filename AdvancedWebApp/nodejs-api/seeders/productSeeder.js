// seeders/ProductSeeder.js
// Run with: node seeders/ProductSeeder.js
// Add --force to wipe existing products first: node seeders/ProductSeeder.js --force

const sequelize = require('../sequelize/index');
const Product = require('../sequelize/models/Product');

const sampleProducts = [
    // ---- camera ----
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
        name: 'Fujifilm X-T5',
        description: 'Retro-styled mirrorless camera with a 40MP APS-C sensor.',
        price: 1699.00,
        stock: 7,
        category: 'camera',
        images: ''
    },
    {
        name: 'Canon EOS R6 Mark II',
        description: 'Full-frame mirrorless body with fast autofocus and 4K60 video.',
        price: 2499.00,
        stock: 6,
        category: 'camera',
        images: ''
    },
    {
        name: 'Panasonic Lumix GH6',
        description: 'Micro Four Thirds hybrid camera tuned for serious video work.',
        price: 2199.00,
        stock: 5,
        category: 'camera',
        images: ''
    },
    {
        name: 'GoPro HERO12 Black',
        description: 'Rugged waterproof action camera with HyperSmooth stabilization.',
        price: 399.99,
        stock: 22,
        category: 'camera',
        images: ''
    },
    {
        name: 'Instax Mini 12 Instant Camera',
        description: 'Fun, easy-to-use instant film camera for quick prints.',
        price: 79.95,
        stock: 35,
        category: 'camera',
        images: ''
    },

    // ---- lenses ----
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
        name: '24-70mm f/2.8 Standard Zoom',
        description: 'Versatile everyday zoom covering wide-angle to short telephoto.',
        price: 1099.00,
        stock: 9,
        category: 'lenses',
        images: ''
    },
    {
        name: '50mm f/1.4 Prime Lens',
        description: 'Classic fast prime with beautiful background blur for portraits.',
        price: 179.00,
        stock: 18,
        category: 'lenses',
        images: ''
    },
    {
        name: '16-35mm f/4 Wide-Angle Lens',
        description: 'Ultra-wide zoom perfect for landscapes and architecture.',
        price: 749.00,
        stock: 7,
        category: 'lenses',
        images: ''
    },
    {
        name: '100mm f/2.8 Macro Lens',
        description: 'High-magnification macro lens for close-up detail shots.',
        price: 649.00,
        stock: 6,
        category: 'lenses',
        images: ''
    },
    {
        name: '85mm f/1.8 Portrait Lens',
        description: 'Short telephoto prime prized for flattering portrait compression.',
        price: 299.00,
        stock: 11,
        category: 'lenses',
        images: ''
    },

    // ---- bags ----
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
        name: 'Rolling Camera Case',
        description: 'Hard-shell case on wheels for studio gear and long-haul travel.',
        price: 189.00,
        stock: 8,
        category: 'bags',
        images: ''
    },
    {
        name: 'Mirrorless Shoulder Bag',
        description: 'Slim shoulder bag sized for mirrorless bodies and a couple of lenses.',
        price: 59.99,
        stock: 20,
        category: 'bags',
        images: ''
    },
    {
        name: 'Rain Cover for Camera Bags',
        description: 'Elasticated rain cover that fits most mid-size camera backpacks.',
        price: 14.99,
        stock: 45,
        category: 'bags',
        images: ''
    },
    {
        name: 'Lens Pouch Set (3-Pack)',
        description: 'Padded drawstring pouches for protecting loose lenses in a bag.',
        price: 22.00,
        stock: 33,
        category: 'bags',
        images: ''
    },

    // ---- accessories ----
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
    },
    {
        name: 'Dual-Slot Battery Charger',
        description: 'Charges two camera batteries at once via USB-C.',
        price: 29.99,
        stock: 28,
        category: 'accessories',
        images: ''
    },
    {
        name: 'Circular Polarizer Filter 67mm',
        description: 'Cuts glare and reflections while boosting sky and foliage contrast.',
        price: 34.99,
        stock: 26,
        category: 'accessories',
        images: ''
    },
    {
        name: 'Camera Cleaning Kit',
        description: 'Air blower, microfiber cloth, and sensor swabs in one kit.',
        price: 15.99,
        stock: 60,
        category: 'accessories',
        images: ''
    },
    {
        name: 'Wireless Remote Shutter Release',
        description: 'Bluetooth remote for hands-free shots and long exposures.',
        price: 21.99,
        stock: 32,
        category: 'accessories',
        images: ''
    },
    {
        name: 'LED Video Light Panel',
        description: 'On-camera LED panel with adjustable brightness and color temperature.',
        price: 49.99,
        stock: 17,
        category: 'accessories',
        images: ''
    },
    {
        name: 'Camera Strap, Padded Leather',
        description: 'Comfortable padded neck strap with quick-release buckles.',
        price: 18.99,
        stock: 38,
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
            console.log('Run "node seeders/ProductSeeder.js --force" to wipe and reseed.');
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
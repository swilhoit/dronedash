// Drone Dash - Delivery Game with Three.js and Real Map Tiles

// ============================================
// Global Variables
// ============================================
let scene, renderer;
let mainCamera, minimapCamera;
let drone;
let tiles = [];
let clock;

// Loading state
let loadingState = {
    totalTiles: 0,
    loadedTiles: 0,
    restaurantsLoaded: false,
    restaurants: []
};

// Restaurant label elements
let restaurantLabels = [];

// ============================================
// DRONE DASH GAME STATE
// ============================================
let gameState = {
    isPlaying: false,
    isPaused: false,
    earnings: 0,
    totalDeliveries: 0,
    currentOrder: null,
    orderQueue: [],
    deliveryLocations: [],
    pickupRadius: 30,
    deliveryRadius: 25,
    orderInterval: null,
    gameTime: 0,
    streak: 0,
    bestStreak: 0
};

// Delivery home markers
let deliveryMarkers = [];
let deliveryLabels = [];

// Realistic menu items by restaurant type
const menuDatabase = {
    // Fast Food Burgers
    burger: {
        items: [
            { name: "Classic Cheeseburger", price: 8.99, prep: 5 },
            { name: "Double Bacon Burger", price: 12.99, prep: 7 },
            { name: "Veggie Burger", price: 9.99, prep: 6 },
            { name: "Mushroom Swiss Burger", price: 11.99, prep: 6 },
            { name: "Spicy Jalapeño Burger", price: 10.99, prep: 6 },
            { name: "BBQ Bacon Burger", price: 13.99, prep: 7 },
            { name: "Chicken Sandwich", price: 9.99, prep: 5 },
            { name: "Fish Sandwich", price: 8.99, prep: 5 },
            { name: "Large Fries", price: 4.99, prep: 3 },
            { name: "Onion Rings", price: 5.99, prep: 4 },
            { name: "Milkshake", price: 5.99, prep: 3 },
            { name: "Soft Drink", price: 2.99, prep: 1 }
        ]
    },
    // Pizza
    pizza: {
        items: [
            { name: "Pepperoni Pizza (Large)", price: 18.99, prep: 15 },
            { name: "Margherita Pizza", price: 16.99, prep: 12 },
            { name: "Meat Lovers Pizza", price: 21.99, prep: 18 },
            { name: "Veggie Supreme Pizza", price: 17.99, prep: 15 },
            { name: "BBQ Chicken Pizza", price: 19.99, prep: 15 },
            { name: "Hawaiian Pizza", price: 17.99, prep: 14 },
            { name: "Buffalo Wings (12pc)", price: 14.99, prep: 12 },
            { name: "Garlic Knots", price: 6.99, prep: 8 },
            { name: "Caesar Salad", price: 8.99, prep: 5 },
            { name: "Cheesy Bread", price: 7.99, prep: 8 },
            { name: "2-Liter Soda", price: 3.99, prep: 1 }
        ]
    },
    // Mexican
    mexican: {
        items: [
            { name: "Burrito Bowl", price: 11.99, prep: 8 },
            { name: "Chicken Burrito", price: 10.99, prep: 7 },
            { name: "Steak Tacos (3)", price: 12.99, prep: 8 },
            { name: "Carnitas Tacos (3)", price: 11.99, prep: 8 },
            { name: "Quesadilla", price: 9.99, prep: 6 },
            { name: "Nachos Supreme", price: 13.99, prep: 10 },
            { name: "Guacamole & Chips", price: 7.99, prep: 5 },
            { name: "Churros", price: 5.99, prep: 5 },
            { name: "Mexican Rice", price: 3.99, prep: 3 },
            { name: "Refried Beans", price: 3.99, prep: 3 },
            { name: "Horchata", price: 3.99, prep: 2 }
        ]
    },
    // Chinese
    chinese: {
        items: [
            { name: "Orange Chicken", price: 13.99, prep: 12 },
            { name: "Kung Pao Chicken", price: 14.99, prep: 12 },
            { name: "Beef & Broccoli", price: 15.99, prep: 12 },
            { name: "Sweet & Sour Pork", price: 14.99, prep: 12 },
            { name: "Fried Rice", price: 10.99, prep: 8 },
            { name: "Lo Mein", price: 11.99, prep: 10 },
            { name: "Egg Rolls (4)", price: 6.99, prep: 6 },
            { name: "Crab Rangoon (6)", price: 7.99, prep: 6 },
            { name: "Hot & Sour Soup", price: 5.99, prep: 5 },
            { name: "Wonton Soup", price: 5.99, prep: 5 },
            { name: "Fortune Cookies", price: 1.99, prep: 1 }
        ]
    },
    // Japanese/Sushi
    japanese: {
        items: [
            { name: "California Roll (8pc)", price: 12.99, prep: 10 },
            { name: "Spicy Tuna Roll", price: 14.99, prep: 10 },
            { name: "Dragon Roll", price: 18.99, prep: 12 },
            { name: "Salmon Sashimi", price: 16.99, prep: 8 },
            { name: "Chicken Teriyaki", price: 14.99, prep: 12 },
            { name: "Beef Teriyaki", price: 17.99, prep: 12 },
            { name: "Ramen Bowl", price: 15.99, prep: 15 },
            { name: "Miso Soup", price: 3.99, prep: 3 },
            { name: "Edamame", price: 5.99, prep: 4 },
            { name: "Gyoza (6pc)", price: 7.99, prep: 6 },
            { name: "Green Tea", price: 2.99, prep: 2 }
        ]
    },
    // Italian
    italian: {
        items: [
            { name: "Spaghetti & Meatballs", price: 16.99, prep: 15 },
            { name: "Fettuccine Alfredo", price: 15.99, prep: 12 },
            { name: "Chicken Parmesan", price: 18.99, prep: 18 },
            { name: "Lasagna", price: 17.99, prep: 15 },
            { name: "Ravioli", price: 15.99, prep: 12 },
            { name: "Caprese Salad", price: 10.99, prep: 5 },
            { name: "Garlic Bread", price: 5.99, prep: 5 },
            { name: "Minestrone Soup", price: 6.99, prep: 6 },
            { name: "Tiramisu", price: 8.99, prep: 3 },
            { name: "Cannoli", price: 6.99, prep: 3 },
            { name: "Italian Soda", price: 3.99, prep: 2 }
        ]
    },
    // Coffee/Cafe
    cafe: {
        items: [
            { name: "Latte", price: 5.99, prep: 4 },
            { name: "Cappuccino", price: 5.49, prep: 4 },
            { name: "Iced Coffee", price: 4.99, prep: 3 },
            { name: "Caramel Macchiato", price: 6.49, prep: 5 },
            { name: "Hot Chocolate", price: 4.99, prep: 3 },
            { name: "Croissant", price: 3.99, prep: 2 },
            { name: "Blueberry Muffin", price: 3.49, prep: 2 },
            { name: "Avocado Toast", price: 9.99, prep: 6 },
            { name: "Bagel & Cream Cheese", price: 4.99, prep: 3 },
            { name: "Breakfast Sandwich", price: 7.99, prep: 6 },
            { name: "Chocolate Chip Cookie", price: 2.99, prep: 1 }
        ]
    },
    // Indian
    indian: {
        items: [
            { name: "Chicken Tikka Masala", price: 16.99, prep: 15 },
            { name: "Butter Chicken", price: 17.99, prep: 15 },
            { name: "Lamb Vindaloo", price: 19.99, prep: 18 },
            { name: "Palak Paneer", price: 14.99, prep: 12 },
            { name: "Biryani", price: 15.99, prep: 15 },
            { name: "Tandoori Chicken", price: 16.99, prep: 18 },
            { name: "Naan Bread", price: 3.99, prep: 4 },
            { name: "Samosas (2)", price: 5.99, prep: 5 },
            { name: "Mango Lassi", price: 4.99, prep: 3 },
            { name: "Raita", price: 2.99, prep: 2 },
            { name: "Gulab Jamun", price: 5.99, prep: 3 }
        ]
    },
    // Thai
    thai: {
        items: [
            { name: "Pad Thai", price: 14.99, prep: 12 },
            { name: "Green Curry", price: 15.99, prep: 12 },
            { name: "Red Curry", price: 15.99, prep: 12 },
            { name: "Tom Yum Soup", price: 8.99, prep: 8 },
            { name: "Thai Fried Rice", price: 13.99, prep: 10 },
            { name: "Massaman Curry", price: 16.99, prep: 15 },
            { name: "Spring Rolls (4)", price: 6.99, prep: 5 },
            { name: "Satay Chicken", price: 9.99, prep: 8 },
            { name: "Mango Sticky Rice", price: 7.99, prep: 5 },
            { name: "Thai Iced Tea", price: 4.99, prep: 3 }
        ]
    },
    // American/Diner
    american: {
        items: [
            { name: "Club Sandwich", price: 12.99, prep: 8 },
            { name: "Grilled Cheese", price: 8.99, prep: 6 },
            { name: "BLT Sandwich", price: 10.99, prep: 6 },
            { name: "Philly Cheesesteak", price: 14.99, prep: 10 },
            { name: "Hot Dog", price: 6.99, prep: 4 },
            { name: "Mac & Cheese", price: 9.99, prep: 8 },
            { name: "Chicken Tenders", price: 11.99, prep: 8 },
            { name: "Caesar Salad", price: 10.99, prep: 5 },
            { name: "Soup of the Day", price: 5.99, prep: 4 },
            { name: "Apple Pie", price: 6.99, prep: 3 },
            { name: "Chocolate Shake", price: 5.99, prep: 4 }
        ]
    },
    // BBQ
    bbq: {
        items: [
            { name: "Pulled Pork Sandwich", price: 13.99, prep: 8 },
            { name: "Beef Brisket (1/2 lb)", price: 18.99, prep: 10 },
            { name: "BBQ Ribs (Half Rack)", price: 22.99, prep: 15 },
            { name: "Smoked Chicken", price: 14.99, prep: 12 },
            { name: "Burnt Ends", price: 16.99, prep: 10 },
            { name: "Coleslaw", price: 4.99, prep: 3 },
            { name: "Baked Beans", price: 4.99, prep: 3 },
            { name: "Cornbread", price: 3.99, prep: 3 },
            { name: "Mac & Cheese", price: 5.99, prep: 5 },
            { name: "Banana Pudding", price: 5.99, prep: 3 }
        ]
    },
    // Seafood
    seafood: {
        items: [
            { name: "Fish & Chips", price: 15.99, prep: 12 },
            { name: "Grilled Salmon", price: 22.99, prep: 15 },
            { name: "Shrimp Scampi", price: 19.99, prep: 12 },
            { name: "Lobster Roll", price: 24.99, prep: 10 },
            { name: "Crab Cakes", price: 18.99, prep: 12 },
            { name: "Fried Calamari", price: 12.99, prep: 8 },
            { name: "Clam Chowder", price: 8.99, prep: 6 },
            { name: "Oysters (6)", price: 16.99, prep: 5 },
            { name: "Tartar Sauce", price: 1.99, prep: 1 },
            { name: "Key Lime Pie", price: 7.99, prep: 3 }
        ]
    },
    // Breakfast
    breakfast: {
        items: [
            { name: "Pancakes (Stack of 3)", price: 10.99, prep: 10 },
            { name: "Belgian Waffle", price: 11.99, prep: 10 },
            { name: "Eggs Benedict", price: 14.99, prep: 12 },
            { name: "Omelette", price: 12.99, prep: 10 },
            { name: "French Toast", price: 10.99, prep: 8 },
            { name: "Bacon & Eggs", price: 11.99, prep: 10 },
            { name: "Breakfast Burrito", price: 10.99, prep: 8 },
            { name: "Hash Browns", price: 4.99, prep: 5 },
            { name: "Fresh Fruit Cup", price: 5.99, prep: 3 },
            { name: "Orange Juice", price: 3.99, prep: 2 },
            { name: "Coffee", price: 2.99, prep: 2 }
        ]
    },
    // Default/Generic Restaurant
    default: {
        items: [
            { name: "House Special", price: 15.99, prep: 12 },
            { name: "Chef's Salad", price: 11.99, prep: 6 },
            { name: "Grilled Chicken", price: 14.99, prep: 12 },
            { name: "Steak Dinner", price: 24.99, prep: 18 },
            { name: "Pasta Primavera", price: 13.99, prep: 10 },
            { name: "Soup & Sandwich", price: 10.99, prep: 8 },
            { name: "Side Salad", price: 5.99, prep: 3 },
            { name: "Bread Basket", price: 4.99, prep: 3 },
            { name: "Dessert of the Day", price: 7.99, prep: 4 },
            { name: "Soft Drink", price: 2.99, prep: 1 }
        ]
    }
};

// Customer names for orders
const customerNames = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Christopher", "Karen", "Charles", "Nancy", "Daniel", "Lisa",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
    "Kevin", "Dorothy", "Brian", "Carol", "George", "Amanda", "Edward", "Melissa"
];

// Street name suffixes for delivery addresses
const streetSuffixes = ["St", "Ave", "Blvd", "Dr", "Ln", "Ct", "Way", "Pl", "Rd"];
const streetNames = [
    "Oak", "Maple", "Cedar", "Pine", "Elm", "Birch", "Walnut", "Cherry", "Willow",
    "Main", "Park", "Lake", "Hill", "River", "Valley", "Forest", "Sunset", "Spring",
    "Washington", "Lincoln", "Jefferson", "Madison", "Monroe", "Jackson", "Adams"
];

// ============================================
// ORDER & MENU GENERATION
// ============================================

// Map restaurant types from Google Places to menu categories
function getMenuCategory(restaurant) {
    const name = (restaurant.name || '').toLowerCase();
    const types = restaurant.types || [];

    // Check name for specific cuisine keywords
    if (name.includes('pizza') || name.includes('pizzeria')) return 'pizza';
    if (name.includes('burger') || name.includes('shake shack') || name.includes('five guys') || name.includes('wendy')) return 'burger';
    if (name.includes('taco') || name.includes('chipotle') || name.includes('qdoba') || name.includes('mexican')) return 'mexican';
    if (name.includes('chinese') || name.includes('panda') || name.includes('wok')) return 'chinese';
    if (name.includes('sushi') || name.includes('japanese') || name.includes('ramen') || name.includes('teriyaki')) return 'japanese';
    if (name.includes('italian') || name.includes('pasta') || name.includes('olive garden')) return 'italian';
    if (name.includes('starbucks') || name.includes('dunkin') || name.includes('coffee') || name.includes('cafe')) return 'cafe';
    if (name.includes('indian') || name.includes('curry') || name.includes('tikka')) return 'indian';
    if (name.includes('thai') || name.includes('pad thai')) return 'thai';
    if (name.includes('bbq') || name.includes('barbecue') || name.includes('smokehouse')) return 'bbq';
    if (name.includes('seafood') || name.includes('fish') || name.includes('lobster') || name.includes('crab')) return 'seafood';
    if (name.includes('breakfast') || name.includes('ihop') || name.includes('denny') || name.includes('waffle')) return 'breakfast';
    if (name.includes('wing') || name.includes('chicken')) return 'american';

    // Check Google Places types
    if (types.includes('cafe')) return 'cafe';
    if (types.includes('bakery')) return 'cafe';

    return 'default';
}

// Generate a realistic order from a restaurant
function generateOrder(restaurant) {
    const category = getMenuCategory(restaurant);
    const menu = menuDatabase[category] || menuDatabase.default;
    const customer = customerNames[Math.floor(Math.random() * customerNames.length)];

    // Generate random delivery location
    const deliveryLocation = generateDeliveryLocation(restaurant);

    // Select 1-4 items for the order
    const numItems = Math.floor(Math.random() * 3) + 1;
    const orderItems = [];
    const usedItems = new Set();

    for (let i = 0; i < numItems; i++) {
        let item;
        let attempts = 0;
        do {
            item = menu.items[Math.floor(Math.random() * menu.items.length)];
            attempts++;
        } while (usedItems.has(item.name) && attempts < 10);

        if (!usedItems.has(item.name)) {
            usedItems.add(item.name);
            const quantity = Math.random() > 0.8 ? 2 : 1;
            orderItems.push({
                name: item.name,
                price: item.price,
                quantity: quantity,
                prepTime: item.prep
            });
        }
    }

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const prepTime = Math.max(...orderItems.map(item => item.prepTime));
    const basePay = 3.50 + (subtotal * 0.15); // Base delivery fee
    const distanceBonus = calculateDistance(restaurant, deliveryLocation) * 0.02;
    const estimatedPay = basePay + distanceBonus;

    // Estimate delivery time based on distance
    const distance = calculateDistance(restaurant, deliveryLocation);
    const estimatedDeliveryTime = Math.ceil(distance / 5) + prepTime; // Rough estimate

    return {
        id: Date.now() + Math.random(),
        customer: customer,
        restaurant: restaurant,
        items: orderItems,
        subtotal: subtotal,
        deliveryLocation: deliveryLocation,
        estimatedPay: estimatedPay,
        prepTime: prepTime,
        estimatedDeliveryTime: estimatedDeliveryTime,
        distance: distance,
        createdAt: Date.now(),
        status: 'available', // available, accepted, picked_up, delivered
        timeLimit: 180 + estimatedDeliveryTime, // seconds to complete
        bonus: Math.random() > 0.7 ? (Math.random() * 3 + 1).toFixed(2) : 0 // Random bonus tip
    };
}

// Calculate distance between two points
function calculateDistance(point1, point2) {
    const pos1 = latLngToWorld(point1.lat, point1.lon || point1.lng);
    const pos2 = point2.worldPos ? { x: point2.worldPos.x, z: point2.worldPos.z } : latLngToWorld(point2.lat, point2.lng);
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2));
}

// Generate a delivery location near the restaurant but not too close
function generateDeliveryLocation(restaurant) {
    const restaurantWorld = latLngToWorld(restaurant.lat, restaurant.lon);

    // Random distance between 150-600 units away
    const distance = 150 + Math.random() * 450;
    const angle = Math.random() * Math.PI * 2;

    const x = restaurantWorld.x + Math.cos(angle) * distance;
    const z = restaurantWorld.z + Math.sin(angle) * distance;

    // Generate a fake address
    const streetNum = Math.floor(Math.random() * 9000) + 100;
    const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
    const streetSuffix = streetSuffixes[Math.floor(Math.random() * streetSuffixes.length)];
    const address = `${streetNum} ${streetName} ${streetSuffix}`;

    return {
        worldPos: new THREE.Vector3(x, 0, z),
        address: address,
        marker: null,
        label: null
    };
}

// Drone state
const droneState = {
    position: new THREE.Vector3(0, 50, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    rotation: 0, // yaw in radians
    pitch: 0,
    roll: 0,
    altitude: 50
};

// Controls state
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false
};

// Map settings
let spawnLat = 40.7128;
let spawnLng = -74.0060;
const TILE_ZOOM = 16;
const TILE_SIZE = 256;
const WORLD_SCALE = 100; // Scale factor for world units

// ============================================
// Tile Utilities
// ============================================
function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

function tileToLatLng(x, y, zoom) {
    const n = Math.pow(2, zoom);
    const lng = x / n * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
    const lat = latRad * 180 / Math.PI;
    return { lat, lng };
}

function getTileUrl(x, y, zoom) {
    // Using Esri World Imagery (Satellite) tiles - free, no API key required
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

// ============================================
// Scene Setup
// ============================================
function initScene() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue
    // Use exponential fog for smooth horizon fade
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.0006);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    // Main camera - positioned above and behind drone, looking outward
    mainCamera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        15000
    );

    // Minimap camera - top-down perspective view
    minimapCamera = new THREE.PerspectiveCamera(60, 1, 1, 2000);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 10;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    scene.add(directionalLight);

    // Clock for delta time
    clock = new THREE.Clock();
}

// ============================================
// Drone Model
// ============================================
function createDrone() {
    drone = new THREE.Group();

    // Drone body
    const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 2);
    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: 0x333333,
        specular: 0x666666,
        shininess: 30
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    drone.add(body);

    // Central top piece
    const topGeometry = new THREE.BoxGeometry(1, 0.3, 1);
    const topMaterial = new THREE.MeshPhongMaterial({ color: 0x00d4ff });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0.4;
    drone.add(top);

    // Camera mount on front
    const cameraMount = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 16, 16),
        new THREE.MeshPhongMaterial({ color: 0x111111 })
    );
    cameraMount.position.set(0, -0.2, 1);
    drone.add(cameraMount);

    // Arms and rotors
    const armPositions = [
        { x: 1.2, z: 1.2 },
        { x: -1.2, z: 1.2 },
        { x: 1.2, z: -1.2 },
        { x: -1.2, z: -1.2 }
    ];

    armPositions.forEach((pos, index) => {
        // Arm
        const armGeometry = new THREE.BoxGeometry(0.15, 0.1, 1.7);
        const armMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const arm = new THREE.Mesh(armGeometry, armMaterial);
        arm.position.set(pos.x / 2, 0, pos.z / 2);
        arm.rotation.y = Math.atan2(pos.x, pos.z);
        arm.castShadow = true;
        drone.add(arm);

        // Motor housing
        const motorGeometry = new THREE.CylinderGeometry(0.2, 0.25, 0.3, 16);
        const motorMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
        const motor = new THREE.Mesh(motorGeometry, motorMaterial);
        motor.position.set(pos.x, 0.15, pos.z);
        motor.castShadow = true;
        drone.add(motor);

        // Rotor
        const rotorGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32);
        const rotorMaterial = new THREE.MeshPhongMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.7
        });
        const rotor = new THREE.Mesh(rotorGeometry, rotorMaterial);
        rotor.position.set(pos.x, 0.35, pos.z);
        rotor.userData.isRotor = true;
        rotor.userData.rotorIndex = index;
        drone.add(rotor);
    });

    // Landing gear
    const legMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
    [-0.8, 0.8].forEach(x => {
        const leg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8),
            legMaterial
        );
        leg.position.set(x, -0.5, 0);
        drone.add(leg);

        const foot = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.05, 1.5),
            legMaterial
        );
        foot.position.set(x, -0.8, 0);
        drone.add(foot);
    });

    // LED lights
    const ledMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const ledGeometry = new THREE.SphereGeometry(0.08, 8, 8);

    // Front LEDs (green)
    const frontLedMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    [-0.5, 0.5].forEach(x => {
        const led = new THREE.Mesh(ledGeometry, frontLedMaterial);
        led.position.set(x, 0, 1.1);
        drone.add(led);
    });

    // Back LEDs (red)
    [-0.5, 0.5].forEach(x => {
        const led = new THREE.Mesh(ledGeometry, ledMaterial);
        led.position.set(x, 0, -1.1);
        drone.add(led);
    });

    drone.position.copy(droneState.position);
    scene.add(drone);
}

// ============================================
// Loading Progress
// ============================================
function updateProgress(status) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingStatus = document.getElementById('loading-status');

    const tileProgress = loadingState.totalTiles > 0
        ? (loadingState.loadedTiles / loadingState.totalTiles) * 90
        : 0;
    const restaurantProgress = loadingState.restaurantsLoaded ? 10 : 0;
    const totalProgress = Math.min(100, tileProgress + restaurantProgress);

    progressBar.style.width = `${totalProgress}%`;
    progressText.textContent = `${Math.round(totalProgress)}%`;
    if (status) loadingStatus.textContent = status;
}

// ============================================
// Map Tiles
// ============================================
function preloadMapTiles() {
    return new Promise((resolve) => {
        const centerTile = latLngToTile(spawnLat, spawnLng, TILE_ZOOM);
        const tileRange = 10;

        // Pre-create shared geometry (reuse for all tiles)
        const sharedGeometry = new THREE.PlaneGeometry(WORLD_SCALE, WORLD_SCALE);

        const tileData = [];

        // Generate tiles in spiral order (center first for faster initial view)
        for (let ring = 0; ring <= tileRange; ring++) {
            for (let dx = -ring; dx <= ring; dx++) {
                for (let dy = -ring; dy <= ring; dy++) {
                    if (Math.abs(dx) === ring || Math.abs(dy) === ring) {
                        tileData.push({ dx, dy, tileX: centerTile.x + dx, tileY: centerTile.y + dy });
                    }
                }
            }
        }

        loadingState.totalTiles = tileData.length;
        loadingState.loadedTiles = 0;
        updateProgress(`Loading map tiles (0/${tileData.length})...`);

        let loadedCount = 0;
        const pendingTiles = [];
        const maxConcurrent = 20; // Load up to 20 tiles simultaneously
        let currentIndex = 0;

        function loadNextTile() {
            if (currentIndex >= tileData.length) return;

            const { dx, dy, tileX, tileY } = tileData[currentIndex++];
            const url = getTileUrl(tileX, tileY, TILE_ZOOM);

            // Use Image for faster loading
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                const texture = new THREE.Texture(img);
                texture.needsUpdate = true;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;

                const material = new THREE.MeshLambertMaterial({
                    map: texture,
                    side: THREE.DoubleSide
                });

                const tile = new THREE.Mesh(sharedGeometry, material);
                tile.rotation.x = -Math.PI / 2;
                tile.position.set(dx * WORLD_SCALE, 0, dy * WORLD_SCALE);
                tile.receiveShadow = true;

                tiles.push({ mesh: tile, texture, dx, dy });

                loadedCount++;
                loadingState.loadedTiles = loadedCount;
                if (loadedCount % 10 === 0 || loadedCount === tileData.length) {
                    updateProgress(`Loading map tiles (${loadedCount}/${tileData.length})...`);
                }

                if (loadedCount === tileData.length) {
                    resolve();
                } else {
                    loadNextTile();
                }
            };

            img.onerror = () => {
                // Create placeholder for failed tile
                const material = new THREE.MeshLambertMaterial({
                    color: 0x3a5f3a,
                    side: THREE.DoubleSide
                });

                const tile = new THREE.Mesh(sharedGeometry, material);
                tile.rotation.x = -Math.PI / 2;
                tile.position.set(dx * WORLD_SCALE, 0, dy * WORLD_SCALE);

                tiles.push({ mesh: tile, texture: null, dx, dy });

                loadedCount++;
                loadingState.loadedTiles = loadedCount;

                if (loadedCount === tileData.length) {
                    resolve();
                } else {
                    loadNextTile();
                }
            };

            img.src = url;
        }

        // Start initial batch of concurrent loads
        for (let i = 0; i < Math.min(maxConcurrent, tileData.length); i++) {
            loadNextTile();
        }
    });
}

function addTilesToScene() {
    tiles.forEach(({ mesh }) => {
        scene.add(mesh);
    });
}

// ============================================
// Restaurant Markers
// ============================================
let restaurantMarkers = [];

function latLngToWorld(lat, lng) {
    // Convert lat/lng to world coordinates relative to spawn point
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(spawnLat * Math.PI / 180);

    const deltaLat = lat - spawnLat;
    const deltaLng = lng - spawnLng;

    // Scale to match our tile system
    const worldX = deltaLng * metersPerDegLng * (WORLD_SCALE / 156543 * Math.pow(2, TILE_ZOOM) / 256);
    const worldZ = -deltaLat * metersPerDegLat * (WORLD_SCALE / 156543 * Math.pow(2, TILE_ZOOM) / 256);

    return { x: worldX, z: worldZ };
}

function getRestaurantThumbnail(restaurant) {
    const name = (restaurant.tags?.name || '').toLowerCase();
    const brand = (restaurant.tags?.brand || '').toLowerCase();
    const cuisine = (restaurant.tags?.cuisine || '').toLowerCase();
    const amenity = restaurant.tags?.amenity || 'restaurant';

    // Check for direct image in OSM data first
    if (restaurant.tags?.image) {
        return restaurant.tags.image;
    }

    // Known chain restaurant logos (using logo.clearbit.com for accurate logos)
    const chainLogos = {
        // Fast Food
        "mcdonald": "https://logo.clearbit.com/mcdonalds.com",
        "burger king": "https://logo.clearbit.com/bk.com",
        "wendy": "https://logo.clearbit.com/wendys.com",
        "taco bell": "https://logo.clearbit.com/tacobell.com",
        "kfc": "https://logo.clearbit.com/kfc.com",
        "kentucky fried": "https://logo.clearbit.com/kfc.com",
        "subway": "https://logo.clearbit.com/subway.com",
        "chick-fil-a": "https://logo.clearbit.com/chick-fil-a.com",
        "popeyes": "https://logo.clearbit.com/popeyes.com",
        "five guys": "https://logo.clearbit.com/fiveguys.com",
        "in-n-out": "https://logo.clearbit.com/in-n-out.com",
        "shake shack": "https://logo.clearbit.com/shakeshack.com",
        "chipotle": "https://logo.clearbit.com/chipotle.com",
        "panda express": "https://logo.clearbit.com/pandaexpress.com",
        "domino": "https://logo.clearbit.com/dominos.com",
        "pizza hut": "https://logo.clearbit.com/pizzahut.com",
        "papa john": "https://logo.clearbit.com/papajohns.com",
        "little caesars": "https://logo.clearbit.com/littlecaesars.com",
        "arby": "https://logo.clearbit.com/arbys.com",
        "sonic": "https://logo.clearbit.com/sonicdrivein.com",
        "dairy queen": "https://logo.clearbit.com/dairyqueen.com",
        "jack in the box": "https://logo.clearbit.com/jackinthebox.com",
        "carl's jr": "https://logo.clearbit.com/carlsjr.com",
        "hardee": "https://logo.clearbit.com/hardees.com",
        "whataburger": "https://logo.clearbit.com/whataburger.com",
        "wingstop": "https://logo.clearbit.com/wingstop.com",
        "buffalo wild wings": "https://logo.clearbit.com/buffalowildwings.com",
        "jersey mike": "https://logo.clearbit.com/jerseymikes.com",
        "jimmy john": "https://logo.clearbit.com/jimmyjohns.com",
        "firehouse subs": "https://logo.clearbit.com/firehousesubs.com",
        "qdoba": "https://logo.clearbit.com/qdoba.com",
        "del taco": "https://logo.clearbit.com/deltaco.com",
        "raising cane": "https://logo.clearbit.com/raisingcanes.com",
        "culver": "https://logo.clearbit.com/culvers.com",
        "zaxby": "https://logo.clearbit.com/zaxbys.com",
        "checkers": "https://logo.clearbit.com/checkers.com",
        "rally": "https://logo.clearbit.com/checkers.com",
        "white castle": "https://logo.clearbit.com/whitecastle.com",
        "krystal": "https://logo.clearbit.com/krystal.com",
        "cook out": "https://logo.clearbit.com/cookout.com",
        "el pollo loco": "https://logo.clearbit.com/elpolloloco.com",
        "church's chicken": "https://logo.clearbit.com/churchs.com",
        "bojangles": "https://logo.clearbit.com/bojangles.com",
        "long john silver": "https://logo.clearbit.com/ljsilvers.com",
        "captain d": "https://logo.clearbit.com/captainds.com",

        // Coffee & Cafes
        "starbucks": "https://logo.clearbit.com/starbucks.com",
        "dunkin": "https://logo.clearbit.com/dunkindonuts.com",
        "tim horton": "https://logo.clearbit.com/timhortons.com",
        "peet's coffee": "https://logo.clearbit.com/peets.com",
        "dutch bros": "https://logo.clearbit.com/dutchbros.com",
        "caribou coffee": "https://logo.clearbit.com/cariboucoffee.com",
        "coffee bean": "https://logo.clearbit.com/coffeebean.com",
        "panera": "https://logo.clearbit.com/panerabread.com",
        "au bon pain": "https://logo.clearbit.com/aubonpain.com",
        "einstein bros": "https://logo.clearbit.com/einsteinbros.com",
        "krispy kreme": "https://logo.clearbit.com/krispykreme.com",
        "baskin": "https://logo.clearbit.com/baskinrobbins.com",
        "cold stone": "https://logo.clearbit.com/coldstonecreamery.com",
        "jamba": "https://logo.clearbit.com/jamba.com",
        "smoothie king": "https://logo.clearbit.com/smoothieking.com",

        // Casual Dining
        "applebee": "https://logo.clearbit.com/applebees.com",
        "chili's": "https://logo.clearbit.com/chilis.com",
        "olive garden": "https://logo.clearbit.com/olivegarden.com",
        "red lobster": "https://logo.clearbit.com/redlobster.com",
        "outback": "https://logo.clearbit.com/outback.com",
        "texas roadhouse": "https://logo.clearbit.com/texasroadhouse.com",
        "longhorn": "https://logo.clearbit.com/longhornsteakhouse.com",
        "red robin": "https://logo.clearbit.com/redrobin.com",
        "buffalo wild": "https://logo.clearbit.com/buffalowildwings.com",
        "hooters": "https://logo.clearbit.com/hooters.com",
        "cheesecake factory": "https://logo.clearbit.com/thecheesecakefactory.com",
        "p.f. chang": "https://logo.clearbit.com/pfchangs.com",
        "benihana": "https://logo.clearbit.com/benihana.com",
        "ihop": "https://logo.clearbit.com/ihop.com",
        "denny": "https://logo.clearbit.com/dennys.com",
        "waffle house": "https://logo.clearbit.com/wafflehouse.com",
        "cracker barrel": "https://logo.clearbit.com/crackerbarrel.com",
        "bob evans": "https://logo.clearbit.com/bobevans.com",
        "perkins": "https://logo.clearbit.com/perkinsrestaurants.com",
        "golden corral": "https://logo.clearbit.com/goldencorral.com",
        "hometown buffet": "https://logo.clearbit.com/hometownbuffet.com",
        "ruby tuesday": "https://logo.clearbit.com/rubytuesday.com",
        "tgi friday": "https://logo.clearbit.com/tgifridays.com",
        "fridays": "https://logo.clearbit.com/tgifridays.com",
        "cheddar": "https://logo.clearbit.com/cheddars.com",
        "bj's restaurant": "https://logo.clearbit.com/bjsrestaurants.com",
        "yard house": "https://logo.clearbit.com/yardhouse.com",
        "maggiano": "https://logo.clearbit.com/maggianos.com",
        "carrabba": "https://logo.clearbit.com/carrabbas.com",
        "bonefish": "https://logo.clearbit.com/bonefishgrill.com",
        "flemings": "https://logo.clearbit.com/flemingssteakhouse.com",
        "morton": "https://logo.clearbit.com/mortons.com",
        "ruth's chris": "https://logo.clearbit.com/ruthschris.com",
        "capital grille": "https://logo.clearbit.com/thecapitalgrille.com",
        "seasons 52": "https://logo.clearbit.com/seasons52.com",
        "bahama breeze": "https://logo.clearbit.com/bahamabreeze.com",
        "noodles & company": "https://logo.clearbit.com/noodles.com",
        "jason's deli": "https://logo.clearbit.com/jasonsdeli.com",
        "mcalister": "https://logo.clearbit.com/mcalistersdeli.com",
        "potbelly": "https://logo.clearbit.com/potbelly.com",
        "zoes kitchen": "https://logo.clearbit.com/zoeskitchen.com",
        "boston market": "https://logo.clearbit.com/bostonmarket.com",
        "marie callender": "https://logo.clearbit.com/mariecallenders.com",
        "sizzler": "https://logo.clearbit.com/sizzler.com",
        "black angus": "https://logo.clearbit.com/blackangus.com",
        "claim jumper": "https://logo.clearbit.com/claimjumper.com",
        "old chicago": "https://logo.clearbit.com/oldchicago.com",
        "uno pizzeria": "https://logo.clearbit.com/unos.com",
        "california pizza kitchen": "https://logo.clearbit.com/cpk.com",
        "blaze pizza": "https://logo.clearbit.com/blazepizza.com",
        "mod pizza": "https://logo.clearbit.com/modpizza.com",
        "pieology": "https://logo.clearbit.com/pieology.com",
        "&pizza": "https://logo.clearbit.com/andpizza.com",

        // Asian
        "panda express": "https://logo.clearbit.com/pandaexpress.com",
        "pei wei": "https://logo.clearbit.com/peiwei.com",
        "noodles": "https://logo.clearbit.com/noodles.com",
        "genghis grill": "https://logo.clearbit.com/genghisgrill.com",
        "wok": "https://logo.clearbit.com/pandaexpress.com",

        // Mexican
        "chipotle": "https://logo.clearbit.com/chipotle.com",
        "moe's": "https://logo.clearbit.com/moes.com",
        "qdoba": "https://logo.clearbit.com/qdoba.com",
        "baja fresh": "https://logo.clearbit.com/bajafresh.com",
        "on the border": "https://logo.clearbit.com/ontheborder.com",
        "chevy's": "https://logo.clearbit.com/chevys.com",
        "el torito": "https://logo.clearbit.com/eltorito.com",
        "rubio": "https://logo.clearbit.com/rubios.com"
    };

    // Check brand and name against known chains
    const searchTerms = [brand, name];
    for (const term of searchTerms) {
        for (const [chain, logo] of Object.entries(chainLogos)) {
            if (term.includes(chain)) {
                return logo;
            }
        }
    }

    // Cuisine-based fallback images
    const cuisineImages = {
        'italian': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&h=100&fit=crop',
        'pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&h=100&fit=crop',
        'chinese': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=100&h=100&fit=crop',
        'japanese': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=100&h=100&fit=crop',
        'sushi': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=100&h=100&fit=crop',
        'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=100&h=100&fit=crop',
        'korean': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=100&h=100&fit=crop',
        'vietnamese': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&h=100&fit=crop',
        'pho': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=100&h=100&fit=crop',
        'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=100&h=100&fit=crop',
        'taco': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=100&h=100&fit=crop',
        'burrito': 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=100&h=100&fit=crop',
        'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&h=100&fit=crop',
        'american': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&h=100&fit=crop',
        'bbq': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=100&h=100&fit=crop',
        'barbecue': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=100&h=100&fit=crop',
        'steak': 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=100&h=100&fit=crop',
        'seafood': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=100&h=100&fit=crop',
        'fish': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=100&h=100&fit=crop',
        'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=100&h=100&fit=crop',
        'curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=100&h=100&fit=crop',
        'thai': 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=100&h=100&fit=crop',
        'french': 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100&h=100&fit=crop',
        'mediterranean': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=100&h=100&fit=crop',
        'greek': 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=100&h=100&fit=crop',
        'middle eastern': 'https://images.unsplash.com/photo-1547424850-a9f79dc25eb2?w=100&h=100&fit=crop',
        'lebanese': 'https://images.unsplash.com/photo-1547424850-a9f79dc25eb2?w=100&h=100&fit=crop',
        'falafel': 'https://images.unsplash.com/photo-1593001874117-c99c800e3eb7?w=100&h=100&fit=crop',
        'sandwich': 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=100&h=100&fit=crop',
        'deli': 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=100&h=100&fit=crop',
        'chicken': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=100&h=100&fit=crop',
        'wings': 'https://images.unsplash.com/photo-1569058242567-93de6f36f8eb?w=100&h=100&fit=crop',
        'fried chicken': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=100&h=100&fit=crop',
        'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=100&h=100&fit=crop',
        'brunch': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=100&h=100&fit=crop',
        'pancake': 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=100&h=100&fit=crop',
        'waffle': 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=100&h=100&fit=crop',
        'donut': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=100&h=100&fit=crop',
        'doughnut': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=100&h=100&fit=crop',
        'bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&h=100&fit=crop',
        'pastry': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100&h=100&fit=crop',
        'dessert': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=100&h=100&fit=crop',
        'ice cream': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=100&h=100&fit=crop',
        'gelato': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=100&h=100&fit=crop',
        'frozen yogurt': 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=100&h=100&fit=crop',
        'smoothie': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=100&h=100&fit=crop',
        'juice': 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=100&h=100&fit=crop',
        'coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&h=100&fit=crop',
        'tea': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=100&h=100&fit=crop',
        'bubble tea': 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=100&h=100&fit=crop',
        'boba': 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=100&h=100&fit=crop',
        'vegan': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=100&h=100&fit=crop',
        'vegetarian': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=100&h=100&fit=crop',
        'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=100&h=100&fit=crop',
        'healthy': 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=100&h=100&fit=crop',
        'organic': 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=100&h=100&fit=crop',
        'soul food': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=100&h=100&fit=crop',
        'southern': 'https://images.unsplash.com/photo-1632778149955-e80f8ceca2e8?w=100&h=100&fit=crop',
        'cajun': 'https://images.unsplash.com/photo-1616645258469-ec681c17f3ee?w=100&h=100&fit=crop',
        'creole': 'https://images.unsplash.com/photo-1616645258469-ec681c17f3ee?w=100&h=100&fit=crop',
        'spanish': 'https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=100&h=100&fit=crop',
        'tapas': 'https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=100&h=100&fit=crop',
        'latin': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=100&h=100&fit=crop',
        'brazilian': 'https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?w=100&h=100&fit=crop',
        'peruvian': 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=100&h=100&fit=crop',
        'caribbean': 'https://images.unsplash.com/photo-1625938145744-e380515399bf?w=100&h=100&fit=crop',
        'jamaican': 'https://images.unsplash.com/photo-1625938145744-e380515399bf?w=100&h=100&fit=crop',
        'cuban': 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=100&h=100&fit=crop',
        'ethiopian': 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=100&h=100&fit=crop',
        'african': 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?w=100&h=100&fit=crop',
        'german': 'https://images.unsplash.com/photo-1599921841143-819065a55cc6?w=100&h=100&fit=crop',
        'british': 'https://images.unsplash.com/photo-1577906096429-f73c2c312435?w=100&h=100&fit=crop',
        'irish': 'https://images.unsplash.com/photo-1577906096429-f73c2c312435?w=100&h=100&fit=crop',
        'pub': 'https://images.unsplash.com/photo-1577906096429-f73c2c312435?w=100&h=100&fit=crop',
        'bar': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=100&h=100&fit=crop',
        'sports bar': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=100&h=100&fit=crop',
        'brewery': 'https://images.unsplash.com/photo-1532634922-8fe0b757fb13?w=100&h=100&fit=crop',
        'gastropub': 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=100&h=100&fit=crop',
        'wine': 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=100&h=100&fit=crop',
        'hot dog': 'https://images.unsplash.com/photo-1612392062126-3e9f3c5e0173?w=100&h=100&fit=crop',
        'pretzel': 'https://images.unsplash.com/photo-1600617757645-8c364f7ebf41?w=100&h=100&fit=crop',
        'bagel': 'https://images.unsplash.com/photo-1585445490387-f47934b73b54?w=100&h=100&fit=crop',
        'noodle': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=100&h=100&fit=crop',
        'dim sum': 'https://images.unsplash.com/photo-1576577445504-6af96477db52?w=100&h=100&fit=crop',
        'dumpling': 'https://images.unsplash.com/photo-1576577445504-6af96477db52?w=100&h=100&fit=crop',
        'poke': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop',
        'hawaiian': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop',
        'filipino': 'https://images.unsplash.com/photo-1623689048105-a17b1e1936b8?w=100&h=100&fit=crop',
        'indonesian': 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=100&h=100&fit=crop',
        'malaysian': 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=100&h=100&fit=crop',
        'singaporean': 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=100&h=100&fit=crop'
    };

    // Check for matching cuisine
    for (const [key, url] of Object.entries(cuisineImages)) {
        if (cuisine.includes(key)) return url;
    }

    // Default by amenity type
    if (amenity === 'cafe') {
        return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=100&h=100&fit=crop';
    } else if (amenity === 'fast_food') {
        return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&h=100&fit=crop';
    }

    // Generic restaurant
    return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop';
}

// Google Places Service (initialized after map loads)
let placesService = null;

function initPlacesService() {
    // Create a dummy map div for the Places service (required by Google)
    const mapDiv = document.createElement('div');
    mapDiv.style.display = 'none';
    document.body.appendChild(mapDiv);

    const map = new google.maps.Map(mapDiv, {
        center: { lat: spawnLat, lng: spawnLng },
        zoom: 15
    });

    placesService = new google.maps.places.PlacesService(map);
}

function searchPlacesPromise(request) {
    return new Promise((resolve, reject) => {
        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                resolve(results);
            } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                resolve([]);
            } else {
                reject(new Error(`Places search failed: ${status}`));
            }
        });
    });
}

function getPlaceDetailsPromise(placeId) {
    return new Promise((resolve, reject) => {
        const request = {
            placeId: placeId,
            fields: [
                'name', 'rating', 'user_ratings_total', 'price_level',
                'photos', 'formatted_address', 'formatted_phone_number',
                'opening_hours', 'website', 'url', 'reviews', 'types',
                'geometry'
            ]
        };

        placesService.getDetails(request, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                resolve(place);
            } else {
                reject(new Error(`Place details failed: ${status}`));
            }
        });
    });
}

// Parallel task runner with concurrency limit
async function runParallel(tasks, concurrency = 5) {
    const results = [];
    const executing = new Set();

    for (const task of tasks) {
        const promise = Promise.resolve().then(() => task());
        results.push(promise);
        executing.add(promise);

        const cleanup = () => executing.delete(promise);
        promise.then(cleanup, cleanup);

        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }

    return Promise.allSettled(results);
}

async function preloadRestaurants() {
    updateProgress('Initializing Google Places...');

    // Initialize Places service
    initPlacesService();

    const types = ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway'];
    const allPlaces = [];
    const seenIds = new Set();

    // Search in multiple points to cover the map area
    const searchRadius = 2500;
    const gridOffsets = [
        { lat: 0, lng: 0 },
        { lat: 0.02, lng: 0 },
        { lat: -0.02, lng: 0 },
        { lat: 0, lng: 0.028 },
        { lat: 0, lng: -0.028 },
        { lat: 0.02, lng: 0.028 },
        { lat: 0.02, lng: -0.028 },
        { lat: -0.02, lng: 0.028 },
        { lat: -0.02, lng: -0.028 },
        { lat: 0.04, lng: 0 },
        { lat: -0.04, lng: 0 },
        { lat: 0, lng: 0.055 },
        { lat: 0, lng: -0.055 }
    ];

    try {
        // Build all search tasks
        const searchTasks = [];
        for (const offset of gridOffsets) {
            const point = {
                lat: spawnLat + offset.lat,
                lng: spawnLng + offset.lng
            };

            for (const type of types) {
                searchTasks.push(() => {
                    const request = {
                        location: new google.maps.LatLng(point.lat, point.lng),
                        radius: searchRadius,
                        type: type
                    };
                    return searchPlacesPromise(request).catch(() => []);
                });
            }
        }

        updateProgress(`Discovering restaurants (${searchTasks.length} searches)...`);

        // Run searches in parallel with concurrency limit of 8
        let completedSearches = 0;
        const searchResults = await runParallel(
            searchTasks.map(task => async () => {
                const result = await task();
                completedSearches++;
                updateProgress(`Discovering restaurants... (${completedSearches}/${searchTasks.length})`);
                return result;
            }),
            8 // 8 concurrent searches
        );

        // Collect unique places
        for (const result of searchResults) {
            if (result.status === 'fulfilled' && result.value) {
                for (const place of result.value) {
                    if (!seenIds.has(place.place_id)) {
                        seenIds.add(place.place_id);
                        allPlaces.push(place);
                    }
                }
            }
        }

        updateProgress(`Found ${allPlaces.length} places, ranking by popularity...`);

        // Calculate popularity score: rating × log(reviews + 1) × operational bonus
        allPlaces.forEach(place => {
            const rating = place.rating || 0;
            const reviews = place.user_ratings_total || 0;
            const isOpen = place.opening_hours?.isOpen?.() ? 1.1 : 1;
            const hasPhotos = place.photos?.length > 0 ? 1.2 : 1;

            place.popularityScore = rating * Math.log10(reviews + 1) * isOpen * hasPhotos;
        });

        // Sort by popularity score
        allPlaces.sort((a, b) => b.popularityScore - a.popularityScore);

        // Take top 25% most popular (minimum 20, maximum 150)
        const topCount = Math.min(150, Math.max(20, Math.ceil(allPlaces.length * 0.25)));
        const topRestaurants = allPlaces.slice(0, topCount);

        updateProgress(`Loading details for ${topCount} restaurants...`);

        // Build detail fetch tasks
        let completedDetails = 0;
        const detailTasks = topRestaurants.map(place => async () => {
            try {
                const details = await getPlaceDetailsPromise(place.place_id);

                let photoUrl = null;
                if (details.photos && details.photos.length > 0) {
                    photoUrl = details.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 });
                }

                let openStatus = null;
                if (details.opening_hours) {
                    openStatus = details.opening_hours.isOpen() ? 'Open Now' : 'Closed';
                }

                let topReview = null;
                if (details.reviews && details.reviews.length > 0) {
                    const sortedReviews = [...details.reviews].sort((a, b) => b.rating - a.rating);
                    topReview = sortedReviews[0].text?.substring(0, 100);
                }

                completedDetails++;
                updateProgress(`Loading restaurants... (${completedDetails}/${topCount})`);

                return {
                    lat: details.geometry.location.lat(),
                    lon: details.geometry.location.lng(),
                    name: details.name,
                    rating: details.rating,
                    userRatingsTotal: details.user_ratings_total,
                    priceLevel: details.price_level,
                    photoUrl: photoUrl,
                    types: details.types,
                    address: details.formatted_address,
                    phone: details.formatted_phone_number,
                    website: details.website,
                    googleUrl: details.url,
                    openStatus: openStatus,
                    topReview: topReview,
                    placeId: place.place_id,
                    popularityScore: place.popularityScore
                };
            } catch (e) {
                // Fall back to basic info
                let photoUrl = null;
                if (place.photos && place.photos.length > 0) {
                    photoUrl = place.photos[0].getUrl({ maxWidth: 400, maxHeight: 400 });
                }

                completedDetails++;
                updateProgress(`Loading restaurants... (${completedDetails}/${topCount})`);

                return {
                    lat: place.geometry.location.lat(),
                    lon: place.geometry.location.lng(),
                    name: place.name,
                    rating: place.rating,
                    userRatingsTotal: place.user_ratings_total,
                    priceLevel: place.price_level,
                    photoUrl: photoUrl,
                    types: place.types,
                    vicinity: place.vicinity,
                    placeId: place.place_id,
                    popularityScore: place.popularityScore
                };
            }
        });

        // Run detail fetches in parallel with concurrency limit of 10
        const detailResults = await runParallel(detailTasks, 10);

        const detailedRestaurants = detailResults
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value);

        loadingState.restaurants = detailedRestaurants;
        loadingState.restaurantsLoaded = true;
        updateProgress(`Loaded ${detailedRestaurants.length} top restaurants!`);

        console.log(`Google Places: Found ${allPlaces.length} total, detailed ${detailedRestaurants.length}`);

    } catch (error) {
        console.warn('Could not load restaurants:', error);
        loadingState.restaurantsLoaded = true;
        updateProgress('Restaurants unavailable');
    }
}

function createRestaurantMarkers() {
    loadingState.restaurants.forEach(restaurant => {
        createRestaurantMarker(restaurant);
    });
}

function createRestaurantMarker(restaurant) {
    const worldPos = latLngToWorld(restaurant.lat, restaurant.lon);
    const name = restaurant.name || 'Restaurant';
    const rating = restaurant.rating;
    const reviewCount = restaurant.userRatingsTotal;
    const priceLevel = restaurant.priceLevel;
    const openStatus = restaurant.openStatus;
    const address = restaurant.address || restaurant.vicinity || '';

    // Get photo URL from Google Places or fallback
    let thumbnailUrl;
    if (restaurant.photoUrl) {
        thumbnailUrl = restaurant.photoUrl;
    } else {
        // Fallback to cuisine-based image
        thumbnailUrl = getRestaurantThumbnail({
            tags: {
                name: name,
                cuisine: restaurant.types?.join(',') || ''
            }
        });
    }

    // Color based on rating
    let pinColor = 0xff4444; // Default red
    if (rating >= 4.5) pinColor = 0x00cc00; // Green for excellent
    else if (rating >= 4.0) pinColor = 0x88cc00; // Yellow-green for great
    else if (rating >= 3.5) pinColor = 0xffcc00; // Yellow for good
    else if (rating >= 3.0) pinColor = 0xff8800; // Orange for okay

    const markerGroup = new THREE.Group();

    // Pin base (cylinder)
    const pinGeometry = new THREE.CylinderGeometry(0.8, 0.8, 25, 12);
    const pinMaterial = new THREE.MeshPhongMaterial({ color: pinColor });
    const pin = new THREE.Mesh(pinGeometry, pinMaterial);
    pin.position.y = 12.5;
    markerGroup.add(pin);

    // Pin head (sphere) - larger for visibility
    const headGeometry = new THREE.SphereGeometry(4, 16, 16);
    const headMaterial = new THREE.MeshPhongMaterial({
        color: pinColor,
        emissive: pinColor,
        emissiveIntensity: 0.3
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 29;
    markerGroup.add(head);

    // Add rating ring around head
    if (rating) {
        const ringGeometry = new THREE.TorusGeometry(5, 0.3, 8, 32);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.y = 29;
        ring.rotation.x = Math.PI / 2;
        markerGroup.add(ring);
    }

    markerGroup.position.set(worldPos.x, 0, worldPos.z);

    // Store data for label
    markerGroup.userData = {
        name: name,
        rating: rating,
        reviewCount: reviewCount,
        thumbnail: thumbnailUrl,
        worldPos: new THREE.Vector3(worldPos.x, 35, worldPos.z)
    };

    scene.add(markerGroup);
    restaurantMarkers.push(markerGroup);

    // Format price level
    const priceStr = priceLevel ? '$'.repeat(priceLevel) : '';

    // Format rating
    const ratingStr = rating ? `⭐ ${rating.toFixed(1)}` : '';
    const reviewStr = reviewCount ? `(${reviewCount.toLocaleString()} reviews)` : '';

    // Format open status
    const openClass = openStatus === 'Open Now' ? 'open' : 'closed';
    const openHtml = openStatus ? `<div class="open-status ${openClass}">${openStatus}</div>` : '';

    // Get short address (just street)
    const shortAddress = address.split(',')[0] || '';

    // Get restaurant type
    const typeStr = restaurant.types?.find(t =>
        ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway'].includes(t)
    ) || 'restaurant';
    const typeDisplay = typeStr.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Create HTML label with rich info
    const label = document.createElement('div');
    label.className = 'restaurant-label';
    label.innerHTML = `
        <img src="${thumbnailUrl}" alt="${name}" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'">
        <div class="name">${name.length > 24 ? name.substring(0, 24) + '...' : name}</div>
        <div class="type-badge">${typeDisplay}</div>
        <div class="rating">${ratingStr} ${reviewStr}</div>
        <div class="price-row">
            <span class="price">${priceStr || 'Price N/A'}</span>
            ${openHtml}
        </div>
        ${shortAddress ? `<div class="address">${shortAddress}</div>` : ''}
    `;
    label.style.display = 'none';
    document.body.appendChild(label);

    restaurantLabels.push({
        element: label,
        marker: markerGroup
    });
}

function updateRestaurantLabels() {
    // Skip if in navigation mode (active delivery)
    if (gameState.currentOrder) {
        return;
    }

    restaurantLabels.forEach(({ element, marker }) => {
        // Skip if marker is hidden
        if (!marker.visible) {
            element.style.display = 'none';
            return;
        }

        const pos = marker.userData.worldPos.clone();
        pos.project(mainCamera);

        // Check if in front of camera
        if (pos.z > 1) {
            element.style.display = 'none';
            return;
        }

        // Calculate distance to hide far labels
        const distance = marker.position.distanceTo(droneState.position);
        if (distance > 300) {
            element.style.display = 'none';
            return;
        }

        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;

        // Check if on screen
        if (x < -100 || x > window.innerWidth + 100 || y < -100 || y > window.innerHeight + 100) {
            element.style.display = 'none';
            return;
        }

        element.style.display = 'block';
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;

        // Scale based on distance
        const scale = Math.max(0.5, Math.min(1, 150 / distance));
        element.style.transform = `translate(-50%, -100%) scale(${scale})`;
    });
}

// ============================================
// Controls
// ============================================
function setupControls() {
    document.addEventListener('keydown', (e) => {
        if (keys.hasOwnProperty(e.code)) {
            keys[e.code] = true;
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (keys.hasOwnProperty(e.code)) {
            keys[e.code] = false;
            e.preventDefault();
        }
    });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    mainCamera.aspect = window.innerWidth / window.innerHeight;
    mainCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================
// Physics & Movement
// ============================================
function updateDrone(delta) {
    const acceleration = 400;
    const turnSpeed = 3;
    const verticalSpeed = 150;
    const drag = 0.99;
    const maxSpeed = 600;

    // Calculate forward direction based on drone rotation
    const forward = new THREE.Vector3(
        Math.sin(droneState.rotation),
        0,
        Math.cos(droneState.rotation)
    );

    const right = new THREE.Vector3(
        Math.cos(droneState.rotation),
        0,
        -Math.sin(droneState.rotation)
    );

    // Arrow keys: Forward/Back and Turn
    if (keys.ArrowUp) {
        droneState.velocity.add(forward.clone().multiplyScalar(acceleration * delta));
        droneState.pitch = THREE.MathUtils.lerp(droneState.pitch, -0.2, 0.1);
    } else if (keys.ArrowDown) {
        droneState.velocity.add(forward.clone().multiplyScalar(-acceleration * delta * 0.7));
        droneState.pitch = THREE.MathUtils.lerp(droneState.pitch, 0.15, 0.1);
    } else {
        droneState.pitch = THREE.MathUtils.lerp(droneState.pitch, 0, 0.05);
    }

    if (keys.ArrowLeft) {
        droneState.rotation += turnSpeed * delta;
        droneState.roll = THREE.MathUtils.lerp(droneState.roll, 0.3, 0.1);
    } else if (keys.ArrowRight) {
        droneState.rotation -= turnSpeed * delta;
        droneState.roll = THREE.MathUtils.lerp(droneState.roll, -0.3, 0.1);
    } else {
        droneState.roll = THREE.MathUtils.lerp(droneState.roll, 0, 0.05);
    }

    // WASD: Altitude and Strafe
    if (keys.KeyW) {
        droneState.velocity.y += verticalSpeed * delta;
    }
    if (keys.KeyS) {
        droneState.velocity.y -= verticalSpeed * delta;
    }
    if (keys.KeyA) {
        droneState.velocity.add(right.clone().multiplyScalar(-acceleration * delta * 0.5));
    }
    if (keys.KeyD) {
        droneState.velocity.add(right.clone().multiplyScalar(acceleration * delta * 0.5));
    }

    // Apply drag
    droneState.velocity.multiplyScalar(drag);

    // Clamp speed
    const horizontalVel = new THREE.Vector2(droneState.velocity.x, droneState.velocity.z);
    if (horizontalVel.length() > maxSpeed) {
        horizontalVel.normalize().multiplyScalar(maxSpeed);
        droneState.velocity.x = horizontalVel.x;
        droneState.velocity.z = horizontalVel.y;
    }

    // Update position
    droneState.position.add(droneState.velocity.clone().multiplyScalar(delta));

    // Ground collision
    if (droneState.position.y < 2) {
        droneState.position.y = 2;
        droneState.velocity.y = 0;
    }

    // Max altitude
    if (droneState.position.y > 300) {
        droneState.position.y = 300;
        droneState.velocity.y = 0;
    }

    droneState.altitude = droneState.position.y;

    // Update drone mesh
    drone.position.copy(droneState.position);
    drone.rotation.set(droneState.pitch, droneState.rotation, droneState.roll);

    // Spin rotors
    drone.children.forEach(child => {
        if (child.userData.isRotor) {
            const direction = child.userData.rotorIndex % 2 === 0 ? 1 : -1;
            child.rotation.y += direction * 30 * delta;
        }
    });
}

// ============================================
// Camera Updates
// ============================================
function updateCameras() {
    // Main camera: Above and behind drone, looking outward in drone's direction
    const cameraDistance = 15;
    const cameraHeight = 8;

    const offsetX = -Math.sin(droneState.rotation) * cameraDistance;
    const offsetZ = -Math.cos(droneState.rotation) * cameraDistance;

    mainCamera.position.set(
        droneState.position.x + offsetX,
        droneState.position.y + cameraHeight,
        droneState.position.z + offsetZ
    );

    // Look ahead and slightly downward from the drone
    const lookAtX = droneState.position.x + Math.sin(droneState.rotation) * 30;
    const lookAtZ = droneState.position.z + Math.cos(droneState.rotation) * 30;
    mainCamera.lookAt(lookAtX, droneState.position.y - 15, lookAtZ);

    // Minimap camera: Above drone looking straight down at the ground
    minimapCamera.position.set(
        droneState.position.x,
        droneState.position.y + 200,
        droneState.position.z
    );
    minimapCamera.lookAt(
        droneState.position.x,
        0,
        droneState.position.z
    );
}

// ============================================
// HUD Update
// ============================================
function updateHUD() {
    document.getElementById('altitude').textContent = Math.round(droneState.altitude);

    const speed = Math.sqrt(
        droneState.velocity.x ** 2 +
        droneState.velocity.z ** 2
    );
    document.getElementById('speed').textContent = speed.toFixed(1);

    let heading = THREE.MathUtils.radToDeg(droneState.rotation) % 360;
    if (heading < 0) heading += 360;
    document.getElementById('heading').textContent = Math.round(heading);
}

// ============================================
// Animation Loop
// ============================================
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    updateDrone(delta);
    updateCameras();
    updateHUD();
    updateRestaurantLabels();
    updateGame(delta);

    // Render main view
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.render(scene, mainCamera);

    // Render minimap (disable fog for top-down view)
    const minimapSize = 250;
    const minimapX = window.innerWidth - minimapSize - 20;
    const minimapY = window.innerHeight - minimapSize - 20;

    const fogBackup = scene.fog;
    scene.fog = null;

    renderer.setViewport(minimapX, minimapY, minimapSize, minimapSize);
    renderer.setScissor(minimapX, minimapY, minimapSize, minimapSize);
    renderer.clear(true, true, true);
    renderer.render(scene, minimapCamera);

    scene.fog = fogBackup;
}

// ============================================
// Modal & Initialization
// ============================================
async function geocodeLocation(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'DroneSimulator/1.0'
        }
    });

    if (!response.ok) {
        throw new Error('Geocoding request failed');
    }

    const data = await response.json();

    if (data.length === 0) {
        throw new Error('Location not found');
    }

    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
    };
}

function setupModal() {
    const modal = document.getElementById('spawn-modal');
    const startBtn = document.getElementById('start-btn');
    const presetBtns = document.querySelectorAll('.preset-btn');
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const searchInput = document.getElementById('location-search');
    const searchBtn = document.getElementById('search-btn');
    const searchStatus = document.getElementById('search-status');

    // Location search handler
    async function handleSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        searchBtn.disabled = true;
        searchBtn.textContent = '...';
        searchStatus.textContent = 'Searching...';
        searchStatus.classList.remove('error');

        try {
            const result = await geocodeLocation(query);
            latInput.value = result.lat.toFixed(6);
            lngInput.value = result.lng.toFixed(6);
            searchStatus.textContent = `Found: ${result.displayName.substring(0, 50)}...`;
        } catch (error) {
            searchStatus.textContent = error.message;
            searchStatus.classList.add('error');
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = 'Search';
        }
    }

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Preset button handlers
    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            latInput.value = btn.dataset.lat;
            lngInput.value = btn.dataset.lng;
            searchStatus.textContent = '';
        });
    });

    // Start simulation
    startBtn.addEventListener('click', async () => {
        spawnLat = parseFloat(latInput.value) || 40.7128;
        spawnLng = parseFloat(lngInput.value) || -74.0060;

        modal.classList.add('hidden');
        document.getElementById('loading-modal').classList.remove('hidden');

        await startSimulation();
    });
}

async function startSimulation() {
    // Initialize scene first
    initScene();

    // Preload all assets in parallel
    updateProgress('Initializing...');

    await Promise.all([
        preloadMapTiles(),
        preloadRestaurants()
    ]);

    updateProgress('Building world...');

    // Add everything to scene
    addTilesToScene();
    createDrone();
    createRestaurantMarkers();
    createDirectionArrow(); // Arrow showing drone direction on minimap
    setupControls();

    // Hide loading, show HUD
    updateProgress('Ready!');
    await new Promise(r => setTimeout(r, 500));

    document.getElementById('loading-modal').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('minimap-container').style.display = 'block';

    // Show start game button
    document.getElementById('start-game-container').classList.remove('hidden');

    // Setup game controls
    setupGameControls();

    // Start animation
    animate();
}

// ============================================
// DRONE DASH GAME MECHANICS
// ============================================

// Active delivery markers
let pickupMarker = null;
let pickupLabel = null;
let deliveryMarkerMesh = null;
let deliveryLabelElement = null;

// Navigation line for minimap
let navigationLine = null;

// Hide/show restaurant markers during navigation
function setRestaurantMarkersVisible(visible) {
    restaurantMarkers.forEach(marker => {
        marker.visible = visible;
    });
    restaurantLabels.forEach(({ element }) => {
        element.style.display = visible ? '' : 'none';
    });
}

// Create/update navigation line from drone to target
function updateNavigationLine(targetPos) {
    if (!targetPos) {
        if (navigationLine) {
            scene.remove(navigationLine);
            navigationLine = null;
        }
        return;
    }

    const points = [
        new THREE.Vector3(droneState.position.x, 5, droneState.position.z),
        new THREE.Vector3(targetPos.x, 5, targetPos.z)
    ];

    if (navigationLine) {
        // Update existing line
        navigationLine.geometry.dispose();
        navigationLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
    } else {
        // Create new line
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x00ff88,
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });
        navigationLine = new THREE.Line(geometry, material);
        scene.add(navigationLine);
    }

    // Animate line color based on phase
    if (gameState.currentOrder?.status === 'accepted') {
        navigationLine.material.color.setHex(0xffcc00); // Yellow for pickup
    } else {
        navigationLine.material.color.setHex(0x00ff88); // Green for delivery
    }
}

// Create direction arrow for minimap
let directionArrow = null;

function createDirectionArrow() {
    const arrowGroup = new THREE.Group();

    // Arrow body
    const bodyGeometry = new THREE.CylinderGeometry(2, 2, 20, 8);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2;
    body.position.z = 10;
    arrowGroup.add(body);

    // Arrow head
    const headGeometry = new THREE.ConeGeometry(5, 10, 8);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.rotation.x = Math.PI / 2;
    head.position.z = 25;
    arrowGroup.add(head);

    directionArrow = arrowGroup;
    scene.add(directionArrow);
}

function updateDirectionArrow() {
    if (!directionArrow) return;

    directionArrow.position.set(
        droneState.position.x,
        10,
        droneState.position.z
    );
    directionArrow.rotation.y = -droneState.rotation;
}

// Create pickup marker at restaurant
function createPickupMarker(restaurant) {
    const worldPos = latLngToWorld(restaurant.lat, restaurant.lon);

    // Create 3D marker (tall yellow cylinder with pulsing ring)
    const markerGroup = new THREE.Group();

    // Vertical beam
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 60, 16);
    const beamMaterial = new THREE.MeshPhongMaterial({
        color: 0xffcc00,
        emissive: 0xffcc00,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = 30;
    markerGroup.add(beam);

    // Pulsing ring at top
    const ringGeometry = new THREE.TorusGeometry(8, 1, 8, 32);
    const ringMaterial = new THREE.MeshPhongMaterial({
        color: 0xffcc00,
        emissive: 0xffcc00,
        emissiveIntensity: 0.8
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 60;
    ring.userData.isPulse = true;
    markerGroup.add(ring);

    markerGroup.position.set(worldPos.x, 0, worldPos.z);
    scene.add(markerGroup);
    pickupMarker = markerGroup;

    // Create HTML label
    const label = document.createElement('div');
    label.className = 'pickup-label';
    label.innerHTML = `📦 PICK UP HERE`;
    label.style.display = 'none';
    document.body.appendChild(label);
    pickupLabel = label;
}

// Create delivery marker at customer location
function createDeliveryMarker(deliveryLocation) {
    const worldPos = deliveryLocation.worldPos;

    // Create 3D marker (green house shape)
    const markerGroup = new THREE.Group();

    // Vertical beam
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 50, 16);
    const beamMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = 25;
    markerGroup.add(beam);

    // House icon at top (simple box)
    const houseGeometry = new THREE.BoxGeometry(8, 8, 8);
    const houseMaterial = new THREE.MeshPhongMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.6
    });
    const house = new THREE.Mesh(houseGeometry, houseMaterial);
    house.position.y = 55;
    house.rotation.y = Math.PI / 4;
    markerGroup.add(house);

    // Roof
    const roofGeometry = new THREE.ConeGeometry(7, 5, 4);
    const roofMaterial = new THREE.MeshPhongMaterial({
        color: 0x00cc66,
        emissive: 0x00cc66,
        emissiveIntensity: 0.4
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = 62;
    roof.rotation.y = Math.PI / 4;
    markerGroup.add(roof);

    markerGroup.position.set(worldPos.x, 0, worldPos.z);
    scene.add(markerGroup);
    deliveryMarkerMesh = markerGroup;

    // Create HTML label
    const label = document.createElement('div');
    label.className = 'delivery-label';
    label.innerHTML = `<span class="customer-icon">🏠</span>${deliveryLocation.address}`;
    label.style.display = 'none';
    document.body.appendChild(label);
    deliveryLabelElement = label;

    deliveryLocation.marker = markerGroup;
    deliveryLocation.label = label;
}

// Remove active markers
function clearActiveMarkers() {
    if (pickupMarker) {
        scene.remove(pickupMarker);
        pickupMarker = null;
    }
    if (pickupLabel) {
        pickupLabel.remove();
        pickupLabel = null;
    }
    if (deliveryMarkerMesh) {
        scene.remove(deliveryMarkerMesh);
        deliveryMarkerMesh = null;
    }
    if (deliveryLabelElement) {
        deliveryLabelElement.remove();
        deliveryLabelElement = null;
    }
    // Remove navigation line
    if (navigationLine) {
        scene.remove(navigationLine);
        navigationLine = null;
    }
    // Show restaurant markers again
    setRestaurantMarkersVisible(true);
}

// Update marker label positions
function updateGameMarkers() {
    if (!gameState.currentOrder) return;

    const order = gameState.currentOrder;

    // Update pickup label position
    if (order.status === 'accepted' && pickupMarker && pickupLabel) {
        const pos = new THREE.Vector3(
            pickupMarker.position.x,
            70,
            pickupMarker.position.z
        );
        pos.project(mainCamera);

        if (pos.z < 1) {
            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
            pickupLabel.style.display = 'block';
            pickupLabel.style.left = `${x}px`;
            pickupLabel.style.top = `${y}px`;
        } else {
            pickupLabel.style.display = 'none';
        }

        // Animate pulse ring
        if (pickupMarker.children[1]?.userData.isPulse) {
            const scale = 1 + Math.sin(Date.now() * 0.005) * 0.3;
            pickupMarker.children[1].scale.set(scale, scale, scale);
        }
    }

    // Update delivery label position
    if (order.status === 'picked_up' && deliveryMarkerMesh && deliveryLabelElement) {
        const pos = new THREE.Vector3(
            deliveryMarkerMesh.position.x,
            70,
            deliveryMarkerMesh.position.z
        );
        pos.project(mainCamera);

        if (pos.z < 1) {
            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-pos.y * 0.5 + 0.5) * window.innerHeight;
            deliveryLabelElement.style.display = 'block';
            deliveryLabelElement.style.left = `${x}px`;
            deliveryLabelElement.style.top = `${y}px`;
        } else {
            deliveryLabelElement.style.display = 'none';
        }

        // Rotate delivery marker
        deliveryMarkerMesh.children[1].rotation.y += 0.02;
    }
}

// Start the game
function startGame() {
    gameState.isPlaying = true;
    gameState.isPaused = false;
    gameState.earnings = 0;
    gameState.totalDeliveries = 0;
    gameState.streak = 0;
    gameState.gameTime = 0;
    gameState.orderQueue = [];
    gameState.currentOrder = null;

    // Hide start button, show game UI
    document.getElementById('start-game-container').classList.add('hidden');
    document.getElementById('game-stats').classList.remove('hidden');
    document.getElementById('order-panel').classList.remove('hidden');

    // Generate initial orders
    generateNewOrders(3);

    // Start order generation interval
    gameState.orderInterval = setInterval(() => {
        if (!gameState.isPaused && gameState.orderQueue.length < 5) {
            generateNewOrders(1);
        }
    }, 15000); // New order every 15 seconds

    updateGameUI();
}

// Generate new orders
function generateNewOrders(count) {
    if (loadingState.restaurants.length === 0) return;

    for (let i = 0; i < count; i++) {
        const restaurant = loadingState.restaurants[
            Math.floor(Math.random() * loadingState.restaurants.length)
        ];
        const order = generateOrder(restaurant);
        gameState.orderQueue.push(order);
    }

    renderOrderList();
}

// Render the order list
function renderOrderList() {
    const orderList = document.getElementById('order-list');
    orderList.innerHTML = '';

    gameState.orderQueue.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.onclick = () => acceptOrder(order);

        const itemsPreview = order.items.slice(0, 2).map(i =>
            `${i.quantity}x ${i.name}`
        ).join(', ');
        const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';

        const bonusHtml = order.bonus > 0 ?
            `<span class="order-card-bonus">+$${order.bonus} TIP</span>` : '';

        card.innerHTML = `
            <div class="order-card-header">
                <img class="order-card-photo" src="${order.restaurant.photoUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop'}" alt="">
                <div class="order-card-info">
                    <div class="order-card-restaurant">${order.restaurant.name}${bonusHtml}</div>
                    <div class="order-card-items">${itemsPreview}${moreItems}</div>
                </div>
            </div>
            <div class="order-card-details">
                <span class="order-card-pay">$${order.estimatedPay.toFixed(2)}</span>
                <span class="order-card-distance">${Math.round(order.distance)}m</span>
                <span class="order-card-time">${order.estimatedDeliveryTime} min</span>
            </div>
        `;

        orderList.appendChild(card);
    });

    if (gameState.orderQueue.length === 0) {
        orderList.innerHTML = '<div style="color: #888; text-align: center; padding: 20px;">Waiting for orders...</div>';
    }
}

// Accept an order
function acceptOrder(order) {
    if (gameState.currentOrder) {
        alert('Complete your current delivery first!');
        return;
    }

    // Remove from queue
    gameState.orderQueue = gameState.orderQueue.filter(o => o.id !== order.id);

    // Set as current order
    order.status = 'accepted';
    order.acceptedAt = Date.now();
    gameState.currentOrder = order;

    // Create pickup marker
    createPickupMarker(order.restaurant);

    // Hide other restaurant markers for cleaner navigation
    setRestaurantMarkersVisible(false);

    // Update UI
    renderOrderList();
    showActiveDelivery(order);

    // Hide order panel during delivery
    document.getElementById('order-panel').classList.add('hidden');
}

// Show active delivery HUD
function showActiveDelivery(order) {
    const container = document.getElementById('active-delivery');
    container.classList.remove('hidden');

    const phase = document.getElementById('delivery-phase');
    phase.textContent = 'PICK UP';
    phase.className = 'delivery-phase pickup';

    document.getElementById('delivery-photo').src = order.restaurant.photoUrl ||
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop';
    document.getElementById('delivery-name').textContent = order.restaurant.name;
    document.getElementById('delivery-address').textContent =
        order.restaurant.address || order.restaurant.vicinity || '';

    // Render items
    const itemsContainer = document.getElementById('delivery-items');
    itemsContainer.innerHTML = order.items.map(item => `
        <div class="delivery-item">
            <span><span class="delivery-item-qty">${item.quantity}x</span>${item.name}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');

    document.getElementById('customer-name').textContent = order.customer;
    document.getElementById('customer-address').textContent = order.deliveryLocation.address;

    const totalPay = order.estimatedPay + parseFloat(order.bonus || 0);
    document.getElementById('delivery-pay').textContent = `$${totalPay.toFixed(2)}`;

    // Setup cancel button
    document.getElementById('cancel-delivery').onclick = () => cancelDelivery();
}

// Update active delivery HUD
function updateActiveDeliveryHUD() {
    if (!gameState.currentOrder) return;

    const order = gameState.currentOrder;

    // Calculate distance to target
    let targetPos;
    if (order.status === 'accepted') {
        targetPos = latLngToWorld(order.restaurant.lat, order.restaurant.lon);
    } else if (order.status === 'picked_up') {
        targetPos = { x: order.deliveryLocation.worldPos.x, z: order.deliveryLocation.worldPos.z };
    } else {
        return;
    }

    const distance = Math.sqrt(
        Math.pow(droneState.position.x - targetPos.x, 2) +
        Math.pow(droneState.position.z - targetPos.z, 2)
    );

    document.getElementById('delivery-distance').textContent = `${Math.round(distance)}m`;

    // Update timer
    const elapsed = (Date.now() - order.acceptedAt) / 1000;
    const remaining = Math.max(0, order.timeLimit - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    document.getElementById('delivery-timer').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Check for timeout
    if (remaining <= 0) {
        handleDeliveryTimeout();
    }
}

// Check proximity for pickup/delivery
function checkProximity() {
    if (!gameState.currentOrder) return;

    const order = gameState.currentOrder;

    if (order.status === 'accepted') {
        // Check proximity to restaurant
        const restaurantPos = latLngToWorld(order.restaurant.lat, order.restaurant.lon);
        const distance = Math.sqrt(
            Math.pow(droneState.position.x - restaurantPos.x, 2) +
            Math.pow(droneState.position.z - restaurantPos.z, 2)
        );

        if (distance < gameState.pickupRadius) {
            handlePickup();
        }
    } else if (order.status === 'picked_up') {
        // Check proximity to delivery location
        const deliveryPos = order.deliveryLocation.worldPos;
        const distance = Math.sqrt(
            Math.pow(droneState.position.x - deliveryPos.x, 2) +
            Math.pow(droneState.position.z - deliveryPos.z, 2)
        );

        if (distance < gameState.deliveryRadius) {
            handleDelivery();
        }
    }
}

// Handle pickup completion
function handlePickup() {
    const order = gameState.currentOrder;
    order.status = 'picked_up';
    order.pickedUpAt = Date.now();

    // Remove pickup marker, create delivery marker
    if (pickupMarker) {
        scene.remove(pickupMarker);
        pickupMarker = null;
    }
    if (pickupLabel) {
        pickupLabel.remove();
        pickupLabel = null;
    }

    createDeliveryMarker(order.deliveryLocation);

    // Update HUD
    const phase = document.getElementById('delivery-phase');
    phase.textContent = 'DELIVER';
    phase.className = 'delivery-phase deliver';

    // Update address to show delivery location
    document.getElementById('delivery-address').textContent = order.deliveryLocation.address;

    // Play pickup sound (visual feedback instead)
    showNotification('Order picked up! Deliver to customer.', 'success');
}

// Handle delivery completion
function handleDelivery() {
    const order = gameState.currentOrder;
    order.status = 'delivered';
    order.deliveredAt = Date.now();

    // Calculate earnings
    const basePay = 3.50 + (order.subtotal * 0.15);
    const distanceBonus = order.distance * 0.02;
    const tip = parseFloat(order.bonus || 0);
    const totalEarnings = basePay + distanceBonus + tip;

    // Update game state
    gameState.earnings += totalEarnings;
    gameState.totalDeliveries++;
    gameState.streak++;
    if (gameState.streak > gameState.bestStreak) {
        gameState.bestStreak = gameState.streak;
    }

    // Show completion popup
    showDeliveryComplete(basePay, distanceBonus, tip, totalEarnings);

    // Clear markers and order
    clearActiveMarkers();
    gameState.currentOrder = null;

    // Hide active delivery, show order panel
    document.getElementById('active-delivery').classList.add('hidden');

    updateGameUI();

    // Auto-generate more orders if needed
    if (gameState.orderQueue.length < 3) {
        generateNewOrders(2);
    }
}

// Show delivery complete popup
function showDeliveryComplete(basePay, distanceBonus, tip, total) {
    const popup = document.getElementById('delivery-complete');
    popup.classList.remove('hidden');

    document.getElementById('complete-base').textContent = `$${basePay.toFixed(2)}`;
    document.getElementById('complete-distance').textContent = `$${distanceBonus.toFixed(2)}`;

    const tipRow = document.getElementById('tip-row');
    if (tip > 0) {
        tipRow.style.display = 'flex';
        document.getElementById('complete-tip').textContent = `$${tip.toFixed(2)}`;
    } else {
        tipRow.style.display = 'none';
    }

    document.getElementById('complete-total').textContent = `$${total.toFixed(2)}`;

    // Rating based on time
    const rating = gameState.streak > 2 ? '⭐⭐⭐⭐⭐ Perfect!' :
                   gameState.streak > 0 ? '⭐⭐⭐⭐ Great job!' : '⭐⭐⭐ Good delivery!';
    document.getElementById('complete-rating').textContent = rating;

    // Auto-hide after 3 seconds
    setTimeout(() => {
        popup.classList.add('hidden');
        document.getElementById('order-panel').classList.remove('hidden');
    }, 3000);
}

// Cancel current delivery
function cancelDelivery() {
    if (!gameState.currentOrder) return;

    // Reset streak
    gameState.streak = 0;

    // Clear markers
    clearActiveMarkers();

    // Return order to queue (optional - could also just discard)
    gameState.currentOrder = null;

    // Update UI
    document.getElementById('active-delivery').classList.add('hidden');
    document.getElementById('order-panel').classList.remove('hidden');
    renderOrderList();
    updateGameUI();

    showNotification('Delivery cancelled. Streak reset.', 'warning');
}

// Handle delivery timeout
function handleDeliveryTimeout() {
    gameState.streak = 0;
    clearActiveMarkers();
    gameState.currentOrder = null;

    document.getElementById('active-delivery').classList.add('hidden');
    document.getElementById('order-panel').classList.remove('hidden');
    renderOrderList();
    updateGameUI();

    showNotification('Delivery timed out! Streak reset.', 'error');
}

// Show notification
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 30px;
        border-radius: 10px;
        font-size: 16px;
        font-weight: bold;
        z-index: 400;
        animation: slideDown 0.3s ease-out;
        ${type === 'success' ? 'background: #00ff88; color: #000;' : ''}
        ${type === 'warning' ? 'background: #ffcc00; color: #000;' : ''}
        ${type === 'error' ? 'background: #ff6b6b; color: #fff;' : ''}
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Update game UI stats
function updateGameUI() {
    document.getElementById('earnings').textContent = `$${gameState.earnings.toFixed(2)}`;
    document.getElementById('deliveries').textContent = gameState.totalDeliveries;
    document.getElementById('streak').textContent = `🔥 ${gameState.streak}`;
}

// Game update loop (called from animate)
function updateGame(delta) {
    if (!gameState.isPlaying || gameState.isPaused) return;

    gameState.gameTime += delta;

    // Check pickup/delivery proximity
    checkProximity();

    // Update delivery HUD
    updateActiveDeliveryHUD();

    // Update game markers
    updateGameMarkers();

    // Update direction arrow
    updateDirectionArrow();

    // Update navigation line to target
    const minimapNav = document.getElementById('minimap-nav');
    const minimapLabel = document.getElementById('minimap-label');

    if (gameState.currentOrder) {
        const order = gameState.currentOrder;
        let targetPos = null;

        if (order.status === 'accepted') {
            const pos = latLngToWorld(order.restaurant.lat, order.restaurant.lon);
            targetPos = { x: pos.x, z: pos.z };
            minimapNav.className = 'minimap-nav-info pickup';
            minimapLabel.textContent = 'NAVIGATE TO PICKUP';
            minimapLabel.style.color = '#ffcc00';
        } else if (order.status === 'picked_up') {
            targetPos = { x: order.deliveryLocation.worldPos.x, z: order.deliveryLocation.worldPos.z };
            minimapNav.className = 'minimap-nav-info delivery';
            minimapLabel.textContent = 'NAVIGATE TO DELIVERY';
            minimapLabel.style.color = '#00ff88';
        }

        if (targetPos) {
            // Calculate distance
            const dx = targetPos.x - droneState.position.x;
            const dz = targetPos.z - droneState.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            // Calculate direction arrow (relative to drone heading)
            const targetAngle = Math.atan2(dx, dz);
            const relativeAngle = targetAngle - droneState.rotation;

            // Convert to compass direction
            let dirArrow = '↑';
            const normalizedAngle = ((relativeAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
            if (normalizedAngle > 7 * Math.PI / 4 || normalizedAngle <= Math.PI / 4) dirArrow = '↑';
            else if (normalizedAngle > Math.PI / 4 && normalizedAngle <= 3 * Math.PI / 4) dirArrow = '→';
            else if (normalizedAngle > 3 * Math.PI / 4 && normalizedAngle <= 5 * Math.PI / 4) dirArrow = '↓';
            else dirArrow = '←';

            document.getElementById('nav-distance').textContent = `${Math.round(distance)}m`;
            document.getElementById('nav-direction').textContent = dirArrow;
            minimapNav.classList.remove('hidden');
        }

        updateNavigationLine(targetPos);
    } else {
        updateNavigationLine(null);
        minimapNav.classList.add('hidden');
        minimapLabel.textContent = 'TOP VIEW';
        minimapLabel.style.color = '#00d4ff';
    }
}

// Setup game controls
function setupGameControls() {
    // Start game button
    document.getElementById('start-game-btn').addEventListener('click', startGame);

    // Pause button
    document.getElementById('pause-btn').addEventListener('click', () => {
        gameState.isPaused = !gameState.isPaused;
        document.getElementById('pause-btn').textContent =
            gameState.isPaused ? '▶️' : '⏸️';
    });

    // Keyboard shortcut for accepting first order
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && gameState.isPlaying && !gameState.currentOrder) {
            if (gameState.orderQueue.length > 0) {
                acceptOrder(gameState.orderQueue[0]);
            }
            e.preventDefault();
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', setupModal);

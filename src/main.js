// Drone Dash - Delivery Game with CesiumJS and Google 3D Tiles
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// ============================================
// Service Worker Registration (tile caching)
// ============================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
            console.log('Tile cache service worker registered:', registration.scope);
        })
        .catch((error) => {
            console.warn('Service worker registration failed:', error);
        });
}

// ============================================
// Configuration
// ============================================
const CESIUM_ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyYzg1YmU2My03MzVlLTQzNmItOGVjOS1lYzkwZjkzZjNkMmUiLCJpZCI6Mjg2NTQ5LCJpYXQiOjE3NDI1OTczMTR9.ABaRbmxTbv1A89WB1fwVxEi8oPzsfQmdlAz1E3gbOQA';
const GOOGLE_API_KEY = 'AIzaSyAHdMOFQoW-UKhIS0vEmkqi7-TNNhpuvtI';
// Use HTTPS proxy (hcloud with Caddy SSL) - works for both dev and production
const CORS_PROXY_URL = 'https://proxy.178-156-198-233.nip.io/proxy';

Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

// Increase concurrent tile requests for faster loading
Cesium.RequestScheduler.maximumRequests = 50;           // Default is 6
Cesium.RequestScheduler.maximumRequestsPerServer = 18;  // Default is 6

// ============================================
// Global Variables
// ============================================
let viewer = null;
let droneEntity = null;
let minimapViewer = null;

// Drone state
const droneState = {
    longitude: -74.0060,
    latitude: 40.7128,
    altitude: 50,
    heading: 0,     // degrees
    pitch: 0,       // degrees
    roll: 0,        // degrees
    velocityX: 0,   // m/s east
    velocityY: 0,   // m/s north
    velocityZ: 0,   // m/s up
    speed: 0
};

// Spawn location
let spawnLat = 40.7128;
let spawnLng = -74.0060;

// Controls state
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false,
    ShiftLeft: false,
    ShiftRight: false
};

// Turbo state
let turboEnabled = false;

// Loading state
let loadingState = {
    tilesLoaded: false,
    restaurantsLoaded: false,
    restaurants: []
};

// Restaurant markers
let restaurantEntities = [];
let restaurantLabels = [];

// Cache for pre-fetched place details
const placeDetailsCache = new Map();

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
    pickupRadius: 75,      // meters - horizontal distance to trigger pickup
    deliveryRadius: 60,    // meters - horizontal distance to trigger delivery
    maxDeliveryAltitude: 50, // meters above ground - can deliver from this height
    orderInterval: null,
    gameTime: 0,
    streak: 0,
    bestStreak: 0
};

// Delivery markers
let pickupEntity = null;
let deliveryEntity = null;

// ============================================
// Menu Database (same as original)
// ============================================
// Brand-specific menus with real items
const brandMenus = {
    // Fast Food
    "mcdonald": [
        { name: "Big Mac", price: 5.99, prep: 3 },
        { name: "Quarter Pounder w/ Cheese", price: 6.49, prep: 3 },
        { name: "10pc McNuggets", price: 5.49, prep: 3 },
        { name: "McChicken", price: 2.49, prep: 2 },
        { name: "Large Fries", price: 3.79, prep: 2 },
        { name: "McFlurry", price: 3.99, prep: 2 }
    ],
    "burger king": [
        { name: "Whopper", price: 6.49, prep: 4 },
        { name: "Whopper Jr.", price: 3.99, prep: 3 },
        { name: "Chicken Fries", price: 4.49, prep: 3 },
        { name: "Onion Rings", price: 3.29, prep: 2 },
        { name: "Impossible Whopper", price: 7.49, prep: 4 }
    ],
    "wendy": [
        { name: "Dave's Single", price: 5.99, prep: 4 },
        { name: "Baconator", price: 8.49, prep: 5 },
        { name: "Spicy Chicken Sandwich", price: 5.49, prep: 3 },
        { name: "Frosty", price: 2.49, prep: 1 },
        { name: "Chicken Nuggets (10pc)", price: 5.99, prep: 3 }
    ],
    "five guys": [
        { name: "Cheeseburger", price: 11.99, prep: 8 },
        { name: "Little Bacon Burger", price: 9.49, prep: 6 },
        { name: "Cajun Fries (Regular)", price: 5.49, prep: 5 },
        { name: "Hot Dog", price: 6.99, prep: 4 },
        { name: "Grilled Cheese", price: 6.49, prep: 5 }
    ],
    "in-n-out": [
        { name: "Double-Double", price: 5.25, prep: 5 },
        { name: "Cheeseburger", price: 3.45, prep: 4 },
        { name: "Animal Style Fries", price: 4.95, prep: 5 },
        { name: "Shake (Chocolate)", price: 3.25, prep: 2 }
    ],
    "shake shack": [
        { name: "ShackBurger", price: 7.49, prep: 6 },
        { name: "SmokeShack", price: 9.49, prep: 6 },
        { name: "Cheese Fries", price: 4.79, prep: 4 },
        { name: "Concrete (Shake)", price: 6.29, prep: 3 }
    ],
    // Chicken
    "chick-fil-a": [
        { name: "Chicken Sandwich", price: 5.25, prep: 4 },
        { name: "Spicy Deluxe Sandwich", price: 6.55, prep: 4 },
        { name: "Nuggets (12ct)", price: 6.45, prep: 3 },
        { name: "Waffle Fries (Large)", price: 3.15, prep: 2 },
        { name: "Chicken Biscuit", price: 4.09, prep: 3 }
    ],
    "popeye": [
        { name: "Chicken Sandwich", price: 5.99, prep: 5 },
        { name: "3pc Tenders", price: 6.49, prep: 4 },
        { name: "Cajun Fries", price: 3.49, prep: 2 },
        { name: "Red Beans & Rice", price: 2.99, prep: 2 }
    ],
    "kfc": [
        { name: "3pc Chicken Meal", price: 8.99, prep: 5 },
        { name: "Famous Bowl", price: 6.99, prep: 4 },
        { name: "Chicken Sandwich", price: 5.49, prep: 4 },
        { name: "Mashed Potatoes & Gravy", price: 2.99, prep: 2 },
        { name: "Coleslaw", price: 2.49, prep: 1 }
    ],
    "wingstop": [
        { name: "10pc Classic Wings", price: 15.99, prep: 12 },
        { name: "Boneless Meal Deal", price: 12.99, prep: 10 },
        { name: "Cajun Fried Corn", price: 3.49, prep: 3 },
        { name: "Seasoned Fries", price: 3.99, prep: 3 }
    ],
    // Coffee
    "starbucks": [
        { name: "Grande Caramel Macchiato", price: 5.95, prep: 4 },
        { name: "Venti Iced Latte", price: 5.45, prep: 3 },
        { name: "Grande Cold Brew", price: 4.45, prep: 2 },
        { name: "Bacon Gouda Sandwich", price: 5.75, prep: 3 },
        { name: "Butter Croissant", price: 3.95, prep: 1 },
        { name: "Cake Pop", price: 3.50, prep: 1 }
    ],
    "dunkin": [
        { name: "Medium Iced Coffee", price: 3.49, prep: 2 },
        { name: "Bacon Egg & Cheese", price: 5.29, prep: 4 },
        { name: "Half Dozen Donuts", price: 8.49, prep: 2 },
        { name: "Medium Latte", price: 4.59, prep: 3 },
        { name: "Hash Browns", price: 2.09, prep: 2 }
    ],
    // Mexican
    "chipotle": [
        { name: "Chicken Burrito", price: 10.50, prep: 5 },
        { name: "Steak Bowl", price: 11.75, prep: 5 },
        { name: "Carnitas Tacos (3)", price: 10.50, prep: 5 },
        { name: "Chips & Guac", price: 5.95, prep: 2 },
        { name: "Queso Blanco", price: 2.65, prep: 1 }
    ],
    "taco bell": [
        { name: "Crunchwrap Supreme", price: 5.49, prep: 3 },
        { name: "Cheesy Gordita Crunch", price: 4.99, prep: 3 },
        { name: "Nachos BellGrande", price: 5.49, prep: 4 },
        { name: "Baja Blast (Large)", price: 2.99, prep: 1 },
        { name: "Cinnamon Twists", price: 1.79, prep: 1 }
    ],
    "qdoba": [
        { name: "Chicken Burrito", price: 9.85, prep: 5 },
        { name: "Steak Quesadilla", price: 10.60, prep: 6 },
        { name: "Loaded Tortilla Soup", price: 6.20, prep: 4 },
        { name: "Chips & 3-Cheese Queso", price: 5.35, prep: 2 }
    ],
    // Pizza
    "domino": [
        { name: "Large Pepperoni Pizza", price: 14.99, prep: 20 },
        { name: "Medium MeatZZa", price: 15.99, prep: 18 },
        { name: "Stuffed Cheesy Bread", price: 7.99, prep: 10 },
        { name: "Boneless Chicken (8pc)", price: 8.99, prep: 12 }
    ],
    "pizza hut": [
        { name: "Large Pepperoni Lover's", price: 16.99, prep: 22 },
        { name: "Personal Pan Supreme", price: 6.99, prep: 10 },
        { name: "Breadsticks", price: 5.99, prep: 8 },
        { name: "WingStreet Wings (8pc)", price: 9.99, prep: 12 }
    ],
    "papa john": [
        { name: "Large Cheese Pizza", price: 13.99, prep: 18 },
        { name: "Pepperoni Pizza (XL)", price: 18.99, prep: 22 },
        { name: "Garlic Knots", price: 5.99, prep: 8 },
        { name: "Papadia", price: 8.99, prep: 10 }
    ],
    // Asian
    "panda express": [
        { name: "Orange Chicken Bowl", price: 9.80, prep: 4 },
        { name: "Kung Pao Chicken Plate", price: 11.20, prep: 5 },
        { name: "Beijing Beef", price: 10.50, prep: 4 },
        { name: "Chow Mein (Side)", price: 4.70, prep: 2 },
        { name: "Cream Cheese Rangoon (3)", price: 2.60, prep: 2 }
    ],
    "pf chang": [
        { name: "Chang's Spicy Chicken", price: 17.50, prep: 15 },
        { name: "Mongolian Beef", price: 19.95, prep: 15 },
        { name: "Dynamite Shrimp", price: 14.95, prep: 12 },
        { name: "Fried Rice", price: 12.50, prep: 8 }
    ],
    // Subs/Sandwiches
    "subway": [
        { name: "Footlong Italian BMT", price: 9.99, prep: 5 },
        { name: "6-inch Turkey Breast", price: 6.99, prep: 4 },
        { name: "Footlong Meatball Sub", price: 8.99, prep: 5 },
        { name: "Chips", price: 1.79, prep: 1 },
        { name: "Cookie", price: 1.29, prep: 1 }
    ],
    "jersey mike": [
        { name: "Giant #13 Italian", price: 14.95, prep: 6 },
        { name: "Regular Club Supreme", price: 11.95, prep: 5 },
        { name: "Giant Chipotle Cheesesteak", price: 16.50, prep: 8 }
    ],
    "jimmy john": [
        { name: "#4 Turkey Tom", price: 8.50, prep: 3 },
        { name: "#9 Italian Night Club", price: 10.50, prep: 4 },
        { name: "Beach Club", price: 10.25, prep: 4 }
    ],
    // Misc Fast Casual
    "panera": [
        { name: "Broccoli Cheddar Soup (Bowl)", price: 7.99, prep: 3 },
        { name: "Bacon Turkey Bravo", price: 12.29, prep: 6 },
        { name: "Greek Salad (Whole)", price: 11.79, prep: 4 },
        { name: "Mac & Cheese", price: 9.29, prep: 5 }
    ],
    "sweetgreen": [
        { name: "Harvest Bowl", price: 14.95, prep: 5 },
        { name: "Crispy Rice Bowl", price: 15.50, prep: 5 },
        { name: "Guacamole Greens", price: 13.95, prep: 4 }
    ],
    "cava": [
        { name: "Greens + Grains Bowl", price: 12.45, prep: 4 },
        { name: "Grilled Chicken Pita", price: 11.85, prep: 5 },
        { name: "Harissa Lamb Bowl", price: 13.95, prep: 5 }
    ]
};

const menuDatabase = {
    burger: {
        items: [
            { name: "Classic Cheeseburger", price: 8.99, prep: 5 },
            { name: "Double Bacon Burger", price: 12.99, prep: 7 },
            { name: "Mushroom Swiss Burger", price: 10.99, prep: 6 },
            { name: "BBQ Bacon Burger", price: 11.99, prep: 6 },
            { name: "Large Fries", price: 4.99, prep: 3 },
            { name: "Onion Rings", price: 5.49, prep: 4 },
            { name: "Milkshake", price: 5.99, prep: 3 }
        ]
    },
    pizza: {
        items: [
            { name: "Pepperoni Pizza (Large)", price: 18.99, prep: 15 },
            { name: "Margherita Pizza", price: 16.99, prep: 12 },
            { name: "Supreme Pizza", price: 21.99, prep: 18 },
            { name: "Buffalo Wings (12pc)", price: 14.99, prep: 12 },
            { name: "Garlic Knots (8pc)", price: 6.99, prep: 8 },
            { name: "Caesar Salad", price: 9.99, prep: 5 }
        ]
    },
    mexican: {
        items: [
            { name: "Carne Asada Burrito", price: 12.99, prep: 8 },
            { name: "Chicken Burrito Bowl", price: 11.99, prep: 7 },
            { name: "Street Tacos (4)", price: 11.99, prep: 8 },
            { name: "Carnitas Quesadilla", price: 10.99, prep: 7 },
            { name: "Chips & Guacamole", price: 7.99, prep: 3 },
            { name: "Churros (3)", price: 5.99, prep: 4 }
        ]
    },
    chinese: {
        items: [
            { name: "General Tso's Chicken", price: 14.99, prep: 12 },
            { name: "Beef & Broccoli", price: 15.99, prep: 12 },
            { name: "Kung Pao Shrimp", price: 16.99, prep: 12 },
            { name: "Vegetable Lo Mein", price: 12.99, prep: 10 },
            { name: "Fried Rice", price: 10.99, prep: 8 },
            { name: "Egg Rolls (4)", price: 6.99, prep: 6 },
            { name: "Crab Rangoon (6)", price: 7.99, prep: 6 }
        ]
    },
    japanese: {
        items: [
            { name: "Dragon Roll (8pc)", price: 16.99, prep: 12 },
            { name: "Salmon Sashimi (8pc)", price: 18.99, prep: 10 },
            { name: "Chicken Teriyaki Bento", price: 16.99, prep: 12 },
            { name: "Tonkotsu Ramen", price: 15.99, prep: 15 },
            { name: "Gyoza (6pc)", price: 7.99, prep: 8 },
            { name: "Miso Soup", price: 3.99, prep: 3 }
        ]
    },
    korean: {
        items: [
            { name: "Bulgogi Rice Bowl", price: 15.99, prep: 12 },
            { name: "Korean Fried Chicken", price: 14.99, prep: 15 },
            { name: "Bibimbap", price: 14.99, prep: 12 },
            { name: "Japchae", price: 13.99, prep: 10 },
            { name: "Kimchi Jjigae", price: 12.99, prep: 12 }
        ]
    },
    thai: {
        items: [
            { name: "Pad Thai", price: 14.99, prep: 12 },
            { name: "Green Curry", price: 15.99, prep: 15 },
            { name: "Massaman Curry", price: 16.99, prep: 15 },
            { name: "Tom Yum Soup", price: 8.99, prep: 8 },
            { name: "Thai Iced Tea", price: 4.99, prep: 3 }
        ]
    },
    vietnamese: {
        items: [
            { name: "Pho Tai (Rare Beef)", price: 13.99, prep: 10 },
            { name: "Banh Mi Sandwich", price: 9.99, prep: 6 },
            { name: "Vermicelli Bowl", price: 12.99, prep: 10 },
            { name: "Spring Rolls (4)", price: 6.99, prep: 5 },
            { name: "Vietnamese Iced Coffee", price: 4.99, prep: 3 }
        ]
    },
    indian: {
        items: [
            { name: "Chicken Tikka Masala", price: 16.99, prep: 15 },
            { name: "Lamb Vindaloo", price: 18.99, prep: 15 },
            { name: "Palak Paneer", price: 14.99, prep: 12 },
            { name: "Garlic Naan (2)", price: 4.99, prep: 5 },
            { name: "Samosas (3)", price: 6.99, prep: 6 },
            { name: "Mango Lassi", price: 4.99, prep: 3 }
        ]
    },
    italian: {
        items: [
            { name: "Spaghetti Carbonara", price: 17.99, prep: 15 },
            { name: "Chicken Parmesan", price: 19.99, prep: 18 },
            { name: "Fettuccine Alfredo", price: 15.99, prep: 12 },
            { name: "Lasagna", price: 16.99, prep: 15 },
            { name: "Bruschetta", price: 8.99, prep: 6 },
            { name: "Tiramisu", price: 8.99, prep: 3 }
        ]
    },
    mediterranean: {
        items: [
            { name: "Chicken Shawarma Plate", price: 14.99, prep: 10 },
            { name: "Lamb Gyro", price: 12.99, prep: 8 },
            { name: "Falafel Wrap", price: 10.99, prep: 7 },
            { name: "Hummus & Pita", price: 7.99, prep: 4 },
            { name: "Greek Salad", price: 9.99, prep: 5 }
        ]
    },
    cafe: {
        items: [
            { name: "Latte", price: 5.49, prep: 4 },
            { name: "Cappuccino", price: 4.99, prep: 4 },
            { name: "Iced Americano", price: 4.49, prep: 3 },
            { name: "Croissant", price: 3.99, prep: 2 },
            { name: "Avocado Toast", price: 9.99, prep: 6 },
            { name: "Breakfast Sandwich", price: 7.99, prep: 5 }
        ]
    },
    bakery: {
        items: [
            { name: "Blueberry Muffin", price: 3.99, prep: 2 },
            { name: "Chocolate Croissant", price: 4.49, prep: 2 },
            { name: "Cinnamon Roll", price: 4.99, prep: 3 },
            { name: "Bagel with Cream Cheese", price: 4.49, prep: 3 },
            { name: "Fruit Danish", price: 3.99, prep: 2 }
        ]
    },
    bbq: {
        items: [
            { name: "Brisket Plate (1/2 lb)", price: 18.99, prep: 5 },
            { name: "Pulled Pork Sandwich", price: 12.99, prep: 5 },
            { name: "Baby Back Ribs (Half Rack)", price: 19.99, prep: 8 },
            { name: "Mac & Cheese", price: 5.99, prep: 3 },
            { name: "Coleslaw", price: 3.99, prep: 2 },
            { name: "Cornbread", price: 3.49, prep: 2 }
        ]
    },
    seafood: {
        items: [
            { name: "Fish & Chips", price: 16.99, prep: 12 },
            { name: "Grilled Salmon", price: 22.99, prep: 15 },
            { name: "Shrimp Basket", price: 14.99, prep: 10 },
            { name: "Lobster Roll", price: 24.99, prep: 10 },
            { name: "Clam Chowder", price: 8.99, prep: 5 }
        ]
    },
    default: {
        items: [
            { name: "House Special", price: 15.99, prep: 12 },
            { name: "Chef's Salad", price: 11.99, prep: 6 },
            { name: "Grilled Chicken Plate", price: 14.99, prep: 12 },
            { name: "Soup of the Day", price: 6.99, prep: 5 },
            { name: "Club Sandwich", price: 12.99, prep: 8 }
        ]
    }
};

const customerNames = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Christopher", "Karen", "Matthew", "Emily", "Daniel", "Amanda"
];

const streetSuffixes = ["St", "Ave", "Blvd", "Dr", "Ln", "Ct", "Way", "Pl", "Rd"];
const streetNames = [
    "Oak", "Maple", "Cedar", "Pine", "Elm", "Main", "Park", "Lake", "Hill", "River"
];

// ============================================
// Utility Functions
// ============================================
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
}

function updateProgress(status, percent = null) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const loadingStatus = document.getElementById('loading-status');

    if (status) loadingStatus.textContent = status;
    if (percent !== null) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }
}

// ============================================
// Cesium Viewer Initialization
// ============================================
async function initCesium() {
    updateProgress('Initializing Cesium...', 10);

    // Create the main viewer
    viewer = new Cesium.Viewer('cesiumContainer', {
        terrain: Cesium.Terrain.fromWorldTerrain(),
        skyBox: false,
        skyAtmosphere: new Cesium.SkyAtmosphere(),
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        vrButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        creditContainer: document.createElement('div'),
        shadows: true,
        terrainShadows: Cesium.ShadowMode.ENABLED,
        // Performance optimizations
        requestRenderMode: false,  // Continuous rendering for smooth animation
        maximumRenderTimeChange: Infinity,
        targetFrameRate: 60,
        useBrowserRecommendedResolution: true
    });

    // Disable default camera controls - we'll use our own
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;

    // Scene performance settings
    const scene = viewer.scene;
    scene.fog.enabled = true;
    scene.fog.density = 0.0001;  // Light fog for depth cue and performance
    scene.fog.screenSpaceErrorFactor = 2.0;

    // Increase tile cache for smoother experience
    scene.globe.tileCacheSize = 2000;  // Increased from 1000

    // Preload tiles in view frustum more aggressively
    scene.globe.preloadAncestors = true;
    scene.globe.preloadSiblings = true;

    // Optimize terrain loading
    scene.globe.maximumScreenSpaceError = 1.5;  // Lower = higher quality terrain

    // Request render mode for better performance control
    viewer.scene.requestRenderMode = false;  // Keep rendering continuously
    viewer.scene.maximumRenderTimeChange = Infinity;  // No render throttling

    updateProgress('Loading Google 3D Tiles...', 30);

    // Try to load Google Photorealistic 3D Tiles with optimized settings
    try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset();

        // Tileset performance optimizations
        tileset.maximumScreenSpaceError = 2;  // Lower = higher quality (will increase when moving)
        tileset.maximumMemoryUsage = 4096;    // MB - 4GB for aggressive caching
        tileset.cullRequestsWhileMoving = false; // Don't cull - keep loading while moving
        tileset.cullRequestsWhileMovingMultiplier = 120;
        tileset.preloadWhenHidden = true;     // Continue loading when tab not focused
        tileset.preferLeaves = true;          // Prefer loading leaf tiles for detail
        tileset.progressiveResolutionHeightFraction = 0.3;  // Show low-res tiles faster
        tileset.foveatedScreenSpaceError = true;  // Higher detail in center of screen
        tileset.foveatedConeSize = 0.2;       // Larger high-detail center area
        tileset.foveatedMinimumScreenSpaceErrorRelaxation = 0.0;
        tileset.dynamicScreenSpaceError = true;  // Adjust quality based on movement
        tileset.dynamicScreenSpaceErrorDensity = 0.00278;
        tileset.dynamicScreenSpaceErrorFactor = 4.0;

        // Cache and skip LOD settings - more aggressive loading
        tileset.skipLevelOfDetail = true;
        tileset.skipScreenSpaceErrorFactor = 8;  // Was 16, lower = load more detail
        tileset.skipLevels = 1;
        tileset.immediatelyLoadDesiredLevelOfDetail = true;  // Load high detail immediately
        tileset.loadSiblings = true;

        // Additional caching settings
        if (tileset.cacheBytes !== undefined) {
            tileset.cacheBytes = 4294967296; // 4GB cache
        }

        viewer.scene.primitives.add(tileset);
        console.log('Google Photorealistic 3D Tiles loaded successfully');

        // Store reference for preloading
        window.googleTileset = tileset;

        // Apply initial settings (in case user changed them before starting)
        tileset.show = gameSettings.tiles3D;

        // Tile loading event listeners for monitoring
        tileset.allTilesLoaded.addEventListener(() => {
            console.log('All visible tiles loaded!');
            window.tilesFullyLoaded = true;
        });

        tileset.loadProgress.addEventListener((numberOfPendingRequests, numberOfTilesProcessing) => {
            window.tilesFullyLoaded = (numberOfPendingRequests === 0 && numberOfTilesProcessing === 0);
        });
    } catch (error) {
        console.warn('Could not load Google 3D Tiles, using default imagery:', error);
    }

    // Set initial camera position
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(spawnLng, spawnLat, 500),
        orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-30),
            roll: 0
        }
    });

    loadingState.tilesLoaded = true;
    updateProgress('3D Tiles loaded!', 40);
}

// Force load tiles in current view - call this after camera moves
function forceLoadCurrentView() {
    if (!viewer || !window.googleTileset) return;

    // Trigger an immediate render to process tile requests
    viewer.scene.requestRender();

    // Force tileset to update
    if (window.googleTileset.update) {
        window.googleTileset.update(viewer.scene.frameState);
    }
}

// Adaptive quality - aggressively lower quality while moving fast
let tileQualityTimeout = null;
function updateTilesetQuality(speed, altitude) {
    if (!window.googleTileset || !viewer) return;

    // Calculate quality based on speed and altitude
    // Faster movement and higher altitude = lower quality (higher error value)
    const speedFactor = Math.min(speed / 50, 1); // 0-1 based on speed (50+ m/s = max)
    const altitudeFactor = Math.min(altitude / 400, 1); // 0-1 based on altitude (400+ m = max)
    const combinedFactor = Math.max(speedFactor, altitudeFactor * 0.5);

    if (speed > 5 || altitude > 200) {
        // Aggressive quality reduction: 2 (stopped) to 24 (fast/high)
        const targetError = 2 + (combinedFactor * 22);
        window.googleTileset.maximumScreenSpaceError = targetError;

        clearTimeout(tileQualityTimeout);
        tileQualityTimeout = setTimeout(() => {
            // Gradually return to high quality after stopping
            if (window.googleTileset) {
                window.googleTileset.maximumScreenSpaceError = 2;
            }
        }, 800);
    }
}

// Dynamic fog - thicker fog when moving fast to hide unloaded tiles
function updateDynamicFog(speed, altitude) {
    if (!viewer || !viewer.scene.fog.enabled) return;

    const scene = viewer.scene;

    // Base fog density
    const baseDensity = 0.00008;

    // Increase fog with speed (hides pop-in)
    const speedFog = (speed / 200) * 0.00015;

    // Increase fog at high altitude
    const altitudeFog = (Math.max(0, altitude - 100) / 500) * 0.00008;

    // Combined fog density
    const targetDensity = baseDensity + speedFog + altitudeFog;

    // Smooth transition
    scene.fog.density = scene.fog.density * 0.9 + targetDensity * 0.1;

    // Also adjust fog screen space error factor for better blending
    scene.fog.screenSpaceErrorFactor = 2.0 + (speed / 50) * 2.0;
}

// Preload tiles ahead of drone based on heading
function preloadAhead(heading, speed) {
    if (!viewer || !window.googleTileset || speed < 5) return;

    const headingRad = Cesium.Math.toRadians(heading);
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(droneState.latitude));

    // Look ahead distances based on speed
    const lookAheadDistances = [100, 250, 500];

    for (const dist of lookAheadDistances) {
        const futureLat = droneState.latitude + (Math.cos(headingRad) * dist) / metersPerDegLat;
        const futureLng = droneState.longitude + (Math.sin(headingRad) * dist) / metersPerDegLng;

        // Sample terrain to trigger tile loading at future positions
        Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
            Cesium.Cartographic.fromDegrees(futureLng, futureLat)
        ]).catch(() => {});
    }
}

// Wait for all visible tiles to load
function waitForTilesLoaded(timeoutMs = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();

        const checkLoaded = () => {
            if (window.tilesFullyLoaded) {
                resolve(true);
                return;
            }

            if (Date.now() - startTime > timeoutMs) {
                resolve(false); // Timeout
                return;
            }

            requestAnimationFrame(checkLoaded);
        };

        checkLoaded();
    });
}

// ============================================
// Drone Creation - Simple Billboard + Points
// ============================================
function createDroneCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const cx = 32;
    const cy = 32;

    // Draw quadcopter from top view
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;

    // Arms (X shape)
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy - 20);
    ctx.lineTo(cx + 20, cy + 20);
    ctx.moveTo(cx + 20, cy - 20);
    ctx.lineTo(cx - 20, cy + 20);
    ctx.stroke();

    // Center body
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();

    // Cyan accent on body
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();

    // Rotors (circles at corners)
    const rotorPositions = [
        { x: cx - 20, y: cy - 20 },
        { x: cx + 20, y: cy - 20 },
        { x: cx - 20, y: cy + 20 },
        { x: cx + 20, y: cy + 20 }
    ];

    rotorPositions.forEach(pos => {
        // Rotor disc
        ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Motor
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // Front indicator (green)
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(cx, cy - 14, 3, 0, Math.PI * 2);
    ctx.fill();

    // Back indicator (red)
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(cx - 4, cy + 14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 4, cy + 14, 2, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
}

function createDrone() {
    const droneCanvas = createDroneCanvas();

    // Main drone entity with billboard
    droneEntity = viewer.entities.add({
        name: 'Drone',
        position: new Cesium.CallbackProperty(() => {
            return Cesium.Cartesian3.fromDegrees(
                droneState.longitude,
                droneState.latitude,
                droneState.altitude
            );
        }, false),
        billboard: {
            image: droneCanvas,
            scale: 1.0,
            rotation: new Cesium.CallbackProperty(() => {
                // Rotate billboard to match drone heading
                return -Cesium.Math.toRadians(droneState.heading);
            }, false),
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            pixelOffset: new Cesium.Cartesian2(0, 0)
        }
    });

    // Add a simple shadow/ground indicator
    viewer.entities.add({
        name: 'DroneShadow',
        position: new Cesium.CallbackProperty(() => {
            return Cesium.Cartesian3.fromDegrees(
                droneState.longitude,
                droneState.latitude,
                0.5 // Just above ground
            );
        }, false),
        ellipse: {
            semiMajorAxis: 3,
            semiMinorAxis: 3,
            material: Cesium.Color.BLACK.withAlpha(0.3),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
    });

    console.log('Drone created with billboard');
}

function updateDronePrimitive() {
    // No longer needed - billboard updates automatically via CallbackProperty
}

// ============================================
// Drone Physics & Movement
// ============================================
function updateDrone(deltaTime) {
    // Check if turbo is active (shift key or button)
    const isTurbo = turboEnabled || keys.ShiftLeft || keys.ShiftRight;

    // Base values
    const baseAcceleration = 150;   // m/s^2 (snappier response)
    const baseTurnSpeed = 120;      // degrees/s
    const baseVerticalSpeed = 50;   // m/s
    const baseMaxSpeed = 150;       // m/s

    // Turbo multiplier (4x speed for intense boost!)
    const turboMultiplier = isTurbo ? 4.0 : 1.0;

    const acceleration = baseAcceleration * turboMultiplier;
    const turnSpeed = baseTurnSpeed * (isTurbo ? 2.0 : 1.0);  // Faster turning in turbo
    const verticalSpeed = baseVerticalSpeed * turboMultiplier;
    const maxSpeed = baseMaxSpeed * turboMultiplier;
    const drag = isTurbo ? 0.94 : 0.91;  // Much more friction for quicker stops

    // Update turbo indicator
    updateTurboIndicator(isTurbo);

    // Calculate forward direction based on heading
    const headingRad = Cesium.Math.toRadians(droneState.heading);
    const forwardX = Math.sin(headingRad);  // east component
    const forwardY = Math.cos(headingRad);  // north component

    // Calculate right direction (perpendicular to forward)
    const rightX = Math.cos(headingRad);
    const rightY = -Math.sin(headingRad);

    // Arrow keys: Forward/Back and Turn
    if (keys.ArrowUp) {
        droneState.velocityX += forwardX * acceleration * deltaTime;
        droneState.velocityY += forwardY * acceleration * deltaTime;
        droneState.pitch = Cesium.Math.lerp(droneState.pitch, -15, 0.1);
    } else if (keys.ArrowDown) {
        droneState.velocityX -= forwardX * acceleration * 0.7 * deltaTime;
        droneState.velocityY -= forwardY * acceleration * 0.7 * deltaTime;
        droneState.pitch = Cesium.Math.lerp(droneState.pitch, 10, 0.1);
    } else {
        droneState.pitch = Cesium.Math.lerp(droneState.pitch, 0, 0.05);
    }

    if (keys.ArrowLeft) {
        droneState.heading -= turnSpeed * deltaTime;
        droneState.roll = Cesium.Math.lerp(droneState.roll, 20, 0.1);
    } else if (keys.ArrowRight) {
        droneState.heading += turnSpeed * deltaTime;
        droneState.roll = Cesium.Math.lerp(droneState.roll, -20, 0.1);
    } else {
        droneState.roll = Cesium.Math.lerp(droneState.roll, 0, 0.05);
    }

    // Normalize heading to 0-360
    droneState.heading = ((droneState.heading % 360) + 360) % 360;

    // WASD: Altitude and Strafe
    if (keys.KeyW) {
        droneState.velocityZ += verticalSpeed * deltaTime;
    }
    if (keys.KeyS) {
        droneState.velocityZ -= verticalSpeed * deltaTime;
    }
    if (keys.KeyA) {
        droneState.velocityX -= rightX * acceleration * 0.5 * deltaTime;
        droneState.velocityY -= rightY * acceleration * 0.5 * deltaTime;
    }
    if (keys.KeyD) {
        droneState.velocityX += rightX * acceleration * 0.5 * deltaTime;
        droneState.velocityY += rightY * acceleration * 0.5 * deltaTime;
    }

    // Apply drag
    droneState.velocityX *= drag;
    droneState.velocityY *= drag;
    droneState.velocityZ *= drag;

    // Clamp horizontal speed
    const horizontalSpeed = Math.sqrt(droneState.velocityX ** 2 + droneState.velocityY ** 2);
    if (horizontalSpeed > maxSpeed) {
        const scale = maxSpeed / horizontalSpeed;
        droneState.velocityX *= scale;
        droneState.velocityY *= scale;
    }

    // Update position
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(droneState.latitude));

    droneState.longitude += (droneState.velocityX * deltaTime) / metersPerDegLng;
    droneState.latitude += (droneState.velocityY * deltaTime) / metersPerDegLat;
    droneState.altitude += droneState.velocityZ * deltaTime;

    // Ground collision (get terrain height)
    const terrainHeight = getTerrainHeight(droneState.longitude, droneState.latitude);
    const minAltitude = terrainHeight + 2;

    if (droneState.altitude < minAltitude) {
        droneState.altitude = minAltitude;
        droneState.velocityZ = 0;
    }

    // Max altitude
    if (droneState.altitude > terrainHeight + 500) {
        droneState.altitude = terrainHeight + 500;
        droneState.velocityZ = 0;
    }

    // Calculate speed for HUD
    droneState.speed = Math.sqrt(
        droneState.velocityX ** 2 +
        droneState.velocityY ** 2 +
        droneState.velocityZ ** 2
    );

    // Adaptive tile quality and fog - adjusts based on speed and altitude
    updateTilesetQuality(droneState.speed, droneState.altitude);
    updateDynamicFog(droneState.speed, droneState.altitude);

    // Preload tiles ahead of drone
    if (droneState.speed > 10) {
        preloadAhead(droneState.heading, droneState.speed);
    }
}

function getTerrainHeight(longitude, latitude) {
    // Get terrain height at position
    const cartographic = Cesium.Cartographic.fromDegrees(longitude, latitude);
    const height = viewer.scene.globe.getHeight(cartographic);
    return height || 0;
}

// ============================================
// Camera Control
// ============================================
function updateCamera() {
    const cameraDistance = 25;  // meters behind drone
    const cameraHeight = 12;    // meters above drone
    const lookAheadDistance = 40; // meters ahead to look at

    const headingRad = Cesium.Math.toRadians(droneState.heading);

    // Calculate camera position (behind and above the drone)
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(droneState.latitude));

    const cameraOffsetX = -Math.sin(headingRad) * cameraDistance;
    const cameraOffsetY = -Math.cos(headingRad) * cameraDistance;

    const cameraLng = droneState.longitude + cameraOffsetX / metersPerDegLng;
    const cameraLat = droneState.latitude + cameraOffsetY / metersPerDegLat;
    const cameraAlt = droneState.altitude + cameraHeight;

    // Calculate look-at position (ahead of the drone)
    const lookAtOffsetX = Math.sin(headingRad) * lookAheadDistance;
    const lookAtOffsetY = Math.cos(headingRad) * lookAheadDistance;

    const lookAtLng = droneState.longitude + lookAtOffsetX / metersPerDegLng;
    const lookAtLat = droneState.latitude + lookAtOffsetY / metersPerDegLat;
    const lookAtAlt = droneState.altitude - 10;

    // Set camera position and orientation
    const cameraPosition = Cesium.Cartesian3.fromDegrees(cameraLng, cameraLat, cameraAlt);
    const lookAtPosition = Cesium.Cartesian3.fromDegrees(lookAtLng, lookAtLat, lookAtAlt);

    viewer.camera.setView({
        destination: cameraPosition,
        orientation: {
            direction: Cesium.Cartesian3.normalize(
                Cesium.Cartesian3.subtract(lookAtPosition, cameraPosition, new Cesium.Cartesian3()),
                new Cesium.Cartesian3()
            ),
            up: Cesium.Cartesian3.normalize(cameraPosition, new Cesium.Cartesian3())
        }
    });
}

// ============================================
// Minimap with 2D Satellite Tiles
// ============================================
const minimapTileCache = new Map();
let minimapZoom = 15; // Zoomed out for better overview
const MINIMAP_ZOOM_MIN = 12;
const MINIMAP_ZOOM_MAX = 18;
const MINIMAP_TILE_SIZE = 256;

function zoomMinimapIn() {
    if (minimapZoom < MINIMAP_ZOOM_MAX) {
        minimapZoom++;
        updateMinimap();
    }
}

function zoomMinimapOut() {
    if (minimapZoom > MINIMAP_ZOOM_MIN) {
        minimapZoom--;
        updateMinimap();
    }
}

// Expose zoom functions globally for HTML onclick handlers
window.zoomMinimapIn = zoomMinimapIn;
window.zoomMinimapOut = zoomMinimapOut;

// Expose tile loading helpers globally
window.waitForTilesLoaded = waitForTilesLoaded;
window.forceLoadCurrentView = forceLoadCurrentView;

function initMinimap() {
    const minimapCanvas = document.getElementById('minimap-canvas');
    minimapCanvas.width = 300;
    minimapCanvas.height = 300;
}

function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

function getMinimapTileUrl(x, y, zoom) {
    // Use CartoDB Voyager - colorful street map with nice styling
    return `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`;
}

function loadMinimapTile(x, y, zoom) {
    const key = `${zoom}/${x}/${y}`;
    if (minimapTileCache.has(key)) {
        return minimapTileCache.get(key);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        minimapTileCache.set(key, img);
    };
    img.onerror = () => {
        minimapTileCache.set(key, null);
    };
    img.src = getMinimapTileUrl(x, y, zoom);
    minimapTileCache.set(key, 'loading');
    return 'loading';
}

function updateMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas with light background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Get current tile coordinates
    const centerTile = latLngToTile(droneState.latitude, droneState.longitude, minimapZoom);

    // Calculate exact position within tile for smooth scrolling
    const n = Math.pow(2, minimapZoom);
    const exactTileX = (droneState.longitude + 180) / 360 * n;
    const latRad = droneState.latitude * Math.PI / 180;
    const exactTileY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

    // Pixel offset within center tile
    const tileOffsetX = (exactTileX - centerTile.x) * MINIMAP_TILE_SIZE;
    const tileOffsetY = (exactTileY - centerTile.y) * MINIMAP_TILE_SIZE;

    // Scale factor for tiles
    const scale = width / (MINIMAP_TILE_SIZE * 1.5);

    // Draw 3x3 grid of tiles
    ctx.save();
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const tileX = centerTile.x + dx;
            const tileY = centerTile.y + dy;
            const key = `${minimapZoom}/${tileX}/${tileY}`;

            const tile = loadMinimapTile(tileX, tileY, minimapZoom);

            // Calculate draw position
            const drawX = centerX + (dx * MINIMAP_TILE_SIZE - tileOffsetX) * scale;
            const drawY = centerY + (dy * MINIMAP_TILE_SIZE - tileOffsetY) * scale;
            const drawSize = MINIMAP_TILE_SIZE * scale;

            if (tile && tile !== 'loading') {
                ctx.drawImage(tile, drawX - drawSize/2, drawY - drawSize/2, drawSize, drawSize);
            }
        }
    }
    ctx.restore();

    // Calculate scale for markers (meters per pixel on minimap)
    // 156543.03 is meters per pixel at zoom 0 at equator
    const metersPerTilePixel = 156543.03 * Math.cos(droneState.latitude * Math.PI / 180) / Math.pow(2, minimapZoom);
    const metersPerPixel = metersPerTilePixel / scale;

    // Draw restaurant markers with cuisine-based colors
    const cuisineColors = {
        'pizza': '#ff6b35',
        'italian': '#ff6b35',
        'chinese': '#e63946',
        'asian': '#e63946',
        'mexican': '#2a9d8f',
        'burger': '#f4a261',
        'american': '#f4a261',
        'japanese': '#e76f51',
        'sushi': '#e76f51',
        'cafe': '#8b5cf6',
        'coffee': '#8b5cf6',
        'thai': '#06d6a0',
        'indian': '#ffd166',
        'korean': '#ef476f',
        'seafood': '#118ab2',
        'vietnamese': '#06d6a0',
        'mediterranean': '#073b4c',
        'default': '#ff4444'
    };

    // Only show restaurant markers when no active order
    if (!gameState.currentOrder) {
    loadingState.restaurants.forEach(restaurant => {
        const deltaLng = restaurant.lon - droneState.longitude;
        const deltaLat = restaurant.lat - droneState.latitude;

        const metersPerDegLat = 111320;
        const metersPerDegLng = 111320 * Math.cos(droneState.latitude * Math.PI / 180);

        const offsetX = (deltaLng * metersPerDegLng) / metersPerPixel;
        const offsetY = -(deltaLat * metersPerDegLat) / metersPerPixel;

        const x = centerX + offsetX;
        const y = centerY + offsetY;

        if (x >= -10 && x <= width + 10 && y >= -10 && y <= height + 10) {
            // Get cuisine-based color
            const cuisine = (restaurant.cuisine || '').toLowerCase();
            const color = cuisineColors[cuisine] || cuisineColors.default;

            // Draw shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.arc(x + 1, y + 1, 9, 0, Math.PI * 2);
            ctx.fill();

            // Restaurant pin - larger and color-coded
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fill();

            // White border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Inner white dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    }

    // Draw pickup marker if active - BOLD GREEN
    if (gameState.currentOrder && gameState.currentOrder.status === 'accepted') {
        const restaurant = gameState.currentOrder.restaurant;
        const deltaLng = restaurant.lon - droneState.longitude;
        const deltaLat = restaurant.lat - droneState.latitude;

        const metersPerDegLat = 111320;
        const metersPerDegLng = 111320 * Math.cos(droneState.latitude * Math.PI / 180);

        const offsetX = (deltaLng * metersPerDegLng) / metersPerPixel;
        const offsetY = -(deltaLat * metersPerDegLat) / metersPerPixel;

        const x = centerX + offsetX;
        const y = centerY + offsetY;

        // Outer glow
        ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();

        // Bold green pickup marker
        ctx.fillStyle = '#00ff55';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // P label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', x, y);
    }

    // Draw delivery marker if active - BOLD GREEN
    if (gameState.currentOrder && gameState.currentOrder.status === 'picked_up') {
        const delivery = gameState.currentOrder.deliveryLocation;
        const deltaLng = delivery.longitude - droneState.longitude;
        const deltaLat = delivery.latitude - droneState.latitude;

        const metersPerDegLat = 111320;
        const metersPerDegLng = 111320 * Math.cos(droneState.latitude * Math.PI / 180);

        const offsetX = (deltaLng * metersPerDegLng) / metersPerPixel;
        const offsetY = -(deltaLat * metersPerDegLat) / metersPerPixel;

        const x = centerX + offsetX;
        const y = centerY + offsetY;

        // Outer glow
        ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fill();

        // Bold green delivery marker
        ctx.fillStyle = '#00ff55';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // D label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D', x, y);
    }

    // Draw navigation line to target - BOLD GREEN
    if (gameState.currentOrder) {
        let targetLat, targetLng;

        if (gameState.currentOrder.status === 'accepted') {
            targetLat = gameState.currentOrder.restaurant.lat;
            targetLng = gameState.currentOrder.restaurant.lon;
        } else if (gameState.currentOrder.status === 'picked_up') {
            targetLat = gameState.currentOrder.deliveryLocation.latitude;
            targetLng = gameState.currentOrder.deliveryLocation.longitude;
        }

        if (targetLat && targetLng) {
            const metersPerDegLat = 111320;
            const metersPerDegLng = 111320 * Math.cos(droneState.latitude * Math.PI / 180);

            const deltaLng = targetLng - droneState.longitude;
            const deltaLat = targetLat - droneState.latitude;

            const offsetX = (deltaLng * metersPerDegLng) / metersPerPixel;
            const offsetY = -(deltaLat * metersPerDegLat) / metersPerPixel;

            // Calculate direction and clamp line to minimap edge
            const angle = Math.atan2(offsetX, -offsetY);
            const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
            const maxDist = Math.min(width, height) / 2 - 20;

            let lineEndX, lineEndY;
            if (distance > maxDist) {
                lineEndX = centerX + Math.sin(angle) * maxDist;
                lineEndY = centerY - Math.cos(angle) * maxDist;
            } else {
                lineEndX = centerX + offsetX;
                lineEndY = centerY + offsetY;
            }

            // Draw bold green navigation line with glow
            ctx.save();

            // Outer glow
            ctx.strokeStyle = 'rgba(0, 255, 85, 0.4)';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();

            // Main bold green line
            ctx.strokeStyle = '#00ff55';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();

            // White center line for visibility
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();

            ctx.restore();
        }
    }

    // Draw drone icon (always centered, rotated)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(droneState.heading * Math.PI / 180);

    // Drone body
    ctx.fillStyle = '#00d4ff';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-8, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(8, 10);
    ctx.closePath();
    ctx.fill();

    // Outline
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Draw compass rose
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(centerX, 18, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', centerX, 18);

    // Border
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // Update navigation info
    updateMinimapNavigation();
}

function updateMinimapNavigation() {
    const navInfo = document.getElementById('minimap-nav');
    const navDistance = document.getElementById('nav-distance');
    const navDirection = document.getElementById('nav-direction');

    if (!gameState.currentOrder) {
        navInfo.classList.add('hidden');
        return;
    }

    let targetLat, targetLng, phase;

    if (gameState.currentOrder.status === 'accepted') {
        // Navigate to pickup (restaurant)
        targetLat = gameState.currentOrder.restaurant.lat;
        targetLng = gameState.currentOrder.restaurant.lon;
        phase = 'pickup';
    } else if (gameState.currentOrder.status === 'picked_up') {
        // Navigate to delivery
        targetLat = gameState.currentOrder.deliveryLocation.latitude;
        targetLng = gameState.currentOrder.deliveryLocation.longitude;
        phase = 'delivery';
    } else {
        navInfo.classList.add('hidden');
        return;
    }

    // Calculate distance
    const distance = calculateDistanceToPoint(targetLat, targetLng);
    navDistance.textContent = distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;

    // Calculate direction relative to drone heading
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(droneState.latitude * Math.PI / 180);

    const deltaLng = targetLng - droneState.longitude;
    const deltaLat = targetLat - droneState.latitude;

    const targetAngle = Math.atan2(deltaLng * metersPerDegLng, deltaLat * metersPerDegLat) * 180 / Math.PI;
    let relativeAngle = targetAngle - droneState.heading;

    // Normalize to -180 to 180
    while (relativeAngle > 180) relativeAngle -= 360;
    while (relativeAngle < -180) relativeAngle += 360;

    // Direction arrow based on relative angle
    let arrow;
    if (relativeAngle >= -22.5 && relativeAngle < 22.5) {
        arrow = '↑';  // Ahead
    } else if (relativeAngle >= 22.5 && relativeAngle < 67.5) {
        arrow = '↗';  // Front-right
    } else if (relativeAngle >= 67.5 && relativeAngle < 112.5) {
        arrow = '→';  // Right
    } else if (relativeAngle >= 112.5 && relativeAngle < 157.5) {
        arrow = '↘';  // Back-right
    } else if (relativeAngle >= 157.5 || relativeAngle < -157.5) {
        arrow = '↓';  // Behind
    } else if (relativeAngle >= -157.5 && relativeAngle < -112.5) {
        arrow = '↙';  // Back-left
    } else if (relativeAngle >= -112.5 && relativeAngle < -67.5) {
        arrow = '←';  // Left
    } else {
        arrow = '↖';  // Front-left
    }

    navDirection.textContent = arrow;

    // Update styling based on phase
    navInfo.classList.remove('hidden', 'pickup', 'delivery');
    navInfo.classList.add(phase);
}

// ============================================
// HUD Update
// ============================================
function updateHUD() {
    const terrainHeight = getTerrainHeight(droneState.longitude, droneState.latitude);
    const altitudeAGL = Math.round(droneState.altitude - terrainHeight);

    document.getElementById('altitude').textContent = altitudeAGL;
    document.getElementById('speed').textContent = droneState.speed.toFixed(1);

    let heading = Math.round(droneState.heading);
    if (heading < 0) heading += 360;
    document.getElementById('heading').textContent = heading;
}

// ============================================
// Turbo Speed Feature
// ============================================
function updateTurboIndicator(isTurbo) {
    const turboBtn = document.getElementById('turbo-btn');
    const turboIndicator = document.getElementById('turbo-indicator');

    if (turboBtn) {
        turboBtn.classList.toggle('active', isTurbo);
    }
    if (turboIndicator) {
        turboIndicator.classList.toggle('active', isTurbo);
        turboIndicator.textContent = isTurbo ? 'TURBO' : '';
    }
}

function setupTurboButton() {
    const turboBtn = document.getElementById('turbo-btn');
    if (!turboBtn) return;

    // Toggle turbo on click
    turboBtn.addEventListener('click', () => {
        turboEnabled = !turboEnabled;
        turboBtn.classList.toggle('active', turboEnabled);
    });

    // Also handle touch for mobile
    turboBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        turboEnabled = !turboEnabled;
        turboBtn.classList.toggle('active', turboEnabled);
    });
}

// ============================================
// Settings Menu
// ============================================
const gameSettings = {
    tiles3D: true,
    quality: 'medium',
    fog: true,
    shadows: true,
    showFps: false
};

function setupSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const settingsDone = document.getElementById('settings-done');

    // Toggles
    const toggle3DTiles = document.getElementById('toggle-3d-tiles');
    const toggleFog = document.getElementById('toggle-fog');
    const toggleShadows = document.getElementById('toggle-shadows');
    const toggleFps = document.getElementById('toggle-fps');
    const qualityPreset = document.getElementById('quality-preset');
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    const cacheCount = document.getElementById('cache-count');

    if (!settingsBtn || !settingsModal) return;

    // Open settings
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        updateCacheStats();
    });

    // Close settings
    const closeSettings = () => {
        settingsModal.classList.add('hidden');
    };

    settingsClose.addEventListener('click', closeSettings);
    settingsDone.addEventListener('click', closeSettings);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });

    // 3D Tiles toggle
    toggle3DTiles.addEventListener('change', () => {
        gameSettings.tiles3D = toggle3DTiles.checked;
        if (window.googleTileset) {
            window.googleTileset.show = gameSettings.tiles3D;
        }
    });

    // Fog toggle
    toggleFog.addEventListener('change', () => {
        gameSettings.fog = toggleFog.checked;
        if (viewer && viewer.scene) {
            viewer.scene.fog.enabled = gameSettings.fog;
        }
    });

    // Shadows toggle
    toggleShadows.addEventListener('change', () => {
        gameSettings.shadows = toggleShadows.checked;
        if (viewer) {
            viewer.shadows = gameSettings.shadows;
            if (viewer.scene) {
                viewer.scene.globe.enableLighting = gameSettings.shadows;
            }
        }
    });

    // Quality preset
    qualityPreset.addEventListener('change', () => {
        gameSettings.quality = qualityPreset.value;
        applyQualityPreset(gameSettings.quality);
    });

    // FPS toggle
    toggleFps.addEventListener('change', () => {
        gameSettings.showFps = toggleFps.checked;
        toggleFpsCounter(gameSettings.showFps);
    });

    // Clear cache
    clearCacheBtn.addEventListener('click', async () => {
        clearCacheBtn.textContent = 'Clearing...';
        clearCacheBtn.disabled = true;

        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data.cleared) {
                        cacheCount.textContent = '0';
                        clearCacheBtn.textContent = 'Cache Cleared!';
                        setTimeout(() => {
                            clearCacheBtn.textContent = 'Clear Tile Cache';
                            clearCacheBtn.disabled = false;
                        }, 2000);
                    }
                };
                navigator.serviceWorker.controller.postMessage(
                    { type: 'CLEAR_TILE_CACHE' },
                    [messageChannel.port2]
                );
            } else {
                // Fallback - clear caches directly
                if ('caches' in window) {
                    await caches.delete('google-3d-tiles-v1');
                    cacheCount.textContent = '0';
                    clearCacheBtn.textContent = 'Cache Cleared!';
                    setTimeout(() => {
                        clearCacheBtn.textContent = 'Clear Tile Cache';
                        clearCacheBtn.disabled = false;
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Failed to clear cache:', error);
            clearCacheBtn.textContent = 'Error';
            setTimeout(() => {
                clearCacheBtn.textContent = 'Clear Tile Cache';
                clearCacheBtn.disabled = false;
            }, 2000);
        }
    });
}

function updateCacheStats() {
    const cacheCount = document.getElementById('cache-count');
    if (!cacheCount) return;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event) => {
            cacheCount.textContent = event.data.entries || 0;
        };
        navigator.serviceWorker.controller.postMessage(
            { type: 'GET_CACHE_STATS' },
            [messageChannel.port2]
        );
    } else if ('caches' in window) {
        caches.open('google-3d-tiles-v1').then(cache => {
            cache.keys().then(keys => {
                cacheCount.textContent = keys.length;
            });
        }).catch(() => {
            cacheCount.textContent = '0';
        });
    }
}

function applyQualityPreset(preset) {
    if (!window.googleTileset || !viewer) return;

    switch (preset) {
        case 'low':
            window.googleTileset.maximumScreenSpaceError = 16;
            window.googleTileset.maximumMemoryUsage = 512;
            viewer.scene.fog.density = 0.0002;
            viewer.resolutionScale = 0.75;
            break;
        case 'medium':
            window.googleTileset.maximumScreenSpaceError = 8;
            window.googleTileset.maximumMemoryUsage = 2048;
            viewer.scene.fog.density = 0.0001;
            viewer.resolutionScale = 1.0;
            break;
        case 'high':
            window.googleTileset.maximumScreenSpaceError = 2;
            window.googleTileset.maximumMemoryUsage = 4096;
            viewer.scene.fog.density = 0.00005;
            viewer.resolutionScale = 1.0;
            break;
    }
}

// FPS Counter
let fpsElement = null;
let frameCount = 0;
let lastFpsUpdate = 0;

function toggleFpsCounter(show) {
    if (show) {
        if (!fpsElement) {
            fpsElement = document.createElement('div');
            fpsElement.className = 'fps-counter';
            fpsElement.textContent = 'FPS: --';
            document.body.appendChild(fpsElement);
        }
        fpsElement.classList.remove('hidden');
    } else if (fpsElement) {
        fpsElement.classList.add('hidden');
    }
}

function updateFps(timestamp) {
    if (!gameSettings.showFps || !fpsElement) return;

    frameCount++;
    if (timestamp - lastFpsUpdate >= 1000) {
        fpsElement.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsUpdate = timestamp;
    }
}

// ============================================
// Controls Setup
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
}

// ============================================
// Restaurant Loading (Google Places API)
// ============================================
let placesService = null;

// Wait for Google Maps API to be ready (with timeout)
function waitForGoogleMaps() {
    return new Promise((resolve, reject) => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
            console.log('Google Maps API already loaded');
            resolve();
        } else {
            console.log('Waiting for Google Maps API...');
            let attempts = 0;
            const maxAttempts = 100; // 10 seconds max
            const checkInterval = setInterval(() => {
                attempts++;
                if (typeof google !== 'undefined' && google.maps && google.maps.places) {
                    clearInterval(checkInterval);
                    console.log('Google Maps API loaded after', attempts * 100, 'ms');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    console.error('Google Maps API failed to load after 10 seconds');
                    reject(new Error('Google Maps API timeout'));
                }
            }, 100);
        }
    });
}

async function initPlacesService() {
    await waitForGoogleMaps();

    // Create a dummy map element for Places service
    const dummyMap = document.createElement('div');
    dummyMap.style.display = 'none';
    document.body.appendChild(dummyMap);

    const map = new google.maps.Map(dummyMap, {
        center: { lat: spawnLat, lng: spawnLng },
        zoom: 15
    });

    placesService = new google.maps.places.PlacesService(map);
}

async function loadRestaurants() {
    updateProgress('Loading restaurants...', 60);
    console.log('loadRestaurants() called');

    try {
        // Initialize Google Places service
        if (!placesService) {
            console.log('Initializing Places service...');
            await initPlacesService();
            console.log('Places service initialized:', placesService);
        }

        // Search for REAL restaurants using Google Places API with parallel processing
        console.log('Searching for real restaurants from Google Places...');
        const restaurants = await searchNearbyRestaurantsParallel();

        loadingState.restaurants = restaurants;
        console.log(`Loaded ${restaurants.length} REAL restaurants from Google Places`);

    } catch (error) {
        console.error('Could not load restaurants from Google Places:', error);
        console.error('Error stack:', error.stack);
        loadingState.restaurants = [];
    }

    console.log('Final restaurant count:', loadingState.restaurants.length);
    loadingState.restaurantsLoaded = true;
    updateProgress('Restaurants loaded!', 80);
}

// OPTIMIZED: Parallel search for real restaurants across the map
async function searchNearbyRestaurantsParallel() {
    const seenPlaceIds = new Set();
    const allRestaurants = [];

    // Create a large grid for comprehensive coverage
    // 9x9 grid covering approximately 14km x 14km
    const gridSize = 9;
    const latStep = 0.018;   // ~2km per step
    const lngStep = 0.024;   // ~2km per step (adjusted for longitude)

    const searchLocations = [];
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const lat = spawnLat + (row - Math.floor(gridSize / 2)) * latStep;
            const lng = spawnLng + (col - Math.floor(gridSize / 2)) * lngStep;
            searchLocations.push({ lat, lng });
        }
    }

    console.log(`Searching ${searchLocations.length} locations in parallel batches...`);

    // Process in parallel batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < searchLocations.length; i += batchSize) {
        const batch = searchLocations.slice(i, i + batchSize);

        // Run batch in parallel
        const batchPromises = batch.map(async (loc) => {
            const location = new google.maps.LatLng(loc.lat, loc.lng);
            try {
                return await searchAtLocation(location, 'restaurant');
            } catch (e) {
                console.warn(`Search failed at ${loc.lat}, ${loc.lng}:`, e);
                return [];
            }
        });

        const batchResults = await Promise.all(batchPromises);

        // Process results
        for (const results of batchResults) {
            for (const place of results) {
                if (!seenPlaceIds.has(place.place_id)) {
                    seenPlaceIds.add(place.place_id);
                    const allPhotos = place.photos ? place.photos.map(p =>
                        p.getUrl({ maxWidth: 400, maxHeight: 300 })
                    ) : [];

                    allRestaurants.push({
                        lat: place.geometry.location.lat(),
                        lon: place.geometry.location.lng(),
                        name: place.name,
                        cuisine: getCuisineFromTypes(place.types),
                        amenity: 'restaurant',
                        placeId: place.place_id,
                        rating: place.rating,
                        photoUrl: allPhotos[0] || null,
                        foodPhotos: allPhotos.slice(1)
                    });
                }
            }
        }

        console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(searchLocations.length / batchSize)}: Found ${allRestaurants.length} restaurants so far`);

        // Small delay between batches
        if (i + batchSize < searchLocations.length) {
            await new Promise(r => setTimeout(r, 150));
        }
    }

    // Also search for cafes and fast food in parallel at multiple locations
    const additionalSearches = [];
    const additionalLocations = [
        { lat: spawnLat, lng: spawnLng },
        { lat: spawnLat + latStep, lng: spawnLng },
        { lat: spawnLat - latStep, lng: spawnLng },
        { lat: spawnLat, lng: spawnLng + lngStep },
        { lat: spawnLat, lng: spawnLng - lngStep },
    ];

    for (const loc of additionalLocations) {
        const location = new google.maps.LatLng(loc.lat, loc.lng);
        additionalSearches.push(searchCafes(location).catch(() => []));
        additionalSearches.push(searchFastFood(location).catch(() => []));
    }

    const additionalResults = await Promise.all(additionalSearches);
    for (const results of additionalResults) {
        for (const place of results) {
            if (!seenPlaceIds.has(place.placeId)) {
                seenPlaceIds.add(place.placeId);
                allRestaurants.push(place);
            }
        }
    }

    console.log(`Found ${allRestaurants.length} unique REAL restaurants total`);
    return allRestaurants;
}

// Legacy sequential search (kept for fallback)
async function searchNearbyRestaurants() {
    const allRestaurants = [];
    const seenPlaceIds = new Set();

    const searchOffsets = [];
    const gridSize = 7;
    const latStep = 0.015;
    const lngStep = 0.02;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            searchOffsets.push({
                lat: (row - Math.floor(gridSize / 2)) * latStep,
                lng: (col - Math.floor(gridSize / 2)) * lngStep
            });
        }
    }

    for (let i = 0; i < searchOffsets.length; i++) {
        const offset = searchOffsets[i];
        const searchLat = spawnLat + offset.lat;
        const searchLng = spawnLng + offset.lng;
        const location = new google.maps.LatLng(searchLat, searchLng);

        try {
            const results = await searchAtLocation(location, 'restaurant');
            for (const place of results) {
                if (!seenPlaceIds.has(place.place_id)) {
                    seenPlaceIds.add(place.place_id);
                    const allPhotos = place.photos ? place.photos.map(p =>
                        p.getUrl({ maxWidth: 400, maxHeight: 300 })
                    ) : [];

                    allRestaurants.push({
                        lat: place.geometry.location.lat(),
                        lon: place.geometry.location.lng(),
                        name: place.name,
                        cuisine: getCuisineFromTypes(place.types),
                        amenity: 'restaurant',
                        placeId: place.place_id,
                        rating: place.rating,
                        photoUrl: allPhotos[0] || null,
                        foodPhotos: allPhotos.slice(1)
                    });
                }
            }

            if (i < searchOffsets.length - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        } catch (e) {
            console.warn(`Search at offset ${i} failed:`, e);
        }
    }

    return allRestaurants;
}

// Helper function to search at a specific location
function searchAtLocation(location, type) {
    return new Promise((resolve) => {
        const request = {
            location: location,
            radius: 2500,  // Increased radius for better coverage
            type: type
        };

        console.log('searchAtLocation:', { lat: location.lat(), lng: location.lng(), type });

        placesService.nearbySearch(request, (results, status) => {
            console.log('nearbySearch callback - status:', status, 'results:', results?.length || 0);
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                resolve(results);
            } else {
                console.warn('Search returned status:', status);
                resolve([]);
            }
        });
    });
}

// Search for fast food places
function searchFastFood(location) {
    return new Promise((resolve) => {
        const request = {
            location: location,
            radius: 2000,
            type: 'meal_takeaway'
        };

        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                const places = results.slice(0, 15).map(place => {
                    const allPhotos = place.photos ? place.photos.map(p =>
                        p.getUrl({ maxWidth: 400, maxHeight: 300 })
                    ) : [];

                    return {
                        lat: place.geometry.location.lat(),
                        lon: place.geometry.location.lng(),
                        name: place.name,
                        cuisine: getCuisineFromTypes(place.types),
                        amenity: 'fast_food',
                        placeId: place.place_id,
                        rating: place.rating,
                        photoUrl: allPhotos[0] || null,
                        foodPhotos: allPhotos.slice(1)
                    };
                });
                resolve(places);
            } else {
                resolve([]);
            }
        });
    });
}

function searchCafes(location) {
    return new Promise((resolve) => {
        const request = {
            location: location,
            radius: 2000,
            type: 'cafe'
        };

        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                const cafes = results.slice(0, 15).map(place => {
                    const allPhotos = place.photos ? place.photos.map(p =>
                        p.getUrl({ maxWidth: 400, maxHeight: 300 })
                    ) : [];

                    return {
                        lat: place.geometry.location.lat(),
                        lon: place.geometry.location.lng(),
                        name: place.name,
                        cuisine: 'cafe',
                        amenity: 'cafe',
                        placeId: place.place_id,
                        rating: place.rating,
                        photoUrl: allPhotos[0] || null,
                        foodPhotos: allPhotos.slice(1)
                    };
                });
                resolve(cafes);
            } else {
                resolve([]);
            }
        });
    });
}

function getCuisineFromTypes(types) {
    if (!types) return 'restaurant';

    const typeMapping = {
        'meal_delivery': 'fast_food',
        'meal_takeaway': 'fast_food',
        'cafe': 'cafe',
        'bakery': 'bakery',
        'bar': 'bar'
    };

    for (const type of types) {
        if (typeMapping[type]) {
            return typeMapping[type];
        }
    }

    return 'restaurant';
}

function generateFakeRestaurants() {
    const restaurants = [];
    const names = [
        "Joe's Pizza", "Dragon Palace", "Taco Fiesta", "Burger Barn",
        "Sushi House", "Cafe Milano", "Thai Garden", "BBQ Pit",
        "Golden Wok", "La Trattoria", "Seoul Kitchen", "Curry House",
        "The Grill", "Ocean Catch", "Pho Paradise", "Falafel King",
        "Noodle House", "The Steakhouse", "Green Garden", "Spice Route",
        "Pasta Palace", "Wok Express", "Taqueria Luna", "Prime Cuts",
        "Sakura Sushi", "The Coffee Bean", "Bangkok Kitchen", "Smokehouse",
        "Dim Sum House", "Olive Garden", "K-BBQ", "Bombay Bistro",
        "Diner Deluxe", "Lobster Shack", "Saigon Noodles", "Gyro King"
    ];
    const cuisines = ['pizza', 'chinese', 'mexican', 'burger', 'japanese', 'cafe', 'thai', 'bbq',
                      'chinese', 'italian', 'korean', 'indian', 'american', 'seafood', 'vietnamese', 'mediterranean',
                      'asian', 'steakhouse', 'vegetarian', 'indian', 'pizza', 'chinese', 'mexican', 'burger',
                      'japanese', 'cafe', 'thai', 'bbq', 'italian', 'korean', 'indian', 'seafood'];

    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(spawnLat));

    // Use a large grid for even distribution across the entire map
    const gridSize = 14;  // 14x14 grid = 196 potential cells
    const mapRadius = 6000;  // 6km radius (12km x 12km total area)
    const cellSize = (mapRadius * 2) / gridSize;

    let restaurantIndex = 0;

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            // Calculate cell center
            const cellCenterX = -mapRadius + (col + 0.5) * cellSize;
            const cellCenterY = -mapRadius + (row + 0.5) * cellSize;

            // Distance from center
            const distFromCenter = Math.sqrt(cellCenterX * cellCenterX + cellCenterY * cellCenterY);

            // Skip if too close to spawn point
            if (distFromCenter < 200) continue;

            // Determine how many restaurants in this cell based on distance
            // More restaurants closer to center, fewer at edges
            let restaurantsInCell = 1;
            if (distFromCenter < 2000) {
                restaurantsInCell = 2 + Math.floor(Math.random() * 2); // 2-3 near center
            } else if (distFromCenter < 4000) {
                restaurantsInCell = 1 + Math.floor(Math.random() * 2); // 1-2 mid range
            } else {
                restaurantsInCell = Math.random() > 0.3 ? 1 : 0; // 70% chance at edges
            }

            for (let r = 0; r < restaurantsInCell; r++) {
                // Add random jitter within cell
                const jitterX = (Math.random() - 0.5) * cellSize * 0.85;
                const jitterY = (Math.random() - 0.5) * cellSize * 0.85;

                const offsetX = cellCenterX + jitterX;
                const offsetY = cellCenterY + jitterY;

                restaurants.push({
                    lat: spawnLat + offsetY / metersPerDegLat,
                    lon: spawnLng + offsetX / metersPerDegLng,
                    name: names[restaurantIndex % names.length] + (restaurantIndex >= names.length ? ` ${Math.floor(restaurantIndex / names.length) + 1}` : ''),
                    cuisine: cuisines[restaurantIndex % cuisines.length],
                    amenity: 'restaurant'
                });
                restaurantIndex++;
            }
        }
    }

    console.log(`Generated ${restaurants.length} fake restaurants across the map`);

    // Shuffle the array to randomize order
    for (let i = restaurants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [restaurants[i], restaurants[j]] = [restaurants[j], restaurants[i]];
    }

    return restaurants;
}

// Post-process restaurants to ensure minimum spacing (not too aggressive)
function redistributeRestaurants(restaurants) {
    if (restaurants.length < 10) return restaurants;

    const minDistance = 100; // Minimum 100m between restaurants (reduced from 200)
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(spawnLat));

    const result = [];
    const gridCells = new Map();
    const cellSize = minDistance;

    for (const restaurant of restaurants) {
        const cellX = Math.floor((restaurant.lon - spawnLng) * metersPerDegLng / cellSize);
        const cellY = Math.floor((restaurant.lat - spawnLat) * metersPerDegLat / cellSize);
        const cellKey = `${cellX},${cellY}`;

        // Only check exact cell, not adjacent (less aggressive filtering)
        if (!gridCells.has(cellKey)) {
            result.push(restaurant);
            gridCells.set(cellKey, true);
        }
    }

    return result;
}

// Cuisine-based thumbnail images
const cuisineImages = {
    'pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=80&h=80&fit=crop',
    'italian': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=80&h=80&fit=crop',
    'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&h=80&fit=crop',
    'american': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=80&h=80&fit=crop',
    'mexican': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=80&h=80&fit=crop',
    'taco': 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=80&h=80&fit=crop',
    'chinese': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=80&h=80&fit=crop',
    'japanese': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=80&h=80&fit=crop',
    'sushi': 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=80&h=80&fit=crop',
    'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=80&h=80&fit=crop',
    'thai': 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=80&h=80&fit=crop',
    'indian': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=80&h=80&fit=crop',
    'curry': 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=80&h=80&fit=crop',
    'korean': 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=80&h=80&fit=crop',
    'vietnamese': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=80&h=80&fit=crop',
    'pho': 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=80&h=80&fit=crop',
    'cafe': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=80&h=80&fit=crop',
    'coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=80&h=80&fit=crop',
    'bakery': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=80&h=80&fit=crop',
    'bbq': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=80&h=80&fit=crop',
    'barbecue': 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=80&h=80&fit=crop',
    'seafood': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=80&h=80&fit=crop',
    'fish': 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=80&h=80&fit=crop',
    'chicken': 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=80&h=80&fit=crop',
    'sandwich': 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=80&h=80&fit=crop',
    'deli': 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=80&h=80&fit=crop',
    'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=80&h=80&fit=crop',
    'ice_cream': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=80&h=80&fit=crop',
    'dessert': 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=80&h=80&fit=crop',
    'default': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=80&h=80&fit=crop'
};

const restaurantImageCache = new Map();

function getRestaurantThumbnail(restaurant) {
    // First, check if we have a Google Places photo URL
    if (restaurant.photoUrl) {
        return restaurant.photoUrl;
    }

    const name = (restaurant.name || '').toLowerCase();
    const cuisine = (restaurant.cuisine || '').toLowerCase();
    const amenity = restaurant.amenity || 'restaurant';

    // Check name and cuisine for matching keywords
    for (const [key, url] of Object.entries(cuisineImages)) {
        if (name.includes(key) || cuisine.includes(key)) {
            return url;
        }
    }

    // Amenity type fallback
    if (amenity === 'cafe') return cuisineImages.cafe;
    if (amenity === 'fast_food') return cuisineImages.burger;
    if (amenity === 'bar') return 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=80&h=80&fit=crop';

    return cuisineImages.default;
}

function createRestaurantMarkers() {
    console.log(`createRestaurantMarkers() called with ${loadingState.restaurants.length} restaurants`);

    if (!loadingState.restaurants || loadingState.restaurants.length === 0) {
        console.error('No restaurants to create markers for!');
        return;
    }

    loadingState.restaurants.forEach((restaurant, index) => {
        if (index === 0) {
            console.log('First restaurant:', restaurant);
        }
        // Create canvas-based marker with photo loaded async
        createRestaurantMarkerWithPhoto(restaurant);
    });

    console.log('Finished creating restaurant markers');
}

function createRestaurantMarkerWithPhoto(restaurant) {
    const fallbackUrl = getCuisineFallbackImage(restaurant);

    // Try Google Places photo first if available, using CORS proxy
    if (restaurant.photoUrl) {
        const googleImg = new Image();
        googleImg.crossOrigin = 'anonymous';

        // Use CORS proxy to fetch Google Places images
        const proxiedUrl = `${CORS_PROXY_URL}?url=${encodeURIComponent(restaurant.photoUrl)}`;

        googleImg.onload = () => {
            // Image loaded via CORS proxy - use it
            const canvas = createMarkerCanvasWithImage(restaurant, googleImg);
            addRestaurantEntity(restaurant, canvas);
        };

        googleImg.onerror = () => {
            // Proxy failed - fall back to cuisine-based images
            console.warn('CORS proxy failed for:', restaurant.name, '- using fallback');
            loadFallbackImage(restaurant, fallbackUrl);
        };

        googleImg.src = proxiedUrl;
    } else {
        // No Google photo available - use fallback directly
        loadFallbackImage(restaurant, fallbackUrl);
    }
}

function loadFallbackImage(restaurant, fallbackUrl) {
    const fallbackImg = new Image();
    fallbackImg.crossOrigin = 'anonymous';

    fallbackImg.onload = () => {
        const canvas = createMarkerCanvasWithImage(restaurant, fallbackImg);
        addRestaurantEntity(restaurant, canvas);
    };

    fallbackImg.onerror = () => {
        // If proxied fallback fails, use text-only marker
        console.warn('Fallback image failed for:', restaurant.name);
        const canvas = createMarkerCanvasFallback(restaurant);
        addRestaurantEntity(restaurant, canvas);
    };

    // Route through CORS proxy to ensure canvas can use the image
    const proxiedFallbackUrl = `${CORS_PROXY_URL}?url=${encodeURIComponent(fallbackUrl)}`;
    fallbackImg.src = proxiedFallbackUrl;
}

// Create a marker canvas with an actual image
function createMarkerCanvasWithImage(restaurant, img) {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');
    const centerX = 110;

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    // Main card background
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(10, 10, 200, 210, 16);
    ctx.fill();

    // Pin point
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(centerX, 240);
    ctx.lineTo(centerX - 20, 215);
    ctx.lineTo(centerX + 20, 215);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 200, 210, 16);
    ctx.stroke();

    // Draw the restaurant photo
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(18, 18, 184, 120, 12);
    ctx.clip();

    // Scale and center the image to fill the area
    const imgAspect = img.width / img.height;
    const boxAspect = 184 / 120;
    let drawWidth, drawHeight, drawX, drawY;

    if (imgAspect > boxAspect) {
        drawHeight = 120;
        drawWidth = 120 * imgAspect;
        drawX = 18 + (184 - drawWidth) / 2;
        drawY = 18;
    } else {
        drawWidth = 184;
        drawHeight = 184 / imgAspect;
        drawX = 18;
        drawY = 18 + (120 - drawHeight) / 2;
    }

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();

    // Restaurant name background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.beginPath();
    ctx.roundRect(18, 145, 184, 65, 10);
    ctx.fill();

    // Restaurant name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let name = restaurant.name;
    if (ctx.measureText(name).width > 170) {
        while (ctx.measureText(name + '...').width > 170 && name.length > 0) {
            name = name.slice(0, -1);
        }
        name += '...';
    }
    ctx.fillText(name, centerX, 168);

    // Cuisine type
    if (restaurant.cuisine) {
        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(restaurant.cuisine, centerX, 193);
    }

    return canvas;
}

// Get CORS-friendly image based on restaurant cuisine/type
function getCuisineFallbackImage(restaurant) {
    const name = (restaurant.name || '').toLowerCase();
    const cuisine = (restaurant.cuisine || '').toLowerCase();

    // Check for specific cuisine types
    if (name.includes('pizza') || cuisine.includes('pizza')) {
        return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=150&fit=crop';
    }
    if (name.includes('burger') || cuisine.includes('burger') || name.includes('mcdonald') || name.includes('wendy') || name.includes('five guys')) {
        return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&h=150&fit=crop';
    }
    if (name.includes('sushi') || cuisine.includes('japanese') || cuisine.includes('sushi')) {
        return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&h=150&fit=crop';
    }
    if (name.includes('taco') || cuisine.includes('mexican') || name.includes('chipotle')) {
        return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&h=150&fit=crop';
    }
    if (cuisine.includes('chinese') || name.includes('chinese') || name.includes('panda')) {
        return 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=200&h=150&fit=crop';
    }
    if (name.includes('coffee') || name.includes('starbucks') || name.includes('cafe') || cuisine.includes('cafe')) {
        return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&h=150&fit=crop';
    }
    if (name.includes('chicken') || name.includes('kfc') || name.includes('popeye')) {
        return 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=200&h=150&fit=crop';
    }
    if (cuisine.includes('italian') || name.includes('italian') || name.includes('pasta')) {
        return 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=200&h=150&fit=crop';
    }
    if (cuisine.includes('indian') || name.includes('indian') || name.includes('curry')) {
        return 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200&h=150&fit=crop';
    }
    if (name.includes('sandwich') || name.includes('subway') || name.includes('deli')) {
        return 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=200&h=150&fit=crop';
    }
    if (name.includes('donut') || name.includes('dunkin') || name.includes('bakery')) {
        return 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=200&h=150&fit=crop';
    }
    if (name.includes('thai') || cuisine.includes('thai')) {
        return 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=200&h=150&fit=crop';
    }

    // Default restaurant image
    return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=150&fit=crop';
}

function addRestaurantEntity(restaurant, canvas) {
    const entity = viewer.entities.add({
        name: restaurant.name,
        position: Cesium.Cartesian3.fromDegrees(restaurant.lon, restaurant.lat, 0),
        billboard: {
            image: canvas,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 1.0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            // Show restaurants from further away (2km range)
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2000),
            // Scale based on distance: full size nearby, smaller at distance
            scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 1500, 0.4)
        },
        properties: {
            restaurant: restaurant
        }
    });

    restaurantEntities.push(entity);
}

// Hide all restaurant markers (during active delivery)
function hideRestaurantMarkers() {
    restaurantEntities.forEach(entity => {
        entity.show = false;
    });
}

// Show all restaurant markers (after delivery complete/cancelled)
function showRestaurantMarkers() {
    restaurantEntities.forEach(entity => {
        entity.show = true;
    });
}

// ============================================
// Restaurant Modal & Click Detection
// ============================================
let selectedRestaurant = null;

function setupRestaurantClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((click) => {
        const pickedObject = viewer.scene.pick(click.position);

        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
            const restaurant = pickedObject.id.properties.restaurant;
            if (restaurant) {
                const restaurantData = restaurant.getValue ? restaurant.getValue() : restaurant;
                openRestaurantModal(restaurantData);
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}

function openRestaurantModal(restaurant) {
    selectedRestaurant = restaurant;

    // Show loading state
    const modal = document.getElementById('restaurant-modal');
    const photosContainer = document.getElementById('restaurant-photos');
    const nameEl = document.getElementById('restaurant-modal-name');

    nameEl.textContent = restaurant.name;
    photosContainer.innerHTML = '<div class="no-photos-placeholder">Loading...</div>';

    modal.classList.remove('hidden');

    // Fetch full details from Google Places
    if (restaurant.placeId) {
        fetchPlaceDetails(restaurant.placeId);
    } else {
        // No placeId - show basic info
        populateModalBasic(restaurant);
    }
}

function fetchPlaceDetails(placeId) {
    // Check cache first
    if (placeDetailsCache.has(placeId)) {
        populateModalWithDetails(placeDetailsCache.get(placeId));
        return;
    }

    const request = {
        placeId: placeId,
        fields: [
            'name', 'formatted_address', 'formatted_phone_number',
            'opening_hours', 'photos', 'rating', 'user_ratings_total',
            'price_level', 'reviews', 'types', 'website', 'url'
        ]
    };

    placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            placeDetailsCache.set(placeId, place);
            populateModalWithDetails(place);
        } else {
            console.warn('Could not fetch place details:', status);
            populateModalBasic(selectedRestaurant);
        }
    });
}

function populateModalWithDetails(place) {
    const photosContainer = document.getElementById('restaurant-photos');
    const nameEl = document.getElementById('restaurant-modal-name');
    const ratingEl = document.getElementById('restaurant-modal-rating');
    const priceEl = document.getElementById('restaurant-modal-price');
    const typesEl = document.getElementById('restaurant-modal-types');
    const statusEl = document.getElementById('restaurant-modal-status');
    const addressEl = document.getElementById('restaurant-modal-address');
    const phoneEl = document.getElementById('restaurant-modal-phone');
    const hoursEl = document.getElementById('restaurant-modal-hours');
    const reviewsEl = document.getElementById('restaurant-modal-reviews');

    // Name
    nameEl.textContent = place.name;

    // Photos
    if (place.photos && place.photos.length > 0) {
        const photoUrls = place.photos.slice(0, 5).map(photo =>
            photo.getUrl({ maxWidth: 600, maxHeight: 400 })
        );

        photosContainer.innerHTML = `
            <div class="photo-gallery">
                ${photoUrls.map(url => `<img src="${url}" alt="${place.name}">`).join('')}
            </div>
            ${photoUrls.length > 1 ? `
                <div class="photo-indicators">
                    ${photoUrls.map((_, i) => `<div class="photo-indicator ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('')}
                </div>
            ` : ''}
        `;

        // Setup photo scroll indicators
        if (photoUrls.length > 1) {
            setupPhotoGallery();
        }
    } else {
        photosContainer.innerHTML = '<div class="no-photos-placeholder">🍽️</div>';
    }

    // Rating
    if (place.rating) {
        const stars = '★'.repeat(Math.round(place.rating)) + '☆'.repeat(5 - Math.round(place.rating));
        ratingEl.innerHTML = `
            <span class="stars">${stars}</span>
            <span class="rating-count">${place.rating} (${place.user_ratings_total || 0} reviews)</span>
        `;
    } else {
        ratingEl.innerHTML = '<span class="rating-count">No ratings yet</span>';
    }

    // Price level
    if (place.price_level !== undefined) {
        priceEl.textContent = '$'.repeat(place.price_level || 1);
    } else {
        priceEl.textContent = '';
    }

    // Types
    if (place.types && place.types.length > 0) {
        const readableTypes = place.types
            .filter(t => !['point_of_interest', 'establishment', 'food'].includes(t))
            .slice(0, 4)
            .map(t => t.replace(/_/g, ' '));

        typesEl.innerHTML = readableTypes
            .map(t => `<span class="restaurant-type-tag">${t}</span>`)
            .join('');
    } else {
        typesEl.innerHTML = '';
    }

    // Open status
    if (place.opening_hours) {
        const isOpen = place.opening_hours.isOpen ? place.opening_hours.isOpen() : null;
        if (isOpen !== null) {
            statusEl.textContent = isOpen ? 'Open Now' : 'Closed';
            statusEl.className = `restaurant-status ${isOpen ? 'open' : 'closed'}`;
        } else {
            statusEl.textContent = '';
        }
    } else {
        statusEl.textContent = '';
    }

    // Address
    if (place.formatted_address) {
        addressEl.textContent = place.formatted_address;
        addressEl.style.display = 'flex';
    } else {
        addressEl.style.display = 'none';
    }

    // Phone
    if (place.formatted_phone_number) {
        phoneEl.textContent = place.formatted_phone_number;
        phoneEl.style.display = 'flex';
    } else {
        phoneEl.style.display = 'none';
    }

    // Hours
    if (place.opening_hours && place.opening_hours.weekday_text) {
        const today = new Date().getDay();
        const adjustedToday = today === 0 ? 6 : today - 1; // Google uses Mon=0

        hoursEl.innerHTML = `
            <div class="restaurant-hours-title">Hours</div>
            <div class="restaurant-hours-list">
                ${place.opening_hours.weekday_text.map((text, i) =>
                    `<div class="${i === adjustedToday ? 'today' : ''}">${text}</div>`
                ).join('')}
            </div>
        `;
        hoursEl.style.display = 'block';
    } else {
        hoursEl.style.display = 'none';
    }

    // Reviews
    if (place.reviews && place.reviews.length > 0) {
        reviewsEl.innerHTML = `
            <div class="restaurant-reviews-title">Reviews</div>
            ${place.reviews.slice(0, 3).map(review => `
                <div class="review-card">
                    <div class="review-header">
                        <img class="review-avatar" src="${review.profile_photo_url || 'https://via.placeholder.com/36'}" alt="${review.author_name}">
                        <div class="review-author">
                            <div class="review-author-name">${review.author_name}</div>
                            <div class="review-date">${review.relative_time_description}</div>
                        </div>
                        <div class="review-rating">${'★'.repeat(review.rating)}</div>
                    </div>
                    <div class="review-text">${review.text ? review.text.substring(0, 200) + (review.text.length > 200 ? '...' : '') : ''}</div>
                </div>
            `).join('')}
        `;
        reviewsEl.style.display = 'block';
    } else {
        reviewsEl.style.display = 'none';
    }

    // Store place data for ordering
    selectedRestaurant.placeDetails = place;
}

function populateModalBasic(restaurant) {
    const photosContainer = document.getElementById('restaurant-photos');
    const nameEl = document.getElementById('restaurant-modal-name');
    const ratingEl = document.getElementById('restaurant-modal-rating');
    const priceEl = document.getElementById('restaurant-modal-price');
    const typesEl = document.getElementById('restaurant-modal-types');
    const statusEl = document.getElementById('restaurant-modal-status');
    const addressEl = document.getElementById('restaurant-modal-address');
    const phoneEl = document.getElementById('restaurant-modal-phone');
    const hoursEl = document.getElementById('restaurant-modal-hours');
    const reviewsEl = document.getElementById('restaurant-modal-reviews');

    nameEl.textContent = restaurant.name;

    // Photo
    if (restaurant.photoUrl) {
        photosContainer.innerHTML = `<img src="${restaurant.photoUrl}" alt="${restaurant.name}">`;
    } else {
        photosContainer.innerHTML = '<div class="no-photos-placeholder">🍽️</div>';
    }

    // Rating
    if (restaurant.rating) {
        const stars = '★'.repeat(Math.round(restaurant.rating)) + '☆'.repeat(5 - Math.round(restaurant.rating));
        ratingEl.innerHTML = `<span class="stars">${stars}</span><span class="rating-count">${restaurant.rating}</span>`;
    } else {
        ratingEl.innerHTML = '';
    }

    // Clear other fields
    priceEl.textContent = '';
    typesEl.innerHTML = restaurant.cuisine ? `<span class="restaurant-type-tag">${restaurant.cuisine}</span>` : '';
    statusEl.textContent = '';
    addressEl.style.display = 'none';
    phoneEl.style.display = 'none';
    hoursEl.style.display = 'none';
    reviewsEl.style.display = 'none';
}

function setupPhotoGallery() {
    const gallery = document.querySelector('.photo-gallery');
    const indicators = document.querySelectorAll('.photo-indicator');

    if (!gallery || indicators.length === 0) return;

    gallery.addEventListener('scroll', () => {
        const scrollPos = gallery.scrollLeft;
        const photoWidth = gallery.offsetWidth;
        const currentIndex = Math.round(scrollPos / photoWidth);

        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === currentIndex);
        });
    });

    indicators.forEach((ind, i) => {
        ind.addEventListener('click', () => {
            gallery.scrollTo({
                left: i * gallery.offsetWidth,
                behavior: 'smooth'
            });
        });
    });
}

function closeRestaurantModal() {
    document.getElementById('restaurant-modal').classList.add('hidden');
    selectedRestaurant = null;
}

function orderFromRestaurant() {
    if (!selectedRestaurant || !gameState.isPlaying) return;

    // Generate an order from this restaurant
    const order = generateOrder(selectedRestaurant);
    gameState.orderQueue.push(order);
    renderOrderList();

    closeRestaurantModal();

    // Auto-accept if no current order
    if (!gameState.currentOrder) {
        acceptOrder(order);
    }
}

function setupRestaurantModalListeners() {
    document.getElementById('restaurant-modal-close').addEventListener('click', closeRestaurantModal);
    document.getElementById('restaurant-order-btn').addEventListener('click', orderFromRestaurant);

    // Close on background click
    document.getElementById('restaurant-modal').addEventListener('click', (e) => {
        if (e.target.id === 'restaurant-modal') {
            closeRestaurantModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeRestaurantModal();
        }
    });
}

function createMarkerCanvasFallback(restaurant) {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');

    const centerX = 110;

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    // Main card background
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(10, 10, 200, 210, 16);
    ctx.fill();

    // Pin point
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(centerX, 240);
    ctx.lineTo(centerX - 20, 215);
    ctx.lineTo(centerX + 20, 215);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 200, 210, 16);
    ctx.stroke();

    // Icon area background
    ctx.fillStyle = '#2a2a4a';
    ctx.beginPath();
    ctx.roundRect(18, 18, 184, 120, 12);
    ctx.fill();

    // Food icon - larger
    ctx.fillStyle = '#ff6b6b';
    ctx.font = '60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍽️', centerX, 80);

    // Restaurant name background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.beginPath();
    ctx.roundRect(18, 145, 184, 65, 10);
    ctx.fill();

    // Restaurant name - larger font
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let name = restaurant.name;
    if (ctx.measureText(name).width > 170) {
        while (ctx.measureText(name + '...').width > 170 && name.length > 0) {
            name = name.slice(0, -1);
        }
        name += '...';
    }
    ctx.fillText(name, centerX, 168);

    // Cuisine type - larger
    if (restaurant.cuisine) {
        ctx.fillStyle = '#00d4ff';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(restaurant.cuisine, centerX, 193);
    }

    return canvas;
}

// ============================================
// Game Mechanics
// ============================================
function getMenuCategory(restaurant) {
    const name = (restaurant.name || '').toLowerCase();
    const cuisine = (restaurant.cuisine || '').toLowerCase();

    // Check for brand-specific menu first
    for (const brand of Object.keys(brandMenus)) {
        if (name.includes(brand)) {
            return { type: 'brand', brand: brand };
        }
    }

    // Pizza places
    if (name.includes('pizza') || name.includes('pizzeria') || cuisine.includes('pizza')) return 'pizza';

    // Burger joints
    if (name.includes('burger') || name.includes('grill') && !name.includes('bar')) return 'burger';

    // Mexican
    if (name.includes('taco') || name.includes('burrito') || name.includes('mexican') ||
        name.includes('cantina') || name.includes('taqueria') || cuisine.includes('mexican')) return 'mexican';

    // Chinese
    if (name.includes('chinese') || name.includes('wok') || name.includes('panda') ||
        name.includes('dragon') || name.includes('golden') || cuisine.includes('chinese')) return 'chinese';

    // Japanese
    if (name.includes('sushi') || name.includes('ramen') || name.includes('japanese') ||
        name.includes('hibachi') || name.includes('teriyaki') || cuisine.includes('japanese')) return 'japanese';

    // Korean
    if (name.includes('korean') || name.includes('bbq') && name.includes('k') ||
        name.includes('bibimbap') || cuisine.includes('korean')) return 'korean';

    // Thai
    if (name.includes('thai') || name.includes('pad') || cuisine.includes('thai')) return 'thai';

    // Vietnamese
    if (name.includes('pho') || name.includes('vietnamese') || name.includes('banh') ||
        name.includes('saigon') || cuisine.includes('vietnamese')) return 'vietnamese';

    // Indian
    if (name.includes('indian') || name.includes('curry') || name.includes('tandoori') ||
        name.includes('masala') || name.includes('bombay') || cuisine.includes('indian')) return 'indian';

    // Italian
    if (name.includes('italian') || name.includes('pasta') || name.includes('trattoria') ||
        name.includes('ristorante') || cuisine.includes('italian')) return 'italian';

    // Mediterranean/Greek
    if (name.includes('mediterranean') || name.includes('greek') || name.includes('falafel') ||
        name.includes('gyro') || name.includes('shawarma') || name.includes('kebab') ||
        cuisine.includes('mediterranean') || cuisine.includes('greek')) return 'mediterranean';

    // Cafe/Coffee
    if (name.includes('cafe') || name.includes('coffee') || name.includes('espresso') ||
        name.includes('roast') || cuisine.includes('cafe')) return 'cafe';

    // Bakery
    if (name.includes('bakery') || name.includes('donut') || name.includes('bagel') ||
        name.includes('pastry') || cuisine.includes('bakery')) return 'bakery';

    // BBQ
    if (name.includes('bbq') || name.includes('barbecue') || name.includes('smokehouse') ||
        name.includes('brisket') || cuisine.includes('bbq')) return 'bbq';

    // Seafood
    if (name.includes('seafood') || name.includes('fish') || name.includes('lobster') ||
        name.includes('crab') || name.includes('shrimp') || cuisine.includes('seafood')) return 'seafood';

    return 'default';
}

function generateDeliveryLocation(restaurant) {
    const distance = 400 + Math.random() * 1200; // 400-1600m (longer deliveries)
    const angle = Math.random() * Math.PI * 2;

    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(restaurant.lat));

    const lat = restaurant.lat + (Math.cos(angle) * distance) / metersPerDegLat;
    const lng = restaurant.lon + (Math.sin(angle) * distance) / metersPerDegLng;

    const streetNum = Math.floor(Math.random() * 9000) + 100;
    const streetName = streetNames[Math.floor(Math.random() * streetNames.length)];
    const streetSuffix = streetSuffixes[Math.floor(Math.random() * streetSuffixes.length)];

    // Generate Google Street View thumbnail URL
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=200x200&location=${lat},${lng}&fov=90&heading=0&pitch=0&key=${GOOGLE_API_KEY}`;

    return {
        latitude: lat,
        longitude: lng,
        address: `${streetNum} ${streetName} ${streetSuffix}`,
        streetViewUrl: streetViewUrl
    };
}

function calculateDistanceToPoint(lat, lng) {
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(droneState.latitude));

    const deltaLat = lat - droneState.latitude;
    const deltaLng = lng - droneState.longitude;

    const distX = deltaLng * metersPerDegLng;
    const distY = deltaLat * metersPerDegLat;

    return Math.sqrt(distX * distX + distY * distY);
}

function generateOrder(restaurant) {
    const categoryResult = getMenuCategory(restaurant);
    const customer = customerNames[Math.floor(Math.random() * customerNames.length)];
    const deliveryLocation = generateDeliveryLocation(restaurant);

    // Get menu items based on brand or category
    let menuItems;
    let categoryName;

    if (typeof categoryResult === 'object' && categoryResult.type === 'brand') {
        // Use brand-specific menu (real items for chains like McDonald's, Starbucks, etc.)
        menuItems = brandMenus[categoryResult.brand];
        categoryName = categoryResult.brand;
    } else {
        // Use generic category menu
        const menu = menuDatabase[categoryResult] || menuDatabase.default;
        menuItems = menu.items;
        categoryName = categoryResult;
    }

    // Get food photos from restaurant or cached place details
    let foodPhotos = restaurant.foodPhotos || [];

    // If we have cached place details with more photos, use those
    if (restaurant.placeId && placeDetailsCache.has(restaurant.placeId)) {
        const placeDetails = placeDetailsCache.get(restaurant.placeId);
        if (placeDetails.photos && placeDetails.photos.length > 1) {
            foodPhotos = placeDetails.photos.slice(1).map(p =>
                p.getUrl({ maxWidth: 300, maxHeight: 200 })
            );
        }
    }

    const numItems = Math.floor(Math.random() * 3) + 1;
    const orderItems = [];
    const usedItems = new Set();

    for (let i = 0; i < numItems; i++) {
        const item = menuItems[Math.floor(Math.random() * menuItems.length)];
        if (!usedItems.has(item.name)) {
            usedItems.add(item.name);

            // Assign a food photo to this item
            let itemPhoto = null;
            if (foodPhotos.length > 0) {
                // Use real photos from the restaurant, cycling through them
                itemPhoto = foodPhotos[orderItems.length % foodPhotos.length];
            } else {
                // Fallback to cuisine-based stock images
                itemPhoto = getFoodImageForItem(item.name, categoryName);
            }

            orderItems.push({
                name: item.name,
                price: item.price,
                quantity: Math.random() > 0.8 ? 2 : 1,
                prepTime: item.prep,
                photoUrl: itemPhoto
            });
        }
    }

    const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const distance = calculateDistanceToPoint(restaurant.lat, restaurant.lon) +
                    calculateDistanceToPoint(deliveryLocation.latitude, deliveryLocation.longitude);

    const basePay = 3.50 + subtotal * 0.15;
    const distanceBonus = distance * 0.01;

    return {
        id: Date.now() + Math.random(),
        customer: customer,
        restaurant: restaurant,
        items: orderItems,
        subtotal: subtotal,
        deliveryLocation: deliveryLocation,
        estimatedPay: basePay + distanceBonus,
        distance: distance,
        status: 'available',
        timeLimit: 180 + Math.ceil(distance / 5),
        bonus: Math.random() > 0.7 ? (Math.random() * 3 + 1).toFixed(2) : 0
    };
}

// Food image fallbacks based on item name and cuisine
const foodImageDatabase = {
    burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop',
    pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop',
    taco: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&h=200&fit=crop',
    burrito: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=300&h=200&fit=crop',
    sushi: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&h=200&fit=crop',
    ramen: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=300&h=200&fit=crop',
    chinese: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300&h=200&fit=crop',
    chicken: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=300&h=200&fit=crop',
    fries: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=300&h=200&fit=crop',
    salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=200&fit=crop',
    coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=200&fit=crop',
    latte: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=200&fit=crop',
    sandwich: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=300&h=200&fit=crop',
    pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=300&h=200&fit=crop',
    steak: 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=300&h=200&fit=crop',
    wings: 'https://images.unsplash.com/photo-1608039829572-9b0afb78e87b?w=300&h=200&fit=crop',
    nachos: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=300&h=200&fit=crop',
    curry: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=300&h=200&fit=crop',
    soup: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&h=200&fit=crop',
    dessert: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=300&h=200&fit=crop',
    default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=200&fit=crop'
};

function getFoodImageForItem(itemName, category) {
    const nameLower = itemName.toLowerCase();

    // Check for specific food keywords in item name
    for (const [keyword, url] of Object.entries(foodImageDatabase)) {
        if (nameLower.includes(keyword)) {
            return url;
        }
    }

    // Category-based fallback
    const categoryImages = {
        burger: foodImageDatabase.burger,
        pizza: foodImageDatabase.pizza,
        mexican: foodImageDatabase.taco,
        chinese: foodImageDatabase.chinese,
        japanese: foodImageDatabase.sushi,
        cafe: foodImageDatabase.coffee,
        default: foodImageDatabase.default
    };

    return categoryImages[category] || categoryImages.default;
}

function startGame() {
    gameState.isPlaying = true;
    gameState.earnings = 0;
    gameState.totalDeliveries = 0;
    gameState.streak = 0;

    document.getElementById('start-game-container').classList.add('hidden');
    document.getElementById('game-stats').classList.remove('hidden');
    document.getElementById('order-panel').classList.remove('hidden');

    // Generate initial orders
    generateNewOrders();

    // Start order generation interval
    gameState.orderInterval = setInterval(generateNewOrders, 15000);

    updateGameUI();
}

function generateNewOrders() {
    if (gameState.orderQueue.length >= 5) return;

    const availableRestaurants = loadingState.restaurants.filter(r => {
        return !gameState.orderQueue.some(o => o.restaurant.name === r.name);
    });

    if (availableRestaurants.length === 0) return;

    const restaurant = availableRestaurants[Math.floor(Math.random() * availableRestaurants.length)];
    const order = generateOrder(restaurant);

    gameState.orderQueue.push(order);
    renderOrderList();
}

function renderOrderList() {
    const orderList = document.getElementById('order-list');
    orderList.innerHTML = '';

    const defaultFoodPhoto = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=200&fit=crop';

    gameState.orderQueue.forEach(order => {
        const restaurantPhoto = getRestaurantThumbnail(order.restaurant);

        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-card-header">
                <img class="order-card-photo" src="${restaurantPhoto}" alt="${order.restaurant.name}" onerror="this.src='${defaultFoodPhoto}'">
                <div class="order-card-info">
                    <div class="order-card-restaurant">${order.restaurant.name}</div>
                    <div class="order-card-items">${order.items.length} item(s) - $${order.subtotal.toFixed(2)}</div>
                </div>
            </div>
            <div class="order-card-food-items">
                ${order.items.map(item => `
                    <div class="order-food-item">
                        <img src="${item.photoUrl || defaultFoodPhoto}" alt="${item.name}" onerror="this.src='${defaultFoodPhoto}'">
                        <span>${item.quantity}x ${item.name}</span>
                    </div>
                `).join('')}
            </div>
            <div class="order-card-details">
                <span class="order-card-pay">$${order.estimatedPay.toFixed(2)}</span>
                <span class="order-card-distance">${Math.round(order.distance)}m</span>
            </div>
        `;

        card.addEventListener('click', () => acceptOrder(order));
        orderList.appendChild(card);
    });
}

function acceptOrder(order) {
    if (gameState.currentOrder) return;

    gameState.currentOrder = order;
    order.status = 'accepted';
    order.startTime = Date.now();

    // Remove from queue
    gameState.orderQueue = gameState.orderQueue.filter(o => o.id !== order.id);

    // Hide order panel, show active delivery
    document.getElementById('order-panel').classList.add('hidden');
    document.getElementById('active-delivery').classList.remove('hidden');

    // Hide all restaurant markers to reduce clutter
    hideRestaurantMarkers();

    // Update delivery UI
    updateDeliveryUI();

    // Create pickup marker
    createPickupMarker(order.restaurant);

    renderOrderList();
}

function createPickupMarker(restaurant) {
    if (pickupEntity) {
        viewer.entities.remove(pickupEntity);
    }

    pickupEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(restaurant.lon, restaurant.lat, 0),
        billboard: {
            image: createPickupCanvas(restaurant.name),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 1.0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(50, 1.5, 600, 0.8)
        }
    });
}

function createPickupCanvas(restaurantName) {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    const centerX = 90;

    // Outer glow
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 25;

    // Main pin background
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(centerX, 70, 60, 0, Math.PI * 2);
    ctx.fill();

    // Pin point
    ctx.beginPath();
    ctx.moveTo(centerX, 180);
    ctx.lineTo(centerX - 35, 115);
    ctx.lineTo(centerX + 35, 115);
    ctx.closePath();
    ctx.fill();

    // Inner circle (dark)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(centerX, 70, 50, 0, Math.PI * 2);
    ctx.fill();

    // Restaurant icon
    ctx.fillStyle = '#ffcc00';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍴', centerX, 55);

    // PICKUP text
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('PICKUP', centerX, 95);

    // Restaurant name below
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    let name = restaurantName || '';
    if (ctx.measureText(name).width > 150) {
        while (ctx.measureText(name + '...').width > 150 && name.length > 0) {
            name = name.slice(0, -1);
        }
        name += '...';
    }
    ctx.fillText(name, centerX, 200);

    return canvas;
}

function createDeliveryMarker(location) {
    if (deliveryEntity) {
        viewer.entities.remove(deliveryEntity);
    }

    // Create initial marker with placeholder
    const placeholderCanvas = createDeliveryCanvas(location.address, null);
    deliveryEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude, 0),
        billboard: {
            image: placeholderCanvas,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 1.0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(50, 1.5, 600, 0.8)
        }
    });

    // Load Street View image and update marker
    if (location.streetViewUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            if (deliveryEntity && deliveryEntity.billboard) {
                const canvasWithImage = createDeliveryCanvas(location.address, img);
                deliveryEntity.billboard.image = canvasWithImage;
            }
        };
        img.onerror = () => {
            console.warn('Street View image failed to load');
        };
        img.src = location.streetViewUrl;
    }
}

function createDeliveryCanvas(address, streetViewImg) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 260;
    const ctx = canvas.getContext('2d');
    const centerX = 100;

    // Outer glow
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 25;

    // Main pin background
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(centerX, 80, 70, 0, Math.PI * 2);
    ctx.fill();

    // Pin point
    ctx.beginPath();
    ctx.moveTo(centerX, 210);
    ctx.lineTo(centerX - 40, 135);
    ctx.lineTo(centerX + 40, 135);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // Draw Street View image or fallback
    if (streetViewImg) {
        // Create circular clip for Street View image
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, 80, 58, 0, Math.PI * 2);
        ctx.clip();

        // Draw the street view image centered in the circle
        const imgSize = 116;
        ctx.drawImage(streetViewImg, centerX - imgSize/2, 80 - imgSize/2, imgSize, imgSize);
        ctx.restore();

        // Add slight border around image
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, 80, 58, 0, Math.PI * 2);
        ctx.stroke();
    } else {
        // Fallback: Inner circle (dark) with home icon
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(centerX, 80, 58, 0, Math.PI * 2);
        ctx.fill();

        // Home/delivery icon
        ctx.fillStyle = '#00ff88';
        ctx.font = '50px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏠', centerX, 70);
    }

    // DELIVER label at bottom of circle
    ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
    ctx.beginPath();
    ctx.roundRect(centerX - 45, 118, 90, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DELIVER', centerX, 129);

    // Address below
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    let addr = address || 'Customer';
    if (ctx.measureText(addr).width > 180) {
        while (ctx.measureText(addr + '...').width > 180 && addr.length > 0) {
            addr = addr.slice(0, -1);
        }
        addr += '...';
    }
    ctx.fillText(addr, centerX, 240);

    return canvas;
}

function updateDeliveryUI() {
    const order = gameState.currentOrder;
    if (!order) return;

    const defaultFoodPhoto = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=200&fit=crop';
    const defaultStreetView = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=200&h=200&fit=crop';

    document.getElementById('delivery-name').textContent = order.restaurant.name;
    document.getElementById('delivery-address').textContent = order.restaurant.address || 'Restaurant Location';
    document.getElementById('customer-name').textContent = order.customer;
    document.getElementById('customer-address').textContent = order.deliveryLocation.address;
    document.getElementById('delivery-pay').textContent = `$${order.estimatedPay.toFixed(2)}`;

    // Set restaurant photo
    const photoEl = document.getElementById('delivery-photo');
    const photoUrl = getRestaurantThumbnail(order.restaurant);
    photoEl.src = photoUrl;
    photoEl.alt = order.restaurant.name;
    photoEl.onerror = () => { photoEl.src = defaultFoodPhoto; };

    // Set delivery location Street View thumbnail
    const streetViewEl = document.getElementById('delivery-streetview');
    if (streetViewEl && order.deliveryLocation.streetViewUrl) {
        streetViewEl.src = order.deliveryLocation.streetViewUrl;
        streetViewEl.alt = 'Delivery Location';
        streetViewEl.onerror = () => { streetViewEl.src = defaultStreetView; };
    } else if (streetViewEl) {
        streetViewEl.src = defaultStreetView;
    }

    // Update items with food photos
    const itemsContainer = document.getElementById('delivery-items');
    itemsContainer.innerHTML = order.items.map(item => {
        const itemPhoto = item.photoUrl || defaultFoodPhoto;
        return `
            <div class="delivery-item-row">
                <img class="delivery-item-photo" src="${itemPhoto}" alt="${item.name}" onerror="this.src='${defaultFoodPhoto}'">
                <div class="delivery-item-info">
                    <span class="delivery-item-name"><span class="delivery-item-qty">${item.quantity}x</span> ${item.name}</span>
                    <span class="delivery-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');

    // Update phase
    const phaseEl = document.getElementById('delivery-phase');
    if (order.status === 'accepted') {
        phaseEl.textContent = 'PICK UP';
        phaseEl.className = 'delivery-phase pickup';
    } else if (order.status === 'picked_up') {
        phaseEl.textContent = 'DELIVER';
        phaseEl.className = 'delivery-phase deliver';
    }
}

function checkDeliveryProgress() {
    if (!gameState.currentOrder) return;

    const order = gameState.currentOrder;

    if (order.status === 'accepted') {
        // Check if at pickup location
        const distance = calculateDistanceToPoint(order.restaurant.lat, order.restaurant.lon);
        document.getElementById('delivery-distance').textContent = `${Math.round(distance)}m`;

        const altitudeAboveGround = droneState.altitude - getTerrainHeight(droneState.longitude, droneState.latitude);
        if (distance < gameState.pickupRadius && altitudeAboveGround < gameState.maxDeliveryAltitude) {
            // Picked up!
            order.status = 'picked_up';

            // Remove pickup marker, add delivery marker
            if (pickupEntity) {
                viewer.entities.remove(pickupEntity);
                pickupEntity = null;
            }
            createDeliveryMarker(order.deliveryLocation);

            updateDeliveryUI();
        }
    } else if (order.status === 'picked_up') {
        // Check if at delivery location
        const distance = calculateDistanceToPoint(order.deliveryLocation.latitude, order.deliveryLocation.longitude);
        document.getElementById('delivery-distance').textContent = `${Math.round(distance)}m`;

        const altAboveGround = droneState.altitude - getTerrainHeight(droneState.longitude, droneState.latitude);
        if (distance < gameState.deliveryRadius && altAboveGround < gameState.maxDeliveryAltitude) {
            // Delivered!
            completeDelivery();
        }
    }

    // Update timer
    const elapsed = (Date.now() - order.startTime) / 1000;
    const remaining = Math.max(0, order.timeLimit - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    document.getElementById('delivery-timer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    if (remaining <= 0) {
        // Time's up - order failed
        cancelDelivery();
    }
}

function completeDelivery() {
    const order = gameState.currentOrder;

    // Calculate pay
    const basePay = order.estimatedPay;
    const tip = parseFloat(order.bonus) || 0;
    const total = basePay + tip;

    gameState.earnings += total;
    gameState.totalDeliveries++;
    gameState.streak++;

    if (gameState.streak > gameState.bestStreak) {
        gameState.bestStreak = gameState.streak;
    }

    // Show completion popup
    document.getElementById('complete-base').textContent = `$${(basePay * 0.7).toFixed(2)}`;
    document.getElementById('complete-distance').textContent = `$${(basePay * 0.3).toFixed(2)}`;
    document.getElementById('complete-tip').textContent = `$${tip.toFixed(2)}`;
    document.getElementById('complete-total').textContent = `$${total.toFixed(2)}`;

    document.getElementById('delivery-complete').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('delivery-complete').classList.add('hidden');
    }, 3000);

    // Clean up
    if (deliveryEntity) {
        viewer.entities.remove(deliveryEntity);
        deliveryEntity = null;
    }

    gameState.currentOrder = null;

    // Show restaurant markers again
    showRestaurantMarkers();

    // Show order panel again
    document.getElementById('active-delivery').classList.add('hidden');
    document.getElementById('order-panel').classList.remove('hidden');

    updateGameUI();
}

function cancelDelivery() {
    gameState.streak = 0;

    if (pickupEntity) {
        viewer.entities.remove(pickupEntity);
        pickupEntity = null;
    }
    if (deliveryEntity) {
        viewer.entities.remove(deliveryEntity);
        deliveryEntity = null;
    }

    gameState.currentOrder = null;

    // Show restaurant markers again
    showRestaurantMarkers();

    document.getElementById('active-delivery').classList.add('hidden');
    document.getElementById('order-panel').classList.remove('hidden');

    updateGameUI();
}

function updateGameUI() {
    document.getElementById('earnings').textContent = `$${gameState.earnings.toFixed(2)}`;
    document.getElementById('deliveries').textContent = gameState.totalDeliveries;
    document.getElementById('streak').textContent = gameState.streak;
}

function setupGameControls() {
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    document.getElementById('cancel-delivery').addEventListener('click', cancelDelivery);
}

// ============================================
// Animation Loop
// ============================================
let lastTime = performance.now();

function animate(timestamp) {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms
    lastTime = currentTime;

    updateDrone(deltaTime);
    updateDronePrimitive(); // Update drone model position/rotation
    updateCamera();
    updateHUD();
    updateMinimap();
    updateFps(timestamp);

    if (gameState.isPlaying) {
        checkDeliveryProgress();
    }
}

// ============================================
// Modal & Initialization
// ============================================
async function geocodeLocation(query) {
    // Wait for Google Maps API to be ready
    await waitForGoogleMaps();

    // Use Google Geocoding API
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) throw new Error('Geocoding request failed');

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error('Location not found');
    }

    const result = data.results[0];
    return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        displayName: result.formatted_address
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
    const spawnSettingsBtn = document.getElementById('spawn-settings-btn');

    // Settings button on spawn modal
    spawnSettingsBtn.addEventListener('click', () => {
        document.getElementById('settings-modal').classList.remove('hidden');
    });

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

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            latInput.value = btn.dataset.lat;
            lngInput.value = btn.dataset.lng;
            searchStatus.textContent = '';
        });
    });

    startBtn.addEventListener('click', async () => {
        spawnLat = parseFloat(latInput.value) || 40.7128;
        spawnLng = parseFloat(lngInput.value) || -74.0060;

        droneState.latitude = spawnLat;
        droneState.longitude = spawnLng;
        droneState.altitude = 150;

        modal.classList.add('hidden');
        document.getElementById('loading-modal').classList.remove('hidden');

        await startSimulation();
    });
}

async function startSimulation() {
    try {
        // Initialize Cesium
        await initCesium();

        // Load restaurants from Google Places
        updateProgress('Loading restaurants...', 50);
        await loadRestaurants();

        // Create entities
        updateProgress('Creating drone...', 65);
        createDrone();
        createRestaurantMarkers();

        // Pre-load minimap tiles
        updateProgress('Loading minimap...', 75);
        await preloadMinimapTiles();

        // Pre-fetch place details for nearby restaurants
        updateProgress('Loading details...', 85);
        await prefetchPlaceDetails();

        // Setup controls
        updateProgress('Starting...', 95);
        setupControls();
        initMinimap();
        setupGameControls();
        setupRestaurantClickHandler();
        setupRestaurantModalListeners();
        setupTurboButton();

        updateProgress('Ready!', 100);
        await new Promise(r => setTimeout(r, 300));

        // Hide loading, show HUD
        document.getElementById('loading-modal').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('minimap-container').style.display = 'block';
        document.getElementById('start-game-container').classList.remove('hidden');

        // Start animation loop
        animate();

        // Background preload (non-blocking) - builds cache while playing
        setTimeout(() => {
            lightBackgroundPreload();
        }, 3000);

    } catch (error) {
        console.error('Failed to start simulation:', error);
        updateProgress(`Error: ${error.message}`, 0);
    }
}

// Light background preload - doesn't block, runs while playing
function lightBackgroundPreload() {
    if (!viewer || !window.googleTileset) return;

    const preloadRadii = [200, 400, 800];
    const preloadAngles = 8;
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(spawnLat));

    let index = 0;
    const positions = [];

    for (const radius of preloadRadii) {
        for (let i = 0; i < preloadAngles; i++) {
            const angle = (i / preloadAngles) * Math.PI * 2;
            positions.push({
                lat: spawnLat + (Math.cos(angle) * radius) / metersPerDegLat,
                lng: spawnLng + (Math.sin(angle) * radius) / metersPerDegLng
            });
        }
    }

    // Slowly trigger tile loads in background
    const interval = setInterval(() => {
        if (index >= positions.length) {
            clearInterval(interval);
            return;
        }
        const pos = positions[index++];
        Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
            Cesium.Cartographic.fromDegrees(pos.lng, pos.lat)
        ]).catch(() => {});
    }, 500);
}

// ============================================
// Pre-loading Functions
// ============================================
async function preloadMinimapTiles() {
    const centerTile = latLngToTile(spawnLat, spawnLng, minimapZoom);

    const tilesToLoad = [];
    // Load 5x5 grid of tiles around spawn
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const tileX = centerTile.x + dx;
            const tileY = centerTile.y + dy;
            tilesToLoad.push(loadMinimapTileAsync(tileX, tileY, minimapZoom));
        }
    }

    await Promise.all(tilesToLoad);
}

function loadMinimapTileAsync(x, y, zoom) {
    return new Promise((resolve) => {
        const key = `${zoom}/${x}/${y}`;
        if (minimapTileCache.has(key) && minimapTileCache.get(key) !== 'loading') {
            resolve();
            return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            minimapTileCache.set(key, img);
            resolve();
        };
        img.onerror = () => {
            minimapTileCache.set(key, null);
            resolve();
        };
        img.src = getMinimapTileUrl(x, y, zoom);
    });
}

async function preloadRestaurantImages() {
    const imagePromises = loadingState.restaurants.map(restaurant => {
        return new Promise((resolve) => {
            if (!restaurant.photoUrl) {
                resolve();
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = restaurant.photoUrl;
        });
    });

    await Promise.all(imagePromises);
}

async function prefetchPlaceDetails() {
    // Get closest 10 restaurants to pre-fetch details
    const sortedRestaurants = [...loadingState.restaurants]
        .filter(r => r.placeId)
        .sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.lat - spawnLat, 2) + Math.pow(a.lon - spawnLng, 2));
            const distB = Math.sqrt(Math.pow(b.lat - spawnLat, 2) + Math.pow(b.lon - spawnLng, 2));
            return distA - distB;
        })
        .slice(0, 10);

    // Fetch details in parallel (but limit concurrency)
    const batchSize = 3;
    for (let i = 0; i < sortedRestaurants.length; i += batchSize) {
        const batch = sortedRestaurants.slice(i, i + batchSize);
        await Promise.all(batch.map(r => prefetchSinglePlaceDetails(r.placeId)));
    }
}

function prefetchSinglePlaceDetails(placeId) {
    return new Promise((resolve) => {
        if (placeDetailsCache.has(placeId)) {
            resolve();
            return;
        }

        const request = {
            placeId: placeId,
            fields: [
                'name', 'formatted_address', 'formatted_phone_number',
                'opening_hours', 'photos', 'rating', 'user_ratings_total',
                'price_level', 'reviews', 'types', 'website', 'url'
            ]
        };

        placesService.getDetails(request, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                placeDetailsCache.set(placeId, place);
            }
            resolve();
        });
    });
}

// ============================================
// Entry Point
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupModal();
    setupSettings(); // Setup settings early so it works from spawn modal
});

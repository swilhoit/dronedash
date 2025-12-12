// Drone Dash - Delivery Game with CesiumJS and Google 3D Tiles
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// ============================================
// Configuration
// ============================================
const CESIUM_ION_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyYzg1YmU2My03MzVlLTQzNmItOGVjOS1lYzkwZjkzZjNkMmUiLCJpZCI6Mjg2NTQ5LCJpYXQiOjE3NDI1OTczMTR9.ABaRbmxTbv1A89WB1fwVxEi8oPzsfQmdlAz1E3gbOQA';
const GOOGLE_API_KEY = 'AIzaSyAHdMOFQoW-UKhIS0vEmkqi7-TNNhpuvtI';

Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN;

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
    KeyD: false
};

// Loading state
let loadingState = {
    tilesLoaded: false,
    restaurantsLoaded: false,
    restaurants: []
};

// Restaurant markers
let restaurantEntities = [];
let restaurantLabels = [];

// Street labels overlay layer
let streetLabelsLayer = null;
let streetLabelsEnabled = false;

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
    pickupRadius: 30,
    deliveryRadius: 25,
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
const menuDatabase = {
    burger: {
        items: [
            { name: "Classic Cheeseburger", price: 8.99, prep: 5 },
            { name: "Double Bacon Burger", price: 12.99, prep: 7 },
            { name: "Veggie Burger", price: 9.99, prep: 6 },
            { name: "Large Fries", price: 4.99, prep: 3 },
            { name: "Milkshake", price: 5.99, prep: 3 }
        ]
    },
    pizza: {
        items: [
            { name: "Pepperoni Pizza (Large)", price: 18.99, prep: 15 },
            { name: "Margherita Pizza", price: 16.99, prep: 12 },
            { name: "Buffalo Wings (12pc)", price: 14.99, prep: 12 },
            { name: "Garlic Knots", price: 6.99, prep: 8 }
        ]
    },
    mexican: {
        items: [
            { name: "Burrito Bowl", price: 11.99, prep: 8 },
            { name: "Chicken Burrito", price: 10.99, prep: 7 },
            { name: "Steak Tacos (3)", price: 12.99, prep: 8 },
            { name: "Nachos Supreme", price: 13.99, prep: 10 }
        ]
    },
    chinese: {
        items: [
            { name: "Orange Chicken", price: 13.99, prep: 12 },
            { name: "Kung Pao Chicken", price: 14.99, prep: 12 },
            { name: "Fried Rice", price: 10.99, prep: 8 },
            { name: "Egg Rolls (4)", price: 6.99, prep: 6 }
        ]
    },
    japanese: {
        items: [
            { name: "California Roll (8pc)", price: 12.99, prep: 10 },
            { name: "Spicy Tuna Roll", price: 14.99, prep: 10 },
            { name: "Chicken Teriyaki", price: 14.99, prep: 12 },
            { name: "Ramen Bowl", price: 15.99, prep: 15 }
        ]
    },
    cafe: {
        items: [
            { name: "Latte", price: 5.99, prep: 4 },
            { name: "Cappuccino", price: 5.49, prep: 4 },
            { name: "Croissant", price: 3.99, prep: 2 },
            { name: "Avocado Toast", price: 9.99, prep: 6 }
        ]
    },
    default: {
        items: [
            { name: "House Special", price: 15.99, prep: 12 },
            { name: "Chef's Salad", price: 11.99, prep: 6 },
            { name: "Grilled Chicken", price: 14.99, prep: 12 },
            { name: "Soup & Sandwich", price: 10.99, prep: 8 }
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
        terrainShadows: Cesium.ShadowMode.ENABLED
    });

    // Disable default camera controls - we'll use our own
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableZoom = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;
    viewer.scene.screenSpaceCameraController.enableLook = false;

    updateProgress('Loading Google 3D Tiles...', 30);

    // Try to load Google Photorealistic 3D Tiles
    try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset();
        viewer.scene.primitives.add(tileset);
        console.log('Google Photorealistic 3D Tiles loaded successfully');
    } catch (error) {
        console.warn('Could not load Google 3D Tiles, using default imagery:', error);
        // Falls back to default Cesium imagery
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
    updateProgress('3D Tiles loaded!', 50);
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
    const acceleration = 120;       // m/s^2
    const turnSpeed = 120;          // degrees/s
    const verticalSpeed = 40;       // m/s
    const drag = 0.97;
    const maxSpeed = 150;           // m/s

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
const MINIMAP_ZOOM = 15; // Zoomed out for better overview
const MINIMAP_TILE_SIZE = 256;

function initMinimap() {
    const minimapCanvas = document.getElementById('minimap-canvas');
    minimapCanvas.width = 230;
    minimapCanvas.height = 230;
}

function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

function getMinimapTileUrl(x, y, zoom) {
    // Use CartoDB light street map tiles
    return `https://basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`;
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
    const centerTile = latLngToTile(droneState.latitude, droneState.longitude, MINIMAP_ZOOM);

    // Calculate exact position within tile for smooth scrolling
    const n = Math.pow(2, MINIMAP_ZOOM);
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
            const key = `${MINIMAP_ZOOM}/${tileX}/${tileY}`;

            const tile = loadMinimapTile(tileX, tileY, MINIMAP_ZOOM);

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
    const metersPerTile = 156543.03 * Math.cos(droneState.latitude * Math.PI / 180) / Math.pow(2, MINIMAP_ZOOM);
    const metersPerPixel = metersPerTile / (MINIMAP_TILE_SIZE * scale);

    // Draw restaurant markers
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
            // Restaurant pin - larger and more visible
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Restaurant icon (fork/knife shape)
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 8px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🍴', x, y);
        }
    });

    // Draw pickup marker if active
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

        // Pulsing pickup marker
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // P label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', x, y);
    }

    // Draw delivery marker if active
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

        // Delivery marker
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // D label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D', x, y);
    }

    // Draw navigation line to target
    if (gameState.currentOrder) {
        let targetLat, targetLng, lineColor;

        if (gameState.currentOrder.status === 'accepted') {
            targetLat = gameState.currentOrder.restaurant.lat;
            targetLng = gameState.currentOrder.restaurant.lon;
            lineColor = '#ffcc00';
        } else if (gameState.currentOrder.status === 'picked_up') {
            targetLat = gameState.currentOrder.deliveryLocation.latitude;
            targetLng = gameState.currentOrder.deliveryLocation.longitude;
            lineColor = '#00ff88';
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

            // Draw dashed line
            ctx.save();
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();
            ctx.setLineDash([]);
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
// Street Names Overlay Toggle
// ============================================
function setupStreetNamesToggle() {
    const toggleBtn = document.getElementById('street-names-toggle');

    toggleBtn.addEventListener('click', () => {
        streetLabelsEnabled = !streetLabelsEnabled;
        toggleBtn.classList.toggle('active', streetLabelsEnabled);

        if (streetLabelsEnabled) {
            // Add street labels layer
            if (!streetLabelsLayer) {
                streetLabelsLayer = viewer.imageryLayers.addImageryProvider(
                    new Cesium.UrlTemplateImageryProvider({
                        url: 'https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
                        credit: 'CartoDB',
                        minimumLevel: 0,
                        maximumLevel: 18
                    })
                );
                streetLabelsLayer.alpha = 0.9;
            } else {
                streetLabelsLayer.show = true;
            }
        } else {
            // Hide street labels layer
            if (streetLabelsLayer) {
                streetLabelsLayer.show = false;
            }
        }
    });

    // Show the button
    toggleBtn.classList.remove('hidden');
}

// ============================================
// Restaurant Loading (Google Places API)
// ============================================
let placesService = null;

// Wait for Google Maps API to be ready
function waitForGoogleMaps() {
    return new Promise((resolve) => {
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof google !== 'undefined' && google.maps && google.maps.places) {
                    clearInterval(checkInterval);
                    resolve();
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

    try {
        // Initialize Google Places service
        if (!placesService) {
            await initPlacesService();
        }

        // Search for restaurants using Google Places API
        const restaurants = await searchNearbyRestaurants();
        loadingState.restaurants = restaurants;
        console.log(`Loaded ${loadingState.restaurants.length} restaurants from Google Places`);

    } catch (error) {
        console.warn('Could not load restaurants from Google Places:', error);
        // Fallback to generated restaurants
        loadingState.restaurants = generateFakeRestaurants();
    }

    loadingState.restaurantsLoaded = true;
    updateProgress('Restaurants loaded!', 80);
}

async function searchNearbyRestaurants() {
    const allRestaurants = [];
    const seenPlaceIds = new Set();

    // Search in multiple directions from spawn point
    const searchOffsets = [
        { lat: 0, lng: 0 },           // Center
        { lat: 0.006, lng: 0 },       // North (~600m)
        { lat: -0.006, lng: 0 },      // South
        { lat: 0, lng: 0.008 },       // East
        { lat: 0, lng: -0.008 },      // West
    ];

    // Search restaurants at each location (with delay to avoid rate limiting)
    for (let i = 0; i < searchOffsets.length; i++) {
        const offset = searchOffsets[i];
        const searchLat = spawnLat + offset.lat;
        const searchLng = spawnLng + offset.lng;
        const location = new google.maps.LatLng(searchLat, searchLng);

        try {
            const results = await searchAtLocation(location, 'restaurant');
            console.log(`Search ${i + 1}: Found ${results.length} restaurants`);

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

            // Small delay between searches to avoid rate limiting
            if (i < searchOffsets.length - 1) {
                await new Promise(r => setTimeout(r, 100));
            }
        } catch (e) {
            console.warn(`Search at offset ${i} failed:`, e);
        }
    }

    // Also search for cafes and fast food at center
    const centerLocation = new google.maps.LatLng(spawnLat, spawnLng);

    try {
        const cafes = await searchCafes(centerLocation);
        for (const place of cafes) {
            if (!seenPlaceIds.has(place.placeId)) {
                seenPlaceIds.add(place.placeId);
                allRestaurants.push(place);
            }
        }
    } catch (e) {
        console.warn('Cafe search failed:', e);
    }

    try {
        const fastFood = await searchFastFood(centerLocation);
        for (const place of fastFood) {
            if (!seenPlaceIds.has(place.placeId)) {
                seenPlaceIds.add(place.placeId);
                allRestaurants.push(place);
            }
        }
    } catch (e) {
        console.warn('Fast food search failed:', e);
    }

    console.log(`Found ${allRestaurants.length} unique restaurants total`);
    return allRestaurants.slice(0, 60);
}

// Helper function to search at a specific location
function searchAtLocation(location, type) {
    return new Promise((resolve) => {
        const request = {
            location: location,
            radius: 1000,
            type: type
        };

        placesService.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                resolve(results);
            } else {
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
        "Sushi House", "Cafe Milano", "Thai Garden", "BBQ Pit"
    ];

    for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const distance = 200 + Math.random() * 800; // 200-1000m

        const metersPerDegLat = 111320;
        const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(spawnLat));

        restaurants.push({
            lat: spawnLat + (Math.cos(angle) * distance) / metersPerDegLat,
            lon: spawnLng + (Math.sin(angle) * distance) / metersPerDegLng,
            name: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''),
            cuisine: ['pizza', 'chinese', 'mexican', 'burger', 'japanese', 'cafe', 'thai', 'bbq'][i % 8],
            amenity: 'restaurant'
        });
    }

    return restaurants;
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
    console.log(`Creating markers for ${loadingState.restaurants.length} restaurants`);

    loadingState.restaurants.forEach((restaurant, index) => {
        // Use Google Places photo directly in Cesium billboard
        createRestaurantMarkerDirect(restaurant);
    });
}

function createRestaurantMarkerDirect(restaurant) {
    // Get the Google Places photo URL
    const photoUrl = restaurant.photoUrl;

    if (photoUrl) {
        // Create billboard with photo directly - Cesium handles cross-origin loading
        const entity = viewer.entities.add({
            name: restaurant.name,
            position: Cesium.Cartesian3.fromDegrees(restaurant.lon, restaurant.lat, 0),
            billboard: {
                image: photoUrl,
                width: 120,
                height: 90,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -30),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.0, 600, 0.4)
            },
            label: {
                text: restaurant.name.length > 20 ? restaurant.name.substring(0, 18) + '...' : restaurant.name,
                font: 'bold 14px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 3,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 5),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(100, 1.0, 600, 0.5)
            },
            properties: {
                restaurant: restaurant
            }
        });

        restaurantEntities.push(entity);
    } else {
        // Fallback to canvas marker if no photo
        const canvas = createMarkerCanvasFallback(restaurant);
        addRestaurantEntity(restaurant, canvas);
    }
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
            // Visible from high up: full size at 100m, scales down to 0.5 at 800m
            scaleByDistance: new Cesium.NearFarScalar(100, 1.2, 800, 0.5)
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

    // Photo area background
    ctx.fillStyle = '#2a2a4a';
    ctx.beginPath();
    ctx.roundRect(18, 18, 184, 120, 12);
    ctx.fill();

    // Clip and draw image
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(18, 18, 184, 120, 12);
    ctx.clip();
    ctx.drawImage(img, 18, 18, 184, 120);
    ctx.restore();

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

    // Truncate name if too long
    let name = restaurant.name;
    if (ctx.measureText(name).width > 170) {
        while (ctx.measureText(name + '...').width > 170 && name.length > 0) {
            name = name.slice(0, -1);
        }
        name += '...';
    }
    ctx.fillText(name, centerX, 168);

    // Rating stars if available - larger
    if (restaurant.rating) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 14px Arial';
        const stars = '★'.repeat(Math.round(restaurant.rating));
        ctx.fillText(stars + ' ' + restaurant.rating.toFixed(1), centerX, 193);
    }

    return canvas;
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

    if (name.includes('pizza') || cuisine.includes('pizza')) return 'pizza';
    if (name.includes('burger') || cuisine.includes('burger')) return 'burger';
    if (name.includes('taco') || cuisine.includes('mexican')) return 'mexican';
    if (name.includes('chinese') || cuisine.includes('chinese')) return 'chinese';
    if (name.includes('sushi') || cuisine.includes('japanese') || cuisine.includes('sushi')) return 'japanese';
    if (name.includes('cafe') || name.includes('coffee') || cuisine.includes('cafe')) return 'cafe';

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

    return {
        latitude: lat,
        longitude: lng,
        address: `${streetNum} ${streetName} ${streetSuffix}`
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
    const category = getMenuCategory(restaurant);
    const menu = menuDatabase[category] || menuDatabase.default;
    const customer = customerNames[Math.floor(Math.random() * customerNames.length)];
    const deliveryLocation = generateDeliveryLocation(restaurant);

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
        const item = menu.items[Math.floor(Math.random() * menu.items.length)];
        if (!usedItems.has(item.name)) {
            usedItems.add(item.name);

            // Assign a food photo to this item
            let itemPhoto = null;
            if (foodPhotos.length > 0) {
                // Use real photos from the restaurant, cycling through them
                itemPhoto = foodPhotos[orderItems.length % foodPhotos.length];
            } else {
                // Fallback to cuisine-based stock images
                itemPhoto = getFoodImageForItem(item.name, category);
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

    deliveryEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude, 0),
        billboard: {
            image: createDeliveryCanvas(location.address),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 1.0,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scaleByDistance: new Cesium.NearFarScalar(50, 1.5, 600, 0.8)
        }
    });
}

function createDeliveryCanvas(address) {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    const centerX = 90;

    // Outer glow
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 25;

    // Main pin background
    ctx.fillStyle = '#00ff88';
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

    // Home/delivery icon
    ctx.fillStyle = '#00ff88';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏠', centerX, 55);

    // DELIVER text
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('DELIVER', centerX, 95);

    // Address below
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Arial';
    let addr = address || 'Customer';
    if (ctx.measureText(addr).width > 160) {
        while (ctx.measureText(addr + '...').width > 160 && addr.length > 0) {
            addr = addr.slice(0, -1);
        }
        addr += '...';
    }
    ctx.fillText(addr, centerX, 200);

    return canvas;
}

function updateDeliveryUI() {
    const order = gameState.currentOrder;
    if (!order) return;

    const defaultFoodPhoto = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300&h=200&fit=crop';

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

        if (distance < gameState.pickupRadius && droneState.altitude - getTerrainHeight(droneState.longitude, droneState.latitude) < 10) {
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

        if (distance < gameState.deliveryRadius && droneState.altitude - getTerrainHeight(droneState.longitude, droneState.latitude) < 10) {
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

function animate() {
    requestAnimationFrame(animate);

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms
    lastTime = currentTime;

    updateDrone(deltaTime);
    updateDronePrimitive(); // Update drone model position/rotation
    updateCamera();
    updateHUD();
    updateMinimap();

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
        await loadRestaurants();

        // Create entities
        updateProgress('Creating drone...', 70);
        createDrone();
        createRestaurantMarkers();

        // Pre-load minimap tiles
        updateProgress('Loading map tiles...', 75);
        await preloadMinimapTiles();

        // Pre-load restaurant images
        updateProgress('Loading restaurant images...', 80);
        await preloadRestaurantImages();

        // Pre-fetch place details for nearby restaurants
        updateProgress('Loading restaurant details...', 88);
        await prefetchPlaceDetails();

        // Setup controls
        updateProgress('Initializing controls...', 95);
        setupControls();
        initMinimap();
        setupGameControls();
        setupRestaurantClickHandler();
        setupRestaurantModalListeners();
        setupStreetNamesToggle();

        updateProgress('Ready!', 100);
        await new Promise(r => setTimeout(r, 500));

        // Hide loading, show HUD
        document.getElementById('loading-modal').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        document.getElementById('minimap-container').style.display = 'block';
        document.getElementById('start-game-container').classList.remove('hidden');

        // Start animation loop
        animate();

    } catch (error) {
        console.error('Failed to start simulation:', error);
        updateProgress(`Error: ${error.message}`, 0);
    }
}

// ============================================
// Pre-loading Functions
// ============================================
async function preloadMinimapTiles() {
    const centerTile = latLngToTile(spawnLat, spawnLng, MINIMAP_ZOOM);

    const tilesToLoad = [];
    // Load 5x5 grid of tiles around spawn
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const tileX = centerTile.x + dx;
            const tileY = centerTile.y + dy;
            tilesToLoad.push(loadMinimapTileAsync(tileX, tileY, MINIMAP_ZOOM));
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
});

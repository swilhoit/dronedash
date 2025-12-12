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
// Drone Creation
// ============================================
let dronePrimitive = null;
let rotorAngle = 0;

function createDroneGeometry() {
    // Create a simple quadcopter model using geometry instances
    const instances = [];

    // Main body - flat rectangular body
    const bodyMatrix = Cesium.Matrix4.fromScale(new Cesium.Cartesian3(2.0, 0.4, 2.0));
    instances.push(new Cesium.GeometryInstance({
        geometry: Cesium.BoxGeometry.fromDimensions({
            dimensions: new Cesium.Cartesian3(1, 1, 1),
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
        }),
        modelMatrix: bodyMatrix,
        attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString('#333333'))
        },
        id: 'body'
    }));

    // Top module
    const topMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(
        new Cesium.Cartesian3(0, 0.5, 0),
        Cesium.Quaternion.IDENTITY,
        new Cesium.Cartesian3(1.0, 0.3, 1.0)
    );
    instances.push(new Cesium.GeometryInstance({
        geometry: Cesium.BoxGeometry.fromDimensions({
            dimensions: new Cesium.Cartesian3(1, 1, 1),
            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
        }),
        modelMatrix: topMatrix,
        attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN)
        },
        id: 'top'
    }));

    // Arms and motor housings
    const armPositions = [
        { x: 1.5, z: 1.5 },
        { x: -1.5, z: 1.5 },
        { x: 1.5, z: -1.5 },
        { x: -1.5, z: -1.5 }
    ];

    armPositions.forEach((pos, i) => {
        // Arm
        const armAngle = Math.atan2(pos.x, pos.z);
        const armLength = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
        const armMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(
            new Cesium.Cartesian3(pos.x / 2, 0, pos.z / 2),
            Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_Y, -armAngle),
            new Cesium.Cartesian3(0.15, 0.1, armLength * 0.7)
        );
        instances.push(new Cesium.GeometryInstance({
            geometry: Cesium.BoxGeometry.fromDimensions({
                dimensions: new Cesium.Cartesian3(1, 1, 1),
                vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
            }),
            modelMatrix: armMatrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString('#444444'))
            },
            id: `arm${i}`
        }));

        // Motor housing
        const motorMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(
            new Cesium.Cartesian3(pos.x, 0.25, pos.z),
            Cesium.Quaternion.IDENTITY,
            new Cesium.Cartesian3(0.4, 0.3, 0.4)
        );
        instances.push(new Cesium.GeometryInstance({
            geometry: Cesium.BoxGeometry.fromDimensions({
                dimensions: new Cesium.Cartesian3(1, 1, 1),
                vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
            }),
            modelMatrix: motorMatrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString('#222222'))
            },
            id: `motor${i}`
        }));
    });

    // Landing gear legs
    [-1, 1].forEach((side, i) => {
        // Vertical leg
        const legMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(
            new Cesium.Cartesian3(side * 0.8, -0.5, 0),
            Cesium.Quaternion.IDENTITY,
            new Cesium.Cartesian3(0.08, 0.6, 0.08)
        );
        instances.push(new Cesium.GeometryInstance({
            geometry: Cesium.BoxGeometry.fromDimensions({
                dimensions: new Cesium.Cartesian3(1, 1, 1),
                vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
            }),
            modelMatrix: legMatrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString('#333333'))
            },
            id: `leg${i}`
        }));

        // Foot (skid)
        const footMatrix = Cesium.Matrix4.fromTranslationQuaternionRotationScale(
            new Cesium.Cartesian3(side * 0.8, -0.8, 0),
            Cesium.Quaternion.IDENTITY,
            new Cesium.Cartesian3(0.1, 0.05, 1.5)
        );
        instances.push(new Cesium.GeometryInstance({
            geometry: Cesium.BoxGeometry.fromDimensions({
                dimensions: new Cesium.Cartesian3(1, 1, 1),
                vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
            }),
            modelMatrix: footMatrix,
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromCssColorString('#333333'))
            },
            id: `foot${i}`
        }));
    });

    return instances;
}

function createDrone() {
    // Create the drone primitive
    const instances = createDroneGeometry();

    dronePrimitive = new Cesium.Primitive({
        geometryInstances: instances,
        appearance: new Cesium.PerInstanceColorAppearance({
            closed: true,
            translucent: false
        }),
        asynchronous: false
    });

    viewer.scene.primitives.add(dronePrimitive);

    // Create rotor entities (these spin)
    const rotorPositions = [
        { x: 1.5, z: 1.5 },
        { x: -1.5, z: 1.5 },
        { x: 1.5, z: -1.5 },
        { x: -1.5, z: -1.5 }
    ];

    rotorPositions.forEach((pos, i) => {
        viewer.entities.add({
            name: `Rotor${i}`,
            position: new Cesium.CallbackProperty(() => {
                return getDronePartPosition(pos.x, 0.5, pos.z);
            }, false),
            ellipsoid: {
                radii: new Cesium.Cartesian3(0.8, 0.05, 0.8),
                material: Cesium.Color.CYAN.withAlpha(0.6),
                slicePartitions: 8,
                stackPartitions: 2
            }
        });
    });

    // Front LED (green)
    viewer.entities.add({
        name: 'FrontLED',
        position: new Cesium.CallbackProperty(() => {
            return getDronePartPosition(0, 0, 1.5);
        }, false),
        point: {
            pixelSize: 10,
            color: Cesium.Color.LIME,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
    });

    // Back LEDs (red)
    [-0.5, 0.5].forEach((x, i) => {
        viewer.entities.add({
            name: `BackLED${i}`,
            position: new Cesium.CallbackProperty(() => {
                return getDronePartPosition(x, 0, -1.5);
            }, false),
            point: {
                pixelSize: 8,
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
        });
    });

    // Camera mount (front sphere)
    viewer.entities.add({
        name: 'Camera',
        position: new Cesium.CallbackProperty(() => {
            return getDronePartPosition(0, -0.2, 1.2);
        }, false),
        ellipsoid: {
            radii: new Cesium.Cartesian3(0.2, 0.2, 0.2),
            material: Cesium.Color.BLACK
        }
    });

    console.log('Drone created with primitives');
}

function getDronePartPosition(localX, localY, localZ) {
    const headingRad = Cesium.Math.toRadians(droneState.heading);
    const pitchRad = Cesium.Math.toRadians(droneState.pitch);
    const rollRad = Cesium.Math.toRadians(droneState.roll);

    // Rotate local position by heading, pitch, roll
    const cosH = Math.cos(headingRad);
    const sinH = Math.sin(headingRad);
    const cosP = Math.cos(pitchRad);
    const sinP = Math.sin(pitchRad);
    const cosR = Math.cos(rollRad);
    const sinR = Math.sin(rollRad);

    // Apply yaw (heading) rotation around Y axis
    let x = localX * cosH + localZ * sinH;
    let z = -localX * sinH + localZ * cosH;
    let y = localY;

    // Apply pitch rotation around X axis
    const y2 = y * cosP - z * sinP;
    const z2 = y * sinP + z * cosP;
    y = y2;
    z = z2;

    // Apply roll rotation around Z axis
    const x2 = x * cosR - y * sinR;
    const y3 = x * sinR + y * cosR;
    x = x2;
    y = y3;

    // Convert to geographic offset
    const metersPerDegLat = 111320;
    const metersPerDegLng = 111320 * Math.cos(Cesium.Math.toRadians(droneState.latitude));

    return Cesium.Cartesian3.fromDegrees(
        droneState.longitude + x / metersPerDegLng,
        droneState.latitude + z / metersPerDegLat,
        droneState.altitude + y
    );
}

function updateDronePrimitive() {
    if (!dronePrimitive) return;

    // Calculate model matrix for drone
    const position = Cesium.Cartesian3.fromDegrees(
        droneState.longitude,
        droneState.latitude,
        droneState.altitude
    );

    const hpr = new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(droneState.heading),
        Cesium.Math.toRadians(droneState.pitch),
        Cesium.Math.toRadians(droneState.roll)
    );

    const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
        position,
        hpr,
        Cesium.Ellipsoid.WGS84,
        Cesium.Transforms.localFrameToFixedFrameGenerator('north', 'west')
    );

    dronePrimitive.modelMatrix = modelMatrix;
}

// ============================================
// Drone Physics & Movement
// ============================================
function updateDrone(deltaTime) {
    const acceleration = 50;        // m/s^2
    const turnSpeed = 90;           // degrees/s
    const verticalSpeed = 20;       // m/s
    const drag = 0.95;
    const maxSpeed = 80;            // m/s

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
        droneState.heading += turnSpeed * deltaTime;
        droneState.roll = Cesium.Math.lerp(droneState.roll, 20, 0.1);
    } else if (keys.ArrowRight) {
        droneState.heading -= turnSpeed * deltaTime;
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
const MINIMAP_ZOOM = 17;
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
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
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

    // Clear canvas
    ctx.fillStyle = '#001a33';
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
            // Restaurant pin
            ctx.fillStyle = '#ff4444';
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
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
// Restaurant Loading (Google Places)
// ============================================
async function loadRestaurants() {
    updateProgress('Loading restaurants...', 60);

    // Use Nominatim for POI search (free, no API key needed)
    // Or use the existing Google Places approach

    try {
        // Search for restaurants using Overpass API
        const radius = 0.02; // ~2km
        const query = `
            [out:json][timeout:30];
            (
                node["amenity"="restaurant"](${spawnLat - radius},${spawnLng - radius},${spawnLat + radius},${spawnLng + radius});
                node["amenity"="cafe"](${spawnLat - radius},${spawnLng - radius},${spawnLat + radius},${spawnLng + radius});
                node["amenity"="fast_food"](${spawnLat - radius},${spawnLng - radius},${spawnLat + radius},${spawnLng + radius});
            );
            out body;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) throw new Error('Overpass API error');

        const data = await response.json();

        loadingState.restaurants = data.elements
            .filter(el => el.tags && el.tags.name)
            .map(el => ({
                lat: el.lat,
                lon: el.lon,
                name: el.tags.name,
                cuisine: el.tags.cuisine || 'restaurant',
                amenity: el.tags.amenity
            }))
            .slice(0, 100); // Limit to 100 restaurants

        console.log(`Loaded ${loadingState.restaurants.length} restaurants`);

    } catch (error) {
        console.warn('Could not load restaurants from Overpass:', error);
        // Generate some fake restaurants for testing
        loadingState.restaurants = generateFakeRestaurants();
    }

    loadingState.restaurantsLoaded = true;
    updateProgress('Restaurants loaded!', 80);
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
    loadingState.restaurants.forEach(restaurant => {
        const thumbnailUrl = getRestaurantThumbnail(restaurant);

        // Create marker with image
        createRestaurantMarkerWithImage(restaurant, thumbnailUrl);
    });
}

function createRestaurantMarkerWithImage(restaurant, thumbnailUrl) {
    // Load thumbnail image
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
        const canvas = createMarkerCanvasWithImage(restaurant, img);
        addRestaurantEntity(restaurant, canvas);
    };

    img.onerror = () => {
        // Fallback to text-only marker
        const canvas = createMarkerCanvasFallback(restaurant);
        addRestaurantEntity(restaurant, canvas);
    };

    img.src = thumbnailUrl;
}

function addRestaurantEntity(restaurant, canvas) {
    const entity = viewer.entities.add({
        name: restaurant.name,
        position: Cesium.Cartesian3.fromDegrees(restaurant.lon, restaurant.lat, 0),
        billboard: {
            image: canvas,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 0.6,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: {
            restaurant: restaurant
        }
    });

    restaurantEntities.push(entity);
}

function createMarkerCanvasWithImage(restaurant, img) {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Pin background
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(4, 4, 72, 72, 10);
    ctx.fill();

    // Pin point
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(40, 80);
    ctx.lineTo(28, 72);
    ctx.lineTo(52, 72);
    ctx.closePath();
    ctx.fill();

    // Border
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(4, 4, 72, 72, 10);
    ctx.stroke();

    // Clip for image
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(8, 8, 64, 64, 8);
    ctx.clip();

    // Draw thumbnail
    ctx.drawImage(img, 8, 8, 64, 64);
    ctx.restore();

    // Restaurant name label at bottom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(8, 52, 64, 20);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shortName = restaurant.name.length > 12 ? restaurant.name.substring(0, 11) + '...' : restaurant.name;
    ctx.fillText(shortName, 40, 62);

    return canvas;
}

function createMarkerCanvasFallback(restaurant) {
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // Pin body
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(30, 28, 24, 0, Math.PI * 2);
    ctx.fill();

    // Pin point
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(30, 58);
    ctx.lineTo(16, 42);
    ctx.lineTo(44, 42);
    ctx.closePath();
    ctx.fill();

    // White circle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(30, 28, 18, 0, Math.PI * 2);
    ctx.fill();

    // Icon based on cuisine
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cuisine = (restaurant.cuisine || '').toLowerCase();
    let icon = 'R';
    if (cuisine.includes('pizza')) icon = 'P';
    else if (cuisine.includes('coffee') || cuisine.includes('cafe')) icon = 'C';
    else if (cuisine.includes('burger')) icon = 'B';
    else if (cuisine.includes('sushi') || cuisine.includes('japanese')) icon = 'S';
    else if (cuisine.includes('chinese')) icon = 'CH';
    else if (cuisine.includes('mexican')) icon = 'M';

    ctx.fillText(icon, 30, 28);

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
    const distance = 150 + Math.random() * 450; // 150-600m
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

    const numItems = Math.floor(Math.random() * 3) + 1;
    const orderItems = [];
    const usedItems = new Set();

    for (let i = 0; i < numItems; i++) {
        const item = menu.items[Math.floor(Math.random() * menu.items.length)];
        if (!usedItems.has(item.name)) {
            usedItems.add(item.name);
            orderItems.push({
                name: item.name,
                price: item.price,
                quantity: Math.random() > 0.8 ? 2 : 1,
                prepTime: item.prep
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

    gameState.orderQueue.forEach(order => {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-card-header">
                <div class="order-card-info">
                    <div class="order-card-restaurant">${order.restaurant.name}</div>
                    <div class="order-card-items">${order.items.length} item(s)</div>
                </div>
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
            image: createPickupCanvas(),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 0.7,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
    });
}

function createPickupCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // Glowing effect
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 15;

    // Pin body
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(32, 28, 24, 0, Math.PI * 2);
    ctx.fill();

    // Pin point
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.lineTo(16, 36);
    ctx.lineTo(48, 36);
    ctx.closePath();
    ctx.fill();

    // Icon
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', 32, 28);

    return canvas;
}

function createDeliveryMarker(location) {
    if (deliveryEntity) {
        viewer.entities.remove(deliveryEntity);
    }

    deliveryEntity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(location.longitude, location.latitude, 0),
        billboard: {
            image: createDeliveryCanvas(),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 0.7,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
    });
}

function createDeliveryCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // Glowing effect
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 15;

    // Pin body
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(32, 28, 24, 0, Math.PI * 2);
    ctx.fill();

    // Pin point
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.lineTo(16, 36);
    ctx.lineTo(48, 36);
    ctx.closePath();
    ctx.fill();

    // Icon
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('D', 32, 28);

    return canvas;
}

function updateDeliveryUI() {
    const order = gameState.currentOrder;
    if (!order) return;

    document.getElementById('delivery-name').textContent = order.restaurant.name;
    document.getElementById('delivery-address').textContent = order.restaurant.address || 'Restaurant Location';
    document.getElementById('customer-name').textContent = order.customer;
    document.getElementById('customer-address').textContent = order.deliveryLocation.address;
    document.getElementById('delivery-pay').textContent = `$${order.estimatedPay.toFixed(2)}`;

    // Update items
    const itemsContainer = document.getElementById('delivery-items');
    itemsContainer.innerHTML = order.items.map(item => `
        <div class="delivery-item">
            <span><span class="delivery-item-qty">${item.quantity}x</span> ${item.name}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');

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
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    const response = await fetch(url, {
        headers: { 'User-Agent': 'DroneSimulator/2.0' }
    });

    if (!response.ok) throw new Error('Geocoding request failed');

    const data = await response.json();
    if (data.length === 0) throw new Error('Location not found');

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
        droneState.altitude = 50;

        modal.classList.add('hidden');
        document.getElementById('loading-modal').classList.remove('hidden');

        await startSimulation();
    });
}

async function startSimulation() {
    try {
        // Initialize Cesium
        await initCesium();

        // Load restaurants
        await loadRestaurants();

        // Create entities
        updateProgress('Creating drone...', 85);
        createDrone();
        createRestaurantMarkers();

        // Setup controls
        setupControls();
        initMinimap();
        setupGameControls();

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
// Entry Point
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupModal();
});

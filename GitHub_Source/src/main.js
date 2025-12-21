import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { io } from 'socket.io-client'; // Socket.io

// --- MULTIPLAYER SETUP ---
// CONNECT TO RENDER (Or local if needed)
const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://the-game-rivf.onrender.com';
const socket = io(SERVER_URL);

const otherPlayers = {}; // Store other player meshes

// --- DEBUG UI & ERROR HANDLING ---
const debugDiv = document.createElement('div');
debugDiv.style.position = 'fixed';
debugDiv.style.top = '10px';
debugDiv.style.right = '10px';
debugDiv.style.color = 'lime';
debugDiv.style.fontFamily = 'monospace';
debugDiv.style.fontSize = '16px';
debugDiv.style.background = 'rgba(0,0,0,0.8)';
debugDiv.style.padding = '5px';
debugDiv.style.pointerEvents = 'none';
debugDiv.style.zIndex = '9999999';
debugDiv.innerText = "Initializing 3D Assets...";
document.body.appendChild(debugDiv);

// --- CHAT UI ---
const chatContainer = document.createElement('div');
chatContainer.id = 'chat-ui';
chatContainer.style.position = 'fixed';
chatContainer.style.bottom = '10px';
chatContainer.style.left = '10px';
chatContainer.style.width = '300px';
chatContainer.style.height = '200px';
chatContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
chatContainer.style.color = 'white';
chatContainer.style.display = 'flex';
chatContainer.style.flexDirection = 'column';
chatContainer.style.fontFamily = 'monospace';
chatContainer.style.pointerEvents = 'auto'; // allow clicking
chatContainer.style.zIndex = '100000';

const chatMessages = document.createElement('div');
chatMessages.id = 'chat-messages';
chatMessages.style.flex = '1';
chatMessages.style.overflowY = 'auto';
chatMessages.style.padding = '5px';
chatMessages.style.fontSize = '12px';
chatContainer.appendChild(chatMessages);

const chatInputContainer = document.createElement('div');
chatInputContainer.style.display = 'flex';

const chatInput = document.createElement('input');
chatInput.id = 'chat-input';
chatInput.style.flex = '1';
chatInput.style.backgroundColor = '#222';
chatInput.style.color = 'white';
chatInput.style.border = '1px solid #444';
chatInput.placeholder = "Type to chat...";

const chatSend = document.createElement('button');
chatSend.innerText = "Send";
chatSend.style.backgroundColor = '#444';
chatSend.style.color = 'white';
chatSend.style.border = '1px solid #666';
chatSend.onclick = () => {
    const msg = chatInput.value;
    if (msg) {
        // Local echo (optional, but wait for server usually)
        // addChatMessage("Me", msg); 
        socket.emit('chatMessage', msg);
        chatInput.value = "";
    }
};

chatInputContainer.appendChild(chatInput);
chatInputContainer.appendChild(chatSend);
chatContainer.appendChild(chatInputContainer);
document.body.appendChild(chatContainer);

function addChatMessage(user, text) {
    const el = document.createElement('div');
    const color = user === "System" ? "#ffaa00" : "#00ff00";
    el.innerHTML = `<span style="color: ${color}">${user}:</span> ${text}`;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
addChatMessage("System", "Welcome to The Animatronic Multiplayer (Alpha)!");

// --- SOCKET EVENTS ---
socket.on('connect', () => {
    addChatMessage("System", `Connected to Server (${SERVER_URL})`);
    chatContainer.style.border = "1px solid #00ff00";
});

socket.on('disconnect', () => {
    addChatMessage("System", "Disconnected from Server");
    chatContainer.style.border = "1px solid #ff0000";
});

socket.on('chatMessage', (data) => {
    addChatMessage(data.user || "Anon", data.text);
});

socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach(id => {
        if (id !== socket.id) {
            addOtherPlayer(players[id]);
        }
    });
});

socket.on('newPlayer', (playerInfo) => {
    addOtherPlayer(playerInfo);
});

socket.on('playerDisconnected', (id) => {
    removeOtherPlayer(id);
});

socket.on('playerMoved', (playerInfo) => {
    if (otherPlayers[playerInfo.id]) {
        const p = otherPlayers[playerInfo.id];
        // Lerp could be better, but direct set for now
        p.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
        p.rotation.y = playerInfo.rotation;
        // Anim logic here if needed
    }
});

function addOtherPlayer(playerInfo) {
    if (otherPlayers[playerInfo.id]) return;
    // Simple Box representation (or clone guard?)
    // Clone Guard if possible
    let mesh;
    if (assets.guard) {
        // Simplified clone
        mesh = assets.guard.clone();
        mesh.scale.set(1.5, 1.5, 1.5);
    } else {
        const geo = new THREE.BoxGeometry(1, 2, 1);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        mesh = new THREE.Mesh(geo, mat);
    }
    mesh.position.set(playerInfo.x, playerInfo.y, playerInfo.z);
    scene.add(mesh);
    otherPlayers[playerInfo.id] = mesh;
    addChatMessage("System", "New Player Joined");
}

function removeOtherPlayer(id) {
    if (otherPlayers[id]) {
        scene.remove(otherPlayers[id]);
        delete otherPlayers[id];
        addChatMessage("System", "Player Left");
    }
}

window.addEventListener('error', (e) => {
    debugDiv.style.color = 'red';
    debugDiv.innerText = `FATAL ERROR: ${e.message} \nLine: ${e.lineno}`;
    console.error(e);
});

// --- LOAD ASSETS ---
const assets = {};
async function loadAssets() {
    const loader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    const load = (url) => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    const loadFBX = (url) => new Promise((resolve, reject) => fbxLoader.load(url, resolve, undefined, reject));

    // Texture Loader
    const texLoader = new THREE.TextureLoader();
    const loadTex = (url) => new Promise((resolve, reject) => texLoader.load(url, resolve, undefined, reject));

    try {
        const [table, chair, door, toilet, balloons, computer, pizza, posterPiz, posterBall,
            flashlight, curtain, steps, arcade, vending, cStraight, cCorner, cDoor,
            doorOpen, doorClosed, lightCeiling, guardModel, evanderModel, kitchenModel] = await Promise.all([
                load('/FoldingTable.glb'),
                load('/Chair.glb'),
                load('/Door.glb'),
                load('/Toilet.glb'),
                load('/Balloons.glb'),
                load('/Simple computer.glb'),
                load('/Pizza.glb'),
                // Floor tile removed
                loadTex('/Evander Pizza.png'),
                loadTex('/Evander Ball.png'),
                load('/Time Hotel 7.07.glb'),
                load('/Curtain.glb'),
                loadFBX('/steps.fbx'),
                load('/Arcade Machine.glb'),
                load('/Vending Machine.glb'),
                load('/Counter Straight.glb'),
                load('/Counter Corner.glb'),
                load('/Counter Door.glb'),
                load('/Doorway Open.glb'),
                load('/Doorway.glb'),
                load('/Light Ceiling.glb'),
                load('/SWAT.glb'),
                load('/Evander Animatronic.glb'),
                load('/Kitchen.glb')
            ]);

        // Consolidate asset assignments to avoid duplication
        assets.table = table.scene;
        assets.chair = chair.scene;
        assets.door = door.scene;
        assets.toilet = toilet.scene;
        assets.balloons = balloons.scene;
        // assets.computer = computer.scene; // Duplicate assignment later
        // assets.pizza = pizza.scene; // Duplicate assignment later
        // assets.assets = arcade.scene; // Redundant
        assets.posterPizza = posterPiz;
        assets.posterBall = posterBall;
        assets.hotel = flashlight.scene;
        assets.curtain = curtain.scene;
        assets.steps = steps;
        assets.arcade = arcade.scene;
        assets.vending = vending.scene;
        assets.cStraight = cStraight.scene;
        assets.cCorner = cCorner.scene;
        assets.cDoor = cDoor.scene;
        assets.doorOpen = doorOpen.scene;
        assets.doorClosed = doorClosed.scene;
        assets.lightCeiling = lightCeiling.scene;
        assets.guard = guardModel.scene;
        assets.guardAnimations = guardModel.animations;
        assets.computer = computer.scene;
        assets.pizza = pizza.scene;
        assets.evander = evanderModel.scene;
        assets.evanderAnimations = evanderModel.animations;
        assets.kitchen = kitchenModel.scene;
        assets.flashlight = flashlight.scene;

        // Poster Config
        assets.posterPizza.magFilter = THREE.NearestFilter;
        assets.posterBall.magFilter = THREE.NearestFilter;
        // Fix color space if needed? CanvasTexture vs TextureLoader. usually sRGB.
        assets.posterPizza.colorSpace = THREE.SRGBColorSpace;
        assets.posterBall.colorSpace = THREE.SRGBColorSpace;

        // PS1ify
        Object.values(assets).forEach(model => {
            if (!model.traverse) return;
            model.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material.map) {
                        child.material.map.magFilter = THREE.NearestFilter;
                        child.material.map.minFilter = THREE.NearestFilter;
                    }
                }
            });
        });

        debugDiv.innerText = "Assets Loaded. Starting Game...";
        return true;
    } catch (e) {
        throw new Error("Failed to load assets: " + e.message);
    }
}

// --- CONFIGURATION ---
const RENDER_WIDTH = 320;
const RENDER_HEIGHT = 240;
const MOVEMENT_SPEED = 4.0;
const TURN_SPEED = 2.5;

// Global Collision List
const colliders = [];
let debugCollisionInfo = "";
// Debug Visuals Group
const debugGroup = new THREE.Group();
let debugVisible = false;

function addCollider(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // SAFEGUARD: Don't add colliders near the center of the room (0,0,0) 
    if (Math.abs(center.x) < 2 && Math.abs(center.z) < 2) {
        console.warn("Skipping collider near center:", center);
        return;
    }

    // USER REQUEST: Remove phantom collider at -0.5, 0.8, 2.6
    if (Math.abs(center.x + 0.5) < 1.0 && Math.abs(center.z - 2.6) < 1.0) {
        console.warn("Skipping ghost collider at:", center);
        return;
    }

    colliders.push(box);
}

// Manual Collider Injection
function addManualCollider(x, y, z, w, h, d) {
    const box = new THREE.Box3();
    box.min.set(x - w / 2, y - h / 2, z - d / 2);
    box.max.set(x + w / 2, y + h / 2, z + d / 2);
    colliders.push(box);
}

// --- LIGHTS & FOG ---
const FOG_DENSITY_ON = 0.02;
const FOG_DENSITY_OFF = 0.15; // Darker/Short vision


function checkCollision(position) {
    const playerRadius = 0.2; // Reduced from 0.25 to fit doors better
    const playerBox = new THREE.Box3();
    // Lower min Y to 0.1 to detect low obstacles, Max to 1.6 to fit under headers
    playerBox.min.set(position.x - playerRadius, position.y + 0.1, position.z - playerRadius);
    playerBox.max.set(position.x + playerRadius, position.y + 1.6, position.z + playerRadius);

    for (const box of colliders) {
        if (playerBox.intersectsBox(box)) {
            const center = new THREE.Vector3();
            box.getCenter(center);
            debugCollisionInfo = `HIT: ${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}`;
            return true;
        }
    }
    debugCollisionInfo = "";
    return false;
}


// --- UTILS: TEXTURE GENERATOR ---
function createPatternTexture(type, color1, color2) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = color2;

    if (type === 'checker') {
        const seg = size / 2;
        ctx.fillRect(0, 0, seg, seg);
        ctx.fillRect(seg, seg, seg, seg);
    } else if (type === 'stripes') {
        const seg = size / 4;
        for (let i = 0; i < 4; i += 2) ctx.fillRect(i * seg, 0, seg, size);
    } else if (type === 'noise_color') {
        for (let i = 0; i < 200; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? color2 : '#ff0055';
            const x = Math.floor(Math.random() * size);
            const y = Math.floor(Math.random() * size);
            ctx.fillRect(x, y, 2, 2);
        }
    } else if (type === 'door') {
        ctx.fillStyle = '#442211';
        ctx.fillRect(5, 5, size - 10, size - 5);
        ctx.fillStyle = '#221100';
        ctx.fillRect(50, 30, 5, 5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function createTextTexture(text, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 128, 32);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 64, 16);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
}

// --- UTILS: PS1 MATERIAL (VERTEX JITTER) ---
const ps1VertexLogic = `
#include <project_vertex>
vec4 snappedPos = gl_Position;
snappedPos.xyz = gl_Position.xyz / gl_Position.w; 
float rw = uResolutionWidth;
float rh = uResolutionHeight;
snappedPos.x = floor(snappedPos.x * rw) / rw;
snappedPos.y = floor(snappedPos.y * rh) / rh;
snappedPos.xyz *= gl_Position.w; 
gl_Position = snappedPos;
`;

function makePS1Material(params) {
    const mat = new THREE.MeshLambertMaterial({
        ...params,
        // flatShading: true 
    });
    // mat.onBeforeCompile = (shader) => {
    //     shader.uniforms.uResolutionWidth = { value: RENDER_WIDTH / 2 };
    //     shader.uniforms.uResolutionHeight = { value: RENDER_HEIGHT / 2 };
    //     const uniformsString = `
    //         uniform float uResolutionWidth;
    //         uniform float uResolutionHeight;
    //     `;
    //     shader.vertexShader = uniformsString + shader.vertexShader;
    //     shader.vertexShader = shader.vertexShader.replace(
    //         '#include <project_vertex>',
    //         ps1VertexLogic
    //     );
    // };
    return mat;
}


// --- SCENE SETUP ---
// Ensure body has no scrollbars
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const app = document.querySelector('#app');
// Ensure app container is full screen
if (app) {
    app.style.width = '100vw';
    app.style.height = '100vh';
    app.style.margin = '0';
    app.style.overflow = 'hidden';
}

const canvas = document.createElement('canvas');
canvas.style.position = 'absolute';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.zIndex = '1';

if (app) {
    app.appendChild(canvas);
} else {
    document.body.appendChild(canvas);
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.BasicShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a10);
// Fix Darkness: Extend Fog Range
scene.fog = new THREE.Fog(0x0a0a10, 20, 100);

// Camera
const camera = new THREE.PerspectiveCamera(60, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 100);

// --- LIGHTING ---
// (Lights are added in init after assets load)

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 12, 5);
dirLight.castShadow = true;
scene.add(dirLight);


// --- RESTAURANT ENVIRONMENT ---
function buildRestaurant() {
    colliders.length = 0; // Clear Colliders
    const group = new THREE.Group();

    // Textures
    const texFloor = createPatternTexture('checker', '#111', '#222');
    texFloor.repeat.set(8, 8);
    const texWall = createPatternTexture('stripes', '#552222', '#331111');
    texWall.repeat.set(4, 2);
    const texWood = createPatternTexture('stripes', '#3e2723', '#4e342e');
    const texTable = createPatternTexture('noise_color', '#ffffff', '#00ffcc');

    const texDoor = createPatternTexture('door', '#663322', '#442211');
    const texBathFloor = createPatternTexture('checker', '#ffffff', '#aaeeee');

    const roomSize = 40;
    const wallHeight = 8;

    // 1. Floor (Procedural Checkerboard)
    // Create high-res checker texture
    const texChecker = createPatternTexture('checker', '#ffffff', '#111111');
    texChecker.wrapS = THREE.RepeatWrapping;
    texChecker.wrapT = THREE.RepeatWrapping;
    texChecker.repeat.set(15, 15); // 15x15 tiles across 60 units

    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = makePS1Material({ map: texChecker });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    group.add(floor);

    const ceilGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const ceilMat = makePS1Material({ map: createPatternTexture('noise', '#111', '#222'), side: THREE.DoubleSide });
    const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight;
    group.add(ceiling);

    // 2. Walls & Rooms (Split for Doors)
    const wallMat = makePS1Material({ map: texWall });

    // Helper to create walls with consistent texture tiling
    function createWall(w, h, d, x, y, z, customMat = wallMat) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), customMat.clone());
        m.position.set(x, y, z);
        // Calculate repeat based on physical size (assume 4 units = 1 tile)
        const repX = Math.max(w, d) / 4;
        const repY = h / 4;
        if (m.material.map) {
            m.material.map = m.material.map.clone();
            m.material.map.repeat.set(repX, repY);
            m.material.map.needsUpdate = true;
        }
        group.add(m);
        addCollider(m);
        return m;
    }

    // -- ENTRANCE (Back Wall Z=20) --
    // Gap for door at X=0.5, Width 1.2 (-0.1 to 1.1).
    createWall(19.9, wallHeight, 1, -10.05, wallHeight / 2, 20);
    createWall(18.9, wallHeight, 1, 10.55, wallHeight / 2, 20);
    // Header (Width 1.2, Height 5.5)
    createWall(1.2, 5.5, 1, 0.5, 5.25, 20);

    // -- STAGE (Front Wall Z=-20) --
    createWall(40, wallHeight, 1, 0, wallHeight / 2, -20);

    // -- LEFT WALL (West X=-20) --
    // Features: Hallway at Z=-11 (Gap 4). Storage at Z=5.5 (Gap 1.2).
    createWall(1, wallHeight, 7, -20, wallHeight / 2, -16.5);
    createWall(1, wallHeight, 13.9, -20, wallHeight / 2, -2.05);
    createWall(1, wallHeight, 13.9, -20, wallHeight / 2, 13.05);

    // Header over Hallway (-11, Width 4)
    createWall(1, 4, 4, -20, wallHeight - 2, -11);
    // Header over Storage (5.5, Width 1.2)
    createWall(1, 5.5, 1.2, -20, 5.25, 5.5);

    // -- RIGHT WALL (East X=20) --
    // Features: Kitchen at Z=-10.5 (Gap 1.2). Bathroom at Z=0 (Gap 6).
    createWall(1, wallHeight, 8.9, 20, wallHeight / 2, -15.55);
    createWall(1, wallHeight, 6.9, 20, wallHeight / 2, -6.45);
    createWall(1, wallHeight, 17, 20, wallHeight / 2, 11.5);

    // Headers
    // Kitchen (-10.5, Width 1.2)
    createWall(1, 5.5, 1.2, 20, 5.25, -10.5);
    // Bathroom Header (Wide)
    createWall(1, 3, 6, 20, wallHeight - 1.5, 0);


    // -- HALLWAY (West) --
    // x=-20 to -30.
    const hFloor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 4), floorMat);
    hFloor.position.set(-25, 0.05, -11);
    group.add(hFloor);
    // Walls
    createWall(10, wallHeight, 1, -25, wallHeight / 2, -13);
    createWall(10, wallHeight, 1, -25, wallHeight / 2, -9);

    // -- EXT ROOMS --
    // Storage / "Office"? (West, Z=5.5). X=-25. Size INCREASED to 12x12 (was 8x8)
    const oSize = 12;
    const oX = -26; // Shifted
    const storeFloor = new THREE.Mesh(new THREE.BoxGeometry(oSize, 0.1, oSize), floorMat);
    storeFloor.position.set(oX, 0.05, 5.5);
    group.add(storeFloor);
    // Storage Walls
    createWall(1, wallHeight, oSize, oX - oSize / 2, wallHeight / 2, 5.5); // Back
    createWall(oSize, wallHeight, 1, oX, wallHeight / 2, 5.5 - oSize / 2); // Side
    createWall(oSize, wallHeight, 1, oX, wallHeight / 2, 5.5 + oSize / 2); // Side

    // Kitchen (East, Z=-10.5). X=25. Size INCREASED to 12x12 (was 8x8)
    const kSize = 12;
    // Center X was 24. With size 12, range 18 to 30.
    const kX = 26; // Shifted deeper
    const kFloor = new THREE.Mesh(new THREE.BoxGeometry(kSize, 0.1, kSize), floorMat);
    kFloor.position.set(kX, 0.05, -10.5);
    group.add(kFloor);
    // Kitchen Walls
    // Back (East)
    createWall(1, wallHeight, kSize, kX + kSize / 2, wallHeight / 2, -10.5);
    // Side (North)
    createWall(kSize, wallHeight, 1, kX, wallHeight / 2, -10.5 - kSize / 2);
    // Side (South)
    createWall(kSize, wallHeight, 1, kX, wallHeight / 2, -10.5 + kSize / 2);

    // Add Kitchen Asset
    if (assets.kitchen) {
        console.log("Adding Kitchen Model", assets.kitchen);
        const kModel = assets.kitchen.clone();
        kModel.position.set(kX, 0, -10.5);
        kModel.scale.set(2.0, 2.0, 2.0); // Increased scale
        kModel.rotation.y = Math.PI;
        group.add(kModel);
        addCollider(kModel);
    } else {
        console.error("Kitchen Asset Missing!");
    }

    // -- BATHROOM (East Z=0) --
    // Re-add existing bathroom code but adjust offset to matched gap.
    // Previous bathOffset = 20 + 6 = 26.
    // Z=0.


    // 4. Doors & Signs (Fix Z-fighting)
    // 4. Doors & Signs
    function createDoor(label, pos, rotY, type = 'open') {
        const dGroup = new THREE.Group();
        dGroup.position.copy(pos);
        dGroup.rotation.y = rotY;

        let doorAsset = (type === 'open' && assets.doorOpen) ? assets.doorOpen :
            (type === 'closed' && assets.doorClosed) ? assets.doorClosed : assets.door;

        if (doorAsset) {
            const door = doorAsset.clone();
            door.scale.set(2.5, 2.5, 2.5);
            door.position.x = 0.6;
            dGroup.add(door);
        } else {
            const dMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.5), makePS1Material({ map: texDoor }));
            dMesh.position.y = 1.75;
            dGroup.add(dMesh);
        }

        // Add Collision for Closed Doors
        if (type === 'closed') {
            // Create invisible collider box that matches the door's opening
            const collider = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 0.5));
            collider.position.set(0.6, 2, 0); // Align with shifted door
            collider.visible = false;
            dGroup.add(collider);
            addCollider(collider);
        }

        const sTex = createTextTexture(label, '#aa0000');
        const sMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.2), new THREE.MeshBasicMaterial({ map: sTex }));
        // Door Model shifted 0.6. Center of opening is roughly at local X=0?
        // Wait, doorAsset position is x=0.6. 
        // If I want sign CENTERED on door, it should match door pos x=0.6.
        sMesh.position.set(0.6, 2.8, 0.55); // Centered on door (was 1.2)
        dGroup.add(sMesh);
        group.add(dGroup);
    }

    // ... (Door calls) ...
    // ... (Stage, etc) ...

    // Balloons (Raised)
    function createBalloonBunch(x, z, color) {
        const bGroup = new THREE.Group();
        bGroup.position.set(x, 0, z);

        if (assets.balloons) {
            const b = assets.balloons.clone();
            b.scale.set(1.5, 1.5, 1.5);
            b.position.y = 2.5; // Raised high
            bGroup.add(b);
        } else {
            // Fallback procedural
            const bGeo = new THREE.SphereGeometry(0.4, 8, 8);
            const bMat = makePS1Material({ color: color, roughness: 0.1 });
            [{ pos: [0, 3.5, 0] }, { pos: [-0.3, 3.2, 0.2] }, { pos: [0.3, 3.3, -0.1] }].forEach(b => {
                const bal = new THREE.Mesh(bGeo, bMat);
                bal.position.set(...b.pos);
                bGroup.add(bal);
                const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 2), makePS1Material({ color: 0xffffff }));
                string.position.set(b.pos[0], b.pos[1] - 1.0, b.pos[2]);
                bGroup.add(string);
            });
        }
        group.add(bGroup);
    }

    // ... (Decorations/Posters) ...

    // Office Computer
    // Find Desk block (near end of buildRestaurant)
    // Add assets.computer

    function addComputerToDesk() {
        // Desk is at (-36, 0.6, -11) (Size 2x1.2x4)
        const cX = -36;
        const cZ = -11;
        if (assets.computer) {
            const comp = assets.computer.clone();
            // Place on top (0.6 + 0.6 = 1.2 height)
            comp.position.set(cX, 1.25, cZ);
            comp.scale.set(1.0, 1.0, 1.0);
            comp.rotation.y = Math.PI / 2;
            group.add(comp);
        }
    }
    addComputerToDesk(); // Call at end of buildRestaurant



    // --- BATHROOM REDESIGN ---
    // User wants: Walkway before getting to two separate bathrooms (Male/Female).
    // Expand to right (+X).
    // Main Entrance from Hall (X=20, Z=0).

    // 1. Walkway/Vestibule (From X=20 to 26).
    const walkW = 8;
    const walkD = 6;
    const walkX = 24; // Center
    const walkFloor = new THREE.Mesh(new THREE.PlaneGeometry(walkW, walkD), makePS1Material({ map: createPatternTexture('checker', '#ddddff', '#aaaacc') }));
    walkFloor.rotation.x = -Math.PI / 2;
    walkFloor.position.set(walkX, 0.06, 0);
    group.add(walkFloor);

    // Walls for Walkway
    createWall(walkW, wallHeight, 1, walkX, wallHeight / 2, -3); // North Wall of walkway
    createWall(walkW, wallHeight, 1, walkX, wallHeight / 2, 3); // South Wall of walkway

    // 2. Separate Bathrooms (Deeper in X? Say at X=30?)
    // Male (South side?) Female (North side?)
    // Let's make them split at the end of walkway.
    // Room 1 (Fem): X=30, Z=-4.
    // Room 2 (Male): X=30, Z=4.

    const bathRoomSize = 6;
    const bRX = 30;

    // Female Floor
    const fFloor = new THREE.Mesh(new THREE.PlaneGeometry(bathRoomSize, bathRoomSize), makePS1Material({ color: 0xffcccc })); // Pinkish
    fFloor.rotation.x = -Math.PI / 2;
    fFloor.position.set(bRX, 0.06, -4);
    group.add(fFloor);

    // Male Floor
    const mFloor = new THREE.Mesh(new THREE.PlaneGeometry(bathRoomSize, bathRoomSize), makePS1Material({ color: 0xccccff })); // Bluish
    mFloor.rotation.x = -Math.PI / 2;
    mFloor.position.set(bRX, 0.06, 4);
    group.add(mFloor);

    // Walls
    // Back Wall
    createWall(1, wallHeight, 16, bRX + bathRoomSize / 2, wallHeight / 2, 0);
    // Divider
    createWall(bathRoomSize, wallHeight, 1, bRX, wallHeight / 2, 0);
    // Side Walls
    createWall(bathRoomSize, wallHeight, 1, bRX, wallHeight / 2, -7);
    createWall(bathRoomSize, wallHeight, 1, bRX, wallHeight / 2, 7);

    // Front Walls to close gaps between Walkway (Z +/- 3) and Rooms (Z +/- 7)
    // Walkway ends at X=28 (24 + 4). Bath rooms start approx X=27 (30 - 3).
    // Let's place walls at X=27 to seal it.
    // Gap Z: 3 to 7. Center 5. Width 4.
    createWall(1, wallHeight, 4, 27, wallHeight / 2, 5); // Male Room Front
    createWall(1, wallHeight, 4, 27, wallHeight / 2, -5); // Female Room Front

    // Toilets
    if (assets.toilet) {
        // Female Toilet
        const tF = assets.toilet.clone();
        tF.scale.set(0.12, 0.12, 0.12);
        tF.rotation.y = Math.PI;
        tF.position.set(bRX + 2, 0, -4);
        group.add(tF);
        addCollider(tF);

        // Male Toilet
        const tM = assets.toilet.clone();
        tM.scale.set(0.12, 0.12, 0.12);
        tM.rotation.y = Math.PI;
        tM.position.set(bRX + 2, 0, 4);
        group.add(tM);
        addCollider(tM);
    }






    // Entrance (Back Wall) - Shift Right (X+)
    createDoor('ENTRANCE', new THREE.Vector3(0.5, 0, 20), Math.PI, 'closed');

    // Kitchen (Right Wall) - Shift Right (Z-)
    createDoor('KITCHEN', new THREE.Vector3(20, 0, -10.5), -Math.PI / 2, 'open');

    // Storage (Left Wall) - Shift Right (Z+)
    createDoor('STORAGE', new THREE.Vector3(-20, 0, 5.5), Math.PI / 2, 'open');


    // 5. Stage (With Props)
    const stageH = 1.2;
    const stageD = 8;
    const stageGeo = new THREE.BoxGeometry(20, stageH, stageD);
    const stage = new THREE.Mesh(stageGeo, makePS1Material({ map: texWood }));
    stage.position.set(0, stageH / 2, -roomSize / 2 + stageD / 2); // Z ~ -16
    stage.castShadow = true;
    stage.receiveShadow = true;
    group.add(stage);
    addCollider(stage);

    // Curtains (Asset)
    // Curtains (Asset)
    if (assets.curtain) {
        const cL = assets.curtain.clone();
        cL.position.set(-8, stageH + 1.5, -roomSize / 2 + 2);
        cL.scale.set(2, 3, 2);
        cL.traverse((c) => { if (c.isMesh) c.material.color.set(0xaa0000); });
        group.add(cL);
        const cR = assets.curtain.clone();
        cR.position.set(8, stageH + 1.5, -roomSize / 2 + 2);
        cR.scale.set(2, 3, 2);
        cR.traverse((c) => { if (c.isMesh) c.material.color.set(0xaa0000); });
        group.add(cR);
    } else {
        const curtGeo = new THREE.BoxGeometry(4, 6, 0.5);
        const curtMat = makePS1Material({ color: 0xaa0000 });
        const curtL = new THREE.Mesh(curtGeo, curtMat);
        curtL.position.set(-8, stageH + 3, -roomSize / 2 + 2);
        curtL.rotation.z = -0.2;
        group.add(curtL);
        const curtR = new THREE.Mesh(curtGeo, curtMat);
        curtR.position.set(8, stageH + 3, -roomSize / 2 + 2);
        curtR.rotation.z = 0.2;
        group.add(curtR);
    }

    // Mic Stand
    const msBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1), makePS1Material({ color: 0x111 }));
    msBase.position.set(0, stageH, -15);
    group.add(msBase);
    const msPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5), makePS1Material({ color: 0x888 }));
    msPole.position.set(0, stageH + 0.75, -15);
    group.add(msPole);
    // Mic Stand (End of Props)
    const msMic = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.1), makePS1Material({ color: 0x444 }));
    msMic.position.set(0, stageH + 1.5, -14.9);
    msMic.rotation.x = -0.5;
    group.add(msMic);




    // 6. Long Tables & Chairs (With Food & Party Props)
    const tableMat = makePS1Material({ map: createPatternTexture('noise_color', '#ddd', '#99f') });
    const legMat = makePS1Material({ color: 0x222 });
    const chairMat = makePS1Material({ color: 0x552222 });

    // Prop Materials
    const pizzaMat = makePS1Material({ map: createPatternTexture('noise_color', '#ddaa00', '#eecc55') }); // Cheese-ish
    const cupMat = makePS1Material({ color: 0xffffff });
    const hatMat = makePS1Material({ color: 0xff00ff });

    function createLongTable(x, z) {
        const tGroup = new THREE.Group();
        tGroup.position.set(x, 0, z);

        // Procedural Long Table (Restored)
        const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 8), tableMat);
        top.position.y = 1.1;
        top.castShadow = true;
        tGroup.add(top);

        // 4 Legs
        const lG = new THREE.CylinderGeometry(0.1, 0.1, 1.1);
        const legPos = [[-1.2, -3.5], [1.2, -3.5], [-1.2, 3.5], [1.2, 3.5]];
        legPos.forEach(p => {
            const leg = new THREE.Mesh(lG, legMat);
            leg.position.set(p[0], 0.55, p[1]);
            tGroup.add(leg);
        });

        const tCol = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2, 8.2));
        tCol.position.set(x, 1, z);
        tCol.visible = false;
        addCollider(tCol);

        // Chairs (Smaller Asset)
        for (let i = 0; i < 4; i++) {
            const zOffset = -3 + i * 2;
            const makeChair = (cx, cz, rot) => {
                const c = new THREE.Group();
                c.position.set(cx, 0, cz);
                c.rotation.y = rot;

                if (assets.chair) {
                    const chair = assets.chair.clone();
                    chair.scale.set(0.8, 0.8, 0.8); // Smaller
                    c.add(chair);
                }
                tGroup.add(c);
            }
            makeChair(-2.2, zOffset, Math.PI / 2);
            makeChair(2.2, zOffset, -Math.PI / 2);
        }

        // Props
        if (x < 0) {
            if (assets.pizza) {
                const pizza = assets.pizza.clone();
                pizza.scale.set(0.5, 0.5, 0.5);
                pizza.position.set(0, 1.15, 0);
                tGroup.add(pizza);
            }
        }

        // Cups & Hats (Pattern)
        const props = [
            { pos: [-0.6, -2], type: 'cup' }, { pos: [0.6, 2], type: 'cup' },
            { pos: [-0.6, 1.5], type: 'hat' }, { pos: [0.6, -1.5], type: 'hat' }
        ];

        props.forEach((p, idx) => {
            const vary = (x * z + idx) % 3 === 0;
            if (!vary) return;

            if (p.type === 'cup') {
                const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.3, 8), cupMat);
                cup.position.set(p.pos[0], 1.3, p.pos[1]);
                tGroup.add(cup);
            } else {
                const hat = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 8), hatMat);
                hat.position.set(p.pos[0], 1.3, p.pos[1]);
                tGroup.add(hat);
            }
        });
        group.add(tGroup);
    }

    createLongTable(-10, -3);
    createLongTable(-10, 8);
    createLongTable(10, -3);
    createLongTable(10, 8);

    createLongTable(10, 8);

    // FIX: Seal Gap between Hallway and Office (X=-30)
    // Hallway walls at Z-13 and Z-9. Office Size 8 (Z-15 to -7).
    // This creates a 1m "step" on each side where Office is wider than Hallway.
    // We need to fill Z[-15 to -13] and Z[-9 to -7] at X=-30 or -30.5.
    const gapFillGeo = new THREE.BoxGeometry(1, wallHeight, 2);
    const gapFill1 = new THREE.Mesh(gapFillGeo, wallMat);
    gapFill1.position.set(-30.5, wallHeight / 2, -14); // Left side gap
    group.add(gapFill1);
    addCollider(gapFill1);

    const gapFill2 = new THREE.Mesh(gapFillGeo, wallMat);
    gapFill2.position.set(-30.5, wallHeight / 2, -8); // Right side gap
    group.add(gapFill2);
    addCollider(gapFill2);

    // 7. Decorations (Posters & Balloons)

    // Balloons

    createBalloonBunch(-18, -18, 0xff0000); // Red
    createBalloonBunch(18, -18, 0x0000ff); // Blue
    createBalloonBunch(-18, 18, 0x00ff00); // Green
    createBalloonBunch(18, 18, 0xffff00); // Yellow

    // Posters (Custom PNGs)
    if (assets.posterPizza) {
        // Right Wall
        const ppGeo = new THREE.PlaneGeometry(3, 4);
        const ppMat = makePS1Material({ map: assets.posterPizza, transparent: true });
        const ppParams = { map: assets.posterPizza, transparent: true, side: THREE.DoubleSide };
        // Note: makePS1Material overrides shader, might lose transparency args if not careful? 
        // Standard material supports transparent.
        // Let's use simpleMesh for posters to ensure texture shows well.

        const pp = new THREE.Mesh(ppGeo, new THREE.MeshBasicMaterial(ppParams));
        // Wall is at X=20 (Right / East). Poster should be slightly off wall X=19.9.
        pp.position.set(19.9, 4, -5);
        pp.rotation.y = -Math.PI / 2;
        group.add(pp);
    }

    if (assets.posterBall) {
        // Left Wall
        const pbGeo = new THREE.PlaneGeometry(3, 4);
        // Old posters removed


        // Back Wall
        const pTex3 = createTextTexture("  RULES  ", '#900');
        // 7. Decorations / Posters (Evander)
        function createPoster(pTex, pos, rotY) {
            if (!pTex) return;
            const pGeo = new THREE.PlaneGeometry(2, 3);
            const pMat = new THREE.MeshBasicMaterial({ map: pTex, transparent: true });
            const mesh = new THREE.Mesh(pGeo, pMat);
            mesh.position.copy(pos);
            mesh.rotation.y = rotY;
            group.add(mesh);
        }

        // Poster 1: Pizza (Left Wall - Inner surface is -19.5)
        createPoster(assets.posterPizza, new THREE.Vector3(-19.45, 4, -5), Math.PI / 2);

        // Poster 2: Ball (Right Wall - Inner surface is 19.5)
        createPoster(assets.posterBall, new THREE.Vector3(19.45, 4, 5), -Math.PI / 2);

        // 8. Special Areas

        // Booth (Purple Curtains) "Out of commission"
        const boothGroup = new THREE.Group();
        boothGroup.position.set(-17.99, 0, 17.70);
        // Determine rotation? Facing into room? Corner is -X, +Z (Front Left). Room Center 0,0.
        // Ideally face towards center (South-East). Let's face East (+X).
        boothGroup.rotation.y = Math.PI / 2;

        const boothStage = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 4), makePS1Material({ map: texWood }));
        boothStage.position.y = 0.25;
        boothGroup.add(boothStage);
        addCollider(boothStage); // It's low, might be walkable or blocked.
        // Closed Curtains
        const purpMat = makePS1Material({ color: 0x440044 });
        const bCurt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 3.8), purpMat);
        bCurt.position.set(1.9, 1.5, 0); // Front of booth
        boothGroup.add(bCurt);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.5), makePS1Material({ color: 0x000 }));
        sign.position.set(2.0, 1.5, 0);
        boothGroup.add(sign); // "Out of order" sign roughly
        group.add(boothGroup);
        addCollider(bCurt); // Blocked

        // Office (End of Hallway)
        // Hallway went to X = -20 - 10 = -30.
        const officeX = -34; // Shifted to close gap
        const officeZ = -11;
        const officeSize = 8;

        // Office Floor
        const oFloor = new THREE.Mesh(new THREE.PlaneGeometry(officeSize, officeSize), floorMat);
        oFloor.rotation.x = -Math.PI / 2;
        oFloor.position.set(officeX, 0.06, officeZ);
        group.add(oFloor);

        // Office Walls
        const oWallGeo = new THREE.BoxGeometry(1, wallHeight, officeSize);
        const oWallBack = new THREE.Mesh(oWallGeo, wallMat);
        oWallBack.position.set(officeX - officeSize / 2, wallHeight / 2, officeZ);
        group.add(oWallBack);
        addCollider(oWallBack);

        const oWallSideGeo = new THREE.BoxGeometry(officeSize, wallHeight, 1);
        const oWallS1 = new THREE.Mesh(oWallSideGeo, wallMat);
        oWallS1.position.set(officeX, wallHeight / 2, officeZ - officeSize / 2);
        group.add(oWallS1);
        addCollider(oWallS1);
        const oWallS2 = new THREE.Mesh(oWallSideGeo, wallMat);
        oWallS2.position.set(officeX, wallHeight / 2, officeZ + officeSize / 2);
        group.add(oWallS2);
        addCollider(oWallS2);

        // Desk & Screen
        const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 4), makePS1Material({ color: 0x5d4037 }));
        desk.position.set(officeX - 2, 0.6, officeZ);
        group.add(desk);
        addCollider(desk);

        // Screen removed (replaced by asset)

        // 8. Stairs Fix (Walkable)
        // Sides of stage. Stage is at Z ~ -16. D=8.
        // Z range: -20 to -12.
        // Stairs need to ramp up from floor (Y=0) to Stage (Y=1.2).
        // Let's place them at the front corners: Left (-10) and Right (10).
        const stairSlope = new THREE.BoxGeometry(2, 1.5, 3);
        // Ramp visual
        const stairMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 3), makePS1Material({ color: 0x3e2723 }));
        // We can simulate steps or just a ramp. Steps look better.

        function createStairs(x, z) {
            const sGroup = new THREE.Group();
            sGroup.position.set(x, 0, z);

            // Procedural Steps
            const stepH = 1.2 / 4; // 0.3
            const stepD = 3.0 / 4; // 0.75 depth
            const stepW = 2; // Width Reduced to 2 (was 4)

            for (let i = 0; i < 4; i++) {
                const s = new THREE.Mesh(new THREE.BoxGeometry(stepW, stepH, stepD), makePS1Material({ color: 0x4e342e }));
                // Stack up and back.
                // i=0: Y=0.15, Z=0. (Start).
                // i=3: Y=1.05, Z=-2.25. (End at stage).
                s.position.set(0, stepH / 2 + i * stepH, -i * stepD);
                sGroup.add(s);
                // No collider, handled by player logic
            }

            group.add(sGroup);
        }
        // Create Stairs at correct spots (Leading to Stage at Z=-20 range? No, Stage Front is -12??)
        // Left and Right of Center Stage
        createStairs(-10, -9); // Starts at -9, goes to -12
        createStairs(10, -9);

        // Slope Collider (Invisible Ramp)
        // Positioned to encompass the steps
        // const ramp = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 4)); // Extra depth for smooth entry
        // ramp.position.set(x, 0.6, z);
        // ramp.rotation.x = -0.3; // Slight tilt? No, Box3 collider is AABB. 
        // Box3 cannot rotate. We need a "Step" collider system or simple invisible boxes.
        // For simple tank controls, if drag is high, steps might block.
        // Let's try adding small colliders for each step but slightly lower so player 'pops' up?
        // 9. Prize Corner (South East Corner)
        const pcGroup = new THREE.Group();
        // Move to SE corner area (X=15, Z=15). Room corner is (20, 20).
        pcGroup.position.set(15, 0, 15);
        group.add(pcGroup);

        // Machines against walls
        // Vending against Back Wall (Z=20). Relative Z=4 (since pcGroup Z=15, 15+4=19).
        if (assets.vending) {
            const vm = assets.vending.clone();
            vm.position.set(0, 0, 4); // At (15, 0, 19)
            vm.scale.set(1.5, 1.5, 1.5);
            vm.rotation.y = Math.PI; // Face Forward (-Z)
            pcGroup.add(vm);
            addCollider(vm);
        }

        // Arcade Machine - Moved away from counter to the Left-Back wall area
        if (assets.arcade) {
            const am = assets.arcade.clone();
            am.position.set(-15, 0, 19);
            // Reduced Scale: was 1.5 -> 0.8
            am.scale.set(0.8, 0.8, 0.8);
            am.rotation.y = Math.PI / 2; // Face stage
            group.add(am);
            addCollider(am);
        }

        // Counters (Enclosure)
        const counterScale = 0.8; // Reduced

        // Counter Layout:
        // Straight at (2,0,2) -> Move Left? "Vertical one... moved to the left more"
        // Swapping Door and "Next to it". 
        // Old: Door(0,0,0), Corner(0,0,2), Straight(2,0,2).
        // Vertical one is likely the one along Z axis? 
        // Corner connects Z and X.
        // Let's Try: Door at (0,0,2) [Swapped with Corner], Corner at (0,0,0).
        // "Vertical one... moved to left more". If Door is vertical (Rot -PI/2 implies aligned with Z?), moving left means -X.

        // New Layout attempt based on "Swap Door and Next":
        if (assets.cDoor) {
            const c3 = assets.cDoor.clone();
            // Swap to pos 0,0,2?
            c3.position.set(0, 0, 2);
            c3.rotation.y = -Math.PI / 2;
            c3.scale.set(counterScale, counterScale, counterScale);
            pcGroup.add(c3);
            addCollider(c3); // Added Collision
        }

        if (assets.cCorner) {
            const c2 = assets.cCorner.clone();
            // Swap to pos 0,0,0
            c2.position.set(0, 0, 0);
            c2.scale.set(counterScale, counterScale, counterScale);
            pcGroup.add(c2);
            addCollider(c2); // Added Collision
        }

        if (assets.cStraight) {
            const c1 = assets.cStraight.clone();
            // "Move to left more"? 
            // Currently at 2,0,2. Left is -X. 
            // If corner is at 0,0,0. 
            c1.position.set(2, 0, 0); // Move to align with new Corner pos?
            c1.scale.set(counterScale, counterScale, counterScale);
            pcGroup.add(c1);
            addCollider(c1); // Added Collision
        }



        // 10. Ceiling Lights
        // Grid + Center
        const lightLocs = [
            [-10, -10], [10, -10],
            [-10, 10], [10, 10],
            [0, 0]
        ];
        lightLocs.forEach(loc => {
            if (assets.lightCeiling) {
                const l = assets.lightCeiling.clone();
                l.position.set(loc[0], wallHeight - 0.5, loc[1]); // Lower slightly
                l.scale.set(1.5, 1.5, 1.5); // Ensure visible
                group.add(l);
            } else {
                // Fallback
                const lightGeo = new THREE.BoxGeometry(2, 0.2, 2);
                const fix = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffee }));
                fix.position.set(loc[0], wallHeight - 0.1, loc[1]);
                group.add(fix);
            }

            // Strong Light Source
            const pl = new THREE.PointLight(0xffddaa, 5.0, 100); // Intensity 5, Distance 100
            pl.position.set(loc[0], wallHeight - 2, loc[1]);
            pl.castShadow = true;
            pl.shadow.bias = -0.001;
            group.add(pl);
        });

    }

    // Manual Fix: Add collider at 0.5, 0.8, 19.8
    addManualCollider(0.5, 0.8, 19.8, 1.5, 2.0, 0.5); // Size guess based on door

    return group;
}

// Restaurant will be built after assets load
// const restaurant = buildRestaurant();
// scene.add(restaurant);


// --- PLAYER ---
function createSecurityGuard() {
    const root = new THREE.Group();

    // Debug Mode: If user asked for Square Player
    // Reverting to SWAT model as requested.

    // const isDebugSquare = true; // TOGGLE THIS 

    // if (isDebugSquare) { ... } REMOVED

    if (assets.guard) {
        // Use Loaded GLB Model (SWAT.glb)
        // CRITICAL FIX: Use SkeletonUtils.clone() for SkinnedMeshes!
        // Standard .clone() leaves the mesh bound to the original skeleton.
        const model = SkeletonUtils.clone(assets.guard);

        // Scale/Pos settings for Quaternius SWAT model
        // Reduced scale as requested (was 2.5)
        model.scale.set(1.0, 1.0, 1.0);
        model.rotation.y = 0; // Face forward
        // Lower visual model to touch ground (Origin seems to be center/waist)
        // -0.9 was too low (feet stuck). Trying -0.5.
        model.position.set(0, -0.5, 0);

        // Ensure Visibility & Shadows
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
                c.frustumCulled = false; // PREVENT INVISIBILITY
            }
        });

        // Setup Animation Mixer
        let mixer = null;
        let actions = {};

        // Quaternius models usually have: 'Idle', 'Walk', 'Run', 'Attack'...
        if (assets.guardAnimations && assets.guardAnimations.length > 0) {
            mixer = new THREE.AnimationMixer(model);

            assets.guardAnimations.forEach(clip => {
                const action = mixer.clipAction(clip);
                actions[clip.name] = action;
                console.log("Loaded Clip:", clip.name); // DEBUG LOG

                // Flexible matching
                const name = clip.name.toLowerCase();
                if (name.includes('walk') || name.includes('run')) actions['walk'] = action;
                if (name.includes('idle') || name.includes('stand')) actions['idle'] = action;
            });

            // Default to Idle or First
            const idle = actions['idle'] || actions['Idle'] || mixer.clipAction(assets.guardAnimations[0]);
            if (idle) {
                idle.play();
                model.userData.currentAction = idle;
            }
        }

        root.add(model);

        return {
            root,
            isStatic: false,
            mixer: mixer,
            actions: actions,
            parts: { pelvis: root }
        };
    }

    // Fallback if model failed to load
    const matUniform = makePS1Material({ color: 0x1a3355 });
    const matSkin = makePS1Material({ color: 0xffccaa });
    const matBlack = makePS1Material({ color: 0x111111 });

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.25), matUniform);
    pelvis.position.y = 0.8;
    pelvis.castShadow = true;
    root.add(pelvis);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), matUniform);
    torso.position.y = 0.35;
    torso.castShadow = true;
    pelvis.add(torso);

    // Badge
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), makePS1Material({ color: 0xffd700 }));
    badge.position.set(0.1, 0.1, 0.13);
    torso.add(badge);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.3, 0);
    torso.add(headGroup);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.25, 0.25), matSkin);
    head.position.y = 0.125;
    headGroup.add(head);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.3), matUniform);
    cap.position.y = 0.28;
    cap.position.z = 0.02;
    headGroup.add(cap);

    function createLimb(width, length, color, parent, pos) {
        const group = new THREE.Group();
        group.position.copy(pos);
        parent.add(group);
        group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(width * 0.8, 0), color));
        const limb = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), color);
        limb.position.y = -length / 2;
        limb.castShadow = true;

        group.add(limb);
        return group;
    }

    const shoulderL = createLimb(0.12, 0.45, matUniform, torso, new THREE.Vector3(-0.28, 0.15, 0));
    const shoulderR = createLimb(0.12, 0.45, matUniform, torso, new THREE.Vector3(0.28, 0.15, 0));

    const hL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), matSkin);
    hL.position.y = -0.25;
    shoulderL.children[1].add(hL);

    const hR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), matSkin);
    hR.position.y = -0.25;
    shoulderR.children[1].add(hR);

    // Flashlight
    if (assets.flashlight) {
        const fl = assets.flashlight.clone();
        fl.scale.set(0.5, 0.5, 0.5); // Tune scale
        // Align with hand pointing forward
        fl.rotation.y = Math.PI;
        fl.position.set(0, -0.1, 0.2);
        hR.add(fl);
    }

    const hipL = createLimb(0.14, 0.75, matBlack, pelvis, new THREE.Vector3(-0.12, -0.05, 0));
    const hipR = createLimb(0.14, 0.75, matBlack, pelvis, new THREE.Vector3(0.12, -0.05, 0));

    const fL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.25), matBlack);
    fL.position.set(0, -0.40, 0.05);
    hipL.children[1].add(fL);

    const fR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.25), matBlack);
    fR.position.set(0, -0.40, 0.05);
    hipR.children[1].add(fR);

    return {
        root,
        parts: { pelvis, torso, head: headGroup, armL: shoulderL, armR: shoulderR, legL: hipL, legR: hipR }
    };
}


// --- PLAYER: ANIMATRONIC (RED RABBIT) ---
// --- PLAYER: ANIMATRONIC (BLUE FOX) ---
// --- PLAYER: ANIMATRONIC (EVANDER) ---
function createAnimatronicPlayer() {
    const root = new THREE.Group();

    if (assets.evander) {
        // Use Loaded GLB Model
        const model = SkeletonUtils.clone(assets.evander);

        // Adjust Scale/Pos for Evander model
        // Assuming similar scale to guard or needs tuning.
        model.scale.set(1.0, 1.0, 1.0);
        model.position.set(0, -0.5, 0); // Same floor logic as guard
        model.rotation.y = 0; // ROTATION 0

        // Shadows & Visibility
        model.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
                c.frustumCulled = false;
            }
        });

        // Animation Mixer
        let mixer = null;
        let actions = {};

        if (assets.evanderAnimations && assets.evanderAnimations.length > 0) {
            mixer = new THREE.AnimationMixer(model);

            assets.evanderAnimations.forEach(clip => {
                const action = mixer.clipAction(clip);
                actions[clip.name] = action;
                console.log("Evander Clip:", clip.name);

                // Map known names
                const name = clip.name.toLowerCase();
                // User said "only walking animation". Map it to walk.
                if (name.includes('walk') || name.includes('run') || name.includes('armature')) actions['walk'] = action;
            });

            // If no explicit walk found but there is ONLY one animation, use it as walk
            if (!actions['walk'] && assets.evanderAnimations.length > 0) {
                actions['walk'] = mixer.clipAction(assets.evanderAnimations[0]);
            }
        }

        root.add(model);

        return {
            root,
            isStatic: false,
            mixer: mixer,
            actions: actions,
            parts: { pelvis: root }
        };
    }

    // Fallback Procedural (Blue Fox)
    const matSuit = makePS1Material({ color: 0x3399ff });
    // ... (Keep minimal fallback or just error out? Keep for safety)
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), matSuit);
    root.add(pelvis);
    return { root, parts: { pelvis } };
}

// Global creation moved to init to wait for assets
// let player = createSecurityGuard(); ...


// --- CONTROLS ---
const keys = { w: false, a: false, s: false, d: false, m: false, f: false }; // Added 'f' for light
let isLightsOn = true;
window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'f' && isAnimatronic) {
        isLightsOn = !isLightsOn;
    }
});
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// --- CHEAT CODE UI ---
const codeInput = document.createElement('input');
codeInput.placeholder = "Enter Code";
codeInput.style.position = 'fixed';
codeInput.style.top = '10px';
codeInput.style.left = '10px';
codeInput.style.padding = '8px';
codeInput.style.background = 'rgba(0,0,0,0.8)';
codeInput.style.color = '#fff';
codeInput.style.border = '2px solid #fff';
codeInput.style.fontFamily = 'monospace';
codeInput.style.zIndex = '999999';
codeInput.style.pointerEvents = 'auto';
document.body.appendChild(codeInput);

let isAnimatronic = false;
codeInput.addEventListener('change', (e) => {
    if (e.target.value === "Animatronic") {
        isAnimatronic = true;
        scene.remove(player.root);
        player = createAnimatronicPlayer();
        player.root.scale.set(1.1, 1.1, 1.1);
        scene.add(player.root);
        e.target.style.display = 'none';
        e.target.value = "";
    } else {
        alert("Wrong code");
        e.target.value = "";
    }
});


// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    if (!player) return; // Wait for player

    try {
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        let moveSpeed = 0;
        let turnSpeed = 0;

        if (keys.w) moveSpeed = MOVEMENT_SPEED;
        if (keys.s) moveSpeed = -MOVEMENT_SPEED;
        if (keys.a) turnSpeed = TURN_SPEED;
        if (keys.d) turnSpeed = -TURN_SPEED;

        // 1. Rotation (Safe)
        player.root.rotation.y += turnSpeed * delta;

        // 2. Movement with Collision Check
        const dist = moveSpeed * delta;
        if (Math.abs(dist) > 0.001) {
            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(player.root.quaternion);
            forward.multiplyScalar(dist);

            const nextPos = player.root.position.clone().add(forward);

            if (!checkCollision(nextPos)) {
                player.root.position.copy(nextPos);
            } else {
                const nextPosX = player.root.position.clone().add(new THREE.Vector3(forward.x, 0, 0));
                if (!checkCollision(nextPosX)) player.root.position.copy(nextPosX);
                else {
                    const nextPosZ = player.root.position.clone().add(new THREE.Vector3(0, 0, forward.z));
                    if (!checkCollision(nextPosZ)) player.root.position.copy(nextPosZ);
                }
            }
        }

        // Auto-Climb Stairs (Simple Gravity/Height Logic)
        // Stage stairs at Z ~ -11.5 +/- width. X +/- 8.
        // If player is in stair zone, lerp Y to 1.2. Else lerp to 0.
        // Stage is Y=0 normally? No, floor Y=0.06. Stage Y=1.2.
        // If on stage (Z < -12), Y = 1.2 + offset.
        // If on stairs (Z -10 to -12, X +/- 8), lerp.
        const px = player.root.position.x;
        const pz = player.root.position.z;
        let targetY = 0.8; // Base height (Legs)

        // Stage Area Check (Z < -12)
        if (pz < -11.5 && Math.abs(px) < 15) {
            targetY = 2.0; // On Stage (1.2 + 0.8)
        }
        // Stair Area Check
        // Stairs at X = +/- 10. Z = -9 to -12.
        else if (pz < -8.5 && pz > -12.5 && Math.abs(Math.abs(px) - 10) < 2.5) {
            // Lerp Height based on Z distance?
            // Z=-9 -> Y=0.8. Z=-12 -> Y=2.0.
            // Dist = (-9 - pz) / 3. 0 to 1.
            const t = Math.min(Math.max((-9 - pz) / 3.0, 0), 1);
            targetY = 0.8 + t * 1.2;
        }

        player.parts.pelvis.position.y = THREE.MathUtils.lerp(player.parts.pelvis.position.y, targetY, delta * 5);


        // Camera Follow
        const target = player.root;
        const offset = new THREE.Vector3(0, 2.5, -3.5);
        offset.applyMatrix4(target.matrixWorld);
        camera.position.lerp(offset, delta * 4.0);
        const lookAtPos = new THREE.Vector3(0, 1.5, 0);
        lookAtPos.applyMatrix4(target.matrixWorld);
        camera.lookAt(lookAtPos);

        // Mirror Update (Every frame or throttled)
        const mirror = scene.getObjectByName("mirror");
        // Ensure CubeCamera exists and is valid
        if (mirror && mirror.children.length > 0) {
            const cam = mirror.children[0];
            if (cam.isCubeCamera) {
                mirror.visible = false;
                cam.update(renderer, scene);
                mirror.visible = true;
            }
        }

        // Animation
        const isWalking = Math.abs(moveSpeed) > 0.01;

        if (isWalking) {
            const speed = 12; // Unused for mixer speed mostly, but for logic

            if (!player.isStatic && player.mixer) {
                player.mixer.update(delta);

                // Switch to Walk Animation
                const walkAction = player.actions['walk'] || player.actions['Walking'] || player.actions['Run'];
                const current = player.root.children[0].userData.currentAction;

                if (walkAction && current !== walkAction) {
                    if (current) current.fadeOut(0.2);
                    walkAction.reset().fadeIn(0.2).play();
                    player.root.children[0].userData.currentAction = walkAction;
                }
            } else if (!player.isStatic && player.mixer) {
                // IDLE STATE
                // If we stopped walking, try to switch to Idle
                const idleAction = player.actions['idle'];
                const current = player.root.children[0].userData.currentAction;

                if (idleAction) {
                    if (current !== idleAction) {
                        if (current) current.fadeOut(0.2);
                        idleAction.reset().fadeIn(0.2).play();
                        player.root.children[0].userData.currentAction = idleAction;
                    }
                } else {
                    // No Idle animation exists (User said so). Just stop walking.
                    if (current) {
                        current.fadeOut(0.2);
                        player.root.children[0].userData.currentAction = null;
                    }
                }
            }

            // For static or procedural, or just extra bobbing (optional, maybe disable for good anims)
            if (!player.mixer) {
                player.parts.pelvis.position.y = targetY + Math.abs(Math.sin(time * speed)) * 0.05;
                player.parts.pelvis.rotation.z = Math.sin(time * speed) * 0.02;
            } else {
                player.parts.pelvis.position.y = targetY; // Just update height
            }
        } else {
            // Idle
            if (player.mixer) {
                player.mixer.update(delta);

                // Switch to Idle
                const idleAction = player.actions['idle'] || player.actions['Idle'];
                const current = player.root.children[0].userData.currentAction;

                if (idleAction && current !== idleAction) {
                    if (current) current.fadeOut(0.2);
                    idleAction.reset().fadeIn(0.2).play();
                    player.root.children[0].userData.currentAction = idleAction;
                }
            }
            // ... Procedural idle logic ...

            // ... Procedural idle logic ...

            const lerpFactor = delta * 5;
            if (!player.isStatic && player.parts.legL) {
                player.parts.legL.rotation.x = THREE.MathUtils.lerp(player.parts.legL.rotation.x, 0, lerpFactor);
                player.parts.legR.rotation.x = THREE.MathUtils.lerp(player.parts.legR.rotation.x, 0, lerpFactor);
                player.parts.armL.rotation.x = THREE.MathUtils.lerp(player.parts.armL.rotation.x, 0, lerpFactor);
                player.parts.armR.rotation.x = THREE.MathUtils.lerp(player.parts.armR.rotation.x, 0, lerpFactor);
            }
            player.parts.pelvis.position.y = THREE.MathUtils.lerp(player.parts.pelvis.position.y, targetY, lerpFactor);
            player.parts.pelvis.position.y = THREE.MathUtils.lerp(player.parts.pelvis.position.y, targetY, lerpFactor);
            player.parts.pelvis.rotation.z = THREE.MathUtils.lerp(player.parts.pelvis.rotation.z, 0, lerpFactor);
        }

        // Update Coords Debug & Identity
        const currentAnim = player.root.children[0]?.userData?.currentAction?.getClip().name || "None";
        const keysPressed = Object.keys(keys).filter(k => keys[k]).join(',');

        let identityHtml = "";
        if (isAnimatronic) {
            const lightStatus = isLightsOn ? "ON" : "OFF";
            identityHtml = `<span style="color: #00ffff; font-weight: bold; font-size: 1.2em;">Evander</span> | Lights (F): ${lightStatus}`;

            // Handle Light Dimming
            // DirLight (Sun) index 1 (usually). Hemi index 0.
            const hemi = scene.children.find(c => c.isHemisphereLight);
            const sun = scene.children.find(c => c.isDirectionalLight);

            const dimFactor = isLightsOn ? 1.0 : 0.1; // "Not too dark"
            // Base intensities: Hemi 2.0, Sun 2.0 (High).
            if (hemi) hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, 2.0 * dimFactor, delta * 2);
            if (sun) sun.intensity = THREE.MathUtils.lerp(sun.intensity, 2.0 * dimFactor, delta * 2);

        } else {
            identityHtml = `<span style="color: #a020f0; font-weight: bold; font-size: 1.2em;">Purple Security Guard</span>`;
            // Reset lights if switched back
            const hemi = scene.children.find(c => c.isHemisphereLight);
            const sun = scene.children.find(c => c.isDirectionalLight);
            if (hemi) hemi.intensity = 2.0;
            if (sun) sun.intensity = 2.0;
        }

        debugDiv.innerHTML = `${identityHtml}<br>Pos: ${player.root.position.x.toFixed(1)}, ${player.root.position.y.toFixed(1)}, ${player.root.position.z.toFixed(1)} | Keys: ${keysPressed} | Anim: ${currentAnim} | Speed: ${moveSpeed.toFixed(2)}`;

        // DEBUG VISUALS (M Key) - Executed per frame
        if (keys.m) {
            if (!debugVisible) {
                debugVisible = true;
                debugGroup.clear();
                colliders.forEach(box => {
                    const helper = new THREE.Box3Helper(box, 0xff0000);
                    debugGroup.add(helper);
                });
                const playerBox = new THREE.Box3();
                const pPos = player.root.position;
                const r = 0.2;
                playerBox.min.set(pPos.x - r, pPos.y + 0.1, pPos.z - r);
                playerBox.max.set(pPos.x + r, pPos.y + 1.6, pPos.z + r);
                const pHelper = new THREE.Box3Helper(playerBox, 0x0000ff);
                pHelper.name = "playerHelper";
                debugGroup.add(pHelper);
                scene.add(debugGroup);
            } else {
                const pHelper = debugGroup.getObjectByName("playerHelper");
                if (pHelper) {
                    const pPos = player.root.position;
                    const r = 0.2;
                    pHelper.box.min.set(pPos.x - r, pPos.y + 0.1, pPos.z - r);
                    pHelper.box.max.set(pPos.x + r, pPos.y + 1.6, pPos.z + r);
                }
            }
        } else {
            if (debugVisible) {
                debugVisible = false;
                debugGroup.clear();
                scene.remove(debugGroup);
            }
        }

        // Resolution Update
        const aspect = window.innerWidth / window.innerHeight;
        if (Math.abs(camera.aspect - aspect) > 0.01) {
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            const newWidth = Math.floor(RENDER_HEIGHT * aspect);
            renderer.setSize(newWidth, RENDER_HEIGHT, false);
            if (scene) {
                scene.traverse(obj => {
                    if (obj.material && obj.material.uniforms && obj.material.uniforms.uResolutionWidth) {
                        obj.material.uniforms.uResolutionWidth.value = newWidth / 2;
                        obj.material.uniforms.uResolutionHeight.value = RENDER_HEIGHT / 2;
                    }
                });
            }
        }

        renderer.render(scene, camera);
        // Network Update (Throttle?)
        if (player && socket.connected) {
            socket.emit('playerMovement', {
                x: player.root.position.x,
                y: player.root.position.y,
                z: player.root.position.z,
                rotation: player.root.rotation.y,
                anim: currentAnim
            });
        }

    } catch (e) {
        debugDiv.style.color = 'red';
        debugDiv.innerText = "RUNTIME ERROR: " + e.message;
        console.error(e);
    }
}

// --- INITIALIZATION ---
const existingApp = document.getElementById('app');
if (existingApp) {
    existingApp.innerHTML = '';
    existingApp.appendChild(canvas); // JS: Re-add the canvas that was just wiped
}

// Global player variable
let player;

// Wait for assets, then build world and start
loadAssets().then(() => {
    // Clear any previous (if HMR)
    colliders.length = 0;

    // Create Player
    player = createSecurityGuard();
    player.root.scale.set(1.1, 1.1, 1.1); // Helper Group Scale (Model scale inside is 1.5)
    player.root.position.set(0, 0, 15); // Lowered Y to 0 (was 0.5) to fix "floating"
    scene.add(player.root);

    // Clear any previous (if HMR)
    colliders.length = 0;

    // Add Global Illumination (Hemisphere + Sun)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0); // Sky, Ground, Intensity
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0); // Sun
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Fog for visibility restriction
    scene.fog = new THREE.FogExp2(0x000000, FOG_DENSITY_ON);

    // Build World with loaded assets
    const restaurant = buildRestaurant();
    scene.add(restaurant);

    animate();
}).catch(e => {
    debugDiv.style.color = 'red';
    debugDiv.innerText = "INIT ERROR: " + e.message;
    console.error(e);
});

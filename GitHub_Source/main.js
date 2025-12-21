import './style.css'
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- CONFIGURATION ---
const RENDER_WIDTH = 320;
const RENDER_HEIGHT = 240;
const MOVEMENT_SPEED = 5;
const TURN_SPEED = 10;
const ROOM_SIZE = 50;

// --- SCENE SETUP ---
const app = document.querySelector('#app');
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight); // Actual canvas size
renderer.setPixelRatio(window.devicePixelRatio);
// We want low res internal, but scaled up. 
// Actually, creating a low-res render target is better for true retro, 
// but simply setting setSize to low res and letting CSS scale it is easier and more performant for this style.
renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false); // false = prevent resizing canvas style
// The CSS handles the stretching.

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
scene.fog = new THREE.Fog(0x111111, 10, 60);

// Camera
const camera = new THREE.PerspectiveCamera(60, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1000);
camera.position.set(0, 5, -8);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const pointLight = new THREE.PointLight(0xffaa00, 1, 10);
scene.add(pointLight); // Player flashlight/aura?

// --- ENVIRONMENT ---
// Basic Room
const roomGeo = new THREE.BoxGeometry(ROOM_SIZE, 12, ROOM_SIZE);
const roomMat = new THREE.MeshStandardMaterial({
    color: 0x555566,
    side: THREE.BackSide,
    roughness: 0.8
});
const room = new THREE.Mesh(roomGeo, roomMat);
room.position.y = 6; // Floor at 0
scene.add(room);

// Grid Helper for "Floor" vibe
const gridHelper = new THREE.GridHelper(ROOM_SIZE, ROOM_SIZE / 2, 0x000000, 0x333333);
scene.add(gridHelper);


// --- PLAYER (Security Guard Placeholder) ---
const playerGroup = new THREE.Group();
scene.add(playerGroup);

// Materials
const uniformMat = new THREE.MeshStandardMaterial({ color: 0x1a2b4c, roughness: 0.6 }); // Uniform Blue
const skinMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

// Body
const torsoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
const torso = new THREE.Mesh(torsoGeo, uniformMat);
torso.position.y = 0.75 + 0.35; // Legs height + half torso
playerGroup.add(torso);

// Head
const headGroup = new THREE.Group();
headGroup.position.set(0, 0.75 + 0.7 + 0.15, 0); // On top of torso
playerGroup.add(headGroup);

const headGeo = new THREE.BoxGeometry(0.25, 0.3, 0.3);
const head = new THREE.Mesh(headGeo, skinMat);
headGroup.add(head);

// Hat (Security Cap)
const hatGeo = new THREE.BoxGeometry(0.27, 0.1, 0.32);
const hat = new THREE.Mesh(hatGeo, uniformMat);
hat.position.y = 0.15 + 0.05;
headGroup.add(hat);

// Limbs Config
const limbGeo = new THREE.BoxGeometry(0.15, 0.75, 0.15);

// Left Leg
const legL = new THREE.Mesh(limbGeo, blackMat); // Trousers
legL.position.set(-0.15, 0.375, 0);
playerGroup.add(legL);

// Right Leg
const legR = new THREE.Mesh(limbGeo, blackMat);
legR.position.set(0.15, 0.375, 0);
playerGroup.add(legR);

// Left Arm
const armL = new THREE.Mesh(limbGeo, uniformMat);
armL.position.set(-0.35, 0.75 + 0.5, 0);
playerGroup.add(armL);

// Right Arm
const armR = new THREE.Mesh(limbGeo, uniformMat);
armR.position.set(0.35, 0.75 + 0.5, 0);
playerGroup.add(armR);


// --- CONTROLS ---
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false;
});

// Camera Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 10;
controls.target.copy(playerGroup.position);


// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // Movement Logic
    // We want to move relative to the Camera's viewing direction, but flattened on Y.

    let moveX = 0;
    let moveZ = 0;

    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    let isMoving = moveX !== 0 || moveZ !== 0;

    if (isMoving) {
        // Calculate camera forward direction (projected on XZ plane)
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        camDir.y = 0;
        camDir.normalize();

        const camRight = new THREE.Vector3();
        camRight.crossVectors(camDir, new THREE.Vector3(0, 1, 0)); // Right vector

        // Combined Direction
        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(camDir, -moveZ); // If W (-1), move forward (camDir)
        moveDir.addScaledVector(camRight, moveX); // If D (+1), move right

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();

            const moveStep = moveDir.clone().multiplyScalar(MOVEMENT_SPEED * delta);

            // Move Player
            playerGroup.position.add(moveStep);

            // Move Camera (Follow)
            camera.position.add(moveStep);
            controls.target.copy(playerGroup.position);

            // Rotate Player to face movement
            const targetRotation = Math.atan2(moveDir.x, moveDir.z);
            // Smooth rotation
            const currentRotation = playerGroup.rotation.y;
            // Shortest path interpolation for angle
            let diff = targetRotation - currentRotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            playerGroup.rotation.y += diff * TURN_SPEED * delta;
        }

        // Animate Walking
        const walkSpeed = 10;
        legL.rotation.x = Math.sin(time * walkSpeed) * 0.5;
        legR.rotation.x = Math.cos(time * walkSpeed) * 0.5;
        armL.rotation.x = -Math.sin(time * walkSpeed) * 0.5;
        armR.rotation.x = -Math.cos(time * walkSpeed) * 0.5;

    } else {
        // Idle Pose
        const lerpSpeed = 10 * delta;
        legL.rotation.x = THREE.MathUtils.lerp(legL.rotation.x, 0, lerpSpeed);
        legR.rotation.x = THREE.MathUtils.lerp(legR.rotation.x, 0, lerpSpeed);
        armL.rotation.x = THREE.MathUtils.lerp(armL.rotation.x, 0, lerpSpeed);
        armR.rotation.x = THREE.MathUtils.lerp(armR.rotation.x, 0, lerpSpeed);

        // Ensure control target stays updated even if not moving (drift fix)
        // controls.target.lerp(playerGroup.position, 0.1); 
        // Strict follow is better for game feel
        controls.target.copy(playerGroup.position);
    }

    // Smooth camera damping
    controls.update();

    // Light follows player
    pointLight.position.copy(playerGroup.position).add(new THREE.Vector3(0, 2, 0));

    // Handle Resize (Keep Low Res)
    const aspect = window.innerWidth / window.innerHeight;
    if (camera.aspect !== aspect) {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        // Keep internal resolution fixed or adaptive? 
        // For PS1 style, fixed height usually.
        // Let's keep 320x(320/aspect)
        // Or just fixed 320x240 and stretch looks weird if aspect is different.
        // Ideally renderWidth = 240 * aspect.
        const newWidth = Math.floor(RENDER_HEIGHT * aspect);
        renderer.setSize(newWidth, RENDER_HEIGHT, false);
    }

    renderer.render(scene, camera);
}

// Remove default loading HTML if any
const existingApp = document.getElementById('app');
if (existingApp) existingApp.innerHTML = '';

animate();

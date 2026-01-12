import './style.css'
import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { io } from 'socket.io-client';

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const SERVER_URL = isLocal ? "http://localhost:3000" : "https://the-game-rivf.onrender.com";
const socket = io(SERVER_URL);
const remotePlayers = {}; // { id: { mesh, anims, targetPos, targetRot } }


const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true, { antialias: false, preserveDrawingBuffer: true, stencil: true });

engine.setHardwareScalingLevel(3); // PS1 chunky pixels

// --- DETERMINISTIC RANDOM ---
let seed = 123456;
const seededRandom = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

const createScene = () => {
    seed = 123456;
    const scene = new BABYLON.Scene(engine);

    // Bright cheerful sky!
    scene.clearColor = new BABYLON.Color3(0.5, 0.75, 1.0);
    scene.fogMode = BABYLON.Scene.FOGMODE_LINEAR;
    scene.fogStart = 100; // Pushed far back
    scene.fogEnd = 200;
    scene.fogColor = new BABYLON.Color3(0.6, 0.8, 1.0);
    scene.collisionsEnabled = true;

    // --- MAIN CAMERA (LOCKED - no player rotation) ---
    const camera = new BABYLON.ArcRotateCamera("camera1", -Math.PI / 2, Math.PI / 3.5, 8, new BABYLON.Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, false);
    // Remove ALL camera inputs to lock the view
    camera.inputs.clear();
    camera.minZ = 0.1;
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 8;
    camera.lowerBetaLimit = Math.PI / 3.5;
    camera.upperBetaLimit = Math.PI / 3.5;
    camera.checkCollisions = false; // Disable collision to prevent camera angle changes
    camera.viewport = new BABYLON.Viewport(0, 0, 1, 1);

    // Simple CSS minimap - no second camera needed
    scene.activeCamera = camera;

    // Cheerful PS1 Pipeline
    const pipeline = new BABYLON.DefaultRenderingPipeline("ps1", true, scene, [camera]);
    pipeline.samples = 1;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.9;
    pipeline.bloomWeight = 0.2;
    pipeline.grainEnabled = true;
    pipeline.grain.intensity = 3;
    pipeline.grain.animated = true;
    pipeline.imageProcessing.contrast = 1.1;
    pipeline.imageProcessing.exposure = 1.2;

    // LIGHTING
    const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), scene);
    ambient.intensity = 1.0;
    ambient.groundColor = new BABYLON.Color3(0.4, 0.35, 0.3);

    const sunLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.3, -1, -0.5), scene);
    sunLight.position = new BABYLON.Vector3(20, 40, 20);
    sunLight.intensity = 0.8;
    sunLight.diffuse = new BABYLON.Color3(1, 0.95, 0.8);

    const shadowGenerator = new BABYLON.ShadowGenerator(512, sunLight);
    shadowGenerator.usePoissonSampling = true;
    shadowGenerator.darkness = 0.3;

    // MATERIALS
    const createFlatMat = (name, hex) => {
        const m = new BABYLON.StandardMaterial(name, scene);
        m.diffuseColor = BABYLON.Color3.FromHexString(hex);
        m.specularColor = BABYLON.Color3.Black();
        return m;
    };

    const grassMat = createFlatMat("grass", "#4a9f4a");
    const rockMat = createFlatMat("rock", "#888888");
    const mtnMat = createFlatMat("mtn", "#667788");
    const foxOrangeMat = createFlatMat("foxO", "#ff6600");
    const foxWhiteMat = createFlatMat("foxW", "#ffeecc");
    const raccoonGrayMat = createFlatMat("raccoonG", "#555555");
    const raccoonLightMat = createFlatMat("raccoonL", "#bbbbbb");
    const chickenWhiteMat = createFlatMat("chicken", "#ffffee");
    const beakMat = createFlatMat("beak", "#ffcc00");
    const combMat = createFlatMat("comb", "#ff3333");
    const blackMat = createFlatMat("black", "#222222");
    const pawMat = createFlatMat("paw", "#442211");

    // WORLD
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 80, height: 80, subdivisions: 20 }, scene);
    ground.material = grassMat;
    ground.receiveShadows = true;
    ground.checkCollisions = true;

    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] = seededRandom() * 0.1;
    }
    ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

    // --- OBSTACLES REGISTRY ---
    const obstacles = [
        { x: 0, z: 0, r: 6 }, // Campfire
        { x: 12, z: -12, r: 12 }, // Cabin Area
        { x: -8, z: -8, r: 5 }, // Workbench
        { x: 10, z: -14, r: 2 }, // Marker
        { x: 5, z: 5, r: 2 } // Postbox
    ];
    const isValidPos = (x, z, r) => {
        for (const o of obstacles) {
            const dist = Math.sqrt((x - o.x) ** 2 + (z - o.z) ** 2);
            if (dist < (r + o.r)) return false;
        }
        return true;
    };

    // --- TREES (GLB) ---
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "tree.glb", scene).then((result) => {
        const treeRoot = result.meshes[0];
        treeRoot.setEnabled(false);
        result.meshes.forEach(m => {
            m.checkCollisions = true;
            if (m.material) {
                m.material.transparencyMode = BABYLON.Material.MATERIAL_ALPHATEST;
                m.material.backFaceCulling = false;
            }
        });

        for (let i = 0; i < 30; i++) { // Attempt more to fill
            const x = (seededRandom() - 0.5) * 55;
            const z = (seededRandom() - 0.5) * 55;
            if (!isValidPos(x, z, 3)) continue;

            obstacles.push({ x, z, r: 3 }); // Register Tree

            const ins = treeRoot.instantiateHierarchy();
            ins.position.set(x, 1.75, z);
            ins.rotation.y = seededRandom() * Math.PI * 2;
            const s = (1 + seededRandom() * 0.5) * 3;
            ins.scaling.set(s, s, s);
            ins.setEnabled(true);
            ins.checkCollisions = true;
            shadowGenerator.addShadowCaster(ins, true);

            // Blocker for trunk
            const blocker = BABYLON.MeshBuilder.CreateCylinder("blocker", { height: 4, diameter: 1.5 }, scene);
            blocker.position.set(x, 2, z);
            blocker.isVisible = false;
            blocker.checkCollisions = true;
        }
    });

    // --- ROCKS ---
    for (let i = 0; i < 20; i++) {
        const x = (seededRandom() - 0.5) * 55;
        const z = (seededRandom() - 0.5) * 55;
        if (!isValidPos(x, z, 2)) continue;

        obstacles.push({ x, z, r: 2 }); // Register Rock

        const s = 0.5 + seededRandom() * 0.8;
        const rock = BABYLON.MeshBuilder.CreatePolyhedron("rock", { type: 2, size: s }, scene);
        rock.position.set(x, s * 0.4, z);
        rock.rotation.set(seededRandom(), seededRandom(), seededRandom());
        rock.material = rockMat;
        rock.checkCollisions = true;
        rock.convertToFlatShadedMesh();
        shadowGenerator.addShadowCaster(rock);
    }

    // --- MOUNTAINS ---
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const dist = 38 + seededRandom() * 5;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        const h = 20 + seededRandom() * 15;
        const w = 15 + seededRandom() * 8;

        const mtn = BABYLON.MeshBuilder.CreateCylinder("mtn", { height: h, diameterTop: 0, diameterBottom: w * 1.5, tessellation: 4 }, scene); // Widen base to close gaps
        mtn.position.set(x, h / 2 - 3, z);
        mtn.rotation.y = seededRandom() * Math.PI;
        mtn.material = mtnMat;
        mtn.checkCollisions = true;
        mtn.convertToFlatShadedMesh();
    }

    BABYLON.SceneLoader.ImportMeshAsync("", "./", "campfire.glb", scene).then((result) => {
        const camp = result.meshes[0];
        camp.position.set(0, 0.2, 0); // Raised Y to avoid sinking
        camp.scaling.set(0.4, 0.4, 0.4);
        result.meshes.forEach(m => m.checkCollisions = true);
        shadowGenerator.addShadowCaster(camp, true);
        // Point light for fire
        const light = new BABYLON.PointLight("fireLight", new BABYLON.Vector3(0, 1, 0), scene);
        light.diffuse = new BABYLON.Color3(1, 0.5, 0);
        light.range = 10;
    });

    // --- GRASS GLB ---
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "Grass #1.glb", scene).then((result) => {
        const grassRoot = result.meshes[0];
        grassRoot.setEnabled(false);
        for (let i = 0; i < 80; i++) {
            const x = (seededRandom() - 0.5) * 60;
            const z = (seededRandom() - 0.5) * 60;
            if (!isValidPos(x, z, 1)) continue; // Check overlap
            // Note: Grass doesn't need to be pushed to obstacles as it's walkable
            // But checking obstacles ensures it doesn't spawn INSIDE a tree/cabin

            const ins = grassRoot.instantiateHierarchy();
            ins.position.set(x, 0, z);
            const s = 0.025 + seededRandom() * 0.015;
            ins.scaling.set(s, s, s);
            ins.rotation.y = seededRandom() * Math.PI * 2;
            ins.rotation.y = seededRandom() * Math.PI * 2;
            ins.setEnabled(true);
            shadowGenerator.addShadowCaster(ins, true);
        }
    });

    // --- CABIN SHED ---
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "Cabin Shed.glb", scene).then((result) => {
        const cabin = result.meshes[0];
        cabin.position.set(12, 0, -12);
        cabin.rotation.y = Math.PI / 4 + Math.PI;
        cabin.scaling.set(22.5, 22.5, 22.5);
        result.meshes.forEach(m => {
            m.checkCollisions = true;
        });
        shadowGenerator.addShadowCaster(cabin, true);
    });

    // WORKBENCH
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "Workbench Grind.glb", scene).then((result) => {
        const wb = result.meshes[0];
        wb.position.set(-8, 0, -8);
        wb.rotation.y = 0.5;
        wb.scaling.set(3.6, 3.6, 3.6);
        result.meshes.forEach(m => m.checkCollisions = true);
        shadowGenerator.addShadowCaster(wb, true);
    });

    // HIGHLIGHT MARKER
    const marker = BABYLON.MeshBuilder.CreateDisc("marker", { radius: 1.5, tessellation: 32 }, scene);
    marker.rotation.x = Math.PI / 2;
    marker.position.set(10, 0.05, -14);
    const mMat = new BABYLON.StandardMaterial("mMat", scene);
    mMat.diffuseColor = BABYLON.Color3.Yellow();
    mMat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0);
    mMat.alpha = 0.6;
    marker.material = mMat;

    // INTERIOR
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "log_cabin_interior.glb", scene).then((r) => {
        const interior = r.meshes[0];
        interior.position.set(1000, 0, 1000);
        interior.rotationQuaternion = null;
        interior.rotation.y = Math.PI / 2;
        interior.scaling.set(3, 3, 3);
        r.meshes.forEach(m => m.checkCollisions = true);

        // Helper Floor for Smooth Movement
        const cf = BABYLON.MeshBuilder.CreateGround("cf", { width: 30, height: 30 }, scene);
        cf.position.set(1000, 0.05, 1000);
        cf.isVisible = false;
        cf.checkCollisions = true;
    });

    // --- POSTBOX ---
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "Postbox.glb", scene).then((result) => {
        const pb = result.meshes[0];
        pb.position.set(5, 1, 5); // Raised Y
        pb.scaling.set(0.6, 0.6, 0.6); // 1/3 size
        result.meshes.forEach(m => m.checkCollisions = true);
        shadowGenerator.addShadowCaster(pb, true);
    });

    let stoneTemplate;
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "Desert pebble.glb", scene).then((result) => {
        stoneTemplate = result.meshes[0];
        stoneTemplate.isVisible = false;
        stoneTemplate.scaling.setAll(3.3); // 1/3 of 10
        stoneTemplate.position.set(0, -90, 0);
        // Ensure material is visible
        const sm = new BABYLON.StandardMaterial("sm", scene);
        sm.diffuseColor = new BABYLON.Color3(1, 0.98, 0.85); // Cream
        result.meshes.forEach(m => {
            if (m.getTotalVertices() > 0) m.material = sm;
        });
    });

    // =====================================================
    // CREATURE BUILDER
    // =====================================================
    const createMonster = (type) => {
        // Root MUST be a Mesh for moveWithCollisions to work
        const root = BABYLON.MeshBuilder.CreateBox("root", { size: 1 }, scene);
        root.position.set(-3, 1, -3); // Spawn beside campfire, not inside
        root.isVisible = false;
        root.checkCollisions = true;
        root.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5);
        root.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);
        root.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);

        const parts = {};

        if (type === 'fox') {
            const body = new BABYLON.TransformNode("body", scene);
            body.parent = root;
            body.position.y = 0.45;
            body.rotation.y = -Math.PI / 2; // Rotate to face +Z
            parts.body = body;
            // Fox parts
            const torso = BABYLON.MeshBuilder.CreateBox("torso", { width: 0.7, height: 0.3, depth: 0.25 }, scene); torso.material = foxOrangeMat; torso.parent = body; torso.convertToFlatShadedMesh(); shadowGenerator.addShadowCaster(torso);
            const chest = BABYLON.MeshBuilder.CreateBox("chest", { width: 0.2, height: 0.2, depth: 0.2 }, scene); chest.position.set(0.2, -0.05, 0); chest.material = foxWhiteMat; chest.parent = body;
            const neck = new BABYLON.TransformNode("neck", scene); neck.parent = body; neck.position.set(0.4, 0.1, 0); parts.neck = neck;
            const head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.22, height: 0.2, depth: 0.2 }, scene); head.material = foxOrangeMat; head.parent = neck; head.convertToFlatShadedMesh(); shadowGenerator.addShadowCaster(head);
            const snout = BABYLON.MeshBuilder.CreateCylinder("snout", { height: 0.18, diameterTop: 0.02, diameterBottom: 0.1, tessellation: 4 }, scene); snout.rotation.z = -Math.PI / 2; snout.position.x = 0.15; snout.material = foxOrangeMat; snout.parent = head; snout.convertToFlatShadedMesh();
            const nose = BABYLON.MeshBuilder.CreateBox("nose", { size: 0.04 }, scene); nose.position.x = 0.22; nose.material = blackMat; nose.parent = head;
            const eyeL = BABYLON.MeshBuilder.CreateBox("eyeL", { size: 0.04 }, scene); eyeL.position.set(0.08, 0.04, 0.08); eyeL.material = blackMat; eyeL.parent = head; const eyeR = eyeL.clone("eyeR"); eyeR.position.z = -0.08; eyeR.parent = head;
            const earL = BABYLON.MeshBuilder.CreateCylinder("earL", { height: 0.12, diameterTop: 0, diameterBottom: 0.08, tessellation: 3 }, scene); earL.position.set(-0.02, 0.12, 0.06); earL.material = foxOrangeMat; earL.parent = head; earL.convertToFlatShadedMesh(); const earR = earL.clone("earR"); earR.position.z = -0.06; earR.parent = head;
            const createLeg = (name, fx, fz) => { const hip = new BABYLON.TransformNode(name, scene); hip.parent = body; hip.position.set(fx, -0.1, fz); const leg = BABYLON.MeshBuilder.CreateBox(name + "L", { width: 0.08, height: 0.35, depth: 0.08 }, scene); leg.position.y = -0.18; leg.material = foxOrangeMat; leg.parent = hip; leg.convertToFlatShadedMesh(); const paw = BABYLON.MeshBuilder.CreateBox(name + "P", { width: 0.1, height: 0.06, depth: 0.1 }, scene); paw.position.y = -0.38; paw.material = pawMat; paw.parent = hip; return hip; };
            parts.legFL = createLeg("legFL", 0.22, 0.1); parts.legFR = createLeg("legFR", 0.22, -0.1); parts.legBL = createLeg("legBL", -0.22, 0.1); parts.legBR = createLeg("legBR", -0.22, -0.1);
            const tail = new BABYLON.TransformNode("tail", scene); tail.parent = body; tail.position.set(-0.35, 0.1, 0); parts.tail = tail;
            const tailMesh = BABYLON.MeshBuilder.CreateCylinder("tailMesh", { height: 0.5, diameterTop: 0.02, diameterBottom: 0.15, tessellation: 4 }, scene); tailMesh.rotation.z = Math.PI / 2.5; tailMesh.position.set(-0.15, 0.12, 0); tailMesh.material = foxOrangeMat; tailMesh.parent = tail; tailMesh.convertToFlatShadedMesh();
            const tailTip = BABYLON.MeshBuilder.CreateBox("tailTip", { size: 0.1 }, scene); tailTip.position.set(-0.35, 0.28, 0); tailTip.material = foxWhiteMat; tailTip.parent = tail;

        } else if (type === 'raccoon') {
            const body = new BABYLON.TransformNode("body", scene);
            body.parent = root;
            body.position.y = 0.55;
            // body.rotation.y = Math.PI / 2; // Removed to keep facing +Z
            parts.body = body;
            // Raccoon parts
            const torso = BABYLON.MeshBuilder.CreateBox("torso", { width: 0.25, height: 0.4, depth: 0.2 }, scene); torso.material = raccoonGrayMat; torso.parent = body; torso.convertToFlatShadedMesh(); shadowGenerator.addShadowCaster(torso);
            const belly = BABYLON.MeshBuilder.CreateBox("belly", { width: 0.18, height: 0.25, depth: 0.15 }, scene); belly.position.set(0, -0.05, 0.03); belly.material = raccoonLightMat; belly.parent = body;
            const neck = new BABYLON.TransformNode("neck", scene); neck.parent = body; neck.position.set(0, 0.28, 0); parts.neck = neck;
            const head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.22, height: 0.2, depth: 0.2 }, scene); head.material = raccoonLightMat; head.parent = neck; head.convertToFlatShadedMesh(); shadowGenerator.addShadowCaster(head);
            const mask = BABYLON.MeshBuilder.CreateBox("mask", { width: 0.24, height: 0.06, depth: 0.05 }, scene); mask.position.set(0, 0.02, 0.08); mask.material = blackMat; mask.parent = head;
            const eyeL = BABYLON.MeshBuilder.CreateBox("eyeL", { size: 0.03 }, scene); eyeL.position.set(-0.05, 0.02, 0.1); eyeL.material = createFlatMat("w", "#ffffff"); eyeL.parent = head; const eyeR = eyeL.clone("eyeR"); eyeR.position.x = 0.05; eyeR.parent = head;
            const snout = BABYLON.MeshBuilder.CreateBox("snout", { width: 0.08, height: 0.06, depth: 0.08 }, scene); snout.position.set(0, -0.04, 0.1); snout.material = raccoonLightMat; snout.parent = head;
            const nose = BABYLON.MeshBuilder.CreateBox("nose", { size: 0.035 }, scene); nose.position.set(0, -0.02, 0.14); nose.material = blackMat; nose.parent = head;
            const earL = BABYLON.MeshBuilder.CreateCylinder("earL", { height: 0.1, diameterTop: 0, diameterBottom: 0.07, tessellation: 3 }, scene); earL.position.set(-0.08, 0.12, 0); earL.material = raccoonGrayMat; earL.parent = head; earL.convertToFlatShadedMesh(); const earR = earL.clone("earR"); earR.position.x = 0.08; earR.parent = head;

            const createArm = (name, xPos) => {
                const shoulder = new BABYLON.TransformNode(name, scene); shoulder.parent = body; shoulder.position.set(xPos, 0.12, 0);
                const arm = BABYLON.MeshBuilder.CreateBox(name + "A", { width: 0.08, height: 0.25, depth: 0.08 }, scene); arm.position.y = -0.12; arm.material = raccoonGrayMat; arm.parent = shoulder; arm.convertToFlatShadedMesh();
                const hand = new BABYLON.TransformNode(name + "Hand", scene); hand.position.y = -0.28; hand.parent = shoulder;
                const handMesh = BABYLON.MeshBuilder.CreateBox(name + "H", { size: 0.06 }, scene); handMesh.material = blackMat; handMesh.parent = hand;
                return { shoulder, hand };
            };
            const armLData = createArm("armL", -0.18);
            const armRData = createArm("armR", 0.18);
            parts.armL = armLData.shoulder; parts.armR = armRData.shoulder; parts.rightHand = armRData.hand;

            // STAFF - Try -90 Z rotation to fix horizontal issue
            BABYLON.SceneLoader.ImportMeshAsync("", "./", "staff.glb", scene).then((result) => {
                const staff = result.meshes[0];
                staff.parent = parts.rightHand;
                staff.position.set(0, 0, 0); // Center in hand
                // If it looks horizontal, force it Vertical
                staff.rotationQuaternion = null;
                staff.rotation.set(Math.PI / 2, 0, 0); // Try 90 deg X rotation for vertical
                staff.scaling.setAll(0.4); // Back to normal size
                parts.armR.rotation.x = -1.2; // Arm extended forward
            });

            const createLeg = (name, xPos) => { const hip = new BABYLON.TransformNode(name, scene); hip.parent = body; hip.position.set(xPos, -0.2, 0); const leg = BABYLON.MeshBuilder.CreateBox(name + "L", { width: 0.1, height: 0.35, depth: 0.1 }, scene); leg.position.y = -0.18; leg.material = raccoonGrayMat; leg.parent = hip; leg.convertToFlatShadedMesh(); const foot = BABYLON.MeshBuilder.CreateBox(name + "F", { width: 0.12, height: 0.04, depth: 0.15 }, scene); foot.position.set(0, -0.38, 0.03); foot.material = blackMat; foot.parent = hip; return hip; };
            parts.legL = createLeg("legL", -0.08); parts.legR = createLeg("legR", 0.08);
            const tail = new BABYLON.TransformNode("tail", scene); tail.parent = body; tail.position.set(0, -0.15, -0.12); parts.tail = tail;
            for (let i = 0; i < 5; i++) { const ring = BABYLON.MeshBuilder.CreateBox("ring" + i, { width: 0.1 - i * 0.01, height: 0.08, depth: 0.1 - i * 0.01 }, scene); ring.position.set(0, -i * 0.08, 0); ring.material = (i % 2 === 0) ? raccoonGrayMat : raccoonLightMat; ring.parent = tail; }

        } else {
            // Chicken parts
            const body = new BABYLON.TransformNode("body", scene); body.parent = root; body.position.y = 0.45;
            body.rotation.y = -Math.PI / 2; // Rotate to face +Z
            parts.body = body;
            const torso = BABYLON.MeshBuilder.CreateBox("torso", { width: 0.35, height: 0.3, depth: 0.3 }, scene); torso.material = chickenWhiteMat; torso.parent = body; torso.convertToFlatShadedMesh(); shadowGenerator.addShadowCaster(torso);
            for (let i = 0; i < 3; i++) { const feather = BABYLON.MeshBuilder.CreateBox("feather" + i, { width: 0.02, height: 0.15, depth: 0.06 }, scene); feather.position.set(-0.18, 0.08 + i * 0.02, (i - 1) * 0.04); feather.rotation.z = -0.4; feather.material = chickenWhiteMat; feather.parent = body; }
            const neck = new BABYLON.TransformNode("neck", scene); neck.parent = body; neck.position.set(0.15, 0.12, 0); parts.neck = neck;
            const neckMesh = BABYLON.MeshBuilder.CreateBox("neckMesh", { width: 0.08, height: 0.12, depth: 0.08 }, scene); neckMesh.position.y = 0.05; neckMesh.material = chickenWhiteMat; neckMesh.parent = neck;
            const head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.14, height: 0.12, depth: 0.12 }, scene); head.position.y = 0.15; head.material = chickenWhiteMat; head.parent = neck; head.convertToFlatShadedMesh(); shadowGenerator.addShadowCaster(head);
            const comb = BABYLON.MeshBuilder.CreateBox("comb", { width: 0.1, height: 0.08, depth: 0.02 }, scene); comb.position.set(0, 0.1, 0); comb.material = combMat; comb.parent = head;
            const beak = BABYLON.MeshBuilder.CreateCylinder("beak", { height: 0.08, diameterTop: 0, diameterBottom: 0.05, tessellation: 3 }, scene); beak.rotation.z = -Math.PI / 2; beak.position.set(0.08, 0, 0); beak.material = beakMat; beak.parent = head; beak.convertToFlatShadedMesh();
            const wattle = BABYLON.MeshBuilder.CreateBox("wattle", { width: 0.03, height: 0.04, depth: 0.02 }, scene); wattle.position.set(0.05, -0.05, 0); wattle.material = combMat; wattle.parent = head;
            const eyeL = BABYLON.MeshBuilder.CreateBox("eyeL", { size: 0.025 }, scene); eyeL.position.set(0.04, 0.02, 0.04); eyeL.material = blackMat; eyeL.parent = head; const eyeR = eyeL.clone("eyeR"); eyeR.position.z = -0.04; eyeR.parent = head;
            const lWing = BABYLON.MeshBuilder.CreateBox("lWing", { width: 0.18, height: 0.12, depth: 0.03 }, scene); lWing.position.set(0, 0, 0.16); lWing.rotation.x = 0.2; lWing.material = chickenWhiteMat; lWing.parent = body; parts.lWing = lWing;
            const rWing = BABYLON.MeshBuilder.CreateBox("rWing", { width: 0.18, height: 0.12, depth: 0.03 }, scene); rWing.position.set(0, 0, -0.16); rWing.rotation.x = -0.2; rWing.material = chickenWhiteMat; rWing.parent = body; parts.rWing = rWing;
            const createLeg = (name, zPos) => { const hip = new BABYLON.TransformNode(name, scene); hip.parent = body; hip.position.set(0, -0.15, zPos); const leg = BABYLON.MeshBuilder.CreateBox(name + "L", { width: 0.03, height: 0.25, depth: 0.03 }, scene); leg.position.y = -0.12; leg.material = beakMat; leg.parent = hip; const foot = BABYLON.MeshBuilder.CreateBox(name + "F", { width: 0.1, height: 0.02, depth: 0.06 }, scene); foot.position.set(0.02, -0.25, 0); foot.material = beakMat; foot.parent = hip; return hip; };
            parts.legL = createLeg("legL", 0.08); parts.legR = createLeg("legR", -0.08);
        }
        return { root, parts, type, vy: 0, grounded: true, isSprinting: false };
    };

    const createAnimations = (monster) => {
        const fps = 60;
        const groups = {
            idle: new BABYLON.AnimationGroup("idle"),
            walk: new BABYLON.AnimationGroup("walk"),
            attack: new BABYLON.AnimationGroup("attack"),
            dodge: new BABYLON.AnimationGroup("dodge")
        };
        const anim = (prop, keys, loop = true) => {
            const a = new BABYLON.Animation("a", prop, fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, loop ? BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE : BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
            a.setKeys(keys); return a;
        };
        const p = monster.parts;

        if (monster.type === 'fox') {
            groups.idle.addTargetedAnimation(anim("scaling.y", [{ frame: 0, value: 1 }, { frame: 40, value: 1.02 }, { frame: 80, value: 1 }]), p.body);
            if (p.tail) groups.idle.addTargetedAnimation(anim("rotation.y", [{ frame: 0, value: -0.15 }, { frame: 40, value: 0.15 }, { frame: 80, value: -0.15 }]), p.tail);
            groups.walk.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: -0.4 }, { frame: 15, value: 0.4 }, { frame: 30, value: -0.4 }]), p.legFL);
            groups.walk.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0.4 }, { frame: 15, value: -0.4 }, { frame: 30, value: 0.4 }]), p.legFR);
            groups.walk.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0.4 }, { frame: 15, value: -0.4 }, { frame: 30, value: 0.4 }]), p.legBL);
            groups.walk.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: -0.4 }, { frame: 15, value: 0.4 }, { frame: 30, value: -0.4 }]), p.legBR);
            groups.walk.addTargetedAnimation(anim("position.y", [{ frame: 0, value: 0.45 }, { frame: 8, value: 0.48 }, { frame: 15, value: 0.45 }, { frame: 23, value: 0.48 }, { frame: 30, value: 0.45 }]), p.body);
            groups.attack.addTargetedAnimation(anim("position.z", [{ frame: 0, value: 0 }, { frame: 8, value: 0.25 }, { frame: 20, value: 0 }], false), p.body); // Lunge Z (Forward)
            // DODGE: Sprint (fast leg movement)
            groups.dodge.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: -0.8 }, { frame: 5, value: 0.8 }, { frame: 10, value: -0.8 }]), p.legFL);
            groups.dodge.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0.8 }, { frame: 5, value: -0.8 }, { frame: 10, value: 0.8 }]), p.legFR);
            groups.dodge.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0.8 }, { frame: 5, value: -0.8 }, { frame: 10, value: 0.8 }]), p.legBL);
            groups.dodge.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: -0.8 }, { frame: 5, value: 0.8 }, { frame: 10, value: -0.8 }]), p.legBR);

        } else if (monster.type === 'raccoon') {
            groups.idle.addTargetedAnimation(anim("scaling.y", [{ frame: 0, value: 1 }, { frame: 40, value: 1.02 }, { frame: 80, value: 1 }]), p.body);
            if (p.tail) groups.idle.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0 }, { frame: 40, value: 0.1 }, { frame: 80, value: 0 }]), p.tail);
            groups.walk.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: -0.4 }, { frame: 15, value: 0.4 }, { frame: 30, value: -0.4 }]), p.legL);
            groups.walk.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0.4 }, { frame: 15, value: -0.4 }, { frame: 30, value: 0.4 }]), p.legR);
            groups.walk.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0.3 }, { frame: 15, value: -0.3 }, { frame: 30, value: 0.3 }]), p.armL);
            // NO ARM R ANIMATION FOR WALK SO IT STAYS EXTENDED
            groups.walk.addTargetedAnimation(anim("position.y", [{ frame: 0, value: 0.55 }, { frame: 8, value: 0.58 }, { frame: 15, value: 0.55 }, { frame: 23, value: 0.58 }, { frame: 30, value: 0.55 }]), p.body);
            groups.attack.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: -1.2 }, { frame: 6, value: -0.5 }, { frame: 15, value: -1.2 }], false), p.armR); // Staff bash
            // DODGE: Roll - Positive rotation for Front Flip
            groups.dodge.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0 }, { frame: 20, value: Math.PI * 2 }], false), p.body);
            // Tuck head
            groups.dodge.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0 }, { frame: 10, value: 0.8 }, { frame: 20, value: 0 }], false), p.neck);
            // Tuck limbs - Ensure they tuck "in" (relative to body spin)
            // Left Arm/Leg
            groups.dodge.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0 }, { frame: 10, value: -1.5 }, { frame: 20, value: 0 }], false), p.legL);
            groups.dodge.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0 }, { frame: 10, value: -1.5 }, { frame: 20, value: 0 }], false), p.armL);
            // Right Leg
            groups.dodge.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0 }, { frame: 10, value: -1.5 }, { frame: 20, value: 0 }], false), p.legR);
            // Right Arm (holding staff) - tuck it too
            groups.dodge.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: -1.2 }, { frame: 10, value: -2.0 }, { frame: 20, value: -1.2 }], false), p.armR);

        } else {
            groups.idle.addTargetedAnimation(anim("position.y", [{ frame: 0, value: 0.45 }, { frame: 30, value: 0.43 }, { frame: 60, value: 0.45 }]), p.body);
            if (p.neck) groups.idle.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0 }, { frame: 20, value: 0.05 }, { frame: 40, value: -0.05 }, { frame: 60, value: 0 }]), p.neck);
            groups.walk.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: -0.35 }, { frame: 12, value: 0.35 }, { frame: 24, value: -0.35 }]), p.legL);
            groups.walk.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0.35 }, { frame: 12, value: -0.35 }, { frame: 24, value: 0.35 }]), p.legR);
            groups.walk.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0 }, { frame: 6, value: 0.15 }, { frame: 12, value: 0 }, { frame: 18, value: 0.15 }, { frame: 24, value: 0 }]), p.neck);
            groups.attack.addTargetedAnimation(anim("rotation.z", [{ frame: 0, value: 0 }, { frame: 4, value: 0.5 }, { frame: 8, value: 0 }, { frame: 12, value: 0.5 }, { frame: 16, value: 0 }, { frame: 20, value: 0.5 }, { frame: 24, value: 0 }], false), p.neck);
            if (p.lWing) groups.attack.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: 0.2 }, { frame: 8, value: -0.4 }, { frame: 16, value: 0.2 }, { frame: 24, value: 0.2 }], false), p.lWing);
            if (p.rWing) groups.attack.addTargetedAnimation(anim("rotation.x", [{ frame: 0, value: -0.2 }, { frame: 8, value: 0.4 }, { frame: 16, value: -0.2 }, { frame: 24, value: -0.2 }], false), p.rWing);
            // DODGE: Jump
            groups.dodge.addTargetedAnimation(anim("position.y", [{ frame: 0, value: 0.45 }, { frame: 10, value: 1.5 }, { frame: 20, value: 0.45 }], false), p.body);
        }
        return groups;
    };

    const resetPose = (monster) => {
        const p = monster.parts;
        if (p.legFL) p.legFL.rotation.set(0, 0, 0); if (p.legFR) p.legFR.rotation.set(0, 0, 0);
        if (p.legBL) p.legBL.rotation.set(0, 0, 0); if (p.legBR) p.legBR.rotation.set(0, 0, 0);
        if (p.legL) p.legL.rotation.set(0, 0, 0); if (p.legR) p.legR.rotation.set(0, 0, 0);
        if (p.armL) p.armL.rotation.set(0, 0, 0);
        if (p.armR && monster.type === 'raccoon') p.armR.rotation.set(-1.2, 0, 0);
        else if (p.armR) p.armR.rotation.set(0, 0, 0);
        if (p.neck) p.neck.rotation.set(0, 0, 0);
        if (p.lWing) p.lWing.rotation.set(0.2, 0, 0); if (p.rWing) p.rWing.rotation.set(-0.2, 0, 0);
        if (p.body) p.body.rotation.x = 0; // Reset body roll rotation
    };

    // --- REMOTE PLAYERS ---
    const createRemotePlayer = (data) => {
        // data: { id, type, x, y, z, ... }
        if (remotePlayers[data.id]) return;

        const m = createMonster(data.type);
        // Disable physics/collisions for remote
        m.root.checkCollisions = false;
        m.root.isPickable = false;

        m.root.position.set(data.x, data.y, data.z);
        if (data.rot) m.root.rotation.y = data.rot;

        // Apply Color
        let targetMat, originalHex;
        if (data.type === 'fox') { targetMat = foxOrangeMat; originalHex = "#ff6600"; }
        else if (data.type === 'raccoon') { targetMat = raccoonGrayMat; originalHex = "#555555"; }
        else { targetMat = chickenWhiteMat; originalHex = "#ffffee"; }

        // We need unique materials for remote players to color them independently?
        // For now, if we change the shared material, ALL remote foxes change color.
        // To fix this, we would need to clone materials. 
        // For this prototype, we'll Clone the material if a color is sent.
        if (data.color) {
            const newMat = targetMat.clone(data.id + "_mat");
            newMat.diffuseColor = BABYLON.Color3.FromHexString(data.color);
            // Assign to parts
            // This is tricky with the current builder. 
            // Simplification: We accept shared colors for now or apply to all parts manually.
            // Let's just create a name tag for now.
        }

        // Name Tag
        const plane = BABYLON.MeshBuilder.CreatePlane("nameplate", { width: 2, height: 1 }, scene);
        plane.parent = m.root;
        plane.position.y = 2.0;
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
        const advTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane);
        const text = new BABYLON.GUI.TextBlock();
        text.text = data.name || "Player";
        text.color = "white";
        text.fontSize = 70;
        text.outlineWidth = 4;
        text.outlineColor = "black";
        advTexture.addControl(text);

        const anims = createAnimations(m);
        // Start Idle
        anims.idle.play(true);

        remotePlayers[data.id] = {
            mesh: m,
            anims: anims,
            targetPos: new BABYLON.Vector3(data.x, data.y, data.z),
            targetRot: data.rot || 0,
            lastAction: 'idle'
        };
    };

    // --- SOCKET LISTENERS ---
    socket.on('init', (data) => {
        // data.players, data.suggestions, data.chatHistory
        for (const id in data.players) {
            if (id !== socket.id) createRemotePlayer(data.players[id]);
        }

        // Chat History
        const chatBox = document.getElementById("chat-history");
        chatBox.innerHTML = '';
        data.chatHistory.forEach(msg => appendChat(msg));

        // Suggestions
        const list = document.getElementById("suggestion-list");
        list.innerHTML = '';
        data.suggestions.forEach(s => appendSuggestion(s));
    });

    socket.on('playerJoined', (data) => createRemotePlayer(data));

    socket.on('playerMoved', (data) => {
        const p = remotePlayers[data.id];
        if (p) {
            p.targetPos.set(data.x, data.y, data.z);
            p.targetRot = data.rot;

            // Animation Sync
            if (data.action !== p.lastAction) {
                // Stop all
                p.anims.idle.stop(); p.anims.walk.stop(); p.anims.attack.stop(); p.anims.dodge.stop();

                if (data.action === 'walk') p.anims.walk.play(true);
                else if (data.action === 'attack') {
                    p.anims.attack.play(false);
                    p.anims.attack.onAnimationEndObservable.addOnce(() => {
                        if (p.lastAction === 'idle') p.anims.idle.play(true);
                    });
                }
                else if (data.action === 'dodge') p.anims.dodge.play(false);
                else p.anims.idle.play(true);

                p.lastAction = data.action;
            }
        }
    });

    socket.on('playerAttacked', (data) => {
        const p = remotePlayers[data.id];
        if (p) {
            // Visuals
            // We can reuse performAttack logic if we extract it or clone it
            // For now, simpler visual
        }
    });

    socket.on('playerLeft', (id) => {
        if (remotePlayers[id]) {
            remotePlayers[id].mesh.root.dispose();
            delete remotePlayers[id];
        }
    });

    socket.on('chatMessage', (msg) => appendChat(msg));

    const appendChat = (msg) => {
        const chatBox = document.getElementById("chat-history");
        const div = document.createElement("div");
        div.style.marginBottom = "4px";
        div.innerHTML = `<strong style="color: gold;">${msg.name}:</strong> ${msg.text}`;
        chatBox.appendChild(div);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    const appendSuggestion = (s) => {
        const list = document.getElementById("suggestion-list");
        const div = document.createElement("div");
        div.style.borderBottom = "1px solid #444";
        div.style.padding = "5px";
        div.style.fontSize = "0.9rem";
        div.textContent = `• ${s.text}`;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
    };

    socket.on('newSuggestion', (s) => appendSuggestion(s));

    socket.on('playerDamaged', (data) => {
        if (socket.id === data.id) {
            // We took damage!
            playerStats.health = data.health;
            updateHUD();
        } else if (remotePlayers[data.id]) {
            // Remote visual feedback (flash red)
        }
    });

    socket.on('playerDied', (data) => {
        if (socket.id === data.id) {
            document.getElementById("game-over-screen").style.display = 'flex';
            current.root.setEnabled(false);
        } else if (remotePlayers[data.id]) {
            // Remote death (mesh dispose or ragdoll)
            remotePlayers[data.id].mesh.root.setEnabled(false);
        }
    });

    socket.on('playerRespawned', (data) => {
        if (socket.id === data.id) {
            document.getElementById("game-over-screen").style.display = 'none';
            playerStats.health = 100;
            updateHUD();
            current.root.setEnabled(true);
            current.root.position.set(-3, 1, -3);
        } else if (remotePlayers[data.id]) {
            remotePlayers[data.id].mesh.root.setEnabled(true);
        }
    });


    // LOGIC
    let current, currentAnims, gameStarted = false, isCrafting = false;
    const pState = { act: 'idle' };
    const playerStats = { name: 'Fox', health: 100, maxHealth: 100, stamina: 100, maxStamina: 100, armor: 0, metals: 0, coal: 0, stones: 0 };
    const stones = [];
    const apples = [];

    // APPLE & FLOWER TEMPLATES
    let appleTemplate, flowerTemplate;
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "Apple.glb", scene).then((r) => {
        appleTemplate = r.meshes[0];
        appleTemplate.isVisible = false;
        appleTemplate.scaling.set(0.03, 0.03, 0.03);
        // Initial Apples
        for (let i = 0; i < 5; i++) spawnApple();
    });
    BABYLON.SceneLoader.ImportMeshAsync("", "./", "generic flower 3.glb", scene).then((r) => {
        flowerTemplate = r.meshes[0];
        flowerTemplate.isVisible = false;
        // Scatter Flowers
        for (let i = 0; i < 40; i++) {
            const x = (seededRandom() - 0.5) * 90;
            const z = (seededRandom() - 0.5) * 90;
            if (isValidPos(x, z, 1)) {
                const f = flowerTemplate.instantiateHierarchy();
                f.position.set(x, 0, z);
                f.scaling.set(2, 2, 2);
                f.rotation.y = seededRandom() * Math.PI * 2;
                f.setEnabled(true);
                shadowGenerator.addShadowCaster(f, true);
            }
        }
    });

    const spawnApple = () => {
        if (!appleTemplate || apples.length >= 10) return;
        // Find trees
        const trees = obstacles.filter(o => o.r === 3);
        if (trees.length === 0) return;
        const tree = trees[Math.floor(Math.random() * trees.length)];
        const ang = Math.random() * Math.PI * 2;
        const dist = 2 + Math.random() * 3;
        const x = tree.x + Math.cos(ang) * dist;
        const z = tree.z + Math.sin(ang) * dist;

        const a = appleTemplate.clone("apple");
        a.position.set(x, 0.0, z); // Ground Level
        a.isVisible = true;
        shadowGenerator.addShadowCaster(a, true);
        apples.push(a);
    };

    const spawnStone = () => {
        // Fallback Template if GLB hasn't loaded yet or failed
        if (!stoneTemplate) {
            const p = BABYLON.MeshBuilder.CreatePolyhedron("stoneF", { type: 1, size: 0.5 }, scene);
            p.isVisible = false;
            p.material = new BABYLON.StandardMaterial("sf", scene);
            p.material.diffuseColor = BABYLON.Color3.Gray();
            p.scaling.setAll(2.0);
            stoneTemplate = p;
        }

        if (stones.length >= 10) return;
        const s = stoneTemplate.clone("stone");
        s.isVisible = true;
        // Random pos with Overlap Check
        for (let i = 0; i < 15; i++) {
            const x = (Math.random() - 0.5) * 70;
            const z = (Math.random() - 0.5) * 70;
            if (isValidPos(x, z, 1.5)) {
                s.position.x = x;
                s.position.z = z;
                s.position.y = 0.1;
                // We don't push dynamic stones to obstacles to keep array small, or we could.
                // But preventing overlap with Static is most important.
                break;
            }
        }
        shadowGenerator.addShadowCaster(s, true);
        stones.push(s);
    };

    const updateHUD = () => {
        document.getElementById('hud-name').textContent = playerStats.name;
        document.getElementById('health-bar').style.width = (playerStats.health / playerStats.maxHealth * 100) + '%';
        document.getElementById('armor-bar').style.width = (playerStats.armor > 100 ? 100 : playerStats.armor) + '%';
        document.getElementById('stamina-bar').style.width = (playerStats.stamina / playerStats.maxStamina * 100) + '%';
        document.getElementById('val-metals').textContent = playerStats.metals;
        document.getElementById('val-coal').textContent = playerStats.coal;
        document.getElementById('val-stones').textContent = playerStats.stones;

        document.getElementById('wb-pebbles').textContent = playerStats.stones;
        document.getElementById('wb-metals').textContent = playerStats.metals;
    };

    const startGame = (type) => {
        document.getElementById("selection-screen").style.display = 'none';
        document.getElementById("hud").style.display = 'block';
        document.getElementById("minimap").style.display = 'block';
        document.getElementById("chatbox").style.display = 'block'; // Show Chat

        if (current) current.root.dispose();
        const m = createMonster(type);
        const a = createAnimations(m);
        current = m; currentAnims = a; gameStarted = true;
        if (type === 'fox') playerStats.name = 'Evander';
        else if (type === 'raccoon') playerStats.name = 'Papa';
        else if (type === 'chicken') playerStats.name = 'Leo';

        playerStats.health = 100; playerStats.stamina = 100; playerStats.armor = 0; playerStats.metals = 0; playerStats.coal = 0; playerStats.stones = 0;

        // Clear Apples
        apples.forEach(a => a.dispose());
        apples.length = 0;

        // Reset Stones
        stones.forEach(s => s.dispose());
        stones.length = 0;

        updateHUD();
        canvas.focus();

        // Socket Join
        socket.emit('join', {
            type: type,
            name: playerStats.name,
            x: -3, y: 1, z: -3,
            color: "original" // default
        });
    };

    document.getElementById("btn-fox").addEventListener("click", () => startGame("fox"));
    document.getElementById("btn-raccoon").addEventListener("click", () => startGame("raccoon"));
    document.getElementById("btn-chicken").addEventListener("click", () => startGame("chicken"));

    // UI Listeners
    document.getElementById("info-icon").addEventListener("click", () => document.getElementById("info-modal").style.display = 'block');
    document.getElementById("close-info").addEventListener("click", () => document.getElementById("info-modal").style.display = 'none');
    document.getElementById("close-color").addEventListener("click", () => document.getElementById("color-menu").style.display = 'none');
    document.getElementById("close-mailbox").addEventListener("click", () => document.getElementById("mailbox-menu").style.display = 'none');

    // Chat
    const chatInput = document.getElementById("chat-input");
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && chatInput.value.trim() !== "") {
            socket.emit('chat', chatInput.value.trim());
            chatInput.value = "";
        }
    });

    // Suggestion
    document.getElementById("btn-submit-suggestion").addEventListener("click", () => {
        const input = document.getElementById("suggestion-input");
        if (input.value.trim() !== "") {
            socket.emit('suggestion', input.value.trim());
            input.value = "";
        }
    });

    // Respawn
    document.getElementById("btn-respawn").addEventListener("click", () => {
        socket.emit('respawn');
    });

    // Debug Spawn Button
    const dbgBtn = document.getElementById("debug-spawn");
    dbgBtn.addEventListener("click", () => {
        if (!current) return;
        current.root.position.set(-3, 1, -3);
        current.vy = 0;
        dbgBtn.disabled = true;
        dbgBtn.textContent = "COOLDOWN...";
        setTimeout(() => {
            dbgBtn.disabled = false;
            dbgBtn.textContent = "RESET SPAWN";
        }, 10000); // 10s Cooldown
    });

    // WORKBENCH LISTENERS
    document.getElementById("close-workbench").addEventListener("click", () => {
        document.getElementById("workbench-menu").style.display = 'none';
        isCrafting = false;
    });

    // Crack Geode
    document.getElementById("btn-crack").addEventListener("click", () => {
        if (playerStats.stones <= 0) return;
        playerStats.stones--;
        updateHUD();

        // Visual Feedback
        const feedback = document.getElementById("loot-feedback");
        feedback.style.display = 'block';
        feedback.textContent = "🔨 Cracking open...";
        feedback.style.color = "white";

        const btnCrack = document.getElementById("btn-crack");
        btnCrack.disabled = true;

        setTimeout(() => {
            const r = Math.random();
            const wbPos = new BABYLON.Vector3(-8, 2, -8);

            if (r < 0.1) { // 10% Metal
                playerStats.metals++;
                feedback.textContent = "✨ SHINY METAL FOUND! ✨";
                feedback.style.color = "gold";
                // Particles
                const ps = new BABYLON.ParticleSystem("winP", 50, scene);
                ps.particleTexture = new BABYLON.Texture("./04.png", scene);
                ps.emitter = wbPos; ps.color1 = new BABYLON.Color4(1, 0.8, 0, 1); ps.color2 = new BABYLON.Color4(1, 1, 0, 1);
                ps.size = 0.5; ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0; ps.emitRate = 200; ps.targetStopDuration = 0.5; ps.start();
            } else if (r < 0.3) { // 20% Coal
                playerStats.coal++;
                feedback.textContent = "⚫ COAL LUMP FOUND.";
                feedback.style.color = "#333";
                // Particles
                const ps = new BABYLON.ParticleSystem("coalP", 30, scene);
                ps.particleTexture = new BABYLON.Texture("./04.png", scene);
                ps.emitter = wbPos; ps.color1 = new BABYLON.Color4(0.1, 0.1, 0.1, 1); ps.size = 0.4; ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0; ps.emitRate = 100; ps.targetStopDuration = 0.3; ps.start();
            } else { // 70% Nothing
                feedback.textContent = "💨 Dust... Empty.";
                feedback.style.color = "#aaaaaa";
                // Particles
                const ps = new BABYLON.ParticleSystem("lossP", 30, scene);
                ps.particleTexture = new BABYLON.Texture("./04.png", scene);
                ps.emitter = wbPos; ps.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 1); ps.size = 0.3; ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0; ps.emitRate = 100; ps.targetStopDuration = 0.3; ps.start();
            }
            updateHUD();
            btnCrack.disabled = false;

            setTimeout(() => { feedback.style.display = 'none'; }, 2000);
        }, 1500);
    });

    // Craft Fox Armor
    document.getElementById("btn-craft-fox").addEventListener("click", () => {
        if (playerStats.metals < 2) return;
        playerStats.metals -= 2;
        playerStats.armor = 100;
        updateHUD();
        changeColor("#C0C0C0"); // Silver
    });

    // Craft Raccoon Shield
    document.getElementById("btn-craft-raccoon").addEventListener("click", () => {
        if (playerStats.metals < 2) return;
        playerStats.metals -= 2;
        playerStats.armor = 100;
        updateHUD();
        // Bubble
        const bubble = BABYLON.MeshBuilder.CreateSphere("bubble", { diameter: 2.5 }, scene);
        bubble.parent = current.root;
        bubble.position.y = 1;
        const mat = new BABYLON.StandardMaterial("bMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.5, 0.8, 1);
        mat.alpha = 0.4;
        bubble.material = mat;
    });

    // Craft Chicken Rage
    document.getElementById("btn-craft-chicken").addEventListener("click", () => {
        if (playerStats.metals < 2) return;
        playerStats.metals -= 2;
        playerStats.armor = 100;
        updateHUD();
        current.root.scaling.setAll(2.0); // Size 2x
        changeColor("#FF0000"); // Red
    });

    // WORKBENCH LISTENERS
    document.getElementById("close-workbench").addEventListener("click", () => {
        document.getElementById("workbench-menu").style.display = 'none';
        isCrafting = false;
    });

    // Crack Geode
    document.getElementById("btn-crack").addEventListener("click", () => {
        if (playerStats.stones <= 0) return;
        playerStats.stones--;
        updateHUD();

        // Visual Feedback (Lootbox)
        const feedback = document.getElementById("loot-feedback");
        feedback.style.display = 'block';
        feedback.textContent = "🔨 Cracking open...";
        feedback.style.color = "white";

        const btnCrack = document.getElementById("btn-crack");
        btnCrack.disabled = true;

        setTimeout(() => {
            const r = Math.random();
            const wbPos = new BABYLON.Vector3(-8, 2, -8);

            if (r < 0.1) { // 10% Metal
                playerStats.metals++;
                feedback.textContent = "✨ SHINY METAL FOUND! ✨";
                feedback.style.color = "gold";
                // Particles...
                const ps = new BABYLON.ParticleSystem("winP", 50, scene);
                ps.particleTexture = new BABYLON.Texture("./04.png", scene);
                ps.emitter = wbPos; ps.color1 = new BABYLON.Color4(1, 0.8, 0, 1); ps.color2 = new BABYLON.Color4(1, 1, 0, 1);
                ps.size = 0.5; ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0; ps.emitRate = 200; ps.targetStopDuration = 0.5; ps.start();
            } else if (r < 0.3) { // 20% Coal
                playerStats.coal++;
                feedback.textContent = "⚫ COAL LUMP FOUND.";
                feedback.style.color = "#333";
                // Particles...
                const ps = new BABYLON.ParticleSystem("coalP", 30, scene);
                ps.particleTexture = new BABYLON.Texture("./04.png", scene);
                ps.emitter = wbPos; ps.color1 = new BABYLON.Color4(0.1, 0.1, 0.1, 1); ps.size = 0.4; ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0; ps.emitRate = 100; ps.targetStopDuration = 0.3; ps.start();
            } else { // 70% Nothing
                feedback.textContent = "💨 Dust... Empty.";
                feedback.style.color = "#aaaaaa";
                // Particles...
                const ps = new BABYLON.ParticleSystem("lossP", 30, scene);
                ps.particleTexture = new BABYLON.Texture("./04.png", scene);
                ps.emitter = wbPos; ps.color1 = new BABYLON.Color4(0.5, 0.5, 0.5, 1); ps.size = 0.3; ps.minLifeTime = 0.5; ps.maxLifeTime = 1.0; ps.emitRate = 100; ps.targetStopDuration = 0.3; ps.start();
            }
            updateHUD();
            btnCrack.disabled = false;

            setTimeout(() => { feedback.style.display = 'none'; }, 2000);
        }, 1500);
    });

    // Craft Fox Armor
    document.getElementById("btn-craft-fox").addEventListener("click", () => {
        if (playerStats.metals < 2) return;
        playerStats.metals -= 2;
        playerStats.armor = 100;
        updateHUD();
        // Visual
        changeColor("#C0C0C0"); // Silver
    });

    // Craft Raccoon Shield
    document.getElementById("btn-craft-raccoon").addEventListener("click", () => {
        if (playerStats.metals < 2) return;
        playerStats.metals -= 2;
        playerStats.armor = 100;
        updateHUD();
        // Visual Bubble
        const bubble = BABYLON.MeshBuilder.CreateSphere("bubble", { diameter: 2.5 }, scene);
        bubble.parent = current.root;
        bubble.position.y = 1;
        const mat = new BABYLON.StandardMaterial("bMat", scene);
        mat.diffuseColor = new BABYLON.Color3(0.5, 0.8, 1);
        mat.alpha = 0.4;
        bubble.material = mat;
    });

    // Craft Chicken Rage
    document.getElementById("btn-craft-chicken").addEventListener("click", () => {
        if (playerStats.metals < 2) return;
        playerStats.metals -= 2;
        playerStats.armor = 100;
        updateHUD();
        // Visual Rage
        current.root.scaling.setAll(2.0); // Twice size
        changeColor("#FF0000"); // Red
    });

    document.querySelectorAll(".color-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const color = e.target.getAttribute("data-color");
            changeColor(color);
            document.getElementById("color-menu").style.display = 'none';
        });
    });

    const changeColor = (color) => {
        if (!current) return;

        // Determine target material based on type
        let targetMat;
        let originalHex;

        if (current.type === 'fox') { targetMat = foxOrangeMat; originalHex = "#ff6600"; }
        else if (current.type === 'raccoon') { targetMat = raccoonGrayMat; originalHex = "#555555"; }
        else { targetMat = chickenWhiteMat; originalHex = "#ffffee"; }

        if (targetMat) {
            if (color === 'original') {
                targetMat.diffuseColor = BABYLON.Color3.FromHexString(originalHex);
                socket.emit('updateColor', originalHex);
            } else {
                targetMat.diffuseColor = BABYLON.Color3.FromHexString(color);
                socket.emit('updateColor', color);
            }
        }
    };

    const performAttack = () => {
        if (!current) return;
        const origin = current.root.position.clone();
        origin.y += 0.5;
        const forward = current.root.forward;

        socket.emit('attack', { type: current.type, origin: origin, direction: forward });

        const checkHit = (pos, range, dmg) => {
            for (const id in remotePlayers) {
                const p = remotePlayers[id];
                if (p.mesh.root.isEnabled() && BABYLON.Vector3.Distance(pos, p.mesh.root.position) < range) {
                    socket.emit('damage', { targetId: id, amount: dmg });
                    return true; // Hit one
                }
            }
            return false;
        };

        if (current.type === 'raccoon') {
            // Pellet View
            const pellet = BABYLON.MeshBuilder.CreateSphere("pellet", { diameter: 0.2 }, scene);
            pellet.position = origin.add(forward.scale(0.5));
            pellet.material = new BABYLON.StandardMaterial("pMat", scene);
            pellet.material.diffuseColor = new BABYLON.Color3(0.5, 0, 0.5); // Purple

            // Animate pellet
            let frames = 0;
            const obs = scene.onBeforeRenderObservable.add(() => {
                if (frames++ > 60) { pellet.dispose(); scene.onBeforeRenderObservable.remove(obs); return; }
                pellet.position.addInPlace(forward.scale(0.4));
                if (checkHit(pellet.position, 1.0, 25)) {
                    pellet.dispose(); scene.onBeforeRenderObservable.remove(obs);
                }
            });
        }
        else if (current.type === 'chicken') {
            // Egg Bomb
            const egg = BABYLON.MeshBuilder.CreateSphere("egg", { diameter: 0.25, segments: 8 }, scene);
            egg.scaling.y = 1.3;
            egg.position = origin.add(forward.scale(0.5));
            egg.material = new BABYLON.StandardMaterial("eggMat", scene);
            egg.material.diffuseColor = new BABYLON.Color3(1, 1, 0.9);

            let vel = forward.scale(0.15).add(new BABYLON.Vector3(0, 0.2, 0));
            const g = new BABYLON.Vector3(0, -0.015, 0);

            const obs = scene.onBeforeRenderObservable.add(() => {
                egg.position.addInPlace(vel);
                vel.addInPlace(g);
                if (egg.position.y <= 0.2) {
                    scene.onBeforeRenderObservable.remove(obs);
                    egg.dispose();
                    // Explosion Effect
                    const boom = BABYLON.MeshBuilder.CreateSphere("boom", { diameter: 2 }, scene);
                    boom.position.copyFrom(egg.position);
                    boom.material = new BABYLON.StandardMaterial("bMat", scene);
                    boom.material.diffuseColor = BABYLON.Color3.Red();
                    boom.material.alpha = 0.5;
                    let f = 0;
                    scene.onBeforeRenderObservable.add(() => {
                        if (f++ > 10) boom.dispose();
                        boom.scaling.scaleInPlace(1.1);
                        boom.material.alpha -= 0.05;
                    });

                    checkHit(egg.position, 3.0, 20); // AoE
                }
            });
        }
        else {
            // Fox Bite (Immediate)
            checkHit(origin.add(forward.scale(1.0)), 2.0, 35);
        }
    };

    const inputs = {};
    scene.actionManager = new BABYLON.ActionManager(scene);
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, e => inputs[e.sourceEvent.key.toLowerCase()] = true));
    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, e => inputs[e.sourceEvent.key.toLowerCase()] = false));

    // Key Handling
    let isSprinting = false;

    // Shift Key Logic (Sprint / Dodge / Jump)
    scene.onKeyboardObservable.add((kbInfo) => {
        if (!gameStarted) return;
        const key = kbInfo.event.key;
        if (key === "Shift") {
            if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
                if (current.type === 'fox') {
                    if (playerStats.stamina > 0) isSprinting = true;
                } else if (current.type === 'raccoon') {
                    // One-shot Dodge Roll (Cost 15)
                    if (pState.act !== 'dodge' && pState.act !== 'attack' && playerStats.stamina >= 15) {
                        playerStats.stamina -= 15; updateHUD();
                        pState.act = 'dodge';
                        currentAnims.idle.stop(); currentAnims.walk.stop();
                        currentAnims.dodge.play(false);
                        currentAnims.dodge.onAnimationEndObservable.addOnce(() => {
                            pState.act = 'idle'; resetPose(current); currentAnims.idle.play(true);
                        });
                    }
                } else if (current.type === 'chicken') {
                    // High Jump
                    if (current.grounded && playerStats.stamina >= 20) {
                        playerStats.stamina -= 20;
                        current.vy = 0.5; // Chicken Jump Cost 2x (was 0.6)
                        current.grounded = false;
                    }
                } else { // General Jump
                    if (current.grounded && playerStats.stamina >= 10) {
                        playerStats.stamina -= 10;
                        current.vy = 0.3;
                        current.grounded = false;
                    }
                }
                updateHUD();
            } else if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
                if (current.type === 'fox') isSprinting = false;
            }
        }
    });

    scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, e => {
        if (!gameStarted || e.sourceEvent.code !== "Space") return;
        if (pState.act !== 'dodge' && pState.act !== 'attack') {
            currentAnims.walk.stop(); currentAnims.idle.stop(); resetPose(current);
            currentAnims.attack.play(false); pState.act = 'attack';

            performAttack();
            currentAnims.attack.onAnimationEndObservable.addOnce(() => {
                pState.act = 'idle'; resetPose(current); currentAnims.idle.play(true);
            });
        }
    }));

    scene.onBeforeRenderObservable.add(() => {
        // Remote Interpolation
        for (const id in remotePlayers) {
            const p = remotePlayers[id];
            p.mesh.root.position = BABYLON.Vector3.Lerp(p.mesh.root.position, p.targetPos, 0.1);
            p.mesh.root.rotation.y = p.targetRot; // Rotation snap for responsiveness
        }

        if (!gameStarted || !current) return;

        // Stamina Regen (only if not sprinting)
        if (!isSprinting && pState.act !== 'dodge' && playerStats.stamina < 100) {
            playerStats.stamina += 0.2;
            if (playerStats.stamina > 100) playerStats.stamina = 100;
            updateHUD();
        }



        // Stone Spawn & Pickup
        if (stones.length < 10) spawnStone();
        if (apples.length < 10) spawnApple();

        stones.forEach((s, i) => {
            // Rotate
            s.rotation.y += 0.02;
            if (s.intersectsMesh(current.root, false)) {
                s.dispose();
                stones.splice(i, 1);
                playerStats.stones++;
                updateHUD();
            }
        });

        // Interaction System
        let closestDist = 3; // Interact range
        let interactType = null;
        let interactObj = null;

        const pos = current.root.position;

        // Check Static
        const dCamp = BABYLON.Vector3.Distance(pos, new BABYLON.Vector3(0, 0, 0));
        if (dCamp < closestDist) { closestDist = dCamp; interactType = 'camp'; }

        const dWork = BABYLON.Vector3.Distance(pos, new BABYLON.Vector3(-8, 0, -8));
        if (dWork < closestDist) { closestDist = dWork; interactType = 'work'; }

        const dPost = BABYLON.Vector3.Distance(pos, new BABYLON.Vector3(5, 0, 5));
        if (dPost < closestDist) { closestDist = dPost; interactType = 'post'; }

        const dEnter = BABYLON.Vector3.Distance(pos, new BABYLON.Vector3(10, 0, -14));
        if (dEnter < 2) { closestDist = dEnter; interactType = 'enter'; } // Closer check for portal

        // Check Apples
        apples.forEach(a => {
            const d = BABYLON.Vector3.Distance(pos, a.position);
            if (d < 2 && d < closestDist) {
                closestDist = d;
                interactType = 'apple';
                interactObj = a;
            }
        });

        const prompt = document.getElementById("interact-prompt");

        if (interactType) {
            prompt.style.display = 'block';
            if (interactType === 'camp') {
                prompt.querySelector("p").textContent = "PRESS 'E' TO CHANGE COLOR";
                if (inputs['e']) {
                    document.getElementById("color-menu").style.display = 'block';
                    prompt.style.display = 'none';
                    inputs['e'] = false;
                }
            } else if (interactType === 'work') {
                prompt.querySelector("p").textContent = "PRESS 'E' TO CRAFT";
                if (inputs['e']) {
                    document.getElementById('workbench-menu').style.display = 'block';
                    document.getElementById('btn-craft-fox').style.display = (current.type === 'fox') ? 'block' : 'none';
                    document.getElementById('btn-craft-raccoon').style.display = (current.type === 'raccoon') ? 'block' : 'none';
                    document.getElementById('btn-craft-chicken').style.display = (current.type === 'chicken') ? 'block' : 'none';
                    updateHUD();
                    isCrafting = true;
                    prompt.style.display = 'none';
                    inputs['e'] = false;
                }
            } else if (interactType === 'post') {
                prompt.querySelector("p").textContent = "PRESS 'E' TO CHECK MAIL";
                if (inputs['e']) {
                    document.getElementById("mailbox-menu").style.display = 'block';
                    prompt.style.display = 'none';
                    inputs['e'] = false;
                }
            } else if (interactType === 'enter') {
                prompt.querySelector("p").textContent = "PRESS 'E' TO ENTER";
                if (inputs['e']) {
                    current.root.position.set(1000, 0.5, 1000);
                    current.vy = 0;
                    inputs['e'] = false;
                }
            } else if (interactType === 'apple') {
                prompt.querySelector("p").textContent = "PRESS 'E' TO EAT APPLE (+25 HP)";
                if (inputs['e']) {
                    if (playerStats.health < playerStats.maxHealth) {
                        playerStats.health += 25;
                        if (playerStats.health > playerStats.maxHealth) playerStats.health = playerStats.maxHealth;
                        updateHUD();
                        // Eat Visual
                        interactObj.dispose();
                        apples.splice(apples.indexOf(interactObj), 1);
                    } else {
                        // Full health feedback
                        const feedback = document.getElementById("loot-feedback");
                        feedback.style.display = 'block';
                        feedback.textContent = "Health is full!";
                        feedback.style.color = "#ff5555";
                        setTimeout(() => feedback.style.display = 'none', 1000);
                    }
                    inputs['e'] = false;
                }
            }
        } else {
            prompt.style.display = 'none';
            document.getElementById("color-menu").style.display = 'none';
        }

        let dx = 0, dz = 0;
        if (inputs['w']) dz = 1; if (inputs['s']) dz = -1;
        if (inputs['a']) dx = -1; if (inputs['d']) dx = 1;

        const moving = dx !== 0 || dz !== 0;

        // Sprint Drain (Fox) - Moved here safely
        if (isSprinting && current.type === 'fox' && moving) {
            playerStats.stamina -= 0.8; // Faster drain (was 0.5)
            if (playerStats.stamina <= 0) { playerStats.stamina = 0; isSprinting = false; }
            updateHUD();
        }

        let speed = 0.1;

        // Dodge Speed
        // Speeds
        if (current.type === 'fox' && isSprinting) speed = 0.3;
        else if (current.type === 'raccoon' && pState.act === 'dodge') speed = 0.3; // 1.5x roll speed (was 0.2)

        if ((moving && pState.act !== 'attack') || pState.act === 'dodge') {
            const v = new BABYLON.Vector3(dx, 0, dz);
            if (pState.act === 'dodge' && current.type === 'raccoon') {
                // Roll direction: match INPUT direction if moving, otherwise forward
                if (moving) v.normalize().scaleInPlace(speed);
                else {
                    // If idle and dodging, roll forward relative to camera/model
                    // But simpler: just use model forward
                    const forward = current.root.forward;
                    v.set(forward.x, 0, forward.z).normalize().scaleInPlace(speed);
                }
                // Ensure we also rotate the root to face the roll direction immediately if inputting
                if (moving) current.root.rotation.y = Math.atan2(dx, dz);
            } else {
                if (moving) v.normalize().scaleInPlace(speed);
                else v.set(0, 0, 0);
            }

            // Add Gravity!
            // Physics / Jump Logic
            if (current.type === 'chicken') current.vy -= 0.015; // Glide Gravity (slower fall)
            else current.vy -= 0.04; // Normal Gravity

            // Ground Check (Simple)
            if (current.root.position.y <= 1.05 && current.vy < 0) {
                current.vy = 0;
                current.grounded = true;
                // keep Y at ground 
            } else {
                if (current.root.position.y > 1.1) current.grounded = false;
            }

            v.y = current.vy;

            current.root.moveWithCollisions(v);

            // Rotation
            if (moving && (pState.act !== 'dodge' || current.type === 'fox')) {
                current.root.rotation.y = Math.atan2(dx, dz);
            }

            // Emit Move
            socket.emit('move', {
                x: current.root.position.x,
                y: current.root.position.y,
                z: current.root.position.z,
                rot: current.root.rotation.y,
                action: pState.act
            });

            // Clamp (Only if in main world)
            if (current.root.position.x < 100 && current.root.position.x > -100) {
                const limit = 38;
                if (current.root.position.x < -limit) current.root.position.x = -limit;
                if (current.root.position.x > limit) current.root.position.x = limit;
                if (current.root.position.z < -limit) current.root.position.z = -limit;
                if (current.root.position.z > limit) current.root.position.z = limit;
            }

            if (pState.act === 'idle') {
                pState.act = 'walk';
                currentAnims.idle.stop();
                currentAnims.walk.play(true);
            }
        } else if (!moving && pState.act === 'walk') {
            pState.act = 'idle';
            currentAnims.walk.stop();
            resetPose(current);
            currentAnims.idle.play(true);
        } else {
            // Idle Gravity
            current.root.moveWithCollisions(new BABYLON.Vector3(0, -0.5, 0));
        }

        camera.target.x = current.root.position.x;
        camera.target.z = current.root.position.z;
        camera.target.y = current.root.position.y + 0.5;

        // Camera Logic for Interior
        if (current.root.position.x > 500) {
            // Interior
            camera.upperRadiusLimit = 6; // Force close zoom
            if (camera.radius > 6) camera.radius = 6;
        } else {
            camera.upperRadiusLimit = 20;
        }

        // Update CSS minimap dot position
        const mapSize = 40; // Map bounds -40 to +40
        const mmSize = 180; // CSS minimap size in pixels
        const dotX = ((current.root.position.x + mapSize) / (mapSize * 2)) * mmSize;
        const dotZ = ((current.root.position.z + mapSize) / (mapSize * 2)) * mmSize;
        const dot = document.getElementById("minimap-dot");
        if (dot) {
            dot.style.left = dotX + "px";
            dot.style.top = (mmSize - dotZ) + "px";
        }
        const coords = document.getElementById("coords");
        if (coords) coords.textContent = `X: ${Math.round(current.root.position.x)} Z: ${Math.round(current.root.position.z)}`;
    });

    return scene;
};

const scene = createScene();
engine.runRenderLoop(() => { scene.render(); });
window.addEventListener('resize', () => { engine.resize(); });

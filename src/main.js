import * as THREE from "three";
import "./style.css";
import { createTerrain } from "./world/Terrain.js";
import { createEnvironment } from "./world/Environment.js";
import { createWater } from "./world/Water.js";

// =====================================================
// SCENE
// =====================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x9bbbd0);
scene.fog = new THREE.FogExp2(0x9bbbd0, 0.0045);

// =====================================================
// CAMERA
// =====================================================

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1500
);

camera.position.set(34, 42, 48);

// =====================================================
// RENDERER
// =====================================================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

// =====================================================
// LIGHTING
// =====================================================

const hemi = new THREE.HemisphereLight(
    0xcfe8ff,
    0x364525,
    2.2
);

scene.add(hemi);

const sun = new THREE.DirectionalLight(
    0xffe0ad,
    2.3
);

sun.position.set(
    100,
    150,
    50
);

sun.castShadow = true;

scene.add(sun);

// =====================================================
// 3D TERRAIN
// =====================================================

const terrain = createTerrain();
scene.add(terrain);

const environment = createEnvironment();
scene.add(environment);

const water = createWater();
scene.add(water.group);


// =====================================================
// PLAYER
// =====================================================

const player =
    new THREE.Group();

const body =
    new THREE.Mesh(

        new THREE.CapsuleGeometry(
            0.8,
            2,
            6,
            12
        ),

        new THREE.MeshStandardMaterial({
            color: 0x252933,
            metalness: 0.5,
            roughness: 0.4
        })
    );

body.position.y =
    1.8;

body.castShadow =
    true;

player.add(body);

// sword
const sword =
    new THREE.Mesh(

        new THREE.BoxGeometry(
            0.15,
            2.6,
            0.15
        ),

        new THREE.MeshStandardMaterial({
            color: 0xdde5ec,
            metalness: 1,
            roughness: 0.2
        })
    );

sword.position.set(
    0.8,
    1.5,
    0
);

sword.rotation.z =
    -0.35;

player.add(sword);

player.position.set(
    0,
    3,
    45
);

scene.add(player);

// =====================================================
// INPUT
// =====================================================
// =====================================================

const keys = {};

window.addEventListener(
    "keydown",
    e => {

        keys[
            e.key.toLowerCase()
        ] = true;
    }
);

window.addEventListener(
    "keyup",
    e => {

        keys[
            e.key.toLowerCase()
        ] = false;
    }
);

// =====================================================
// PLAYER MOVEMENT
// =====================================================

function updatePlayer() {

    let dx = 0;
    let dz = 0;

    const speed =
        keys["shift"]
            ? 0.38
            : 0.20;

    if (keys["w"])
        dz -= speed;

    if (keys["s"])
        dz += speed;

    if (keys["a"])
        dx -= speed;

    if (keys["d"])
        dx += speed;

    player.position.x += dx;
    player.position.z += dz;

    if (
        dx !== 0 ||
        dz !== 0
    ) {

        player.rotation.y =
            Math.atan2(
                dx,
                dz
            );
    }
}

// =====================================================
// CAMERA FOLLOW
// =====================================================

const cameraOffset =
    new THREE.Vector3(
        20,
        24,
        26
    );

function updateCamera() {

    const targetPosition =
        player.position
            .clone()
            .add(
                cameraOffset
            );

    camera.position.lerp(
        targetPosition,
        0.06
    );

    camera.lookAt(
        player.position.x,
        player.position.y + 2,
        player.position.z
    );
}

// =====================================================
// GAME LOOP
// =====================================================

const clock = new THREE.Clock();

function animate() {

    requestAnimationFrame(
        animate
    );

    const delta = clock.getDelta();
    water.update(delta);

    updatePlayer();

    updateCamera();

    renderer.render(
        scene,
        camera
    );
}

animate();

// =====================================================
// RESIZE
// =====================================================

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            window.innerWidth /
            window.innerHeight;

        camera.updateProjectionMatrix();

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);

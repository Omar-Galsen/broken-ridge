import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import "./style.css";
import { createTerrain, terrainHeight } from "./world/Terrain.js";
import { createEnvironment } from "./world/Environment.js";
import { createWater } from "./world/Water.js";

// =====================================================
// SCENE
// =====================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x9bbbd0);
scene.fog = new THREE.FogExp2(0x9bbbd0, 0.0033);

// =====================================================
// CAMERA
// =====================================================

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1500
);

camera.position.set(34, 44, 60);

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
// MAP EDITOR
// =====================================================

let editMode = false;
let selectedItem = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode("translate");
transformControls.setSize(0.8);

const transformHelper = transformControls.getHelper();
scene.add(transformHelper);

transformControls.addEventListener("dragging-changed", (event) => {
    renderer.domElement.style.cursor = event.value ? "grabbing" : "crosshair";
});

const editorPanel = document.createElement("div");
editorPanel.style.cssText = [
    "position:fixed",
    "top:12px",
    "left:12px",
    "z-index:1000",
    "background:rgba(10,12,16,.88)",
    "color:#fff",
    "font:13px/1.45 monospace",
    "padding:10px 12px",
    "border:1px solid rgba(255,255,255,.2)",
    "border-radius:8px",
    "display:none",
    "pointer-events:none",
    "white-space:pre"
].join(";");
document.body.appendChild(editorPanel);

const editorToggle = document.createElement("button");
editorToggle.textContent = "Edit Map (E)";
editorToggle.style.cssText = [
    "position:fixed",
    "top:12px",
    "right:12px",
    "z-index:1001",
    "padding:9px 12px",
    "border-radius:8px",
    "border:1px solid rgba(255,255,255,.25)",
    "background:rgba(10,12,16,.88)",
    "color:#fff",
    "font:13px monospace",
    "cursor:pointer"
].join(";");
document.body.appendChild(editorToggle);

function setEditMode(enabled) {
    editMode = enabled;

    if (!editMode) {
        selectEditable(null);
        renderer.domElement.style.cursor = "default";
        editorToggle.textContent = "Edit Map (E)";
    } else {
        renderer.domElement.style.cursor = "crosshair";
        editorToggle.textContent = "Exit Edit (E)";
    }

    refreshEditorPanel();
}

editorToggle.addEventListener("click", () => {
    setEditMode(!editMode);
});

function refreshEditorPanel() {
    if (!editMode) {
        editorPanel.style.display = "none";
        return;
    }

    editorPanel.style.display = "block";

    const p = selectedItem?.position;
    const r = selectedItem?.rotation;
    const s = selectedItem?.scale;

    editorPanel.textContent = selectedItem
        ? `EDIT MODE
Selected: ${selectedItem.userData.itemId}
Type: ${selectedItem.userData.itemType}
Position: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}
Rotation: ${r.x.toFixed(2)}, ${r.y.toFixed(2)}, ${r.z.toFixed(2)}
Scale: ${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)}

Click = select
1 = move   2 = rotate   3 = scale
G = snap Y to terrain
P = export JSON
E = exit editor`
        : `EDIT MODE
Click an object to select it.

1 = move   2 = rotate   3 = scale
P = export JSON
E = exit editor`;
}

function editableRoot(object) {
    let current = object;

    while (current && current !== environment) {
        if (current.userData?.editable) return current;
        current = current.parent;
    }

    return null;
}

function selectEditable(object) {
    selectedItem = object;
    transformControls.detach();

    if (selectedItem) {
        transformControls.attach(selectedItem);
    }

    refreshEditorPanel();
}

function snapSelectedToTerrain() {
    if (!selectedItem) return;

    const box = new THREE.Box3().setFromObject(selectedItem);
    const baseOffset = box.min.y - selectedItem.position.y;

    selectedItem.position.y =
        terrainHeight(selectedItem.position.x, selectedItem.position.z) -
        baseOffset - 0.08;

    selectedItem.updateMatrixWorld(true);
    refreshEditorPanel();
}

function exportLayoutJSON() {
    const items = [];

    environment.traverse((object) => {
        if (!object.userData?.editable) return;

        items.push({
            id: object.userData.itemId,
            type: object.userData.itemType,
            position: {
                x: Number(object.position.x.toFixed(4)),
                y: Number(object.position.y.toFixed(4)),
                z: Number(object.position.z.toFixed(4))
            },
            rotation: {
                x: Number(object.rotation.x.toFixed(4)),
                y: Number(object.rotation.y.toFixed(4)),
                z: Number(object.rotation.z.toFixed(4))
            },
            scale: {
                x: Number(object.scale.x.toFixed(4)),
                y: Number(object.scale.y.toFixed(4)),
                z: Number(object.scale.z.toFixed(4))
            },
            grounding: object.userData.grounding ?? null
        });
    });

    const layout = {
        format: "broken-ridge-layout-v1",
        exportedAt: new Date().toISOString(),
        itemCount: items.length,
        items
    };

    const blob = new Blob(
        [JSON.stringify(layout, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "broken-ridge-layout.json";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return layout;
}

window.exportBrokenRidgeLayout = exportLayoutJSON;

renderer.domElement.addEventListener("pointerdown", (event) => {
    if (!editMode || transformControls.dragging) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(environment, true);

    for (const hit of hits) {
        const root = editableRoot(hit.object);
        if (root) {
            selectEditable(root);
            return;
        }
    }

    selectEditable(null);
});


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
    terrainHeight(0, 45) + 1.8,
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

        const key = e.key.toLowerCase();

        if (key === "e") {
            setEditMode(!editMode);
            return;
        }

        if (editMode) {
            if (key === "1") transformControls.setMode("translate");
            if (key === "2") transformControls.setMode("rotate");
            if (key === "3") transformControls.setMode("scale");
            if (key === "g") snapSelectedToTerrain();
            if (key === "p") exportLayoutJSON();

            refreshEditorPanel();
            return;
        }

        keys[key] = true;
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

    if (editMode) return;

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

    player.position.y = terrainHeight(player.position.x, player.position.z) + 1.8;

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
        25,
        34
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
        player.position.y + 4,
        player.position.z - 12
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

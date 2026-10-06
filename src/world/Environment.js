import * as THREE from "three";

const loader = new THREE.TextureLoader();

function configureTexture(texture, repeatX, repeatY, srgb = false) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function loadPBRMaterial(basePath, fallbackColor, repeatX = 4, repeatY = 4, options = {}) {
    const material = new THREE.MeshStandardMaterial({
        color: fallbackColor,
        roughness: options.roughness ?? 0.9,
        metalness: 0
    });

    const name = basePath.split("/").filter(Boolean).pop();

    const definitions = [
        ["map", "albedo", true],
        ["normalMap", "normal", false],
        ["roughnessMap", "roughness", false],
        ["aoMap", "ao", false],
        ["bumpMap", "height", false]
    ];

    for (const [slot, suffix, srgb] of definitions) {
        const path = `${basePath}/${name}_${suffix}.png`;

        loader.load(
            path,
            (texture) => {
                configureTexture(texture, repeatX, repeatY, srgb);
                material[slot] = texture;
                if (slot === "map") material.color.set(0xffffff);
                if (slot === "bumpMap") material.bumpScale = options.bumpScale ?? 0.4;
                material.needsUpdate = true;
            },
            undefined,
            () => console.warn(`Environment texture missing: ${path}`)
        );
    }

    return material;
}

function enableAO(geometry) {
    if (!geometry.attributes.uv2 && geometry.attributes.uv) {
        geometry.setAttribute(
            "uv2",
            new THREE.BufferAttribute(geometry.attributes.uv.array, 2)
        );
    }
    return geometry;
}

function createPineTree(barkMaterial, needleMaterial, scale = 1) {
    const tree = new THREE.Group();

    const trunk = new THREE.Mesh(
        enableAO(new THREE.CylinderGeometry(0.28 * scale, 0.42 * scale, 5.2 * scale, 10)),
        barkMaterial
    );
    trunk.position.y = 2.6 * scale;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const levels = [
        [1.9, 3.2, 3.8],
        [1.55, 2.8, 5.1],
        [1.2, 2.3, 6.2],
        [0.85, 1.8, 7.1]
    ];

    for (const [radius, height, y] of levels) {
        const crown = new THREE.Mesh(
            enableAO(new THREE.ConeGeometry(radius * scale, height * scale, 12)),
            needleMaterial
        );
        crown.position.y = y * scale;
        crown.castShadow = true;
        crown.receiveShadow = true;
        tree.add(crown);
    }

    return tree;
}

function createRuinedArch(stoneMaterial, mossMaterial, scale = 1) {
    const group = new THREE.Group();

    const pillarGeo = enableAO(new THREE.BoxGeometry(1.2 * scale, 5.5 * scale, 1.4 * scale));
    const lintelGeo = enableAO(new THREE.BoxGeometry(4.7 * scale, 1.2 * scale, 1.4 * scale));

    const left = new THREE.Mesh(pillarGeo, stoneMaterial);
    left.position.set(-1.8 * scale, 2.75 * scale, 0);

    const right = new THREE.Mesh(pillarGeo.clone(), stoneMaterial);
    right.position.set(1.8 * scale, 2.75 * scale, 0);

    const top = new THREE.Mesh(lintelGeo, stoneMaterial);
    top.position.set(0, 5.1 * scale, 0);

    for (const mesh of [left, right, top]) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }

    const moss = new THREE.Mesh(
        enableAO(new THREE.BoxGeometry(4.9 * scale, 0.15 * scale, 1.55 * scale)),
        mossMaterial
    );
    moss.position.set(0, 5.72 * scale, 0);
    group.add(moss);

    return group;
}

export function createEnvironment() {
    const group = new THREE.Group();
    group.name = "BrokenRidgeEnvironment";

    const barkMaterial = loadPBRMaterial(
        "/assets/materials/pine_bark",
        0x5b3a22,
        3,
        6,
        { bumpScale: 0.7 }
    );

    const needleMaterial = loadPBRMaterial(
        "/assets/materials/pine_needles",
        0x2d5b31,
        3,
        3,
        { roughness: 0.8, bumpScale: 0.25 }
    );

    const stoneMaterial = loadPBRMaterial(
        "/assets/materials/ruin_stone",
        0x777268,
        3,
        3,
        { bumpScale: 0.8 }
    );

    const mossMaterial = loadPBRMaterial(
        "/assets/materials/moss",
        0x4f662d,
        5,
        5,
        { bumpScale: 0.35 }
    );

    const rockMaterial = loadPBRMaterial(
        "/assets/materials/rock_ground",
        0x6f6a63,
        5,
        5,
        { bumpScale: 0.65 }
    );

    // Forests along the valley edges, leaving the main road readable.
    for (let i = 0; i < 120; i++) {
        const x = (Math.random() - 0.5) * 190;
        const z = (Math.random() - 0.5) * 190;

        if (Math.abs(x) < 15) continue;

        const tree = createPineTree(
            barkMaterial,
            needleMaterial,
            0.65 + Math.random() * 0.8
        );

        tree.position.set(x, 0, z);
        tree.rotation.y = Math.random() * Math.PI * 2;
        group.add(tree);
    }

    // Modular ruined arches distributed near the route.
    const ruinPositions = [
        [-16, 18, 0.9],
        [15, 3, 1.1],
        [-18, -20, 0.75],
        [17, -38, 1.25],
        [-15, -58, 0.9],
        [19, -76, 1.05]
    ];

    for (const [x, z, scale] of ruinPositions) {
        const ruin = createRuinedArch(stoneMaterial, mossMaterial, scale);
        ruin.position.set(x, 0, z);
        ruin.rotation.y = (Math.random() - 0.5) * 0.35;
        group.add(ruin);
    }

    // Boulder clusters.
    for (let i = 0; i < 40; i++) {
        const x = (Math.random() - 0.5) * 175;
        const z = (Math.random() - 0.5) * 175;

        if (Math.abs(x) < 7) continue;

        const boulder = new THREE.Mesh(
            enableAO(new THREE.DodecahedronGeometry(1 + Math.random() * 1.8, 1)),
            rockMaterial
        );

        boulder.position.set(x, 0.9 + Math.random() * 1.3, z);
        boulder.scale.set(
            0.7 + Math.random() * 1.5,
            0.6 + Math.random() * 1.2,
            0.7 + Math.random() * 1.5
        );
        boulder.rotation.set(Math.random(), Math.random(), Math.random());
        boulder.castShadow = true;
        boulder.receiveShadow = true;

        group.add(boulder);
    }

    return group;
}

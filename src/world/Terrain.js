import * as THREE from "three";

const loader = new THREE.TextureLoader();

function configureTexture(texture, repeatX, repeatY, srgb = false) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function loadPBRMaterial(basePath, fallbackColor, repeatX, repeatY, options = {}) {
    const material = new THREE.MeshStandardMaterial({
        color: fallbackColor,
        roughness: options.roughness ?? 0.9,
        metalness: options.metalness ?? 0
    });

    const name = basePath.split("/").filter(Boolean).pop();
    const maps = {
        map: [`${basePath}/${name}_albedo.png`, true],
        normalMap: [`${basePath}/${name}_normal.png`, false],
        roughnessMap: [`${basePath}/${name}_roughness.png`, false],
        aoMap: [`${basePath}/${name}_ao.png`, false],
        bumpMap: [`${basePath}/${name}_height.png`, false]
    };

    for (const [slot, [path, srgb]] of Object.entries(maps)) {
        loader.load(
            path,
            (texture) => {
                configureTexture(texture, repeatX, repeatY, srgb);
                material[slot] = texture;

                if (slot === "map") material.color.set(0xffffff);
                if (slot === "bumpMap") material.bumpScale = options.bumpScale ?? 0.55;

                material.needsUpdate = true;
            },
            undefined,
            () => console.warn(`PBR texture missing: ${path}`)
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

export function createTerrain() {
    const group = new THREE.Group();
    group.name = "BrokenRidgeTerrain";

    const grassMaterial = loadPBRMaterial(
        "/assets/materials/grass_meadow",
        0x4f6d36,
        28,
        28,
        { bumpScale: 0.35 }
    );

    const dirtMaterial = loadPBRMaterial(
        "/assets/materials/dirt_road",
        0x795d3e,
        5,
        36,
        { bumpScale: 0.5 }
    );

    const rockMaterial = loadPBRMaterial(
        "/assets/materials/rock_ground",
        0x716b62,
        10,
        10,
        { bumpScale: 0.8 }
    );

    const cliffMaterial = loadPBRMaterial(
        "/assets/materials/cliff_rock",
        0x665f58,
        5,
        7,
        { bumpScale: 1.2 }
    );

    const mountainMaterial = loadPBRMaterial(
        "/assets/materials/mountain_rock",
        0x5e5b58,
        5,
        7,
        { bumpScale: 1.35 }
    );

    const snowMaterial = loadPBRMaterial(
        "/assets/materials/snow",
        0xe8eef3,
        9,
        9,
        { roughness: 0.78, bumpScale: 0.42 }
    );

    const terrainGeometry = enableAO(
        new THREE.PlaneGeometry(220, 220, 180, 180)
    );
    const positions = terrainGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);

        let height =
            Math.sin(x * 0.055) * 2.8 +
            Math.cos(y * 0.045) * 2.5 +
            Math.sin((x + y) * 0.026) * 3.5;

        height += Math.pow(Math.abs(x) / 37, 2) * 17;
        height += Math.max(0, (-y - 28) / 11) * 2.1;

        if (Math.abs(x) < 10) height *= 0.22;

        positions.setZ(i, height);
    }

    terrainGeometry.computeVertexNormals();

    const terrain = new THREE.Mesh(terrainGeometry, grassMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    group.add(terrain);

    const roadGeometry = enableAO(
        new THREE.PlaneGeometry(11, 185, 8, 80)
    );
    const road = new THREE.Mesh(roadGeometry, dirtMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.18, -3);
    road.receiveShadow = true;
    group.add(road);

    const cliffSpecs = [
        [-31, -8, 18, 20, 42, cliffMaterial],
        [34, -20, 22, 25, 45, cliffMaterial],
        [-44, -63, 25, 30, 34, mountainMaterial],
        [47, -77, 28, 34, 40, mountainMaterial],
        [-54, 44, 22, 22, 35, cliffMaterial],
        [55, 30, 24, 26, 38, cliffMaterial]
    ];

    for (const [x, z, sx, sy, sz, mat] of cliffSpecs) {
        const geometry = enableAO(
            new THREE.BoxGeometry(sx, sy, sz, 6, 8, 6)
        );
        const cliff = new THREE.Mesh(geometry, mat);

        cliff.position.set(x, sy / 2 - 1, z);
        cliff.rotation.y = (x + z) * 0.007;
        cliff.castShadow = true;
        cliff.receiveShadow = true;
        group.add(cliff);
    }

    for (let i = 0; i < 70; i++) {
        const x = (Math.random() - 0.5) * 185;
        const z = (Math.random() - 0.5) * 185;

        if (Math.abs(x) < 9) continue;

        const geometry = enableAO(
            new THREE.DodecahedronGeometry(0.8 + Math.random() * 2.1, 1)
        );
        const rock = new THREE.Mesh(geometry, rockMaterial);

        rock.position.set(x, 1 + Math.random() * 1.2, z);
        rock.scale.set(
            0.8 + Math.random() * 1.4,
            0.5 + Math.random() * 1.2,
            0.8 + Math.random() * 1.5
        );
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        rock.receiveShadow = true;
        group.add(rock);
    }

    const snowPatches = [
        [-58, 18, -84, 38, 26],
        [56, 21, -90, 42, 30],
        [-76, 24, -105, 34, 24],
        [72, 25, -112, 36, 24]
    ];

    for (const [x, y, z, width, depth] of snowPatches) {
        const geometry = enableAO(
            new THREE.PlaneGeometry(width, depth, 16, 16)
        );
        const snow = new THREE.Mesh(geometry, snowMaterial);

        snow.rotation.x = -Math.PI / 2;
        snow.position.set(x, y, z);
        snow.receiveShadow = true;
        group.add(snow);
    }

    return group;
}

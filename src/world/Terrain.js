import * as THREE from "three";

const loader = new THREE.TextureLoader();

function configureTexture(texture, repeatX, repeatY, srgb = false) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function enableAO(geometry) {
    if (!geometry.attributes.uv2 && geometry.attributes.uv) {
        geometry.setAttribute("uv2", new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
    }
    return geometry;
}

function loadPBRMaterial(basePath, fallbackColor, repeatX, repeatY, options = {}) {
    const name = basePath.split("/").filter(Boolean).pop();
    const material = new THREE.MeshStandardMaterial({
        color: fallbackColor,
        roughness: options.roughness ?? 0.9,
        metalness: options.metalness ?? 0
    });

    const maps = {
        map: [`${basePath}/${name}_albedo.png`, true],
        normalMap: [`${basePath}/${name}_normal.png`, false],
        roughnessMap: [`${basePath}/${name}_roughness.png`, false],
        aoMap: [`${basePath}/${name}_ao.png`, false],
        bumpMap: [`${basePath}/${name}_height.png`, false]
    };

    for (const [slot, [path, srgb]] of Object.entries(maps)) {
        loader.load(path, (texture) => {
            configureTexture(texture, repeatX, repeatY, srgb);
            material[slot] = texture;
            if (slot === "map") material.color.set(0xffffff);
            if (slot === "bumpMap") material.bumpScale = options.bumpScale ?? 0.5;
            material.needsUpdate = true;
        });
    }
    return material;
}

export function roadCenter(z) {
    return Math.sin(z * 0.026) * 10 + Math.sin(z * 0.0105) * 6;
}

export function riverCenter(z) {
    return 27 + Math.sin(z * 0.020) * 13 + Math.sin(z * 0.0085) * 8;
}

export function terrainHeight(x, z) {
    const rolling =
        Math.sin(x * 0.028) * 2.3 +
        Math.sin(z * 0.038) * 2.0 +
        Math.sin((x + z) * 0.015) * 3.0 +
        Math.cos((x - z) * 0.018) * 1.7;

    // Build broad enclosing ridges rather than vertical walls.
    const sideDistance = Math.max(0, Math.abs(x) - 34);
    const sideRidge = Math.pow(sideDistance / 78, 1.75) * 34;

    // Raise the horizon into the distant mountain basin.
    const farDistance = Math.max(0, -z - 38);
    const farMountains = Math.pow(farDistance / 88, 1.55) * 46;

    const roadDist = Math.abs(x - roadCenter(z));
    const roadBlend = THREE.MathUtils.smoothstep(roadDist, 5, 23);

    let h = (rolling + sideRidge + farMountains) * (0.28 + roadBlend * 0.72);

    // Carve the river into the valley so the water sits inside the world.
    const rDist = Math.abs(x - riverCenter(z));
    const riverCut = Math.exp(-(rDist * rDist) / 62) * 3.8;
    h -= riverCut;

    // Create a waterfall shelf on the left-center side.
    const shelf =
        THREE.MathUtils.smoothstep(x, -62, -34) *
        (1 - THREE.MathUtils.smoothstep(x, -34, -18)) *
        THREE.MathUtils.smoothstep(z, -52, -20) *
        (1 - THREE.MathUtils.smoothstep(z, -20, 4));
    h += shelf * 10;

    return h;
}

function makeRoadGeometry(points, width = 12) {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const tangent = new THREE.Vector2(next.x - prev.x, next.z - prev.z).normalize();
        const normal = new THREE.Vector2(-tangent.y, tangent.x);

        const leftX = p.x + normal.x * width * 0.5;
        const leftZ = p.z + normal.y * width * 0.5;
        const rightX = p.x - normal.x * width * 0.5;
        const rightZ = p.z - normal.y * width * 0.5;

        positions.push(
            leftX, terrainHeight(leftX, leftZ) + 0.18, leftZ,
            rightX, terrainHeight(rightX, rightZ) + 0.18, rightZ
        );

        const v = i / (points.length - 1);
        uvs.push(0, v * 22, 1, v * 22);

        if (i < points.length - 1) {
            const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
            indices.push(a, c, b, b, c, d);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return enableAO(geo);
}

function makeIrregularPeak(radius, height, segments = 10) {
    const geo = new THREE.ConeGeometry(radius, height, segments, 8);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const radial = Math.hypot(x, z);
        const wobble =
            1 +
            Math.sin(x * 0.37 + z * 0.19) * 0.07 +
            Math.cos(z * 0.31 - x * 0.12) * 0.06;

        if (radial > 0.01 && y < height * 0.45) {
            pos.setX(i, x * wobble);
            pos.setZ(i, z * wobble);
        }
    }

    geo.computeVertexNormals();
    return enableAO(geo);
}

function addMountainCluster(group, material, cx, cz, count, radius, heightScale) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.65;
        const r = radius * (0.25 + Math.random() * 0.85);
        const x = cx + Math.cos(angle) * r;
        const z = cz + Math.sin(angle) * r;
        const h = heightScale * (0.7 + Math.random() * 0.7);
        const geo = makeIrregularPeak(9 + Math.random() * 15, h, 8 + Math.floor(Math.random() * 4));
        const mesh = new THREE.Mesh(geo, material);

        mesh.position.set(x, terrainHeight(x, z) + h * 0.48 - 2.5, z);
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.scale.x *= 0.85 + Math.random() * 0.55;
        mesh.scale.z *= 0.85 + Math.random() * 0.55;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
}

export function createTerrain() {
    const group = new THREE.Group();
    group.name = "BrokenRidgeTerrain";

    const grassMaterial = loadPBRMaterial("/assets/materials/grass_meadow", 0x58743a, 38, 38, { bumpScale: 0.24 });
    const dirtMaterial = loadPBRMaterial("/assets/materials/dirt_road", 0x7a5b38, 6, 28, { bumpScale: 0.38 });
    const cliffMaterial = loadPBRMaterial("/assets/materials/cliff_rock", 0x686158, 8, 10, { bumpScale: 0.95 });
    const mountainMaterial = loadPBRMaterial("/assets/materials/mountain_rock", 0x5f5c58, 9, 11, { bumpScale: 1.05 });
    const snowMaterial = loadPBRMaterial("/assets/materials/snow", 0xeaf0f5, 8, 8, { roughness: 0.78, bumpScale: 0.3 });

    const size = 360;
    const geo = enableAO(new THREE.PlaneGeometry(size, size, 240, 240));
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);

        // PlaneGeometry is rotated -90 degrees around X below.
        // After that rotation its local +Y becomes world -Z, so sample
        // terrainHeight using the final WORLD z coordinate. Without this
        // sign flip, props placed with terrainHeight(x, z) were aligned to
        // a different height field than the visible ground and appeared to
        // float high above the terrain.
        const worldZ = -pos.getY(i);

        pos.setZ(i, terrainHeight(x, worldZ));
    }
    geo.computeVertexNormals();

    const ground = new THREE.Mesh(geo, grassMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    const roadPoints = [];
    for (let z = 145; z >= -135; z -= 4) {
        roadPoints.push({ x: roadCenter(z), z });
    }
    const road = new THREE.Mesh(makeRoadGeometry(roadPoints, 13), dirtMaterial);
    road.receiveShadow = true;
    group.add(road);

    // Monumental distant basin.
    addMountainCluster(group, mountainMaterial, -120, -118, 8, 44, 72);
    addMountainCluster(group, mountainMaterial, 122, -122, 8, 46, 78);
    addMountainCluster(group, cliffMaterial, -132, 8, 5, 30, 46);
    addMountainCluster(group, cliffMaterial, 132, 15, 5, 32, 48);

    // Snow caps for the most distant peaks.
    const snowSpecs = [
        [-124, 54, -128, 30],
        [-88, 48, -150, 26],
        [118, 58, -136, 32],
        [78, 50, -154, 25]
    ];
    for (const [x, y, z, r] of snowSpecs) {
        const s = new THREE.Mesh(enableAO(new THREE.CircleGeometry(r, 56)), snowMaterial);
        s.rotation.x = -Math.PI / 2;
        s.position.set(x, y, z);
        group.add(s);
    }

    return group;
}

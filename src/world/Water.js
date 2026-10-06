import * as THREE from "three";

const loader = new THREE.TextureLoader();

function configureTexture(texture, repeatX, repeatY, srgb = false) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function loadWaterMaterial(basePath, fallbackColor, repeatX, repeatY, options = {}) {
    const material = new THREE.MeshStandardMaterial({
        color: fallbackColor,
        transparent: true,
        opacity: options.opacity ?? 0.82,
        roughness: options.roughness ?? 0.25,
        metalness: 0,
        depthWrite: true,
        side: THREE.DoubleSide
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
                if (slot === "bumpMap") material.bumpScale = options.bumpScale ?? 0.2;
                material.needsUpdate = true;
            },
            undefined,
            () => console.warn(`Water texture missing: ${path}`)
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

export function createWater() {
    const group = new THREE.Group();
    group.name = "BrokenRidgeWater";

    const riverMaterial = loadWaterMaterial(
        "/assets/materials/river_water",
        0x2e8ea6,
        5,
        28,
        { opacity: 0.78, roughness: 0.18, bumpScale: 0.16 }
    );

    const waterfallMaterial = loadWaterMaterial(
        "/assets/materials/waterfall_foam",
        0xd8f3ff,
        3,
        7,
        { opacity: 0.9, roughness: 0.3, bumpScale: 0.12 }
    );

    // Main river, offset from the central road so both remain visible.
    const riverGeometry = enableAO(
        new THREE.PlaneGeometry(12, 160, 10, 80)
    );
    const river = new THREE.Mesh(riverGeometry, riverMaterial);
    river.rotation.x = -Math.PI / 2;
    river.position.set(18, 0.12, -16);
    river.rotation.z = -0.07;
    river.receiveShadow = true;
    group.add(river);

    // Secondary stream crossing the valley.
    const streamGeometry = enableAO(
        new THREE.PlaneGeometry(7, 72, 6, 40)
    );
    const stream = new THREE.Mesh(streamGeometry, riverMaterial.clone());
    stream.rotation.x = -Math.PI / 2;
    stream.rotation.z = Math.PI / 2.65;
    stream.position.set(-14, 0.13, -26);
    group.add(stream);

    // Waterfall sheet.
    const waterfallGeometry = enableAO(
        new THREE.PlaneGeometry(10, 18, 10, 20)
    );
    const waterfall = new THREE.Mesh(
        waterfallGeometry,
        waterfallMaterial
    );
    waterfall.position.set(-34, 10, -38);
    waterfall.rotation.y = Math.PI / 2.1;
    waterfall.castShadow = false;
    group.add(waterfall);

    // Pool at waterfall base.
    const poolGeometry = enableAO(
        new THREE.CircleGeometry(9, 48)
    );
    const pool = new THREE.Mesh(
        poolGeometry,
        riverMaterial.clone()
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-29, 0.16, -38);
    group.add(pool);

    return {
        group,
        update(delta) {
            const riverMaps = [
                river.material.map,
                river.material.normalMap,
                stream.material.map,
                stream.material.normalMap
            ].filter(Boolean);

            for (const texture of riverMaps) {
                texture.offset.y -= delta * 0.035;
            }

            const fallMaps = [
                waterfall.material.map,
                waterfall.material.normalMap
            ].filter(Boolean);

            for (const texture of fallMaps) {
                texture.offset.y -= delta * 0.22;
            }
        }
    };
}

import * as THREE from "three";

const loader = new THREE.TextureLoader();

function makeTexturedMaterial(path, fallbackColor, repeatX, repeatY, options = {}) {
    const material = new THREE.MeshStandardMaterial({
        color: fallbackColor,
        roughness: options.roughness ?? 0.95,
        metalness: options.metalness ?? 0
    });

    loader.load(
        path,
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeatX, repeatY);
            texture.colorSpace = THREE.SRGBColorSpace;

            material.map = texture;
            material.color.set(0xffffff);
            material.needsUpdate = true;
        },
        undefined,
        () => {
            console.warn(`Terrain texture not found yet: ${path}`);
        }
    );

    return material;
}

export function createTerrain() {
    const group = new THREE.Group();
    group.name = "BrokenRidgeTerrain";

    const grassMaterial = makeTexturedMaterial(
        "/assets/terrain/grass/grass_texture.png",
        0x4f6d36,
        26,
        26
    );

    const dirtMaterial = makeTexturedMaterial(
        "/assets/terrain/dirt/dirt_road_texture.png",
        0x795d3e,
        4,
        36
    );

    const rockMaterial = makeTexturedMaterial(
        "/assets/terrain/rock/rock_ground_texture.png",
        0x716b62,
        8,
        8
    );

    const cliffMaterial = makeTexturedMaterial(
        "/assets/terrain/cliffs/rock_cliff_texture.png",
        0x665f58,
        4,
        5
    );

    const snowMaterial = makeTexturedMaterial(
        "/assets/terrain/snow/snow_texture.png",
        0xe8eef3,
        8,
        8,
        { roughness: 0.82 }
    );

    const terrainGeometry = new THREE.PlaneGeometry(220, 220, 180, 180);
    const positions = terrainGeometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);

        let height =
            Math.sin(x * 0.055) * 2.8 +
            Math.cos(y * 0.045) * 2.5 +
            Math.sin((x + y) * 0.026) * 3.5;

        // Stronger ridges on both sides of the valley.
        height += Math.pow(Math.abs(x) / 37, 2) * 17;

        // Raise the far side into a mountain wall.
        height += Math.max(0, (-y - 28) / 11) * 2.1;

        // Keep the central route relatively playable.
        if (Math.abs(x) < 10) {
            height *= 0.22;
        }

        positions.setZ(i, height);
    }

    terrainGeometry.computeVertexNormals();

    const terrain = new THREE.Mesh(terrainGeometry, grassMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.receiveShadow = true;
    group.add(terrain);

    // Main dirt trail.
    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(11, 185, 8, 80),
        dirtMaterial
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.18, -3);
    road.receiveShadow = true;
    group.add(road);

    // Rocky mountain walls.
    const cliffSpecs = [
        [-31, -8, 18, 20, 42],
        [34, -20, 22, 25, 45],
        [-44, -63, 25, 30, 34],
        [47, -77, 28, 34, 40],
        [-54, 44, 22, 22, 35],
        [55, 30, 24, 26, 38]
    ];

    for (const [x, z, sx, sy, sz] of cliffSpecs) {
        const cliff = new THREE.Mesh(
            new THREE.BoxGeometry(sx, sy, sz, 4, 5, 4),
            cliffMaterial
        );

        cliff.position.set(x, sy / 2 - 1, z);
        cliff.rotation.y = (x + z) * 0.007;
        cliff.castShadow = true;
        cliff.receiveShadow = true;
        group.add(cliff);
    }

    // Scatter real textured rock shapes across the valley.
    for (let i = 0; i < 55; i++) {
        const x = (Math.random() - 0.5) * 185;
        const z = (Math.random() - 0.5) * 185;

        if (Math.abs(x) < 9) continue;

        const rock = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.8 + Math.random() * 2.1, 1),
            rockMaterial
        );

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

    // Distant snow caps.
    const snowPatches = [
        [-58, 18, -84, 38, 26],
        [56, 21, -90, 42, 30],
        [-76, 24, -105, 34, 24],
        [72, 25, -112, 36, 24]
    ];

    for (const [x, y, z, width, depth] of snowPatches) {
        const snow = new THREE.Mesh(
            new THREE.PlaneGeometry(width, depth),
            snowMaterial
        );

        snow.rotation.x = -Math.PI / 2;
        snow.position.set(x, y, z);
        snow.receiveShadow = true;
        group.add(snow);
    }

    return group;
}

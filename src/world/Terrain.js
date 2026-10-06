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

export function terrainHeight(x, z) {
    const base =
        Math.sin(x * 0.032) * 2.4 +
        Math.sin(z * 0.041) * 2.1 +
        Math.sin((x + z) * 0.017) * 3.2 +
        Math.cos((x - z) * 0.021) * 2.0;

    const sideRidge = Math.pow(Math.max(0, Math.abs(x) - 28) / 60, 1.65) * 28;
    const farMountains = Math.pow(Math.max(0, -z - 45) / 70, 1.45) * 38;

    const roadCenter = Math.sin(z * 0.028) * 9 + Math.sin(z * 0.011) * 5;
    const roadDist = Math.abs(x - roadCenter);
    const valleyFlatten = THREE.MathUtils.clamp(roadDist / 20, 0.2, 1);

    return (base + sideRidge + farMountains) * valleyFlatten;
}

function makeRoadGeometry(points, width = 9) {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const tangent = new THREE.Vector2(next.x - prev.x, next.z - prev.z).normalize();
        const normal = new THREE.Vector2(-tangent.y, tangent.x);

        const left = new THREE.Vector3(
            p.x + normal.x * width * 0.5,
            terrainHeight(p.x, p.z) + 0.16,
            p.z + normal.y * width * 0.5
        );
        const right = new THREE.Vector3(
            p.x - normal.x * width * 0.5,
            terrainHeight(p.x, p.z) + 0.16,
            p.z - normal.y * width * 0.5
        );

        positions.push(left.x,left.y,left.z,right.x,right.y,right.z);
        const v = i / (points.length - 1);
        uvs.push(0,v*18,1,v*18);

        if (i < points.length - 1) {
            const a=i*2,b=a+1,c=a+2,d=a+3;
            indices.push(a,c,b,b,c,d);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs,2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return enableAO(geo);
}

function addMountainCluster(group, material, cx, cz, count, radius, heightScale) {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const r = radius * (0.35 + Math.random() * 0.7);
        const x = cx + Math.cos(angle) * r;
        const z = cz + Math.sin(angle) * r;

        const geo = enableAO(new THREE.ConeGeometry(
            10 + Math.random()*12,
            heightScale * (0.65 + Math.random()*0.7),
            7 + Math.floor(Math.random()*3),
            5
        ));
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(x, terrainHeight(x,z) + mesh.geometry.parameters.height/2 - 3, z);
        mesh.rotation.y = Math.random()*Math.PI;
        mesh.scale.x *= 0.8 + Math.random()*0.6;
        mesh.scale.z *= 0.8 + Math.random()*0.6;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
}

export function createTerrain() {
    const group = new THREE.Group();
    group.name = "BrokenRidgeTerrain";

    const grassMaterial = loadPBRMaterial("/assets/materials/grass_meadow", 0x58743a, 34,34,{bumpScale:0.28});
    const dirtMaterial = loadPBRMaterial("/assets/materials/dirt_road", 0x7a5b38, 5,24,{bumpScale:0.4});
    const cliffMaterial = loadPBRMaterial("/assets/materials/cliff_rock", 0x686158, 7,9,{bumpScale:1.0});
    const mountainMaterial = loadPBRMaterial("/assets/materials/mountain_rock", 0x5f5c58, 8,10,{bumpScale:1.15});
    const snowMaterial = loadPBRMaterial("/assets/materials/snow", 0xeaf0f5, 8,8,{roughness:0.78,bumpScale:0.35});

    const size = 320;
    const geo = enableAO(new THREE.PlaneGeometry(size,size,220,220));
    const pos = geo.attributes.position;

    for (let i=0;i<pos.count;i++) {
        const x=pos.getX(i), z=pos.getY(i);
        pos.setZ(i, terrainHeight(x,z));
    }
    geo.computeVertexNormals();

    const ground = new THREE.Mesh(geo, grassMaterial);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    group.add(ground);

    const roadPoints=[];
    for (let z=135; z>=-120; z-=5) {
        roadPoints.push({
            x: Math.sin(z*0.028)*9 + Math.sin(z*0.011)*5,
            z
        });
    }
    const road = new THREE.Mesh(makeRoadGeometry(roadPoints, 10), dirtMaterial);
    road.receiveShadow = true;
    group.add(road);

    addMountainCluster(group, mountainMaterial, -108,-95, 7, 38, 62);
    addMountainCluster(group, mountainMaterial, 110,-100, 7, 42, 68);
    addMountainCluster(group, cliffMaterial, -120,10, 5, 28, 40);
    addMountainCluster(group, cliffMaterial, 118,20, 5, 28, 42);

    // snow caps on far peaks
    const snowSpecs=[[-112,46,-108,28],[-78,40,-132,24],[108,48,-118,30],[72,42,-138,22]];
    for (const [x,y,z,r] of snowSpecs) {
        const s = new THREE.Mesh(enableAO(new THREE.CircleGeometry(r,48)), snowMaterial);
        s.rotation.x=-Math.PI/2;
        s.position.set(x,y,z);
        group.add(s);
    }

    return group;
}

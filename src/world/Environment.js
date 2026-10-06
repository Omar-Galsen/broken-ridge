import * as THREE from "three";
import { terrainHeight, roadCenter } from "./Terrain.js";

const loader = new THREE.TextureLoader();

function configureTexture(texture, repeatX, repeatY, srgb=false) {
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(repeatX,repeatY);
    if (srgb) texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
}

function enableAO(geometry) {
    if (!geometry.attributes.uv2 && geometry.attributes.uv) {
        geometry.setAttribute("uv2", new THREE.BufferAttribute(geometry.attributes.uv.array,2));
    }
    return geometry;
}

function loadPBRMaterial(basePath,fallbackColor,repeatX=4,repeatY=4,options={}) {
    const name=basePath.split("/").filter(Boolean).pop();
    const mat=new THREE.MeshStandardMaterial({
        color:fallbackColor,
        roughness:options.roughness ?? 0.9,
        metalness:0
    });
    const defs=[
        ["map","albedo",true],
        ["normalMap","normal",false],
        ["roughnessMap","roughness",false],
        ["aoMap","ao",false],
        ["bumpMap","height",false]
    ];
    for (const [slot,suffix,srgb] of defs) {
        const path=`${basePath}/${name}_${suffix}.png`;
        loader.load(path,(tex)=>{
            configureTexture(tex,repeatX,repeatY,srgb);
            mat[slot]=tex;
            if (slot==="map") mat.color.set(0xffffff);
            if (slot==="bumpMap") mat.bumpScale=options.bumpScale ?? 0.4;
            mat.needsUpdate=true;
        });
    }
    return mat;
}


function placeGrounded(object,x,z,offset=0) {
    object.position.set(x,0,z);
    object.updateMatrixWorld(true);

    const box=new THREE.Box3().setFromObject(object);
    const baseRelative=box.min.y-object.position.y;

    object.position.y=terrainHeight(x,z)+offset-baseRelative;
    object.updateMatrixWorld(true);
    return object;
}

function createPine(bark, needles, scale=1) {
    const g=new THREE.Group();

    const trunk=new THREE.Mesh(
        enableAO(new THREE.CylinderGeometry(0.23*scale,0.46*scale,7.1*scale,10)),
        bark
    );
    trunk.position.y=3.55*scale;
    trunk.castShadow=true;
    g.add(trunk);

    const tiers=[
        [2.8,4.0,4.5],
        [2.45,3.7,5.9],
        [2.05,3.25,7.15],
        [1.65,2.8,8.3],
        [1.2,2.2,9.25],
        [0.75,1.5,10.05]
    ];

    for (let i=0;i<tiers.length;i++) {
        const [r,h,y]=tiers[i];
        const m=new THREE.Mesh(enableAO(new THREE.ConeGeometry(r*scale,h*scale,14)),needles);
        m.position.y=y*scale;
        m.rotation.y=i*0.53;
        m.scale.x*=0.92+Math.random()*0.16;
        m.scale.z*=0.92+Math.random()*0.16;
        m.castShadow=true;
        g.add(m);
    }
    return g;
}

function addRockCluster(group, material, cx, cz, count, spread) {
    for (let i=0;i<count;i++) {
        const x=cx+(Math.random()-0.5)*spread;
        const z=cz+(Math.random()-0.5)*spread;
        const r=0.9+Math.random()*3.2;
        const rock=new THREE.Mesh(enableAO(new THREE.DodecahedronGeometry(r,1)),material);
        rock.scale.set(0.75+Math.random()*1.7,0.55+Math.random()*1.05,0.7+Math.random()*1.6);
        rock.rotation.set(Math.random()*1.4,Math.random()*Math.PI,Math.random()*1.4);
        placeGrounded(rock,x,z,-0.12);
        rock.castShadow=true;
        rock.receiveShadow=true;
        group.add(rock);
    }
}

function createRuinedArch(stone,moss,scale=1) {
    const g=new THREE.Group();
    const pillarGeo=enableAO(new THREE.BoxGeometry(1.6*scale,7.3*scale,2.0*scale));
    const lintelGeo=enableAO(new THREE.BoxGeometry(6.5*scale,1.5*scale,2.0*scale));

    const left=new THREE.Mesh(pillarGeo,stone);
    const right=new THREE.Mesh(pillarGeo.clone(),stone);
    const top=new THREE.Mesh(lintelGeo,stone);

    left.position.set(-2.35*scale,3.65*scale,0);
    right.position.set(2.35*scale,3.65*scale,0);
    top.position.set(0,6.85*scale,0);

    for (const m of [left,right,top]) {
        m.castShadow=true;
        m.receiveShadow=true;
        g.add(m);
    }

    const mossCap=new THREE.Mesh(enableAO(new THREE.BoxGeometry(6.7*scale,0.2*scale,2.15*scale)),moss);
    mossCap.position.set(0,7.65*scale,0);
    g.add(mossCap);

    return g;
}

function createWatchTower(stone,scale=1) {
    const g=new THREE.Group();

    const body=new THREE.Mesh(enableAO(new THREE.CylinderGeometry(2.6*scale,3.2*scale,13*scale,10)),stone);
    body.position.y=6.5*scale;
    body.castShadow=true;
    body.receiveShadow=true;
    g.add(body);

    const crown=new THREE.Mesh(enableAO(new THREE.CylinderGeometry(3.45*scale,2.9*scale,2.3*scale,10)),stone);
    crown.position.y=13.3*scale;
    crown.castShadow=true;
    g.add(crown);

    return g;
}

function createBridge(stone,scale=1) {
    const g=new THREE.Group();

    const deck=new THREE.Mesh(enableAO(new THREE.BoxGeometry(18*scale,1.2*scale,5.5*scale)),stone);
    deck.position.y=6.0*scale;
    deck.castShadow=true;
    deck.receiveShadow=true;
    g.add(deck);

    for (const x of [-6.5,0,6.5]) {
        const p=new THREE.Mesh(enableAO(new THREE.BoxGeometry(1.5*scale,6.2*scale,5.5*scale)),stone);
        p.position.set(x*scale,3.1*scale,0);
        p.castShadow=true;
        p.receiveShadow=true;
        g.add(p);
    }

    return g;
}

function createAncientGate(stone,moss,scale=1) {
    const g=new THREE.Group();

    const leftTower=createWatchTower(stone,1.2*scale);
    leftTower.position.x=-7.5*scale;
    g.add(leftTower);

    const rightTower=createWatchTower(stone,1.2*scale);
    rightTower.position.x=7.5*scale;
    g.add(rightTower);

    const arch=createRuinedArch(stone,moss,1.75*scale);
    arch.position.y=0.4*scale;
    g.add(arch);

    const wallMat=stone;
    const wallLeft=new THREE.Mesh(enableAO(new THREE.BoxGeometry(11*scale,7*scale,2.2*scale)),wallMat);
    wallLeft.position.set(-13*scale,3.5*scale,0);
    wallLeft.castShadow=true;
    wallLeft.receiveShadow=true;
    g.add(wallLeft);

    const wallRight=new THREE.Mesh(enableAO(new THREE.BoxGeometry(11*scale,7*scale,2.2*scale)),wallMat);
    wallRight.position.set(13*scale,3.5*scale,0);
    wallRight.castShadow=true;
    wallRight.receiveShadow=true;
    g.add(wallRight);

    return g;
}


function createFenceLine(group, woodMaterial, z, side, count=8, spacing=6) {
    const center = roadCenter(z);
    for (let i=0;i<count;i++) {
        const zz = z - i*spacing;
        const xx = roadCenter(zz) + side*10.5;
        const post = new THREE.Mesh(
            enableAO(new THREE.CylinderGeometry(0.18,0.22,2.2,8)),
            woodMaterial
        );
        post.position.set(xx, terrainHeight(xx,zz)+1.1, zz);
        post.castShadow = true;
        group.add(post);

        if (i < count-1) {
            const nextZ = z - (i+1)*spacing;
            const nextX = roadCenter(nextZ) + side*10.5;
            const railLen = Math.hypot(nextX-xx, nextZ-zz);
            const rail = new THREE.Mesh(
                enableAO(new THREE.BoxGeometry(railLen,0.18,0.18)),
                woodMaterial
            );
            rail.position.set((xx+nextX)/2, terrainHeight((xx+nextX)/2,(zz+nextZ)/2)+1.3, (zz+nextZ)/2);
            rail.rotation.y = -Math.atan2(nextZ-zz,nextX-xx);
            rail.castShadow = true;
            group.add(rail);
        }
    }
}

function createTorch(group, x, z) {
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08,0.1,2.4,8),
        new THREE.MeshStandardMaterial({color:0x3b2a1a,roughness:0.95})
    );
    pole.position.set(x,terrainHeight(x,z)+1.2,z);
    group.add(pole);

    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.2,10,10),
        new THREE.MeshBasicMaterial({color:0xff9a2f})
    );
    flame.position.set(x,terrainHeight(x,z)+2.5,z);
    group.add(flame);

    const light = new THREE.PointLight(0xff8a33, 8, 18, 2);
    light.position.copy(flame.position);
    group.add(light);
}

export function createEnvironment() {
    const group=new THREE.Group();
    group.name="BrokenRidgeEnvironment";

    const bark=loadPBRMaterial("/assets/materials/pine_bark",0x5b3a22,3,6,{bumpScale:0.7});
    const needles=loadPBRMaterial("/assets/materials/pine_needles",0x2d5b31,3,3,{roughness:0.82,bumpScale:0.22});
    const stone=loadPBRMaterial("/assets/materials/ruin_stone",0x777268,3,3,{bumpScale:0.75});
    const moss=loadPBRMaterial("/assets/materials/moss",0x4f662d,5,5,{bumpScale:0.32});
    const rock=loadPBRMaterial("/assets/materials/rock_ground",0x6f6a63,5,5,{bumpScale:0.65});
    const wood=loadPBRMaterial("/assets/materials/pine_bark",0x5a3a24,2,5,{bumpScale:0.45});

    // Dense forests at edges, scattered trees in the middle distance.
    for (let i=0;i<320;i++) {
        const x=(Math.random()-0.5)*330;
        const z=(Math.random()-0.5)*300;
        const center=roadCenter(z);
        const dist=Math.abs(x-center);

        if (dist<18) continue;
        if (dist<42 && Math.random()<0.68) continue;

        const scale=0.55+Math.random()*1.0;
        const t=createPine(bark,needles,scale);
        t.rotation.y=Math.random()*Math.PI*2;
        placeGrounded(t,x,z);
        group.add(t);
    }

    // Rock outcrops around the valley.
    addRockCluster(group,rock,-52,38,26,46);
    addRockCluster(group,rock,58,26,28,48);
    addRockCluster(group,rock,-72,-34,24,42);
    addRockCluster(group,rock,74,-50,26,44);

    // Ruins along the road become larger landmarks.
    const ruins=[
        [-22,48,1.15,0.15],
        [24,26,1.3,-0.12],
        [-20,-4,1.1,0.2],
        [23,-34,1.35,-0.14],
        [-19,-62,1.2,0.08]
    ];
    for (const [x,z,s,r] of ruins) {
        const a=createRuinedArch(stone,moss,s);
        a.rotation.y=r;
        placeGrounded(a,x,z,-0.05);
        group.add(a);
    }

    // Watchtowers frame the distant approach.
    for (const [x,z,s] of [
        [-34,-82,1.15],
        [34,-88,1.25],
        [-48,-108,1.3],
        [46,-116,1.4]
    ]) {
        const tower=createWatchTower(stone,s);
        placeGrounded(tower,x,z,-0.08);
        group.add(tower);
    }

    // Stone bridge crossing the river corridor.
    const bridge=createBridge(stone,1.15);
    bridge.rotation.y=0.1;
    placeGrounded(bridge,24,-18,-0.15);
    group.add(bridge);

    // Roadside composition: fences, torches, and landmark rhythm.
    createFenceLine(group,wood,58,1,9,6);
    createFenceLine(group,wood,58,-1,7,6);
    createFenceLine(group,wood,-12,1,6,6);

    for (const [z,side] of [[40,1],[18,-1],[-8,1],[-38,-1],[-72,1]]) {
        const x=roadCenter(z)+side*8.5;
        createTorch(group,x,z);
    }

    // Monumental ancient gate / castle destination.
    const gate=createAncientGate(stone,moss,0.92);
    gate.rotation.y=0.02;
    placeGrounded(gate,roadCenter(-152),-152,-0.08);
    group.add(gate);

    return group;
}

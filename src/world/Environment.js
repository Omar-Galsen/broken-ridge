import * as THREE from "three";
import { terrainHeight } from "./Terrain.js";

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

function createPine(bark, needles, scale=1) {
    const g=new THREE.Group();

    const trunk=new THREE.Mesh(
        enableAO(new THREE.CylinderGeometry(0.24*scale,0.44*scale,6.2*scale,9)),
        bark
    );
    trunk.position.y=3.1*scale;
    trunk.castShadow=true;
    g.add(trunk);

    const tiers=[
        [2.35,3.7,4.3],
        [2.05,3.3,5.6],
        [1.72,2.8,6.8],
        [1.32,2.3,7.9],
        [0.9,1.7,8.8]
    ];
    for (const [r,h,y] of tiers) {
        const m=new THREE.Mesh(enableAO(new THREE.ConeGeometry(r*scale,h*scale,12)),needles);
        m.position.y=y*scale;
        m.castShadow=true;
        g.add(m);
    }
    return g;
}

function addRockCluster(group, material, cx, cz, count, spread) {
    for (let i=0;i<count;i++) {
        const x=cx+(Math.random()-0.5)*spread;
        const z=cz+(Math.random()-0.5)*spread;
        const r=0.8+Math.random()*2.8;
        const rock=new THREE.Mesh(enableAO(new THREE.DodecahedronGeometry(r,1)),material);
        rock.position.set(x,terrainHeight(x,z)+r*0.45,z);
        rock.scale.set(0.7+Math.random()*1.7,0.55+Math.random()*1.0,0.7+Math.random()*1.5);
        rock.rotation.set(Math.random()*1.3,Math.random()*Math.PI,Math.random()*1.3);
        rock.castShadow=true;
        rock.receiveShadow=true;
        group.add(rock);
    }
}

function createRuinedArch(stone,moss,scale=1) {
    const g=new THREE.Group();
    const pillarGeo=enableAO(new THREE.BoxGeometry(1.4*scale,6.4*scale,1.7*scale));
    const lintelGeo=enableAO(new THREE.BoxGeometry(5.5*scale,1.25*scale,1.7*scale));
    const left=new THREE.Mesh(pillarGeo,stone);
    const right=new THREE.Mesh(pillarGeo.clone(),stone);
    const top=new THREE.Mesh(lintelGeo,stone);
    left.position.set(-2.0*scale,3.2*scale,0);
    right.position.set(2.0*scale,3.2*scale,0);
    top.position.set(0,6.0*scale,0);
    for (const m of [left,right,top]) { m.castShadow=true; m.receiveShadow=true; g.add(m); }

    const mossCap=new THREE.Mesh(enableAO(new THREE.BoxGeometry(5.6*scale,0.18*scale,1.85*scale)),moss);
    mossCap.position.set(0,6.7*scale,0);
    g.add(mossCap);
    return g;
}

function createWatchTower(stone,scale=1) {
    const g=new THREE.Group();
    const body=new THREE.Mesh(enableAO(new THREE.CylinderGeometry(2.1*scale,2.6*scale,10*scale,8)),stone);
    body.position.y=5*scale;
    body.castShadow=true;
    body.receiveShadow=true;
    g.add(body);

    const crown=new THREE.Mesh(enableAO(new THREE.CylinderGeometry(2.7*scale,2.3*scale,2*scale,8)),stone);
    crown.position.y=10.7*scale;
    crown.castShadow=true;
    g.add(crown);
    return g;
}

function createBridge(stone,scale=1) {
    const g=new THREE.Group();
    const deck=new THREE.Mesh(enableAO(new THREE.BoxGeometry(14*scale,1.0*scale,4.2*scale)),stone);
    deck.position.y=5.0*scale;
    deck.castShadow=true;
    deck.receiveShadow=true;
    g.add(deck);

    for (const x of [-5,0,5]) {
        const p=new THREE.Mesh(enableAO(new THREE.BoxGeometry(1.3*scale,5.2*scale,4.2*scale)),stone);
        p.position.set(x*scale,2.6*scale,0);
        p.castShadow=true;
        p.receiveShadow=true;
        g.add(p);
    }
    return g;
}

export function createEnvironment() {
    const group=new THREE.Group();
    group.name="BrokenRidgeEnvironment";

    const bark=loadPBRMaterial("/assets/materials/pine_bark",0x5b3a22,3,6,{bumpScale:0.7});
    const needles=loadPBRMaterial("/assets/materials/pine_needles",0x2d5b31,3,3,{roughness:0.82,bumpScale:0.22});
    const stone=loadPBRMaterial("/assets/materials/ruin_stone",0x777268,3,3,{bumpScale:0.75});
    const moss=loadPBRMaterial("/assets/materials/moss",0x4f662d,5,5,{bumpScale:0.32});
    const rock=loadPBRMaterial("/assets/materials/rock_ground",0x6f6a63,5,5,{bumpScale:0.65});

    // Dense forest bands, clear center valley.
    for (let i=0;i<220;i++) {
        let x=(Math.random()-0.5)*285;
        let z=(Math.random()-0.5)*270;
        const center=Math.sin(z*0.028)*9 + Math.sin(z*0.011)*5;
        if (Math.abs(x-center)<24) continue;
        if (Math.random()<0.22 && Math.abs(x)<55) continue;

        const t=createPine(bark,needles,0.55+Math.random()*0.85);
        t.position.set(x,terrainHeight(x,z),z);
        t.rotation.y=Math.random()*Math.PI*2;
        group.add(t);
    }

    addRockCluster(group,rock,-45,35,18,38);
    addRockCluster(group,rock,52,22,20,42);
    addRockCluster(group,rock,-62,-35,18,34);
    addRockCluster(group,rock,66,-48,20,36);

    const ruins=[
        [-17,44,0.95,0.15],
        [19,23,1.05,-0.1],
        [-15,-8,0.9,0.2],
        [18,-31,1.1,-0.12],
        [-17,-59,0.9,0.1]
    ];
    for (const [x,z,s,r] of ruins) {
        const a=createRuinedArch(stone,moss,s);
        a.position.set(x,terrainHeight(x,z),z);
        a.rotation.y=r;
        group.add(a);
    }

    // Landmark towers and ancient gate line.
    for (const [x,z,s] of [[-28,-78,0.9],[28,-82,1.0],[-42,-103,1.1],[40,-110,1.15]]) {
        const tower=createWatchTower(stone,s);
        tower.position.set(x,terrainHeight(x,z),z);
        group.add(tower);
    }

    const bridge=createBridge(stone,1.0);
    bridge.position.set(18,terrainHeight(18,-18)+0.6,-18);
    bridge.rotation.y=0.12;
    group.add(bridge);

    return group;
}

import * as THREE from "three";
import { terrainHeight } from "./Terrain.js";

const loader=new THREE.TextureLoader();

function configureTexture(texture,rx,ry,srgb=false) {
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(rx,ry);
    if (srgb) texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
}

function loadWaterMaterial(basePath,fallbackColor,rx,ry,options={}) {
    const name=basePath.split("/").filter(Boolean).pop();
    const mat=new THREE.MeshStandardMaterial({
        color:fallbackColor,
        transparent:true,
        opacity:options.opacity ?? 0.78,
        roughness:options.roughness ?? 0.22,
        metalness:0,
        side:THREE.DoubleSide,
        depthWrite:false
    });
    const defs=[["map","albedo",true],["normalMap","normal",false],["roughnessMap","roughness",false],["bumpMap","height",false]];
    for (const [slot,suffix,srgb] of defs) {
        loader.load(`${basePath}/${name}_${suffix}.png`,(tex)=>{
            configureTexture(tex,rx,ry,srgb);
            mat[slot]=tex;
            if (slot==="map") mat.color.set(0xffffff);
            if (slot==="bumpMap") mat.bumpScale=options.bumpScale ?? 0.12;
            mat.needsUpdate=true;
        });
    }
    return mat;
}

function buildRibbon(points,width,material,yOffset=0.22) {
    const positions=[],uvs=[],indices=[];
    for (let i=0;i<points.length;i++) {
        const p=points[i];
        const prev=points[Math.max(0,i-1)];
        const next=points[Math.min(points.length-1,i+1)];
        const tangent=new THREE.Vector2(next.x-prev.x,next.z-prev.z).normalize();
        const n=new THREE.Vector2(-tangent.y,tangent.x);
        const y=terrainHeight(p.x,p.z)+yOffset;
        const l=new THREE.Vector3(p.x+n.x*width*0.5,y,p.z+n.y*width*0.5);
        const r=new THREE.Vector3(p.x-n.x*width*0.5,y,p.z-n.y*width*0.5);
        positions.push(l.x,l.y,l.z,r.x,r.y,r.z);
        const v=i/(points.length-1);
        uvs.push(0,v*14,1,v*14);
        if (i<points.length-1) {
            const a=i*2,b=a+1,c=a+2,d=a+3;
            indices.push(a,c,b,b,c,d);
        }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return new THREE.Mesh(g,material);
}

export function createWater() {
    const group=new THREE.Group();
    group.name="BrokenRidgeWater";

    const riverMat=loadWaterMaterial("/assets/materials/river_water",0x2e8ea6,4,20,{opacity:0.74,roughness:0.16,bumpScale:0.12});
    const fallMat=loadWaterMaterial("/assets/materials/waterfall_foam",0xdff6ff,2,6,{opacity:0.88,roughness:0.3,bumpScale:0.09});

    const riverPoints=[];
    for (let z=125; z>=-105; z-=5) {
        riverPoints.push({
            x: 26 + Math.sin(z*0.021)*12 + Math.sin(z*0.009)*8,
            z
        });
    }
    const river=buildRibbon(riverPoints,11,riverMat,0.20);
    river.receiveShadow=true;
    group.add(river);

    const streamPoints=[];
    for (let i=0;i<=18;i++) {
        const t=i/18;
        const z=20 - t*65;
        const x=-58 + t*60 + Math.sin(t*Math.PI*2)*6;
        streamPoints.push({x,z});
    }
    const streamMat=riverMat.clone();
    const stream=buildRibbon(streamPoints,6.5,streamMat,0.21);
    group.add(stream);

    const poolMat=riverMat.clone();
    const pool=new THREE.Mesh(new THREE.CircleGeometry(11,64),poolMat);
    pool.rotation.x=-Math.PI/2;
    pool.position.set(-34,terrainHeight(-34,-35)+0.24,-35);
    group.add(pool);

    const waterfall=new THREE.Mesh(new THREE.PlaneGeometry(9,17,8,20),fallMat);
    waterfall.position.set(-42,terrainHeight(-42,-35)+8.4,-35);
    waterfall.rotation.y=Math.PI/2;
    group.add(waterfall);

    return {
        group,
        update(delta) {
            const riverTextures=[river.material.map,river.material.normalMap,stream.material.map,stream.material.normalMap].filter(Boolean);
            for (const tex of riverTextures) tex.offset.y-=delta*0.025;
            const fallTextures=[waterfall.material.map,waterfall.material.normalMap].filter(Boolean);
            for (const tex of fallTextures) tex.offset.y-=delta*0.18;
        }
    };
}

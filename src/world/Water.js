import * as THREE from "three";
import { terrainHeight, riverCenter } from "./Terrain.js";

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

    const defs=[
        ["map","albedo",true],
        ["normalMap","normal",false],
        ["roughnessMap","roughness",false],
        ["bumpMap","height",false]
    ];

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

function buildRibbon(points,width,material,yOffset=0.2) {
    const positions=[],uvs=[],indices=[];

    // Build a smooth centerline height first. The previous version sampled
    // each river bank independently, which could twist a river section into
    // a near-vertical "sheet" whenever the terrain height differed sharply.
    const rawHeights=points.map((p)=>terrainHeight(p.x,p.z)+yOffset);
    const smoothHeights=rawHeights.map((h,i)=>{
        const start=Math.max(0,i-2);
        const end=Math.min(rawHeights.length-1,i+2);
        let sum=0;
        let count=0;
        for (let j=start;j<=end;j++) {
            sum+=rawHeights[j];
            count++;
        }
        return sum/count;
    });

    for (let i=1;i<smoothHeights.length;i++) {
        const maxStep=0.8;
        const delta=smoothHeights[i]-smoothHeights[i-1];
        if (Math.abs(delta)>maxStep) {
            smoothHeights[i]=smoothHeights[i-1]+Math.sign(delta)*maxStep;
        }
    }

    for (let i=0;i<points.length;i++) {
        const p=points[i];
        const prev=points[Math.max(0,i-1)];
        const next=points[Math.min(points.length-1,i+1)];
        const tangent=new THREE.Vector2(next.x-prev.x,next.z-prev.z).normalize();
        const n=new THREE.Vector2(-tangent.y,tangent.x);

        const leftX=p.x+n.x*width*0.5;
        const leftZ=p.z+n.y*width*0.5;
        const rightX=p.x-n.x*width*0.5;
        const rightZ=p.z-n.y*width*0.5;

        // Keep both river banks at the same Y so the surface stays horizontal
        // across its width instead of becoming a standing plane.
        const waterY=smoothHeights[i];

        positions.push(
            leftX,waterY,leftZ,
            rightX,waterY,rightZ
        );

        const v=i/(points.length-1);
        uvs.push(0,v*18,1,v*18);

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

    const riverMat=loadWaterMaterial(
        "/assets/materials/river_water",
        0x2e8ea6,
        4,
        24,
        {opacity:0.72,roughness:0.15,bumpScale:0.11}
    );

    const fallMat=loadWaterMaterial(
        "/assets/materials/waterfall_foam",
        0xdff6ff,
        2,
        7,
        {opacity:0.9,roughness:0.28,bumpScale:0.08}
    );

    // Main river follows the carved terrain channel.
    const riverPoints=[];
    for (let z=132;z>=-112;z-=4) {
        riverPoints.push({x:riverCenter(z),z});
    }
    const river=buildRibbon(riverPoints,8.2,riverMat,0.16);
    river.receiveShadow=true;
    group.add(river);

    // Tributary feeding the waterfall pool.
    const streamPoints=[];
    for (let i=0;i<=22;i++) {
        const t=i/22;
        const z=18-t*58;
        const x=-58+t*24+Math.sin(t*Math.PI*2.2)*4;
        streamPoints.push({x,z});
    }
    const streamMat=riverMat.clone();
    const stream=buildRibbon(streamPoints,4.8,streamMat,0.17);
    group.add(stream);

    // Pool recessed into the terrain.
    const poolMat=riverMat.clone();
    const pool=new THREE.Mesh(new THREE.CircleGeometry(10,64),poolMat);
    pool.rotation.x=-Math.PI/2;
    pool.position.set(-39,terrainHeight(-39,-36)+0.18,-36);
    group.add(pool);

    // Narrow waterfall sheet at the edge of the raised shelf.
    const fallGeo=new THREE.PlaneGeometry(7.5,15,8,24);
    const waterfall=new THREE.Mesh(fallGeo,fallMat);
    waterfall.position.set(-46,terrainHeight(-46,-34)+7.5,-34);
    waterfall.rotation.y=Math.PI/2;
    waterfall.rotation.z=-0.03;
    group.add(waterfall);

    // Soft foam disk where the waterfall hits.
    const foam=new THREE.Mesh(
        new THREE.CircleGeometry(6.5,48),
        fallMat.clone()
    );
    foam.rotation.x=-Math.PI/2;
    foam.position.set(-40,terrainHeight(-40,-36)+0.2,-36);
    group.add(foam);

    return {
        group,
        update(delta) {
            const riverTextures=[
                river.material.map,
                river.material.normalMap,
                stream.material.map,
                stream.material.normalMap
            ].filter(Boolean);

            for (const tex of riverTextures) {
                tex.offset.y-=delta*0.028;
            }

            const fallTextures=[
                waterfall.material.map,
                waterfall.material.normalMap,
                foam.material.map
            ].filter(Boolean);

            for (const tex of fallTextures) {
                tex.offset.y-=delta*0.2;
            }
        }
    };
}

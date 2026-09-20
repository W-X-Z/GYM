import * as THREE from '../vendor/three.module.js';
// Depth-buffered fallback for browsers without WebGL. The room is cached at
// each camera position; only the athlete, weights and feedback redraw per frame.
export class SoftwareRenderer {
 constructor({canvas}){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Canvas unavailable');
  this.shadowMap={};this.cache=new WeakMap();this.textures=new WeakMap();this.pixelRatio=1;
  this.surface=document.createElement('canvas');this.sctx=this.surface.getContext('2d');
  this.lowSphere=new THREE.SphereGeometry(1,12,8);this.light=new THREE.Vector3(-.4,1,.6).normalize();
 }
 setPixelRatio(){}
 setSize(w,h){
  this.w=w;this.h=h;this.canvas.width=w;this.canvas.height=h;
  const factor=Math.min(1,760/w,Math.sqrt(430000/(w*h)));
  this.rw=Math.max(1,Math.round(w*factor));this.rh=Math.max(1,Math.round(h*factor));
  this.surface.width=this.rw;this.surface.height=this.rh;this.frame=this.sctx.createImageData(this.rw,this.rh);
  this.depth=new Float32Array(this.rw*this.rh);this.staticPixels=null;this.staticDepth=null;this.staticKey='';
 }
 texture(map){
  if(!map?.image)return null;const image=map.image;let tex=this.textures.get(image);
  if(!tex){const cv=document.createElement('canvas');cv.width=image.width;cv.height=image.height;const ct=cv.getContext('2d');ct.drawImage(image,0,0);tex={data:ct.getImageData(0,0,cv.width,cv.height).data,w:cv.width,h:cv.height};this.textures.set(image,tex);}return tex;
 }
 drawMesh(obj,vp){
  const mat=obj.material;let geo=obj.geometry;if(!geo.attributes.position)return;
  if(geo.type==='SphereGeometry'&&geo.parameters.radius===1)geo=this.lowSphere;
  let data=this.cache.get(geo);
  if(!data){data={p:geo.attributes.position.array,n:geo.attributes.normal?.array,idx:geo.index?geo.index.array:Array.from({length:geo.attributes.position.count},(_,i)=>i),uv:geo.attributes.uv?.array};this.cache.set(geo,data);}
  const W=this.rw,H=this.rh,pixels=this.frame.data,depth=this.depth;
  const ce=new THREE.Matrix4().multiplyMatrices(vp,obj.matrixWorld).elements,ne=new THREE.Matrix3().getNormalMatrix(obj.matrixWorld).elements;
  const screen=new Float32Array(data.p.length/3*4),base=mat.color.clone().convertLinearToSRGB(),tex=this.texture(mat.map),light=this.light;
  for(let i=0,j=0;i<data.p.length;i+=3,j+=4){
   const x=data.p[i],y=data.p[i+1],z=data.p[i+2],iw=1/(ce[3]*x+ce[7]*y+ce[11]*z+ce[15]);
   screen[j]=((ce[0]*x+ce[4]*y+ce[8]*z+ce[12])*iw+1)*W/2;
   screen[j+1]=(1-(ce[1]*x+ce[5]*y+ce[9]*z+ce[13])*iw)*H/2;
   screen[j+2]=(ce[2]*x+ce[6]*y+ce[10]*z+ce[14])*iw;let shade=1;
   if(!mat.isMeshBasicMaterial&&data.n){const nx0=data.n[i],ny0=data.n[i+1],nz0=data.n[i+2],nx=ne[0]*nx0+ne[3]*ny0+ne[6]*nz0,ny=ne[1]*nx0+ne[4]*ny0+ne[7]*nz0,nz=ne[2]*nx0+ne[5]*ny0+ne[8]*nz0,len=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;shade=.69+.28*Math.max(0,(nx*light.x+ny*light.y+nz*light.z)/len)+.06*Math.max(0,ny/len);}
   screen[j+3]=shade;
  }
  for(let i=0;i<data.idx.length;i+=3){
   const ia=data.idx[i],ib=data.idx[i+1],ic=data.idx[i+2],ai=ia*4,bi=ib*4,ci=ic*4;
   const ax=screen[ai],ay=screen[ai+1],az=screen[ai+2],bx=screen[bi],by=screen[bi+1],bz=screen[bi+2],cx=screen[ci],cy=screen[ci+1],cz=screen[ci+2];
   if(az>1||bz>1||cz>1||az<-1||bz<-1||cz<-1)continue;
   const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(area)<.02||(mat.side!==THREE.DoubleSide&&area>0))continue;
   const minX=Math.max(0,Math.floor(Math.min(ax,bx,cx))),maxX=Math.min(W-1,Math.ceil(Math.max(ax,bx,cx))),minY=Math.max(0,Math.floor(Math.min(ay,by,cy))),maxY=Math.min(H-1,Math.ceil(Math.max(ay,by,cy))),inv=1/area;
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const w1=((bx-x)*(cy-y)-(by-y)*(cx-x))*inv,w2=((cx-x)*(ay-y)-(cy-y)*(ax-x))*inv,w3=1-w1-w2;
    if(w1<-.001||w2<-.001||w3<-.001)continue;
    const z=w1*az+w2*bz+w3*cz,di=y*W+x;if(z>depth[di]+.000001)continue;
    let r,g,b,alpha=mat.opacity;const shade=w1*screen[ai+3]+w2*screen[bi+3]+w3*screen[ci+3];
    if(tex&&data.uv){const u=w1*data.uv[ia*2]+w2*data.uv[ib*2]+w3*data.uv[ic*2],v=w1*data.uv[ia*2+1]+w2*data.uv[ib*2+1]+w3*data.uv[ic*2+1],tx=Math.min(tex.w-1,Math.max(0,Math.floor(u*tex.w))),ty=Math.min(tex.h-1,Math.max(0,Math.floor((1-v)*tex.h))),ti=(ty*tex.w+tx)*4;alpha*=tex.data[ti+3]/255;if(alpha<.01)continue;r=tex.data[ti];g=tex.data[ti+1];b=tex.data[ti+2];}
    else{r=base.r*255*shade;g=base.g*255*shade;b=base.b*255*shade;}
    const pi=di*4;if(alpha>=.999){pixels[pi]=r;pixels[pi+1]=g;pixels[pi+2]=b;}else{pixels[pi]=r*alpha+pixels[pi]*(1-alpha);pixels[pi+1]=g*alpha+pixels[pi+1]*(1-alpha);pixels[pi+2]=b*alpha+pixels[pi+2]*(1-alpha);}
    if(mat.depthWrite!==false)depth[di]=z;
   }
  }
 }
 render(scene,camera){
  if(!this.w||!this.h)return;
  scene.updateMatrixWorld();camera.updateMatrixWorld();camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),background=(scene.background?.isColor?scene.background:new THREE.Color('#dbe4ef')).clone().convertLinearToSRGB();
  const key=vp.elements.map(n=>n.toFixed(5)).join(',')+background.getHexString(),staticMeshes=[],dynamicMeshes=[];
  const visit=(obj,isStatic=false,isDynamic=false)=>{
   if(!obj.visible)return;isDynamic=isDynamic||!!obj.userData.dynamicScene;isStatic=!isDynamic&&(isStatic||!!obj.userData.staticScene);
   if(obj.isMesh&&obj.material.visible)(isStatic?staticMeshes:dynamicMeshes).push(obj);
   for(const child of obj.children)visit(child,isStatic,isDynamic);
  };visit(scene);
  if(key!==this.staticKey||!this.staticPixels){
   this.depth.fill(Infinity);const p=this.frame.data,r=background.r*255,g=background.g*255,b=background.b*255;
   for(let i=0;i<p.length;i+=4){p[i]=r;p[i+1]=g;p[i+2]=b;p[i+3]=255;}
   for(const mesh of staticMeshes)this.drawMesh(mesh,vp);
   this.staticPixels=new Uint8ClampedArray(this.frame.data);this.staticDepth=new Float32Array(this.depth);this.staticKey=key;
  }else{this.frame.data.set(this.staticPixels);this.depth.set(this.staticDepth);}
  for(const mesh of dynamicMeshes)this.drawMesh(mesh,vp);
  this.sctx.putImageData(this.frame,0,0);this.ctx.drawImage(this.surface,0,0,this.w,this.h);
 }
}

import * as THREE from '../vendor/three.module.js';
import { SoftwareRenderer } from './software-renderer.js';
import { STATIONS, bodyShape, level } from './game.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const mats=new Map();
function material(color){if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.76,metalness:0}));return mats.get(color);}
const sphereGeo=new THREE.SphereGeometry(1,18,12),boxGeo=new THREE.BoxGeometry(1,1,1),cylGeo=new THREE.CylinderGeometry(1,1,1,20);
function mesh(parent,geo,color,pos,scale){const m=new THREE.Mesh(geo,material(color));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(p,c,pos,s){return mesh(p,boxGeo,c,pos,s);}
function ball(p,c,pos,s){return mesh(p,sphereGeo,c,pos,s);}
function cylinder(p,c,pos,r,h){return mesh(p,cylGeo,c,pos,[r,h,r]);}
function rod(p,c,a,b,r){const m=mesh(p,cylGeo,c,[0,0,0],[1,1,1]);setRod(m,a,b,r);return m;}
function setRod(m,a,b,r){m.position.copy(a).add(b).multiplyScalar(.5);const d=b.clone().sub(a);m.scale.set(r,Math.max(.001,d.length()),r);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());}
function label(parent,text,w,h,pos,color='#315144',bg=null){const cv=document.createElement('canvas');cv.width=1024;cv.height=256;const ctx=cv.getContext('2d');if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);}ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 104px Arial';ctx.fillText(text,512,130);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.position.set(...pos);parent.add(m);return m;}
function barbell(parent,width=2.8){const g=new THREE.Group();parent.add(g);rod(g,'#bdc9c3',V(-width/2,0,0),V(width/2,0,0),.055);for(const side of [-1,1])for(let i=0;i<2;i++){const p=cylinder(g,i?'#37544e':'#e28b58',[side*(width/2-.3+i*.16),0,0],i?.31:.37,.14);p.rotation.z=Math.PI/2;}return g;}
class Athlete {
 constructor(parent){this.root=new THREE.Group();parent.add(this.root);this.shape={chest:1,arms:1,legs:1};this.skin='#ef9566';this.parts={};const s=this.skin;
 this.parts.belly=ball(this.root,s,[0,1.3,0],[.39,.48,.27]);this.parts.chest=ball(this.root,s,[0,1.7,0],[.43,.34,.27]);
 this.pecs=[-1,1].map(side=>ball(this.root,'#f2a173',[side*.19,1.67,.14],[.235,.225,.2]));
 this.parts.shorts=ball(this.root,'#28484c',[0,.94,0],[.4,.27,.27]);this.parts.waist=box(this.root,'#faf1da',[0,1.08,.01],[.68,.06,.48]);
 this.head=new THREE.Group();this.head.position.y=2.19;this.root.add(this.head);ball(this.head,s,[0,0,0],[.32,.35,.3]);ball(this.head,'#f2a173',[0,-.035,.29],[.09,.08,.07]);for(const side of [-1,1]){ball(this.head,'#203432',[side*.115,.02,.274],[.027,.035,.02]);ball(this.head,s,[side*.30,-.02,0],[.065,.10,.06]);}
 const headband=cylinder(this.head,'#f6efdc',[0,.17,0],.318,.085);headband.scale.z*=.94;
 this.arms=[-1,1].map(side=>({side,shoulder:ball(this.root,s,[0,0,0],[1,1,1]),upper:ball(this.root,s,[0,0,0],[1,1,1]),lower:ball(this.root,s,[0,0,0],[1,1,1]),hand:ball(this.root,s,[0,0,0],[.15,.16,.14]),wrist:ball(this.root,'#f7efd9',[0,0,0],[.15,.075,.14])}));
 this.legs=[-1,1].map(side=>({side,upper:ball(this.root,s,[0,0,0],[1,1,1]),lower:ball(this.root,s,[0,0,0],[1,1,1]),shoe:ball(this.root,'#f9f3e4',[side*.22,.13,.10],[.20,.14,.33]),sock:ball(this.root,'#dce5cf',[side*.22,.33,0],[.13,.13,.13])}));
 }
 limb(m,a,b,r){m.position.copy(a).add(b).multiplyScalar(.5);const d=b.clone().sub(a);m.scale.set(r,d.length()*.58,r);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());}
 pose(state,type,stroke,time,moving=false){const target=bodyShape(state);for(const k of Object.keys(target))this.shape[k]+=(target[k]-this.shape[k])*.075;const s=this.shape,c=s.chest,a=s.arms,l=s.legs;const bend=type==='squat'?(1-stroke)*.36:0;
 this.parts.chest.scale.set(.43*c,.34+.06*(c-1),.27+.15*(c-1));this.parts.chest.position.y=1.7-bend;this.parts.belly.position.y=1.3-bend;this.parts.shorts.position.y=.94-bend;this.parts.shorts.scale.x=.4+Math.max(l-1,0)*.07;this.parts.waist.position.y=1.08-bend;this.head.position.y=2.19-bend;
 this.pecs.forEach((p,i)=>{p.position.set((i?1:-1)*.19*c,1.67-bend,.14+.10*(c-1));p.scale.set(.235*c,.15+.09*(c-1),.15+.10*(c-1));});
 this.arms.forEach(part=>{const side=part.side;const shoulder=V(side*(.40*c),1.73-bend,0);let elbow=V(side*(.53*c),1.30-bend,.015),hand=V(side*(.57*c),.96-bend,.04);
 if(type==='bench'){elbow=V(side*.85,1.55,.25+stroke*.48);hand=V(side*.72,1.55,.4+stroke*.8);}
 else if(type==='curl'){elbow=V(side*(.5*c),1.3,.04);hand=V(side*(.58*c),.93+stroke*.80,.22+Math.sin(stroke*Math.PI)*.28);}
 else if(type==='squat'){elbow=V(side*.82,1.68-bend,.08);hand=V(side*.73,2.0-bend,-.04);}
 else if(moving){hand.z+=Math.sin(time*9+side)*.25;elbow.z=hand.z*.5;}
 part.shoulder.position.copy(shoulder);part.shoulder.scale.setScalar(.205*a);this.limb(part.upper,shoulder,elbow,.17*a);this.limb(part.lower,elbow,hand,.135*a);part.hand.position.copy(hand);part.hand.scale.set(.15+.03*(a-1),.16+.03*(a-1),.14+.03*(a-1));part.wrist.position.copy(hand.clone().lerp(elbow,.13));part.wrist.visible=type!=='bench';
 });
 this.legs.forEach(part=>{const side=part.side,hip=V(side*.225,.93-bend,0),knee=V(side*(.25+bend*.15),.54-bend*.25,bend*.85),ankle=V(side*.25,.22,0);if(moving){knee.z+=Math.sin(time*9+side*Math.PI/2)*.18;ankle.z+=Math.sin(time*9+side*Math.PI/2)*.23;}this.limb(part.upper,hip,knee,.20*l);this.limb(part.lower,knee,ankle,.14*l);part.shoe.position.set(ankle.x,.13,ankle.z+.1);part.sock.position.set(ankle.x,.33,ankle.z);});
 if(!type)this.head.rotation.z=Math.sin(time*1.6)*.025;else this.head.rotation.z=0;
 }
}
export class GymScene {
 constructor(canvas,onSelect){this.canvas=canvas;this.onSelect=onSelect;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#d9e6df');this.camera=new THREE.PerspectiveCamera(35,1,.1,120);this.camera.position.set(14,15,21);this.look=V(0,.4,0);this.camera.lookAt(this.look);
 try{this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch{this.renderer=new SoftwareRenderer({canvas});}this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
 this.scene.add(new THREE.HemisphereLight('#fffcf0','#7c9984',2.4));const sun=new THREE.DirectionalLight('#fff3d7',3.1);sun.position.set(-4,14,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.5,far:40});sun.shadow.bias=-.0004;sun.shadow.normalBias=.03;this.scene.add(sun);const fill=new THREE.DirectionalLight('#d7eeef',1);fill.position.set(8,5,-5);this.scene.add(fill);
 this.hits=[];this.weights={};this.buildRoom();this.athlete=new Athlete(this.scene);this.athlete.root.position.set(0,0,3.7);this.athlete.root.rotation.y=.25;this.walkTo=null;this.active=null;this.stroke=0;this.cameraMode=0;this.clock=new THREE.Clock();this.state=null;this.onFrame=null;this.particles=[];this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
 const ray=new THREE.Raycaster();let down=null;canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(this.active||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>10)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hits=ray.intersectObjects(this.hits,true);if(hits.length)this.onSelect(hits[0].object.userData.station);});
 this.loop();
 }
 buildRoom(){const room=new THREE.Group();this.scene.add(room);box(room,'#8da697',[0,-.25,0],[17.2,.48,11.7]);box(room,'#e0dfcc',[0,-.025,0],[17,.10,11.5]);
 for(let x=-8;x<=8;x+=1)box(room,'#d2d2bf',[x,.029,0],[.015,.008,11.4]);for(let z=-5;z<=5;z++)box(room,'#d2d2bf',[0,.03,z],[17,.008,.015]);
 box(room,'#bccdbb',[0,1.65,-5.65],[17,3.4,.18]);box(room,'#a6b9a7',[-8.5,.55,0],[.16,1.1,11.4]);box(room,'#d5ddc6',[0,3.36,-5.65],[17,.13,.30]);box(room,'#496651',[0,.16,-5.48],[17,.32,.09]);
 const sign=label(room,'GYM CLUB',6,1.5,[0,2.3,-5.53]);label(room,'ONE MORE REP.',3.8,.95,[0,1.25,-5.52],'#708775');
 for(const x of [-5.8,5.8]){box(room,'#6e8e78',[x,2.03,-5.49],[3.25,2.15,.12]);box(room,'#e8eee0',[x,2.03,-5.40],[3.03,1.93,.05]);box(room,'#b4caba',[x,2.03,-5.35],[.08,1.93,.06]);box(room,'#b4caba',[x,2.03,-5.35],[3.03,.08,.06]);box(room,'#ebedda',[x,.99,-5.27],[3.4,.12,.4]);}
 // Storage bench, towels and bottles are functional low-poly room props.
 box(room,'#aa7852',[-5.5,.65,-3.8],[3,.15,.6]);for(const x of [-6.6,-4.4])box(room,'#486355',[x,.3,-3.8],[.13,.65,.5]);box(room,'#f5eed9',[-5.7,.8,-3.8],[.75,.13,.45]);box(room,'#e5a377',[-5.6,.89,-3.8],[.70,.08,.40]);cylinder(room,'#789c87',[-4.8,.91,-3.8],.13,.38);cylinder(room,'#36574b',[-4.8,1.13,-3.8],.09,.07);
 for(let i=0;i<3;i++){box(room,'#8fa798',[4.5+i*.72,1.04,-4.75],[.66,2.0,.65]);box(room,'#b5c5ae',[4.5+i*.72,1.06,-4.39],[.55,1.85,.04]);box(room,'#466551',[4.68+i*.72,1.05,-4.34],[.035,.19,.03]);for(let j=0;j<3;j++)box(room,'#819880',[4.5+i*.72,1.72+j*.07,-4.35],[.33,.018,.01]);}
 cylinder(room,'#e5bc8e',[-7.55,.4,-4.55],.39,.75);for(let i=0;i<8;i++){const angle=i*2.4,x=Math.cos(angle)*.4,z=Math.sin(angle)*.35;rod(room,'#587e52',V(-7.55,.7,-4.55),V(-7.55+x,1.5+(i%3)*.2,-4.55+z),.025);const leaf=ball(room,i%2?'#527b50':'#7c9b5e',[-7.55+x,1.4+(i%3)*.2,-4.55+z],[.18,.42,.1]);leaf.rotation.z=-x;}
 for(const station of STATIONS){const g=new THREE.Group();g.position.set(station.x,0,station.z);room.add(g);box(g,'#93a99b',[0,.055,.1],[3.7,.065,3.4]);for(let x=-1.7;x<1.8;x+=.4)box(g,'#8aa292',[x,.09,.1],[.012,.005,3.2]);const mark=label(g,station.label,2.7,.67,[0,.095,1.9],'#5f7c66');mark.rotation.x=-Math.PI/2;
 if(station.id==='bench'){for(const x of [-.48,.48]){box(g,'#3d5852',[x,.37,.1],[.12,.65,2.0]);for(const z of [-.55,.95])box(g,'#3d5852',[x,.42,z],[.12,.8,.15]);}box(g,'#374e49',[0,.78,.1],[.88,.16,2.4]);box(g,'#e09b66',[0,.87,.1],[.82,.09,2.27]);for(const x of [-1.25,1.25]){box(g,'#61766b',[x,.9,-.6],[.10,1.75,.13]);box(g,'#566f61',[x,.13,-.45],[.4,.17,1.1]);box(g,'#6c7f74',[x,1.68,-.49],[.12,.12,.36]);}const b=barbell(g,3.3);b.position.set(0,1.82,-.6);this.weights.bench=b;
 }else if(station.id==='curl'){for(const x of [-1.2,1.2])box(g,'#52675e',[x,.57,-1],[.1,1.1,.6]);box(g,'#52675e',[0,.96,-1],[2.7,.12,.48]);for(let i=0;i<4;i++){const b=barbell(g,.49);b.scale.setScalar(.65);b.position.set(-.9+i*.6,1.18,-1);}this.weights.curl=[barbell(g,.64),barbell(g,.64)];this.weights.curl.forEach((b,i)=>{b.position.set(i?.62:-.62,.38,.7);b.scale.setScalar(.8);});
 }else{for(const x of [-1.35,1.35]){box(g,'#506b5c',[x,1.45,-.5],[.13,2.85,.13]);box(g,'#506b5c',[x,.15,0],[.18,.22,2.2]);box(g,'#94a993',[x,1.92,-.25],[.13,.10,.6]);}box(g,'#506b5c',[0,2.83,-.5],[2.8,.12,.13]);const b=barbell(g,3.3);b.position.set(0,2.02,-.2);this.weights.squat=b;}
 const hit=new THREE.Mesh(new THREE.BoxGeometry(3.5,2.7,3.4),new THREE.MeshBasicMaterial({visible:false}));hit.position.set(0,1.4,0);hit.userData.station=station.id;g.add(hit);this.hits.push(hit);}
 }
 resize(){const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
 enter(station){this.active=station;this.stroke=0;this.walkTo=null;const root=this.athlete.root;root.rotation.set(0,0,0);if(station.id==='bench'){root.position.set(station.x,.94,station.z+1.4);root.rotation.x=-Math.PI/2;}else root.position.set(station.x,0,station.z+.45);}
 leave(){this.active=null;this.stroke=0;this.athlete.root.rotation.set(0,.25,0);this.athlete.root.position.set(0,0,3.7);this.resetWeights();}
 resetWeights(){this.weights.bench.position.set(0,1.82,-.6);this.weights.squat.position.set(0,2.02,-.2);this.weights.curl.forEach((b,i)=>b.position.set(i?.62:-.62,.38,.7));}
 walk(station,done){if(this.renderer instanceof SoftwareRenderer){done();return;}this.walkTo={station,done};this.athlete.root.rotation.set(0,0,0);}
 projectPoint(x,y,z){return this.project(V(x,y,z));}
 project(v){const p=v.clone().project(this.camera);return {x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2};}
 handlePosition(){if(!this.active)return {x:0,y:0};const s=this.active,t=this.stroke;let v;if(s.id==='bench')v=V(s.x+.9,1.34+t*.8,s.z-.15);else if(s.id==='curl')v=V(s.x+.7,.93+t*.8,s.z+.7);else v=V(s.x+.9,2.0-(1-t)*.36,s.z+.4);return this.project(v);}
 burst(){const root=this.athlete.root.position;for(let i=0;i<12;i++){const m=ball(this.scene,i%2?'#f5c177':'#f0eee0',[root.x,1.8,root.z],[.055,.055,.055]);this.particles.push({m,v:V((Math.random()-.5)*3,1+Math.random()*2,(Math.random()-.5)*3),life:1});}}
 loop(){requestAnimationFrame(()=>this.loop());const dt=Math.min(this.clock.getDelta(),.05),time=this.clock.elapsedTime;
 if(this.state){const s=this.active;let pos,look;if(s){look=V(s.x,1.1,s.z+.2);pos=s.id==='bench'?V(s.x+4.8,5.1,s.z+7.0):V(s.x+3.2,3.1,s.z+7.8);if(this.width<600)pos.sub(look).multiplyScalar(1.12).add(look);}else{const mobile=this.width/this.height<1;const factor=mobile?1.28:1;pos=this.cameraMode?V(-11*factor,13*factor,20*factor):V(12*factor,14*factor,20*factor);look=V(0,.4,.0);}this.camera.position.lerp(pos,this.renderer instanceof SoftwareRenderer?1:1-Math.exp(-dt*4));this.look.lerp(look,this.renderer instanceof SoftwareRenderer?1:1-Math.exp(-dt*4));this.camera.lookAt(this.look);
 if(this.walkTo){const goal=V(this.walkTo.station.x,0,this.walkTo.station.z+2.0),delta=goal.clone().sub(this.athlete.root.position);if(delta.length()<.12){const done=this.walkTo.done;this.walkTo=null;done();}else{const distance=delta.length();this.athlete.root.position.addScaledVector(delta.normalize(),Math.min(dt*7,distance));this.athlete.root.rotation.y=Math.atan2(delta.x,delta.z);}}
 this.athlete.pose(this.state,s?.id,this.stroke,time,!!this.walkTo);
 if(s){if(s.id==='bench')this.weights.bench.position.set(0,1.34+this.stroke*.8,-.15);if(s.id==='curl'){this.weights.curl.forEach((b,i)=>{const a=this.athlete.arms[i];b.position.copy(a.hand.position).add(V(0,0,.45));});}if(s.id==='squat')this.weights.squat.position.set(0,2.0-(1-this.stroke)*.36,.41);}
 for(const part of ['chest','arms','legs']){const weight=this.weights[part==='chest'?'bench':part==='arms'?'curl':'squat'];const scale=level(this.state,part+'Load')?1.16:1;for(const w of Array.isArray(weight)?weight:[weight])w.scale.setScalar((Array.isArray(weight)?.8:1)*scale);}
 }
 this.particles=this.particles.filter(p=>{p.life-=dt;p.v.y-=3*dt;p.m.position.addScaledVector(p.v,dt);p.m.scale.setScalar(Math.max(.001,.055*p.life));if(p.life<=0){this.scene.remove(p.m);return false;}return true;});
 this.renderer.render(this.scene,this.camera);if(this.onFrame)this.onFrame();
 }
}

export const PARTS = { chest: { name:'가슴', color:'#f48c5a' }, arms: { name:'팔', color:'#c2a3ef' }, legs: { name:'하체', color:'#9dccb3' } };
export const STATIONS = [
 {id:'bench',name:'벤치프레스',part:'chest',label:'CHEST',x:-4.7,z:0.5,weight:20},
 {id:'curl',name:'덤벨 컬',part:'arms',label:'ARMS',x:0,z:0.5,weight:5},
 {id:'squat',name:'스쿼트',part:'legs',label:'LEGS',x:4.7,z:0.5,weight:20}
];
export const NODES = [
 {id:'stamina',name:'기초 체력',desc:'최대 체력 +10',icon:'heart',cost:4,max:5,branch:'base',requires:[]},
 {id:'form',name:'올바른 자세',desc:'모든 운동 포인트 +1',icon:'target',cost:6,max:4,branch:'base',requires:[]},
 {id:'chest',name:'흉근 집중',desc:'가슴 운동 포인트 +2',icon:'bench',cost:8,max:4,branch:'chest',requires:['form']},
 {id:'arms',name:'이두 집중',desc:'팔 운동 포인트 +2',icon:'curl',cost:8,max:4,branch:'arms',requires:['form']},
 {id:'legs',name:'하체 집중',desc:'하체 운동 포인트 +2',icon:'squat',cost:8,max:4,branch:'legs',requires:['form']},
 {id:'efficiency',name:'호흡 조절',desc:'1회당 체력 소모 −1',icon:'wind',cost:10,max:4,branch:'base',requires:['stamina']},
 {id:'tempo',name:'동작 숙련',desc:'동작 인정 최소 시간 −10%',icon:'bolt',cost:10,max:3,branch:'base',requires:['form']},
 {id:'chestLoad',name:'벤치 증량',desc:'벤치 포인트 ×1.5 · 바벨 증량',icon:'weight',cost:22,max:1,branch:'chest',requires:['chest']},
 {id:'armsLoad',name:'덤벨 증량',desc:'덤벨 포인트 ×1.5 · 덤벨 증량',icon:'weight',cost:22,max:1,branch:'arms',requires:['arms']},
 {id:'legsLoad',name:'스쿼트 증량',desc:'스쿼트 포인트 ×1.5 · 바벨 증량',icon:'weight',cost:22,max:1,branch:'legs',requires:['legs']},
 {id:'routine',name:'균형 루틴',desc:'전날 세 부위 운동 시 다음 날 체력 +10',icon:'cycle',cost:18,max:1,branch:'base',requires:['efficiency']},
 {id:'master',name:'근성장 가속',desc:'모든 운동 포인트 ×1.5',icon:'spark',cost:40,max:1,branch:'base',requires:['chestLoad','armsLoad','legsLoad']}
];
export function freshState(){return {version:1,day:1,points:0,energy:24,lifetime:{chest:0,arms:0,legs:0},levels:Object.fromEntries(NODES.map(n=>[n.id,0])),reps:{chest:0,arms:0,legs:0},today:{chest:0,arms:0,legs:0},dayStart:{chest:0,arms:0,legs:0},bonus:0,sound:true};}
export const level=(s,id)=>s.levels[id]||0;
export const maxEnergy=s=>24+level(s,'stamina')*10+(s.bonus||0);
export const repCost=s=>10-level(s,'efficiency');
export const price=(s,n)=>Math.ceil(n.cost*Math.pow(1.65,level(s,n.id)));
export const unlocked=(s,n)=>n.requires.every(id=>level(s,id)>0);
export function reward(s,part){return Math.round((4+level(s,'form')+2*level(s,part))*(level(s,part+'Load')?1.5:1)*(level(s,'master')?1.5:1));}
export function completeRep(s,part){
 if(!PARTS[part]||s.energy<repCost(s))return null;
 const points=reward(s,part);s.points+=points;s.lifetime[part]+=points;s.reps[part]++;s.today[part]++;s.energy-=repCost(s);return {points,part,exhausted:s.energy<repCost(s)};
}
export function buyNode(s,id){const n=NODES.find(n=>n.id===id);if(!n||!unlocked(s,n)||level(s,id)>=n.max||s.points<price(s,n))return false; s.points-=price(s,n);s.levels[id]++;if(id==='stamina')s.energy+=10;return true;}
export function nextDay(s){s.bonus=level(s,'routine')&&Object.values(s.today).every(v=>v>0)?10:0;s.day++;s.energy=maxEnergy(s);s.today={chest:0,arms:0,legs:0};s.dayStart={...s.lifetime};}
export function bodyShape(s){return {chest:1+1.5*(1-Math.exp(-s.lifetime.chest/180)),arms:1+1.65*(1-Math.exp(-s.lifetime.arms/150)),legs:1+1.35*(1-Math.exp(-s.lifetime.legs/180))};}
export function restore(raw){
 const s=freshState();try{const v=JSON.parse(raw);if(v?.version!==1)return s; const num=(n,max=1e9)=>Number.isFinite(n)?Math.min(max,Math.max(0,Math.floor(n))):0;
 s.day=Math.max(1,num(v.day));s.points=num(v.points);for(const p of Object.keys(PARTS)){s.lifetime[p]=num(v.lifetime?.[p]);s.reps[p]=num(v.reps?.[p]);s.today[p]=num(v.today?.[p]);s.dayStart[p]=Math.min(s.lifetime[p],num(v.dayStart?.[p]));}
 for(const n of NODES)s.levels[n.id]=num(v.levels?.[n.id],n.max);s.bonus=v.bonus===10&&s.levels.routine?10:0;s.energy=Math.min(maxEnergy(s),num(v.energy));s.sound=v.sound!==false;return s;}catch{return s;}
}
// One complete bottom → top → bottom stroke is one repetition. Partial strokes never score.
export class RepCycle {
 constructor(){this.reset();}
 reset(){this.started=null;this.peak=false;this.value=0;}
 update(value,now,minDuration=550){this.value=Math.max(0,Math.min(1,value));if(this.started===null&&this.value>0.08)this.started=now;if(this.value>=.94)this.peak=true;
 if(this.peak&&this.value<=.06){const valid=this.started!==null&&now-this.started>=minDuration;this.reset();return valid;}return false;}
}

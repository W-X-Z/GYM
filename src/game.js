export const PARTS = {
 chest:{name:'가슴',color:'#f48c5a'},
 arms:{name:'팔',color:'#c2a3ef'},
 legs:{name:'하체',color:'#9dccb3'}
};
export const STATIONS = [
 {id:'bench',name:'벤치프레스',part:'chest',label:'CHEST',x:-4.7,z:0.5,weight:20},
 {id:'curl',name:'덤벨 컬',part:'arms',label:'ARMS',x:0,z:0.5,weight:5},
 {id:'squat',name:'스쿼트',part:'legs',label:'LEGS',x:4.7,z:0.5,weight:20}
];
export const NODES = [
 {id:'stamina',name:'한 세트 더',desc:'최대 체력 +10 · 지금 체력도 +10',icon:'heart',cost:8,max:5,branch:'base',requires:[]},
 {id:'form',name:'자극을 찾아서',desc:'모든 운동의 기본 보상 +2 GP',icon:'target',cost:8,max:4,branch:'base',requires:[]},
 {id:'chest',name:'가슴에 집중',desc:'가슴 운동의 기본 보상 +3 GP',icon:'bench',cost:16,max:4,branch:'chest',requires:['form']},
 {id:'arms',name:'팔에 집중',desc:'팔 운동의 기본 보상 +3 GP',icon:'curl',cost:16,max:4,branch:'arms',requires:['form']},
 {id:'legs',name:'하체에 집중',desc:'하체 운동의 기본 보상 +3 GP',icon:'squat',cost:16,max:4,branch:'legs',requires:['form']},
 {id:'efficiency',name:'호흡 조절',desc:'운동 한 번에 쓰는 체력 −1',icon:'wind',cost:18,max:4,branch:'base',requires:['stamina']},
 {id:'tempo',name:'동작 숙련',desc:'PERFECT를 위한 되돌리기 여유 +0.1초',icon:'bolt',cost:18,max:3,branch:'base',requires:['form']},
 {id:'chestLoad',name:'원판 추가',desc:'가슴 보상 ×1.5 · 더 무거운 바벨',icon:'weight',cost:45,max:1,branch:'chest',requires:['chest']},
 {id:'armsLoad',name:'덤벨 교체',desc:'팔 보상 ×1.5 · 더 무거운 덤벨',icon:'weight',cost:45,max:1,branch:'arms',requires:['arms']},
 {id:'legsLoad',name:'하체는 진심',desc:'하체 보상 ×1.5 · 더 무거운 바벨',icon:'weight',cost:45,max:1,branch:'legs',requires:['legs']},
 {id:'routine',name:'오늘도 전신',desc:'세 부위를 운동하면 다음 날 체력 +10',icon:'cycle',cost:30,max:1,branch:'base',requires:['efficiency']},
 {id:'master',name:'성장 리미트 해제',desc:'모든 운동 보상 ×1.5',icon:'spark',cost:120,max:1,branch:'base',requires:['chestLoad','armsLoad','legsLoad']},
 {id:'precision',name:'완벽한 호흡',desc:'PERFECT 성공 시 체력 +2 · 펌핑 중 제외',icon:'target',cost:24,max:1,branch:'base',requires:['tempo']},
 {id:'superset',name:'슈퍼세트',desc:'운동을 바꾼 직후 첫 보상 ×1.5',icon:'cycle',cost:30,max:1,branch:'base',requires:['routine']},
 {id:'afterburn',name:'펌핑 중독',desc:'펌핑 발동 시 무료 운동 +2회',icon:'bolt',cost:45,max:1,branch:'base',requires:['master']}
];
export const MILESTONES = [
 {id:'rookie',name:'루틴 입문',threshold:60,points:24},
 {id:'growth',name:'몸이 달라졌다',threshold:180,points:45},
 {id:'challenger',name:'중량 도전자',threshold:420,points:80},
 {id:'beast',name:'인간 덤벨',threshold:900,points:140},
 {id:'legend',name:'헬스장 전설',threshold:1800,points:260}
];
const emptyParts = () => ({chest:0,arms:0,legs:0});
const validPart = part => Object.hasOwn(PARTS,part);

export function freshState(){
 return {
  version:2,day:1,points:0,energy:40,lifetime:emptyParts(),
  levels:Object.fromEntries(NODES.map(n=>[n.id,0])),
  reps:emptyParts(),today:emptyParts(),dayStart:emptyParts(),
  bonus:0,sound:true,combo:0,rushLeft:0,rushTotal:0,
  balancedToday:false,milestones:[],lastPart:null
 };
}
export const level = (s,id) => s.levels[id] || 0;
export const maxEnergy = s => 40 + level(s,'stamina')*10 + (s.bonus || 0);
export const repCost = s => 8 - level(s,'efficiency');
export const canRep = s => s.rushLeft > 0 || s.energy >= repCost(s);
export const perfectWindow = s => 650 + level(s,'tempo')*100;
export const price = (s,n) => Math.ceil(n.cost*Math.pow(1.65,level(s,n.id)));
export const unlocked = (s,n) => n.requires.every(id=>level(s,id)>0);
export const totalGrowth = s => Object.keys(PARTS).reduce((sum,part)=>sum+s.lifetime[part],0);

export function reward(s,part){
 if(!validPart(part))return 0;
 return Math.round((8+2*level(s,'form')+3*level(s,part))
  *(level(s,part+'Load')?1.5:1)*(level(s,'master')?1.5:1));
}

export function completeRep(s,part,quality='good'){
 if(!validPart(part)||!['good','perfect'].includes(quality)||!canRep(s))return null;
 const inRush=s.rushLeft>0;
 const switched=!!level(s,'superset')&&s.lastPart!==null&&s.lastPart!==part;
 const multiplier=(quality==='perfect'?1.5:1)*(inRush?2:1)*(switched?1.5:1);
 const points=Math.round(reward(s,part)*multiplier);
 s.points+=points;
 s.lifetime[part]+=points;
 s.reps[part]++;
 s.today[part]++;
 s.lastPart=part;
 s.combo++;
 const combo=s.combo;
 let rushStarted=false;
 let energyRecovered=0;
 if(inRush){
  s.rushLeft--;
  if(s.rushLeft===0){s.combo=0;s.rushTotal=0;}
 }else{
  s.energy-=repCost(s);
  if(quality==='perfect'&&level(s,'precision')){
   energyRecovered=Math.min(2,maxEnergy(s)-s.energy);
   s.energy+=energyRecovered;
  }
  if(s.combo>=5){
   s.rushLeft=5+2*level(s,'afterburn');
   s.rushTotal=s.rushLeft;
   rushStarted=true;
  }
 }
 // Currency bonuses never inflate a body part's earned growth.
 const bonus=!s.balancedToday&&Object.values(s.today).every(count=>count>0)?20:0;
 if(bonus){s.balancedToday=true;s.points+=bonus;}
 return {points,part,exhausted:!canRep(s),quality,combo,multiplier,rushStarted,
  rushLeft:s.rushLeft,bonus,switched,energyRecovered};
}

export function buyNode(s,id){
 const n=NODES.find(n=>n.id===id);
 if(!n||!unlocked(s,n)||level(s,id)>=n.max||s.points<price(s,n))return false;
 s.points-=price(s,n);
 s.levels[id]++;
 if(id==='stamina')s.energy+=10;
 return true;
}

export function nextDay(s){
 s.bonus=level(s,'routine')&&Object.values(s.today).every(count=>count>0)?10:0;
 s.day++;
 s.energy=maxEnergy(s);
 s.today=emptyParts();
 s.dayStart={...s.lifetime};
 s.combo=0;
 s.rushLeft=0;
 s.rushTotal=0;
 s.balancedToday=false;
 s.lastPart=null;
}

export function rank(s){
 const total=totalGrowth(s);
 const achieved=MILESTONES.filter(goal=>total>=goal.threshold);
 const last=achieved.at(-1);
 return {level:achieved.length,name:last?.name || '첫 등록',threshold:last?.threshold || 0};
}
export function nextGoal(s){return MILESTONES.find(goal=>totalGrowth(s)<goal.threshold) || null;}
export function claimMilestone(s){
 const total=totalGrowth(s);
 const goals=MILESTONES.filter(goal=>total>=goal.threshold&&!s.milestones.includes(goal.id));
 if(!goals.length)return null;
 const points=goals.reduce((sum,goal)=>sum+goal.points,0);
 s.points+=points;
 s.milestones.push(...goals.map(goal=>goal.id));
 return {points,goals};
}

export function bodyShape(s){
 // Keep the zero-point body small; every early rep produces a visible change.
 // Asymptotic limits prevent late-game geometry from swallowing the equipment.
 return {
  chest:1+1.7*(1-Math.exp(-Math.max(0,s.lifetime.chest)/110)),
  arms:1+1.9*(1-Math.exp(-Math.max(0,s.lifetime.arms)/90)),
  legs:1+1.55*(1-Math.exp(-Math.max(0,s.lifetime.legs)/120))
 };
}

export function restore(raw){
 const s=freshState();
 try{
  const v=JSON.parse(raw);
  if(![1,2].includes(v?.version))return s;
  const num=(n,max=1e9)=>Number.isFinite(n)?Math.min(max,Math.max(0,Math.floor(n))):0;
  s.day=Math.max(1,num(v.day));
  s.points=num(v.points);
  for(const part of Object.keys(PARTS)){
   s.lifetime[part]=num(v.lifetime?.[part]);
   s.reps[part]=num(v.reps?.[part]);
   s.today[part]=num(v.today?.[part]);
   s.dayStart[part]=Math.min(s.lifetime[part],num(v.dayStart?.[part]));
  }
  for(const node of NODES)s.levels[node.id]=num(v.levels?.[node.id],node.max);
  s.bonus=v.bonus===10&&s.levels.routine?10:0;
  s.energy=Math.min(maxEnergy(s),num(v.energy));
  s.sound=v.sound!==false;
  if(v.version===2){
   s.rushTotal=v.rushTotal===7&&level(s,'afterburn')?7:5;
   s.rushLeft=num(v.rushLeft,s.rushTotal);
   // Keep the rush's original length even if a passive is bought mid-rush.
   s.combo=s.rushLeft?5+s.rushTotal-s.rushLeft:num(v.combo,4);
   if(!s.rushLeft)s.rushTotal=0;
   s.balancedToday=v.balancedToday===true||Object.values(s.today).every(count=>count>0);
   s.lastPart=validPart(v.lastPart)?v.lastPart:null;
   if(Array.isArray(v.milestones)){
    s.milestones=MILESTONES.filter(goal=>v.milestones.includes(goal.id)&&totalGrowth(s)>=goal.threshold).map(goal=>goal.id);
   }
  }else{
   // Preserve old progress without granting the same daily bonus retroactively.
   // Newly introduced lifetime milestones remain claimable after migration.
   s.balancedToday=Object.values(s.today).every(count=>count>0);
  }
  return s;
 }catch{return s;}
}

// One complete bottom → top → bottom stroke is one repetition. Partial strokes never score.
export class RepCycle {
 constructor(){this.reset();}
 reset(){this.started=null;this.peak=false;this.value=0;}
 update(value,now,minDuration=360){
  if(!Number.isFinite(value)||!Number.isFinite(now))return false;
  this.value=Math.max(0,Math.min(1,value));
  if(this.started===null&&this.value>0.08)this.started=now;
  if(this.value>=.94)this.peak=true;
  if(this.peak&&this.value<=.06){
   const valid=this.started!==null&&now-this.started>=minDuration;
   this.reset();
   return valid;
  }
  return false;
 }
}

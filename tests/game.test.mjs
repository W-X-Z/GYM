import test from 'node:test';
import assert from 'node:assert/strict';
import {
 freshState,completeRep,buyNode,nextDay,restore,maxEnergy,repCost,canRep,
 bodyShape,RepCycle,NODES,price,reward,perfectWindow,totalGrowth,rank,
 nextGoal,claimMilestone,MILESTONES
} from '../src/game.js';

test('first day gives five normal reps followed by exactly five free rush reps',()=>{
 const s=freshState();
 assert.equal(s.energy,40);
 for(let i=1;i<=5;i++){
  const result=completeRep(s,'chest');
  assert.equal(result.points,8);
  assert.equal(result.combo,i);
  assert.equal(result.rushStarted,i===5);
  assert.equal(result.exhausted,false);
  assert.equal(s.energy,40-8*i);
 }
 assert.equal(s.rushLeft,5);
 assert.equal(canRep(s),true);
 for(let i=1;i<=5;i++){
  const result=completeRep(s,'chest');
  assert.equal(result.points,16);
  assert.equal(result.multiplier,2);
  assert.equal(result.combo,5+i);
  assert.equal(result.rushLeft,5-i);
  assert.equal(result.rushStarted,false);
  assert.equal(result.exhausted,i===5);
  assert.equal(s.energy,0);
 }
 assert.equal(s.combo,0);
 assert.equal(s.rushTotal,0);
 assert.equal(canRep(s),false);
 assert.equal(completeRep(s,'chest'),null);
 assert.equal(s.lifetime.chest,120);
 assert.equal(s.points,120);
});

test('PERFECT multiplies actual body growth and stacks with rush',()=>{
 const s=freshState();
 const result=completeRep(s,'arms','perfect');
 assert.equal(result.quality,'perfect');
 assert.equal(result.points,12);
 assert.equal(result.multiplier,1.5);
 assert.equal(s.lifetime.arms,12);
 for(let i=0;i<4;i++)completeRep(s,'arms');
 const rush=completeRep(s,'arms','perfect');
 assert.equal(rush.points,24);
 assert.equal(rush.multiplier,3);
 assert.equal(s.energy,0);
});

test('invalid part and quality cannot mutate progress or consume energy',()=>{
 const s=freshState();
 const before=structuredClone(s);
 for(const part of ['back','__proto__','constructor',null]){
  assert.equal(completeRep(s,part),null);
  assert.equal(reward(s,part),0);
 }
 for(const quality of ['great','PERFECT','',null,{},1])assert.equal(completeRep(s,'chest',quality),null);
 assert.deepEqual(s,before);
 s.energy=7;
 const depleted=structuredClone(s);
 assert.equal(completeRep(s,'chest','perfect'),null);
 assert.deepEqual(s,depleted);
});

test('three trained body parts award one daily balance bonus without body inflation',()=>{
 const s=freshState();
 completeRep(s,'chest');completeRep(s,'arms');
 const result=completeRep(s,'legs');
 assert.equal(result.points,8);
 assert.equal(result.bonus,20);
 assert.equal(s.points,44);
 assert.deepEqual(s.lifetime,{chest:8,arms:8,legs:8});
 assert.equal(completeRep(s,'legs').bonus,0);
 nextDay(s);
 completeRep(s,'chest');completeRep(s,'arms');
 assert.equal(completeRep(s,'legs').bonus,20);
});

test('one basic rep buys the first passive; spending never removes body growth',()=>{
 const s=freshState();
 completeRep(s,'chest');
 const before=bodyShape(s);
 assert.equal(price(s,NODES.find(n=>n.id==='stamina')),8);
 assert.equal(buyNode(s,'stamina'),true);
 assert.equal(s.points,0);
 assert.equal(s.lifetime.chest,8);
 assert.deepEqual(bodyShape(s),before);
 assert.equal(s.energy,42);
 assert.equal(maxEnergy(s),50);
});

test('prerequisites, escalating prices, caps, and insufficient currency are enforced',()=>{
 const s=freshState();s.points=10000;
 assert.equal(buyNode(s,'missing'),false);
 assert.equal(buyNode(s,'chestLoad'),false);
 buyNode(s,'form');buyNode(s,'chest');
 assert.equal(reward(s,'chest'),13);
 assert.equal(buyNode(s,'chestLoad'),true);
 assert.equal(buyNode(s,'chestLoad'),false);
 assert.equal(reward(s,'chest'),20);
 for(let i=0;i<8;i++)buyNode(s,'stamina');
 assert.equal(s.levels.stamina,5);
 const form=NODES.find(n=>n.id==='form');
 assert.equal(price(s,form),14);
 s.points=0;assert.equal(buyNode(s,'arms'),false);
});

test('efficiency and timing passives apply their displayed mechanical effects',()=>{
 const s=freshState();s.points=1000;
 buyNode(s,'stamina');buyNode(s,'efficiency');
 const before=s.energy;
 completeRep(s,'chest');
 assert.equal(repCost(s),7);
 assert.equal(s.energy,before-7);
 assert.equal(perfectWindow(s),650);
 buyNode(s,'form');buyNode(s,'tempo');
 assert.equal(perfectWindow(s),750);
});

test('next day restores energy and resets combo/rush while retaining growth and passives',()=>{
 const s=freshState();
 completeRep(s,'legs');buyNode(s,'stamina');
 for(let i=0;i<4;i++)completeRep(s,'legs');
 assert.equal(s.rushLeft,5);
 const life={...s.lifetime};
 nextDay(s);
 assert.equal(s.energy,50);
 assert.equal(s.day,2);
 assert.deepEqual(s.lifetime,life);
 assert.deepEqual(s.dayStart,life);
 assert.equal(s.levels.stamina,1);
 assert.equal(s.today.legs,0);
 assert.equal(s.combo,0);
 assert.equal(s.rushLeft,0);
 assert.equal(s.balancedToday,false);
 assert.equal(s.lastPart,null);
});

test('routine passive grants extra energy for only the qualified following day',()=>{
 const s=freshState();s.levels.routine=1;s.today={chest:1,arms:1,legs:1};
 nextDay(s);assert.equal(s.energy,50);assert.equal(s.bonus,10);
 nextDay(s);assert.equal(s.energy,40);assert.equal(s.bonus,0);
});

test('rush ends without retriggering and the next five normal reps build a new rush',()=>{
 const s=freshState();s.levels.stamina=5;s.energy=maxEnergy(s);
 for(let i=0;i<10;i++)completeRep(s,'arms');
 assert.equal(s.combo,0);assert.equal(s.rushLeft,0);assert.equal(s.energy,50);
 assert.equal(completeRep(s,'arms').points,8);
 assert.equal(s.combo,1);assert.equal(s.energy,42);
 for(let i=0;i<4;i++)completeRep(s,'arms');
 assert.equal(s.rushLeft,5);assert.equal(s.energy,10);
});

test('milestones use lifetime growth, award once, and survive spending and reload',()=>{
 const s=freshState();
 assert.deepEqual(rank(s),{level:0,name:'첫 등록',threshold:0});
 assert.equal(nextGoal(s).id,'rookie');
 assert.equal(claimMilestone(s),null);
 s.lifetime.chest=60;
 assert.equal(totalGrowth(s),60);
 const claimed=claimMilestone(s);
 assert.equal(claimed.points,24);assert.deepEqual(claimed.goals,[MILESTONES[0]]);
 assert.equal(s.points,24);assert.equal(s.lifetime.chest,60);
 assert.equal(rank(s).level,1);assert.equal(nextGoal(s).threshold,180);
 assert.equal(claimMilestone(s),null);
 buyNode(s,'form');
 const loaded=restore(JSON.stringify(s));
 assert.equal(claimMilestone(loaded),null);
 assert.equal(rank(loaded).level,1);
 s.lifetime.arms=1740;
 const remaining=claimMilestone(s);
 assert.equal(remaining.goals.length,4);
 assert.equal(remaining.points,45+80+140+260);
 assert.equal(rank(s).name,'헬스장 전설');assert.equal(nextGoal(s),null);
 assert.equal(claimMilestone(s),null);
});

test('only an entire controlled stroke scores; partial, instant and invalid strokes do not',()=>{
 const c=new RepCycle();
 assert.equal(c.update(.5,0),false);assert.equal(c.update(0,900),false);
 c.reset();c.update(1,1000);assert.equal(c.update(0,1100),false);
 c.update(.2,2000);c.update(1,2200);assert.equal(c.update(0,2400),true);
 assert.equal(c.update(0,2900),false);
 c.update(1,3000);c.reset();assert.equal(c.update(0,4000),false);
 assert.equal(c.update(NaN,4000),false);assert.equal(c.update(1,Infinity),false);
 assert.equal(c.started,null);
});

test('each body part grows visibly from its own earned points and has a bounded size',()=>{
 const s=freshState();
 assert.deepEqual(bodyShape(s),{chest:1,arms:1,legs:1});
 completeRep(s,'arms');
 const early=bodyShape(s);
 assert.ok(early.arms>1.15);assert.equal(early.chest,1);assert.equal(early.legs,1);
 s.points=999;assert.deepEqual(bodyShape(s),early);
 s.lifetime={chest:1e9,arms:1e9,legs:1e9};
 const full=bodyShape(s);
 assert.ok(full.chest<=2.7);assert.ok(full.arms<=2.9);assert.ok(full.legs<=2.55);
});

test('version 2 roundtrip preserves active rush at zero normal energy',()=>{
 const s=freshState();
 for(let i=0;i<7;i++)completeRep(s,'arms','perfect');
 claimMilestone(s);
 assert.equal(s.energy,0);assert.equal(s.rushLeft,3);
 const loaded=restore(JSON.stringify(s));
 assert.deepEqual(loaded,s);
 assert.equal(completeRep(loaded,'arms').points,16);
 assert.equal(loaded.rushLeft,2);
 assert.equal(loaded.energy,0);
});

test('version 1 migration preserves earned growth, purchased ranks, currency and day',()=>{
 const old={version:1,day:12,points:37,energy:14,lifetime:{chest:111,arms:72,legs:90},
  levels:{stamina:2,form:2,chest:1,routine:1},reps:{chest:30,arms:20,legs:25},
  today:{chest:1,arms:2,legs:1},dayStart:{chest:105,arms:60,legs:84},bonus:10,sound:false};
 const loaded=restore(JSON.stringify(old));
 assert.equal(loaded.version,2);assert.equal(loaded.day,12);assert.equal(loaded.points,37);
 assert.equal(loaded.energy,14);assert.deepEqual(loaded.lifetime,old.lifetime);
 assert.deepEqual(loaded.reps,old.reps);assert.deepEqual(loaded.today,old.today);
 assert.deepEqual(loaded.dayStart,old.dayStart);assert.equal(loaded.levels.stamina,2);
 assert.equal(loaded.levels.form,2);assert.equal(loaded.sound,false);assert.equal(loaded.bonus,10);
 assert.equal(loaded.combo,0);assert.equal(loaded.rushLeft,0);assert.equal(loaded.balancedToday,true);
 assert.equal(completeRep(loaded,'arms').bonus,0);
 assert.equal(claimMilestone(loaded).goals.length,2);
 assert.deepEqual(restore(JSON.stringify(loaded)),loaded);
});

test('corrupt or unsupported saves recover safely and all numeric progress is bounded',()=>{
 assert.deepEqual(restore('invalid'),freshState());
 assert.deepEqual(restore('{"version":999}'),freshState());
 assert.deepEqual(restore('null'),freshState());
 const bad=restore(JSON.stringify({version:2,energy:99999,points:-9,levels:{stamina:999},
  combo:999,rushLeft:999,milestones:['legend','fake','legend'],lifetime:{arms:-4,chest:NaN}}));
 assert.equal(bad.points,0);assert.equal(bad.levels.stamina,5);assert.equal(bad.energy,90);
 assert.equal(bad.rushLeft,5);assert.equal(bad.combo,5);assert.deepEqual(bad.milestones,[]);
 assert.deepEqual(bad.lifetime,{chest:0,arms:0,legs:0});
 const inconsistent=restore(JSON.stringify({...freshState(),rushLeft:1,combo:0}));
 assert.equal(inconsistent.combo,9);
 const normal=restore(JSON.stringify({...freshState(),rushLeft:0,combo:10}));
 assert.equal(normal.combo,4);
});

test('precision recovers normal PERFECT energy, never recovers rush energy, and stays finite',()=>{
 const s=freshState();s.levels.precision=1;
 assert.equal(completeRep(s,'arms').energyRecovered,0);assert.equal(s.energy,32);
 assert.equal(completeRep(s,'arms','perfect').energyRecovered,2);assert.equal(s.energy,26);
 for(let i=0;i<3;i++)completeRep(s,'arms','perfect');
 assert.equal(s.rushLeft,5);assert.equal(s.energy,8);
 for(let i=0;i<5;i++)assert.equal(completeRep(s,'arms','perfect').energyRecovered,0);
 assert.equal(s.energy,8);
 const last=completeRep(s,'arms','perfect');
 assert.equal(last.energyRecovered,2);assert.equal(last.exhausted,true);
 const efficient=freshState();efficient.levels.efficiency=4;efficient.levels.precision=1;
 let reps=0;
 while(canRep(efficient)&&reps<200){completeRep(efficient,'arms','perfect');reps++;}
 assert.ok(reps<200);assert.ok(efficient.energy<repCost(efficient));
});

test('superset rewards changing exercise once, stacks with PERFECT, and resets each day',()=>{
 const s=freshState();s.levels.superset=1;
 assert.equal(completeRep(s,'chest').switched,false);
 const switchRep=completeRep(s,'arms','perfect');
 assert.equal(switchRep.switched,true);assert.equal(switchRep.multiplier,2.25);
 assert.equal(switchRep.points,18);
 assert.equal(completeRep(s,'arms').points,8);
 const loaded=restore(JSON.stringify(s));
 assert.equal(completeRep(loaded,'legs').switched,true);
 nextDay(s);assert.equal(completeRep(s,'arms').switched,false);
});

test('afterburn extends future rushes and its full duration persists across reload',()=>{
 const s=freshState();
 for(let i=0;i<5;i++)completeRep(s,'chest');
 s.levels.master=1;s.points=45;
 assert.equal(buyNode(s,'afterburn'),true);
 assert.equal(s.rushLeft,5);assert.equal(s.rushTotal,5);
 let loaded=restore(JSON.stringify(s));
 assert.equal(loaded.rushTotal,5);
 for(let i=0;i<5;i++)completeRep(loaded,'chest');
 nextDay(loaded);
 for(let i=0;i<5;i++)completeRep(loaded,'chest');
 assert.equal(loaded.rushLeft,7);assert.equal(loaded.rushTotal,7);
 completeRep(loaded,'chest');loaded=restore(JSON.stringify(loaded));
 assert.equal(loaded.rushLeft,6);assert.equal(loaded.rushTotal,7);assert.equal(loaded.combo,6);
 for(let i=0;i<6;i++)completeRep(loaded,'chest');
 assert.equal(loaded.rushLeft,0);assert.equal(loaded.combo,0);assert.equal(canRep(loaded),false);
});

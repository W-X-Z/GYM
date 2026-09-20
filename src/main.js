import { PARTS,STATIONS,NODES,freshState,maxEnergy,repCost,price,unlocked,level,reward,completeRep,buyNode,nextDay,restore,bodyShape,RepCycle,canRep,perfectWindow,totalGrowth,rank,nextGoal,claimMilestone } from './game.js';
import { GymScene } from './scene.js';
const $=id=>document.getElementById(id);
const paths={bench:'M3 17h18M5 17v4m14-4v4M6 13h11l3 4M4 4v6m16-6v6M2 7h20m-15 4 3 2 2-5',curl:'M3 7v10m3-12v14M18 5v14m3-12v10M6 12h12',squat:'M3 4v16M21 4v16M3 5h18M7 8h10m-5 0v6m0 0-4 5m4-5 4 5',heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',target:'M20 12a8 8 0 1 1-8-8m0 8 9-9m-5 0h5v5M16 12a4 4 0 1 1-4-4',wind:'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h6a3 3 0 1 1-3 3',bolt:'m13 2-9 12h7l-1 8 10-12h-8Z',weight:'M8 7V5a4 4 0 0 1 8 0v2M6 7h12l3 14H3Z',cycle:'M20 7a9 9 0 0 0-16 0m0-5v5h5M4 17a9 9 0 0 0 16 0m0 5v-5h-5',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',sound:'m11 5-6 4H2v6h3l6 4Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',mute:'m11 5-6 4H2v6h3l6 4Zm5 4 5 6m0-6-5 6'};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;}
// Keep the v1 storage key so the v2 schema migrates existing saves in-place.
const KEY='gym-club-save-v1';
let state;try{state=restore(localStorage.getItem(KEY));}catch{state=freshState();}
let scene,active=null,walking=false,view='gym',pointer=null,pointerTarget=null,startY=0;
let cycle=new RepCycle(),peakAt=null,turnAt=null,maxPull=0;
let toastTimer,exhaustTimer,judgeTimer,rushTimer,milestoneTimer,audio=null,pendingMilestone=null;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('save-state').textContent='자동 저장';}catch{$('save-state').textContent='저장 불가';}}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600);}
function audioContext(){if(!state.sound)return null;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();return audio;}catch{return null;}}
function sound(kind='rep',combo=0){
 const ac=audioContext();if(!ac)return;const at=ac.currentTime;
 function tone(freq,start,length,volume,type='sine',end=freq){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,at+start);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+start+length);g.gain.setValueAtTime(.001,at+start);g.gain.exponentialRampToValueAtTime(volume,at+start+.008);g.gain.exponentialRampToValueAtTime(.001,at+start+length);o.connect(g);g.connect(ac.destination);o.start(at+start);o.stop(at+start+length+.02);}
 const pitch=1+Math.min(combo,10)*.035;
 if(kind==='rep'||kind==='perfect'){tone(125,0,.17,.16,'sine',42);tone(260*pitch,.015,.16,.06,'triangle',180*pitch);if(kind==='perfect'){tone(660*pitch,.025,.16,.07);tone(990*pitch,.08,.21,.05);}}
 else if(kind==='peak')tone(720,0,.065,.028,'sine',900);
 else if(kind==='rush'){[330,440,550,660,880].forEach((f,i)=>tone(f,i*.065,.23,.06,'triangle'));tone(90,0,.4,.14,'sine',35);}
 else if(kind==='milestone'){[392,494,587,784].forEach((f,i)=>tone(f,i*.1,.42,.07,'triangle'));}
 else {tone(520,0,.16,.05);tone(780,.07,.25,.06);}
}
function render(){
 $('day').textContent=String(state.day).padStart(2,'0');
 $('energy-text').textContent=`${state.energy} / ${maxEnergy(state)}`;
 $('energy-fill').style.width=`${state.energy/maxEnergy(state)*100}%`;
 $('energy-fill').style.background=state.rushLeft?'#ffbd53':canRep(state)?'#bdf26a':'#ed7559';
 $('energy-note').textContent=state.rushLeft?'펌프 모드 · 체력 소모 없음':canRep(state)?'운동할 때만 체력이 줄어듭니다':'충분히 했어요. 다음 날로 이어가세요.';
 $('points').textContent=state.points.toLocaleString();$('tree-points').textContent=state.points.toLocaleString();
 $('today-total').textContent=Object.values(state.today).reduce((a,b)=>a+b,0)+'회';
 const count=state.rushLeft?state.rushLeft:Math.min(state.combo,5);
 $('pump-title').textContent=state.rushLeft?'PUMP MODE ×2':'PUMP METER';
 $('pump-count').textContent=state.rushLeft?`${count}회 남음`:`${count} / 5`;
 const cells=state.rushLeft?state.rushTotal||5:5;
 $('pump-cells').innerHTML=Array.from({length:cells},(_,i)=>`<i class="${i<count?'filled':''}"></i>`).join('');
 $('pump-tip').textContent=state.rushLeft?'체력 FREE · 지금 몰아붙이세요':`${5-count}회만 더! 무료 운동 + 보상 2배`;
 $('world').classList.toggle('rushing',state.rushLeft>0);$('pump-panel').classList.toggle('rushing',state.rushLeft>0);
 const growth=totalGrowth(state),currentRank=rank(state),goal=nextGoal(state);
 $('rank-badge').textContent=`Lv.${currentRank.level} ${currentRank.name}`;
 $('goal-name').textContent=goal?goal.name:'헬스장 전설 달성';
 $('goal-reward').textContent=goal?`달성 보너스 +${goal.points} GP`:'목표 완주 · 계속 성장 가능';
 $('goal-fill').style.width=goal?`${Math.max(0,Math.min(100,(growth-currentRank.threshold)/(goal.threshold-currentRank.threshold)*100))}%`:'100%';
 $('goal-count').textContent=goal?`${growth.toLocaleString()} / ${goal.threshold.toLocaleString()} GP`:`${growth.toLocaleString()} GP`;
 $('goal-remaining').textContent=goal?`${Math.max(0,goal.threshold-growth)} GP 남음`:'완주';
 $('body-stats').innerHTML=Object.entries(PARTS).map(([id,p])=>{const size=Math.round((bodyShape(state)[id]-1)*100);return `<div class="body-row"><div><span>${p.name}</span><b>${state.lifetime[id].toLocaleString()}<em> GP</em></b></div><div class="body-meter"><i style="width:${Math.min(100,state.lifetime[id]/6)}%;background:${p.color}"></i></div><small class="body-size">근육 크기 +${size}%</small></div>`;}).join('');
 $('station-cards').innerHTML=STATIONS.map(s=>`<button class="exercise-card ${active?.id===s.id?'selected':''}" data-station="${s.id}" ${walking?'disabled':''}><span class="exercise-icon">${icon(s.id)}</span><span><b>${s.name}</b><small>${PARTS[s.part].name} · 기본 +${reward(state,s.part)} GP</small></span><span>${active?.id===s.id?'운동 중':'↗'}</span></button>`).join('');
 const available=NODES.filter(n=>unlocked(state,n)&&level(state,n.id)<n.max&&state.points>=price(state,n));
 $('tree-dot').textContent=available.length?String(available.length):'';
 const quick=available.find(n=>['stamina','form',active?.part].includes(n.id))||available[0];
 $('quick-upgrade').hidden=!quick;if(quick){$('quick-upgrade').dataset.node=quick.id;$('quick-upgrade').innerHTML=`<span>${icon(quick.icon)}<b>${quick.name} 강화</b></span><strong>${price(state,quick)} GP →</strong>`;}
 $('sound').innerHTML=icon(state.sound?'sound':'mute');$('sound').setAttribute('aria-label',state.sound?'소리 끄기':'소리 켜기');
 if(active){$('rep-count').innerHTML=state.today[active.part]+'<span>REPS</span>';$('rep-reward').textContent=state.rushLeft?`보상 ×2 · 체력 무료 · ${state.rushLeft}회 남음`:`기본 +${reward(state,active.part)} GP · PERFECT ×1.5 · 체력 −${repCost(state)}`;$('exercise-weight').textContent=(active.weight*(level(state,active.part+'Load')?2:1))+' KG';}
 $('rest').disabled=walking;if(view==='tree')renderTree();if(scene)scene.state=state;
}
function nodeHTML(n){const lv=level(state,n.id),open=unlocked(state,n),max=lv>=n.max,can=open&&!max&&state.points>=price(state,n);return `<button class="node ${open?'':'locked'} ${lv?'owned':''} ${can?'available':''}" data-node="${n.id}" ${!can?'disabled':''} aria-label="${n.name}, ${n.desc}, ${!open?'선행 강화 필요':max?'강화 완료':price(state,n)+' 포인트'}"><span class="node-head">${icon(n.icon)}<small>${lv} / ${n.max}</small></span><b>${n.name}</b><p>${n.desc}</p><span class="node-price">${!open?'선행: '+n.requires.map(id=>NODES.find(x=>x.id===id).name).join(' · '):max?'강화 완료':price(state,n)+' GP'}</span></button>`;}
function renderTree(){
 const base=['stamina','efficiency','routine','form','tempo'];
 $('base-nodes').innerHTML=base.map(id=>nodeHTML(NODES.find(n=>n.id===id))).join('');
 $('branch-nodes').innerHTML=['chest','arms','legs'].map(part=>`<div class="branch">${NODES.filter(n=>n.branch===part).map(nodeHTML).join('')}</div>`).join('');
 $('master-node').innerHTML=nodeHTML(NODES.find(n=>n.id==='master'));
 $('synergy-nodes').innerHTML=['precision','superset','afterburn'].map(id=>NODES.find(n=>n.id===id)).filter(Boolean).map(nodeHTML).join('');
}
function resetQuality(){peakAt=null;turnAt=null;maxPull=0;}
function resetStroke(){pointer=null;pointerTarget=null;cycle.reset();resetQuality();if(scene)scene.stroke=0;$('drag-handle').classList.remove('dragging','at-peak');$('stroke-fill').style.height='0%';$('stroke-cursor').style.bottom='0%';$('phase-hint').textContent=active?.id==='squat'?'위로 드래그해 일어서고, 다시 앉으세요':'화면을 잡고 위로 들었다 내려주세요';}
function blocked(){return $('summary').open||$('help-dialog').open||$('milestone-dialog').open;}
function leave(){clearTimeout(exhaustTimer);active=null;walking=false;resetStroke();scene?.leave();$('workout').hidden=true;$('station-labels').hidden=false;$('rotate-view').hidden=false;$('coach-card').hidden=false;render();}
function choose(id){
 if(!scene||walking||view!=='gym'||blocked())return;
 if(!canRep(state)){showSummary();return;}
 const s=STATIONS.find(s=>s.id===id);if(!s||active?.id===id)return;
 if(active)leave();walking=true;$('station-labels').hidden=true;$('coach-card').hidden=true;audioContext();render();
 scene.walk(s,()=>{walking=false;active=s;scene.enter(s);$('workout').hidden=false;$('rotate-view').hidden=true;$('exercise-name').textContent=s.name;$('exercise-part').textContent=s.label+' TRAINING';resetStroke();render();});
}
function switchView(next){if(walking)return;if(active)leave();view=next;$('tree-panel').hidden=next!=='tree';$('world').hidden=next==='tree';$('dashboard').hidden=next==='tree';$('gym-tab').classList.toggle('active',next==='gym');$('tree-tab').classList.toggle('active',next==='tree');render();if(next==='gym')scene?.resize();}
function showSummary(){
 if(walking||$('milestone-dialog').open)return;if(pendingMilestone){showPendingMilestone(true);return;}resetStroke();
 $('summary-day').textContent=`DAY ${String(state.day).padStart(2,'0')} · 총 ${Object.values(state.today).reduce((a,b)=>a+b,0)}회 운동`;
 $('summary-stats').innerHTML=Object.entries(PARTS).map(([id,p])=>`<div class="summary-row"><b>${p.name}</b><span>${state.today[id]}회</span><strong>+${state.lifetime[id]-state.dayStart[id]} GP</strong></div>`).join('');
 $('summary-earned').textContent=Object.keys(PARTS).reduce((n,p)=>n+state.lifetime[p]-state.dayStart[p],0)+' GP';
 $('summary-badges').textContent=state.balancedToday?'세 부위 루틴 완료 · 보너스 +20 GP':'세 부위를 모두 운동하면 매일 +20 GP 보너스';
 $('cancel-rest').hidden=!canRep(state);if(!$('summary').open)$('summary').showModal();
}
function showPendingMilestone(force=false){
 if(!pendingMilestone||blocked()||(!force&&state.rushLeft))return;
 const claim=pendingMilestone;pendingMilestone=null;resetStroke();const g=claim.goals.at(-1);
 $('milestone-name').textContent=g.name;
 $('milestone-description').textContent=g.threshold>=1800?'목표 완주! 작은 몸으로 시작해 헬스장의 전설이 되었습니다. 계속 운동하며 남은 강화를 완성할 수 있습니다.':`누적 근성장 ${g.threshold.toLocaleString()} GP 돌파. 몸이 달라졌습니다.`;
 $('milestone-prize').textContent=`+${claim.points} GP`;$('milestone-dialog').showModal();sound('milestone');
}
function presentMilestone(claim){
 if(!claim)return;clearTimeout(exhaustTimer);clearTimeout(milestoneTimer);
 pendingMilestone=pendingMilestone?{points:pendingMilestone.points+claim.points,goals:[...pendingMilestone.goals,...claim.goals]}:claim;
 toast(`${claim.goals.at(-1).name} 달성! +${claim.points} GP`);milestoneTimer=setTimeout(showPendingMilestone,900);
}
for(const dialog of [$('help-dialog'),$('summary'),$('milestone-dialog')])dialog.addEventListener('close',()=>showPendingMilestone());
function continueMilestone(toTree=false){$('milestone-dialog').close();if(toTree)switchView('tree');else if(!canRep(state))showSummary();}
function announce(result,pumped=false){
 const perfect=result.quality==='perfect';sound(perfect?'perfect':'rep',result.combo);
 if(scene.impact)scene.impact(result);else scene.burst();
 const el=$('judgement');clearTimeout(judgeTimer);el.className='';void el.offsetWidth;el.innerHTML=`<strong>${perfect?'PERFECT!':'NICE LIFT!'}</strong><b>+${result.points}<small> GP</small></b><span>${result.rushStarted?'PUMP READY':pumped?'PUMP ×2':`${result.combo} LIFTS`} · ${PARTS[result.part].name} 성장</span>`;el.className='show '+(perfect?'perfect':'good');judgeTimer=setTimeout(()=>el.classList.remove('show'),1050);
 // GP chips fly to the wallet; no rapid flashes.
 if(!reducedMotion){const from=$('drag-handle').getBoundingClientRect(),to=$('points').getBoundingClientRect();for(let i=0;i<5;i++){const chip=document.createElement('i');chip.className='gp-chip';chip.style.left=(from.x+from.width/2)+'px';chip.style.top=(from.y+from.height/2)+'px';chip.style.setProperty('--dx',(to.x-from.x+12+(i-2)*7)+'px');chip.style.setProperty('--dy',(to.y-from.y+10)+'px');chip.style.animationDelay=i*.035+'s';document.body.append(chip);setTimeout(()=>chip.remove(),1000);}}
 if(result.rushStarted){const banner=$('rush-banner');clearTimeout(rushTimer);banner.innerHTML=`<strong>PUMP MODE</strong><span>체력 FREE · 보상 ×2 · ${state.rushLeft}회</span>`;banner.classList.add('show');rushTimer=setTimeout(()=>banner.classList.remove('show'),1500);sound('rush');}
 if(result.bonus)toast(`세 부위 루틴 완성! +${result.bonus} GP`);
}
function stroke(raw){
 if(!active||view!=='gym'||blocked()||!canRep(state))return;
 const now=performance.now();maxPull=Math.max(maxPull,raw);
 if(raw>=.94&&peakAt===null){peakAt=now;sound('peak');$('drag-handle').classList.add('at-peak');}
 if(peakAt!==null&&turnAt===null&&raw<maxPull-.035)turnAt=now;
 const quality=peakAt!==null&&turnAt!==null&&turnAt-peakAt<=perfectWindow(state)&&maxPull<=1.22?'perfect':'good';
 const wasPeak=cycle.peak,pumped=state.rushLeft>0;const valid=cycle.update(raw,now,360);scene.stroke=cycle.value;
 $('stroke-fill').style.height=(cycle.value*100)+'%';$('stroke-cursor').style.bottom=(cycle.value*100)+'%';
 $('phase-hint').textContent=cycle.peak?'지금 아래로! 끝까지 돌아오세요':'위로 끝까지 들어주세요';
 if(wasPeak&&!cycle.peak){resetQuality();$('drag-handle').classList.remove('at-peak');if(!valid)$('phase-hint').textContent='조금 더 천천히, 끝까지 들어주세요';}
 if(valid){const result=completeRep(state,active.part,quality);resetQuality();if(!result)return;announce(result,pumped);$('phase-hint').textContent=result.rushStarted?'펌프 모드! 쉬지 말고 계속 들어주세요':'좋아요. 한 번 더!';const claim=claimMilestone(state);render();save();if(claim)presentMilestone(claim);else if(pendingMilestone&&!state.rushLeft)milestoneTimer=setTimeout(showPendingMilestone,900);else if(result.exhausted)exhaustTimer=setTimeout(()=>{if(!canRep(state))showSummary();},1200);}
}
const handle=$('drag-handle');
function dragRange(){return Math.min(150,Math.max(94,scene.height*.25));}
function startDrag(e){if(pointer!==null||!active||blocked()||!canRep(state))return;e.preventDefault();pointer=e.pointerId;pointerTarget=e.currentTarget;pointerTarget.setPointerCapture(pointer);startY=e.clientY+scene.stroke*dragRange();handle.classList.add('dragging');audioContext();}
function moveDrag(e){if(e.pointerId!==pointer)return;e.preventDefault();stroke((startY-e.clientY)/dragRange());}
function endDrag(e){if(e.pointerId!==pointer)return;stroke((startY-e.clientY)/dragRange());const target=pointerTarget;if(target?.hasPointerCapture(e.pointerId))target.releasePointerCapture(e.pointerId);resetStroke();}
for(const target of [handle,$('scene')]){target.addEventListener('pointerdown',startDrag);target.addEventListener('pointermove',moveDrag);target.addEventListener('pointerup',endDrag);target.addEventListener('pointercancel',resetStroke);target.addEventListener('lostpointercapture',()=>{if(pointer!==null)resetStroke();});}
window.addEventListener('keydown',e=>{if(!blocked()&&active&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();stroke(Math.max(0,Math.min(1,scene.stroke+(e.key==='ArrowUp'?.12:-.12))));}if(e.key==='Escape'&&!blocked()&&active)leave();});
window.addEventListener('blur',resetStroke);document.addEventListener('visibilitychange',()=>{if(document.hidden){resetStroke();save();}});
function purchase(id){const n=NODES.find(n=>n.id===id);if(n&&buyNode(state,id)){sound('buy');render();save();toast(`${n.name} 강화 완료 · ${n.desc}`);}}
$('station-cards').addEventListener('click',e=>{const b=e.target.closest('[data-station]');if(b)choose(b.dataset.station);});$('station-labels').addEventListener('click',e=>{const b=e.target.closest('[data-station]');if(b)choose(b.dataset.station);});
$('leave').onclick=leave;$('rest').onclick=showSummary;$('cancel-rest').onclick=()=>$('summary').close();
$('next-day').onclick=()=>{$('summary').close();leave();nextDay(state);render();save();sound('buy');toast(`DAY ${state.day} · 체력 회복. 다시 한 번!`);};
$('gym-tab').onclick=()=>switchView('gym');$('tree-tab').onclick=()=>switchView('tree');$('return-gym').onclick=()=>switchView('gym');document.querySelector('.brand').onclick=e=>{e.preventDefault();switchView('gym');};
$('tree-panel').addEventListener('click',e=>{const b=e.target.closest('[data-node]');if(b)purchase(b.dataset.node);});$('quick-upgrade').onclick=()=>purchase($('quick-upgrade').dataset.node);
$('milestone-continue').onclick=()=>continueMilestone();$('milestone-tree').onclick=()=>continueMilestone(true);$('milestone-dialog').addEventListener('cancel',()=>{if(!canRep(state))setTimeout(showSummary,50);});
$('sound').onclick=()=>{state.sound=!state.sound;render();save();};$('help').onclick=()=>{resetStroke();$('help-dialog').showModal();};$('close-help').onclick=()=>$('help-dialog').close();
$('reset').onclick=()=>$('reset-confirm').hidden=false;$('reset-no').onclick=()=>$('reset-confirm').hidden=true;$('reset-yes').onclick=()=>{clearTimeout(exhaustTimer);clearTimeout(milestoneTimer);pendingMilestone=null;state=freshState();leave();switchView('gym');$('reset-confirm').hidden=true;$('help-dialog').close();save();render();toast('새로운 첫날을 시작합니다.');};$('rotate-view').onclick=()=>{if(scene)scene.cameraMode=1-scene.cameraMode;};
try{
 scene=new GymScene($('scene'),choose);scene.state=state;$('loading').hidden=true;
 $('station-labels').innerHTML=STATIONS.map((s,i)=>`<button class="station-label" data-station="${s.id}"><small>0${i+1}</small>${s.name}<span>↗</span></button>`).join('');
 scene.onFrame=()=>{if(view!=='gym')return;for(const s of STATIONS){const p=scene.projectPoint(s.x,.2,s.z+2.5);const el=document.querySelector(`.station-label[data-station="${s.id}"]`);el.style.left=p.x+'px';el.style.top=p.y+'px';}if(active){const p=scene.handlePosition();handle.style.left=p.x+'px';handle.style.top=p.y+'px';}};
}catch(error){console.error(error);$('loading').innerHTML='<div style="text-align:center;padding:30px"><b>게임 화면을 시작할 수 없습니다.</b><p>Chrome 또는 Edge에서 다시 열어주세요.</p></div>';}
render();save();

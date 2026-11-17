"use strict";
/* ================= v2.0 보상 선택 UI ================= */
let rwPicks=[];
const sgn=(v,d)=>(v>=0?'+':'−')+Math.abs(v).toFixed(d);
const CHAOS_CDS=['healCd','guardCd','dashCd','phaseCd','hookCd','slowCd','shockCd','absorbCd','decoyCd','gravCd','frostCd','owCd','echoCd'];
const CHAOS_STATS=[
 ['패링 사거리',m=>{CFG.rangeM=Math.max(1,CFG.rangeM+0.3*m);},m=>sgn(0.3*m,2)+'m'],
 ['패링 시야각',m=>{CFG.fov=clamp(CFG.fov+5*m,20,180);},m=>sgn(5*m,1)+'°'],
 ['빗나감 페널티',m=>{CFG.whiff=Math.max(0.2,CFG.whiff-0.1*m);},m=>sgn(-0.1*m,2)+'초'],
 ['이동 속도',m=>{CFG.moveSpd=Math.max(80,CFG.moveSpd+15*m);},m=>sgn(15*m,0)],
 ['최대 체력',m=>{const v=15*m; CFG.hpMax=Math.max(40,CFG.hpMax+v); P.hp=clamp(P.hp+v,1,CFG.hpMax);},m=>sgn(15*m,0)],
 ['유도',m=>{CFG.homing=Math.max(0,CFG.homing+0.6*m);},m=>sgn(0.6*m,2)],
 ['재탈취 저항',m=>{CFG.seizeMul*=Math.pow(0.9,m);},m=>'재탈취 '+sgn(-(1-Math.pow(0.9,m))*100,0)+'%'],
 ['연쇄 타격',m=>{CFG.rallyDmg=Math.max(0,(CFG.rallyDmg||0)+0.15*m);},m=>sgn(15*m,0)+'%'],
 ['장갑',m=>{CFG.armor=clamp((CFG.armor||0)+0.05*m,0,0.5);},m=>'받는 피해 '+sgn(-5*m,0)+'%'],
 ['스킬 재사용 대기',m=>{const f=Math.pow(0.94,m); CHAOS_CDS.forEach(k=>{ if(CFG[k]) CFG[k]*=f; }); CFG.cdrMul=(CFG.cdrMul||1)*f;},m=>sgn(-(1-Math.pow(0.94,m))*100,0)+'%']
];
const chaosStat=()=>CHAOS_STATS[Math.floor(Math.random()*CHAOS_STATS.length)];
function chaosAmp8(){ return {k:'c_amp8',n:'랜덤 스탯 증폭 +8',d:'무작위 능력치를 8번 강화합니다',tag:'혼돈',max:1,sp:1,chaos:1,fn:()=>{
  const got={}; for(let i=0;i<8;i++){ const s=chaosStat(); s[1](1); got[s[0]]=(got[s[0]]||0)+1; }
  announce('랜덤 스탯 증폭 — '+Object.entries(got).map(([n,c])=>n+(c>1?' ×'+c:'')).join(' · '),'cyan'); }}; }
function chaosTrap(){ return {k:'c_trap',n:'랜덤 스탯 증폭 +8',nh:'랜덤 스탯 증폭 <span class="t-plus">+8</span><span class="t-minus">−8</span>',d:'무작위 능력치를 8번 강화합니다',tag:'혼돈',max:1,sp:1,chaos:1,fn:()=>{
  const s=chaosStat(); s[1](-1); announce('함정! '+s[0]+' '+s[2](-1),'red'); sfx('breach'); shake=10; }}; }
function chaosPick(){ const s=chaosStat(); return {k:'c_pick',n:'지정 스탯 랜덤 증폭',d:'<b>'+s[0]+'</b>을(를) ×0.5 ~ ×4 사이 무작위로 증폭합니다',tag:'혼돈 · 특수 특전',max:1,sp:1,chaos:1,fn:()=>chaosPickHidden().fn()}; }
function chaosPickHidden(){ return {k:'c_pickh',n:'지정 스탯 랜덤 증폭',d:'얻는 순간 증폭할 능력치가 정해져요 · ×0.5 ~ ×4 무작위',tag:'혼돈 · 특수 특전',max:1,sp:1,chaos:1,fn:()=>{
  const s=chaosStat(), m=Math.round((0.5+Math.random()*3.5)*10)/10; s[1](m); announce('지정 — '+s[0]+' ×'+m+' 증폭  '+s[2](m),'cyan'); }}; }
function chaosPlayerPick(){ return {k:'c_pp',n:'플레이어 지정 스탯 랜덤 증폭',d:'고르면 증폭할 능력치를 <b>직접</b> 정해요 · 세기는 ×0.5 ~ ×4 무작위',tag:'혼돈 · 특수 특전',max:1,sp:1,chaos:1,stay:1,fn:openStatChoice}; }
function openStatChoice(){
  const bag=CHAOS_STATS.slice(); rwPicks=[]; run.rwStatPick=1;
  while(rwPicks.length<3&&bag.length){ const s=bag.splice(Math.floor(Math.random()*bag.length),1)[0];
    rwPicks.push({k:'c_ppst',n:s[0],d:'×0.5 ~ ×4 무작위로 증폭 · ×1 기준 '+s[2](1),tag:'혼돈 · 능력치 지정',chaos:1,fn:()=>{
      const m=Math.round((0.5+Math.random()*3.5)*10)/10; s[1](m); announce('직접 지정 — '+s[0]+' ×'+m+' 증폭  '+s[2](m),'cyan'); }}); }
  $('#rwHd').innerHTML='플레이어 지정 스탯 랜덤 증폭 &nbsp;—&nbsp; 증폭할 능력치를 고르세요';
  const rr=$('#rwReroll'); rr.disabled=true;
  renderRwRow(); sfx('ui');
}
const PRISM_BOONS=['prismdur','s_prismsplit','s_prismdur'], PRISM_RATE=0.15;
function rarePick(list){
  for(let k=0;k<12;k++){ const b=list[Math.floor(Math.random()*list.length)];
    if(!PRISM_BOONS.includes(b.k)||Math.random()<PRISM_RATE||!list.some(x=>!PRISM_BOONS.includes(x.k))) return b; }
  return list.find(x=>!PRISM_BOONS.includes(x.k))||list[0];
}
function chaosPrismTrap(){ return {k:'c_ptrap',n:'강화 프리즘',d:'프리즘 벽이 내 탄을 가를 수 있는 횟수 <span class="t-plus">+3</span><span class="t-minus">−3</span>',tag:'특수 특전',max:1,sp:1,chaos:1,fn:()=>{
  run.prismAdj=(run.prismAdj||0)-3; announce('함정! 프리즘 가르기 횟수 −3','red'); sfx('breach'); shake=10; }}; }
function chaosDisguise(){
  const pool=BOONS.filter(b=>boonLv(b.k)<b.max&&(!b.ok||b.ok())); if(!pool.length) return chaosPick();
  const look=pool[Math.floor(Math.random()*pool.length)];
  return {k:'c_dis',look:look.k,n:look.n,d:look.d,tag:look.tag,max:look.max,chaos:1,fn:()=>{
    const sp=SPECIALS.filter(x=>boonLv(x.k)<x.max&&x.k!=='s_prismdur'&&(!x.ok||x.ok()));
    if(sp.length&&Math.random()<0.6){ const r=rarePick(sp); run.boons[r.k]=(run.boons[r.k]||0)+1; r.fn(); stat('specials'); announce('위장된 특수 특전! — '+r.n,'warn'); }
    else { const c=chaosPick(); c.fn(); }
  }};
}
const RELICS=[
 {k:'r_shard',   n:'날 선 파편',  tags:['관통'],        d:'되돌린 탄 가속 +5%',          fn:()=>{ CFG.accel*=1.05; }},
 {k:'r_tip',     n:'파편 탄두',   tags:['관통'],        d:'되돌린 탄 가속 +3% · 패링 사거리 +0.1m', fn:()=>{ CFG.accel*=1.03; CFG.rangeM+=0.1; }},
 {k:'r_lens',    n:'송곳 렌즈',   tags:['관통','잔상'], d:'패링 사거리 +0.2m',            fn:()=>{ CFG.rangeM+=0.2; }},
 {k:'r_quill',   n:'꿰뚫는 깃',   tags:['관통','반격'], d:'왕복 2회 이상 된 탄 피해 +10%', fn:()=>{ CFG.rallyDmg=(CFG.rallyDmg||0)+0.1; }},
 {k:'r_compass', n:'유도 나침반', tags:['관통','탐욕'], d:'유도 +0.3',                    fn:()=>{ CFG.homing=(CFG.homing||0)+0.3; }},
 {k:'r_shield',  n:'낡은 방패',   tags:['수호'],        d:'최대 체력 +10',                fn:()=>{ CFG.hpMax+=10; P.hp+=10; }},
 {k:'r_stone',   n:'수호석',      tags:['수호'],        d:'보호막 +1',                    fn:()=>{ P.barrier=(P.barrier||0)+1; }},
 {k:'r_scale',   n:'강철 비늘',   tags:['수호','반격'], d:'받는 피해 −5%',                fn:()=>{ CFG.armor=Math.min(0.6,(CFG.armor||0)+0.05); }},
 {k:'r_glass',   n:'모래시계',    tags:['수호','잔상'], d:'스킬 재사용 대기 −5%',         fn:()=>{ CFG.cdrMul=(CFG.cdrMul||1)*0.95; }},
 {k:'r_cloak',   n:'그림자 망토', tags:['잔상','수호'], d:'최대 체력 +5 · 이동 속도 +10', fn:()=>{ CFG.hpMax+=5; P.hp+=5; CFG.moveSpd+=10; }},
 {k:'r_seal',    n:'분노의 인장', tags:['반격'],        d:'빗나감 경직 −10%',             fn:()=>{ CFG.whiff*=0.9; }},
 {k:'r_ring',    n:'역류의 고리', tags:['반격','잔상'], d:'맞은 뒤 무적 +0.1초',          fn:()=>{ CFG.iframe+=0.1; }},
 {k:'r_fang',    n:'송곳니',      tags:['반격','탐욕'], d:'패링 시야각 +5°',              fn:()=>{ CFG.fov=Math.min(180,CFG.fov+5); }},
 {k:'r_feather', n:'바람 깃털',   tags:['잔상'],        d:'이동 속도 +15',                fn:()=>{ CFG.moveSpd+=15; }},
 {k:'r_coin',    n:'녹슨 금화',   tags:['탐욕'],        d:'재화 +10%',                    fn:()=>{ CFG.gainMul=(CFG.gainMul||1)*1.1; }},
 {k:'r_scales',  n:'황금 저울',   tags:['탐욕'],        d:'점수 +10%',                    fn:()=>{ CFG.scoreMul=(CFG.scoreMul||1)*1.1; }},
 {k:'r_dice',    n:'행운 주사위', tags:['탐욕','잔상'], d:'보상 새로고침 +1',             fn:()=>{ run.rerolls=(run.rerolls||0)+1; }},
];
const relicPool=()=>RELICS.filter(r=>!(run.relics||[]).includes(r.k));
function gainRelic(id){ const r=RELICS.find(x=>x.k===id); if(!r||!run) return; (run.relics||(run.relics=[])).push(id); r.fn();
  if(typeof dexMark==='function') dexMark('r',id); announce('유물 — '+r.n+' ['+r.tags.join(' · ')+']','warn'); if(typeof synCheck==='function') synCheck(); }
function relicCard(r){ return {k:'relic',rid:r.k,n:r.n,d:r.d+'<br><span style="color:var(--warn)">태그 — '+r.tags.join(' · ')+'</span>',tag:'유물',chaos:1,fn:()=>gainRelic(r.k)}; }
function relicChance(afterBoss){ if(!run||run.tut||run.practice) return 0; if(run.dunReward) return 1; return Math.min(0.9,(afterBoss?0.45:0.2)*(run.syn&&run.syn.luck?2:1)); }
let rwOpenAt=0;   // v3.67 보상 창이 열린 시각 (R 키 새로고침 0.5초 막기)
function openReward(afterBoss,fromReroll,cartridgeWave){
  run.rwCartridgeWave=cartridgeWave||0;
  if(!fromReroll) rwOpenAt=performance.now();
  if(run.phase!=='reward') run.rwPrev=run.phase;   // v3.62 보상을 고른 뒤 돌아갈 단계 (출격 직후 보상은 벽 설치 단계)
  run.rwRoll=fromReroll?(run.rwRoll||0)+1:0; reseedDaily(100+(cartridgeWave||run.wave)*50+run.rwRoll);   // v3.62
  const candidates=cartridgeWave?BOONS.concat(CARTRIDGE_MODULES):BOONS;
  const pool=candidates.filter(b=>(cartridgeWave?canOfferCartridgeModule(b):boonLv(b.k)<b.max)&&(!b.ok||b.ok()));
  unlockMouse();   // v3.62 마우스가 잠긴 채면 커서가 안 보이고 클릭이 카드 대신 캔버스(패링)로 갔다
  if(cartridgeWave){ openCartridge(afterBoss,fromReroll,cartridgeWave,pool); return; }
  rwPicks=[];
  const bag=pool.slice();
  while(rwPicks.length<3 && bag.length)
    rwPicks.push(bag.splice(bag.indexOf(rarePick(bag)),1)[0]);
  /* v2.37 특수 특전 — 확률로 마지막 칸을 특수 특전으로 바꾼다 */
  /* v2.41 보스를 잡은 직후 보상은 특수 특전 확률 +30%p (최대 90%) */
  const spChance=Math.min(0.9,(afterBoss? CFG.specialBoss : CFG.specialChance)*(run.dunReward?2:1));   // v2.47 보스 후 38 / 47 / 50%
  if(run.mode==='chaosx'&&Math.random()<Math.max(spChance,0.25)){
    const r=Math.random(), pick=r<0.24?chaosDisguise():r<0.4?chaosTrap():r<0.415?(prismUseful()?chaosPrismTrap():chaosTrap()):r<0.6?chaosPick():r<0.8?chaosPickHidden():chaosPlayerPick();
    if(rwPicks.length<3) rwPicks.splice(Math.floor(Math.random()*(rwPicks.length+1)),0,pick);
    else rwPicks[Math.floor(Math.random()*rwPicks.length)]=pick;
  }
  else if(CFG.specialChance>0 && Math.random()<spChance){
    const sp=SPECIALS.filter(x=>boonLv(x.k)<x.max&&!(run.mode==='chaosx'&&x.k==='s_prismdur')&&(!x.ok||x.ok()));
    if(sp.length){ const pick=rarePick(sp);   // v2.52 특수 특전이 들어가는 칸도 무작위
      if(rwPicks.length<3) rwPicks.splice(Math.floor(Math.random()*(rwPicks.length+1)),0,pick);
      else rwPicks[Math.floor(Math.random()*rwPicks.length)]=pick; }
  }
  if(run.mode==='chaosx'&&fromReroll&&Math.random()<0.45){ const a8=chaosAmp8(); if(rwPicks.length<3) rwPicks.push(a8); else rwPicks[Math.floor(Math.random()*rwPicks.length)]=a8; }
  { const rp=relicPool(); if(rp.length&&Math.random()<relicChance(afterBoss)){ const rc=relicCard(rp[Math.floor(Math.random()*rp.length)]); if(rwPicks.length<3) rwPicks.push(rc); else rwPicks[Math.floor(Math.random()*rwPicks.length)]=rc; } }
  for(const f of supplyRewards()){ if(rwPicks.length>=3) break; rwPicks.push(f); }
  showReward(afterBoss);
}
function supplyRewards(){
  return [{k:'f_heal',n:'응급 정비',d:'체력 30% 회복',tag:'보급',chaos:1,fn:()=>{ P.hp=Math.min(CFG.hpMax,P.hp+Math.round(CFG.hpMax*0.3)); }},
    {k:'f_score',n:'보너스 점수',d:'점수 +'+(300*run.cycle).toLocaleString(),tag:'보급',chaos:1,fn:()=>{ run.score+=300*run.cycle; }}];
}
function openCartridge(afterBoss,fromReroll,cleared,pool){
  if(!fromReroll) run.rwCartridgeDungeon=!!run.dunReward;
  const special=SPECIALS.filter(b=>canOfferCartridgeModule(b)&&(!b.ok||b.ok()));
  const chance=Math.min(0.9,(afterBoss?CFG.specialBoss:CFG.specialChance)*(run.rwCartridgeDungeon?2:1));
  const specialPick=special.length&&(!pool.length||Math.random()<chance)?rarePick(special):null;
  const bag=pool.slice(), picks=[];
  const regularCount=specialPick?2:3;
  while(bag.length&&picks.length<regularCount){
    const pick=rarePick(bag);
    picks.push(bag.splice(bag.indexOf(pick),1)[0]);
  }
  if(specialPick) picks.splice(Math.floor(Math.random()*(picks.length+1)),0,specialPick);
  showCartridgePicks(picks,afterBoss,'누적 '+cleared+'웨이브 완료');
}
function showCartridgePicks(picks,afterBoss,title){
  const supplies=supplyRewards();
  supplies.push({k:'f_reroll',n:'예비 새로고침',d:'새로고침 횟수 +1',chaos:1,
    fn:()=>{run.rerolls=(run.rerolls||0)+1;}});
  rwPicks=picks.concat(supplies).slice(0,3).map(pick=>{
    const tags=pick.moduleTags;
    if(!tags) return {...pick,tag:'',instant:true};
    const kind=pick.sp?'개조 모듈':'모듈';
    const description=pick.extra
      ? '<b>'+tags[0]+'</b> · '+pick.d+'<br><b>'+tags[1]+'</b> · '+pick.extra.d
      : pick.d;
    return {...pick,d:description,tag:kind+' · '+tags.join(' / '),cartridge:kind};
  });
  run.rwHeld=null;
  run.rwSelected=null;
  run.rwDock=null;
  run.rwInspect=null;
  showReward(afterBoss);
  $('#rwHd').textContent=title;
  $('#rwOwn').innerHTML='';
}
const CARTRIDGE_SIZE=6;
const MODIFIED_LIMIT=2;
const CARTRIDGE_SYNERGIES={
  '광학':['패링 시야 +6°',()=>CFG.fov=Math.min(180,CFG.fov+6)],
  '증폭':['2왕복 이상 탄환 피해 +8%p',()=>CFG.rallyDmg+=0.08],
  '집중':['패링 실패 경직 −0.08초',()=>CFG.whiff=Math.max(0,CFG.whiff-0.08)],
  '탄도':['방패 관통 확률 +10%p',()=>CFG.shieldPierce=Math.min(0.75,CFG.shieldPierce+0.1)],
  '기동':['이동 속도 +12',()=>CFG.moveSpd+=12],
  '생명':['웨이브 회복량 +2%p',()=>CFG.waveHeal+=0.02],
  '재화':['HUB 재화 획득량 +5%',()=>CFG.gainMul*=1.05],
  '폭발':['명중 폭발 피해 +0.15칸'],
  '스킬':['스킬 재사용 대기시간 −4%',()=>{
    SKILL_CD_KEYS.forEach(k=>CFG[k]*=0.96);
    CFG.cdrMul*=0.96;
  }],
  '반격':['패링 사거리 +0.15m',()=>CFG.rangeM+=0.15],
  '보급':['누적 4웨이브마다 새로고침 +1회'],
  '프리즘':['프리즘 내구도 +1'],
  '미끼':['미끼 지속 +0.75초'],
  '혼돈':['탄환 명중 시 치명타 확률 +5%p (피해 ×1.8)']
};
const CARTRIDGE_MASTERY={
  '광학':'매 웨이브 첫 탄환 명중은 확정 치명타',
  '증폭':'3왕복 이상 탄환 피해 ×1.25',
  '집중':'세 번째 패링 성공마다 회복 경직 제거',
  '탄도':'2왕복 이상 탄환이 방패를 확정 관통',
  '기동':'피격 무적 중 이동 속도 ×1.25',
  '생명':'최대 체력 25% 이하로 내려가는 생존 피격 시 체력 15% 회복 (사이클당 1회)',
  '재화':'보스 격파마다 HUB 재화 +60',
  '폭발':'보스에게 탄환 명중 시 폭발 반경 +80',
  '스킬':'탄환 패링 성공 시 R 추가 충전 +1',
  '반격':'피격 후 첫 탄환 명중 피해 ×1.3',
  '보급':'보스 격파 시 새로고침 +1회',
  '프리즘':'프리즘이 분열탄 1발 추가 생성',
  '미끼':'일반 미끼도 주변 적 탄환을 끌어당김',
  '혼돈':'다섯 번째 탄환 명중마다 확정 치명타'
};
const cartridgeMastery=tag=>!!run?.cartridgeMasteries?.[tag];
const cartridgeSynergyLv=tag=>run?.cartridgeSynergies?.[tag]||0;
function cartridgeTagCounts(cartridge){
  const counts={};
  for(const module of cartridge){
    for(const tag of module?.moduleTags||[]) counts[tag]=(counts[tag]||0)+1;
  }
  return counts;
}
function installCartridgeModule(cartridge,slot,module){
  const counts=cartridgeTagCounts(cartridge);
  cartridge[slot]=module;
  grantReward(module);
  module.extra?.fn();
  for(const tag of module.moduleTags){
    const count=(counts[tag]||0)+1;
    if(count%2!==0) continue;
    const levels=run.cartridgeSynergies||(run.cartridgeSynergies={});
    levels[tag]=(levels[tag]||0)+1;
    CARTRIDGE_SYNERGIES[tag][1]?.();
    if(count===6){
      (run.cartridgeMasteries||(run.cartridgeMasteries={}))[tag]=true;
      say(tag+' 6개 시너지 발동','cyan');
    }
  }
}
function createCartridges(count){
  return Array.from({length:count},()=>Array(CARTRIDGE_SIZE).fill(null));
}
function canSlotModule(cartridge,slot,module){
  return !!module?.cartridge&&cartridge?.[slot]===null&&
    (!module.sp||cartridge.filter(item=>item?.sp).length<MODIFIED_LIMIT);
}
function canInstallModule(module){
  return module.chaos||boonLv(module.k)<module.max;
}
function canOfferCartridgeModule(module){
  if(!canInstallModule(module)) return false;
  if(!module.moduleTags) return true;
  const reserved=run.reserveCartridges.flat().filter(item=>item?.k===module.k).length;
  return boonLv(module.k)+reserved<module.max;
}
function circuitDockMarkup(count,cartridges=null,selected=null,reserve=false){
  const label=reserve?'보류 카트리지':'카트리지';
  const docks=Array.from({length:count},(_,i)=>{
    if(!cartridges) return '<span class="circuit-dock" aria-hidden="true"></span>';
    const used=cartridges[i].filter(Boolean).length;
    return '<button type="button" class="circuit-dock" data-action="dock" data-board="'+i+
      '" data-reserve="'+Number(reserve)+'" aria-expanded="'+(selected?.board===i&&selected.reserve===reserve)+
      '" aria-label="'+label+' '+(i+1)+' · 모듈 '+used+' / '+CARTRIDGE_SIZE+'">'+
      (reserve?'<span>'+(i+1)+'</span><small>'+used+' / '+CARTRIDGE_SIZE+'</small>':'')+'</button>';
  }).join('');
  const accessibility=cartridges?' role="group"':' role="img"';
  return '<div class="circuit-preview'+(reserve?' circuit-reserve-docks':'')+'" data-docks="'+count+'"'+accessibility+
    ' aria-label="'+label+' 슬롯 '+count+'개">'+
    (reserve?'':'<div class="circuit-art" aria-hidden="true"></div>'+
      (count>2?'<div class="circuit-dock-bank circuit-dock-art" aria-hidden="true">'+
        '<span></span>'.repeat(count)+'</div>':''))+
    '<div class="circuit-dock-bank">'+docks+'</div></div>';
}
const MODULE_MARKS={
  "광학": "optical",
  "증폭": "amplifier",
  "집중": "focus",
  "탄도": "ballistic",
  "기동": "mobility",
  "생명": "vitality",
  "재화": "currency",
  "폭발": "blast",
  "스킬": "skill",
  "반격": "counter",
  "보급": "supply",
  "프리즘": "prism",
  "미끼": "decoy",
  "혼돈": "chaos"
};
function moduleMark(item){
  if(!item.moduleTags) return '';
  const mark=item.sp?item.k:MODULE_MARKS[item.moduleTags[0]];
  return '<img class="module-mark" src="assets/module-marks/'+mark+'.svg" alt="" width="40" height="40">';
}
function renderCartridgeBoard(){
  const held=run.rwHeld;
  const module=held?.module||run.rwSelected;
  const dock=run.rwDock;
  function renderCartridge(cartridge,board,reserve){
    const slots=cartridge.map((item,slot)=>{
      const content=item?moduleMark(item):'+';
      const label=item?item.n+' · '+item.moduleTags.join(' / '):'';
      const attrs=' data-board="'+board+'" data-slot="'+slot+'"';
      const style=' class="cartridge-slot'+(item?.sp?' modified':'')+'"';
      if(item){
        const inspected=run.rwInspect?.reserve===reserve&&run.rwInspect.board===board&&run.rwInspect.slot===slot;
        return '<button type="button"'+style+attrs+' data-action="inspect" data-reserve="'+Number(reserve)+
          '" aria-pressed="'+inspected+'" aria-label="'+label+'" title="'+label+'">'+content+'</button>';
      }
      const ready=canSlotModule(cartridge,slot,module)&&
        (reserve?!held&&canOfferCartridgeModule(module):canInstallModule(module));
      return '<button type="button"'+style+attrs+' data-action="'+(reserve?'hold':'install')+
        '" aria-label="'+(reserve?'보류':'장착')+' 슬롯 '+(slot+1)+'"'+(ready?'':' disabled')+'>'+content+'</button>';
    });
    const inspect=run.rwInspect;
    const inspected=inspect?.reserve===reserve&&inspect.board===board?cartridge[inspect.slot]:null;
    const details=inspected?'<div class="module-details" tabindex="-1"><b>'+inspected.n+'</b><p>'+
      inspected.moduleTags.join(' / ')+'</p><div>'+inspected.d+'</div>'+
      (reserve?'<div class="circuit-actions">'+
        (canInstallModule(inspected)?'<button type="button" data-action="select" data-board="'+board+'" data-slot="'+inspect.slot+'">꺼내서 장착</button>':
          '<span>장착 한도에 도달했어요.</span>')+
        '<button type="button" data-action="discard" data-board="'+board+'" data-slot="'+inspect.slot+'">보류에서 버리기</button></div>':'')+
      '</div>':'';
    const modified=cartridge.filter(item=>item?.sp).length;
    const synergies=reserve?'':Object.entries(cartridgeTagCounts(cartridge)).map(([tag,count])=>{
      const stage=Math.floor(count/2);
      const mastery=stage===3?'<br><b>6개 효과 · '+CARTRIDGE_MASTERY[tag]+'</b>':'';
      return '<li>'+tag+' '+count+'개 · '+(stage?'단계 '+stage+' · '+CARTRIDGE_SYNERGIES[tag][0]+' ×'+stage:'2개부터 발동')+mastery+'</li>';
    }).join('');
    return '<section class="cartridge-panel'+(reserve?' reserve-panel':'')+'"><h4>'+(reserve?'보류 카트리지 ':'카트리지 ')+(board+1)+
      ' · 개조 '+modified+'/'+MODIFIED_LIMIT+'</h4><div class="cartridge-portrait">'+
      '<div class="cartridge-art" aria-hidden="true"></div><div class="cartridge-grid">'+slots.join('')+'</div></div>'+
      details+(synergies?'<ul class="cartridge-synergies">'+synergies+'</ul>':'')+'</section>';
  }
  const selected=dock&&(dock.reserve?run.reserveCartridges:run.cartridges)[dock.board];
  const reserves=run.reserveCartridges;
  $('#reward').classList.add('circuit-open');
  $('#rwOwn').innerHTML='<p class="circuit-pending">'+module.n+
    ' · '+(selected?'빈 모듈 슬롯을 선택하세요.':'카트리지를 선택하세요.')+'</p>'+
    '<div class="circuit-workspace'+(selected?' has-cartridge':'')+'"><div class="circuit-main">'+
    circuitDockMarkup(run.cartridges.length,run.cartridges,dock)+
    (reserves.length?'<h4>보류 카트리지</h4>'+circuitDockMarkup(reserves.length,reserves,dock,true):'')+'</div>'+
    (selected?renderCartridge(selected,dock.board,dock.reserve):'')+'</div>'+
    '<div class="circuit-actions"><button type="button" data-action="'+(held?'cancel':'back')+'">'+
    (held?'선택 취소':'보상으로 돌아가기')+'</button>'+
    (held?'':'<button type="button" data-action="skip">보상 건너뛰기</button>')+'</div>';
}
function showReward(afterBoss){
  run.rwBoss=afterBoss;
  const rr=$('#rwReroll'); rr.textContent='새로고침 R · 남은 '+(run.rerolls||0); rr.disabled=!(run.rerolls>0);
  run.phase='reward';
  const dunHd=run.dunReward?'<b style="color:var(--red)">던전 보상</b> · ':''; run.dunReward=0;
  $('#rwHd').innerHTML=dunHd+(afterBoss?'알레테이아 격파 · <b>사이클 '+run.cycle+'</b>'
                                 :(run.wave===0?'선행 보급':'웨이브 '+run.wave+' 완료'))+' &nbsp;—&nbsp; 하나를 고르세요';
  run.rwStatPick=0;
  renderRwRow();
  const own=Object.keys(run.boons);
  $('#rwOwn').innerHTML=own.length
    ? '보유 — '+own.map(k=>{const b=boonDef(k);return '<b>'+b.n+'</b>'+(run.boons[k]>1?' ×'+run.boons[k]:'');}).join(' · ')
    : '';
  $('#reward').classList.add('on');
  sfx('wave');
}
function renderRwRow(){
  $('#reward').classList.remove('circuit-open','choice');
  $('#rwRow').hidden=false;
  $('#rwRow').classList.toggle('cartridge-offer',rwPicks.some(b=>b.cartridge||b.instant));
  $('#rwRow').innerHTML=rwPicks.map((b,i)=>
    '<div class="bc'+(b.sp?' sp':'')+'" data-i="'+i+'">'+
    '<div class="num">'+(i+1)+'</div>'+
    (b.tag?'<div class="k">'+b.tag+'</div>':'')+
    (b.cartridge?moduleMark(b):'')+
    '<div class="n">'+(b.nh||b.n)+'</div>'+
    '<div class="d">'+b.d+'</div>'+
    '<div class="st">'+(b.cartridge?'선택 후 장착':b.instant?'즉시 사용':boonLv(b.look||b.k)?'보유 '+boonLv(b.look||b.k)+' / '+b.max:'신규')+'</div>'+
    '</div>').join('');
}
/* v2.52 보상 새로고침 — 생존/보급의 '새로고침' 강화와 보상 '새로고침 +1'로 횟수를 얻는다 */
function rerollReward(){
  if(!run||run.phase!=='reward'||!(run.rerolls>0)||run.rwStatPick) return;
  run.rerolls--; sfx('ui'); openReward(run.rwBoss,true,run.rwCartridgeWave);
}
$('#rwReroll').onclick=rerollReward;
function takeReward(i){
  if(!run||run.phase!=='reward'||run.rwSelected) return;
  const b=rwPicks[i]; if(!b) return;
  if(b.cartridge){
    run.rwSelected=b;
    $('#rwRow').hidden=true;
    renderCartridgeBoard();
    $('#reward .box').scrollTop=0;
    $('#rwOwn').querySelector('[data-action="dock"]')?.focus({preventScroll:true});
    return;
  }
  applyReward(b);
}
function grantReward(b){
  if(!b.chaos) run.boons[b.k]=(run.boons[b.k]||0)+1;
  if(b.sp) stat('specials');   // v2.68
  b.fn();
}
function applyReward(b){
  if(!b.stay) run.rwStatPick=0;
  grantReward(b);
  if(b.stay) return;
  finishReward(b);
}
function finishReward(b){
  say(b.n,'cyan'); sfx('heal'); burst(P.x,P.y,'cyan',14,150);
  closeReward();
}
function closeReward(){
  run.rwSelected=null;
  $('#reward').classList.remove('on');
  endReward();
  if(run.startRewards>0){ run.startRewards--; openReward(false); }   // v2.17 선행 보급 2단계
  else lockMouse();
}
/* v3.62 출격 직후 보상(선행 보급)을 고르면 벽 설치 단계가 'break'로 덮여 사라지던 문제 — 원래 단계로 돌아간다 */
function endReward(){
  if(run.rwPrev==='build') run.phase='build';
  else if(run.rwPrev==='clear') run.phase='clear';   // v3.113 웨이브를 비운 직후 뜬 카드(위험한 선택 · 공명) — 비운 뒤 3초가 끝나야 그 웨이브 보상이 나온다
  else { run.phase='break'; run.phaseT=Math.max(run.phaseT,0.9); }   // v2.2 보스 직후 CYCLE 연출 시간 유지
}
$('#rwRow').addEventListener('click',e=>{
  const c=e.target.closest('.bc'); if(!c) return;
  takeReward(+c.dataset.i);
});

function nearestEnemy(){
  let best=null,bd=1e9;
  ens.forEach(e=>{const d=dist(e.x,e.y,P.x,P.y); if(d<bd){bd=d;best=e;}});
  return best;
}

$('#rwOwn').addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');
  if(!button||run?.phase!=='reward'||!run.rwSelected) return;
  const {action,board,slot,reserve}=button.dataset;
  if(action==='dock'){
    const isReserve=reserve==='1';
    const index=Number(board);
    if(!(isReserve?run.reserveCartridges:run.cartridges)[index]) return;
    run.rwDock={board:index,reserve:isReserve};
    run.rwInspect=null;
    renderCartridgeBoard();
    $('#rwOwn').querySelector('[data-action="dock"][aria-expanded="true"]')?.focus({preventScroll:true});
    return;
  }
  if(action==='back'){
    run.rwSelected=null;
    run.rwDock=null;
    run.rwInspect=null;
    $('#rwOwn').innerHTML='';
    renderRwRow();
    return;
  }
  const held=run.rwHeld;
  if(action==='skip'){ closeReward(); return; }
  if(action==='cancel'){ run.rwHeld=null; renderCartridgeBoard(); return; }
  if(action==='inspect'){
    const isReserve=reserve==='1', index=Number(board), position=Number(slot);
    if(!(isReserve?run.reserveCartridges:run.cartridges)[index]?.[position]) return;
    run.rwInspect={board:index,slot:position,reserve:isReserve};
    renderCartridgeBoard();
    $('#rwOwn .module-details')?.focus();
    return;
  }
  if(action==='discard'){
    const inspected=run.rwInspect;
    if(!inspected?.reserve||inspected.board!==Number(board)||inspected.slot!==Number(slot)) return;
    if(held?.board===board&&held.slot===slot) run.rwHeld=null;
    run.reserveCartridges[board][slot]=null;
    run.rwInspect=null;
  } else if(action==='select'){
    const stored=run.reserveCartridges[board]?.[slot];
    if(!stored||!canInstallModule(stored)) return;
    run.rwHeld={board,slot,module:stored};
    run.rwDock=null;
    run.rwInspect=null;
  } else if(action==='hold'||action==='install'){
    placeCartridgeReward(board,slot,action==='hold');
    return;
  }
  renderCartridgeBoard();
});
function placeCartridgeReward(board,slot,reserve){
  if(run?.phase!=='reward'||!run.rwSelected) return false;
  const held=run.rwHeld;
  const module=held?.module||run.rwSelected;
  const cartridge=(reserve?run.reserveCartridges:run.cartridges)[board];
  if(!canSlotModule(cartridge,slot,module)) return false;
  if(reserve){
    if(held||!canOfferCartridgeModule(module)) return false;
    cartridge[slot]=module;
    closeReward();
    return true;
  }
  if(!canInstallModule(module)) return false;
  installCartridgeModule(cartridge,slot,module);
  if(!held){ finishReward(module); return true; }
  run.reserveCartridges[held.board][held.slot]=null;
  run.rwHeld=null;
  renderCartridgeBoard();
  return true;
}

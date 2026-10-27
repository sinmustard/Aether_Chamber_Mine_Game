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
  const pool=BOONS.filter(b=>boonLv(b.k)<b.max); if(!pool.length) return chaosPick();
  const look=pool[Math.floor(Math.random()*pool.length)];
  return {k:'c_dis',look:look.k,n:look.n,d:look.d,tag:look.tag,max:look.max,chaos:1,fn:()=>{
    const sp=SPECIALS.filter(x=>boonLv(x.k)<x.max&&x.k!=='s_prismdur');
    if(sp.length&&Math.random()<0.6){ const r=rarePick(sp); run.boons[r.k]=(run.boons[r.k]||0)+1; r.fn(); stat('specials'); announce('위장된 특수 특전! — '+r.n,'warn'); }
    else { const c=chaosPick(); c.fn(); }
  }};
}
let rwOpenAt=0;   // v3.67 보상 창이 열린 시각 (R 키 새로고침 0.5초 막기)
function openReward(afterBoss,fromReroll){
  if(!fromReroll) rwOpenAt=performance.now();
  if(run.phase!=='reward') run.rwPrev=run.phase;   // v3.62 보상을 고른 뒤 돌아갈 단계 (출격 직후 보상은 벽 설치 단계)
  run.rwRoll=fromReroll?(run.rwRoll||0)+1:0; reseedDaily(100+run.wave*50+run.rwRoll);   // v3.62
  const pool=BOONS.filter(b=>boonLv(b.k)<b.max);
  if(!pool.length){ endReward(); return; }
  unlockMouse();   // v3.62 마우스가 잠긴 채면 커서가 안 보이고 클릭이 카드 대신 캔버스(패링)로 갔다
  rwPicks=[];
  const bag=pool.slice();
  while(rwPicks.length<3 && bag.length)
    rwPicks.push(bag.splice(bag.indexOf(rarePick(bag)),1)[0]);
  /* v2.37 특수 특전 — 확률로 마지막 칸을 특수 특전으로 바꾼다 */
  /* v2.41 보스를 잡은 직후 보상은 특수 특전 확률 +30%p (최대 90%) */
  const spChance=afterBoss? CFG.specialBoss : CFG.specialChance;   // v2.47 보스 후 38 / 47 / 50%
  if(run.mode==='chaosx'&&Math.random()<Math.max(spChance,0.25)){
    const r=Math.random(), pick=r<0.24?chaosDisguise():r<0.4?chaosTrap():r<0.415?chaosPrismTrap():r<0.6?chaosPick():r<0.8?chaosPickHidden():chaosPlayerPick();
    rwPicks[Math.floor(Math.random()*Math.max(1,rwPicks.length))]=pick;
  }
  else if(CFG.specialChance>0 && Math.random()<spChance){
    const sp=SPECIALS.filter(x=>boonLv(x.k)<x.max&&!(run.mode==='chaosx'&&x.k==='s_prismdur'));
    if(sp.length){ const pick=rarePick(sp);   // v2.52 특수 특전이 들어가는 칸도 무작위
      if(rwPicks.length<3) rwPicks.splice(Math.floor(Math.random()*(rwPicks.length+1)),0,pick);
      else rwPicks[Math.floor(Math.random()*rwPicks.length)]=pick; }
  }
  if(run.mode==='chaosx'&&fromReroll&&Math.random()<0.45) rwPicks[Math.floor(Math.random()*Math.max(1,rwPicks.length))]=chaosAmp8();
  run.rwBoss=afterBoss;
  const rr=$('#rwReroll'); rr.textContent='새로고침 R · 남은 '+(run.rerolls||0); rr.disabled=!(run.rerolls>0);
  run.phase='reward';
  $('#rwHd').innerHTML=(afterBoss?'알레테이아 격파 · <b>사이클 '+run.cycle+'</b>'
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
  $('#rwRow').innerHTML=rwPicks.map((b,i)=>
    '<div class="bc'+(b.sp?' sp':'')+'" data-i="'+i+'">'+
    '<div class="num">'+(i+1)+'</div>'+
    '<div class="k">'+b.tag+'</div>'+
    '<div class="n">'+(b.nh||b.n)+'</div>'+
    '<div class="d">'+b.d+'</div>'+
    '<div class="st">'+(boonLv(b.look||b.k)?'보유 '+boonLv(b.look||b.k)+' / '+b.max:'신규')+'</div>'+
    '</div>').join('');
}
/* v2.52 보상 새로고침 — 생존/보급의 '새로고침' 강화와 보상 '새로고침 +1'로 횟수를 얻는다 */
function rerollReward(){
  if(!run||run.phase!=='reward'||!(run.rerolls>0)||run.rwStatPick) return;
  run.rerolls--; sfx('ui'); openReward(run.rwBoss,true);
}
$('#rwReroll').onclick=rerollReward;
function takeReward(i){
  const b=rwPicks[i]; if(!b) return;
  if(!b.chaos) run.boons[b.k]=(run.boons[b.k]||0)+1;
  if(b.sp) stat('specials');   // v2.68
  if(b.stay){ b.fn(); return; }
  run.rwStatPick=0;
  b.fn();
  $('#reward').classList.remove('on');
  endReward();
  say(b.n,'cyan'); sfx('heal'); burst(P.x,P.y,'cyan',14,150);
  if(run.startRewards>0){ run.startRewards--; openReward(false); }   // v2.17 선행 보급 2단계
  else lockMouse();
}
/* v3.62 출격 직후 보상(선행 보급)을 고르면 벽 설치 단계가 'break'로 덮여 사라지던 문제 — 원래 단계로 돌아간다 */
function endReward(){
  if(run.rwPrev==='build') run.phase='build';
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

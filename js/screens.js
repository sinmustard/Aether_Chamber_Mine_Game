"use strict";
/* ================= 화면 전환 ================= */
/* v2.4 폰에서 전체화면 + 가로 고정.
   안드로이드 크롬은 전체화면 상태에서만 회전 고정이 되고, 아이폰 사파리는 고정을 지원하지 않는다.
   그래서 실패해도 조용히 넘어가고, 세로면 안내를 띄운다 */
/* v2.59 아이폰·아이패드 — 사파리는 일반 화면에서 전체화면을 막아 두어서 CSS로 꽉 채운다 */
const isIOS=()=>/iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&(navigator.maxTouchPoints||0)>1)||/iPad/.test(navigator.userAgent);
const isStandalone=()=>!!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||(window.matchMedia&&matchMedia('(display-mode: fullscreen)').matches));
if(isIOS()){
  document.body.classList.add('fsfake');
  queueMicrotask(()=>{ try{
    const tip=document.getElementById('iosTip');
    if(tip&&!isStandalone()&&!localStorage.getItem('aether_ios_tip')){ tip.classList.add('on');
      document.getElementById('iosTipOk').onclick=()=>{ tip.classList.remove('on'); localStorage.setItem('aether_ios_tip','1'); }; }
  }catch(e){} });
}
const isPhone=()=>{ const m=window.matchMedia; if(!m)return false;
  return m('(max-width:900px)').matches||m('(pointer:coarse)').matches; };
async function goLandscape(){
  if(!isPhone())return;
  try{
    const el=document.documentElement;
    if(!document.fullscreenElement){
      if(el.requestFullscreen) await el.requestFullscreen({navigationUI:'hide'});
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
    const so=window.screen&&window.screen.orientation;
    if(so&&so.lock) await so.lock('landscape');
  }catch(e){}
}
function exitLandscape(){
  try{
    const so=window.screen&&window.screen.orientation;
    if(so&&so.unlock) so.unlock();
    if(document.fullscreenElement&&document.exitFullscreen) document.exitFullscreen();
  }catch(e){}
}
$('#goFs').onclick=goLandscape;
/* v3.3 전체화면 — 폰의 자동 가로 전환과 별개로, 아무 기기에서나 옵션에서 수동으로 켜고 끌 수 있게 한다 */
function toggleFullscreen(){
  fsByUs=performance.now();   // v2.53 설정에서 직접 켜고 끈 전환은 ESC로 치지 않는다
  try{
    if(document.fullscreenElement||document.webkitFullscreenElement){
      if(document.exitFullscreen) document.exitFullscreen();
      else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      const el=document.documentElement;
      if(el.requestFullscreen) el.requestFullscreen();
      else if(el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  }catch(e){}
}
/* v3.3 폰의 goLandscape()로 들어가든, 방금 만든 버튼으로 들어가든, ESC로 나가든
   전체화면 상태가 바뀔 때마다 body.fullscreen을 맞춰서 #frame이 꽉 차게 한다 */
function syncFsClass(){
  const on=!!(document.fullscreenElement||document.webkitFullscreenElement);
  document.body.classList.toggle('fullscreen', on);
  if(on) unlockMouse(); else if(screen==='game'&&!paused) lockMouse();   // v2.63 전체화면은 잠금 없이 실제 마우스 위치로 조준
  /* v2.56 전체화면에서 ESC를 게임이 받도록 키보드 잠금(크롬·엣지 PC).
     짧게 누른 ESC는 설정 창 닫기·일시정지로 쓰이고, 전체화면은 ESC를 '길게' 눌러야 꺼진다 */
  try{
    if(on && navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(()=>{});
    else if(!on && navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
  }catch(e){}
}
const escLockable=()=>!!(navigator.keyboard&&navigator.keyboard.lock)&&!isTouchDev();
document.addEventListener('fullscreenchange',syncFsClass);
document.addEventListener('webkitfullscreenchange',syncFsClass);
/* v2.5 폰에서는 첫 터치(또는 클릭) 때 바로 전체화면으로 들어간다.
   브라우저가 사용자 동작 없이는 전체화면을 허용하지 않기 때문에 첫 입력을 쓴다 */
function armFullscreen(){
  if(!isPhone())return;
  const once=()=>{ goLandscape();
    removeEventListener('pointerdown',once); removeEventListener('touchstart',once); };
  addEventListener('pointerdown',once); addEventListener('touchstart',once);
}
function go(id){
  if(id==='hub'&&!getSession()&&!offlineOK){ openLogin(); return; }   // v2.58 로그인 먼저
  if(id==='hub') setTimeout(syncFromCloud,0);   // v2.68 HUB에 들어갈 때마다 다른 기기 기록 확인
  if(id!=='game') unseedRandom();   // v2.68 데일리 시드 해제
  screen=id;
  document.body.classList.toggle('in-game',id==='game');
  $$('.screen').forEach(s=>s.classList.toggle('on',s.id===id));
  gcv.style.display = id==='game'?'block':'none';
  $('#bgcv').style.display = id==='game'?'none':'block';
  $('#modal').classList.remove('on'); $('#pause').classList.remove('on'); $('#reward').classList.remove('on'); paused=false;   // v3.10 웨이브 보상 받는 중에 HUB로 나가면 보상창이 안 닫히던 문제
  if(id!=='game') unlockMouse();   // v2.12
  if(id!=='game') $('#tutBar').classList.remove('on');   // v2.60
  document.body.classList.remove('ui-cover');   // v2.80
  if(id==='hub'){ $('#cur').textContent=META.cur.toLocaleString(); renderCards(); renderDetail(); renderSkillSel(); renderRecs();
    if(!OPT.tutSeen) openModal('tutorial'); }   // v3.4 처음 HUB에 들어오면 튜토리얼
  if(id==='title'){ $('#tBest').textContent=META.best.toLocaleString(); }
  if(isPhone()) goLandscape();   // v2.5 어느 화면이든 전체화면 유지
  bgmApply();   // v2.52
}
/* v2.60 체험판 튜토리얼 — 실제 전투 화면에서 한 단계씩 직접 해 본다. 죽지 않고, 재화·랭킹·저장에는 영향 없음 */
const TUT_STEPS=6;
function tutText(step){
  const touch=touchMode||isTouchDev(), hold=touch&&lv('mparry')>0&&OPT.holdParry;
  const PK=keyName(OPT.keyParry), FK=keyName(OPT.keySkill), QK=keyName(OPT.keyWall), RK=keyName(OPT.keyR);
  return [
    ['이동', touch?'화면 <b>왼쪽</b>을 드래그해서 움직여 보세요.':'<b>W A S D</b>로 움직여 보세요.'],
    ['패링', (hold?'화면 <b>오른쪽</b>을 드래그해 적 쪽을 조준하고 있으면, 탄환이 들어올 때 <b>자동으로 패링</b>돼요.'
              :touch?'화면 <b>오른쪽</b>을 드래그해 조준하고, 탄환이 빛날 때 <b>손을 떼면</b> 패링돼요.'
              :'마우스로 조준하고, 탄환이 범위 안에서 빛날 때 <b>'+PK+'</b> 또는 <b>좌클릭</b>으로 패링해요.')+' 빗나가면 잠깐 굳어요.'],
    ['반격', '패링한 탄환은 내 것이 돼서 적에게 날아가요. 계속 받아쳐서 <b>적을 쓰러뜨려</b> 보세요.'],
    ['F 스킬 · 회복', '체력이 줄어 있어요. '+(touch?'아래 <b>F 스킬</b> 버튼':'<b>'+FK+'</b> 키')+'로 회복해 보세요. 실제 게임에선 HUB에서 해금하고 장착해요.'],
    ['Q 스킬 · 벽', (touch?'아래 <b>Q 스킬</b> 버튼':'<b>'+QK+'</b> 키')+'으로 조준한 방향에 벽을 세워 보세요. 벽은 적 탄환을 막아 줘요.'],
    ['R 스킬 · 덮어쓰기', 'R 게이지가 가득 찼어요. '+(touch?'아래 <b>R 스킬</b> 버튼':'<b>'+RK+'</b> 키')+'으로 화면의 적 탄환을 한꺼번에 빼앗아 보세요. 평소엔 패링 +1, 처치 +2로 채워요.'],
    ['체험 완료!', '판마다 2웨이브씩 보상을 고르고, 10웨이브마다 보스가 나와요. HUB에서 재화로 강화하고 스킬을 해금하세요.']
  ][step];
}
function tutShow(){
  const T=run&&run.tut; if(!T) return;
  const [t,d]=tutText(T.step);
  $('#tbStep').textContent=T.step<TUT_STEPS?'튜토리얼 '+(T.step+1)+' / '+TUT_STEPS:'튜토리얼';
  $('#tbT').textContent=t; $('#tbD').innerHTML=d; $('#tbP').textContent='';
  $('#tbBtns').innerHTML=T.step<TUT_STEPS
    ? '<button id="tbSkip">튜토리얼 끝내기</button>'
    : '<button id="tbMore">계속 연습</button><button id="tbTitle">타이틀로</button><button class="go" id="tbGo">출격하기</button>';
  $('#tutBar').classList.add('on');
}
function tutSpawnDummy(x,y,hits){
  const e=spawnEnemyAt('mob',x,y); const hp=HIT_UNIT*(hits||999); e.hp=e.hpMax=hp; e.fireT=1.2; e.tut=1; return e;
}
function tutEnter(step){
  const T=run.tut; T.step=step; T.t=0;
  if(step===0){ T.fire=false; T.dist=0; T.px=P.x; T.py=P.y; }
  else if(step===1){ T.parried=0; T.fire=true; CFG.fire=2.0; CFG.spd=170;
    ens.length=0; tutSpawnDummy(760,380); }
  else if(step===2){ T.fire=true; if(!ens.length) tutSpawnDummy(760,380,2);
    ens.forEach(e=>{ e.hp=e.hpMax=HIT_UNIT*2; }); }
  else if(step===3){ T.fire=false; bullets.length=0; queue.length=0;
    CFG.skill='heal'; CFG.healAmt=40; CFG.healCd=6; P.skillCd=0; P.hp=Math.round(CFG.hpMax*0.5); }
  else if(step===4){ CFG.qSkill='wall'; CFG.wallMax=2; P.wallCd=0; run.walls=[]; }
  else if(step===5){ CFG.skillR='overwrite'; CFG.rNeed=10; P.rChg=10; T.fire=true; CFG.fire=1.1;
    ens.length=0; tutSpawnDummy(760,250); tutSpawnDummy(780,520); }
  else { T.fire=false; ens.length=0; bullets.length=0; queue.length=0; OPT.tutSeen=1; save(); sfx('wave'); announce('튜토리얼 완료','cyan'); }
  tutShow(); if(step>0&&step<TUT_STEPS){ sfx('heal'); burst(P.x,P.y,'cyan',16,180); }
}
function tutTick(dt){
  const T=run.tut; T.t+=dt;
  if(T.step===0){ T.dist+=Math.hypot(P.x-T.px,P.y-T.py); T.px=P.x; T.py=P.y;
    $('#tbP').textContent=Math.min(100,Math.round(T.dist/300*100))+'%'; if(T.dist>=300) tutEnter(1); }
  else if(T.step===1){ $('#tbP').textContent='패링 '+Math.min(3,T.parried||0)+' / 3'; if((T.parried||0)>=3) tutEnter(2); }
  else if(T.step===2){ if(!ens.length) tutEnter(3); }
  else if(T.step===3){ if(P.skillCd>0) tutEnter(4); }
  else if(T.step===4){ if(run.walls.length>0) tutEnter(5); }
  else if(T.step===6){ if(T.free&&!ens.length){ tutSpawnDummy(760,300,3); tutSpawnDummy(800,480,3); } }
  else if(T.step===5){ if(P.rChg<CFG.rNeed-0.5) tutEnter(6);
    else if(!ens.length){ tutSpawnDummy(760,250); tutSpawnDummy(780,520); } }
}
function startTutorial(){
  newRun();
  Object.assign(run,{tut:{step:0,t:0},phase:'tut',startRewards:0,revives:0,walls:[]});
  ens.length=0; bullets.length=0; queue.length=0;
  CFG.skill=''; CFG.qSkill=''; CFG.skillR='';
  go('game'); tutEnter(0);
}
function endTutorial(to){ $('#tutBar').classList.remove('on'); OPT.tutSeen=1; save();
  if(to==='run') startRun(); else go(to||'title'); }
document.addEventListener('click',e=>{
  const id=e.target&&e.target.id;
  if(id==='tbSkip') askConfirm('튜토리얼을 끝낼까요?','언제든 타이틀의 튜토리얼에서 다시 할 수 있어요.','끝내기',()=>endTutorial('title'));
  else if(id==='tbTitle') endTutorial('title');
  else if(id==='tbGo') endTutorial('run');
  else if(id==='tbMore'){ const T=run&&run.tut; if(T){ T.fire=true; CFG.fire=1.4; ens.length=0; tutSpawnDummy(760,300,3); tutSpawnDummy(800,480,3);
    $('#tbD').innerHTML='자유롭게 연습해 보세요. 적을 다 쓰러뜨리면 다시 나와요.'; T.free=true; } }
});
/* v2.63 무작위 보정 — 서로 다른 능력치를 골라 강화 1단계만큼 올린다 */
const RAND_BOOSTS=[
 ['패링 사거리 +0.3m',()=>{CFG.rangeM+=0.3;}],
 ['패링 시야각 +5°',()=>{CFG.fov=Math.min(180,CFG.fov+5);}],
 ['빗나감 페널티 −0.1초',()=>{CFG.whiff=Math.max(0.3,CFG.whiff-0.1);}],
 ['이동 속도 +15',()=>{CFG.moveSpd+=15;}],
 ['최대 체력 +15',()=>{CFG.hpMax+=15; P.hp+=15;}],
 ['유도 +0.6',()=>{CFG.homing+=0.6;}]
];
function applyRandBoosts(){
  run.randBoosts=[]; const n=CFG.randBoosts||0; if(!n) return;
  const bag=RAND_BOOSTS.slice();
  for(let i=0;i<n&&bag.length;i++){ const [name,fn]=bag.splice(Math.floor(Math.random()*bag.length),1)[0]; fn(); run.randBoosts.push(name); }
  setTimeout(()=>{ if(run&&run.randBoosts.length) announce('무작위 보정 — '+run.randBoosts.join(' · '),'cyan'); },700);
}
/* v2.68 ⑥ 데일리 챌린지 — 하루 동안 모두 같은 맵·적·보상 순서 (난수 고정), 강화 없이 기본 능력치로 */
const REAL_RANDOM=Math.random;
function seedRandom(seed){ let a=seed>>>0;
  Math.random=function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function unseedRandom(){ Math.random=REAL_RANDOM; }
const todayKST=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
let lastMode='normal';
const MODE_NAME={normal:'노멀',hard:'하드',daily:'데일리'};
function startRun(mode){
  if(typeof mode!=='string') mode=lastMode||OPT.mode||'normal';
  lastMode=mode; unseedRandom(); dmgNums=[];
  let keep=null;
  if(mode==='daily'){
    keep={lv:UPG.map(u=>u.lv), sk:[META.skill,META.skillQ,META.skillR]};
    UPG.forEach(u=>{ if(!u.phoneOnly) u.lv=0; }); META.skill=''; META.skillQ=''; META.skillR='';
    seedRandom(+todayKST().replace(/-/g,''));
  }
  newRun();
  if(keep){ UPG.forEach((u,i)=>u.lv=keep.lv[i]); META.skill=keep.sk[0]; META.skillQ=keep.sk[1]; META.skillR=keep.sk[2]; }
  run.mode=mode; run.day=mode==='daily'?todayKST():'';
  /* ③ 하드 — 적 체력 ×1.5 · 탄속 ×1.15 · 발사 간격 ×0.85 · 받는 피해 ×1.3 / 점수 ×1.3 · 재화 ×1.5 */
  if(mode==='hard'){ run.diff*=1.5; CFG.spd*=1.15; CFG.fire*=0.85; CFG.scoreMul*=1.3; CFG.gainMul=(CFG.gainMul||1)*1.5; }
  if(mode==='daily'){ CFG.gainMul=(CFG.gainMul||1)*0.5; run.startRewards=0; run.revives=0; run.randBoosts=[]; }
  else applyRandBoosts();
  go('game');
  if(mode!=='normal') setTimeout(()=>{ if(run) announce(mode==='hard'?'하드 모드':mode==='chaos'?'카오스 모드':'데일리 챌린지 · '+run.day,'warn'); },300);
  if(run.startRewards>0){ run.startRewards--; openReward(false); }   // v2.17 출격하자마자 보상 선택
}
function endRun(){
  /* v1.7 재화: 점수÷3 + 처치×5 + 도달 웨이브×6 + 보스 격파×150 (점수 비중 상향) */
  const gScore=Math.round(run.score/3), gKill=run.kills*5,
        gWave=((run.cycle-1)*(BOSS_WAVE+1)+run.wave)*6, gBoss=run.bossKills*150;
  let gain=Math.round((gScore+gKill+gWave+gBoss)*(CFG.gainMul||1));   // v2.17 재화 획득 강화
  if(!isFinite(gain)||gain<0) gain=0;                                    // v2.46 계산이 깨져도 0 이하로 안 떨어지게
  syncMeta();                                                            // v2.46 다른 탭이 저장한 최신 재화에 더한다
  META.cur+=gain;
  const isNew=run.score>META.best;
  if(isNew)META.best=run.score;
  if(run.mode!=='daily') META.bestCycle=Math.max(META.bestCycle,run.cycle);
  /* v2.68 누적 기록 · 업적 */
  stat('runs'); stat('playTime',Math.max(0,Math.round(run.time))); statMax('bestRet',run.bestRet); statMax('bestScore',run.score);
  if(run.mode==='daily') stat('dailyRuns'); if(run.mode==='hard') statMax('hardBestCycle',run.cycle);
  const newAch=run.cheat?[]:checkAch(); const achGold=newAch.reduce((a,x)=>a+x.r,0); META.cur+=achGold;
  save();
  $('#rScore').textContent=run.score.toLocaleString();
  $('#rNew').textContent=isNew?'신기록':'';
  $('#rStats').innerHTML=[
    ['생존 시간',fmtTime(run.time)],['처치',run.kills],['최장 왕복','×'+run.bestRet],
    ['도달 사이클',run.cycle],['보스 격파',run.bossKills],['최고 탄속',Math.round(run.maxSpd)]
  ].map(([a,b])=>'<div>'+a+'<b>'+b+'</b></div>').join('');
  $('#rGain').innerHTML='◆ +'+gain.toLocaleString()+
    '<div style="font-size:10.5px;color:var(--dim);letter-spacing:.06em;margin-top:6px">'+
    '점수 '+gScore+' · 처치 '+gKill+' · 웨이브 '+gWave+(gBoss?' · 보스 '+gBoss:'')+'</div>';
  $('#rBoons').innerHTML=Object.keys(run.boons).length? '받은 보상 — '+Object.keys(run.boons).map(k=>{ const b=boonDef(k);
      return b? '<b>'+b.n+'</b>'+(run.boons[k]>1?' ×'+run.boons[k]:'') : ''; }).join(' · ') : '';   // v2.52
  $('#cloudStat').textContent=getSession()?'☁ 자동 저장 중…':'';   // v2.58
  if(getSession()){ const nm=getSession().name; cloudAutoSave().then(ok=>{ $('#cloudStat').textContent= ok==='badpin'?'☁ 비밀번호가 계정과 달라 저장 못 했어요 — 다시 로그인해 주세요'
      : ok?'☁ '+nm+' 계정에 자동 저장했어요':'☁ 자동 저장 실패 — 다음 판에 다시 시도해요'; }); }   // v2.76
  /* v2.62 디스코드 랭킹 — 로그인 계정으로만 자동 기록 (게임 안 랭킹과 별개, 이름을 바꿔 올릴 수 없음) */
  $('#discStat').textContent='';
  if(run.mode==='hard'||run.mode==='daily'){   // v2.68 하드 · 데일리는 각자 랭킹으로 (로그인 계정만)
    const ss=getSession(), nm=run.mode==='hard'?'하드':'데일리';
    if(!ss) $('#discStat').textContent=nm+' 랭킹은 로그인해야 기록돼요';
    else if(run.cheat) $('#discStat').textContent='디버그를 쓴 판은 '+nm+' 랭킹에 기록되지 않아요';
    else if(run.score>0){
      const body={p_name:ss.name,p_pin:ss.pin,p_score:Math.round(run.score),p_cycle:run.cycle,p_wave:run.wave,p_kills:run.kills,p_build:BUILD};
      if(run.mode==='daily') body.p_day=run.day;
      cloudCall(run.mode==='hard'?'aether_submit_hard':'aether_submit_daily',body)
        .then(d=>{ const r=Array.isArray(d)?d[0]:d; if(!r) return;
          $('#discStat').textContent=nm+' 랭킹 '+(r.updated?'기록 갱신 · ':'최고 '+Number(r.best).toLocaleString()+'점 유지 · ')+r.rank+'위'; })
        .catch(e=>{ $('#discStat').textContent=nm+' 랭킹 기록 실패'+(badSession(e)?' (다시 로그인 필요)':/점수/.test(String(e.message))?' (점수 확인 실패)':''); });
    }
  } else
  if(getSession()&&!run.cheat&&!run.tut&&run.score>0){
    const ss=getSession();
    cloudCall('aether_submit_verified',{p_name:ss.name,p_pin:ss.pin,p_score:Math.round(run.score),p_cycle:run.cycle,p_wave:run.wave,p_kills:run.kills,p_build:BUILD})
      .then(d=>{ const r=Array.isArray(d)?d[0]:d; if(!r) return;
        $('#discStat').textContent= r.updated? '디스코드 랭킹 기록 갱신 · '+r.rank+'위' : '디스코드 랭킹 · 최고 기록 '+Number(r.best).toLocaleString()+'점 유지 · '+r.rank+'위'; })
      .catch(e=>{ $('#discStat').textContent='디스코드 랭킹 기록 실패'+(badSession(e)?' (다시 로그인 필요)':' — 다음 판에 다시 시도해요'); });
  } else if(getSession()&&run.cheat) $('#discStat').textContent='디버그를 쓴 판은 디스코드 랭킹에 기록되지 않아요';
  $('#achStat').innerHTML=newAch.length?'업적 달성 — '+newAch.map(a=>'<b>'+a.n+'</b>').join(' · ')+'  ◆ +'+achGold.toLocaleString():'';   // v2.68
  setupRankBox();   // v2.48
  go('result');
}
/* v3.4 일시정지하면 설정 화면이 같이 뜬다. 재개할 땐(ESC·상단 버튼·설정 닫기) 같이 닫힌다 */
/* v2.21 ESC — 일시정지 메뉴(계속하기 · 설정 · HUB). 전체화면이 풀리거나 창을 벗어나면 자동으로 멈춘다 */
/* v2.52 ESC로 일시정지 → ESC로 재개가 안 되던 문제
   · 크롬은 마우스가 잠겨 있을 때 첫 ESC를 '잠금 풀기'에 써 버려서 키 입력이 안 들어오거나,
     잠금 해제·전체화면 해제로 멈춘 직후 같은 ESC가 한 번 더 들어와 바로 다시 풀려 버렸다.
   · 그래서 ① 잠금이 풀리면 바로 일시정지 ② 멈춘 직후 0.3초 안의 전환은 무시
     ③ ESC로 재개할 때는 마우스 잠금·전체화면을 다시 요청하지 않는다(키보드로는 브라우저가 거절) — 화면을 클릭하면 다시 잠긴다 */
let pauseAt=0, fsByUs=0;
/* v2.53 ESC 한 번 = 한 단계: 확인 팝업 → 설정/보상 보기 창 → 일시정지 메뉴 순서로 닫거나 멈춘다 */
function handleEsc(){
  if($('#confirm').classList.contains('on')){ closeConfirm(); return; }
  if($('#modal').classList.contains('on')){ binding=null; bindMsg=''; $('#modal').classList.remove('on'); return; }
  togglePause(true);
}
/* 전체화면에서 누른 ESC는 브라우저가 '전체화면 끄기'로 먹어 버려 게임에 안 들어온다.
   그래서 우리가 직접 끈 게 아니면 그 ESC를 대신 처리한다 */
document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement||screen!=='game') return;
  if(performance.now()-fsByUs<800) return;
  if(performance.now()-lastEscKey<3000) return;   // v2.56 키보드 잠금으로 ESC가 이미 게임에 들어왔으면 대신 처리하지 않는다
  if(!paused) setPause(true); else handleEsc();
});
function setPause(on,viaKey){
  paused=on; pauseAt=performance.now();
  $('#pause').classList.toggle('on',on);
  if(on){ unlockMouse(); }
  else { $('#modal').classList.remove('on'); if(!viaKey){ lockMouse(); if(isPhone()) goLandscape(); } }
  bgmApply();
}
function togglePause(viaKey){ if(screen!=='game')return; if(performance.now()-pauseAt<300) return; setPause(!paused,viaKey); }
document.addEventListener('pointerlockchange',()=>{
  if(!locked()&&!isFs()&&screen==='game'&&!paused&&run&&run.phase!=='reward') setPause(true);   // v2.63 전체화면 진입으로 풀린 건 멈추지 않음
});
$('#pmResume').onclick=()=>setPause(false);
/* v2.52 일시정지 메뉴 — 다시 시작 · 이번 판 보상 보기 */
$('#pmRestart').onclick=()=>askConfirm('다시 시작할까요?','지금 판은 재화와 기록 없이 끝나고 처음부터 다시 시작해요.','다시 시작',
  ()=>{ $('#pause').classList.remove('on'); paused=false; startRun(); });
$('#pmBoons').onclick=()=>openBoons();
function boonListHTML(){
  const own=Object.keys(run&&run.boons||{});
  const __bl=(own.length? '<ul class="bnList">'+own.map(k=>{ const b=boonDef(k); if(!b) return '';
      return '<li class="'+(b.sp?'sp':'')+'"><b>'+b.n+'</b>'+(run.boons[k]>1?' ×'+run.boons[k]:'')+(b.sp?' · 특수 특전':'')+'<span>'+b.d+'</span></li>'; }).join('')+'</ul>'
    : '<div class="rkNote">아직 받은 보상이 없어요.</div>')
    +((run&&run.randBoosts&&run.randBoosts.length)?'<div class="rkNote">무작위 보정 — '+run.randBoosts.join(' · ')+'</div>':'');   // v2.63
  return __bl;
}
function openBoons(){
  $('#modalBox').innerHTML='<div class="logHd"><h4>이번 판 보상</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+boonListHTML()+
    (run&&run.rerolls!==undefined?'<div class="rkNote">남은 새로고침 '+run.rerolls+'회</div>':'');
  $('#modal').classList.add('on');
}
$('#pmOpt').onclick=()=>openModal('opt');
$('#pmHub').onclick=()=>{ setPause(false); go('hub'); };
document.addEventListener('fullscreenchange',()=>{
  if(screen==='game'&&!document.fullscreenElement&&isPhone()&&!paused) setPause(true);
});
addEventListener('blur',()=>{ if(screen==='game'&&!paused) setPause(true); });
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-go]'); if(g){go(g.dataset.go);return;}
  const m=e.target.closest('[data-modal]'); if(m){openModal(m.dataset.modal);}
});
$('#launch').onclick=()=>{ cloudAutoSave(); startRun(OPT.mode||'normal'); };   // v2.58 · v2.68 고른 모드로 출격
/* v2.68 모드 고르기 */
function syncModeUI(){ document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===(OPT.mode||'normal')));
  const d=$('#modeDesc'); if(d) d.textContent=({normal:'기본 모드',
    hard:'적 체력 ×1.5 · 탄속 · 발사 빨라짐 · 받는 피해 ×1.3 / 점수 ×1.3 · 재화 ×1.5 · 하드 랭킹(로그인)',
    daily:'오늘 '+todayKST()+' — 모두 같은 맵·적, 강화 없이 기본 능력치 · 재화 ×0.5 · 데일리 랭킹(로그인)',
    chaos:'그 외엔 노멀과 동일 · 벽 배치가 매 웨이브마다 무작위로 바뀜'})[OPT.mode||'normal']; }
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-mode]'); if(!b) return;
  OPT.mode=b.dataset.mode; save(); syncModeUI(); sfx('ui'); });
$('#again').onclick=startRun;
/* v2.52 결과 이미지 — 점수 카드를 그려서 공유(폰) 또는 내려받기(PC) */
$('#rShare').onclick=async()=>{
  if(!run) return;
  const wasFs=isFs();   // v3.1 공유창(네이티브 공유 시트·다운로드)이 뜨면 브라우저가 전체화면을 강제로 꺼버린다 — 끝나면 되돌린다
  const reFs=()=>{ if(wasFs&&!isFs()) toggleFullscreen(); };
  const c=document.createElement('canvas'); c.width=720; c.height=400; const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,720,400); gr.addColorStop(0,'#0b1118'); gr.addColorStop(1,'#13202a');
  g.fillStyle=gr; g.fillRect(0,0,720,400);
  g.strokeStyle='rgba(47,227,208,.55)'; g.lineWidth=2; g.strokeRect(14,14,692,372);
  g.fillStyle='#2fe3d0'; g.font='700 22px sans-serif'; g.fillText('ÆTHER CHAMBER  ·  에테르 챔버',38,62);
  g.fillStyle='#8aa0b0'; g.font='15px sans-serif'; g.fillText('노멀 · 통합 빌드 v'+BUILD,38,88);
  g.fillStyle='#ffd25a'; g.font='800 68px sans-serif'; g.fillText(Math.round(run.score).toLocaleString(),38,182);
  g.fillStyle='#8aa0b0'; g.font='16px sans-serif'; g.fillText('점수',40,208);
  const st=[['사이클',run.cycle],['웨이브',run.wave],['처치',run.kills],['최장 왕복','×'+run.bestRet],['생존',fmtTime(run.time)]];
  st.forEach(([a,b],i)=>{ const x=40+i*132; g.fillStyle='#8aa0b0'; g.font='14px sans-serif'; g.fillText(a,x,262);
    g.fillStyle='#e6eef4'; g.font='700 24px sans-serif'; g.fillText(String(b),x,292); });
  const nm=myName(); g.fillStyle='#8aa0b0'; g.font='14px sans-serif';
  g.fillText((nm?nm+'  ·  ':'')+new Date().toLocaleDateString('ko-KR'),40,352);
  g.textAlign='right'; g.fillStyle='#2fe3d0'; g.fillText('sinmustard.github.io/Aether_Chamber_Mine_Game',680,352);
  const blob=await new Promise(r=>c.toBlob(r,'image/png'));
  const file=new File([blob],'aether_chamber_'+Math.round(run.score)+'.png',{type:'image/png'});
  try{ if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:'에테르 챔버 결과'}); reFs(); return; } }catch(e){ reFs(); return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  reFs();
};
/* v3.4 튜토리얼 — 처음 HUB에 들어오면 자동으로 한 번, 이후엔 타이틀 버튼으로 언제든 다시 볼 수 있다 */
function openTutorial(){
  $('#modalBox').innerHTML='<h4>튜토리얼</h4>'+
    '<div style="font-size:12px;line-height:1.9;color:var(--fg)">'+
    '<b>WASD</b> 이동 · <b>마우스</b> 조준<br>'+
    '적 탄환이 사거리·시야 안에서 빛나면 <b>'+keyName(OPT.keyParry)+'</b>(또는 좌클릭)로 빼앗아 되돌립니다. '+
    '이걸 빼앗아 되돌리는 게 유일한 공격입니다.<br>'+
    'HUB에서 재화(◆)로 영구 강화를 사고, F·Q·R 스킬을 해금·장착한 뒤 출격하세요.<br>'+
    '판 안에서는 몇 웨이브마다 3개 중 하나를 골라 그 판에서만 유지되는 보상도 받습니다.<br>'+
    '10웨이브마다 보스가 나오고, 사이클이 오를수록 더 어려워집니다.<br>'+
    'ESC로 언제든 일시정지하고 설정을 열 수 있습니다.'+
    '</div>'+
    '<button class="buy" id="tutPlay" style="color:var(--warn);border-color:var(--warn)">직접 해 보기 (체험판)</button>'+   // v2.60
    '<button class="buy" id="tutClose">설명 닫기</button>';
  $('#modal').classList.add('on');
}
/* v2.38 업데이트 내역 — 새 버전을 올릴 때 맨 위에 한 줄씩 추가한다 */

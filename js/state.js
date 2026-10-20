"use strict";
/* ================= 게임 상태 ================= */
let P,ens,bullets,queue,msgs,shake,run,paused=false,screen='title';
let t0=0,raf=0;
let parts=[],hitstop=0,dmgNums=[];   // v2.68 피해 숫자
/* v3.00 디버그 — 내 탄환이 방향을 바꾼 이유를 그 자리에 잠깐 글자로 남긴다 (개발자 디버그 모드에서만 보임) */
let bMarks=[];
function bMark(x,y,txt,col){ if(!debug) return; bMarks.push({x,y,txt,col:col||'#ffd34d',t:performance.now()}); if(bMarks.length>40) bMarks.shift(); }
function drawBulletDebug(){
  if(!debug) return; const now=performance.now();
  bMarks=bMarks.filter(m=>now-m.t<1800);
  ctx.save(); ctx.font='700 11px ui-monospace,monospace'; ctx.textAlign='center';
  bMarks.forEach(m=>{ const p=proj(m.x,m.y), k=1-(now-m.t)/1800; ctx.globalAlpha=k;
    ctx.fillStyle=m.col; ctx.beginPath(); ctx.arc(p[0],p[1],4,0,TAU); ctx.fill(); ctx.fillText(m.txt,p[0],p[1]-9); });
  /* 내 탄환 → 노리는 적 연결선 */
  ctx.globalAlpha=.55; ctx.setLineDash([4,5]); ctx.lineWidth=1.2;
  bullets.forEach(b=>{ if(b.owner!=='player'||!b.htg||!ens.includes(b.htg)) return; const a=proj(b.x,b.y), c=proj(b.htg.x,b.htg.y);
    ctx.strokeStyle='#5fe3d0'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(c[0],c[1]); ctx.stroke(); });
  ctx.restore();
}
function burst(x,y,col,n,sp){ if(OPT.lowfx) n=Math.ceil(n*0.3);   // v2.52 저사양 모드
  for(let i=0;i<n;i++){const a=Math.random()*TAU,v=(sp||160)*(0.4+Math.random()*0.8);
  parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0.35+Math.random()*0.25,col});} }
const keys={}; let mouse={x:600,y:380};
const mouseS={x:0,y:0,ok:0};   // v2.86 마우스의 화면 좌표 (카메라가 움직여도 커서 아래 지점을 조준하도록)
/* v2.3 모바일 — 왼쪽 절반 드래그: 이동 / 오른쪽 절반 드래그: 조준.
   화면 좌표(px)로 받아서 세로 눌림(SQUASH)을 보정해 월드 방향으로 바꾼다 */
const TOUCH_DEAD=14, TOUCH_MAX=70;
/* v2.79 고정 조이스틱 — 켜면 이동·패링 조이스틱 중심이 화면 아래 양쪽 고정 자리에 있다 (좌우 바꾸기도 따른다) */
/* v2.81 기본 자리를 화면 끝 쪽으로 옮기고, 직접 옮긴 자리(posMove / posAim)가 있으면 그걸 쓴다 */
const FIX_L=[92,440], FIX_R=[908,440];
const fixL=()=>[Math.round(115-OFX),445], fixR=()=>[Math.round(W+OFX-115),445];   // v2.85 브롤스타즈처럼 화면 양쪽 아래 구석
const fixCenter=side=>{ const c=side==='move'?OPT.posMove:OPT.posAim; if(c&&c.length===2) return c;
  return ((side==='move')!==!!OPT.swapSticks)?fixL():fixR(); };
const isFixed=side=>side==='move'?!!OPT.fixMove:!!OPT.fixAim;
const fixCenterS=side=>{ const c=fixCenter(side); return [c[0]+OFX,c[1]]; };   // v2.85 화면 좌표
/* v3.13 스킬 버튼(F · Q · R) 자리 — 직접 옮긴 자리가 없으면 패링 조이스틱 둘레(기존 배치)를 따라간다.
   좌표는 조이스틱 자리와 같은 기준(가운데 정렬 기준 x, 화면 y) */
const SKILL_KEYS=['F','Q','R'];
function skillDefaultPos(k,aim){
  const a=aim||fixCenter('aim'), right=(a[0]+OFX)>VW/2, angs=right?[180,228,276]:[0,-48,-96], rad=TOUCH_MAX+44;
  const t=angs[SKILL_KEYS.indexOf(k)]*Math.PI/180; return [Math.round(a[0]+Math.cos(t)*rad), Math.round(a[1]+Math.sin(t)*rad)];
}
const skillPos=k=>(OPT.posSkill&&OPT.posSkill[k])||skillDefaultPos(k);
const stick={move:null, aim:null};   // {id, ox, oy, x, y, dx, dy, len}
let touchMode=false;

function newRun(){
  const st=statsFromUpgrades();
  Object.assign(CFG,{rangeM:st.rangeM,fov:st.fov,whiff:st.whiff,moveSpd:st.moveSpd,
    accel:st.accel,scoreMul:st.scoreMul,hpMax:st.hpMax,iframe:st.iframe,multi:st.multi,homing:st.homing,gainMul:st.gainMul,startRewards:st.startRewards,skill:st.skill,qSkill:st.qSkill,healAmt:st.healAmt,healCd:st.healCd,guardDur:st.guardDur,guardCd:st.guardCd,phaseDur:st.phaseDur,phaseCd:st.phaseCd,wallMax:st.wallMax,
    dashDist:st.dashDist,dashCd:st.dashCd,hookCd:st.hookCd,bindDur:st.bindDur,slowDur:st.slowDur,slowCd:st.slowCd,shockR:st.shockR,shockCd:st.shockCd,absorbDur:st.absorbDur,absorbCd:st.absorbCd,decoyDur:st.decoyDur,decoyCd:st.decoyCd,
    skillR:st.skillR,owCd:st.owCd,echoCd:st.echoCd,rNeed:st.rNeed,empDur:st.empDur,autoDur:st.autoDur,gravDur:st.gravDur,frostDur:st.frostDur,frostCd:st.frostCd,blazeDur:st.blazeDur,gravCd:st.gravCd,novaR:st.novaR,revives:st.revives,waveHeal:st.waveHeal,killHeal:st.killHeal,reviveHp:st.reviveHp,shieldPierce:st.shieldPierce,rallyDmg:st.rallyDmg,firstAid:st.firstAid,specialChance:st.specialChance,specialBoss:st.specialBoss,rerolls:st.rerolls,randBoosts:st.randBoosts,
    spd:240,fire:1.8,seizeMul:st.seizeMul,homeTime:1.4});
  { const cr=1-0.06*(st.cdr||0); ['healCd','guardCd','dashCd','phaseCd','hookCd','slowCd','shockCd','absorbCd','decoyCd','gravCd','frostCd'].forEach(k=>{ if(CFG[k]) CFG[k]*=cr; }); }   // v3.1 안정화 보상이 CFG.seizeMul을 건드리므로 판마다 초기화해야 한다
  syncUI();
  P={x:200,y:380,hp:CFG.hpMax,face:0,hurt:0,lock:0,lockMax:1,lockKind:'miss',inv:0,pbuf:0,heat:0,ovl:0,skillCd:0,skillCdMax:1,guard:0,phase:0,wallCd:0,qCdMax:1,
     dashT:0,dashDir:0,rCd:0,rCdMax:1,rChg:0,echoT:0};
  ens=[];bullets=[];queue=[];msgs=[];shake=0;parts=[];hitstop=0;
  run={boons:{},walls:[],score:0,hits:0,kills:0,bossKills:0,bestRet:0,maxSpd:0,time:0,
       cycle:1,wave:0,phase:'break',phaseT:1.4,diff:1};
  rerollMap();   // v3.2
  run.startRewards=CFG.startRewards;   // v2.17 선행 보급
  run.revives=CFG.revives;             // v2.37 부활 횟수
  run.rerolls=CFG.rerolls;             // v2.52 보상 새로고침 횟수
  if(CFG.qSkill==='wall'){ run.phase='build'; run.phaseT=BUILD_T; }   // v1.6 벽 설치 준비 시간
}

/* v2.4 웨이브 구성 — 1·2웨이브는 고정(잡몹만), 3웨이브부터는 해금된 적 중에서 무작위로 뽑는다.
   from: 그 등급이 등장하기 시작하는 웨이브(사이클마다 초기화되는 run.wave 기준)
   w: 뽑힐 가중치 / cap: 한 웨이브 안에서 그 등급의 최대 마리 수 */
function enemyPool(){
  return [
    {g:'mob',      from:1, w:5, cap:6},
    {g:'splitter', from:2, w:2, cap:run.cycle>=2?2:1},
    {g:'elite',    from:3, w:2, cap:2},
    {g:'bulwark',  from:5, w:2, cap:run.cycle>=2?2:1},
    {g:'healer',   from:3, w:1, cap:()=>2, ok:()=>run.cycle>=2},   // v2.27 2사이클 3웨이브부터
    {g:'relay',    from:7, w:1, cap:run.cycle>=3?2:1},
    /* v3.0 추적자 — 웨이브가 아니라 사이클 기준. 1사이클 보스를 잡고 2사이클부터 나온다 */
    {g:'tracker',  from:1, w:1, cap:1, ok:()=>run.cycle>=2},
    /* v2.19 소환사 — 2사이클을 끝낸 3사이클부터 */
    {g:'summoner', from:1, w:1, cap:1, ok:()=>run.cycle>=3},
    /* v2.34 대포병 — 3사이클 3웨이브부터 */
    {g:'cannon',   from:3, w:1, cap:1, ok:()=>run.cycle>=3},
    {g:'sniper',   from:5, w:1, cap:2, ok:()=>run.cycle>=2}   // v2.65 2사이클 5웨이브부터
  ];
}
function rollWave(n){
  const pool=enemyPool(), counts={}, order=[];
  for(let i=0;i<n;i++){
    const cands=pool.filter(p=>run.wave>=p.from && (!p.ok||p.ok()) && (counts[p.g]||0)<(typeof p.cap==='function'?p.cap():p.cap));
    const totalW=cands.reduce((s,p)=>s+p.w,0);
    let r=Math.random()*totalW, pick=cands[cands.length-1];
    for(const p of cands){ if(r<p.w){ pick=p; break; } r-=p.w; }
    counts[pick.g]=(counts[pick.g]||0)+1;
    order.push(pick.g);
  }
  return order;
}
function waveSpawn(){
  run.wave++;
  if(run.wave>1 && (run.chaos || run.wave%5===1)){ rerollMap(); say('지형 변화','warn'); }   // v3.2 5웨이브마다 맵 교체 · v3.15 카오스 모드는 매 웨이브 · v3.24 카오스는 옵션(run.chaos)
  const boss = run.wave>BOSS_WAVE;
  const bossSpawn=v=>{ spawnEnemy('boss'); const bb=ens[ens.length-1]; bb.variant=v;
    if(v==='warden'){ bb.shieldArc=120; bb.sa=Math.atan2(P.y-bb.y,P.x-bb.x); bb.hp*=1.15; bb.hpMax=bb.hp; bb.wardT=6; }
    if(v==='phantom'){ bb.hp*=0.85; bb.hpMax=bb.hp; bb.blinkT=4.5; }
    announce(v==='warden'?'알레테이아 · 수호형':v==='phantom'?'알레테이아 · 환영형':'알레테이아','red'); sfx('boss'); };
  if(boss) bossSpawn(['core','warden','phantom'][(run.cycle-1)%3]);
  else if(run.mode==='chaosx'){
    const n=Math.min(6, Math.min(5,1+Math.ceil(run.wave/2))+(run.cycle>=2?1:0));
    const pool=['mob','splitter','elite','bulwark','healer','relay','tracker','summoner','cannon','sniper'];
    const order=[]; let bossRoll=false;
    for(let i=0;i<n;i++){ if(Math.random()<0.025){ bossRoll=true; break; } order.push(pool[Math.floor(Math.random()*pool.length)]); }
    if(bossRoll) bossSpawn(['core','warden','phantom'][Math.floor(Math.random()*3)]);
    else { order.sort((a,b)=>(a==='relay'?1:0)-(b==='relay'?1:0)); order.forEach(g=>spawnEnemy(g));
      announce('혼돈  ·  사이클 '+run.cycle+'  ·  웨이브 '+run.wave,'cyan'); sfx('wave'); }
  }
  else{
    const base=Math.min(5,1+Math.ceil(run.wave/2));
    const n=Math.min(6, base+(run.cycle>=2?1:0));
    let order = run.wave<=2 ? Array(n).fill('mob') : rollWave(n);
    /* v2.34 대포병이 나오는 웨이브는 구성이 달라진다 — 힐러만 2마리까지, 나머지는 종류당 1마리 */
    if(order.includes('cannon')){
      const lim={cannon:1, healer:2}, cnt={};
      order = order.filter(g=>{ const c=(cnt[g]||0)+1; if(c>(lim[g]||1)) return false; cnt[g]=c; return true; });
    }
    order.sort((a,b)=>(a==='relay'?1:0)-(b==='relay'?1:0));   // v2.16 송신기는 마지막에
    order.forEach(g=>spawnEnemy(g));
    announce('사이클 '+run.cycle+'  ·  웨이브 '+run.wave,'cyan'); sfx('wave');
  }
  run.phase='fight';
}
/* v2.16 벽에 걸린 자리는 다시 뽑지 않고 옆으로 밀어낸다. 겹친 벽의 가까운 면 쪽으로 빠져나간다 */
function wallSlide(x0,y0,x1,y1,r){
  for(let k=0;k<2;k++){
    let hit=null, bd=1e9;
    for(const {col:o} of allWalls()){ const h=sweepRect(x0,y0,x1,y1,o,r); if(!h) continue; const d=Math.hypot(h.x-x0,h.y-y0); if(d<bd){ bd=d; hit=h; } }
    if(!hit) break;
    if(hit.axis==='x') x1=hit.x; else y1=hit.y;
  }
  return [x1,y1];
}
function pushOutOfWalls(x,y,r){
  for(let k=0;k<8;k++){
    let moved=false;
    for(const {col:o} of allWalls()){
      if(!rectHit(x,y,r+8,o)) continue;
      const cx=o.x+o.w/2, cy=o.y+o.h/2;
      const ox=(o.w/2+r+10)-Math.abs(x-cx), oy=(o.h/2+r+10)-Math.abs(y-cy);
      if(ox<oy) x+=(x<cx?-ox:ox); else y+=(y<cy?-oy:oy);
      x=clamp(x,40,WORLD.w-40); y=clamp(y,40,WORLD.h-40);
      moved=true;
    }
    if(!moved) break;
  }
  return [x,y];
}
/* v2.19 위치를 지정해 스폰한다 (소환·보스 소환용) */
function spawnEnemyAt(grade,px,py){
  const g=GRADES[grade]||GRADES.mob;
  let x=clamp(px,40,WORLD.w-40), y=clamp(py,50,WORLD.h-50);
  [x,y]=pushOutOfWalls(x,y,g.r);
  const hp=BASE_DMG*DMG_MULT*g.hits*run.diff*cycleHpMul(run.cycle)*(1+0.06*Math.max(0,run.wave-1));
  const en={x,y,r:g.r,grade,hp,hpMax:hp,hurt:0,inv:ENEMY_IFRAME,
    fireT:0.5+Math.random()*1.0, drift:Math.random()*TAU, ax:x, ay:y};
  if(g.shield) en.sa=Math.atan2(P.y-y,P.x-x);
  if(g.summon) en.summonT=2.0;
  ens.push(en);
  return en;
}
function spawnEnemy(grade){
  const g=GRADES[grade]||GRADES.mob;
  const hits=g.hits, r=g.r;
  /* v2.11 맵 전체에서 스폰 · v2.16 벽은 피하지 않고, 걸리면 옆으로 밀어낸다 */
  let x,y,tries=0,placed=false;
  /* v2.16 송신기는 다른 적 곁에 붙여 놓는다. 혼자 떨어져 있으면 지원 효과가 의미가 없다 */
  if(grade==='relay'){
    const hosts=ens.filter(e=>e.grade!=='relay');
    if(hosts.length){
      const h=hosts[Math.floor(Math.random()*hosts.length)];
      for(let k=0;k<14&&!placed;k++){
        const a=Math.random()*TAU, d=90+Math.random()*80;
        const nx=clamp(h.x+Math.cos(a)*d,60,WORLD.w-60), ny=clamp(h.y+Math.sin(a)*d,70,WORLD.h-70);
        if(dist(nx,ny,P.x,P.y)>=260){ x=nx; y=ny; placed=true; }
      }
    }
  }
  if(!placed) do{
    x=60+Math.random()*(WORLD.w-120); y=80+Math.random()*(WORLD.h-160); tries++;
  }while(tries<40 && dist(x,y,P.x,P.y)<340);
  [x,y]=pushOutOfWalls(x,y,r);
  /* v2.18 같은 사이클 안에서도 웨이브가 갈수록 단단해진다 (웨이브당 +6%) */
  const hp=BASE_DMG*DMG_MULT*hits*run.diff*cycleHpMul(run.cycle)*(1+0.06*Math.max(0,run.wave-1));
  const en={x,y,r,grade,hp,hpMax:hp,hurt:0,
    fireT:0.6+Math.random()*1.2, drift:Math.random()*TAU, ax:x, ay:y};
  if(g.shield) en.sa=Math.atan2(P.y-y,P.x-x);      // 방패 초기 방향
  if(g.summon) en.summonT=2.5;                      // v2.19 첫 소환까지
  ens.push(en);
}
/* v2.1 분열형 처치 시 1칸짜리 분열체 2기를 그 자리에 바로 생성한다 */
function spawnSplinters(e){
  const g=GRADES.splinter;
  for(let i=0;i<2;i++){
    const a=Math.random()*TAU, d=18;
    const x=clamp(e.x+Math.cos(a)*d,40,WORLD.w-40), y=clamp(e.y+Math.sin(a)*d,40,WORLD.h-40);
    const hp=BASE_DMG*DMG_MULT*g.hits*run.diff*cycleHpMul(run.cycle)*(1+0.06*Math.max(0,run.wave-1));
    ens.push({x,y,r:g.r,grade:'splinter',hp,hpMax:hp,hurt:0,
      fireT:0.3+Math.random()*0.5, drift:Math.random()*TAU, ax:x, ay:y, inv:ENEMY_IFRAME});
  }
}
/* v2.2 처치 처리 — 직격이든 파편이든 여기로 모은다.
   이전에는 직격 안에만 있어서 파편으로 체력이 0이 된 적이 살아남았다 */
function killEnemy(e){
  const idx=ens.indexOf(e); if(idx<0) return;
  const bonus=G(e).score;
  run.score+=Math.round(bonus*CFG.scoreMul); run.kills++;
  if(!run.tut){ stat('kills'); if(e.grade==='boss'){ stat('bossKills'); if(run.mode==='hard') stat('hardBoss'); } }   // v2.68
  P.rChg=Math.min(CFG.rNeed,P.rChg+2);   // v2.18 처치 +2
  if(boonLv('leech')&&P.hp>0) P.hp=Math.min(CFG.hpMax,P.hp+(e.grade==='boss'?12:3)*boonLv('leech'));
  if(CFG.killHeal&&P.hp>0&&!run.tut) P.hp=Math.min(CFG.hpMax,P.hp+(e.grade==='boss'?4:1)*CFG.killHeal);   // v3.38 처치 회복 강화
  burst(e.x,e.y,'red',e.grade==='boss'?60:22,e.grade==='boss'?360:240);
  hitstop=e.grade==='boss'?0.18:0; sfx(e.grade==='boss'?'boss':'kill');   // v2.61 일반 처치는 멈추지 않는다 (보스만 짧게)
  if(e.grade==='boss'){ run.bossKills++; announce('보스 격파  +'+bonus,'cyan'); shake=20; }
  else say('처치  +'+bonus,'cyan');
  ens.splice(idx,1);
  if(e.grade==='splitter') spawnSplinters(e);   // v2.1 분열형 — 처치되면 분열체 2기
  /* v3.1 여진 — 처치 지점 주변에 추가 피해. killEnemy로 다시 들어오는 연쇄 처치도 자연스럽게 처리된다 */
  const as=boonLv('aftershock');
  if(as){
    const dmg=HIT_UNIT*0.4*as;
    ens.slice().forEach(o=>{ if(o.inv>0) return;
      if(dist(e.x,e.y,o.x,o.y)>=80+o.r) return;
      o.hp-=dmg*(shielded(o,{x:e.x,y:e.y})?0.5:1); o.hurt=.18;
      if(o.hp<=HIT_UNIT*0.25) killEnemy(o);   // v2.71 난이도 배율 탓에 생기는 애매한 체력 한 조각은 처치로 처리
    });
    burst(e.x,e.y,'warn',10,200);
  }
  bullets.forEach(z=>{ if(z.tried) z.tried=z.tried.filter(x=>x!==e); });   // v1.7 B-1
}
function announce(text,color){ msgs.push({text,color,t:1.3,big:1}); }
const say=(t,c)=>msgs.push({text:t,color:c||'cyan',t:0.7,big:0});

"use strict";
/* ================= 입력 ================= */
let lastEscKey=0;
addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT')return;
  const k=e.key.toLowerCase();
  if(k==='escape'){ if(e.repeat) return; lastEscKey=performance.now(); }   // v2.56 길게 누를 때 반복 입력은 무시
  /* v2.51 ESC는 어느 화면에서든 확인 팝업 → 설정 창 순서로 닫는다 */
  if(k==='escape'&&$('#confirm').classList.contains('on')){ closeConfirm(); return; }
  if(k==='escape'&&!binding&&screen!=='game'&&$('#modal').classList.contains('on')){ $('#modal').classList.remove('on'); return; }
  if(binding){                                  // 키 설정 대기 중
    e.preventDefault();
    if(k==='escape'){ binding=null; bindMsg=''; openModal(); return; }
    if(KEY_RESERVED.includes(k)){ bindMsg=keyName(k)+' 키는 이동/메뉴용이라 쓸 수 없어요'; openModal(); return; }
    const other=Object.keys(KEY_DEFAULT).find(kk=>kk!==binding&&OPT[kk]===k);
    if(other) OPT[other]=OPT[binding];             // 겹치면 서로 맞바꿈
    OPT[binding]=k; binding=null; bindMsg='';
    save(); refreshKeyLabels(); sfx('ui'); openModal(); return;
  }
  keys[k]=true;
  /* v2.0.2 디버그 토글 — 보상 선택이 1/2/3을 쓰게 되어 백틱(`)으로 옮겼다.
     F1도 함께 받는다. 어느 화면에서든 동작한다 */
  if(k==='`'||k==='~'||e.key==='F1'){ e.preventDefault(); toggleDebug(); return; }
  if(screen!=='game')return;
  /* v2.53 ESC는 보상 화면에서도 먼저 처리한다. 예전엔 보상 화면 분기에서 먼저 return 해 버려서
     보상을 고르는 중에 연 일시정지·설정이 ESC로 안 닫혔다 */
  if(k==='escape'){ e.preventDefault(); handleEsc(); return; }
  if(paused) return;                               // 멈춘 동안에는 보상 선택·스킬 입력을 받지 않는다
  if(run&&run.phase==='reward'){                 // v2.0 보상 선택
    if('123'.includes(k)){ e.preventDefault(); takeReward(+k-1); }
    else if(k==='r'||k===OPT.keyR){ e.preventDefault(); rerollReward(); }   // v2.52
    return;
  }
  if(k==='enter'&&run&&run.phase==='build'){ e.preventDefault(); run.phaseT=0; return; }
  if(k===OPT.keyParry){e.preventDefault();doParry();}
  else if(k===OPT.keySkill){e.preventDefault();doSkill();}
  else if(k===OPT.keyWall){e.preventDefault();doQ();}
  else if(k===OPT.keyR){e.preventDefault();doR();}
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
const gcv=$('#gamecv');
/* v2.12 마우스 가두기 — 전투 중에는 포인터를 화면 안에 잠근다.
   잠긴 동안에는 움직인 거리(movementX/Y)로 조준점을 옮기고, 조준점은 맵 밖으로 못 나간다.
   ESC를 누르면 브라우저가 잠금을 풀고, 일시정지도 같이 걸린다 */
const locked=()=>document.pointerLockElement===gcv;
/* v2.63 전체화면에서는 마우스를 잠그지 않는다 — 어차피 화면 밖으로 못 나가고,
   잠그면 크롬이 주는 움직임 값이 화면 배율(125% 등)과 어긋나 조준이 실제 마우스와 달라지고 가끔 튀었다 */
const isFs=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function lockMouse(){
  if(!OPT.lockMouse||screen!=='game'||paused||touchMode||isFs())return;
  if(!locked()&&gcv.requestPointerLock){
    try{ const pr=gcv.requestPointerLock({unadjustedMovement:true});   // 가속 없는 원시 입력 — 튀는 현상 감소
      if(pr&&pr.catch) pr.catch(()=>{ try{ gcv.requestPointerLock(); }catch(e){} });
    }catch(e){ try{ gcv.requestPointerLock(); }catch(_){} }
  }
}
function unlockMouse(){ if(locked()&&document.exitPointerLock) document.exitPointerLock(); }
gcv.addEventListener('mousemove',e=>{
  const r=gcv.getBoundingClientRect();
  if(locked()){
    /* v2.63 한 번에 비정상적으로 큰 움직임은 무시 (크롬 잠금 모드에서 가끔 들어오는 튀는 값) */
    if(Math.abs(e.movementX)>innerWidth*0.3||Math.abs(e.movementY)>innerHeight*0.3) return;
    if(!mouseS.ok){ mouseS.x=mouse.x*ZK; mouseS.y=(mouse.y*SQUASH+OY)*ZK+CAMY; mouseS.ok=1; }
    mouseS.x=clamp(mouseS.x+e.movementX*(VW/r.width), 0, VW);
    mouseS.y=clamp(mouseS.y+e.movementY*(H/r.height), 0, H);
    return;
  }
  mouseS.x=(e.clientX-r.left)*(VW/r.width); mouseS.y=(e.clientY-r.top)*(H/r.height); mouseS.ok=1;   // v2.86
});
gcv.addEventListener('mousedown',e=>{e.preventDefault(); if(screen!=='game')return; lockMouse(); doParry();});
document.addEventListener('pointerlockchange',()=>{ document.body.classList.toggle('locked',locked()); });
/* ---- v2.3 터치 조작 ---- */
function tPos(t){
  const r=gcv.getBoundingClientRect();
  return [ (t.clientX-r.left)*(VW/r.width), (t.clientY-r.top)*(H/r.height) ];   // v2.85 화면 좌표
}
function setStick(st,x,y){
  const dx=x-st.ox, dy=(y-st.oy)/SQUASH;          // 화면 → 월드 방향 보정
  const len=Math.hypot(dx,dy);
  st.x=x; st.y=y; st.len=len;
  if(len>TOUCH_DEAD){ st.dx=dx/len; st.dy=dy/len; } else { st.dx=st.dy=0; }
}
gcv.addEventListener('touchstart',e=>{
  if(screen!=='game')return;
  e.preventDefault(); touchMode=true; document.body.classList.add('touch');
  for(const t of e.changedTouches){
    const [x,y]=tPos(t);
    const side = ((x < VW/2) !== !!OPT.swapSticks) ? 'move' : 'aim';   // v2.63 좌우 바꾸기
    if(stick[side]) continue;                      // 같은 쪽은 먼저 닿은 손가락 우선
    const fc=isFixed(side)?fixCenterS(side):null;
    /* v2.88 고정 조이스틱은 그 자리 근처를 눌렀을 때만 고정 중심을 쓴다. 멀리 누르면 '고정 중심 → 손가락' 방향이 엉뚱하게 잡혀
       (예: 조이스틱 위쪽을 누르면 무조건 위로 조준) 홀드 패링이 그 방향으로 바로 나가 탄환이 뒤로 날아갔다 */
    if(fc&&Math.hypot(x-fc[0],y-fc[1])<=TOUCH_MAX*1.8){ stick[side]={id:t.identifier, ox:fc[0], oy:fc[1], x, y, dx:0, dy:0, len:0}; setStick(stick[side],x,y); }   // v2.79
    else stick[side]={id:t.identifier, ox:x, oy:y, x, y, dx:0, dy:0, len:0};
  }
},{passive:false});
gcv.addEventListener('touchmove',e=>{
  if(screen!=='game')return;
  e.preventDefault();
  for(const t of e.changedTouches){
    for(const k of ['move','aim']){
      const st=stick[k]; if(!st||st.id!==t.identifier) continue;
      const [x,y]=tPos(t); setStick(st,x,y);
    }
  }
},{passive:false});
/* v2.49 홀드 패링 — 터치로 조작 중 + 해금 + 설정이 켜져 있을 때 */
const holdParryOn=()=>touchMode&&lv('mparry')>0&&OPT.holdParry;
function endTouch(e){
  for(const t of e.changedTouches)
    for(const k of ['move','aim'])
      if(stick[k]&&stick[k].id===t.identifier){
        stick[k]=null;
        /* v2.5 오른쪽에서 손을 떼는 순간 패링. 조준 → 떼기 한 동작으로 이어진다
           v2.49 홀드 패링을 쓰면 떼는 순간에는 패링하지 않는다 (누르고 있는 동안 자동) */
        if(k==='aim'&&screen==='game'&&!holdParryOn()) doParry();
      }
}
gcv.addEventListener('touchend',endTouch,{passive:false});
gcv.addEventListener('touchcancel',endTouch,{passive:false});
/* v2.32 버튼은 손가락이 닿는 순간 반응한다.
   click만 쓰면 다른 손가락으로 이동·조준 중일 때 눌러도 스킬이 나가지 않았다 */
function padBind(id,fn){
  const el=$('#'+id); if(!el)return;
  let last=0;
  const fire=e=>{
    e.preventDefault(); e.stopPropagation();
    const now=performance.now(); if(now-last<120) return; last=now;   // 같은 입력이 두 번 잡히는 것 방지
    if(screen==='game') fn();
  };
  el.addEventListener('touchstart',fire,{passive:false});
  el.addEventListener('mousedown',fire);
}
padBind('padParry',doParry);
padBind('padSkill',doSkill);
padBind('padWall',doQ);
padBind('padR',doR);
padBind('rgF',doSkill); padBind('rgQ',doQ); padBind('rgR',doR);   // v2.79 패링 조이스틱 옆 스킬 버튼
/* v2.79 스킬 버튼을 패링 조이스틱 자리 둘레(왼쪽 · 왼쪽 위 · 위)에 놓는다 */
let ringKey='';
function placeRing(){
  const r=gcv.getBoundingClientRect(), sc=r.width/VW;   // v3.13 버튼마다 자리(직접 옮긴 자리 또는 조이스틱 둘레)
  const ps=SKILL_KEYS.map(skillPos);
  const key=[r.left,r.top,sc].concat(...ps).map(v=>Math.round(+v*100)).join(','); if(key===ringKey) return; ringKey=key;
  SKILL_KEYS.forEach((k,i)=>{ const el=document.getElementById('rg'+k); if(!el) return;
    el.style.left=(r.left+(ps[i][0]+OFX)*sc)+'px'; el.style.top=(r.top+ps[i][1]*sc)+'px'; });
}
$('#topPause').onclick=()=>{ if(screen==='game')togglePause(); };

/* v2.42 입력 여유 — 점프 버퍼·코요테 타임처럼 패링 타이밍에 여유를 준다.
   · 미리 누름: 아직 패링할 탄환이 없으면 OPT.inputBuf초 동안 기다렸다가, 그 사이 탄환이 들어오면 바로 패링
   · 늦게 누름: 방금(OPT.inputBuf×0.75초 안에) 패링 가능했던 탄환은 범위를 살짝 벗어나도 패링 인정 */
const COYOTE=()=>OPT.inputBuf*0.75;
function parryReady(){
  if(ens.some(e=>e.grade==='tracker'&&e.lungePhase==='dash'
      &&dist(e.x,e.y,P.x,P.y)<=range()+e.r
      &&angDiff(P.face,Math.atan2(e.y-P.y,e.x-P.x))<=(CFG.fov/2)*Math.PI/180)) return true;
  return bullets.some(b=>b.owner==='enemy'&&(b.ready||b.coy>0));
}
function doParry(force){
  if(paused||P.lock>0)return;
  if(!force){
    if(P.pbuf>0) return;                                   // 이미 기다리는 중
    if(OPT.inputBuf>0 && !parryReady()){ P.pbuf=OPT.inputBuf; return; }
  }
  P.pbuf=0;
  /* v2.9 추적자 돌진 — 몸 자체를 탄환처럼 취급한다. 돌진 중에 맞춰 패링하면
     피해를 주고 돌진을 그 자리에서 끊는다 (탄환이 없어 원래 패링이 안 통하던 문제의 해결책) */
  const lunger=ens.find(e=>e.grade==='tracker'&&e.lungePhase==='dash'
    &&dist(e.x,e.y,P.x,P.y)<=range()+e.r
    &&angDiff(P.face,Math.atan2(e.y-P.y,e.x-P.x))<=(CFG.fov/2)*Math.PI/180
    &&!wallBetween(P.x,P.y,e.x,e.y));
  if(lunger){
    lunger.hp-=HIT_UNIT; lunger.hurt=.22; lunger.lungeHit=true;
    lunger.lungePhase='cd'; lunger.lungeT=LUNGE_CD*0.6;
    say('패링 성공','cyan'); sfx('parry',2); shake=9; burst(lunger.x,lunger.y,'cyan',14,220);   // v2.61 히트스톱 제거
    /* v2.0 파편 — 일반 명중과 동일하게 돌진 패링도 주변에 추가 피해를 준다 */
    const sh=boonLv('shard');
    if(sh){
      const base=HIT_UNIT*SHARD_UNIT*sh;
      ens.slice().forEach(o=>{ if(o===lunger||o.inv>0) return;
        if(dist(lunger.x,lunger.y,o.x,o.y)>=90+o.r) return;
        o.hp-=base*(shielded(o,{x:lunger.x,y:lunger.y})?0.5:1);
        o.hurt=.18;
        if(o.hp<=HIT_UNIT*0.25) killEnemy(o);   // v2.71
      });
      burst(lunger.x,lunger.y,'warn',10,200);
    }
    if(lunger.hp<=HIT_UNIT*0.25) killEnemy(lunger);   // v2.71
    P.rChg=Math.min(CFG.rNeed,P.rChg+1);   // v2.18 패링 +1 — 돌진 패링도 똑같이 충전된다
    /* v1.7 D-2 / 무결 보너스와 동일하게 처리한다 — 돌진 패링만 회복 경직이 남는 건 형평에 안 맞는다 */
    P.lock=boonLv('flow')?0:0.12; P.lockMax=Math.max(0.01,P.lock); P.lockKind='ok';
    return;
  }
  /* v1.3.2 다중 패링: 사거리·시야 안의 적 탄환을 가까운 순으로 최대 CFG.multi발 */
  const pScore=b=>dist(b.x,b.y,P.x,P.y)+angDiff(P.face,Math.atan2(b.y-P.y,b.x-P.x))*range()*0.8;
  let ts=bullets.filter(b=>b.owner==='enemy'&&(b.ready||b.coy>0))   // v2.42 코요테
    .sort((a,b)=>pScore(a)-pScore(b)).slice(0,Math.max(1,CFG.multi|0));
  /* v2.34 장갑탄 — 첫 패링은 장갑만 깎고, 두 번째 패링에서 그대로 빼앗는다 */
  ts.forEach(b=>{ if(b.armor>0){ b.armor--; b.shell=1; b.glow=1; burst(b.x,b.y,'warn',8,150); } });
  const blocked=ts.filter(b=>b.armor>0);
  ts=ts.filter(b=>!b.armor);
  if(blocked.length && !ts.length){
    P.rChg=Math.min(CFG.rNeed,P.rChg+1);
    say('장갑 1 / 2','warn'); sfx('block'); shake=5;
    P.lock=boonLv('flow')?0:0.10; P.lockMax=Math.max(0.01,P.lock); P.lockKind='ok';
    return;
  }
  if(ts.length){
    /* v2.84 되돌리는 방향 — 예전엔 '가장 가까운 적'이 조준 방향에서 20° 안일 때만 그쪽, 아니면 그냥 바라보는 쪽이라
       조준 근처에 다른 적이 있어도 엉뚱한 곳으로 날아가거나, 추가 탄환이 뒤쪽 적에게 튀었다.
       → 조준 방향과 가장 가까운 적(24° 안)을 고르고, 추가 탄환도 조준 쪽 70° 안의 적에게만 보낸다 */
    const ang=e=>angDiff(P.face,Math.atan2(e.y-P.y,e.x-P.x));
    /* v2.89 벽 뒤에 숨은 적은 자동 조준에서 뺀다 — 벽 뒤 적을 노리면 탄환이 벽에 맞고 튕겨 나한테 그대로 돌아왔다 */
    const soft=ens.filter(e=>!G(e).shield&&!wallBetween(P.x,P.y,e.x,e.y));
    const byAim=soft.slice().sort((a,b)=>ang(a)-ang(b)||dist(a.x,a.y,P.x,P.y)-dist(b.x,b.y,P.x,P.y));
    /* v2.92 폰은 엄지로 정확히 겨누기 어렵고(홀드 패링 중엔 엄지가 쉬는 방향이 곧 조준), 영상에서 적이 바로 위에 있는데
       조준이 아래를 향해 탄환이 화면 밖으로 날아갔다 → 폰은 조준 쪽 100° 안의 적, 없으면 '보이는 가장 가까운 적'을 노린다.
       PC도 조준 방향 바로 앞(160)이 벽이면 보이는 적 쪽으로 보정한다 (벽에 맞고 튕겨 돌아오는 것 방지) */
    let tgt=byAim.length&&ang(byAim[0])<=(touchMode?100:24)*Math.PI/180?byAim[0]:null;
    /* v3.03 폰에서 조준 쪽에 적이 없을 때 '보이는 가장 가까운 적'으로 곧장 쏘면, 그 적이 내 뒤쪽일 때 탄이 나를 향해 되돌아왔다.
       → 일단 앞(나에게서 멀어지는 쪽)으로 보내고, 잠깐 뒤에 그 적을 찾아 휘어 가게 한다 */
    const seekTgt=(!tgt&&touchMode)?soft.filter(e=>ang(e)<=120*Math.PI/180).sort((a,b)=>dist(a.x,a.y,P.x,P.y)-dist(b.x,b.y,P.x,P.y))[0]||null:null;   // 앞쪽 120° 안의 적만 — 내 뒤의 적은 쫓지 않는다 (쫓으면 결국 나를 지나쳐 돌아옴)
    /* v3.03 조준 바로 앞이 벽일 때 — 예전엔 '보이는 적 아무나'(내 뒤의 적 포함)로 돌려서 탄이 나를 지나 되돌아왔다.
       → 앞쪽 120° 안의 적만, 없으면 벽을 피한 앞쪽 빈 방향으로 */
    let clearDir=null;
    if(!tgt&&wallBetween(P.x,P.y,P.x+Math.cos(P.face)*160,P.y+Math.sin(P.face)*160)){
      const fwdT=byAim.find(e=>ang(e)<=120*Math.PI/180);
      if(fwdT) tgt=fwdT;
      else for(const off of [0.5,-0.5,1.0,-1.0,1.45,-1.45]){ const a=P.face+off; if(!wallBetween(P.x,P.y,P.x+Math.cos(a)*200,P.y+Math.sin(a)*200)){ clearDir=a; break; } }
    }
    /* v3.00 적은 늘 흔들리며 움직여서, 지금 위치로 쏘면 도착할 즈음엔 비껴 있다(빗나간 탄이 뒤쪽 벽에 튕겨 돌아오는 주원인).
       → 탄환이 도착할 시간만큼 앞을 내다보고 겨눈다 */
    const lead=(e,sx,sy,spd)=>{ if(!e) return null; const d=dist(sx,sy,e.x,e.y), tt=Math.min(1.2,d/Math.max(120,spd)); return [e.x+(e.vx||0)*tt, e.y+(e.vy||0)*tt]; };
    const shotSpd=Math.min((ts[0]?ts[0].spd:CFG.spd)*CFG.accel,cap());
    const lp=lead(tgt,P.x,P.y,shotSpd);
    const mainDir=lp?Math.atan2(lp[1]-P.y,lp[0]-P.x):(clearDir!=null?clearDir:P.face);
    const foes=[tgt].concat(byAim.filter(e=>e!==tgt&&ang(e)<=70*Math.PI/180)).filter(Boolean);
    let maxRet=0;
    const echoes=[];
    const jl=lv('just'), just=jl>0&&ts.some(b=>dist(b.x,b.y,P.x,P.y)<=R_PLAYER+R_BULLET+34);
    ts.forEach((t,i)=>{
      t.just=just?jl:0; if(just) t.spd=Math.min(t.spd*1.1,cap());
      t.owner='player'; t.returns++; t.feint=0; t.orbitAmt=0; t.homeT=CFG.homeTime;   // v2.46
      t.spd=Math.min(t.spd*CFG.accel,cap());
      t.pierceLeft=boonLv('pierce');                                   // v3.1 관통 스택 — 패링마다 갱신
      t.glow=1; t.hcd=0.15; t.ready=false;
      t.tried=ens.filter(e=>dist(e.x,e.y,t.x,t.y)<e.r+SEIZE_R+20);
      t.htg=(i===0?tgt:foes[i])||null;   // v2.86 이 탄환이 노리는 적을 기억
      if(i===0){ t.dir=mainDir;
        if(seekTgt){ const away=Math.hypot(t.x-P.x,t.y-P.y)>8?Math.atan2(t.y-P.y,t.x-P.x):P.face;   // v3.03 앞으로 → 적 찾기
          t.dir=angDiff(away,P.face)<Math.PI*0.6?P.face:away; t.htg=seekTgt; t.seekT=0.22; t.seekLeft=1.6; } }
      else if(foes[i]){ const q=lead(foes[i],P.x,P.y,shotSpd); t.dir=Math.atan2(q[1]-P.y,q[0]-P.x); }   // 추가 탄환은 조준 쪽 다른 적에게 (v2.84)
      else t.dir=mainDir+(i%2?1:-1)*0.14*Math.ceil(i/2);                  // 적이 부족하면 부채꼴로
      /* v3.04 시야각 끝에서 잡은 탄은 노리는 적이 반대편에 있으면 플레이어 앞을 가로질러 확 꺾여 '이상한 도탄'처럼 보였다.
         → 탄이 있는 쪽(플레이어→탄 방향)에서 ±35° 넘게는 바로 꺾지 않고, 일단 그쪽으로 나간 뒤 노린 적 쪽으로 부드럽게 휘어 간다 */
      if(Math.hypot(t.x-P.x,t.y-P.y)>10){
        const out=Math.atan2(t.y-P.y,t.x-P.x), dd=norm(t.dir-out), LIM=35*Math.PI/180;
        if(Math.abs(dd)>LIM){ t.dir=out+(dd>0?LIM:-LIM);
          if(t.htg&&!(t.seekLeft>0)){ t.seekT=0.1; t.seekLeft=1.4; } }
      }
      { const rx=t.x-P.x, ry=t.y-P.y, cx=Math.cos(t.dir), cy=Math.sin(t.dir), along=rx*cx+ry*cy, side=Math.abs(rx*cy-ry*cx), r0=R_PLAYER+R_BULLET+6;
        if(Math.hypot(rx,ry)<r0||(along<0&&side<r0)){ t.x=P.x+cx*r0; t.y=P.y+cy*r0; t.trail.length=0; } }
      maxRet=Math.max(maxRet,t.returns);
      burst(t.x,t.y,'cyan',10,180);
      /* v2.1 메아리 — 지속 시간 동안 패링마다 탄환을 하나 더 복제한다 */
      if(P.echoT>0 && bullets.length+echoes.length<60){
        echoes.push({x:t.x-Math.cos(t.dir)*22, y:t.y-Math.sin(t.dir)*22, dir:t.dir, spd:t.spd*0.92, base:t.base,
          owner:'player', returns:t.returns, age:0, trail:[], glow:1, hcd:0.15, tried:[], ready:false,
          feint:0, orbitDir:0, orbitAmt:0, pierceLeft:t.pierceLeft});
      }
    });
    if(echoes.length){ bullets.push(...echoes); echoes.forEach(c=>burst(c.x,c.y,'cyan',6,120)); }
    run.bestRet=Math.max(run.bestRet,maxRet);
    /* v2.35 대포병 장갑탄은 손이 더 가는 만큼 충전을 3 준다 (장갑 깎기 1 + 빼앗기 3) */
    P.rChg=Math.min(CFG.rNeed,P.rChg+(ts.some(t=>t.shell)?3:1)+(just?1:0));
    if(just){ announce('저스트!','warn'); burst(P.x,P.y,'warn',16,220); }
    if(run.tut) run.tut.parried=(run.tut.parried||0)+1;   // v2.60
    else stat('parries');   // v2.68
    say(ts.length>1?'패링 성공 ×'+ts.length:'패링 성공','cyan');
    shake=6+2*(ts.length-1); sfx('parry',maxRet); if(ts.length>1) sfx('parry',maxRet+3);
    /* v2.61 패링 히트스톱 제거 — 멈춘 동안 경직 시간이 안 줄어 다음 패링이 씹혔다 */
    /* v1.7 D-2: 여러 발을 한 번에 빼앗으면 그만큼 회복이 길어진다 */
    if(boonLv('s_focus')) P.focusT=3;   // v2.37 패링 집중
    P.lock=boonLv('flow')?0:(0.10+0.09*(ts.length-1));
    P.lockMax=Math.max(0.01,P.lock); P.lockKind='ok';
  } else { P.lock=CFG.whiff*((boonLv('s_focus')&&P.focusT>0)?0.25:1); P.lockMax=Math.max(0.01,P.lock); P.lockKind='miss';
           if(CFG.whiff>0){ say('빗나감','red'); shake=4; sfx('miss'); } }
}
function refreshKeyLabels(){
  const P_=keyName(OPT.keyParry), S_=keyName(OPT.keySkill), Q_=keyName(OPT.keyWall), R_=keyName(OPT.keyR);
  $('#tKeys').textContent='WASD 이동 · 마우스 조준 · '+P_+' 패링 · '+S_+' 스킬 · '+Q_+' 스킬 · '+R_+' 스킬';
  $('#padParry').textContent=P_+' · 패링'; $('#padSkill').textContent=S_+' · F 스킬';
  $('#padWall').textContent=Q_+' · Q 스킬'; $('#padR').textContent=R_+' · R 스킬';
}
function doSkill(){
  if(paused||!CFG.skill||P.skillCd>0||P.hp<=0)return;
  if(CFG.skill==='heal'){
    if(P.hp>=CFG.hpMax){ say('체력 가득','dim'); return; }
    P.hp=Math.min(CFG.hpMax,P.hp+CFG.healAmt); P.skillCd=P.skillCdMax=CFG.healCd;
    say('회복 +'+CFG.healAmt,'cyan'); sfx('heal'); burst(P.x,P.y,'cyan',16,140);
  } else if(CFG.skill==='guard'){
    P.guard=CFG.guardDur; P.skillCd=P.skillCdMax=CFG.guardCd;
    say('방어막','cyan'); sfx('guard');
  } else if(CFG.skill==='dash'){
    const mx=(keys['d']||keys['arrowright']?1:0)-(keys['a']||keys['arrowleft']?1:0);
    const my=(keys['s']||keys['arrowdown']?1:0)-(keys['w']||keys['arrowup']?1:0);
    const ms=stick.move, ml=Math.hypot(mx,my);
    P.dashDir=(ms&&(ms.dx||ms.dy))?Math.atan2(ms.dy,ms.dx):(ml>0?Math.atan2(my,mx):P.face);
    P.dashT=DASH_DUR; P.inv=Math.max(P.inv,DASH_DUR);
    P.skillCd=P.skillCdMax=CFG.dashCd;
    say('대시','cyan'); sfx('dash'); burst(P.x,P.y,'cyan',12,160);
  } else if(CFG.skill==='slow'){
    P.slowT=CFG.slowDur; P.skillCd=P.skillCdMax=CFG.slowCd;
    say('시간 감속','cyan'); sfx('phase');
  } else if(CFG.skill==='shock'){
    let n=0;
    bullets.forEach(b=>{ if(b.owner!=='enemy') return; const d=dist(b.x,b.y,P.x,P.y); if(d>CFG.shockR) return;
      const a=Math.atan2(b.y-P.y,b.x-P.x); b.dir=a; b.ready=false; b.coy=0;
      if(d<R_PLAYER+R_BULLET+20){ b.x=P.x+Math.cos(a)*(R_PLAYER+R_BULLET+20); b.y=P.y+Math.sin(a)*(R_PLAYER+R_BULLET+20); } n++; });
    P.shockFx=0.35; P.skillCd=P.skillCdMax=CFG.shockCd;
    say(n?'충격파 ×'+n:'충격파','cyan'); sfx('block'); shake=Math.max(shake,8); burst(P.x,P.y,'cyan',18,260);
  } else if(CFG.skill==='absorb'){
    P.absorbT=CFG.absorbDur; P.skillCd=P.skillCdMax=CFG.absorbCd;
    say('흡수','cyan'); sfx('guard');
  }
}
function wallCandidate(){
  const hor=Math.abs(Math.cos(P.face))>=Math.abs(Math.sin(P.face));   // 좌우를 보면 세로벽, 위아래면 가로벽
  const w=hor?WALL_T:WALL_L, h=hor?WALL_L:WALL_T;
  const d=hor?80:(Math.sin(P.face)>0?130:80);
  const cx=P.x+Math.cos(P.face)*d, cy=P.y+Math.sin(P.face)*d;
  const o={x:clamp(cx-w/2,10,WORLD.w-10-w), y:clamp(cy-h/2,10+WALL_HG/SQUASH,WORLD.h-10-h), w, h};
  o.col=colOf(o); return o;
}
function wallProblem(o){
  if(rectHit(P.x,P.y,R_PLAYER+4,o.col)) return 'TOO CLOSE';
  if(ens.some(e=>rectHit(e.ax,e.ay,e.r+60,o.col))) return 'ENEMY IN THE WAY';
  const keep=(run.walls.length>=CFG.wallMax?run.walls.slice(1):run.walls).concat(run.mapWalls);   // 꽉 찼으면 가장 오래된 벽은 곧 사라짐. 맵 장애물은 항상 유지
  if(keep.some(q=>rectGap(q.col,o.col)<WALL_GAP)) return 'NEED SPACE';
  return '';
}
function doQ(){
  if(CFG.qSkill==='wall') doWall();
  else if(CFG.qSkill==='phase'){
    if(paused||P.wallCd>0||P.hp<=0)return;
    P.phase=CFG.phaseDur; P.wallCd=P.qCdMax=CFG.phaseCd;
    say('위상 이동','cyan'); sfx('phase');
  } else if(CFG.qSkill==='hook'){
    if(paused||P.wallCd>0||P.hp<=0)return;
    if(!ens.length){ say('대상 없음','red'); sfx('miss'); P.wallCd=0.25; return; }
    ens.forEach(e=>{ e.bindT=CFG.bindDur; burst(e.x,e.y,'cyan',6,120); });   // v3.12 필드의 모든 적을 한 번에 구속
    P.wallCd=P.qCdMax=CFG.hookCd;
    say('구속','cyan'); sfx('hook');
  } else if(CFG.qSkill==='decoy'){
    if(paused||P.wallCd>0||P.hp<=0)return;
    let x=clamp(P.x+Math.cos(P.face)*120,40,WORLD.w-40), y=clamp(P.y+Math.sin(P.face)*120,40,WORLD.h-40);
    [x,y]=pushOutOfWalls(x,y,R_PLAYER+6);
    P.decoy={x,y}; P.decoyT=P.decoyMax=CFG.decoyDur; P.wallCd=P.qCdMax=CFG.decoyCd;
    say('미끼','cyan'); sfx('phase'); burst(x,y,'cyan',14,160);
  }
}
/* v2.1 R 슬롯 — 덮어쓰기 / 메아리 (웨이브 보상 '잔상'과 이름이 겹쳐서 개명) */
function doR(){
  if(paused||!CFG.skillR||P.hp<=0)return;
  if(P.rChg<CFG.rNeed){ say('충전 '+Math.floor(P.rChg)+' / '+CFG.rNeed,'dim'); return; }
  if(CFG.skillR==='overwrite'){
    const ts=bullets.filter(b=>b.owner==='enemy');
    if(!ts.length){ say('탄환 없음','dim'); return; }
    const all=ens.slice().sort((a,b)=>dist(a.x,a.y,P.x,P.y)-dist(b.x,b.y,P.x,P.y));
    ts.forEach((t,i)=>{
      t.owner='player'; t.returns++; t.feint=0; t.orbitAmt=0; t.homeT=CFG.homeTime;   // v2.46
      t.spd=Math.min(t.spd*CFG.accel,cap());
      t.pierceLeft=boonLv('pierce'); t.glow=1; t.hcd=0.15; t.tried=[]; t.ready=false;
      /* v3.00 예전엔 플레이어 기준 가까운 순서로 돌려가며 노려서, 탄환 자리에서 벽 · 방패 뒤인 적에게도 쏴 벽에 튕겼다 → 탄환 자리에서 보이는 적 우선 */
      const seen=all.filter(e=>!G(e).shield&&!wallBetween(t.x,t.y,e.x,e.y)).sort((a,b)=>dist(a.x,a.y,t.x,t.y)-dist(b.x,b.y,t.x,t.y));
      const pool=seen.length?seen:all;
      const tgt=pool.length?pool[i%pool.length]:null;
      t.dir=tgt?Math.atan2(tgt.y-t.y,tgt.x-t.x):t.dir; t.htg=tgt;   // v2.86 · v3.00 탄환 자리에서 겨눔
    });
    say('덮어쓰기 ×'+ts.length,'warn'); sfx('overwrite'); shake=10;
    P.rChg=0;
  } else if(CFG.skillR==='echo'){
    P.echoT=ECHO_DUR; P.rChg=0;
    say('복제','cyan'); sfx('echo');
  } else if(CFG.skillR==='emp'){
    /* v2.22 EMP — 화면의 모든 적을 멈춘다 */
    if(!ens.length){ say('적 없음','dim'); return; }
    /* v2.29 해킹 — 멈추거나 피해를 주지 않는다. 지속 시간 동안 적이 쏘는 탄환이 내 것이 된다 */
    ens.forEach(e=>{ e.hackT=Math.max(e.hackT||0,CFG.empDur); });
    P.rChg=0;
    say('해킹  '+CFG.empDur.toFixed(1)+'s','warn'); sfx('overwrite'); shake=12;
    burst(P.x,P.y,'cyan',26,320);
  } else if(CFG.skillR==='autoparry'){
    /* v3.16 PC는 자동 패링, 폰(터치)은 같은 스킬이 '과부하 늦게'로 동작 — 폰은 시간 두 배 */
    const dur=CFG.autoDur*(touchMode?2:1);
    P.autoT=dur; P.autoMax=dur; P.rChg=0;
    say((touchMode?'과부하 억제  ':'자동 패링  ')+dur.toFixed(1)+'s','cyan'); sfx('echo'); shake=8;
    burst(P.x,P.y,'cyan',22,280);
  }
}
function doWall(){
  if(paused||!CFG.wallMax||P.wallCd>0||P.hp<=0)return;
  const o=wallCandidate(), err=wallProblem(o);
  if(err){ say(err,'red'); sfx('miss'); P.wallCd=0.25; return; }
  if(run.walls.length>=CFG.wallMax) run.walls.shift();
  run.walls.push(o); P.wallCd=P.qCdMax=(run.phase==='build'?0.2:WALL_CD);
  say('벽 '+run.walls.length+' / '+CFG.wallMax,'cyan'); sfx('wall');
  burst(o.x+o.w/2,o.y+o.h/2,'cyan',14,160);
}

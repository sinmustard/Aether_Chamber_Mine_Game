"use strict";
/* ================= 업데이트 ================= */
/* v3.50 맞았을 때 — 웨이브 특전 역습(잠깐 이동 · 사거리 증가, 다시 맞으면 시간만 갱신) · 분노(R 충전) */
function onHurt(){
  const c=boonLv('counter');
  if(c){ if(!(P.counterT>0)){ P.ctrMv=40*c; P.ctrRg=0.4*c; CFG.moveSpd+=P.ctrMv; CFG.rangeM+=P.ctrRg; say('역습','warn'); } P.counterT=2; }
  const f=boonLv('fury'); if(f&&CFG.skillR) P.rChg=Math.min(CFG.rNeed,P.rChg+5*f);
}
function update(dt){
  if(paused)return;
  if(BOT.on) botTick(dt);
  if(run&&run.phase==='reward') return;     // v2.0 보상 선택 중에는 전투 정지
  /* v2.61 히트스톱 중에도 패링 경직과 미리 누른 패링은 계속 흘러가게 — 멈춘 사이 입력이 씹히지 않도록 */
  if(hitstop>0){ hitstop-=dt; if(P.lock>0) P.lock-=dt; if(P.pbuf>0) P.pbuf=Math.max(P.pbuf,0.05); return; }
  if(run&&run.phase!=='build') run.time+=dt;   // v1.7 B-4

  // 플레이어
  if(P.dashT>0){
    P.dashT-=dt;
    const spd=CFG.dashDist/DASH_DUR;
    P.x=clamp(P.x+Math.cos(P.dashDir)*spd*dt,30,WORLD.w-30);
    P.y=clamp(P.y+Math.sin(P.dashDir)*spd*dt,30,WORLD.h-30);
  } else {
    let ax=0,ay=0;
    if(keys['a']||keys['arrowleft'])ax-=1;
    if(keys['d']||keys['arrowright'])ax+=1;
    if(keys['w']||keys['arrowup'])ay-=1;
    if(keys['s']||keys['arrowdown'])ay+=1;
    let l=Math.hypot(ax,ay)||1; ax/=l; ay/=l;
    const ms=stick.move;                                   // v2.3 가상 조이스틱
    let spdMul=1;
    if(ms&&(ms.dx||ms.dy)){ ax=ms.dx; ay=ms.dy; spdMul=Math.min(1,ms.len/TOUCH_MAX); }
    if(BOT.on&&BOT.mv){ ax=BOT.mv[0]; ay=BOT.mv[1]; spdMul=1; }
    P.x=clamp(P.x+ax*CFG.moveSpd*spdMul*dt,30,WORLD.w-30);
    P.y=clamp(P.y+ay*CFG.moveSpd*spdMul*dt,30,WORLD.h-30);
    P.moving=!!(ax||ay);   // v3.12 영상 캐릭터 '움직일 때만 재생'용
  }
  if(P.phase<=0) allWalls().forEach(({col:o})=>{
    const h=rectHit(P.x,P.y,R_PLAYER,o); if(!h)return;
    if(Math.abs(h.dx)>Math.abs(h.dy)||h.dy===0) P.x=h.dx>=0?o.x+o.w+R_PLAYER:o.x-R_PLAYER;
    else P.y=h.dy>=0?o.y+o.h+R_PLAYER:o.y-R_PLAYER;
  });
  /* v2.86 카메라가 움직이면 같은 커서 위치도 다른 월드 지점이 된다 → 매 프레임 다시 계산 */
  if(mouseS.ok){ mouse.x=clamp(mouseS.x/ZK,0,WORLD.w); mouse.y=clamp(((mouseS.y-CAMY)/ZK-OY)/SQUASH,0,WORLD.h); }
  const as=stick.aim;                                     // v2.3 오른쪽 드래그 조준
  if(as&&(as.dx||as.dy)) P.face=Math.atan2(as.dy,as.dx);
  else if(!touchMode&&!BOT.on)    P.face=Math.atan2(mouse.y-P.y,mouse.x-P.x);
  if(P.hurt>0)P.hurt-=dt; if(P.lock>0)P.lock-=dt; if(P.inv>0)P.inv-=dt;
  if(P.focusT>0)P.focusT-=dt;   // v2.37
  if(debug||CFG.god) run.cheat=1;   // v2.48 디버그를 쓴 판은 랭킹 등록 불가
  if(run.lastHp!==undefined&&P.hp<run.lastHp) run.waveHurt=1; run.lastHp=P.hp;   // v2.68
  /* v2.66 가장자리 압박 — 전투 중에만 (웨이브 사이 · 체험판은 제외) */
  if(run.phase==='fight'&&!run.tut){
    if(inEdge()){
      const corner=inCorner(); P.edgeT=(P.edgeT||0)+dt;
      if(!P.edgeWarned&&P.edgeT>0.4){ P.edgeWarned=1; say(corner?'구석은 위험해요 — 가운데로!':'가장자리에 오래 있으면 피해를 입어요','red'); }
      if(P.edgeT>(corner?0.8:1.5)&&P.inv<=0&&!CFG.god){
        P.edgeDmg=(P.edgeDmg||0)+dt*(corner?12:6)*dmgScale();
        if(P.edgeDmg>=1){ const d=Math.floor(P.edgeDmg); P.edgeDmg-=d; P.hp-=d; P.hurt=Math.max(P.hurt,.12); }
      }
    } else { P.edgeT=Math.max(0,(P.edgeT||0)-dt*2); P.edgeDmg=0; if(!P.edgeT) P.edgeWarned=0; }
  } else { P.edgeT=0; P.edgeDmg=0; }
  /* v2.49 홀드 패링 — 오른쪽 손가락이 닿아 있는 동안 패링할 탄환이 들어오면 자동 패링 */
  /* v2.57 패링 과부하 — 홀드 패링(폰)은 손을 계속 대고만 있으면 너무 쉬워서, 오래 누르고 있을수록 과부하가 쌓인다.
     · 누르고 있는 동안 초당 1, 자동 패링 한 번에 +0.15 / 떼면 초당 1.4씩 식는다
     · 4가 차면 '패링 과부하' — 1.4초 경직, 다 식을 때까지 자동 패링 정지 (누르고 있으면 천천히 식는다) */
  if(holdParryOn()&&!paused){
    const holding=!!stick.aim;
    if(P.ovl){
      P.heat=Math.max(0,P.heat-dt*(holding?0.4:1.4));
      if(P.heat<=0){ P.ovl=0; say('과부하 해제','cyan'); }
    } else {
      P.heat=holding? Math.min(HEAT_MAX,P.heat+dt*(P.autoT>0?0.2:1)) : Math.max(0,P.heat-dt*1.4);   // v3.16 R 자동 패링 중엔 5분의 1 속도
      if(P.heat>=HEAT_MAX){
        P.ovl=1; P.lock=Math.max(P.lock,1.4); P.lockMax=P.lock; P.lockKind='miss';
        say('패링 과부하','red'); sfx('hit'); shake=Math.max(shake,8);
      }
    }
  } else if(P.heat>0 && !paused){ P.heat=Math.max(0,P.heat-dt*1.4); if(P.heat<=0) P.ovl=0; }
  /* v2.88 손가락을 대기만 하고 아직 끌지 않았으면 조준 방향이 예전 그대로라, 그 방향으로 자동 패링돼 탄환이 뒤로 날아갔다 → 실제로 조준 중일 때만 */
  if(holdParryOn()&&!P.ovl&&stick.aim&&stick.aim.len>TOUCH_DEAD&&P.lock<=0&&!paused&&parryReady()){ doParry(true); P.heat=Math.min(HEAT_MAX,P.heat+(P.autoT>0?0.03:0.15)); }
  /* v3.16 R · 자동 패링 (PC) — 지속 시간 동안 패링할 탄환이 들어오면 저절로 패링 */
  if(P.autoT>0&&!touchMode&&P.lock<=0&&!paused&&parryReady()) doParry(true);
  /* v2.42 미리 누른 패링 — 기다리는 동안 탄환이 들어오면 패링, 끝까지 없으면 그때 빗나감 */
  if(P.pbuf>0){
    if(parryReady()) doParry(true);
    else { P.pbuf-=dt; if(P.pbuf<=0){ P.pbuf=0; doParry(true); } }
  }
  if(P.skillCd>0)P.skillCd-=dt; if(P.guard>0)P.guard-=dt; if(P.phase>0)P.phase-=dt; if(P.wallCd>0)P.wallCd-=dt;
  if(P.echoT>0)P.echoT-=dt;   // v2.1 R 슬롯
  if(CFG.firstAid>0&&!run.aidUsed&&!run.tut&&P.hp>0&&P.hp<CFG.hpMax*0.3){ run.aidUsed=true; P.hp=Math.min(CFG.hpMax,P.hp+CFG.hpMax*CFG.firstAid); announce('응급 처치  +'+Math.round(CFG.firstAid*100)+'%','cyan'); sfx('heal'); burst(P.x,P.y,'cyan',24,240); }
  if(P.counterT>0){ P.counterT-=dt; if(P.counterT<=0){ CFG.moveSpd-=P.ctrMv; CFG.rangeM-=P.ctrRg; P.ctrMv=P.ctrRg=0; } }   // v3.50 역습 끝
  if(P.grav){ P.grav.t-=dt; if(P.grav.t<=0) P.grav=null; }
  if(P.blazeT>0){ P.blazeT-=dt; if(P.blazeT<=0){ P.blazeT=0; say('오버클럭 끝','dim'); } }
  if(P.stasis){ P.stasis.t-=dt; if(P.stasis.t<=0) P.stasis=null; }
  if(P.slowT>0)P.slowT-=dt; if(P.absorbT>0)P.absorbT-=dt; if(P.shockFx>0)P.shockFx-=dt;
  if(P.decoyT>0){ P.decoyT-=dt; if(P.decoyT<=0){ P.decoyT=0; P.decoy=null; } }
  if(P.autoT>0){ P.autoT-=dt; if(P.autoT<=0){ P.autoT=0; say(touchMode?'과부하 억제 끝':'자동 패링 끝','dim'); } }   // v3.16

  if(run.tut) tutTick(dt);   // v2.60 체험판
  // 웨이브
  if(run.phase==='build'){
    run.phaseT-=dt;
    if(run.phaseT<=0){ run.phase='break'; run.phaseT=1.0; announce('시작','cyan'); sfx('wave'); }
  } else if(run.phase==='break'){
    run.phaseT-=dt*(CFG.fastwave?4:1);
    if(run.phaseT<=0) waveSpawn();
  } else if(run.phase==='clear'){
    /* v2.1 웨이브를 비운 직후 3초는 그대로 대기한다. 보상/다음 웨이브 전환이 바로 튀어나오지 않게 한다 */
    run.phaseT-=dt;
    if(run.phaseT<=0){
      const wasBoss = run.wave>BOSS_WAVE;
      if(wasBoss){ run.cycle++; run.wave=0;
        CFG.spd*=1.06; CFG.fire=Math.max(0.6,CFG.fire*0.92);
        announce('사이클 '+run.cycle,'warn'); run.phaseT=2.2; }
      else run.phaseT=1.2;
      run.phase='break';
      /* v2.0 2웨이브마다 + 보스 격파 직후에 보상 선택.
         매 웨이브마다 주면 한 사이클에 10개가 쌓여 성장이 너무 빠르다 */
      if(wasBoss || run.wave%2===0) openReward(wasBoss);
    }
  } else if(run.phase!=='tut' && !ens.length && !queue.length){   // v2.60 체험판은 웨이브 진행 안 함
    run.phase='clear'; run.phaseT=3; say('웨이브 클리어','cyan');
    if(P.hp>0&&P.hp<CFG.hpMax){ const h=Math.min(CFG.hpMax-P.hp,Math.round(CFG.hpMax*CFG.waveHeal)); P.hp+=h; say('회복 +'+h,'cyan'); }   // v3.38 웨이브 회복
    if(!run.waveHurt) stat('noHit'); run.waveHurt=0;   // v2.68 피격 없이 넘긴 웨이브
  }

  // 적
  ens.forEach(e=>{
    if(e.hackT>0) e.hackT-=dt;
    e.frozenT=inStasis(e.x,e.y)?1:0;   // v2.29 해킹 지속 시간
    e.drift+=dt*0.7;
    /* v3.11 앵커 이동 — 구속이 최우선, 그 다음 송신기 도주 / 분열체 접근 압박.
       구속된 동안은 제자리에서 못 움직인다(공격은 평소처럼) — 그래서 e.ax/e.ay를 그대로 둔다 */
    const ox=e.ax, oy=e.ay;
    const hl=(e.bindT>0||e.frozenT>0||G(e).heal||e.grade==='boss'||e.grade==='tracker'||e.hp>=e.hpMax*0.4)?null
      :ens.filter(o=>o!==e&&G(o).heal).sort((a,b)=>dist(a.x,a.y,e.x,e.y)-dist(b.x,b.y,e.x,e.y))[0];
    if(e.bindT>0||e.frozenT>0){
      if(e.bindT>0) e.bindT-=dt;
    } else if(hl){
      const d=dist(e.ax,e.ay,hl.x,hl.y);
      if(d>HEAL_R*0.45){ const to=Math.atan2(hl.y-e.ay,hl.x-e.ax);
        e.ax=clamp(e.ax+Math.cos(to)*110*dt,40,WORLD.w-40); e.ay=clamp(e.ay+Math.sin(to)*110*dt,40,WORLD.h-40); }
    } else if(G(e).relay){
      const d=dist(e.ax,e.ay,P.x,P.y), FLEE_R=300, FLEE_SPD=70;
      if(d<FLEE_R){
        const away=Math.atan2(e.ay-P.y,e.ax-P.x);
        e.ax=clamp(e.ax+Math.cos(away)*FLEE_SPD*dt,40,WORLD.w-40);
        e.ay=clamp(e.ay+Math.sin(away)*FLEE_SPD*dt,40,WORLD.h-40);
      }
    } else if(e.grade==='splinter'){
      const d=dist(e.ax,e.ay,P.x,P.y), STOP_R=150, APPROACH_SPD=60;
      if(d>STOP_R){
        const toward=Math.atan2(P.y-e.ay,P.x-e.ax);
        e.ax=clamp(e.ax+Math.cos(toward)*APPROACH_SPD*dt,40,WORLD.w-40);
        e.ay=clamp(e.ay+Math.sin(toward)*APPROACH_SPD*dt,40,WORLD.h-40);
      }
    } else if(e.grade==='tracker'){
      /* v2.7 추적자 — chase(추격) -> wind(예비 동작) -> dash(돌진) -> cd(대기) 순환 */
      if(!e.lungePhase) e.lungePhase='chase';
      if(e.lungePhase==='chase'){
        const d=dist(e.ax,e.ay,P.x,P.y);
        if(d>4){
          const toward=Math.atan2(P.y-e.ay,P.x-e.ax);
          e.ax=clamp(e.ax+Math.cos(toward)*TRACK_SPD*dt,40,WORLD.w-40);
          e.ay=clamp(e.ay+Math.sin(toward)*TRACK_SPD*dt,40,WORLD.h-40);
        }
        /* v3.1 벽 너머에서는 돌진을 걸지 않는다 — 벽이 다른 위협을 다 막아주는데 추적자만 뚫고 오면 벽의 의미가 없다 */
        if(d<=LUNGE_RANGE && run.phase==='fight' && !wallBetween(e.x,e.y,P.x,P.y)){ e.lungePhase='wind'; e.lungeT=LUNGE_WIND; }
      } else if(e.lungePhase==='wind'){
        e.lungeT-=dt;
        if(wallBetween(e.x,e.y,P.x,P.y)){ e.lungePhase='chase'; }   // 예비 동작 중 벽이 생기면 추격으로 되돌아간다
        else if(e.lungeT<=0){ e.lungePhase='dash'; e.lungeT=LUNGE_DUR; e.lungeHit=false;
          e.lungeDir=Math.atan2(P.y-e.ay,P.x-e.ax); }
      } else if(e.lungePhase==='dash'){
        e.lungeT-=dt;
        e.ax=clamp(e.ax+Math.cos(e.lungeDir)*LUNGE_SPD*dt,40,WORLD.w-40);
        e.ay=clamp(e.ay+Math.sin(e.lungeDir)*LUNGE_SPD*dt,40,WORLD.h-40);
        if(e.lungeT<=0){ e.lungePhase='cd'; e.lungeT=LUNGE_CD; }
      } else if(e.lungePhase==='cd'){
        e.lungeT-=dt;
        if(e.lungeT<=0) e.lungePhase='chase';
      }
    } else {
      const hidden=run.phase==='fight'&&wallBetween(e.x,e.y,P.x,P.y);
      e.hideT=hidden?(e.hideT||0)+dt:0; e.wanT=(e.wanT==null?1+Math.random()*3:e.wanT)-dt;
      if(e.wp){ e.wpT=(e.wpT||0)+dt; if(e.wpT>4){ e.wp=null; e.wpLos=false; } }
      if(e.hideT>1.2&&!e.wpLos){ const s=enemySpot(e,true); if(s){ e.wp=s; e.wpLos=true; e.wpT=0; } e.hideT=0; }
      else if(!e.wp&&e.wanT<=0){ const s=enemySpot(e,false); if(s){ e.wp=s; e.wpLos=false; e.wpT=0; } e.wanT=3+Math.random()*4; }
      if(e.wp){ const d=dist(e.ax,e.ay,e.wp[0],e.wp[1]), sp=(e.wpLos?95:45)*(e.grade==='boss'?0.6:1);
        if(d<6){ e.wp=null; e.wpLos=false; e.wanT=3+Math.random()*4; }
        else { const a=Math.atan2(e.wp[1]-e.ay,e.wp[0]-e.ax); e.ax=clamp(e.ax+Math.cos(a)*Math.min(d,sp*dt),40,WORLD.w-40); e.ay=clamp(e.ay+Math.sin(a)*Math.min(d,sp*dt),40,WORLD.h-40); } }
    }
    [e.ax,e.ay]=wallSlide(ox,oy,e.ax,e.ay,e.r+18);
    [e.ax,e.ay]=pushOutOfWalls(e.ax,e.ay,e.r+8);   // v2.18 적이 벽을 뚫던 문제 · v2.92 흔들림(±36/54)까지 감안해 벽에 바짝 붙어 숨지 못하게
    if(e.bindT>0||e.frozenT>0){ e.x=e.ax; e.y=e.ay; }   // v3.12 구속 중엔 제자리 흔들림(drift)도 멈춰서 완전히 고정된 것처럼 보이게
    else{ e.x=e.ax+Math.cos(e.drift*0.8)*36; e.y=e.ay+Math.sin(e.drift)*54; [e.x,e.y]=wallSlide(e.ax,e.ay,e.x,e.y,e.r); }
    if(dt>0){ e.vx=(e.lx==null?0:(e.x-e.lx)/dt); e.vy=(e.ly==null?0:(e.y-e.ly)/dt); } e.lx=e.x; e.ly=e.y;   // v3.00 이동 속도 (패링 조준 예측용)
    /* v2.7 추적자 돌진 중 접촉 판정 — 실제로 그려지는 위치(e.x,e.y) 기준으로 한 번만 확인 */
    if(e.grade==='tracker' && e.lungePhase==='dash' && !e.lungeHit && dist(e.x,e.y,P.x,P.y)<e.r+R_PLAYER){
      e.lungeHit=true;
      if(P.guard>0){ say('막음','cyan'); sfx('block'); burst(P.x,P.y,'cyan',10); }
      else if(P.inv<=0&&!CFG.god){
        P.hp-=Math.round(CONTACT_DMG*dmgScale()); P.hurt=.3; onHurt();   // v2.63 P.inv=CFG.iframe; shake=14; say('충돌','red'); sfx('breach'); burst(P.x,P.y,'red',14);
      }
    }
    if(e.hurt>0)e.hurt-=dt; if(e.seizeFx>0)e.seizeFx-=dt;
    if(e.shieldFx>0)e.shieldFx-=dt; if(e.inv>0)e.inv-=dt;
    if(e.sa!=null){                                  // v1.8.1 방패 회전
      if(e.shieldDown>0){ e.shieldDown-=dt; if(e.shieldDown<=0){ e.shieldDown=0; say('배리어 복구','red'); burst(e.x,e.y,'red',12,160); } }
      if(e.saStun>0) e.saStun-=dt;                   // v1.9.1 반동 중에는 못 돈다
      else{
        const want=Math.atan2(aimPt().y-e.y,aimPt().x-e.x);
        e.sa+=clamp(norm(want-e.sa),-SHIELD_TURN*dt,SHIELD_TURN*dt);
      }
    }
    /* v2.68 보스 변종 행동 */
    if(e.variant==='warden'&&run.phase==='fight'){ e.wardT-=dt;
      if(e.wardT<=0){ e.wardT=9; for(let i=0;i<2;i++){ const a=Math.random()*TAU; spawnEnemyAt('minion',e.x+Math.cos(a)*95,e.y+Math.sin(a)*95); }
        say('수호형 — 잡졸 소환','red'); sfx('boss'); } }
    if(e.variant==='phantom'&&run.phase==='fight'){ e.blinkT-=dt;
      if(e.blinkT<=0){ e.blinkT=5+Math.random()*1.5; burst(e.x,e.y,'red',14,200);
        for(let k=0;k<24;k++){ const nx=130+Math.random()*(WORLD.w-260), ny=130+Math.random()*(WORLD.h-260);
          if(dist(nx,ny,P.x,P.y)>300){ e.x=e.ax=nx; e.y=e.ay=ny; break; } }
        burst(e.x,e.y,'red',14,200); sfx('phase'); say('환영형 — 순간이동','red'); } }
    /* v2.19 소환사 */
    if(G(e).summon){
      if(e.summonFx>0) e.summonFx-=dt;
      e.summonT-=dt;
      if(e.summonT<=0 && ens.length<14) doSummon(e);
    }
    /* v2.19 보스는 추적자가 풀린 뒤(2사이클부터) 추적자를 1~2기 불러낸다 */
    if(e.grade==='boss' && run.cycle>=2){
      e.callT=(e.callT===undefined? 6.0 : e.callT-dt);
      if(e.callT<=0){
        const cnt=1+Math.floor(Math.random()*2);
        for(let k=0;k<cnt;k++){
          const a=Math.random()*TAU, d=120+Math.random()*80;
          spawnEnemyAt('tracker', e.x+Math.cos(a)*d, e.y+Math.sin(a)*d);
        }
        e.callT=11+Math.random()*4; announce('추적자 소환','red'); sfx('boss'); shake=10;
      }
    }
    /* v2.27 힐러 — 반경 안의 다른 적을 초당 0.2칸씩 회복시킨다 (자기 자신은 제외) */
    if(G(e).heal){
      ens.forEach(o=>{
        if(o===e||o.hp>=o.hpMax||dist(o.x,o.y,e.x,e.y)>HEAL_R) return;
        o.hp=Math.min(o.hpMax, o.hp+HIT_UNIT*G(e).heal*dt);
        o.healFx=0.25;
      });
    }
    /* v2.65 저격수 — 자기 박자로만 쏜다 (일반 패턴 안 씀) */
    if(G(e).sniper){
      if(run.phase!=='fight') { e.snipeT=2.2; e.aimOn=0; return; }
      if(e.hackT>0) return;
      e.snipeT=(e.snipeT===undefined?2.2:e.snipeT-dt);
      if(e.snipeT<=1.0){ e.aimOn=1; if(e.snipeT>0.3) e.aimAng=Math.atan2(aimPt().y-e.y,aimPt().x-e.x); }
      if(e.snipeT<=0){
        e.aimOn=0; e.snipeT=3.0+Math.random()*1.2;
        if(bullets.filter(b=>b.owner==='enemy').length<CFG.maxB){
          const sp=Math.max(CFG.spd*2.4, 520);
          bullets.push({x:e.x+Math.cos(e.aimAng)*(e.r+6),y:e.y+Math.sin(e.aimAng)*(e.r+6),dir:e.aimAng,spd:sp,base:sp,owner:'enemy',returns:0,
            straight:1, snipe:1, age:0,trail:[],glow:0,hcd:0,tried:[],ready:false,feint:0,orbitDir:0,orbitAmt:0});
          sfx('fire'); burst(e.x,e.y,'red',8,160);
        }
      }
      return;
    }
    if(run.phase!=='fight'&&!(run.tut&&run.tut.fire))return;   // v2.60 체험판에선 단계에 따라 쏜다
    /* v2.8 송신기·추적자는 평소엔 안 쏘지만, 남은 적이 전부 안 쏘는 부류뿐이면 패링할 탄환 자체가
       없어 못 잡게 되므로(예: 송신기 2기만 남는 경우) 그럴 땐 다른 적처럼 쏘게 한다.
       "혼자 남았는지"가 아니라 "나 말고 쏠 수 있는 적이 남아있는지"로 판정해야 안전하다 */
    if((G(e).relay||G(e).noFire) && ens.some(o=>o!==e && !(G(o).relay||G(o).noFire)))return;
    if(inStasis(e.x,e.y)) return;
    e.fireT-=dt;
    if(e.fireT<=0){
      const room=CFG.maxB-(bullets.length+queue.length);
      if(room<=0){ e.fireT=0.25; return; }               // v1.7 A-3: 자리가 없으면 잠깐 뒤 재시도
      const p=pickPattern(e);
      p.specs.slice(0,room).forEach(sp=>queue.push({t:sp.t,spec:sp,ex:e.x,ey:e.y,boss:e.grade==='boss',
        hack:(e.hackT>0), src:e}));   // v2.29 해킹 중이면 내 편 탄환으로 나간다
      e.fireT=CFG.fire*(e.grade==='boss'?(e.p2?0.7:0.9):1)*(0.8+Math.random()*0.5);
    }
  });

  // 발사 큐
  for(let i=queue.length-1;i>=0;i--){
    queue[i].t-=dt;
    if(queue[i].t<=0){ spawnBullet(queue[i]); queue.splice(i,1); }
  }

  // 탄환
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.age+=dt; b.glow=Math.max(0,b.glow-dt*2);
    b.trail.push([b.x,b.y]);
    const ratio=clamp((b.spd-CFG.spd)/Math.max(1,cap()-CFG.spd),0,1);
    const TL=OPT.lowfx? 3 : Math.max(4,Math.round(10+16*ratio));   // v2.52 저사양 모드는 꼬리를 짧게
    while(b.trail.length>TL)b.trail.shift();
    run.maxSpd=Math.max(run.maxSpd,b.spd);

    if(b.owner==='enemy'){
      if(b.feint) b.spd = b.age<0.55 ? b.base*0.35 : Math.min(b.base*1.35,cap());
      if(b.orbitAmt>0) b.orbitAmt=Math.max(0,b.orbitAmt-dt*1.05);
      const want=Math.atan2(aimPt().y-b.y,aimPt().x-b.x)+b.orbitDir*b.orbitAmt;
      if(P.phase<=0 && !b.armor && !b.straight) b.dir+=norm(want-b.dir)*Math.min(1,dt*4.5);   // v2.65 저격탄도 직선   // v2.34 장갑탄은 직선   // 위상 이동 중엔 유도 무력화
    } else {
      /* v2.14 유도 보정 — 되돌린 탄환이 앞쪽의 가장 가까운 적으로 휘어진다 */
      /* v2.46 유도가 강하면 탄환이 적 주위를 원을 그리며 계속 도는 문제가 있었다.
         ① 유도는 패링 후 정해진 시간(homeTime)만 작동하고 그 뒤로는 직진
         ② 시간이 지나면 유도가 꺼지므로 궤도에 갇히지 않는다
         ③ 가까워질수록 더 세게 꺾어서 스치지 않고 맞힌다 */
      if(b.homeT===undefined) b.homeT=CFG.homeTime;
      /* v3.03 적 찾기 — 앞으로 잠깐(0.22초) 날아간 뒤 노린 적 쪽으로 휘어 간다 (유도 강화와 별개, 폰 자동 조준용) */
      if(b.seekLeft>0){
        if(b.seekT>0) b.seekT-=dt;
        else{ b.seekLeft-=dt; const e=b.htg;
          if(e&&ens.includes(e)&&!wallBetween(b.x,b.y,e.x,e.y)){
            const diff=norm(Math.atan2(e.y-b.y,e.x-b.x)-b.dir), lim=dt*4.5;
            if(Math.abs(diff)>2.1){ b.seekLeft=0; } else { b.dir+=clamp(diff,-lim,lim); if(Math.abs(diff)<0.1) b.seekLeft=0; }   // 너무 뒤로 돌아야 하면 포기
          } else { b.seekLeft=0; } } }
      if(CFG.homing>0&&ens.length&&b.homeT>0&&!(b.seekLeft>0)){
        b.homeT-=dt;
        /* v2.86 예전엔 매 프레임 '앞쪽 108° 안에서 가장 가까운 적'으로 목표를 바꿔서, 지나가던 옆의 적에게 확 꺾였다.
           → 패링 때 노린 적을 끝까지 따라가고(뒤로 넘어가면 포기), 노린 적이 없을 때만 앞쪽 36° 안의 적을 살짝 쫓는다.
           한 프레임에 꺾이는 각도에도 상한을 둬서 자연스러운 곡선으로 */
        const angTo=e=>Math.abs(norm(Math.atan2(e.y-b.y,e.x-b.x)-b.dir));
        let tg=(b.htg&&ens.includes(b.htg)&&angTo(b.htg)<Math.PI*0.5&&!wallBetween(b.x,b.y,b.htg.x,b.htg.y))?b.htg:null;   // v2.89 벽에 가리면 포기
        if(b.htg&&!tg){ bMark(b.x,b.y,!ens.includes(b.htg)?'목표 사라짐':angTo(b.htg)>=Math.PI*0.5?'목표 지나침':'목표 벽에 가림','#9aa6ff'); b.htg=null; }   // v3.00
        if(!tg){ let bd=1e9; for(const e of ens){ const d=dist(b.x,b.y,e.x,e.y); if(d<bd&&angTo(e)<Math.PI*0.2&&!wallBetween(b.x,b.y,e.x,e.y)){ bd=d; tg=e; } } }
        if(tg){
          const close=dist(b.x,b.y,tg.x,tg.y)<140?2:1;
          const diff=norm(Math.atan2(tg.y-b.y,tg.x-b.x)-b.dir), lim=dt*Math.min(7,1.8*CFG.homing*close);
          b.dir+=clamp(diff*Math.min(1,dt*CFG.homing*close),-lim,lim);
        }
      }
      if(b.hcd>0) b.hcd-=dt;
      for(const e of ens){
        if(b.tried.includes(e)) continue;
        if(dist(b.x,b.y,e.x,e.y)<e.r+SEIZE_R){
          if(b.hcd>0) break;                 // v1.7 A-2: 유예 중에는 시도 자체를 미룬다
          /* v2.11 벽 너머로는 재탈취도 못 한다. 패링만 벽에 막히던 비대칭을 맞춘다 */
          if(wallBetween(e.x,e.y,b.x,b.y)) break;
          b.tried.push(e);
          if(Math.random()<seizeChance(e,b)){
            b.owner='enemy'; b.tried=[];
            b.dir=Math.atan2(aimPt().y-b.y,aimPt().x-b.x);
            e.seizeFx=0.35; say('빼앗김','red'); sfx('seize'); burst(b.x,b.y,'red',8); bMark(b.x,b.y,'재탈취 · '+(e===b.htg?'노린 적':'옆의 적'),'#ff5d6c');   // v3.00
          }
          break;
        }
      }
    }
    const prevX=b.x, prevY=b.y;
    let sf=(b.owner==='enemy'&&P.slowT>0)?0.5:1;
    if(P.blazeT>0) sf*=b.owner==='player'?1.6:1.2;
    if(b.owner==='enemy'&&inStasis(b.x,b.y)){ sf=0; b.ready=false; b.coy=0; }
    if(b.owner==='enemy'&&P.grav&&P.grav.t>0&&dist(b.x,b.y,P.grav.x,P.grav.y)<P.grav.r){
      const gd=dist(b.x,b.y,P.grav.x,P.grav.y), want=Math.atan2(P.grav.y-b.y,P.grav.x-b.x)+(gd<36?Math.PI/2:0);
      b.dir+=clamp(norm(want-b.dir),-dt*7,dt*7); b.ready=false; b.coy=0; sf=Math.min(sf,gd<36?0.15:0.4);
    }
    b.x+=Math.cos(b.dir)*b.spd*sf*dt; b.y+=Math.sin(b.dir)*b.spd*sf*dt;

    // 장애물
    const obstacles=allWalls();
    if(obstacles.length){
      let gone=false;
      /* v3.15 벽 관통 수정 — 예전엔 한 프레임에 벽을 건너뛰면 '벽 가운데 기준' 방향으로 면을 골라서,
         긴 벽의 끝 근처를 맞으면 벽 위/아래 끝으로 순간이동해 그대로 지나갔고, 벽 안에서 생긴 탄(벽에 붙은 적)은
         무조건 오른쪽 면으로 밀려나 반대편으로 빠져나갔다. → 이동 경로(이전→지금)가 처음 닿는 면을 정확히 계산하고,
         이미 벽 안이면 '온 쪽'으로 되돌려 내보낸다. 여러 벽 중 가장 먼저 닿는 벽을 쓴다 */
      let best=null, bestD=1e9, bestO=null;
      for(const {col:o} of obstacles){
        const hit=sweepRect(prevX,prevY,b.x,b.y,o,R_BULLET); if(!hit) continue;
        const d=Math.hypot(hit.x-prevX,hit.y-prevY); if(d<bestD){ bestD=d; best=hit; bestO=o; }
      }
      if(best){
        if(!CFG.bounce){ bullets.splice(i,1); gone=true; }
        else {
          let vx=Math.cos(b.dir), vy=Math.sin(b.dir);
          if(best.axis==='x') vx=-vx; else vy=-vy;
          b.x=best.x; b.y=best.y;
          if(b.owner==='player') bMark(b.x,b.y,'벽 반사','#ffd34d');   // v3.00
          b.dir=Math.atan2(vy,vx); b.trail.length=0; b.htg=null;   // v2.89
        }
      }
      if(gone) continue;
    }

    // 패링 가능 조건
    if(b.owner==='enemy'){
      const d=dist(b.x,b.y,P.x,P.y);
      const toB=Math.atan2(b.y-P.y,b.x-P.x);
      const appr=Math.cos(b.dir-Math.atan2(P.y-b.y,P.x-b.x))>0;
      b.ready = d<=range() && angDiff(P.face,toB)<=(CFG.fov/2)*Math.PI/180 && appr
                && !wallBetween(P.x,P.y,b.x,b.y);   // v1.6 벽 너머 탄환은 패링 불가
      if(b.ready) b.coy=COYOTE(); else if(b.coy>0) b.coy-=dt;   // v2.42
    } else { b.ready=false; b.coy=0; }

    // 충돌
    if(b.owner==='player'){
      /* v2.11 겹친 적 중 가장 가까운 하나만 본다. 무적이면 그 자리에서 아무 일도 없다.
         예전에는 무적인 적을 통과해 뒤의 적이 대신 맞았다 */
      let hitIdx=-1, hitD=1e9;
      for(let j=0;j<ens.length;j++){
        const d=dist(b.x,b.y,ens[j].x,ens[j].y);
        if(d<ens[j].r+R_BULLET && d<hitD){ hitD=d; hitIdx=j; }
      }
      if(hitIdx>=0 && ens[hitIdx].inv>0) hitIdx=-1;
      if(hitIdx>=0 && shielded(ens[hitIdx],b) && CFG.shieldPierce>0 && Math.random()<CFG.shieldPierce){ say('방패 관통','cyan'); burst(b.x,b.y,'cyan',10,160); }
      else if(hitIdx>=0 && shielded(ens[hitIdx],b)){
        /* v1.8 방패병 정면 — 피해 없이 튕겨낸다. 소유권은 그대로라 다른 적을 노릴 수 있다 */
        const e=ens[hitIdx];
        const out=Math.atan2(b.y-e.y,b.x-e.x);
        b.x=e.x+Math.cos(out)*(e.r+R_BULLET+3);
        b.y=e.y+Math.sin(out)*(e.r+R_BULLET+3);
        b.dir=out; b.trail.length=0;
        /* v1.9.1 막을 때마다 방패가 반동으로 밀리고 잠시 회전이 멈춘다.
           같은 방향으로 계속 쏘면 틈이 벌어져 결국 측면이 열린다 */
        const d=norm((e.sa!=null?e.sa:out)-out);
        e.sa=(e.sa!=null?e.sa:out)+(d>=0?1:-1)*0.42;
        e.saStun=1.1; e.shieldFx=0.3;   // v2.2 막은 뒤 방패가 다시 돌아오기까지 더 오래 걸리게 (0.55 -> 1.1)
        if(e.variant==='warden'){
          e.saStun=2.0; e.wardHits=(run.time-(e.wardHitT||-99)>6?0:(e.wardHits||0))+1; e.wardHitT=run.time;
          if(e.wardHits>=3){ e.wardHits=0; e.shieldDown=5; announce('배리어 파괴','cyan'); sfx('overwrite'); shake=14; burst(e.x,e.y,'cyan',24,260); }
        }
        say('방패에 막힘','red'); sfx('block'); shake=5; burst(b.x,b.y,'red',6,120); bMark(b.x,b.y,'방패 반사','#ff9f43');   // v3.00
        continue;
      }
      if(hitIdx>=0){
        const e=ens[hitIdx];
        /* v2.2 집념은 맞는 순간의 왕복 수로 판정한다 (보상을 나중에 얻어도 날아가던 탄환에 적용)
           v3.1 레벨당 배율 +1 (1중첩 ×2, 2중첩 ×3) */
        const gl=boonLv('grit');
        const dmgv=HIT_UNIT*((gl&&b.returns>=3)?(1+gl):1)*(b.shell?2:1)*(e.grade==='boss'&&boonLv('s_boss')?1.5:1)*(b.returns>=2?1+(CFG.rallyDmg||0):1);
        e.hp-=dmgv;
        const willKill=e.hp<=HIT_UNIT*0.25;   // v2.71 난이도 배율 탓에 생기는 애매한 체력 한 조각은 처치로 처리
        if(OPT.dmgNum) dmgNums.push({x:e.x,y:e.y-e.r,v:Math.round(dmgv),t:performance.now(),kill:willKill,big:dmgv>HIT_UNIT});   // v2.68
        e.hurt=.22; e.inv=ENEMY_IFRAME; shake=8; run.hits++; sfx('hit'); burst(b.x,b.y,'cyan',8);
        if(e.grade==='boss'&&!e.p2&&e.hp>0&&e.hp<=e.hpMax/2){ e.p2=true; announce('과부하','red'); sfx('boss'); shake=16; }
        const pts=Math.round(10*Math.max(1,b.returns)*CFG.scoreMul);
        run.score+=pts; say('+'+pts+(b.returns>1?'  ×'+b.returns:''),'warn');
        if(willKill) killEnemy(e);
        /* v2.0 파편 — 명중 지점 주변에 추가 피해 */
        const sh=boonLv('shard');
        if(sh){
          const base=HIT_UNIT*SHARD_UNIT*sh;
          ens.slice().forEach(o=>{ if(o===e||o.inv>0) return;
            if(dist(b.x,b.y,o.x,o.y)>=90+o.r) return;
            /* v2.2 방패가 폭발 지점을 향하면 절반만 들어간다 */
            o.hp-=base*(shielded(o,{x:b.x,y:b.y})?0.5:1);
            o.hurt=.18;
            if(o.hp<=HIT_UNIT*0.25) killEnemy(o);   // v2.2 파편으로도 죽는다 / v2.71 애매한 체력 한 조각 처리
          });
          burst(b.x,b.y,'warn',10,200);
        }
        /* v2.0 관통 — 남은 관통 횟수만큼 적을 뚫고 지나간다 (적 무적 0.1초 덕에 재충돌하지 않음) */
        if(b.pierceLeft>0 && ens.length){ b.pierceLeft--; continue; }
        bullets.splice(i,1); continue;
      }
    } else if(P.decoyT>0&&P.decoy&&dist(b.x,b.y,P.decoy.x,P.decoy.y)<R_PLAYER+R_BULLET){
      burst(b.x,b.y,'cyan',8); bullets.splice(i,1); continue;
    } else if(dist(b.x,b.y,P.x,P.y)<R_PLAYER+R_BULLET+((P.guard>0||P.absorbT>0)?14:0)){
      if(P.guard>0){ say('막음','cyan'); sfx('block'); burst(b.x,b.y,'cyan',10); }
      else if(P.absorbT>0){ if(CFG.skillR) P.rChg=Math.min(CFG.rNeed,P.rChg+2); say('흡수','cyan'); sfx('block'); burst(b.x,b.y,'cyan',10); }
      else if(P.barrier>0&&P.inv<=0&&!CFG.god){ P.barrier--; P.inv=0.4; say(P.barrier?'보호막 · 남은 '+P.barrier:'보호막 깨짐','cyan'); sfx('block'); burst(b.x,b.y,'cyan',14,180); }
      else if(P.inv<=0&&!CFG.god){ P.hp-=Math.round((run.cycle===1&&run.wave<=4?EARLY_DMG:PLAYER_DMG)*(b.boss===2?1.75:b.boss?1.5:1)*dmgScale()*(1-(CFG.armor||0))); P.hurt=.3; onHurt();   /* v3.50 장갑 · 피격 특전 */   /* v2.62 보스 탄환은 ×1.5, 2페이즈 ×1.75 */ P.inv=CFG.iframe; shake=13; say('피격','red'); sfx('breach'); burst(P.x,P.y,'red',12); }
      bullets.splice(i,1); continue;
    }
    if(b.x<-120||b.x>WORLD.w+120||b.y<-120||b.y>WORLD.h+120){ bullets.splice(i,1); continue; }
  }

  parts=parts.filter(q=>{q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=0.9;q.vy*=0.9;return (q.t-=dt)>0;});
  msgs=msgs.filter(m=>(m.t-=dt)>0);
  if(shake>0)shake=Math.max(0,shake-dt*30);
  /* v2.37 부활 — 남은 횟수가 있으면 쓰러지지 않고 다시 일어난다 */
  if(P.hp<=0&&run.tut){ P.hp=CFG.hpMax; P.inv=1.5; say('체험판에선 쓰러지지 않아요','dim'); }   // v2.60
  if(P.hp<=0){
    if(run.revives>0){
      run.revives--;
      P.hp=Math.round(CFG.hpMax*Math.min(1,0.3+(CFG.reviveHp||0)+(run.reviveHp||0))); P.inv=1.5; P.hurt=0;   // v2.65 부활 너프
      for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i];
        if(b.owner==='enemy'&&dist(b.x,b.y,P.x,P.y)<240) bullets.splice(i,1); }
      announce('부활'+(run.revives?'  ·  남은 '+run.revives+'회':''),'cyan');
      sfx('heal'); burst(P.x,P.y,'cyan',40,300); shake=14; hitstop=0.12;
    } else endRun();
  }
}
function enemySpot(e,los){
  let best=null, bs=-1e9;
  for(let k=0;k<(los?40:14);k++){
    const a=Math.random()*TAU, r=los?80+Math.random()*340:90+Math.random()*130, x=clamp(e.ax+Math.cos(a)*r,70,WORLD.w-70), y=clamp(e.ay+Math.sin(a)*r,70,WORLD.h-70);
    if(allWalls().some(({col:o})=>rectHit(x,y,e.r+20,o))||wallBetween(e.ax,e.ay,x,y)) continue;
    const dp=dist(x,y,P.x,P.y), see=!wallBetween(x,y,P.x,P.y);
    if(los&&(!see||dp<160)) continue;
    const sc=(see?200:0)-Math.abs(dp-340)*0.4-(los?dist(x,y,e.ax,e.ay)*0.5:0)+Math.random()*40;
    if(sc>bs){ bs=sc; best=[x,y]; }
  }
  return best;
}
function inStasis(x,y){ return !!(P.stasis&&P.stasis.t>0&&dist(x,y,P.stasis.x,P.stasis.y)<P.stasis.r); }
function aimPt(){ return (P.decoyT>0&&P.decoy)?P.decoy:P; }
function spawnBullet(q){
  const s0=q.spec.fast?Math.max(CFG.spd,cap()*q.spec.fast):CFG.spd*(q.boss?1.15:1);
  if(q.hack){
    /* v2.29 해킹된 적의 탄환 — 내 것으로 나가고, 쏜 적 말고 가장 가까운 다른 적을 향한다 */
    let tg=null,bd=1e9;
    ens.forEach(o=>{ if(o===q.src)return; const d=dist(o.x,o.y,q.ex,q.ey); if(d<bd){bd=d;tg=o;} });
    const hdir=tg?Math.atan2(tg.y-q.ey,tg.x-q.ex):Math.atan2(q.ey-P.y,q.ex-P.x);
    const off=(q.src?q.src.r:R_ENEMY)+R_BULLET+8;
    bullets.push({x:q.ex+Math.cos(hdir)*off, y:q.ey+Math.sin(hdir)*off, dir:hdir,spd:s0,base:s0,owner:'player',returns:0,
      age:0,trail:[],glow:1,hcd:0.4,tried:[],ready:false,pierceLeft:boonLv('pierce'),
      feint:0, orbitDir:0, orbitAmt:0});
    return;
  }
  const a=Math.atan2(aimPt().y-q.ey,aimPt().x-q.ex)+(q.spec.ang||0);
  if(q.spec.heavy){
    /* v2.34 장갑탄 — 유도 없이 직선. armor가 남아 있으면 패링해도 소유권이 넘어오지 않는다 */
    const hs=CFG.spd*0.85;
    bullets.push({x:q.ex,y:q.ey,dir:a,spd:hs,base:hs,owner:'enemy',returns:0,armor:2,boss:q.boss?(q.src&&q.src.p2?2:1):0,
      age:0,trail:[],glow:0,hcd:0,tried:[],ready:false,
      feint:0, orbitDir:0, orbitAmt:0});
    return;
  }
  bullets.push({x:q.ex,y:q.ey,dir:a,spd:s0,base:s0,owner:'enemy',returns:0,boss:q.boss?(q.src&&q.src.p2?2:1):0,   // v2.62
    age:0,trail:[],glow:0,hcd:0,tried:[],ready:false,
    feint:q.spec.feint||0, orbitDir:q.spec.orbit?(q.spec.odir||(Math.random()<.5?1:-1)):0,
    orbitAmt:q.spec.orbit?1.5:0});
}

"use strict";
/* ================= 전투 설정 ================= */
const CFG={ homeTime:1.4, rangeM:3.2, fov:55, whiff:1.3, dwell:0.35, spd:240, seizeMul:1, fire:1.8, homing:0, gainMul:1, startRewards:0,
            skill:'', qSkill:'', healAmt:0, healCd:18, guardDur:0, guardCd:18, phaseDur:0, phaseCd:16, wallMax:0,
            dashDist:0, dashCd:8, hookCd:9, bindDur:0, slowDur:0, slowCd:20, shockR:0, shockCd:14, absorbDur:0, absorbCd:22, decoyDur:0, decoyCd:14,
            skillR:'', owCd:26, echoCd:22, rNeed:50, empDur:0, autoDur:0, reviveHp:0, revives:0, specialChance:0, specialBoss:0, rerolls:0, randBoosts:0,
            accel:1.20, maxB:8, bounce:1, god:0, fastwave:0,
            moveSpd:230, scoreMul:1, hpMax:85, iframe:0.4, multi:1 };
const M=40, SQUASH=0.62, OY=40, W=1000, H=560;
/* v2.84 화면 맞춤 — VW: 실제로 그리는 가로 폭(화면이 넓으면 1000보다 커짐), OFX: 가운데 정렬용 왼쪽 여백, DPR: 기기 해상도 배율.
   예전엔 캔버스가 1000×560 그대로라 큰 화면에서 흐릿했고, 전체화면도 비율 때문에 양옆이 검게 남았다 */
let VW=W, OFX=0, DPR=1;
/* v2.85 넓은 화면은 양옆을 비우지 않고 전장을 확대해서 가로를 꽉 채운다(ZK). 위아래가 넘치면 카메라가 플레이어를 따라간다(CAMY) */
let ZK=1, CAMY=0;
const BODY_SQ=0.95;   // v2.8 캐릭터 몸통 세로 비율 (바닥 그림자는 SQUASH 유지)
const WORLD={w:1000,h:760};
/* v2.66 가장자리 압박 — 구석에 박혀 앞만 보고 패링하는 플레이를 막는다.
   가장자리 띠(45) 안에 있으면 잠깐 뒤부터 지속 피해, 구석(두 띠가 겹치는 곳)은 더 빨리 · 더 세게 */
const EDGE=45;   // v2.69 띠 두께 90 → 45
const inEdge=()=>P.x<EDGE||P.x>WORLD.w-EDGE||P.y<EDGE||P.y>WORLD.h-EDGE;
const inCorner=()=>(P.x<EDGE||P.x>WORLD.w-EDGE)&&(P.y<EDGE||P.y>WORLD.h-EDGE);
const R_ENEMY=30, R_ELITE=38, R_BOSS=52, R_PLAYER=26, R_BULLET=7;
const BASE_DMG=10, DMG_MULT=2.0, AIM_ASSIST=20, PLAYER_DMG=12;
/* v2.63 후반으로 갈수록 받는 피해 증가 — 웨이브당 +3%, 사이클당 +25%, 최대 ×2.5 (체험판은 그대로) */
const dmgScale=()=> (!run||run.tut)? 1 : Math.min(2.5, 1+0.03*Math.max(0,(run.wave||1)-1)+0.25*Math.max(0,(run.cycle||1)-1))*(run.mode==='hard'?1.3:run.mode==='hotd'?1.95:1);   // v2.68 하드 ×1.3
/* v2.78 적 체력의 사이클 배율 — 예전엔 사이클마다 ×1.15씩 복리로 불어나서(cycle10이면 ×3.5) 후반에 잡몹도
   총알받이가 됐다. 로그형으로 바꿔서 초반 체감(2사이클 ×1.15)은 그대로 두고 후반 증가폭만 점점 완만해지게 */
const cycleHpMul=c=>1+0.22*Math.log(Math.max(1,c||1));
const BOSS_WAVE=10;
const EMP_NEED=100;   // v2.23 EMP만 충전 100 고정 (다른 R 스킬은 단계별로 줄어든다)
const range=()=>CFG.rangeM*M;
/* v1.7 A-1: 상한을 사이클 탄속과 분리. 기본 탄속이 올라가도 패링이 감속이 되지 않게 한다 */
const cap=()=>Math.max(range()/CFG.dwell, CFG.spd*1.55);
/* v1.4 근접 재탈취: 적 몸체 + SEIZE_R 안에 들어온 탄환만, 적마다 한 번 시도.
   확률 = 등급 기본값 × (1 − 0.7 × 속도비율). 빠르게 되돌린 탄환일수록 뺏기 어렵다 */
const SEIZE_R=50;
/* v1.8 — 적 정의를 테이블로 분리. 적을 추가할 때 이 표에 한 줄만 더하면 된다.
   hits 처치 타격 수 / r 반경 / pool 패턴 풀 / score 처치 점수 / seize 재탈취 기본 확률
   shield 방패 정면 각도(도). 이 각도 안으로 들어온 탄환은 튕겨내고 피해를 주지 않는다 */
const GRADES={
  mob:     {hits:2,  r:R_ENEMY, pool:'mob',     score:50,   seize:0.42},
  elite:   {hits:4,  r:R_ELITE, pool:'elite',   score:150,  seize:0.50},
  bulwark: {hits:2,  r:50,      pool:'bulwark', score:110,  seize:0.46, shield:100},
  boss:    {hits:12, r:R_BOSS,  pool:'boss',    score:1000, seize:0.60},
  /* v2.1 송신기 — 쏘지 않는다. relay: 반경 RELAY_R 안의 다른 적에게 재탈취 확률을 더해준다 */
  relay:   {hits:1,  r:R_ENEMY, pool:'mob',     score:60,   seize:0.42, relay:0.20},
  /* v2.27 힐러 — 주변 적을 초당 0.2칸씩 계속 회복시킨다. 자기도 쏜다 */
  healer:  {hits:2,  r:R_ENEMY, pool:'mob',     score:130,  seize:0.44, heal:0.2},
  /* v2.34 대포병 — 유도 없이 직선으로 날아가는 장갑탄을 쏜다. 장갑탄은 패링을 연속 2번 해야 뺏을 수 있다 */
  cannon:  {hits:3,  r:42,      pool:'cannon',  score:200,  seize:0.50, fireMul:1.8},
  /* v2.65 저격수 — 조준선을 1초 보여 준 뒤 아주 빠른 직선탄 한 발. 조준선이 멈추면(0.3초 전) 곧 쏜다 */
  sniper:  {hits:2,  r:R_ENEMY, pool:'mob',     score:160,  seize:0.35, noFire:true, sniper:true},
  /* v2.1 분열형 — 처치되면 1칸짜리 분열체(splinter) 2기로 갈라진다 */
  splitter:{hits:2,  r:R_ENEMY, pool:'splitter',score:45,   seize:0.42},
  splinter:{hits:1,  r:20,      pool:'splinter',score:15,   seize:0.38},
  /* v2.7 추적자 — 탄환을 쏘지 않는다. 계속 쫓아오다 사거리 안에 들면 예비 동작 후 돌진(LUNGE)해 접촉 피해를 준다 */
  tracker: {hits:2,  r:28,      pool:'tracker', score:70,   seize:0.42, noFire:true},
  /* v2.19 소환사 — 쏘지 않고 주변에 잡졸(1칸)과 분열형을 불러낸다. 2사이클을 다 돌면 등장 */
  summoner:{hits:3,  r:34,      pool:'mob',     score:180,  seize:0.46, noFire:true, summon:true},
  /* 소환사가 부르는 1칸짜리 잡졸 — 일반 적보다 한 칸 낮다 */
  minion:  {hits:1,  r:24,      pool:'mob',     score:20,   seize:0.40}
};
const G=e=>GRADES[e.grade]||GRADES.mob;
const RELAY_R=240;   // 송신기 지원 반경
const HEAL_R=260;    // v2.27 힐러 회복 반경
/* v2.19 소환 — 잡졸 1~3 + 분열형 1, 합쳐서 2~4마리를 자기 주변에 부른다 */
const SUMMON_CD=[7.5,9.5], SUMMON_R=[70,130];
function doSummon(e){
  const n=1+Math.floor(Math.random()*3);           // 잡졸 1~3
  const list=Array(n).fill('minion').concat(['splitter']);
  list.forEach(g=>{
    const a=Math.random()*TAU, d=SUMMON_R[0]+Math.random()*(SUMMON_R[1]-SUMMON_R[0]);
    spawnEnemyAt(g, e.x+Math.cos(a)*d, e.y+Math.sin(a)*d);
  });
  e.summonT=SUMMON_CD[0]+Math.random()*(SUMMON_CD[1]-SUMMON_CD[0]);
  e.summonFx=0.45;
  say('소환','red'); sfx('boss'); burst(e.x,e.y,'red',18,200);
}
/* v1.8.1 방패 — 플레이어를 따라 돌되 회전 속도에 제한이 있다.
   제한이 없으면 탄환도 늘 플레이어 쪽에서 오므로 측면이라는 게 성립하지 않는다.
   SHIELD_TURN(rad/s)보다 빠르게 옆으로 돌면 방패를 벗겨낼 수 있다 */
const SHIELD_TURN=0.6;   // v1.9.1 우회 난이도 완화
const ENEMY_IFRAME=0.10; // v1.9.2 적 피격 무적. 다중 패링으로 한 적이 즉사하는 것을 막는다
/* v2.0.1 체력은 '칸(=패링 탄환 1타)' 단위로 관리한다. 피해량을 바꿔도 칸 수는 유지된다 */
const HIT_UNIT=BASE_DMG*DMG_MULT;        // 1칸
const SHARD_UNIT=0.5;                    // 파편은 중첩당 0.5칸 (최대 2중첩 → 1칸)
function shielded(e,b){
  const sh=G(e).shield||e.shieldArc; if(!sh||e.shieldDown>0) return false;   // v2.68 수호형 보스도 방패
  const toB=Math.atan2(b.y-e.y,b.x-e.x);          // 적에서 탄환을 향하는 방향
  return angDiff(e.sa!=null?e.sa:toB, toB)<=(sh/2)*Math.PI/180;
}
/* v1.7 D-1 — 왕복이 이어질수록 재탈취가 잘 되도록 방향을 뒤집었다.
   기존: 탄속이 오를수록 확률 하락 -> 왕복이 시작돼도 금방 끊김
   변경: 왕복 횟수에 따라 확률 상승, 탄속은 완만한 감쇠만 */
/* v2.1 송신기 지원 — 반경 안의 다른 송신기가 주는 보정을 모두 더한다 (자기 자신은 제외) */
function relayBonus(e){
  let s=0;
  ens.forEach(o=>{ if(o!==e && G(o).relay && dist(o.x,o.y,e.x,e.y)<=RELAY_R) s+=G(o).relay; });
  return s;
}
function seizeChance(e,b){
  const ratio=clamp((b.spd-CFG.spd)/Math.max(1,cap()-CFG.spd),0,1);
  const base=(e.grade==='boss'&&e.p2)?0.70:G(e).seize;
  const rally=0.12*Math.min(b.returns||0,3);
  /* v2.79 왕복 보너스(+최대 36%p)가 탄속 할인(최대 -25%)을 압도해서, 랠리가 길어질수록
     오히려 재탈취가 더 잘 되던 문제 — 탄속이 상한에 가까워지면 할인폭을 -40%까지 키워서
     끝까지 빨라진 랠리는 처음보다 덜 뺏기게 바꿨다 */
  let p=(base+rally+relayBonus(e))*(1-0.40*ratio)*CFG.seizeMul;
  return clamp(p,0,0.92);
}

/* v1.5 고정 장애물 제거. 벽은 Q 스킬(벽 생성)로만 생긴다.
   벽은 높이(WALL_HG)만큼 솟아 보이므로 충돌 영역(col)은 윗면까지 포함 */
const WALL_HG=28, WALL_L=130, WALL_T=30, WALL_GAP=50, WALL_CD=1.0, BUILD_T=12;
/* v2.1 R 슬롯 · 신규 F/Q 옵션 상수 */
const DASH_DUR=0.16, ECHO_DUR=4;
/* v2.7 추적자 — 접근(chase) -> 예비 동작(wind) -> 돌진(dash) -> 재사용 대기(cd) 상태를 순환한다 */
const TRACK_SPD=110, LUNGE_RANGE=130, LUNGE_WIND=0.45, LUNGE_DUR=0.22, LUNGE_SPD=900, LUNGE_CD=1.8, CONTACT_DMG=18;
const colOf=o=>({x:o.x, y:o.y-WALL_HG/SQUASH, w:o.w, h:o.h+WALL_HG/SQUASH});
/* v3.15 맵 — 판마다 장애물 배치를 완전히 무작위로 만든다(run.mapWalls). Q 스킬 벽(run.walls)과는 별개라
   설치 개수 제한(CFG.wallMax)에 안 걸리고 부서지지도 않는다. 플레이어 출발점(200,380) 주변은 비워둔다 */
const allWalls=()=>run.mapWalls.concat(run.walls);
function randWallRect(){
  const horiz=Math.random()<0.5, len=120+Math.random()*100, thick=32+Math.random()*24;
  const w=horiz?len:thick, h=horiz?thick:len;
  return {x:20+Math.random()*(WORLD.w-40-w), y:20+Math.random()*(WORLD.h-40-h), w, h};
}
/* v3.2 맵 교체 (판 시작 1회 + 5웨이브마다) — 출발점 주변과 서로 간에는 최소 간격을 두고, 안 맞으면 다시 뽑는다 */
function rerollMap(){
  const n=2+Math.floor(Math.random()*2);   // 2~3개
  const placed=[];
  for(let i=0;i<n;i++){
    let o, tries=0;
    do{ o=randWallRect(); tries++; }
    while(tries<30 && (dist(o.x+o.w/2,o.y+o.h/2,200,380)<200 || placed.some(p=>rectGap(p,o)<WALL_GAP)));
    placed.push(o);
  }
  run.mapWalls=placed.map(o=>({x:o.x,y:o.y,w:o.w,h:o.h,col:colOf(o),static:true}));
}
function segHitsRect(x1,y1,x2,y2,o){   // 선분이 사각형을 지나가는가 (Liang–Barsky)
  let t0=0,t1=1; const dx=x2-x1, dy=y2-y1;
  const pp=[-dx,dx,-dy,dy], qq=[x1-o.x,o.x+o.w-x1,y1-o.y,o.y+o.h-y1];
  for(let i=0;i<4;i++){
    if(pp[i]===0){ if(qq[i]<0) return false; }
    else{ const r=qq[i]/pp[i];
      if(pp[i]<0){ if(r>t1) return false; if(r>t0) t0=r; }
      else       { if(r<t0) return false; if(r<t1) t1=r; } }
  }
  return true;
}
const wallBetween=(x1,y1,x2,y2)=>allWalls().some(({col:o})=>segHitsRect(x1,y1,x2,y2,o));
const rectGap=(a,b)=>Math.max(a.x-(b.x+b.w), b.x-(a.x+a.w), a.y-(b.y+b.h), b.y-(a.y+a.h));
/* v3.15 탄환 이동 경로(x0,y0→x1,y1)가 벽(반지름만큼 넓힌 사각형)에 처음 닿는 면과 그 직전 자리.
   이미 안에서 시작했으면 진행 반대 방향(온 쪽)으로 빠져나가는 면을 돌려준다. 안 닿으면 null */
function sweepRect(x0,y0,x1,y1,o,r){
  const L=o.x-r, Rr=o.x+o.w+r, T=o.y-r, B=o.y+o.h+r, dx=x1-x0, dy=y1-y0;
  if(x0>L&&x0<Rr&&y0>T&&y0<B){
    let bx=-dx, by=-dy; if(!bx&&!by) bx=-1;
    const tx=bx>0?(Rr-x0)/bx:bx<0?(L-x0)/bx:Infinity, ty=by>0?(B-y0)/by:by<0?(T-y0)/by:Infinity;
    return tx<ty?{axis:'x',x:x0+bx*tx+(bx>0?.5:-.5),y:y0+by*tx}:{axis:'y',x:x0+bx*ty,y:y0+by*ty+(by>0?.5:-.5)};
  }
  let tmin=0,tmax=1,axis=null;
  if(dx===0){ if(x0<=L||x0>=Rr) return null; } else { let a=(L-x0)/dx,c=(Rr-x0)/dx; if(a>c){const q=a;a=c;c=q;} if(a>tmin){tmin=a;axis='x';} tmax=Math.min(tmax,c); }
  if(dy===0){ if(y0<=T||y0>=B) return null; } else { let a=(T-y0)/dy,c=(B-y0)/dy; if(a>c){const q=a;a=c;c=q;} if(a>tmin){tmin=a;axis='y';} tmax=Math.min(tmax,c); }
  if(!axis||tmin>tmax) return null;
  const x=x0+dx*tmin, y=y0+dy*tmin;
  return {axis, x:axis==='x'?x+(dx>0?-.5:.5):x, y:axis==='y'?y+(dy>0?-.5:.5):y};
}
function rectHit(cx,cy,r,o){
  const nx=clamp(cx,o.x,o.x+o.w), ny=clamp(cy,o.y,o.y+o.h);
  const dx=cx-nx, dy=cy-ny;
  return dx*dx+dy*dy>=r*r?null:{nx,ny,dx,dy};
}
const PATTERNS=[
 {n:'SINGLE',  d:'직선 단발',      specs:[{t:0}]},
 {n:'FEINT',   d:'지연 후 급가속',  specs:[{t:0,feint:1}]},
 {n:'TWIN',    d:'2발 시차',       specs:[{t:0},{t:0.7}]},
 {n:'ORBIT',   d:'우회 접근',      specs:[{t:0,orbit:1}]},
 {n:'OVERLOAD',d:'고속',           specs:[{t:0,fast:0.85}]},
 /* v2.6 등급 전용 오리지널 패턴 */
 {n:'RUSH',    d:'페인트 후 고속 추가타 (엘리트 전용)',   specs:[{t:0,feint:1},{t:0.5,fast:0.9}]},
 {n:'VOLLEY',  d:'좌우로 갈라지는 2발 (방패병 전용)',      specs:[{t:0,ang:-0.25},{t:0.25,ang:0.25}]},
 {n:'CLEAVE',  d:'분열 예고 동시 2발 (분열형 전용)',       specs:[{t:0,ang:-0.3},{t:0,ang:0.3}]},
 {n:'JAB',     d:'예비 동작 없는 근접 고속탄 (분열체 전용)', specs:[{t:0,fast:0.95}]},
 {n:'SHELL',   d:'직선 장갑탄 — 패링 2회 필요 (대포병 전용)', specs:[{t:0,heavy:1}]}
];
/* v1.3 — 등급별 패턴 풀. 잡몹은 기본기, 엘리트는 조건 시험.
   v2.6부터 등급마다 고유 패턴(RUSH/VOLLEY/CLEAVE/JAB)을 하나씩 섞어 실루엣이 겹치지 않게 했다 */
const POOL={
  mobEarly:[0,1], mob:[0,1,3],
  elite:[1,2,3,4,5],
  bulwark:[0,2,6],
  splitter:[0,1,7],
  splinter:[0,8],
  cannon:[9]
};
/* v1.3 — 알레테이아 전용 패턴 (ang: 발사 각도 오프셋 rad, odir: 우회 방향 고정) */
const BOSS_PATTERNS=[
 {n:'FAN',     d:'3발 부채꼴 동시',    specs:[{t:0,ang:-0.55},{t:0},{t:0,ang:0.55}]},
 {n:'CHAIN',   d:'4발 연쇄',          specs:[{t:0},{t:0.45},{t:0.9},{t:1.35}]},
 {n:'PINCER',  d:'양쪽 우회 협공',     specs:[{t:0,orbit:1,odir:1},{t:0,orbit:1,odir:-1}]},
 {n:'DOUBLE FEINT',d:'시차 페인트 2발', specs:[{t:0,feint:1},{t:0.35,feint:1,ang:0.4}]},
 /* v2.18 추가 */
 {n:'SPIRAL',  d:'5발 나선 — 각도가 조금씩 벌어진다',
  specs:[{t:0,ang:-0.7},{t:0.14,ang:-0.35},{t:0.28},{t:0.42,ang:0.35},{t:0.56,ang:0.7}]},
 {n:'TRAP',    d:'양쪽 우회로 가두고 정면 고속 한 발',
  specs:[{t:0,orbit:1,odir:1},{t:0,orbit:1,odir:-1},{t:0.55,fast:0.9}]},
 /* v2.62 추가 */
 {late:1, n:'CROSS',   d:'넓게 벌어진 4발 — 자리를 옮겨야 한다',
  specs:[{t:0,ang:-1.15},{t:0,ang:-0.4},{t:0,ang:0.4},{t:0,ang:1.15}]},
 {late:1, n:'SHELL VOLLEY', d:'장갑탄 2발 시차 — 각각 패링 2번',
  specs:[{t:0,heavy:1,ang:-0.28},{t:0.55,heavy:1,ang:0.28}]},
 {late:1, n:'FEINT RAIN', d:'느리게 오다 갑자기 빨라지는 3발',
  specs:[{t:0,feint:1,ang:-0.3},{t:0.25,feint:1},{t:0.5,feint:1,ang:0.3}]},
 {late:1, n:'ORBIT CAGE', d:'양쪽에서 두 번 감싸는 우회탄 4발',
  specs:[{t:0,orbit:1,odir:1},{t:0,orbit:1,odir:-1},{t:0.6,orbit:1,odir:1},{t:0.6,orbit:1,odir:-1}]}
];
/* 체력 50% 이하 2페이즈 전용 */
const BOSS_P2S=[
 {n:'OVERDRIVE', d:'고속 + 우회 혼합', specs:[{t:0,fast:0.8},{t:0.5,orbit:1},{t:1.0,fast:0.8}]},
 /* v2.62 2페이즈 전용 추가 */
 {late:1, n:'MELTDOWN',  d:'고속 3연사 뒤 장갑탄', specs:[{t:0,fast:0.85,ang:-0.22},{t:0.22,fast:0.85},{t:0.44,fast:0.85,ang:0.22},{t:0.9,heavy:1}]},
 {late:1, n:'TEMPEST',   d:'우회 + 페인트 + 고속이 한꺼번에', specs:[{t:0,orbit:1,odir:1},{t:0.15,feint:1},{t:0.3,orbit:1,odir:-1},{t:0.7,fast:0.9}]}
];
function pickPattern(e){
  if(e.grade==='boss'){
    /* v3.02 노멀 1사이클에서는 나중에 추가한 어려운 보스 패턴(late)을 빼고, 2사이클부터 섞는다. 하드는 처음부터 전부 */
    const early=run.mode!=='hard'&&run.mode!=='hotd'&&run.mode!=='chaosx'&&run.cycle<2, ok=p=>!(early&&p.late);
    const pick=a=>a[Math.floor(Math.random()*a.length)];
    const p2=BOSS_P2S.filter(ok), base=BOSS_PATTERNS.filter(ok);
    if(e.p2&&p2.length&&Math.random()<0.45) return pick(p2);   // v2.62
    if(e.variant==='phantom'){ const ph=base.filter(p=>p.specs.some(sp=>sp.feint||sp.orbit)); return pick(ph.length?ph:base); }   // v2.68
    return Math.random()<0.25 ? PATTERNS[2+Math.floor(Math.random()*3)] : pick(base);
  }
  const key = G(e).pool;
  const pool = (key==='mob' && run.wave<=2) ? POOL.mobEarly : (POOL[key]||POOL.mob);
  return PATTERNS[pool[Math.floor(Math.random()*pool.length)]];
}

"use strict";
/* ================= v3.88 추가 기능 =================
   기존 함수를 감싸서 붙인다 — 이 파일과 index.html의 'extras' 한 단어를 빼면 v3.87 그대로.
   앞 묶음: 탄 위 왕복 수 · 저체력 경고 · 쓰러진 원인 · 웨이브 그래프 · 결과 문구 복사 · 무피격 연속 패링 · 엘리트 접두사 · 보스 처치 시간 · 보스 경고 · 적 도감
   뒤 묶음: 패링 목표 미리보기 · 랠리 피니시 · 패링 통계 · 첫 등장 안내 · 연습장 · 폰 진동 · 거울 벽 · 흡수체 · 탄 폭풍 · 위험 계약 · 일일 미션 · 강화 프리셋 · 리플레이 · 보스 러시 */
const feat=k=>k==='aim'?!!OPT.aimPrev:k==='vibe'?!!OPT.vibe:true;   // 설정으로 끄고 켜는 것만 OPT를 본다
const exRun=()=>run&&(run.ex||(run.ex={waves:{},order:[],src:{},cause:'',streak:0,best:0,lastHp:P.hp,boss:[],warn:0,hb:0,snap:null}));
const KO={mob:'잡몹',elite:'엘리트',bulwark:'방패병',boss:'알레테이아',relay:'송신기',healer:'힐러',cannon:'대포병',sniper:'저격수',
  splitter:'분열형',splinter:'분열체',tracker:'추적자',summoner:'소환사',minion:'잡졸',gunner:'연사병',weaver:'궤도병',
  mortar:'박격병',illusion:'환영 분신',sprayer:'분사병',trapper:'덫병'};
const VKO={core:'기본형',warden:'수호형',phantom:'환영형',collapse:'붕괴형'};
const fmtT=s=>Math.floor(s/60)+':'+(s%60).toFixed(1).padStart(4,'0');

{

/* ---- 탄 출처 표시: 누가 쏜 탄인지 ---- */
const _spawnBullet=spawnBullet;
spawnBullet=function(q){ const n=bullets.length; _spawnBullet(q);
  for(let i=n;i<bullets.length;i++) if(!bullets[i].from){ const s=q.src;
    bullets[i].from=s?(s.grade==='boss'?'알레테이아 · '+(VKO[s.variant]||'기본형'):KO[s.grade]||s.grade):'적'; } };

/* ---- 적 등장: 엘리트 접두사 · 보스 시간 · 경고 띠 ---- */
const AFFIX=[['강철','최대 체력 ×1.6','#9fb3c8'],['재생','맞지 않으면 체력 회복','#57e389'],['분노','발사 간격 ×0.6','#ff4d6a'],
  ['신속','이동 속도 ×1.5','#ffd34d'],['분열','죽으면 잡졸 2기로 갈라짐','#ff9f43'],['흡혈','이 적의 탄에 맞으면 그 적이 1칸 회복','#ff4d8d'],
  ['다중','쏠 때마다 양옆으로 탄이 하나씩 더','#c77dff'],['점멸','4초마다 근처 다른 자리로 순간이동','#6fd3ff'],['가시','내 탄에 맞을 때마다 탄 2발로 반격','#ff7a3d']];
window.ELITE_AFFIX=AFFIX;   // 테스트 · 도감에서 읽음
const affixCol=a=>(AFFIX.find(x=>x[0]===a)||[])[2]||C.red;
function exShot(x,y,dir,src,from){ const s=CFG.spd;   // 접두사 · 흡수체가 직접 내보내는 적 탄 (유도 없이 직선)
  bullets.push({x,y,dir,spd:s,base:s,owner:'enemy',returns:0,boss:0,age:0,trail:[],glow:0,hcd:0,tried:[],ready:false,
    feint:0,orbitDir:0,orbitAmt:0,straight:1,zig:0,fake:0,blink:0,from,srcE:src}); }
const _spawnEnemy=spawnEnemy;
spawnEnemy=function(grade){ const n=ens.length, r=_spawnEnemy.apply(this,arguments), e=ens.length>n?ens[ens.length-1]:null;
  if(e&&run){ const I=exRun();
    if(e.grade==='elite'&&run.cycle>=2&&Math.random()<0.5){ const a=AFFIX[Math.floor(Math.random()*AFFIX.length)][0]; e.affix=a;
      if(a==='강철'){ e.hp*=1.6; e.hpMax=e.hp; } }
    if(e.grade==='boss'){ e.exT0=run.time; if(feat('warn')) I.warn=2.6; } }
  return r; };

/* ---- 피격: 원인 기록 · 연속 패링 끊김 ---- */
function exBlame(I,loss,name){ if(loss<=0) return; I.src[name]=(I.src[name]||0)+loss; I.cause=name; }
const _onHurt=onHurt;
onHurt=function(){ const I=run&&exRun();
  if(I){ const loss=Math.max(0,I.lastHp-P.hp), S=I.snap||{near:[],mort:[]};
    let name='';
    const hit=S.near.filter(b=>dist(b.x,b.y,P.x,P.y)<R_PLAYER+R_BULLET+16).sort((a,b)=>dist(a.x,a.y,P.x,P.y)-dist(b.x,b.y,P.x,P.y))[0];
    if(hit) name=(hit.from||'적')+(hit.returns>0?' (되뺏긴 탄)':hit.armor!=null?' 장갑탄':' 탄');
    else if(S.mort.some(z=>!(run.mortars||[]).includes(z))) name='박격포';
    else if(ens.some(e=>e.grade==='tracker'&&dist(e.x,e.y,P.x,P.y)<e.r+R_PLAYER+40)) name='추적자 돌진';
    else name='알 수 없음';
    exBlame(I,loss,name); I.lastHp=P.hp;
    const sE=hit&&hit.srcE; if(sE&&sE.affix==='흡혈'&&ens.includes(sE)&&loss>0){ sE.hp=Math.min(sE.hpMax,sE.hp+HIT_UNIT); burst(sE.x,sE.y,'#ff4d8d',10,140); }
    if(feat('streak')){ if(I.streak>=5) say('연속 패링 '+I.streak+' 끊김','red'); I.streak=0; } }
  return _onHurt.apply(this,arguments); };

/* ---- 패링 성공 소리 = 연속 패링 +1 (여러 발 동시 패링은 한 번만) ---- */
let exLastParry=0;
const _sfx=sfx;
sfx=function(k){
  if(k==='parry'&&run&&!run.tut&&feat('streak')){ const now=performance.now();
    if(now-exLastParry>40){ const I=exRun(); I.streak++; I.best=Math.max(I.best,I.streak);
      if([10,25,50,100,200].includes(I.streak)) announce('무피격 연속 패링 '+I.streak,'cyan'); }
    exLastParry=now; }
  return _sfx.apply(this,arguments); };

/* ---- 매 프레임: 맞기 전 상황 기록 · 웨이브별 집계 · 재생/분노 · 심장 소리 ---- */
const _update=update;
update=function(dt){
  if(!run||screen!=='game') return _update(dt);
  const I=exRun(), key=run.cycle+'-'+(run.wave||1), hp0=P.hp;
  I.lastHp=P.hp;
  I.snap={near:bullets.filter(b=>b.owner==='enemy'&&dist(b.x,b.y,P.x,P.y)<R_PLAYER+R_BULLET+60),
          mort:(run.mortars||[]).filter(z=>dist(z.x,z.y,P.x,P.y)<z.r)};
  ens.forEach(e=>{ if(e.affix){ e._pf=e.fireT; e._ph=e.hp; e._pax=e.ax; e._pay=e.ay; } });
  _update(dt);
  if(!run||run.ex!==I) return;
  if(P.hp<I.lastHp&&P.hp>0) exBlame(I,I.lastHp-P.hp,'가장자리 압박');
  I.lastHp=P.hp;
  if(!I.waves[key]){ I.waves[key]={d:0,k:0,boss:false}; I.order.push(key); }
  const W=I.waves[key]; W.d+=Math.max(0,hp0-P.hp);
  if(ens.some(e=>e.grade==='boss')) W.boss=true;
  bullets.forEach(b=>{ if(b.owner==='enemy'&&!b.from){ let best=null,bd=140;
    ens.forEach(e=>{ const d=dist(e.x,e.y,b.x,b.y); if(d<bd){bd=d;best=e;} });
    b.from=best?(best.grade==='boss'?'알레테이아 · '+(VKO[best.variant]||'기본형'):KO[best.grade]||best.grade):'적'; } });
  ens.forEach(e=>{ if(!e.affix) return;
    if(e.affix==='분노'&&e._pf!=null&&e.fireT>e._pf+0.05) e.fireT*=0.6;
    if(e.affix==='재생'){ if(e._ph!=null&&e.hp<e._ph) e._rw=2; e._rw=(e._rw||0)-dt;
      if(e._rw<=0&&e.hp>0) e.hp=Math.min(e.hpMax,e.hp+e.hpMax*0.05*dt); }
    const held=e.bindT>0||e.frozenT>0;
    if(e.affix==='신속'&&!held&&e._pax!=null){ const nx=clamp(e.ax+(e.ax-e._pax)*0.5,40,WORLD.w-40), ny=clamp(e.ay+(e.ay-e._pay)*0.5,40,WORLD.h-40);
      [e.ax,e.ay]=wallSlide(e.ax,e.ay,nx,ny,e.r); }
    if(e.affix==='점멸'&&!held){ e._blk=(e._blk==null?4:e._blk)-dt;
      if(e._blk<=0){ e._blk=4; const sp=enemySpot(e,true); if(sp){ burst(e.x,e.y,'#6fd3ff',12,160); e.ax=e.x=sp[0]; e.ay=e.y=sp[1]; e.wp=null; burst(e.x,e.y,'#6fd3ff',12,160); } } }
    if(e.affix==='가시'&&e._ph!=null&&e.hp<e._ph&&e.hp>0){ const a=Math.atan2(P.y-e.y,P.x-e.x);
      [-0.18,0.18].forEach(o=>exShot(e.x+Math.cos(a+o)*(e.r+8),e.y+Math.sin(a+o)*(e.r+8),a+o,e,'엘리트 · 가시')); } });
  // 다중: 이 엘리트가 막 쏜 탄 옆에 하나씩 더 (한 발에 한 번만)
  for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; if(b.owner!=='enemy'||b._mx||!b.srcE||b.srcE.affix!=='다중'||b.age>0.15) continue;
    b._mx=1; [-0.22,0.22].forEach(o=>bullets.push(Object.assign({},b,{dir:b.dir+o,trail:[],tried:[],_mx:1}))); }
  if(I.warn>0) I.warn-=dt;
  if(feat('lowhp')&&P.hp>0&&P.hp<=CFG.hpMax*0.3&&!paused){ I.hb-=dt;
    if(I.hb<=0){ I.hb=P.hp<=CFG.hpMax*0.15?0.55:0.85; tone(72,48,0.13,'sine',0.22); tone(66,44,0.1,'sine',0.16,0.17); } }
};

/* ---- 보스 처치 시간 ---- */
const _killEnemy=killEnemy;
killEnemy=function(e){ const isBoss=e&&e.grade==='boss'&&e.exT0!=null&&run, t=isBoss?run.time-e.exT0:0;
  const n0=run?run.kills:0, r=_killEnemy.apply(this,arguments);
  if(run&&run.kills>n0){ const I=exRun(), key=run.cycle+'-'+(run.wave||1); if(!I.waves[key]){ I.waves[key]={d:0,k:0,boss:false}; I.order.push(key); } I.waves[key].k+=run.kills-n0; }
  if(isBoss&&feat('bosst')){ const v=e.variant||'core', k=run.mode+':'+v; let B={};
    try{ B=JSON.parse(localStorage.getItem('aether_x_bossT')||'{}')||{}; }catch(_){}
    const old=B[k], rec=old==null||t<old; if(rec){ B[k]=t; try{ localStorage.setItem('aether_x_bossT',JSON.stringify(B)); }catch(_){} }
    const msg=VKO[v]+' 처치 '+fmtT(t)+(rec?(old==null?'  ·  첫 기록':'  ·  최고 기록!'):'  ·  최고 '+fmtT(old));
    setTimeout(()=>{ if(run) announce(msg,rec?'warn':'cyan'); },1300); exRun().warn=0;
    exRun().boss.push({v,t,rec}); }
  return r; };

/* ---- 그리기: 탄 위 왕복 수 · 엘리트 접두사 · 저체력 테두리 · 보스 경고 띠 · 연속 패링 ---- */
const _drawBullet=drawBullet;
drawBullet=function(b){ _drawBullet(b);
  if(feat('rally')&&b.owner==='player'&&b.returns>=2){ const p=proj(b.x,b.y);
    ctx.save(); ctx.font='800 '+(11+Math.min(b.returns,8))+'px ui-monospace,monospace'; ctx.textAlign='left';
    ctx.lineWidth=3; ctx.strokeStyle='rgba(8,12,17,.85)'; ctx.strokeText('×'+b.returns,p[0]+12,p[1]-10);
    ctx.fillStyle=b.returns>=5?C.warn:C.cyan; ctx.fillText('×'+b.returns,p[0]+12,p[1]-10); ctx.restore(); } };
const _drawEnemyBody=drawEnemyBody;
drawEnemyBody=function(e){ _drawEnemyBody(e);
  if(e.affix&&feat('affix')){ const p=proj(e.x,e.y);
    ctx.save(); ctx.font='700 11px ui-monospace,monospace'; ctx.textAlign='center';
    const t='« '+e.affix+' »', w=ctx.measureText(t).width+10;
    ctx.fillStyle='rgba(8,12,17,.75)'; ctx.fillRect(p[0]-w/2,p[1]+e.r*0.75+4,w,15);
    ctx.fillStyle=affixCol(e.affix); ctx.fillText(t,p[0],p[1]+e.r*0.75+15); ctx.restore(); } };
const _drawHUD=drawHUD;
drawHUD=function(){ const I=run&&exRun(), W=VW;
  if(I&&feat('lowhp')&&P.hp>0&&P.hp<=CFG.hpMax*0.3){ const beat=Math.max(0,Math.sin(performance.now()/(P.hp<=CFG.hpMax*0.15?90:140)));
    const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.75);
    g.addColorStop(0,'rgba(255,40,70,0)'); g.addColorStop(1,'rgba(255,40,70,'+(0.28+0.22*beat)+')');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); }
  _drawHUD();
  if(!I) return;
  if(feat('streak')&&I.streak>=3){ ctx.textAlign='right'; ctx.font='700 13px ui-monospace,monospace';
    ctx.fillStyle=I.streak>=25?C.warn:C.cyan; ctx.fillText('무피격 연속 '+I.streak,W-18,52); }
  const bb=ens.find(e=>e.grade==='boss');
  if(feat('warn')&&I.warn>0&&bb){ const a=Math.min(1,I.warn*2,(2.6-I.warn)*4), y=H*0.6, h=64;
    ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='rgba(60,6,14,.82)'; ctx.fillRect(0,y,W,h);
    ctx.beginPath(); ctx.rect(0,y,W,h); ctx.clip(); ctx.fillStyle='rgba(255,59,92,.22)';
    const off=(performance.now()/12)%40; for(let x=-80+off;x<W+80;x+=40){ ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+20,y); ctx.lineTo(x-4,y+h); ctx.lineTo(x-24,y+h); ctx.fill(); }
    ctx.restore(); ctx.save(); ctx.globalAlpha=a; ctx.textAlign='center';
    ctx.fillStyle=C.red; ctx.font='800 28px ui-monospace,monospace'; ctx.fillText('⚠  WARNING  ⚠',W/2,y+30);
    ctx.fillStyle='#fff'; ctx.font='700 13px ui-monospace,monospace'; ctx.fillText('알레테이아 · '+(VKO[bb&&bb.variant]||'기본형')+' 접근',W/2,y+52); ctx.restore(); } };

/* ---- 결과 화면: 원인 · 출처 · 그래프 · 복사 ---- */
const _endRun=endRun;
endRun=function(){ const r=run, I=r&&exRun();
  if(I&&P.hp<=0&&I.lastHp>P.hp) exBlame(I,I.lastHp-P.hp,'가장자리 압박');
  const out=_endRun.apply(this,arguments);
  try{ exResult(r,I); }catch(e){ console.error(e); }
  return out; };
function exResult(r,I){
  const old=$('#exRes'); if(old) old.remove();
  if(!r||!I||r.tut) return;
  const box=document.createElement('div'); box.id='exRes';
  box.style.cssText='margin:10px auto 4px;max-width:520px;width:100%;text-align:left;font-size:12px;color:var(--fg);'+
    'border:1px dashed var(--line);border-radius:8px;padding:10px 12px;background:rgba(8,12,17,.45)';
  let h='<div style="font-size:10.5px;letter-spacing:.2em;color:var(--dim);margin-bottom:6px">이번 판 분석</div>';
  const died=r.ex&&P.hp<=0;
  if(feat('cause')){
    const top=Object.entries(I.src).sort((a,b)=>b[1]-a[1]).slice(0,3);
    if(died&&I.cause) h+='<div>쓰러진 원인 — <b style="color:var(--red)">'+I.cause+'</b></div>';
    h+='<div style="color:var(--dim)">가장 많이 맞은 것 — '+(top.length?top.map(([n,d])=>'<b style="color:var(--fg)">'+n+'</b> '+Math.round(d)).join(' · '):'없음')+'</div>';
  }
  if(feat('streak')) h+='<div style="color:var(--dim)">최장 무피격 연속 패링 — <b style="color:var(--cyan)">'+I.best+'</b></div>';
  if(feat('bosst')&&I.boss.length) h+='<div style="color:var(--dim)">보스 처치 시간 — '+I.boss.map(b=>VKO[b.v]+' <b style="color:'+(b.rec?'var(--warn)':'var(--fg)')+'">'+fmtT(b.t)+'</b>').join(' · ')+'</div>';
  if(feat('chart')&&I.order.length){
    const ks=I.order.slice(-16), md=Math.max(20,...ks.map(k=>I.waves[k].d)), mk=Math.max(5,...ks.map(k=>I.waves[k].k));
    h+='<div style="display:flex;gap:4px;align-items:flex-end;height:74px;margin-top:8px">'+ks.map(k=>{ const w=I.waves[k];
      return '<div title="'+k+' · 피해 '+Math.round(w.d)+' · 처치 '+w.k+'" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">'+
        '<div style="display:flex;gap:2px;align-items:flex-end;height:56px">'+
        '<div style="width:7px;height:'+Math.max(1,w.d/md*56)+'px;background:var(--red);border-radius:2px"></div>'+
        '<div style="width:7px;height:'+Math.max(1,w.k/mk*56)+'px;background:var(--cyan);border-radius:2px"></div></div>'+
        '<div style="font-size:9px;color:'+(w.boss?'var(--warn)':'var(--dim)')+'">'+(w.boss?'B':k.split('-')[1])+'</div></div>'; }).join('')+'</div>'+
      '<div style="font-size:10px;color:var(--dim);margin-top:2px"><span style="color:var(--red)">■</span> 받은 피해 &nbsp; <span style="color:var(--cyan)">■</span> 처치 &nbsp; (B = 보스 웨이브)</div>';
  }
  h+='<div id="exMore"></div>';
  if(feat('copy')) h+='<button id="exCopy" style="margin-top:8px;background:transparent;border:1px solid var(--cyan);color:var(--cyan);border-radius:6px;padding:6px 14px;font:700 12px ui-monospace,monospace;cursor:pointer">결과 문구 복사</button>';
  box.innerHTML=h;
  const btns=$('#result .btns'); btns.parentNode.insertBefore(box,btns);
  const cp=$('#exCopy');
  if(cp) cp.onclick=()=>{ const txt=exShareText(r,I,died);
    const done=()=>{ cp.textContent='복사됨 ✓'; setTimeout(()=>cp.textContent='결과 문구 복사',1500); };
    (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(done,()=>{
      const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }); };
}
window.exShareText=exShareText;
function exShareText(r,I,died){
  const MODE={normal:'노멀',hard:'하드',daily:'데일리',hotd:'핫드',chaosx:'혼돈이야~'};
  const em=I.order.map(k=>{ const w=I.waves[k]; return w.boss?(w.d>0?'🟧':'👑'):w.d<=0?'🟦':w.d<CFG.hpMax*0.3?'🟨':'🟥'; }).join('');
  return '에테르 챔버 v'+BUILD+' · '+(MODE[r.mode]||r.mode)+(r.mode==='daily'&&r.day?' '+r.day:'')+'\n'+
    Math.round(r.score).toLocaleString()+'점 · 사이클 '+r.cycle+' 웨이브 '+r.wave+' · 처치 '+r.kills+'\n'+em+'\n'+
    (died&&I.cause?'쓰러진 원인: '+I.cause+' · ':'')+'최장 연속 패링 '+I.best;
}

/* ---- 적 도감 ---- */
const DEX=window.ENEMY_DEX=[
  ['mob','기본 적. 플레이어를 쫓는 탄을 쏜다.'],['elite','크고 단단한 적. 탄을 더 자주 쏜다.'],
  ['bulwark','정면 100° 방패 — 옆이나 뒤로 돌려 맞혀야 한다.'],['relay','쏘지 않는다. 주변 적의 재탈취 확률 +20%.'],
  ['healer','주변 적을 계속 회복시킨다. 먼저 잡자.'],['cannon','유도 없는 장갑탄 — 패링 2번 해야 뺏는다.'],
  ['sniper','조준선을 1초 보여 준 뒤 아주 빠른 한 발.'],['splitter','처치하면 분열체 2기로 갈라진다.'],
  ['splinter','분열형이 남기는 1칸 조각.'],['tracker','쏘지 않고 쫓아와 돌진한다 (접촉 피해).'],
  ['summoner','잡졸과 분열형을 불러낸다.'],['minion','소환사가 부르는 1칸 잡졸.'],
  ['gunner','짧은 간격으로 연사한다.'],['weaver','휘어 들어오는 곡선 · 궤도 탄.'],
  ['mortar','바닥에 포격 원 — 1.3초 뒤 폭발.'],['sprayer','느린 탄을 부채꼴로 흩뿌린다.'],
  ['trapper','멈췄다가 다시 움직이는 덫 탄.'],['illusion','환영형 보스의 분신. 7초 뒤 사라진다.'],
  ['boss','알레테이아 · 기본형 — 공용 탄막 패턴.',''],['boss_warden','알레테이아 · 수호형 — 방패를 들고 버틴다.','boss'],
  ['boss_phantom','알레테이아 · 환영형 — 순간이동하며 분신을 남긴다.','boss'],['boss_collapse','알레테이아 · 붕괴형 — 나선 탄막과 포격.','boss'],
];
function openDex(){
  const card=([k,d,g])=>{ const gr=g||k, G0=GRADES[gr]||{}, img=SPRITES[k], nm=k.startsWith('boss_')?VKO[k.slice(5)]:KO[k];
    return '<div style="display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:8px;padding:8px">'+
      '<div style="width:52px;height:52px;flex:none;display:flex;align-items:center;justify-content:center">'+(img?'<img src="'+img.src+'" style="max-width:52px;max-height:52px">':'')+'</div>'+
      '<div style="min-width:0"><div><b>'+nm+'</b> <span style="color:var(--dim);font-size:10.5px">'+(G0.hits||'?')+'칸 · '+(G0.score||0)+'점</span></div>'+
      '<div style="color:var(--dim);font-size:11.5px;line-height:1.4">'+d+'</div></div></div>'; };
  $('#modalBox').style.width='min(640px,100%)';
  $('#modalBox').innerHTML='<div class="logHd"><h4>적 도감</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;max-height:70vh;overflow:auto">'+DEX.map(card).join('')+'</div>';
  $('#modal').classList.add('on');
}
const _openModal=openModal;
openModal=function(k){ $('#modalBox').style.width=''; return _openModal.apply(this,arguments); };
const dexBtn=document.createElement('button'); dexBtn.textContent='도감'; dexBtn.id='exDex'; dexBtn.onclick=()=>{ if(feat('dex')) openDex(); };
const statsBtn=document.querySelector('#title [data-modal=stats]'); if(statsBtn) statsBtn.after(dexBtn);
}

/* ================= 새 적 · 새 웨이브 · 모드 · 미션 · 프리셋 ================= */
{
const DEX2=window.ENEMY_DEX;
document.head.insertAdjacentHTML("beforeend","<style>.exBtn{background:transparent;border:1px solid var(--line);color:var(--fg);border-radius:6px;padding:5px 10px;font:600 12px ui-monospace,monospace;cursor:pointer}.exBtn:hover{border-color:var(--cyan);color:var(--cyan)}</style>");
const lsGet=(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)||'null')||d; }catch(e){ return d; } };
const lsSet=(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} };
const vib=p=>{ if(feat('vibe')&&navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} };
const normalRun=()=>run&&!run.tut&&!run.practice&&!run.rush;
const exMode=()=>run&&run.mode!=='daily'&&run.mode!=='chaosx';

/* ---- 새 적: 흡수체 ---- */
GRADES.absorber={hits:3,r:34,pool:'mob',score:140,seize:0.44,noFire:true,eatP:0.3,eatScore:40};   // eatP: 내 탄을 먹을 확률 · eatScore: 먹은 내 탄 1발당 처치 점수
ENEMY_COL.absorber='#9b6bff'; KO.absorber='흡수체';
DEX2.push(['absorber','적 탄을 빨아들여 커지고 내 탄도 30%는 먹는다. 죽으면 모은 만큼 터지고, 먹은 내 탄마다 점수 +40.']);
{ const dbg=$('#debugSpawn'); if(dbg){ const b=document.createElement('button'); b.dataset.spawn='absorber'; b.textContent='흡수체';
  dbg.insertBefore(b,dbg.querySelector('[data-spawn=clear]')); } }

/* ---- 보스 한 기 (원래 waveSpawn 안의 bossSpawn과 같은 보정) ---- */
function exBoss(v){ spawnEnemy('boss'); const bb=ens[ens.length-1]; bb.variant=v;
  if(v==='warden'){ bb.shieldArc=120; bb.sa=Math.atan2(P.y-bb.y,P.x-bb.x); bb.hp*=1.15; bb.hpMax=bb.hp; bb.wardT=6; }
  if(v==='phantom'){ bb.hp*=0.85; bb.hpMax=bb.hp; bb.blinkT=4.5; }
  if(v==='collapse'){ bb.hp*=1.35; bb.hpMax=bb.hp; }
  sfx('boss'); return bb; }

/* ---- 연습장 · 보스 러시: 새 판에 표시를 붙여 시작 ---- */
let exPending=null;
const _newRun=newRun;
newRun=function(){ const r=_newRun.apply(this,arguments); if(exPending&&run){ Object.assign(run,exPending); exPending=null; } return r; };
function exStart(extra){ exPending=Object.assign({cheat:1,startRewards:0},extra); $('#modal').classList.remove('on'); startRun('normal'); if(run){ run.chaos=false; run.startRewards=0; } }

/* ---- 웨이브: 연습장 · 보스 러시 · 탄 폭풍 · 위험 계약 · 흡수체 ---- */
const _waveSpawn=waveSpawn;
waveSpawn=function(){
  if(run&&run.practice){ run.wave=1; P.barrier=CFG.barrier||0; const g=run.practice.g;
    if(g.indexOf('boss')===0) exBoss(g.split(':')[1]||'core');
    else if(g==='absorber'){ spawnEnemy('absorber'); spawnEnemy('mob'); spawnEnemy('mob'); }   // 흡수체는 먹을 탄이 있어야 연습이 된다
    else { const n=['elite','cannon','summoner','bulwark','mortar'].includes(g)?2:3; for(let i=0;i<n;i++) spawnEnemy(g); }
    announce('연습장  ·  '+(g.indexOf('boss')===0?'알레테이아 · '+VKO[g.split(':')[1]||'core']:KO[g]),'cyan'); sfx('wave'); run.phase='fight'; return; }
  if(run&&run.rush){ const R=run.rush; run.wave=2; P.barrier=CFG.barrier||0;
    if(R.i>=4){ endRun(); return; }
    if(R.t0==null) R.t0=run.time;
    exBoss(['core','warden','phantom','collapse'][R.i]); announce('보스 러시  '+(R.i+1)+' / 4','warn'); run.phase='fight'; return; }
  const nw=run.wave+1;
  if(feat('storm')&&normalRun()&&exMode()&&(run.forceStorm||(nw>=3&&nw<=BOSS_WAVE&&run.stormCycle!==run.cycle&&Math.random()<0.3))){
    run.forceStorm=0; run.stormCycle=run.cycle; run.wave++; P.barrier=CFG.barrier||0;
    if(run.wave>1&&(run.chaos||run.wave%5===1)){ rerollMap(); say('지형 변화','warn'); }   // 원래 waveSpawn과 같은 맵 교체
    for(let i=0;i<44;i++){ const side=Math.floor(Math.random()*4), u=Math.random();
      const ex=side===0?30:side===1?WORLD.w-30:40+u*(WORLD.w-80), ey=side===2?30:side===3?WORLD.h-30:40+u*(WORLD.h-80);
      queue.push({t:0.8+i*0.21,spec:{},ex,ey,boss:false,storm:1}); }
    run.storm=1; announce('탄 폭풍  ·  10초 버티기','warn'); sfx('wave'); run.phase='fight'; return; }
  _waveSpawn.apply(this,arguments);
  if(!run) return;
  const bossWave=ens.some(e=>e.grade==='boss');
  if(run.riskNext&&!bossWave){ const gs=ens.map(e=>e.grade).filter(g=>g!=='relay'), n=Math.ceil(ens.length*0.5);
    for(let i=0;i<n;i++) spawnEnemy(gs[Math.floor(Math.random()*gs.length)]||'mob');
    run.riskOn=1; announce('위험 계약  ·  적 ×1.5','red'); }
  run.riskNext=0;
  if(feat('absorb')&&normalRun()&&!bossWave&&(run.forceAbsorb||(run.wave>=3&&Math.random()<0.35))){ run.forceAbsorb=0; spawnEnemy('absorber'); }
};
const _openReward=openReward;
openReward=function(){ if(run&&run.practice) return; return _openReward.apply(this,arguments); };

/* ---- 탄 폭풍 탄의 출처 ---- */
const _spawnBullet2=spawnBullet;
spawnBullet=function(q){ const n=bullets.length; _spawnBullet2(q);
  for(let i=n;i<bullets.length;i++){ bullets[i].srcE=q&&q.src; if(q&&q.storm) bullets[i].from='탄 폭풍'; } };   // srcE: 쏜 적 (흡수체는 흡수체 탄을 안 먹음)

/* ---- 거울 벽: 맵이 바뀔 때 벽 하나를 거울로 ---- */
const _rerollMap=rerollMap;
rerollMap=function(){ const r=_rerollMap.apply(this,arguments);
  const plain=run&&run.mapWalls?run.mapWalls.filter(o=>!o.prism):[];
  if(feat('mirror')&&plain.length) plain[Math.floor(Math.random()*plain.length)].mirror=1;
  return r; };
const _drawObstacles=drawObstacles;
drawObstacles=function(){ _drawObstacles(); if(!run||!run.mapWalls) return; const HG=WALL_HG, t=performance.now()/900;
  run.mapWalls.forEach(o=>{ if(!o.mirror) return; const a=proj(o.x,o.y), b=proj(o.x+o.w,o.y+o.h), w=b[0]-a[0], d=b[1]-a[1];
    ctx.save(); ctx.beginPath(); ctx.rect(a[0],a[1]-HG,w,d); ctx.clip();
    const g=ctx.createLinearGradient(a[0],a[1]-HG,a[0]+w,a[1]-HG+d); g.addColorStop(0,'rgba(190,230,255,.55)'); g.addColorStop(.5,'rgba(120,170,210,.35)'); g.addColorStop(1,'rgba(220,245,255,.6)');
    ctx.fillStyle=g; ctx.fillRect(a[0],a[1]-HG,w,d);
    ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=3; const sh=((t%2)/2)*(w+d+60)-30;
    ctx.beginPath(); ctx.moveTo(a[0]+sh,a[1]-HG); ctx.lineTo(a[0]+sh-d,a[1]-HG+d); ctx.stroke(); ctx.restore();
    ctx.strokeStyle=C.cyan; ctx.lineWidth=1.5; ctx.strokeRect(a[0]+.5,a[1]-HG+.5,w-1,d-1);
    ctx.fillStyle='#e9f7ff'; ctx.font='700 10px ui-monospace,monospace'; ctx.textAlign='center'; ctx.fillText('거울',a[0]+w/2,a[1]-HG+d/2+4); }); };

/* ---- 흡수체가 내 탄을 먹는다: 닿기 직전 30% — 먹으면 충전 +2(터질 때 탄 +2), 잡을 때 점수 +40씩 ---- */

function absorbPlayerShots(dt){
  for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; if(b.owner!=='player') continue;
    for(const e of ens){ if(e.grade!=='absorber'||e.hp<=0||(b.absRoll&&b.absRoll.includes(e))) continue;
      if(dist(b.x,b.y,e.x,e.y)>e.r+R_BULLET+b.spd*dt+4) continue;
      (b.absRoll||(b.absRoll=[])).push(e);   // 적 하나당 한 번만 굴린다
      if(Math.random()<GRADES.absorber.eatP){ bullets.splice(i,1); e.charge=(e.charge||0)+2; e.pAbs=(e.pAbs||0)+1;
        e.r=Math.min(64,GRADES.absorber.r+e.charge*2.5); burst(e.x,e.y,'cyan',12,140); say('흡수당함 · 충전 +2','warn'); break; } } } }

/* ---- 매 프레임: 웨이브 끝 정산 · 흡수체 · 거울 · 반응 시간 · 안내 시간 ---- */
const _update2=update;
update=function(dt){
  if(run&&screen==='game') absorbPlayerShots(dt);
  const ph0=run&&run.phase; _update2(dt);
  if(!run||screen!=='game') return;
  const I=exRun();
  if(ph0==='fight'&&run.phase==='clear'){
    if(run.storm){ run.storm=0; run.startRewards=(run.startRewards||0)+1; announce('탄 폭풍 돌파 — 다음 보상 1개 더','warn'); }
    if(run.riskOn){ run.riskOn=0; run.startRewards=(run.startRewards||0)+1; announce('계약 완료 — 다음 보상 1개 더','warn'); }
    run.riskOffer=feat('risk')&&normalRun()&&exMode()&&run.wave<BOSS_WAVE?1:0;
  }
  if(run.phase!=='clear') run.riskOffer=0;
  // 흡수체: 주변 적 탄을 끌어당겨 삼킨다
  ens.forEach(e=>{ if(e.grade!=='absorber'||e.frozenT>0) return; e.charge=e.charge||0; e.spin=(e.spin||0)+dt*(2+e.charge*0.3);
    for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; if(b.owner!=='enemy'||b.fromAbs||(b.srcE&&b.srcE.grade==='absorber')) continue; const d=dist(b.x,b.y,e.x,e.y);   // 혼자 남아 쏜 자기 탄까지 먹으면 못 잡는다
      if(d<e.r+R_BULLET){ bullets.splice(i,1); e.charge++; e.r=Math.min(64,GRADES.absorber.r+e.charge*2.5); burst(e.x,e.y,'#9b6bff',6,100); continue; }
      if(d<170){ const a=Math.atan2(e.y-b.y,e.x-b.x); b.dir+=clamp(norm(a-b.dir),-3*dt,3*dt); } } });
  // 거울 벽: 내 탄이 거울에 튕기면 가장 가까운 적에게 꺾고 가속
  if(feat('mirror')&&run.mapWalls) bullets.forEach(b=>{
    if(b.owner==='player'&&b._tl!=null&&b.trail.length<b._tl){ const m=run.mapWalls.find(o=>o.mirror&&rectHit(b.x,b.y,R_BULLET+8,o.col));
      if(m){ let t=null,bd=1e9; ens.forEach(e=>{ const d=dist(e.x,e.y,b.x,b.y); if(d<bd&&!wallBetween(b.x,b.y,e.x,e.y)){ bd=d; t=e; } });
        if(t){ b.dir=Math.atan2(t.y-b.y,t.x-b.x); b.htg=t; } b.spd=Math.min(b.spd*1.15,cap()); b.glow=1; burst(b.x,b.y,'cyan',12,180); I.mirror=(I.mirror||0)+1; } }
    b._tl=b.trail.length; });
  // 패링 반응 시간: 패링 가능해진 순간 → 내 것이 된 순간
  bullets.forEach(b=>{ if(b.owner==='enemy'){ if(b.ready&&b._rt==null) b._rt=run.time; else if(!b.ready&&b._rtd){ b._rt=null; b._rtd=0; } }
    else if(b._rt!=null&&!b._rtd){ (I.rt||(I.rt=[])).push(run.time-b._rt); b._rtd=1; b._rt=null; } });
  if(I.firstQ&&I.firstQ.length){ I.firstQ[0].t-=dt; if(I.firstQ[0].t<=0) I.firstQ.shift(); }
  if(I.streak>=25&&!I.m25){ I.m25=1; missionAdd('streak'); }
};

/* ---- 처치: 랠리 피니시 · 흡수체 폭발 · 보스 러시 · 진동 ---- */
const _killEnemy2=killEnemy;
killEnemy=function(e){
  let fin=null;
  if(feat('finish')&&run&&!run.tut&&e) bullets.forEach(b=>{ if(b.owner==='player'&&b.returns>=5&&dist(b.x,b.y,e.x,e.y)<e.r+R_BULLET+30&&(!fin||b.returns>fin.returns)) fin=b; });
  const r=_killEnemy2.apply(this,arguments);
  if(!run||!e) return r;
  if(e.affix==='분열'){ [-1,1].forEach(o=>spawnEnemyAt('minion',e.x+o*28,e.y)); say('분열','warn'); }   // 접두사 분열: 잡졸 2기
  if(fin){ const bonus=Math.round((G(e).score||50)*0.5*(CFG.scoreMul||1)); run.score+=bonus;
    announce('랠리 피니시 ×'+fin.returns+'  +'+bonus,'warn'); burst(e.x,e.y,'warn',30,320); shake=Math.max(shake,12); missionAdd('rally'); }
  if(e.grade==='absorber'&&e.pAbs){ const bonus=Math.round(GRADES.absorber.eatScore*e.pAbs*(CFG.scoreMul||1)); run.score+=bonus; say('흡수 보너스 +'+bonus,'warn'); }
  if(e.grade==='absorber'&&e.charge>0){ const n=Math.min(24,4+e.charge);
    for(let i=0;i<n;i++){ const a=i/n*TAU, s=CFG.spd*0.8;
      bullets.push({x:e.x+Math.cos(a)*(e.r+8),y:e.y+Math.sin(a)*(e.r+8),dir:a,spd:s,base:s,owner:'enemy',returns:0,boss:0,age:0,trail:[],glow:0,hcd:0,tried:[],ready:false,
        feint:0,orbitDir:0,orbitAmt:0,straight:1,zig:0,fake:0,blink:0,from:'흡수체 폭발',fromAbs:1}); }
    announce('흡수체 폭발 · '+n+'발','red'); shake=Math.max(shake,12); }
  if(e.grade==='boss'){ vib([80,50,160]);
    if(run.rush){ const R=run.rush; R.i++; P.hp=Math.min(CFG.hpMax,P.hp+CFG.hpMax*0.3);
      if(R.i>=4){ const t=run.time-R.t0, B=lsGet('aether_x_rush',{}), rec=B[run.mode]==null||t<B[run.mode]; if(rec){ B[run.mode]=t; lsSet('aether_x_rush',B); }
        R.time=t; R.rec=rec; setTimeout(()=>{ if(run&&run.rush) announce('보스 러시 완료  '+fmtT(t)+(rec?'  ·  최고 기록!':''),'warn'); },1400); } } }
  return r; };

/* ---- 패링 통계 · 진동 ---- */
let exLastParry2=0;
const _sfx2=sfx;
sfx=function(k){ if(k==='parry'&&run&&!run.tut){ const now=performance.now(); if(now-exLastParry2>40){ const I=exRun(); I.par=(I.par||0)+1; vib(12); } exLastParry2=now; }
  return _sfx2.apply(this,arguments); };
const _doParry=doParry;
doParry=function(){ const l0=P.lock; const r=_doParry.apply(this,arguments);
  if(run&&!run.tut&&l0<=0&&P.lockKind==='miss'&&P.lock>0){ const I=exRun(); I.whiff=(I.whiff||0)+1; } return r; };
const _onHurt2=onHurt;
onHurt=function(){ vib(70); return _onHurt2.apply(this,arguments); };

/* ---- 첫 등장 안내 ---- */
const _spawnEnemy2=spawnEnemy;
spawnEnemy=function(grade){ const r=_spawnEnemy2.apply(this,arguments);
  if(feat('first')&&run&&!run.tut&&!run.practice){ const seen=lsGet('aether_x_seen',{});
    if(!seen[grade]){ seen[grade]=1; lsSet('aether_x_seen',seen); const d=DEX2.find(x=>x[0]===grade);
      const I=exRun(); (I.firstQ||(I.firstQ=[])).push({g:grade,d:grade==='boss'?'사이클 마지막 웨이브마다 나오는 보스 — 변형마다 패턴이 다르다.':d?d[1]:'',t:4.5}); } }
  return r; };

/* ---- 일일 미션 ---- */
const MISSIONS=[['parries','패링 150회',150],['kills','적 100기 처치',100],['noHit','피격 없이 웨이브 3번 넘기기',3],
  ['bossKills','보스 1번 격파',1],['rally','랠리 피니시 3번',3],['streak','무피격 연속 패링 25 한 번',1]];
const MREW=300;
function missionDay(){ const d=todayKST(); let M=lsGet('aether_x_mission',null);
  if(!M||M.day!==d){ let s=+d.replace(/-/g,''); const pool=MISSIONS.map(m=>m[0]), list=[];
    while(list.length<3){ s=(s*1103515245+12345)%2147483648; list.push(pool.splice(s%pool.length,1)[0]); }
    M={day:d,list,prog:{},done:{}}; lsSet('aether_x_mission',M); }
  return M; }
function missionAdd(k,n){ if(!feat('mission')||!run||run.tut||run.cheat||run.mode==='daily') return; const M=missionDay(); if(!M.list.includes(k)||M.done[k]) return;
  const def=MISSIONS.find(m=>m[0]===k); M.prog[k]=(M.prog[k]||0)+(n||1);
  if(M.prog[k]>=def[2]){ M.done[k]=1; META.cur+=MREW; save(); setTimeout(()=>{ if(run) announce('일일 미션 완료 — '+def[1]+'  ◆ +'+MREW,'warn'); },600); }
  lsSet('aether_x_mission',M); }
const _stat=stat;
stat=function(k,n){ const off=statOff(); const r=_stat.apply(this,arguments); if(!off&&['parries','kills','noHit','bossKills'].includes(k)) missionAdd(k,n); return r; };
function openMission(){ const M=missionDay();
  $('#modalBox').style.width='min(460px,100%)';
  $('#modalBox').innerHTML='<div class="logHd"><h4>일일 미션 · '+M.day+'</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    M.list.map(k=>{ const def=MISSIONS.find(m=>m[0]===k), v=Math.min(M.prog[k]||0,def[2]), ok=M.done[k];
      return '<div style="border:1px solid var(--line);border-radius:8px;padding:9px 11px;margin-bottom:8px">'+
        '<div style="display:flex;justify-content:space-between;gap:8px"><b style="color:'+(ok?'var(--cyan)':'var(--fg)')+'">'+(ok?'✓ ':'')+def[1]+'</b><span style="color:var(--warn)">◆ '+MREW+'</span></div>'+
        '<div style="height:6px;background:rgba(255,255,255,.08);border-radius:3px;margin:7px 0 3px"><div style="height:100%;width:'+Math.round(v/def[2]*100)+'%;background:var(--cyan);border-radius:3px"></div></div>'+
        '<div style="font-size:11px;color:var(--dim)">'+v+' / '+def[2]+'</div></div>'; }).join('')+
    '<div class="rkNote">한국 시간 0시에 새 미션으로 바뀌어요. 데일리 · 연습장 · 보스 러시 · 디버그를 쓴 판은 세지 않아요.</div>';
  $('#modal').classList.add('on'); }

/* ---- 강화 프리셋 ---- */
const spentNow=()=>{ let t=0; UPG.forEach(u=>{ if(u.phoneOnly) return; for(let i=0;i<u.lv;i++) t+=u.cost[i]||0; }); return t; };
function presetClick(s){ if(!feat('preset')||hubBusy()) return; const all=lsGet('aether_x_preset',{}), p=all[s], now=spentNow();
  const saveIt=()=>{ all[s]={lv:Object.fromEntries(UPG.map(u=>[u.k,u.lv])),sk:[META.skill,META.skillQ,META.skillR],cost:now}; lsSet('aether_x_preset',all); sfx('ui'); };
  const loadIt=()=>{ if(p.cost>now+META.cur){ setTimeout(()=>askConfirm('재화가 모자라요','프리셋 '+s+'는 ◆ '+p.cost.toLocaleString()+' 어치인데, 지금 강화를 다 돌려받아도 ◆ '+(now+META.cur).toLocaleString()+'이에요.','확인',()=>{}),0); return; }
    UPG.forEach(u=>{ if(!u.phoneOnly) u.lv=p.lv[u.k]||0; }); META.skill=p.sk[0]; META.skillQ=p.sk[1]; META.skillR=p.sk[2]; META.cur+=now-p.cost; save();
    $('#cur').textContent=META.cur.toLocaleString(); renderCards(); renderDetail(); renderSkillSel(); renderRecs(); sfx('heal'); };
  if(!p) askConfirm('프리셋 '+s+' 비어 있음','지금 찍은 강화(◆ '+now.toLocaleString()+' 어치)와 장착 스킬을 프리셋 '+s+'에 저장할까요?','저장',saveIt);
  else askConfirm('프리셋 '+s,'저장된 빌드: ◆ '+p.cost.toLocaleString()+' 어치\n지금 빌드: ◆ '+now.toLocaleString()+' 어치\n\n불러오면 지금 강화는 전부(100%) 돌려받고 프리셋으로 바꿔 끼워요.','불러오기',loadIt,'지금 빌드로 덮어쓰기',saveIt); }
{ const rb=$('#respec'); if(rb){ let prev=rb; ['A','B'].forEach(s=>{ const b=document.createElement('button'); b.id='exPre'+s; b.className='exBtn'; b.textContent='프리셋 '+s;
  b.title='강화 빌드 저장 · 불러오기'; b.style.marginLeft='6px'; b.onclick=()=>presetClick(s); prev.after(b); prev=b; }); } }

/* ---- 마지막 5초 리플레이: 8fps로 40장을 돌려 가며 저장 ---- */
const RP={frames:[],i:0,last:0,w:480,h:0,n:40};
const _render=render;
render=function(){ _render();
  if(!feat('replay')||!run||screen!=='game'||paused||OPT.lowfx) return; const now=performance.now(); if(now-RP.last<125) return; RP.last=now;
  if(!RP.h) RP.h=Math.round(RP.w*gcv.height/Math.max(1,gcv.width));
  let c=RP.frames[RP.i]; if(!c){ c=document.createElement('canvas'); c.width=RP.w; c.height=RP.h; RP.frames[RP.i]=c; }
  const cx=c.getContext('2d'); cx.fillStyle='#0a0e13'; cx.fillRect(0,0,RP.w,RP.h); cx.drawImage(gcv,0,0,RP.w,RP.h); c._t=now; c._run=run; RP.i=(RP.i+1)%RP.n; };
let rpTimer=null;
function openReplay(r){ const fr=RP.frames.filter(c=>c&&c._run===r).sort((a,b)=>a._t-b._t); if(!fr.length) return;
  $('#modalBox').style.width='min(560px,100%)';
  $('#modalBox').innerHTML='<div class="logHd"><h4>마지막 5초</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<canvas id="exRp" width="'+RP.w+'" height="'+RP.h+'" style="width:100%;border-radius:6px;background:#000"></canvas>'+
    '<div style="display:flex;gap:8px;margin-top:8px;align-items:center"><button class="exBtn" id="exRpSave">영상 저장 (.webm)</button><span id="exRpSt" style="color:var(--dim);font-size:11.5px"></span></div>';
  $('#modal').classList.add('on'); const cv=$('#exRp'), cx=cv.getContext('2d'); let k=0;
  clearInterval(rpTimer); rpTimer=setInterval(()=>{ if(!$('#modal').classList.contains('on')||!document.body.contains(cv)){ clearInterval(rpTimer); return; }
    cx.drawImage(fr[k%fr.length],0,0); k++; },125);
  $('#exRpSave').onclick=()=>{ if(!window.MediaRecorder||!cv.captureStream){ $('#exRpSt').textContent='이 브라우저는 영상 저장을 못 해요'; return; }
    const rec=new MediaRecorder(cv.captureStream(8),{mimeType:'video/webm'}), parts=[]; k=0; $('#exRpSt').textContent='녹화 중…';
    rec.ondataavailable=e=>parts.push(e.data); rec.onstop=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(parts,{type:'video/webm'}));
      a.download='aether-last5s.webm'; a.click(); $('#exRpSt').textContent='저장했어요'; };
    rec.start(); setTimeout(()=>rec.stop(),fr.length*125+200); }; }

/* ---- 결과 화면 추가: 패링 통계 · 리플레이 · 보스 러시 ---- */
const _endRun2=endRun;
endRun=function(){
  if(run&&run.practice){ P.hp=CFG.hpMax; P.inv=1.5; announce('연습 — 체력 회복','cyan'); return; }
  const r=run, out=_endRun2.apply(this,arguments), I=r&&r.ex, more=$('#exMore');
  if(more&&I){ let h='';
    if(feat('pstat')){ const par=I.par||0, wh=I.whiff||0, rt=I.rt||[], avg=rt.length?rt.reduce((a,b)=>a+b,0)/rt.length:0;
      h+='<div style="color:var(--dim)">패링 <b style="color:var(--fg)">'+par+'</b>회 · 빗나감 <b style="color:var(--fg)">'+wh+'</b>회 · 성공률 <b style="color:var(--cyan)">'+(par+wh?Math.round(par/(par+wh)*100):0)+'%</b>'+
        (rt.length?' · 평균 반응 <b style="color:var(--fg)">'+avg.toFixed(2)+'초</b>':'')+'</div>'; }
    if(r.rush) h+='<div style="color:var(--dim)">보스 러시 — '+(r.rush.time!=null?'<b style="color:var(--warn)">완주 '+fmtT(r.rush.time)+'</b>'+(r.rush.rec?' · 최고 기록':''):'<b style="color:var(--fg)">'+r.rush.i+' / 4</b>에서 쓰러짐')+'</div>';
    if(I.mirror) h+='<div style="color:var(--dim)">거울로 꺾은 탄 — <b style="color:var(--cyan)">'+I.mirror+'</b></div>';
    if(feat('replay')&&RP.frames.some(c=>c&&c._run===r)) h+='<button id="exRpBtn" style="margin-top:8px;margin-right:6px;background:transparent;border:1px solid var(--cyan);color:var(--cyan);border-radius:6px;padding:6px 14px;font:700 12px ui-monospace,monospace;cursor:pointer">마지막 5초 보기</button>';
    more.innerHTML=h; const b=$('#exRpBtn'); if(b) b.onclick=()=>openReplay(r); }
  return out; };

/* ---- 패링 목표 미리보기 (설정 "패링 목표 미리보기", 기본 꺼짐) ---- */
const _drawZone=drawZone;
drawZone=function(){ _drawZone();
  if(!OPT.aimPrev||!run||!bullets.some(b=>b.ready)||(P.lock>0&&P.lockKind!=='ok')) return;
  const ang=e=>angDiff(P.face,Math.atan2(e.y-P.y,e.x-P.x));
  const soft=ens.filter(e=>!G(e).shield&&!wallBetween(P.x,P.y,e.x,e.y)).sort((a,b)=>ang(a)-ang(b)||dist(a.x,a.y,P.x,P.y)-dist(b.x,b.y,P.x,P.y));
  const tgt=soft.length&&ang(soft[0])<=(touchMode?100:24)*Math.PI/180?soft[0]:null, p=proj(P.x,P.y);
  ctx.save(); ctx.setLineDash([7,7]); ctx.lineDashOffset=-performance.now()/30; ctx.lineWidth=2; ctx.strokeStyle=C.cyan;
  if(tgt){ const q=proj(tgt.x,tgt.y); ctx.globalAlpha=.8; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke();
    ctx.setLineDash([]); ctx.beginPath(); ctx.ellipse(q[0],q[1],tgt.r+12,(tgt.r+12)*SQUASH,0,0,TAU); ctx.stroke(); }
  else { ctx.globalAlpha=.3; ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[0]+Math.cos(P.face)*150,p[1]+Math.sin(P.face)*150*SQUASH); ctx.stroke(); }
  ctx.restore(); };

/* ---- 위험 계약: 클리어 직후 T ---- */
document.addEventListener('keydown',e=>{ if(e.code!=='KeyT'||e.repeat||!run||!run.riskOffer||screen!=='game'||paused) return;
  run.riskOffer=0; run.riskNext=1; say('위험 계약 수락','warn'); sfx('ui'); });

/* ---- 그리기: 흡수체 · 첫 등장 · 위험 계약 · 연습장 / 보스 러시 줄 ---- */
const _drawEnemyBody2=drawEnemyBody;
drawEnemyBody=function(e){ _drawEnemyBody2(e); if(e.grade!=='absorber') return; const p=proj(e.x,e.y);
  ctx.save(); ctx.strokeStyle='#c7a6ff'; ctx.lineWidth=2;
  for(let k=0;k<3;k++){ const a=(e.spin||0)+k*TAU/3; ctx.beginPath(); ctx.ellipse(p[0],p[1],e.r+6,(e.r+6)*SQUASH,0,a,a+1.3); ctx.stroke(); }
  ctx.globalAlpha=.35; ctx.setLineDash([3,6]); ctx.beginPath(); ctx.ellipse(p[0],p[1],170,170*SQUASH,0,0,TAU); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1;
  if(e.charge){ ctx.fillStyle='#fff'; ctx.font='800 13px ui-monospace,monospace'; ctx.textAlign='center'; ctx.fillText(e.charge,p[0],p[1]+5); }
  ctx.restore(); };
const _drawHUD2=drawHUD;
drawHUD=function(){ _drawHUD2(); if(!run) return; const W=VW, I=run.ex;
  if(run.practice||run.rush){ ctx.textAlign='left'; ctx.font='700 12px ui-monospace,monospace'; ctx.fillStyle=C.warn;
    ctx.fillText(run.practice?'연습장 · 기록 · 재화 없음 · ESC → HUB로 나가기':'보스 러시 '+Math.min(4,run.rush.i+1)+' / 4 · '+(run.rush.t0!=null?fmtT(run.time-run.rush.t0):'0:00.0'),18,run.revives>0?76:60); }
  if(run.riskOffer){ const t='T  위험 계약 — 다음 웨이브 적 ×1.5 · 버티면 보상 1개 더  ('+Math.max(0,run.phaseT).toFixed(1)+')';
    ctx.font='700 14px ui-monospace,monospace'; ctx.textAlign='center'; const w=ctx.measureText(t).width+28, y=H*0.72;
    ctx.fillStyle='rgba(40,8,14,.88)'; ctx.fillRect(W/2-w/2,y-20,w,32); ctx.strokeStyle=C.red; ctx.lineWidth=1.5; ctx.strokeRect(W/2-w/2,y-20,w,32);
    ctx.fillStyle='#ffd0d8'; ctx.fillText(t,W/2,y+1); }
  if(I&&I.firstQ&&I.firstQ.length){ const f=I.firstQ[0], a=Math.min(1,f.t*2,(4.5-f.t)*4), img=SPRITES[f.g], x=18, y=H-96;
    ctx.font='600 11.5px ui-monospace,monospace'; const w=Math.min(W-36,Math.max(300,ctx.measureText(f.d).width+64));
    ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='rgba(8,12,17,.9)'; ctx.fillRect(x,y,w,46); ctx.strokeStyle=C.cyan; ctx.lineWidth=1; ctx.strokeRect(x+.5,y+.5,w-1,45);
    if(img) ctx.drawImage(img,x+6,y+5,36,36);
    ctx.textAlign='left'; ctx.fillStyle=C.cyan; ctx.font='700 12px ui-monospace,monospace'; ctx.fillText('처음 보는 적 · '+(KO[f.g]||f.g),x+50,y+19);
    ctx.fillStyle=C.fg; ctx.font='600 11.5px ui-monospace,monospace'; ctx.fillText(f.d,x+50,y+36); ctx.restore(); } };

/* ---- 타이틀 버튼: 연습장 · 보스 러시 · 일일 미션 ---- */
function openPractice(){ const list=DEX2.filter(x=>x[0]!=='illusion'&&x[0]!=='splinter'&&x[0]!=='minion');
  const key=x=>x[0].indexOf('boss_')===0?'boss:'+x[0].slice(5):x[0]==='boss'?'boss:core':x[0];
  $('#modalBox').style.width='min(560px,100%)';
  $('#modalBox').innerHTML='<div class="logHd"><h4>연습장 · 상대할 적 고르기</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px">'+list.map(x=>{ const k=key(x), img=SPRITES[x[0]];
      return '<button class="exBtn" data-prac="'+k+'" style="display:flex;align-items:center;gap:6px;padding:6px 8px;text-align:left">'+(img?'<img src="'+img.src+'" style="width:26px;height:26px;object-fit:contain">':'<span style="width:26px"></span>')+
        '<span>'+(x[0].indexOf('boss')===0?VKO[k.split(':')[1]]:KO[x[0]])+'</span></button>'; }).join('')+'</div>'+
    '<div class="rkNote">쓰러져도 체력이 다시 차요. 기록 · 재화 · 미션에 안 들어가요. ESC → HUB로 나가기로 끝내요.</div>';
  $('#modal').classList.add('on');
  $('#modalBox').querySelectorAll('[data-prac]').forEach(b=>b.onclick=()=>exStart({practice:{g:b.dataset.prac}})); }
const titleBtns=[['exPrac','연습장','practice',openPractice],['exRush','보스 러시','rush',()=>exStart({rush:{i:0,t0:null}})],['exMis','일일 미션','mission',openMission]];
let anchor=$('#exDex')||document.querySelector('#title [data-modal=stats]');
titleBtns.forEach(([id,label,k,fn])=>{ const b=document.createElement('button'); b.id=id; b.textContent=label; b.onclick=()=>{ if(feat(k)) fn(); }; anchor.after(b); anchor=b; });
}

"use strict";
/* ================= DEV 패널 ================= */
const SPECS=[
 {k:'rangeM',lab:'패링 사거리',min:2,max:12,step:.5,dec:1,u:' m'},
 {k:'fov',lab:'패링 시야',min:20,max:180,step:5,dec:0,u:'°'},
 {k:'whiff',lab:'빗나감 페널티',min:0,max:1.5,step:.05,dec:2,u:' s'},
 {k:'dwell',lab:'최소 체류시간',min:.15,max:1.2,step:.05,dec:2,u:' s'},
 {k:'spd',lab:'탄환 기본 속도',min:120,max:500,step:10,dec:0,u:' px/s'},
 {k:'accel',lab:'왕복당 가속',min:1,max:1.6,step:.02,dec:2,u:' ×'},
 {k:'seizeMul',lab:'적 재탈취 확률 배율',min:0,max:2,step:.1,dec:1,u:' ×'},
 {k:'fire',lab:'적 발사 간격',min:.4,max:4,step:.1,dec:1,u:' s'},
 {k:'maxB',lab:'동시 탄환 상한',min:1,max:12,step:1,dec:0,u:' 발'},
 {k:'multi',lab:'다중 패링',min:1,max:3,step:1,dec:0,u:' 발'},
 /* v2.36 디버그 패널에 빠져 있던 항목 */
 {k:'homing',lab:'유도 보정',min:0,max:5,step:.2,dec:1,u:''},
 {k:'rNeed',lab:'R 필요 충전',min:10,max:200,step:10,dec:0,u:''},
 {k:'empDur',lab:'해킹 지속',min:0,max:5,step:.1,dec:1,u:' s'},
 {k:'healAmt',lab:'회복량',min:0,max:120,step:5,dec:0,u:''},
 {k:'guardDur',lab:'방어막 지속',min:0,max:6,step:.1,dec:1,u:' s'},
 {k:'phaseDur',lab:'위상 이동 지속',min:0,max:8,step:.1,dec:1,u:' s'},
 {k:'wallMax',lab:'벽 최대 수',min:0,max:8,step:1,dec:0,u:' 개'},
 {k:'gainMul',lab:'재화 배율',min:1,max:3,step:.1,dec:1,u:' ×'}
];
const TOGS=[{k:'bounce',on:'충돌: 반사',off:'충돌: 소멸'},
            {k:'god',on:'무적: 켬',off:'무적: 끔'},
            {k:'fastwave',on:'웨이브 가속: 켬',off:'웨이브 가속: 끔'}];
(function build(){
  const g=$('#grid');
  SPECS.forEach(sp=>{
    const d=document.createElement('div');d.className='row';
    d.innerHTML='<div class="lab"><span>'+sp.lab+'</span><b id="v_'+sp.k+'"></b></div>'+
      '<div class="ctl"><button class="stp" data-k="'+sp.k+'" data-d="-1">−</button>'+
      '<input type="range" id="s_'+sp.k+'" min="'+sp.min+'" max="'+sp.max+'" step="'+sp.step+'">'+
      '<button class="stp" data-k="'+sp.k+'" data-d="1">+</button></div>';
    g.appendChild(d);
  });
  g.addEventListener('input',e=>{
    if(e.target.tagName!=='INPUT')return;
    CFG[e.target.id.slice(2)]=parseFloat(e.target.value);syncUI();
  });
  g.addEventListener('click',e=>{
    const b=e.target.closest('.stp');if(!b)return;
    const sp=SPECS.find(x=>x.k===b.dataset.k);
    CFG[sp.k]=clamp(Math.round((CFG[sp.k]+(+b.dataset.d)*sp.step)/sp.step)*sp.step,sp.min,sp.max);
    syncUI();
  });
  const t=$('#toggles');
  TOGS.forEach(tg=>{const b=document.createElement('button');b.id='t_'+tg.k;b.dataset.k=tg.k;t.appendChild(b);});
  t.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    CFG[b.dataset.k]=CFG[b.dataset.k]?0:1;syncUI();
  });
})();
/* v2.63 폰 버튼 위치 적용 */
/* v2.81 예전 한 개짜리 조이스틱 고정 설정은 둘 다 켠 것으로 옮긴다 */
if(OPT.fixedSticks){ OPT.fixMove=1; OPT.fixAim=1; OPT.fixedSticks=0; }
/* v2.81 조이스틱 자리 편집 — 게임 화면 위에서 두 원을 끌어 옮기고 완료하면 저장 */
function openStickEdit(){
  let box=document.getElementById('stickEdit');
  if(!box){ box=document.createElement('div'); box.id='stickEdit';
    box.innerHTML='<div class="se-note">원과 버튼을 끌어서 자리를 옮기세요 · 스킬 버튼을 옮기지 않으면 패링 조이스틱을 따라가요</div>'+
      '<div class="se-dot mv" data-k="move">이동</div><div class="se-dot am" data-k="aim">패링</div>'+
      '<div class="se-dot sk" data-k="F">F</div><div class="se-dot sk" data-k="Q">Q</div><div class="se-dot sk" data-k="R">R</div>'+   // v3.13
      '<div class="se-btns"><button id="seReset">기본 자리</button><button id="seDone" class="go">완료</button></div>';
    document.body.appendChild(box);
    const st=box._st={drag:null,pos:null,fr:null,sc:1};
    st.place=()=>box.querySelectorAll('.se-dot').forEach(d=>{ const k=d.dataset.k, sk=SKILL_KEYS.includes(k);
      if(sk&&!OPT.skillRing){ d.style.display='none'; return; } d.style.display='';
      const c=sk?(st.skill[k]||skillDefaultPos(k,st.pos.aim)):st.pos[k];
      if(!sk) d.style.width=d.style.height=(TOUCH_MAX*2*st.sc)+'px';
      d.style.left=(st.fr.left+(c[0]+OFX)*st.sc)+'px'; d.style.top=(st.fr.top+c[1]*st.sc)+'px'; });
    box.querySelectorAll('.se-dot').forEach(d=>d.addEventListener('pointerdown',e=>{ st.drag=d.dataset.k; try{ d.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); }));
    box.addEventListener('pointermove',e=>{ if(!st.drag) return;
      if(SKILL_KEYS.includes(st.drag)){   // v3.13 스킬 버튼 — 화면 안 어디든
        const x=clamp((e.clientX-st.fr.left)/st.sc-OFX, 30-OFX, W+OFX-30), y=clamp((e.clientY-st.fr.top)/st.sc, 50, H-30);
        st.skill[st.drag]=[Math.round(x),Math.round(y)]; st.place(); return; }
      const x=clamp((e.clientX-st.fr.left)/st.sc-OFX, TOUCH_MAX+6-OFX, W+OFX-TOUCH_MAX-6), y=clamp((e.clientY-st.fr.top)/st.sc, TOUCH_MAX+40, H-TOUCH_MAX-6);
      st.pos[st.drag]=[Math.round(x),Math.round(y)]; st.place(); });
    const end=()=>{ st.drag=null; }; box.addEventListener('pointerup',end); box.addEventListener('pointercancel',end);
    box.querySelector('#seReset').addEventListener('click',()=>{ OPT.posMove=null; OPT.posAim=null; OPT.posSkill=null; st.skill={}; st.pos={move:fixCenter('move').slice(),aim:fixCenter('aim').slice()}; st.place(); sfx('ui'); });
    box.querySelector('#seDone').addEventListener('click',()=>{
      OPT.posMove=null; OPT.posAim=null; const dm=fixCenter('move'), da=fixCenter('aim');
      OPT.posMove=(st.pos.move[0]!==dm[0]||st.pos.move[1]!==dm[1])?st.pos.move:null;
      OPT.posAim=(st.pos.aim[0]!==da[0]||st.pos.aim[1]!==da[1])?st.pos.aim:null;
      OPT.posSkill=Object.keys(st.skill).length?Object.assign({},st.skill):null;   // v3.13 옮긴 버튼만 저장 (나머지는 조이스틱을 따라감)
      save(); ringKey=''; box.classList.remove('on'); sfx('ui'); optTab='ctrl'; openModal(); });
  }
  fitCanvas(); const st=box._st; st.fr=$('#frame').getBoundingClientRect(); st.sc=st.fr.width/VW;
  st.pos={move:fixCenter('move').slice(), aim:fixCenter('aim').slice()}; st.drag=null;
  st.skill=Object.assign({},OPT.posSkill||{});   // v3.13
  st.place(); box.classList.add('on');
}
function applyPadPos(){ ['top','right','left'].forEach(p=>document.body.classList.toggle('pads-'+p,OPT.padPos===p));
  document.body.classList.toggle('ring-on',!!OPT.skillRing); }   // v2.79
function syncUI(){
  applyPadPos(); syncModeUI();   // v2.68
  SPECS.forEach(sp=>{
    const v=$('#v_'+sp.k),s=$('#s_'+sp.k);
    if(v)v.textContent=Number(CFG[sp.k]).toFixed(sp.dec)+sp.u;
    if(s)s.value=CFG[sp.k];
  });
  TOGS.forEach(tg=>{const b=$('#t_'+tg.k);if(b){b.textContent=CFG[tg.k]?tg.on:tg.off;b.classList.toggle('on',!!CFG[tg.k]);}});
  const c=cap(),ok=c>CFG.spd;
  const n=CFG.accel>1.0001?Math.ceil(Math.log(c/CFG.spd)/Math.log(CFG.accel)):Infinity;
  $('#derived').innerHTML='<b>탄속 상한</b> = 사거리 ÷ 최소 체류시간 = '+Math.round(c)+' px/s'+
    (ok?'':' <span style="color:var(--red)">(기본 속도보다 낮음 — 반응 불가)</span>')+
    ' · <b>상한 도달</b> ≈ '+(ok&&isFinite(n)?n+'회 왕복':'—')+
    ' · <b>재탈취 확률</b> 잡몹 25% / 엘리트 45% / 보스 60% (빠를수록 ↓)';
}

const BOT={on:false,left:0,speed:3,skill:1,runs:[],cur:null,readyT:0,react:0.1,rwT:0,mv:null,idx:0,snap:null,cfg:{n:6,speed:3,skill:1,build:'max'}};
const BOT_PICK={multi:10,flow:9,grit:9,s_homing:9,s_revive:9,pierce:8,s_boss:8,accel:7,stable:7,overload:7,leech:7,shard:6,aftershock:6,vital:6,range:6,s_revhp:6,fov:5,calm:5,iframe:5,move:4,greed:3,reroll:2};
const skName=k=>{ const u=UPG.find(x=>x.k===k); return u?u.n.replace(/^[FQR] · /,''):'없음'; };
function botSnapshot(){ BOT.snap={lv:UPG.map(u=>u.lv),skill:META.skill,q:META.skillQ,r:META.skillR,cur:META.cur}; }
function botRestore(){ if(!BOT.snap) return; UPG.forEach((u,i)=>u.lv=BOT.snap.lv[i]); META.skill=BOT.snap.skill; META.skillQ=BOT.snap.q; META.skillR=BOT.snap.r; META.cur=BOT.snap.cur; BOT.snap=null; window.__botTemp=false; save(); }
function botPrep(){
  if(BOT.cfg.build!=='max') return;
  UPG.forEach(u=>u.lv=u.max);
  const F=UPG.filter(u=>u.skill===1).map(u=>u.k), Q=UPG.filter(u=>u.skill==='q').map(u=>u.k), Rr=UPG.filter(u=>u.skill==='r').map(u=>u.k), i=BOT.idx;
  META.skill=F[i%F.length]; META.skillQ=Q[i%Q.length]; let r=Rr[i%Rr.length]; if(META.skillQ==='frost'&&r==='blaze') r=Rr[(i+1)%Rr.length]; META.skillR=r;
}
function botReact(){ return BOT.skill?0.04+Math.random()*0.1:0.12+Math.random()*0.2; }
function botNewRun(){ BOT.cur={att:0,ok:0,dmg:0,hits:0,lastHp:P.hp,enemyWall:0,bulletWall:0,pierce:0,fUse:0,qUse:0,rUse:0,stalls:[],wk:'',wt:0,hideT:0,wp:null,wpT:0,sE:new WeakSet(),sB:new WeakSet(),sP:new WeakSet(),own:new WeakMap()}; BOT.readyT=0; BOT.react=botReact(); BOT.rwT=0; BOT.mv=null; }
function botStart(){
  BOT.on=true; BOT.left=BOT.cfg.n; BOT.speed=BOT.cfg.speed; BOT.skill=BOT.cfg.skill; BOT.runs=[]; BOT.idx=0;
  if(BOT.cfg.build==='max'){ if(!BOT.snap) botSnapshot(); window.__botTemp=true; }
  botPrep();
  $('#modal').classList.remove('on'); startRun(OPT.mode||'normal'); botNewRun(); announce('테스트 봇 시작','warn');
}
function botTick(dt){
  if(!run||run.tut) return;
  if(!BOT.cur) botNewRun();
  const c=BOT.cur;
  if(run.phase==='reward'){
    const now=performance.now();
    if(!BOT.rwAt){ BOT.rwAt=now; BOT.rwPick=null; }
    if(BOT.rwPick==null&&now-BOT.rwAt>700){ let bi=0, bs=-1; rwPicks.forEach((b,i)=>{ const s=(BOT_PICK[b.look||b.k]||(b.chaos?5:4))+Math.random()*0.5; if(s>bs){ bs=s; bi=i; } }); BOT.rwPick=bi;
      const el=document.querySelector('#rwRow .bc[data-i="'+bi+'"]'); if(el) el.classList.add('botpick'); }
    if(BOT.rwPick!=null&&now-BOT.rwAt>1500){ const b=rwPicks[BOT.rwPick]; BOT.rwAt=0; const i=BOT.rwPick; BOT.rwPick=null; takeReward(i); if(b) announce('봇 선택 — '+b.n,'warn'); }
    return; }
  BOT.rwAt=0;
  if(P.hp<c.lastHp){ c.dmg+=c.lastHp-P.hp; c.hits++; } c.lastHp=P.hp;
  const Rg=range(), threats=bullets.filter(b=>b.owner==='enemy');
  let tb=null, td=1e9;
  threats.forEach(b=>{ const d=dist(b.x,b.y,P.x,P.y); if(d<td&&d<Rg*2.2&&Math.cos(b.dir-Math.atan2(P.y-b.y,P.x-b.x))>0){ td=d; tb=b; } });
  const ne=ens.slice().sort((a,b)=>dist(a.x,a.y,P.x,P.y)-dist(b.x,b.y,P.x,P.y))[0];
  if(tb) P.face=Math.atan2(tb.y-P.y,tb.x-P.x); else if(ne) P.face=Math.atan2(ne.y-P.y,ne.x-P.x);
  if(parryReady()&&P.lock<=0){ BOT.readyT+=dt; if(BOT.readyT>=BOT.react){ c.att++; doParry(true); if(P.lockKind==='ok') c.ok++; BOT.readyT=0; BOT.react=botReact(); } } else BOT.readyT=0;
  let mx=0, my=0;
  threats.forEach(b=>{ const d=dist(b.x,b.y,P.x,P.y); if(d>260||(b===tb&&d<Rg)) return; const to=Math.atan2(P.y-b.y,P.x-b.x); if(Math.cos(b.dir-to)<0.3) return;
    if(!b.botSide) b.botSide=Math.sin(b.dir-to)>0?1:-1; const side=b.botSide, w=(260-d)/260; mx+=Math.cos(b.dir+side*Math.PI/2)*w*1.4; my+=Math.sin(b.dir+side*Math.PI/2)*w*1.4; });
  if(ne){ const d=dist(ne.x,ne.y,P.x,P.y), a=Math.atan2(P.y-ne.y,P.x-ne.x), k=d<220?(220-d)/220:(d>420?-(d-420)/400:0); mx+=Math.cos(a)*k; my+=Math.sin(a)*k; }
  mx+=(WORLD.w/2-P.x)/WORLD.w*0.8; my+=(WORLD.h/2-P.y)/WORLD.h*0.8;
  allWalls().forEach(({col:o})=>{ const cx=clamp(P.x,o.x,o.x+o.w), cy=clamp(P.y,o.y,o.y+o.h), d=Math.hypot(P.x-cx,P.y-cy); if(d<70&&d>0){ mx+=(P.x-cx)/d*(70-d)/70*1.5; my+=(P.y-cy)/d*(70-d)/70*1.5; } });
  const vis=ne&&!wallBetween(P.x,P.y,ne.x,ne.y);
  if(ne&&!vis&&!ens.some(e=>!wallBetween(P.x,P.y,e.x,e.y))) c.hideT+=dt; else c.hideT=0;
  if(c.wpT>0){ c.wpT-=dt; const a=Math.atan2(c.wp[1]-P.y,c.wp[0]-P.x); mx+=Math.cos(a)*2.5; my+=Math.sin(a)*2.5; }
  else if(c.hideT>1.2&&ne){ c.wp=[clamp(ne.x+(Math.random()-0.5)*360,60,WORLD.w-60),clamp(ne.y+(Math.random()-0.5)*360,60,WORLD.h-60)]; c.wpT=1.8; c.hideT=0; }
  if(!c.sp){ c.sp=[P.x,P.y]; c.spT=0; }
  c.spT+=dt; if(c.spT>1.2){ if(Math.hypot(P.x-c.sp[0],P.y-c.sp[1])<25&&!(c.wpT>0)&&BOT.mv&&Math.hypot(BOT.mv[0],BOT.mv[1])>0.3){
      for(let k=0;k<12;k++){ const x=80+Math.random()*(WORLD.w-160), y=80+Math.random()*(WORLD.h-160);
        if(!allWalls().some(({col:o})=>rectHit(x,y,R_PLAYER+30,o))){ c.wp=[x,y]; c.wpT=1.5; break; } } }
    c.sp=[P.x,P.y]; c.spT=0; }
  const ml=Math.hypot(mx,my), tx=ml>0.15?mx/ml:0, ty=ml>0.15?my/ml:0, pv=BOT.mv||[0,0], kk=Math.min(1,dt*6);
  let sx=pv[0]+(tx-pv[0])*kk, sy=pv[1]+(ty-pv[1])*kk; const sl=Math.hypot(sx,sy);
  BOT.mv=sl>0.2?[sx/Math.max(1,sl),sy/Math.max(1,sl)]:[0,0];
  const wk=run.cycle+'-'+run.wave; if(c.wk!==wk){ c.wk=wk; c.wt=0; c.stallNoted=false; } else if(run.phase==='fight') c.wt+=dt;
  if(c.wt>90&&!c.stallNoted){ c.stallNoted=true; c.stalls.push('사이클 '+run.cycle+' 웨이브 '+run.wave+' — 남은 적 '+(ens.map(e=>e.grade).join(', ')||'없음')); }
  if(c.wt>180&&P.hp>0){ c.wt=0; run.revives=0; P.inv=0; P.hp=0; }
  if(run.phase==='fight'){
    if(CFG.skill&&P.skillCd<=0){ const near=threats.filter(b=>dist(b.x,b.y,P.x,P.y)<160).length;
      if(CFG.skill==='heal'?P.hp<CFG.hpMax*0.55:(near>=3||P.hp<CFG.hpMax*0.4)){ doSkill(); c.fUse++; } }
    if(CFG.qSkill&&CFG.qSkill!=='wall'&&P.wallCd<=0&&ens.length&&Math.random()<dt*0.5){ doQ(); c.qUse++; }
    if(CFG.skillR&&P.rChg>=CFG.rNeed&&(threats.length>=3||CFG.skillR==='autoparry'||CFG.skillR==='blaze')){ doR(); c.rUse++; }
  }
  allWalls().forEach(({col:o})=>{
    ens.forEach(e=>{ if(!c.sE.has(e)&&e.x>o.x+4&&e.x<o.x+o.w-4&&e.y>o.y+4&&e.y<o.y+o.h-4){ c.sE.add(e); c.enemyWall++; } });
    bullets.forEach(b=>{ if(!c.sB.has(b)&&b.x>o.x+2&&b.x<o.x+o.w-2&&b.y>o.y+2&&b.y<o.y+o.h-2){ c.sB.add(b); c.bulletWall++; } });
  });
  bullets.forEach(b=>{ if(b.owner!=='player') return; const o=c.own.get(b); if(!o||o.r!==b.returns){ c.own.set(b,{r:b.returns,t:run.time}); return; }
    const dt2=run.time-o.t; if(dt2>0.05&&dt2<0.4&&!c.sP.has(b)&&dist(b.x,b.y,P.x,P.y)<R_PLAYER*0.6){ c.sP.add(b); c.pierce++; } });
}
function botRunEnd(){
  const c=BOT.cur||{}; BOT.cur=null;
  BOT.runs.push({cycle:run.cycle,wave:run.wave,score:run.score,kills:run.kills,time:run.time,att:c.att||0,ok:c.ok||0,dmg:Math.round(c.dmg||0),hits:c.hits||0,
    enemyWall:c.enemyWall||0,bulletWall:c.bulletWall||0,pierce:c.pierce||0,fUse:c.fUse||0,qUse:c.qUse||0,rUse:c.rUse||0,stalls:c.stalls||[],stallN:(c.stalls||[]).length,
    build:skName(META.skill)+' · '+skName(META.skillQ)+' · '+skName(META.skillR),boons:Object.keys(run.boons||{}).map(k=>{ const b=boonDef(k); return b?b.n+(run.boons[k]>1?'×'+run.boons[k]:''):k; }).join(', ')});
  BOT.left--; BOT.idx++;
  if(BOT.on&&BOT.left>0) setTimeout(()=>{ if(!BOT.on) return; botPrep(); startRun(); botNewRun(); },1200);
  else { BOT.on=false; if(window.__botTemp) botRestore(); setTimeout(botReport,700); }
}
function botReport(){
  const R=BOT.runs; if(!R.length) return;
  const sum=k=>R.reduce((a,r)=>a+r[k],0), avg=k=>sum(k)/R.length, att=sum('att'), ok=sum('ok');
  const bad=sum('enemyWall')+sum('bulletWall')+sum('pierce')+sum('stallN'), stalls=[].concat(...R.map((r,i)=>r.stalls.map(x=>(i+1)+'판 · '+x)));
  $('#modalBox').innerHTML='<div class="logHd"><h4>테스트 봇 리포트 · '+R.length+'판</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div class="rkNote">평균 점수 '+Math.round(avg('score')).toLocaleString()+' · 평균 처치 '+avg('kills').toFixed(1)+' · 평균 '+Math.round(avg('time'))+'초 · 패링 '+att+'번 (막힘 '+(att-ok)+') · 피격 '+sum('hits')+'회<br>'+
    '평균 받은 피해 '+Math.round(avg('dmg'))+' · 스킬 사용 F '+sum('fUse')+' · Q '+sum('qUse')+' · R '+sum('rUse')+'</div>'+
    '<div class="rkNote" style="color:'+(bad?'var(--red)':'var(--cyan)')+'">이상 현상 — 벽 속 적 '+sum('enemyWall')+' · 벽 속 탄 '+sum('bulletWall')+' · 패링 직후 나를 뚫은 탄 '+sum('pierce')+' · 웨이브 정체 '+sum('stallN')+(bad?'':' (문제 없음)')+(stalls.length?'<br>'+stalls.map(escH).join('<br>'):'')+'</div>'+
    '<ul class="rkList">'+R.map((r,i)=>'<li style="flex-wrap:wrap"><span class="no">'+(i+1)+'</span><span class="nm">사이클 '+r.cycle+' · 웨이브 '+r.wave+' · '+Math.round(r.time)+'초</span><span class="sc">'+r.score.toLocaleString()+'</span><span class="cw">패링 '+r.att+' · 피해 '+r.dmg+'</span>'+
      '<span style="flex-basis:100%;padding-left:34px;color:var(--dim);font-size:10.5px">'+escH(r.build)+(r.boons?' · 증강: '+escH(r.boons):'')+'</span></li>').join('')+'</ul>'+
    '<div class="optTabs"><button data-bot="again">같은 설정으로 다시</button><button data-bot="panel">설정 바꾸기</button></div>';
  $('#modal').classList.add('on');
}
function openBotPanel(){
  const cf=BOT.cfg, tab=(attr,v,label,cur)=>'<button data-'+attr+'="'+v+'" class="'+(cur===v?'on':'')+'">'+label+'</button>';
  $('#modalBox').innerHTML='<div class="logHd"><h4>테스트 봇</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div class="rkNote">봇이 알아서 플레이하고 끝나면 리포트를 보여줘요. 디버그 판이라 랭킹에는 안 올라가요. HUB로 나가면 멈춰요.</div>'+
    '<div class="rkNote">빌드 — 전부 최대: 모든 강화를 최대로 찍고, 판마다 F · Q · R 스킬을 바꿔 가며 전부 시험(좋은 증강 우선 선택). 끝나면 원래 강화 · 스킬로 돌아와요.</div><div class="optTabs">'+tab('botb','max','전부 최대 · 스킬 순환',cf.build)+tab('botb','cur','지금 그대로',cf.build)+'</div>'+
    '<div class="rkNote">판 수</div><div class="optTabs">'+tab('botn',1,'1판',cf.n)+tab('botn',6,'6판',cf.n)+tab('botn',12,'12판',cf.n)+'</div>'+
    '<div class="rkNote">속도</div><div class="optTabs">'+tab('bots',1,'×1',cf.speed)+tab('bots',3,'×3',cf.speed)+tab('bots',6,'×6',cf.speed)+'</div>'+
    '<div class="rkNote">실력</div><div class="optTabs">'+tab('botk',0,'보통',cf.skill)+tab('botk',1,'잘함',cf.skill)+'</div>'+
    '<div class="optTabs"><button data-bot="start" class="on">시작</button>'+(BOT.runs.length?'<button data-bot="last">지난 리포트</button>':'')+'</div>';
  $('#modal').classList.add('on');
}
document.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('[data-botn],[data-bots],[data-botk],[data-botb],[data-bot]'); if(!t) return;
  if(t.dataset.botb) BOT.cfg.build=t.dataset.botb;
  else if(t.dataset.botn) BOT.cfg.n=+t.dataset.botn;
  else if(t.dataset.bots) BOT.cfg.speed=+t.dataset.bots;
  else if(t.dataset.botk!=null) BOT.cfg.skill=+t.dataset.botk;
  else if(t.dataset.bot==='start'||t.dataset.bot==='again'){ sfx('ui'); botStart(); return; }
  else if(t.dataset.bot==='last'){ botReport(); return; }
  else if(t.dataset.bot==='panel'){ openBotPanel(); return; }
  sfx('ui'); openBotPanel();
});

"use strict";
/* ================= 렌더 ================= */
const ctx=gcv.getContext('2d');
const css=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let C={};
const proj=(x,y)=>[x,y*SQUASH+OY];
function fitCanvas(){
  const fr=document.getElementById('frame').getBoundingClientRect(); if(!fr.width||!fr.height) return;
  VW=Math.max(W, Math.min(1500, Math.round(H*fr.width/fr.height))); OFX=(VW-W)/2;
  let d=(window.devicePixelRatio||1)*(fr.height/H); d=Math.max(1, Math.min(d, 2600/VW, 3));
  DPR=d; const pw=Math.round(VW*d), ph=Math.round(H*d);
  if(gcv.width!==pw||gcv.height!==ph){ gcv.width=pw; gcv.height=ph; }
}
addEventListener('resize',()=>{ fitCanvas(); try{ ringKey=''; }catch(e){} });
function refreshColors(){C={cyan:css('--cyan'),red:css('--red'),fg:css('--fg'),dim:css('--dim'),warn:css('--warn')};}

/* v2.66 가장자리 위험 띠 — 평소엔 아주 옅게, 들어가 있으면 붉게 깜빡인다 */
function drawEdgeZone(){
  if(!run||run.tut||run.phase!=='fight') return;
  const k=Math.min(1,(P.edgeT||0)/1.2), a=0.05+k*(0.18+0.1*Math.sin(performance.now()/90));
  const strips=[[0,0,WORLD.w,EDGE],[0,WORLD.h-EDGE,WORLD.w,WORLD.h],[0,EDGE,EDGE,WORLD.h-EDGE],[WORLD.w-EDGE,EDGE,WORLD.w,WORLD.h-EDGE]];
  ctx.save(); ctx.fillStyle='rgba(255,70,85,'+a.toFixed(3)+')';
  strips.forEach(([x1,y1,x2,y2])=>{ const p1=proj(x1,y1),p2=proj(x2,y1),p3=proj(x2,y2),p4=proj(x1,y2);
    ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.lineTo(p3[0],p3[1]); ctx.lineTo(p4[0],p4[1]); ctx.closePath(); ctx.fill(); });
  ctx.restore();
}
function drawGrid(){
  ctx.strokeStyle='rgba(47,227,208,.05)';ctx.lineWidth=1;
  for(let i=-WORLD.h;i<WORLD.w+WORLD.h;i+=120){
    let a=proj(i,0),b=proj(i+WORLD.h,WORLD.h);
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
    a=proj(i,0);b=proj(i-WORLD.h,WORLD.h);
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  }
}
function drawObstacles(){
  const HG=WALL_HG;
  allWalls().forEach(o=>{
    const a=proj(o.x,o.y),b=proj(o.x+o.w,o.y+o.h),w=b[0]-a[0],d=b[1]-a[1];
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(a[0]+4,a[1]+4,w,d);
    ctx.fillStyle='#16202b';ctx.fillRect(a[0],a[1]-HG,w,d+HG);
    ctx.fillStyle='#1e2c3a';ctx.fillRect(a[0],a[1]-HG,w,d);
    /* v3.2 맵 지형은 옅은 회색, 플레이어가 지은 벽은 시안으로 구분 */
    ctx.strokeStyle=o.static?'rgba(127,146,159,.35)':'rgba(47,227,208,.2)';ctx.lineWidth=1;
    ctx.strokeRect(a[0]+.5,a[1]-HG+.5,w-1,d+HG-1);
  });
}
function drawBody(x,y,r,color,hurt){
  const p=proj(x,y);
  /* v1.9 히트박스는 디버그에서만 표시. 대신 몸통을 판정 크기에 맞춰 키웠다 */
  if(debug){
    ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.30;ctx.lineWidth=1.5;
    ctx.setLineDash([4,5]);
    ctx.beginPath();ctx.ellipse(p[0],p[1],r+R_BULLET,(r+R_BULLET)*SQUASH,0,0,TAU);ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle='rgba(0,0,0,.45)';
  ctx.beginPath();ctx.ellipse(p[0],p[1],r*.86,r*.86*SQUASH,0,0,TAU);ctx.fill();
  /* v2.8 몸통은 거의 원형으로 — 세로로 눌려 보이던 문제 */
  ctx.fillStyle=hurt>0?'#fff':color;
  ctx.beginPath();ctx.ellipse(p[0],p[1],r*.84,r*.84*BODY_SQ,0,0,TAU);ctx.fill();
}
/* v2.2 적 스프라이트 — 등급별 이미지가 있으면 그걸 쓰고, 없으면 기존 벡터 도형으로 대체한다.
   assets/enemies/<grade>.png 하나만 넣어도 그 적만 이미지로 바뀐다 */
const SPRITES={};
function loadSprite(grade,src){ const img=new Image(); img.onload=()=>{SPRITES[grade]=img;}; img.src=src; }
loadSprite('mob','assets/enemies/mob.png');   // v3.11 원래 AI 이미지로 복귀
/* v2.89 커스텀 캐릭터 이미지 — 설정 → 게임에서 직접 올린다. 이 브라우저에만 저장되고(localStorage),
   단일 이미지(회전)나 4방향 이미지(위/아래/왼쪽/오른쪽, 방향에 맞춰 교체) 중 고를 수 있다 */
function pimgKey(d){ return 'aether_pimg_'+d; }
function getPImg(d){ try{ return localStorage.getItem(pimgKey(d)); }catch(e){ return null; } }
function setPImg(d,dataUrl){ try{ localStorage.setItem(pimgKey(d),dataUrl); return true; }catch(e){ return false; } }   // v3.12 저장 실패(용량 초과)를 알 수 있게
function clearPImg(d){ try{ localStorage.removeItem(pimgKey(d)); localStorage.removeItem(pimgKey(d+'_o')); localStorage.removeItem(pimgKey(d+'_n')); }catch(e){} delete PANIM[pimgSpriteKey(d)]; }
/* v3.07 배경 제거를 켜고 끌 때, 보관해 둔 원본으로 다시 처리한다 (다시 올릴 필요 없음) */
async function reprocessPImgs(){
  for(const k of ['single','up','down','left','right']){
    const o=getPImg(k+'_o'); if(!o) continue;
    const img=await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=o; }); if(!img) continue;
    const m=pimgMeta(k);
    if(m){ const pr=processSheet(img,m.n,!!OPT.pimgNoBg); const u=sheetUrl(pr.cv); setPImg(k,u); applyPImg(k,u); continue; }   // v3.12 영상 캐릭터
    const SZ=192, cv=document.createElement('canvas'); cv.width=cv.height=SZ; const cx=cv.getContext('2d'); cx.drawImage(img,0,0,SZ,SZ);
    if(OPT.pimgNoBg) stripBg(cx,SZ);
    const u=cv.toDataURL('image/png'); setPImg(k,u); applyPImg(k,u);
  }
}
function pimgSpriteKey(d){ return d==='single'?'player':'player_'+d; }
/* v3.12 영상 캐릭터 — 영상(또는 움짤)을 프레임 여러 장으로 잘라 가로로 이어 붙인 한 장(스프라이트 시트)으로 저장한다.
   프레임 수 · 초당 프레임은 '_n' 키에 "프레임수,fps"로 따로 저장 */
const PANIM={};
function pimgMeta(d){ const m=getPImg(d+'_n'); if(!m) return null; const [n,fps]=m.split(',').map(Number); return n>1?{n,fps:fps||8}:null; }
function applyPImg(d,dataUrl){ const img=new Image(); img.onload=()=>{ SPRITES[pimgSpriteKey(d)]=img; const m=pimgMeta(d); if(m) PANIM[pimgSpriteKey(d)]=m; else delete PANIM[pimgSpriteKey(d)]; }; img.src=dataUrl; }
const PFS=112, PMAXF=12;   // 프레임 한 장 크기 · 최대 프레임 수 (저장 용량 때문에 작게)
/* 시트 → 프레임마다 배경 제거 → 다시 시트 */
function processSheet(src,n,removeBg){
  const out=document.createElement('canvas'); out.width=PFS*n; out.height=PFS; const ox=out.getContext('2d');
  const f=document.createElement('canvas'); f.width=f.height=PFS; const fx=f.getContext('2d');
  let res=null;
  for(let i=0;i<n;i++){ fx.clearRect(0,0,PFS,PFS); fx.drawImage(src,i*PFS,0,PFS,PFS,0,0,PFS,PFS);
    if(removeBg){ const r=stripBg(fx,PFS); if(i===0) res=r; } ox.drawImage(f,i*PFS,0); }
  return {cv:out,res};
}
const sheetUrl=cv=>{ const w=cv.toDataURL('image/webp',0.86); return w.startsWith('data:image/webp')?w:cv.toDataURL('image/png'); };
/* 영상 파일 → 프레임 시트 (최대 3초, 최대 12장) */
function readPVideoFile(file,removeBg){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), v=document.createElement('video');
    v.muted=true; v.playsInline=true; v.setAttribute('playsinline',''); v.preload='auto'; v.src=url;
    const fail=m=>{ URL.revokeObjectURL(url); reject(new Error(m)); };
    const seek=t=>new Promise(r=>{ const done=()=>{ v.removeEventListener('seeked',done); r(); }; v.addEventListener('seeked',done); v.currentTime=t; setTimeout(done,1500); });
    v.onerror=()=>fail('영상을 읽지 못했어요');
    v.onloadeddata=async()=>{
      try{
        try{ await v.play(); v.pause(); }catch(e){}   // 아이폰은 한 번 재생해야 프레임이 그려진다
        const dur=Math.min(isFinite(v.duration)?v.duration:0,3); if(!(dur>0.2)) return fail('영상이 너무 짧아요');
        const n=Math.max(4,Math.min(PMAXF,Math.round(dur*8))), fps=Math.min(12,Math.max(4,n/dur));
        const side=Math.min(v.videoWidth,v.videoHeight); if(!side) return fail('영상을 읽지 못했어요');
        const raw=document.createElement('canvas'); raw.width=PFS*n; raw.height=PFS; const rx=raw.getContext('2d');
        for(let i=0;i<n;i++){ await seek((i+0.5)*dur/n); rx.drawImage(v,(v.videoWidth-side)/2,(v.videoHeight-side)/2,side,side,i*PFS,0,PFS,PFS); }
        const pr=processSheet(raw,n,removeBg);
        URL.revokeObjectURL(url);
        resolve({url:sheetUrl(pr.cv),orig:raw.toDataURL('image/jpeg',0.85),n,fps:Math.round(fps*10)/10,res:pr.res});
      }catch(e){ fail('영상을 읽지 못했어요'); }
    };
  });
}
/* 움짤(GIF) → 프레임 시트. 브라우저가 ImageDecoder를 지원할 때만 (안 되면 첫 장만 이미지로) */
async function readPGifFile(file,removeBg){
  if(!('ImageDecoder' in window)) return null;
  const dec=new ImageDecoder({data:await file.arrayBuffer(),type:file.type}); await dec.tracks.ready;
  const total=dec.tracks.selectedTrack.frameCount; if(!(total>1)) return null;
  const n=Math.min(PMAXF,total);
  const raw=document.createElement('canvas'); raw.width=PFS*n; raw.height=PFS; const rx=raw.getContext('2d');
  let durSum=0;
  for(let i=0;i<n;i++){ const {image}=await dec.decode({frameIndex:Math.floor(i*total/n)}); const w=image.displayWidth,h=image.displayHeight,side=Math.min(w,h);
    rx.drawImage(image,(w-side)/2,(h-side)/2,side,side,i*PFS,0,PFS,PFS); durSum+=(image.duration||100000)/1e6*(total/n); image.close(); }
  const pr=processSheet(raw,n,removeBg);
  return {url:sheetUrl(pr.cv),orig:raw.toDataURL('image/jpeg',0.85),n,fps:Math.round(Math.min(12,Math.max(4,n/Math.max(0.2,durSum)))*10)/10,res:pr.res};
}
/* v2.95 배경 제거 — AI 분리 없이 가벼운 방식. 테두리 전체 평균색 하나로 거리 재던 걸
   "마법봉" 방식으로 바꿨다 — 테두리에서 시작해서 이웃 픽셀끼리 색이 비슷하면 계속 번져나가고,
   경계(피사체)에서 색이 확 바뀌면 멈춘다. 그라데이션·그림자가 있어도 잘 따라가고, 단색이 아니어도 된다 */
/* v3.08 배경 제거 강도 — 약(덜 지움) · 보통 · 강(그라데이션·빛 효과가 있어도 최대한 지움) */
const BG_LV=[{tm:0.5,cov:0.75,refs:3},{tm:1,cov:0.6,refs:4},{tm:1.6,cov:0.4,refs:6}];
function stripBg(cx,SZ){
  /* v3.06 배경 제거 다시 만듦 — 예전 마법봉은 '이웃 픽셀끼리' 색 차이만 봐서, 조금씩 비슷한 색을 따라
     피사체 안쪽까지 번져 그림이 군데군데 뚫렸다(검은 옷·그림자·JPG 노이즈). 이제는
     ① 테두리 색에서 배경 대표색(최대 3개)을 뽑고  ② 테두리와 이어진 픽셀 중 '대표색과 가까운' 것만 지우며
     ③ 경계는 부드럽게 반투명 처리하고  ④ 배경이 복잡하거나 너무 많이 지워지면 아예 지우지 않는다 */
  const id=cx.getImageData(0,0,SZ,SZ), d=id.data, n=SZ*SZ;
  /* v3.08 이미 배경이 투명한 PNG면 건드리지 않는다 — 투명 부분이 '검정'으로 읽혀 캐릭터의 어두운 곳까지 지워졌다 */
  { let tr=0, tot=0; for(let i=0;i<SZ;i++){ for(const k of [i, (SZ-1)*SZ+i, i*SZ, i*SZ+SZ-1]){ tot++; if(d[k*4+3]<20) tr++; } }
    if(tr>tot*0.5) return {ok:true,removed:0,already:true}; }
  const col=k=>[d[k*4],d[k*4+1],d[k*4+2]];
  const d2=(a,b)=>{ const r=a[0]-b[0],g=a[1]-b[1],bb=a[2]-b[2]; return r*r+g*g+bb*bb; };
  /* ① 테두리 2픽셀 두께에서 대표색 뽑기 (가장 흔한 색 덩어리 순서) */
  const border=[]; for(let t=0;t<2;t++) for(let i=0;i<SZ;i++){ border.push(t*SZ+i,(SZ-1-t)*SZ+i,i*SZ+t,i*SZ+SZ-1-t); }
  const refs=[], spr=[]; let left=border.map(col);
  const LV=BG_LV[OPT.pimgBgLv|0]||BG_LV[1];
  for(let r=0;r<LV.refs&&left.length;r++){
    const c=left.slice().sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]))[Math.floor(left.length/2)];
    const near=left.filter(p=>d2(p,c)<40*40);
    if(near.length<border.length*0.12) break;
    const m=[0,1,2].map(j=>near.reduce((s,p)=>s+p[j],0)/near.length);
    refs.push(m); spr.push(Math.sqrt(near.reduce((s,p)=>s+d2(p,m),0)/near.length)); left=left.filter(p=>d2(p,m)>=40*40);
  }
  const covered=border.length-left.length;
  if(!refs.length||covered<border.length*LV.cov) return {ok:false,why:'complex'};   // 테두리가 여러 색으로 복잡 — 지우지 않음
  /* v3.07 허용치를 배경이 얼마나 깨끗한지에 맞춘다 — 깨끗한 단색(검정 등) 배경이면 좁게 잡아 어두운 옷·그림자를 지키고, 노이즈 많은 배경이면 넓게 */
  const T=Math.min(46*LV.tm,Math.max(18,3*Math.max(...spr)+12)*LV.tm);
  const dist=k=>{ const c=col(k); let m=1e9; for(const r of refs){ const v=d2(c,r); if(v<m) m=v; } return Math.sqrt(m); };
  /* ② 테두리에서 시작해 '대표색과 가까운' 픽셀만 따라 번진다 (이웃끼리가 아니라 대표색 기준이라 피사체 안으로 새지 않음) */
  const bg=new Uint8Array(n), q=new Int32Array(n); let qt=0;
  const tryPush=k=>{ if(!bg[k]&&dist(k)<T){ bg[k]=1; q[qt++]=k; } };
  for(const k of border) tryPush(k);
  for(let h=0;h<qt;h++){ const k=q[h], x=k%SZ, y=(k-x)/SZ;
    if(x>0) tryPush(k-1); if(x<SZ-1) tryPush(k+1); if(y>0) tryPush(k-SZ); if(y<SZ-1) tryPush(k+SZ); }
  if(qt>n*0.92) return {ok:false,why:'too-much'};   // 거의 다 지워지면 피사체가 배경과 같은 색 — 지우지 않음
  /* ③ 지우기 + 경계 부드럽게 (지운 곳 바로 옆 픽셀은 대표색과의 거리만큼 반투명) */
  for(let k=0;k<n;k++) if(bg[k]) d[k*4+3]=0;
  for(let k=0;k<n;k++){ if(bg[k]) continue; const x=k%SZ, y=(k-x)/SZ;
    const edge=(x>0&&bg[k-1])||(x<SZ-1&&bg[k+1])||(y>0&&bg[k-SZ])||(y<SZ-1&&bg[k+SZ]); if(!edge) continue;
    const a=Math.max(0,Math.min(1,(dist(k)-T*0.9)/(T*0.9))); d[k*4+3]=Math.round(d[k*4+3]*(0.35+0.65*a)); }
  cx.putImageData(id,0,0);
  return {ok:true,removed:qt/n};
}
/* 올린 원본 이미지를 정사각형으로 잘라 작게 줄인 뒤 데이터 URL로 바꾼다 (저장 용량 · 로딩 가볍게) */
function readPImgFile(file,removeBg){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      try{
        const side=Math.min(img.width,img.height), SZ=192;
        const cv=document.createElement('canvas'); cv.width=cv.height=SZ;
        const cx=cv.getContext('2d');
        cx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,SZ,SZ);
        readPImgFile.orig=cv.toDataURL('image/png');   // v3.07 배경 제거 전 원본도 보관 (켜고 끌 때 다시 처리)
        const res=removeBg?stripBg(cx,SZ):null;   // v3.06
        resolve(cv.toDataURL('image/png')); readPImgFile.last=res;
      }catch(e){ reject(e); } finally{ URL.revokeObjectURL(url); }
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했어요')); };
    img.src=url;
  });
}
(function restorePImgs(){
  if(OPT.pimgMode==='single'){ const d=getPImg('single'); if(d) applyPImg('single',d); }
  else if(OPT.pimgMode==='4dir'){ ['up','down','left','right'].forEach(k=>{ const d=getPImg(k); if(d) applyPImg(k,d); }); }
})();
loadSprite('bulwark','assets/enemies/bulwark.png');
loadSprite('bulwark_shield','assets/enemies/bulwark_shield.svg');   // v2.2 방패 — 임시 SVG, 기준 방향은 오른쪽(0rad)
/* v3.7 나머지 적 전부 — 아직 AI 이미지가 없어서 벡터(SVG)로 임시 제작. 나중에 교체 가능 */
['elite','boss','relay','splitter','splinter','tracker','summoner','minion','healer','sniper','cannon']
  .forEach(g=>loadSprite(g,'assets/enemies/'+g+'.svg'));
/* v3.10.1 분열체는 항상 플레이어 쪽을 보고 회전한다(계속 다가붙는 적이라 방향이 보이는 게 자연스럽다) */
function enemyFacing(e){
  const toP=Math.atan2(P.y-e.y,P.x-e.x);
  if(e.grade==='splinter') return toP;
  /* v3.33 저격수 · 대포병 · 추적자도 그림이 오른쪽(0rad) 정면이라 실제 방향으로 돌린다
     추적자는 돌진 중엔 돌진 방향, 그 밖(추격 · 예비 동작 · 대기)엔 플레이어 쪽 — 예비 동작 중 lungeDir가 비어 엉뚱한 쪽을 보던 문제(v3.10.1) 해결 */
  if(e.grade==='tracker') return e.lungePhase==='dash'&&e.lungeDir!=null?e.lungeDir:toP;
  if(e.grade==='sniper') return e.aimOn&&e.aimAng!=null?e.aimAng:toP;
  if(e.grade==='cannon') return toP;
  return null;
}
function drawEnemyBody(e){
  const img=SPRITES[e.grade];
  if(e.hackT>0){   // v2.29 해킹 표시
    const q=proj(e.x,e.y);
    ctx.save(); ctx.strokeStyle=C.cyan; ctx.globalAlpha=.5+.35*Math.sin(performance.now()/60);
    ctx.lineWidth=2; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.ellipse(q[0],q[1],e.r+10,(e.r+10)*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore();
  }
  if(e.frozenT>0){
    const q=proj(e.x,e.y);
    ctx.save(); ctx.fillStyle='#8fd8ff'; ctx.globalAlpha=.22; ctx.beginPath(); ctx.ellipse(q[0],q[1],e.r+6,(e.r+6)*SQUASH*1.6,0,0,TAU); ctx.fill();
    ctx.strokeStyle='#bfeaff'; ctx.globalAlpha=.85; ctx.lineWidth=2.5; ctx.beginPath(); ctx.ellipse(q[0],q[1],e.r+9,(e.r+9)*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore();
  }
  if(e.burnT>0){
    const q=proj(e.x,e.y), fl=.5+.4*Math.sin(performance.now()/60);
    ctx.save(); ctx.strokeStyle='#ff9f43'; ctx.globalAlpha=fl; ctx.lineWidth=3; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.ellipse(q[0],q[1],e.r+7,(e.r+7)*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore();
  }
  if(e.bindT>0){   // v3.11 구속 표시 — 해킹 표시와 구분되게 실선
    const q=proj(e.x,e.y);
    ctx.save(); ctx.strokeStyle=C.cyan; ctx.globalAlpha=.65; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.ellipse(q[0],q[1],e.r+8,(e.r+8)*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore();
  }
  if(!img){ drawBody(e.x,e.y,e.r,G(e).relay?C.warn:G(e).sniper?'#ff7a3d':C.red,e.hurt); return; }   // v2.65 저격수는 주황
  const p=proj(e.x,e.y);
  ctx.fillStyle='rgba(0,0,0,.45)';
  ctx.beginPath();ctx.ellipse(p[0],p[1],e.r*.86,e.r*.86*SQUASH,0,0,TAU);ctx.fill();
  const s=e.r*2.4;
  const face=enemyFacing(e);
  ctx.save();
  if(e.hurt>0) ctx.filter='brightness('+(1+e.hurt*6)+') saturate('+Math.max(0,1-e.hurt*3)+')';
  if(face!=null){
    ctx.translate(p[0],p[1]); ctx.scale(1,SQUASH); ctx.rotate(face);
    if(e.grade!=='splinter'&&Math.abs(face)>Math.PI/2) ctx.scale(1,-1);   // v3.33 왼쪽을 볼 땐 위아래가 뒤집히지 않게
    ctx.drawImage(img,-s/2,-s/2,s,s);
  } else {
    ctx.drawImage(img,p[0]-s/2,p[1]-s/2,s,s);
  }
  ctx.restore();
}
/* v3.8 플레이어 — 이미지가 있으면 조준 방향(P.face)으로 회전시켜 그린다. 없으면 기존 원으로 대체 */
/* v2.89 커스텀 캐릭터 이미지 — '4dir'이면 4장 중 바라보는 방향 이미지를 회전 없이 바꿔 끼우고,
   'single'이면 한 장을 쓰되 회전 여부는 OPT.pimgRotate로 고를 수 있다(v2.91). 둘 다 없으면 민짜 원 */
function drawPlayerBody(){
  const mode=OPT.pimgMode;
  const dir4=mode==='4dir'&&SPRITES.player_up&&SPRITES.player_down&&SPRITES.player_left&&SPRITES.player_right;
  const skey=dir4?dirKey(P.face):(mode==='single'?'player':null);   // v3.12
  const img=skey?SPRITES[skey]:null;
  if(!img){ drawBody(P.x,P.y,R_PLAYER,P.inv>0?'#9fd8ff':C.cyan,P.hurt); return; }
  const p=proj(P.x,P.y);
  ctx.fillStyle='rgba(0,0,0,.45)';
  ctx.beginPath();ctx.ellipse(p[0],p[1],R_PLAYER*.86,R_PLAYER*.86*SQUASH,0,0,TAU);ctx.fill();
  const s=R_PLAYER*3.8;   // v2.97 일반 몹(72px)보다 조금 더 크게 — 판정(히트박스)은 그대로, 그림자도 기존 크기 유지
  const willRotate=!dir4&&OPT.pimgRotate;   // v2.92 회전 중엔 세로압축(SQUASH)을 끈다 — 같이 걸면 이미지가 평행사변형처럼 기울어 보였다
  /* v3.1 회전 안 할 때만 SQUASH를 걸었더니 회전 여부에 따라 그림 세로 크기가 달라 보였다(평평해짐) — 그림엔 아예 SQUASH를 안 건다 */
  ctx.save();
  ctx.translate(p[0],p[1]); if(willRotate) ctx.rotate(P.face);
  if(P.hurt>0) ctx.filter='brightness('+(1+P.hurt*6)+') saturate('+Math.max(0,1-P.hurt*3)+')';
  else if(P.inv>0) ctx.filter='brightness(1.4) hue-rotate(15deg)';
  const an=PANIM[skey];
  if(an){ /* v3.12 영상 캐릭터 — 시트에서 지금 프레임만 잘라 그린다. '움직일 때만 재생'이면 멈췄을 때 첫 프레임 */
    const fw=img.width/an.n, f=(OPT.pimgAnimMove&&!P.moving)?0:Math.floor(performance.now()/1000*an.fps)%an.n;
    ctx.drawImage(img,f*fw,0,fw,img.height,-s/2,-s/2,s,s);
  } else ctx.drawImage(img,-s/2,-s/2,s,s);
  ctx.restore();
}
function dirKey(a){
  if(a>-Math.PI/4&&a<=Math.PI/4) return 'player_right';
  if(a>Math.PI/4&&a<=Math.PI*3/4) return 'player_down';
  if(a>-Math.PI*3/4&&a<=-Math.PI/4) return 'player_up';
  return 'player_left';
}
function dirSprite(a){
  if(a>-Math.PI/4&&a<=Math.PI/4) return SPRITES.player_right;
  if(a>Math.PI/4&&a<=Math.PI*3/4) return SPRITES.player_down;
  if(a>-Math.PI*3/4&&a<=-Math.PI/4) return SPRITES.player_up;
  return SPRITES.player_left;
}
function drawWallPreview(){
  if(!CFG.wallMax||P.wallCd>0)return;
  const o=wallCandidate(), bad=wallProblem(o);
  const a=proj(o.x,o.y), b=proj(o.x+o.w,o.y+o.h);
  ctx.save(); ctx.setLineDash([5,6]); ctx.lineWidth=1.5;
  ctx.strokeStyle=bad?'rgba(255,59,82,.45)':'rgba(47,227,208,.45)';
  ctx.strokeRect(a[0]+.5,a[1]-WALL_HG+.5,b[0]-a[0]-1,b[1]-a[1]+WALL_HG-1);
  ctx.restore();
}
function drawShield(e){
  const sh=G(e).shield||e.shieldArc; if(!sh||e.shieldDown>0) return;
  const q=proj(e.x,e.y), half=(sh/2)*Math.PI/180;
  const facing=e.sa!=null?e.sa:Math.atan2(P.y-e.y,P.x-e.x);
  const exposed=angDiff(facing,Math.atan2(P.y-e.y,P.x-e.x))>half;   // 플레이어가 사각에 있음
  const img=SPRITES.bulwark_shield;
  if(img){
    /* v2.3 에너지 실드 스프라이트 — 뷰박스 중심(100,100)이 본체 피벗과 겹치도록 그려져 있어서
       정사각형으로 그대로 회전시키면 된다. 길쭉해지는 문제가 없다 */
    const s=e.r*3.4;
    ctx.save(); ctx.translate(q[0],q[1]); ctx.scale(1,SQUASH); ctx.rotate(facing);
    ctx.globalAlpha=exposed?0.45:1;
    if(e.shieldFx>0) ctx.filter='brightness('+(1.6+e.shieldFx*3)+')';
    ctx.drawImage(img,-s/2,-s/2,s,s);
    ctx.restore();
    return;
  }
  ctx.save(); ctx.translate(q[0],q[1]); ctx.scale(1,SQUASH);
  ctx.strokeStyle=(e.shieldFx>0)?'#ffffff':(exposed?'#44586a':'#8fb4c9');
  ctx.lineWidth=6; ctx.lineCap='butt';
  ctx.beginPath(); ctx.arc(0,0,e.r+11,facing-half,facing+half); ctx.stroke();
  ctx.globalAlpha=.25; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(0,0,e.r+17,facing-half,facing+half); ctx.stroke();
  ctx.restore();
}
function hpTicks(x,y,w,h,hpMax,maxSeg){
  const hits=hpMax/HIT_UNIT; if(!(hits>1.05)) return;
  const step=Math.max(1,Math.ceil(hits/maxSeg)), seg=step*HIT_UNIT/hpMax*w;
  ctx.fillStyle='rgba(8,12,17,.85)';
  for(let k=1;k*seg<w-1;k++) ctx.fillRect(Math.round(x+k*seg),y,1,h);
}
function drawHpBar(e){
  const p=proj(e.x,e.y), w=e.r*1.7, hg=5, top=p[1]-e.r*1.3-16;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(p[0]-w/2-1,top-1,w+2,hg+2);
  ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(p[0]-w/2,top,w,hg);
  ctx.fillStyle=C.red;ctx.fillRect(p[0]-w/2,top,w*Math.max(0,e.hp/e.hpMax),hg);
  hpTicks(p[0]-w/2,top,w,hg,e.hpMax,10);
  /* v2.72 칸 구분선 대신 남은 타격 수를 숫자로 표시
     v2.74 처치 판정(HIT_UNIT*0.25 이하면 죽음)과 같은 기준으로 계산 — 안 그러면 "2"인데 1대에 죽는 경우가 생김 */
  if(e.hp>HIT_UNIT*0.25){
    const left=Math.max(1,Math.ceil((e.hp-HIT_UNIT*0.25)/HIT_UNIT));
    ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='800 9px ui-monospace,monospace';
    ctx.lineWidth=2.5; ctx.strokeStyle='rgba(8,12,17,.9)'; ctx.strokeText(left,p[0],top+hg/2);
    ctx.fillStyle='#fff'; ctx.fillText(left,p[0],top+hg/2);
    ctx.restore();
  }
}
/* v1.9 플레이어 체력 — 발밑 링에서 좌상단 바로 변경 */
function drawHpBarPlayer(){
  const ratio=clamp(P.hp/CFG.hpMax,0,1);
  const x=18, y=18, w=232, h=12;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.5)';   ctx.fillRect(x-2,y-2,w+4,h+4);
  ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=ratio>.35?C.cyan:C.red;  ctx.fillRect(x,y,w*ratio,h);
  if(P.hurt>0){ ctx.globalAlpha=Math.min(1,P.hurt*3); ctx.fillStyle='#fff';
    ctx.fillRect(x,y,w*ratio,h); ctx.globalAlpha=1; }
  ctx.strokeStyle='rgba(255,255,255,.18)'; ctx.lineWidth=1;
  ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.textAlign='left'; ctx.font='700 12px ui-monospace,monospace';
  ctx.fillStyle=C.fg;
  ctx.fillText(Math.max(0,Math.ceil(P.hp))+' / '+Math.round(CFG.hpMax), x+w+10, y+h-1);
  ctx.restore();
}
function drawSkill(){
  const p=proj(P.x,P.y), now=performance.now();
  if(P.blazeT>0){
    ctx.save(); ctx.translate(p[0],p[1]); ctx.scale(1,SQUASH); ctx.globalAlpha=Math.min(.7,P.blazeT)*(.5+.3*Math.sin(now/80)); ctx.strokeStyle='#ff9f43'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,R_PLAYER+16,0,TAU); ctx.stroke(); ctx.restore();
  }
  if(P.frostFx>0){
    const t=1-P.frostFx/0.35; ctx.save(); ctx.translate(p[0],p[1]); ctx.scale(1,SQUASH); ctx.globalAlpha=1-t; ctx.fillStyle='#8fd8ff';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,40+t*260,P.face-Math.PI*0.4,P.face+Math.PI*0.4); ctx.closePath(); ctx.globalAlpha=(1-t)*0.3; ctx.fill(); ctx.restore();
  }
  if(P.grav&&P.grav.t>0){
    const g=P.grav, q=proj(g.x,g.y), k=g.t/(g.max||1);
    ctx.save(); ctx.translate(q[0],q[1]); ctx.scale(1,SQUASH);
    ctx.globalAlpha=.10; ctx.fillStyle='#b48cff'; ctx.beginPath(); ctx.arc(0,0,g.r,0,TAU); ctx.fill();
    ctx.globalAlpha=.7; ctx.strokeStyle='#b48cff'; ctx.lineWidth=2; ctx.setLineDash([8,7]); ctx.lineDashOffset=now/30; ctx.beginPath(); ctx.arc(0,0,g.r,0,TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth=3; ctx.beginPath(); ctx.arc(0,0,22,-Math.PI/2,-Math.PI/2+TAU*k); ctx.stroke();
    for(let i=0;i<3;i++){ const a=now/300+i*TAU/3; ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc(Math.cos(a)*g.r*0.55,Math.sin(a)*g.r*0.55,3,0,TAU); ctx.fillStyle='#b48cff'; ctx.fill(); }
    ctx.restore();
  }
  if(P.decoyT>0&&P.decoy){
    const q=proj(P.decoy.x,P.decoy.y), k=P.decoyT/(P.decoyMax||1);
    ctx.save(); ctx.globalAlpha=.35+.15*Math.sin(now/120); ctx.fillStyle=C.cyan; ctx.beginPath(); ctx.ellipse(q[0],q[1],R_PLAYER,R_PLAYER*SQUASH*1.6,0,0,TAU); ctx.fill();
    ctx.globalAlpha=.9; ctx.strokeStyle=C.cyan; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(q[0],q[1]-R_PLAYER-14,8,-Math.PI/2,-Math.PI/2+TAU*k); ctx.stroke();
    ctx.font='700 10px ui-monospace,monospace'; ctx.textAlign='center'; ctx.fillStyle=C.fg; ctx.fillText('미끼',q[0],q[1]+4); ctx.restore();
  }
  if(P.absorbT>0){
    ctx.save(); ctx.translate(p[0],p[1]); ctx.scale(1,SQUASH); ctx.globalAlpha=.14; ctx.fillStyle='#b48cff'; ctx.beginPath(); ctx.arc(0,0,R_PLAYER+28,0,TAU); ctx.fill();
    ctx.globalAlpha=Math.min(1,P.absorbT*2)*(.6+.3*Math.sin(now/70)); ctx.strokeStyle='#b48cff'; ctx.lineWidth=3; ctx.setLineDash([6,5]); ctx.lineDashOffset=-now/40; ctx.stroke(); ctx.restore();
  }
  if(P.slowT>0){
    ctx.save(); ctx.translate(p[0],p[1]); ctx.scale(1,SQUASH); ctx.globalAlpha=Math.min(.5,P.slowT); ctx.strokeStyle=C.warn; ctx.lineWidth=2; ctx.setLineDash([2,8]);
    ctx.beginPath(); ctx.arc(0,0,R_PLAYER+44+6*Math.sin(now/300),0,TAU); ctx.stroke(); ctx.restore();
  }
  if(P.shockFx>0){
    const t=1-P.shockFx/0.35; ctx.save(); ctx.translate(p[0],p[1]); ctx.scale(1,SQUASH); ctx.globalAlpha=1-t; ctx.strokeStyle=C.cyan; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(0,0,R_PLAYER+t*(CFG.shockR-R_PLAYER),0,TAU); ctx.stroke(); ctx.restore();
  }
  if(P.guard>0){
    ctx.save();ctx.translate(p[0],p[1]);ctx.scale(1,SQUASH);
    const R=R_PLAYER+30; ctx.beginPath();
    for(let k=0;k<=6;k++){const a=k/6*TAU+now/600; k?ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R):ctx.moveTo(Math.cos(a)*R,Math.sin(a)*R);}
    ctx.globalAlpha=.10;ctx.fillStyle=C.cyan;ctx.fill();
    ctx.globalAlpha=Math.min(1,P.guard*2)*(.6+.3*Math.sin(now/80));ctx.strokeStyle=C.cyan;ctx.lineWidth=3;ctx.stroke();
    ctx.restore();
  }
  if(!CFG.skill)return;
  const x=p[0]+R_PLAYER+36, y=p[1]+8, r=9, ready=P.skillCd<=0;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(x,y,r+2,0,TAU);ctx.fill();
  if(!ready){ const k=1-P.skillCd/P.skillCdMax;
    ctx.fillStyle='rgba(47,227,208,.35)';ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+TAU*k);ctx.closePath();ctx.fill(); }
  ctx.strokeStyle=ready?C.cyan:C.dim;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
  ctx.fillStyle=ready?C.cyan:C.dim;const st=keyName(OPT.keySkill);
  ctx.font=(st.length>1?'700 7px':'700 10px')+' ui-monospace,monospace';ctx.textAlign='center';
  ctx.fillText(st.slice(0,3),x,y+3);
}
function drawQ(){
  if(!CFG.qSkill)return;
  const p=proj(P.x,P.y), x=p[0]-R_PLAYER-36, y=p[1]+8, r=9, ready=P.wallCd<=0;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(x,y,r+2,0,TAU);ctx.fill();
  if(!ready){ const k=1-P.wallCd/P.qCdMax;
    ctx.fillStyle='rgba(47,227,208,.35)';ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+TAU*k);ctx.closePath();ctx.fill(); }
  ctx.strokeStyle=ready?C.cyan:C.dim;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
  const qt=keyName(OPT.keyWall);
  ctx.fillStyle=ready?C.cyan:C.dim;ctx.font=(qt.length>1?'700 7px':'700 10px')+' ui-monospace,monospace';ctx.textAlign='center';
  ctx.fillText(qt.slice(0,3),x,y+3);
  if(CFG.wallMax){ ctx.font='600 9px ui-monospace,monospace';ctx.fillText(run.walls.length+'/'+CFG.wallMax,x,y+22); }
}
function drawR(){
  if(!CFG.skillR)return;
  const p=proj(P.x,P.y), x=p[0], y=p[1]-R_PLAYER*1.3-40, r=9, ready=P.rChg>=CFG.rNeed;
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.beginPath();ctx.arc(x,y,r+2,0,TAU);ctx.fill();
  if(!ready){ const k=P.rChg/CFG.rNeed;
    ctx.fillStyle='rgba(47,227,208,.35)';ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,r,-Math.PI/2,-Math.PI/2+TAU*k);ctx.closePath();ctx.fill(); }
  ctx.strokeStyle=ready?C.cyan:C.dim;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();
  ctx.fillStyle=ready?C.cyan:C.dim;const rt=keyName(OPT.keyR);
  ctx.font=(rt.length>1?'700 7px':'700 10px')+' ui-monospace,monospace';ctx.textAlign='center';
  ctx.fillText(rt.slice(0,3),x,y+3);
  ctx.font='600 9px ui-monospace,monospace'; ctx.fillStyle=ready?C.cyan:C.dim;
  ctx.fillText(Math.floor(P.rChg)+'/'+CFG.rNeed,x,y+22);
  if(P.echoT>0){ ctx.fillStyle=C.cyan; ctx.fillText(P.echoT.toFixed(1)+'s',x,y-14); }
}
/* v2.1 송신기 — 지원 반경과, 영향받는 적으로 이어지는 선을 그려 원인을 보여준다 */
/* v2.27 힐러 — 회복 반경과 회복 중인 적으로 이어지는 선 */
function drawHealLinks(){
  ens.forEach(h=>{
    if(!G(h).heal) return;
    const p=proj(h.x,h.y);
    ctx.save(); ctx.setLineDash([3,7]); ctx.lineWidth=1.5; ctx.strokeStyle='rgba(124,227,139,.18)';
    ctx.beginPath(); ctx.ellipse(p[0],p[1],HEAL_R,HEAL_R*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore();
    ens.forEach(o=>{
      if(o===h||o.hp>=o.hpMax||dist(o.x,o.y,h.x,h.y)>HEAL_R) return;
      const q=proj(o.x,o.y);
      ctx.save(); ctx.lineWidth=1.5; ctx.strokeStyle='rgba(124,227,139,.55)';
      ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); ctx.restore();
    });
  });
}
function drawRelayLinks(){
  ens.forEach(r=>{
    if(!G(r).relay) return;
    const p=proj(r.x,r.y);
    ctx.save(); ctx.setLineDash([4,6]); ctx.lineWidth=1.5; ctx.strokeStyle='rgba(255,204,85,.18)';
    ctx.beginPath(); ctx.ellipse(p[0],p[1],RELAY_R,RELAY_R*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore();
    ens.forEach(o=>{
      if(o===r||dist(o.x,o.y,r.x,r.y)>RELAY_R) return;
      const q=proj(o.x,o.y);
      ctx.save(); ctx.lineWidth=1.5; ctx.strokeStyle='rgba(255,204,85,.5)';
      ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); ctx.restore();
    });
  });
}
/* v2.7 추적자 — 예비 동작(wind) 중에는 곧 돌진한다는 걸 커지는 붉은 경고 링으로 알려준다 */
/* v2.65 저격수 조준선 — 따라오는 동안은 옅게, 멈추면(곧 발사) 진하게 깜빡인다 */
/* v2.68 보스 변종 표시 — 발밑 고리 색 (수호형 파랑, 환영형 보라) */
function drawBossMarks(){
  ens.forEach(e=>{ if(!e.variant||e.variant==='core') return; const p=proj(e.x,e.y);
    ctx.save(); ctx.strokeStyle=e.variant==='warden'?'#5fa8ff':'#c27cff'; ctx.lineWidth=3;
    ctx.globalAlpha=e.variant==='phantom'?(0.45+0.35*Math.sin(performance.now()/160)):0.7;
    ctx.beginPath(); ctx.ellipse(p[0],p[1],e.r+14,(e.r+14)*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore(); });
}
function drawSniperLines(){
  ens.forEach(e=>{
    if(!G(e).sniper) return;
    const p=proj(e.x,e.y);
    ctx.save(); ctx.strokeStyle='#ff7a3d'; ctx.lineWidth=1.5; ctx.globalAlpha=.8;
    ctx.beginPath(); ctx.arc(p[0],p[1]-e.r*SQUASH-12,5,0,TAU); ctx.moveTo(p[0]-8,p[1]-e.r*SQUASH-12); ctx.lineTo(p[0]+8,p[1]-e.r*SQUASH-12);
    ctx.moveTo(p[0],p[1]-e.r*SQUASH-20); ctx.lineTo(p[0],p[1]-e.r*SQUASH-4); ctx.stroke(); ctx.restore();
    if(!e.aimOn||e.aimAng===undefined) return;
    const locked=e.snipeT<=0.3, L=1400, x2=e.x+Math.cos(e.aimAng)*L, y2=e.y+Math.sin(e.aimAng)*L, q=proj(x2,y2);
    ctx.save();
    ctx.strokeStyle=locked?'#ff3b3b':'#ff7a3d';
    ctx.globalAlpha=locked?(Math.sin(performance.now()/40)>0?.95:.45):.35+.3*(1-e.snipeT);
    ctx.lineWidth=locked?2.5:1.2; if(!locked) ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(q[0],q[1]); ctx.stroke(); ctx.restore();
  });
}
function drawLungeWarning(){
  ens.forEach(e=>{
    if(e.grade!=='tracker'||e.lungePhase!=='wind') return;
    const p=proj(e.x,e.y), k=1-clamp(e.lungeT/LUNGE_WIND,0,1), R=e.r+14+k*26;
    ctx.save(); ctx.translate(p[0],p[1]); ctx.scale(1,SQUASH);
    ctx.globalAlpha=.55+.35*Math.sin(performance.now()/40);
    ctx.strokeStyle=C.red; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,R,0,TAU); ctx.stroke();
    ctx.restore();
  });
}
function drawLock(){
  const p=proj(P.x,P.y);
  if(P.lock<=0) return;      // v1.9.1 평상시에는 아무것도 그리지 않는다
  const k=Math.max(0,P.lock/P.lockMax);
  const col=P.lockKind==='ok'?C.cyan:C.red;
  // 발밑 바깥 원호 — 남은 쿨타임
  ctx.save();ctx.translate(p[0],p[1]);ctx.scale(1,SQUASH);
  ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(0,0,R_PLAYER+21,0,TAU);ctx.stroke();
  ctx.strokeStyle=col;ctx.lineWidth=4;ctx.lineCap='butt';
  ctx.beginPath();ctx.arc(0,0,R_PLAYER+21,-Math.PI/2,-Math.PI/2+TAU*k);ctx.stroke();
  ctx.restore();
  if(P.lockKind!=='ok'){
    // 머리 위 남은 시간 + 라벨
    const top=p[1]-R_PLAYER*1.3-30;
    ctx.textAlign='center';
    ctx.fillStyle=col;ctx.font='700 12px ui-monospace,monospace';
    ctx.fillText('경직  '+P.lock.toFixed(2),p[0],top);
    const w=64,hg=4;
    ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(p[0]-w/2-1,top+5,w+2,hg+2);
    ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(p[0]-w/2,top+6,w,hg);
    ctx.fillStyle=col;ctx.fillRect(p[0]-w/2,top+6,w*k,hg);
    // 화면 가장자리 적색 플래시
    ctx.save();
    const g=ctx.createLinearGradient(0,0,0,H);
    ctx.globalAlpha=0.16*k;ctx.fillStyle=C.red;
    ctx.fillRect(0,0,W,6);ctx.fillRect(0,H-6,W,6);
    ctx.fillRect(0,0,6,H);ctx.fillRect(W-6,0,6,H);
    ctx.restore();
  }
}
function drawZone(){
  if(!bullets.some(b=>b.owner==='enemy'))return;
  const locked=P.lock>0&&P.lockKind!=='ok';
  const act=bullets.some(b=>b.ready)&&!locked, p=proj(P.x,P.y), R=range();
  ctx.save();ctx.strokeStyle=locked?'rgba(255,59,82,.34)':(act?'rgba(47,227,208,.45)':'rgba(127,146,159,.14)');
  ctx.setLineDash([6,8]);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(p[0],p[1],R,R*SQUASH,0,0,TAU);ctx.stroke();ctx.restore();
  const half=(CFG.fov/2)*Math.PI/180;
  ctx.save();ctx.translate(p[0],p[1]);ctx.scale(1,SQUASH);
  ctx.fillStyle=locked?'rgba(255,59,82,.10)':(act?'rgba(47,227,208,.11)':'rgba(127,146,159,.05)');
  ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,R,P.face-half,P.face+half);ctx.closePath();ctx.fill();
  ctx.restore();
}
function drawBullet(b){
  const col=b.owner==='player'?(b.fire?'#ff9f43':C.cyan):C.red;
  b.trail.forEach((q,i)=>{
    const p=proj(q[0],q[1]);
    ctx.globalAlpha=(i/b.trail.length)*.3;ctx.fillStyle=col;
    ctx.beginPath();ctx.arc(p[0],p[1],4*(i/b.trail.length)+1,0,TAU);ctx.fill();
  });
  ctx.globalAlpha=1;
  const p=proj(b.x,b.y);
  if(b.armor>0){   // v2.34 장갑탄 표시
    ctx.save(); ctx.strokeStyle=C.warn; ctx.globalAlpha=.85; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(p[0],p[1],13,0,TAU); ctx.stroke();
    ctx.globalAlpha=.5; ctx.beginPath(); ctx.arc(p[0],p[1],17,0,TAU); ctx.stroke(); ctx.restore();
  }
  if(b.owner==='player'){
    ctx.fillStyle=col;ctx.globalAlpha=(.3+b.glow*.45)*.4;
    ctx.beginPath();ctx.arc(p[0],p[1],20+b.glow*14,0,TAU);ctx.fill();ctx.globalAlpha=1;
  }
  const rr=R_BULLET+3*clamp((b.spd-CFG.spd)/Math.max(1,cap()-CFG.spd),0,1);
  ctx.fillStyle=col;ctx.beginPath();
  if(OPT.cb&&b.owner==='enemy'){ const q=rr*1.5;
    ctx.moveTo(p[0],p[1]-q);ctx.lineTo(p[0]+q,p[1]);ctx.lineTo(p[0],p[1]+q);ctx.lineTo(p[0]-q,p[1]);ctx.closePath(); }
  else ctx.arc(p[0],p[1],rr,0,TAU);
  ctx.fill();
  ctx.strokeStyle='#fff';ctx.globalAlpha=.65;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;
  if(b.ready){
    const lk=P.lock>0&&P.lockKind!=='ok';
    const pc=lk?'rgba(127,146,159,.75)':C.cyan;
    const pl=lk?1:1+Math.sin(performance.now()/110)*.12;
    ctx.strokeStyle=pc;ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(p[0],p[1],17*pl,0,TAU);ctx.stroke();
    ctx.globalAlpha=.32;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(p[0],p[1],25*pl,0,TAU);ctx.stroke();ctx.globalAlpha=1;
    ctx.fillStyle=pc;ctx.font='700 13px ui-monospace,monospace';ctx.textAlign='center';
    const kt=keyName(OPT.keyParry), bw=26+(kt.length-1)*8;
    ctx.fillText(kt,p[0],p[1]-44);
    ctx.strokeStyle=pc;ctx.lineWidth=1.5;ctx.strokeRect(p[0]-bw/2,p[1]-58,bw,20);
  }
}
function fmtTime(s){const m=Math.floor(s/60),x=Math.floor(s%60);return String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');}

/* v2.3 조이스틱 표시 — 손가락이 닿은 자리에 그린다 */
/* v2.57 패링 과부하 게이지 — 캐릭터 아래 작은 막대. 쌓이기 시작하면 보이고, 과부하 중엔 빨갛게 깜빡인다 */
const HEAT_MAX=4;
function drawHeat(){
  if(!P||!(P.heat>0.25||P.ovl)) return;
  const p=proj(P.x,P.y), w=46, h=5, x=p[0]-w/2, y=p[1]+R_PLAYER*SQUASH+14;
  const k=Math.min(1,P.heat/HEAT_MAX);
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(x-1,y-1,w+2,h+2);
  ctx.fillStyle=P.ovl? (Math.sin(performance.now()/90)>0?C.red:'#7a2a33') : (k>0.75?C.warn:C.cyan);
  ctx.fillRect(x,y,w*k,h);
  if(P.ovl||k>0.75){ ctx.font='700 9px ui-monospace,monospace'; ctx.textAlign='center';
    ctx.fillStyle=P.ovl?C.red:C.warn; ctx.fillText(P.ovl?'과부하 · 손을 떼세요':'과부하 주의',p[0],y+15); }
  ctx.restore();
}
/* v2.68 ⑩ 피해 숫자 — 0.7초 동안 떠오르며 사라진다 */
function drawDmgNums(){
  if(!dmgNums.length) return; const now=performance.now();
  dmgNums=dmgNums.filter(d=>now-d.t<700);
  ctx.save(); ctx.textAlign='center';
  dmgNums.forEach(d=>{ const k=(now-d.t)/700, p=proj(d.x,d.y);
    ctx.globalAlpha=1-k; ctx.font='800 '+(d.kill||d.big?16:13)+'px ui-monospace,monospace';
    ctx.fillStyle=d.kill?C.warn:d.big?'#ff9f43':'#e6eef4'; ctx.fillText('-'+d.v,p[0],p[1]-14-k*26); });
  ctx.restore();
}
function drawSticks(){
  /* v2.79 고정 조이스틱은 손을 안 대고 있어도 자리를 보여 준다 */
  if(touchMode) [['move',C.cyan,'이동'],['aim',C.warn,'패링']].forEach(([k,col,lb])=>{
    if(stick[k]||!isFixed(k)) return; const c=fixCenterS(k);
    ctx.save(); ctx.globalAlpha=.22; ctx.strokeStyle=col; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(c[0],c[1],TOUCH_MAX,0,TAU); ctx.stroke();
    ctx.globalAlpha=.3; ctx.fillStyle=col; ctx.beginPath(); ctx.arc(c[0],c[1],16,0,TAU); ctx.fill();
    ctx.globalAlpha=.45; ctx.font='700 10px ui-monospace,monospace'; ctx.textAlign='center'; ctx.fillText(lb,c[0],c[1]-TOUCH_MAX-8);
    ctx.restore(); });
  [['move',C.cyan],['aim',C.warn]].forEach(([k,col])=>{
    const st=stick[k]; if(!st)return;
    ctx.save(); ctx.globalAlpha=.30; ctx.strokeStyle=col; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(st.ox,st.oy,TOUCH_MAX,0,TAU); ctx.stroke();
    const d=Math.hypot(st.x-st.ox,st.y-st.oy), f=d>TOUCH_MAX?TOUCH_MAX/d:1;
    ctx.globalAlpha=.55; ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(st.ox+(st.x-st.ox)*f, st.oy+(st.y-st.oy)*f, 16,0,TAU); ctx.fill();
    ctx.restore();
  });
}
/* v2.12 포인터를 잠그면 시스템 커서가 사라지므로 조준점을 직접 그린다 */
function drawCrosshair(){
  if(!locked())return;
  const p=proj(mouse.x,mouse.y);
  ctx.save(); ctx.strokeStyle=C.cyan; ctx.globalAlpha=.7; ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(p[0]-9,p[1]); ctx.lineTo(p[0]-3,p[1]);
  ctx.moveTo(p[0]+3,p[1]); ctx.lineTo(p[0]+9,p[1]);
  ctx.moveTo(p[0],p[1]-6); ctx.lineTo(p[0],p[1]-2);
  ctx.moveTo(p[0],p[1]+2); ctx.lineTo(p[0],p[1]+6);
  ctx.stroke(); ctx.restore();
}
function drawHUD(){
  const W=VW;   // v2.85 HUD는 실제 화면 폭 기준 (점수 · 왕복이 화면 끝에 붙는다)
  drawHpBarPlayer();                       // v1.9 플레이어 체력 바
  if(run.revives>0){ ctx.textAlign='left';ctx.font='700 11px ui-monospace,monospace';ctx.fillStyle=C.cyan;
    ctx.fillText('부활 ×'+run.revives,18,58); }   // v2.37
  ctx.textAlign='right';ctx.font='700 17px ui-monospace,monospace';
  ctx.fillStyle=C.warn;ctx.fillText('점수 '+run.score.toLocaleString(),W-18,30);
  const mx=bullets.reduce((m,b)=>Math.max(m,b.returns),0);
  ctx.font='700 13px ui-monospace,monospace';
  ctx.fillStyle=mx>0?C.cyan:C.dim;ctx.fillText('왕복 ×'+mx,W-18,H-22);
  ctx.textAlign='center';ctx.font='600 11px ui-monospace,monospace';
  /* v3.0 플레이어가 화면 아래쪽 끝까지 내려가면 이 줄에 가려서 안 보였다 — 뒤에 반투명 패널을 깔아 항상 읽히게 */
  const hudLine='사이클 '+run.cycle+'  ·  웨이브 '+(run.wave||1)+'  ·  '+fmtTime(run.time)+(dmgScale()>1.001?'  ·  받는 피해 ×'+dmgScale().toFixed(2):'');
  const hudW=ctx.measureText(hudLine).width;
  ctx.fillStyle='rgba(8,12,17,.62)'; ctx.fillRect(W/2-hudW/2-10,H-34,hudW+20,22);
  ctx.fillStyle=C.dim; ctx.fillText(hudLine,W/2,H-22);   // v2.63

  // 벽 설치 준비 시간 안내
  if(run.phase==='build'){
    ctx.textAlign='center';
    ctx.fillStyle=C.cyan;ctx.font='700 22px ui-monospace,monospace';
    ctx.fillText('벽 설치  '+Math.ceil(run.phaseT),W/2,70);
    ctx.fillStyle=C.dim;ctx.font='600 12px ui-monospace,monospace';
    ctx.fillText(keyName(OPT.keyWall)+' 로 벽 설치 ('+run.walls.length+' / '+CFG.wallMax+')  ·  Enter 로 바로 시작',W/2,92);
  }
  // 보스 체력
  const boss=ens.find(e=>e.grade==='boss');
  if(boss){
    ctx.fillStyle=boss.p2?C.red:C.dim;ctx.fillText(boss.p2?'알레테이아  ·  과부하':'알레테이아',W/2,22);
    ctx.fillStyle='rgba(255,255,255,.1)';ctx.fillRect(W/2-180,30,360,7);
    ctx.fillStyle=C.red;ctx.fillRect(W/2-180,30,360*Math.max(0,boss.hp/boss.hpMax),7);
    hpTicks(W/2-180,30,360,7,boss.hpMax,24);
  }
  msgs.forEach((m,i)=>{
    ctx.globalAlpha=Math.min(1,m.t*2.2);
    ctx.font=(m.big?'700 30px':'700 18px')+' ui-monospace,monospace';
    ctx.fillStyle=C[m.color]||C.fg;
    ctx.fillText(m.text,W/2,(m.big?150:112)+i*24);
    ctx.globalAlpha=1;
  });
  if(paused){
    ctx.fillStyle='rgba(8,12,17,.8)';ctx.fillRect(0,0,W,H);
    ctx.fillStyle=C.cyan;ctx.font='700 26px ui-monospace,monospace';ctx.fillText('일시정지',W/2,H/2);
    ctx.fillStyle=C.dim;ctx.font='600 12px ui-monospace,monospace';
    ctx.fillText('ESC 로 계속',W/2,H/2+26);
    const own=Object.keys(run.boons||{});
    if(own.length){
      ctx.fillStyle=C.cyan;ctx.font='600 11px ui-monospace,monospace';
      /* v2.55 특수 특전도 이름을 찾도록 boonDef 사용 — 예전엔 일반 보상에서만 찾아서 특수 특전이 있으면 여기서 오류가 났다 */
      ctx.fillText(own.map(k=>{const b=boonDef(k); if(!b) return '';
        return b.n+(run.boons[k]>1?' ×'+run.boons[k]:'');}).filter(Boolean).join('  ·  '),W/2,H/2+58);
    }
  }
}
function render(){
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,gcv.width,gcv.height);
  ZK=VW/W;
  /* v2.87 카메라 이동은 없앤다 — 확대(가로 꽉 채우기)는 그대로 두고, 전장이 화면 세로 가운데에 오도록 고정.
     전장 높이(760×0.62)×확대가 화면보다 아주 조금 커서, 위아래 끝이 몇 픽셀만 잘린다 (플레이 영역은 다 보임) */
  CAMY = ZK<=1.0001 ? 0 : (H - WORLD.h*SQUASH*ZK)/2 - OY*ZK;
  ctx.setTransform(DPR*ZK,0,0,DPR*ZK,0,CAMY*DPR);   // v2.85 전장: 가로 꽉 채우기 + 세로 카메라
  ctx.save();
  if(shake>0&&OPT.shake)ctx.translate((Math.random()-.5)*shake*OPT.shake,(Math.random()-.5)*shake*OPT.shake);   // v2.52 강도 단계
  drawGrid();drawObstacles();drawWallPreview();drawZone();drawEdgeZone();drawRelayLinks();drawHealLinks();drawLungeWarning();drawSniperLines();drawBossMarks();drawBulletDebug();
  ens.slice().sort((a,b)=>a.y-b.y).forEach(e=>{
    drawEnemyBody(e); drawShield(e); drawHpBar(e);
    if(e.seizeFx>0){ const q=proj(e.x,e.y); ctx.save(); ctx.globalAlpha=e.seizeFx/0.35; ctx.strokeStyle=C.red; ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(q[0],q[1],e.r+SEIZE_R*(1.2-e.seizeFx),(e.r+SEIZE_R*(1.2-e.seizeFx))*SQUASH,0,0,TAU); ctx.stroke(); ctx.restore(); }
  });
  if(P.phase>0) ctx.globalAlpha=.4+.15*Math.sin(performance.now()/60);
  drawPlayerBody(); ctx.globalAlpha=1;
  drawLock(); drawSkill(); drawQ(); drawR();
  const p=proj(P.x,P.y);
  ctx.strokeStyle='rgba(223,233,242,.16)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(p[0],p[1]);
  ctx.lineTo(p[0]+Math.cos(P.face)*66,p[1]+Math.sin(P.face)*66*SQUASH);ctx.stroke();
  bullets.forEach(drawBullet);
  parts.forEach(q=>{const pp=proj(q.x,q.y);ctx.globalAlpha=Math.min(1,q.t*3);ctx.fillStyle=C[q.col]||q.col;
    ctx.fillRect(pp[0]-2,pp[1]-2,4,4);});ctx.globalAlpha=1;
  ctx.restore();
  drawDmgNums(); drawHeat(); drawCrosshair();
  ctx.setTransform(DPR,0,0,DPR,0,0);   // v2.85 HUD · 조이스틱은 화면 기준 (양 끝까지)
  drawSticks(); drawHUD();
}

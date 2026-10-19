"use strict";
/* ================= 타이틀 배경 ================= */
/* v2.73 실제 플레이와 같은 그림으로 — 플레이어는 여전히 민짜 원(스프라이트 없음), 적은 실제 mob 스프라이트.
   탄환이 왕복하다 부딪힐 때마다 패링 스파크가 튄다
   v3.1 배경이 그냥 검은 화면이라 실제 게임이랑 다른 공간처럼 보였다 — 전투 중 바닥에 깔리는
   대각선 격자(drawGrid) 느낌을 그대로 가져와 같은 장소처럼 보이게 했다 */
const bcv=$('#bgcv'),bx=bcv.getContext('2d');
let BW=0,BH=0,bt=0,bpos=0,bdir=1,btrail=[],bSpark=[],bSeizeT=0;
const B_INSET=.16;   // v3.3 탄환이 캐릭터까지 다 가서 닿았다 되돌아오면 어색해서, 닿기 전 중간 지점에서 가로채여 돌아오게
function bresize(){const r=bcv.getBoundingClientRect();const d=Math.min(2,devicePixelRatio||1);
  BW=r.width;BH=r.height;bcv.width=BW*d;bcv.height=BH*d;bx.setTransform(d,0,0,d,0,0);}
addEventListener('resize',bresize);
function bGrid(){
  bx.strokeStyle='rgba(47,227,208,.05)'; bx.lineWidth=1;
  const step=70, diag=Math.max(BW,BH)*1.6;
  for(let i=-diag;i<BW+diag;i+=step){
    bx.beginPath(); bx.moveTo(i,0); bx.lineTo(i+diag,diag); bx.stroke();
    bx.beginPath(); bx.moveTo(i,0); bx.lineTo(i-diag,diag); bx.stroke();
  }
}
function bDot(cx,cy,r,color){   // 플레이어와 같은 레이어 방식(그림자+원) — 스프라이트 없는 민짜 원
  bx.fillStyle='rgba(0,0,0,.45)';
  bx.beginPath();bx.ellipse(cx,cy+2,r*.92,r*.58,0,0,TAU);bx.fill();
  bx.fillStyle=color;
  bx.beginPath();bx.arc(cx,cy,r*.82,0,TAU);bx.fill();
}
function bSparkBurst(x,y,color){
  for(let i=0;i<10;i++){ const a=TAU*Math.random(), sp=60+Math.random()*90;
    bSpark.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:1,color}); }
}
function bgFrame(ts){
  const dt=Math.min(.033,(ts-bt)/1000||0);bt=ts;
  if($('#bgcv').style.display!=='none'){
    if(!BW)bresize();
    const ax=BW*.16,bxx=BW*.84,y=BH*.6;
    const turnL=ax+(bxx-ax)*B_INSET, turnR=bxx-(bxx-ax)*B_INSET;   // 가로채이는 지점 — 캐릭터 바로 앞, 안 닿음
    bpos+=bdir*dt*.42;
    if(bpos>1){bpos=1;bdir=-1;bSeizeT=.35;bSparkBurst(turnR,y,'#ff6a52');}
    if(bpos<0){bpos=0;bdir=1;bSparkBurst(turnL,y,'#2fe3d0');}
    const x=turnL+(turnR-turnL)*bpos;
    const col=bdir>0?'#2fe3d0':'#ff3b52';
    btrail.push([x,y]);if(btrail.length>26)btrail.shift();
    bx.clearRect(0,0,BW,BH);
    bGrid();   // v3.1 전투 바닥과 같은 대각선 격자
    /* 플레이어 — 1장짜리 커스텀 이미지를 올렸으면 그 이미지, 없으면 민짜 원 */
    const pimg=OPT.pimgMode==='single'?SPRITES.player:null;
    if(pimg){ const s=64, an=PANIM.player;   // v3.12 영상 캐릭터면 시트에서 지금 프레임만
      if(an){ const fw=pimg.width/an.n, f=Math.floor(performance.now()/1000*an.fps)%an.n; bx.drawImage(pimg,f*fw,0,fw,pimg.height,ax-s/2,y-s/2,s,s); }
      else bx.drawImage(pimg,ax-s/2,y-s/2,s,s); }
    else bDot(ax,y,24,'#2fe3d0');
    /* 적 — 실제 몹 스프라이트(없으면 예전처럼 민짜 원으로 대체) */
    const mob=SPRITES.mob;
    if(mob){ const s=64; bx.drawImage(mob,bxx-s/2,y-s/2,s,s); }
    else bDot(bxx,y,24,'#ff3b52');
    /* 적이 날아오는 탄환을 가로채 재탈취하는 순간 — 실제 게임의 '빼앗김' 링(e.seizeFx, 2805-2806줄)과
       타이밍·반지름 공식 전부 그대로: 0.35초 동안 e.r+SEIZE_R*(1.2-seizeFx)로 커지면서 알파가 선형으로 빠짐.
       (길게 늘렸더니 실제 역패링 연출과 달라 보인다는 피드백 — 진짜 게임과 동일하게 되돌림) */
    if(bSeizeT>0){ bx.save(); bx.globalAlpha=bSeizeT/0.35; bx.strokeStyle='#ff3b52'; bx.lineWidth=3;
      bx.beginPath(); bx.arc(bxx,y,R_ENEMY+SEIZE_R*(1.2-bSeizeT),0,TAU); bx.stroke(); bx.restore(); bSeizeT=Math.max(0,bSeizeT-dt); }   // v3.6 링 중심은 몹 위치(bxx), 반지름은 실제 e.r(R_ENEMY) 그대로 사용
    btrail.forEach((p,i)=>{bx.globalAlpha=(i/btrail.length)*.3;bx.fillStyle=col;
      bx.beginPath();bx.arc(p[0],p[1],5*(i/btrail.length)+1,0,TAU);bx.fill();});
    bx.globalAlpha=1;bx.fillStyle=col;
    bx.beginPath();bx.arc(x,y,7,0,TAU);bx.fill();
    bx.strokeStyle='#fff';bx.globalAlpha=.6;bx.lineWidth=1.2;bx.stroke();bx.globalAlpha=1;
    bx.globalAlpha=.22;bx.beginPath();bx.arc(x,y,20,0,TAU);bx.fill();bx.globalAlpha=1;
    /* 패링하기 전 — 플레이어 쪽으로 돌아오는 탄환에 실제 게임의 '패링 가능' 청록 이중 링(b.ready, 2672-2675줄)과
       반지름·선굵기 그대로: 안쪽 17*pl/lineWidth3, 바깥 25*pl/lineWidth1.5·알파.32 (문구만 뺌) */
    if(bdir<0&&bpos<0.3){ const pl=1+Math.sin(ts/110)*.12;
      bx.save(); bx.strokeStyle='#2fe3d0'; bx.lineWidth=3;
      bx.beginPath(); bx.arc(x,y,17*pl,0,TAU); bx.stroke();
      bx.globalAlpha=.32; bx.lineWidth=1.5;
      bx.beginPath(); bx.arc(x,y,25*pl,0,TAU); bx.stroke(); bx.restore(); }
    /* 부딪힐 때 스파크(패링 연출과 같은 느낌) */
    bSpark=bSpark.filter(s=>s.t>0);
    bSpark.forEach(s=>{ s.x+=s.vx*dt; s.y+=s.vy*dt; s.vx*=.92; s.vy*=.92; s.t-=dt*1.6;
      bx.globalAlpha=Math.max(0,s.t);bx.fillStyle=s.color;
      bx.beginPath();bx.arc(s.x,s.y,2.4*Math.max(0,s.t)+.6,0,TAU);bx.fill(); });
    bx.globalAlpha=1;
  }
  requestAnimationFrame(bgFrame);
}

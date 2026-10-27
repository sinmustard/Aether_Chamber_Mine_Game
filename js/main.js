"use strict";
/* ================= 루프 ================= */
/* v2.54 게임 루프가 절대 멈추지 않게 — 예전엔 한 프레임에서 오류가 나면 다음 프레임을 예약하지 못해
   마지막 화면(예: 일시정지 화면)에 그대로 굳어 버렸다. 다음 프레임을 먼저 예약하고, 오류는 화면 아래에 띄운다 */
function reportErr(where,e){
  const errSeen=(window.__aeErrSeen=window.__aeErrSeen||{});
  const msg=(e&&e.message)||String(e); const key=where+':'+msg;
  try{ console.error('[에테르 챔버 오류]',where,e); }catch(_){}
  if(errSeen[key]) return; errSeen[key]=1;
  let box=document.getElementById('errBox');
  if(!box){ box=document.createElement('div'); box.id='errBox'; document.body.appendChild(box);
    box.onclick=()=>box.remove(); }
  box.textContent='오류가 났어요 ('+where+'): '+msg+' — 이 화면을 캡처해서 알려주세요. (누르면 닫혀요)';
}
let fitTick=0;
function loop(ts){
  raf=requestAnimationFrame(loop);
  const dt=Math.min(.033,(ts-t0)/1000||0);t0=ts;
  if(screen==='game'&&run){
    if((fitTick++%20)===0) fitCanvas();   // v2.84
    /* v3.64 봇 배속으로 한 프레임에 여러 번 돌 때, 판이 끝나 결과 화면으로 넘어갔으면 멈춘다 (endRun이 두 번 불려 재화 · 기록이 두 번 들어갔다) */
    try{ for(let i=0;i<(BOT.on?BOT.speed:1)&&screen==='game'&&run;i++) update(dt); }catch(e){ reportErr('update',e); }
    try{ render(); }catch(e){ reportErr('render',e); }
    if(OPT.skillRing&&touchMode) placeRing();   // v2.79
    { const cover=paused||$('#modal').classList.contains('on')||$('#confirm').classList.contains('on')||(run&&run.phase==='reward');
      if(cover!==document.body.classList.contains('ui-cover')) document.body.classList.toggle('ui-cover',cover); }   // v2.80
    /* 멈춰 있는데 메뉴도 창도 안 보이면 일시정지 메뉴를 다시 띄운다 */
    if(paused&&!$('#pause').classList.contains('on')&&!$('#modal').classList.contains('on')&&!$('#confirm').classList.contains('on'))
      $('#pause').classList.add('on');
  }
}
refreshColors();syncUI();refreshKeyLabels();armFullscreen();go('title');bresize();
requestAnimationFrame(bgFrame);t0=performance.now();requestAnimationFrame(loop);

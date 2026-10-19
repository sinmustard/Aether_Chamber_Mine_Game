"use strict";
/* ================= v2.0 보상 선택 UI ================= */
let rwPicks=[];
function openReward(afterBoss){
  const pool=BOONS.filter(b=>boonLv(b.k)<b.max);
  if(!pool.length){ run.phase='break'; return; }
  rwPicks=[];
  const bag=pool.slice();
  while(rwPicks.length<3 && bag.length)
    rwPicks.push(bag.splice(Math.floor(Math.random()*bag.length),1)[0]);
  /* v2.37 특수 특전 — 확률로 마지막 칸을 특수 특전으로 바꾼다 */
  /* v2.41 보스를 잡은 직후 보상은 특수 특전 확률 +30%p (최대 90%) */
  const spChance=afterBoss? CFG.specialBoss : CFG.specialChance;   // v2.47 보스 후 38 / 47 / 50%
  if(CFG.specialChance>0 && Math.random()<spChance){
    const sp=SPECIALS.filter(x=>boonLv(x.k)<x.max);
    if(sp.length){ const pick=sp[Math.floor(Math.random()*sp.length)];   // v2.52 특수 특전이 들어가는 칸도 무작위
      if(rwPicks.length<3) rwPicks.splice(Math.floor(Math.random()*(rwPicks.length+1)),0,pick);
      else rwPicks[Math.floor(Math.random()*rwPicks.length)]=pick; }
  }
  run.rwBoss=afterBoss;
  const rr=$('#rwReroll'); rr.textContent='새로고침 R · 남은 '+(run.rerolls||0); rr.disabled=!(run.rerolls>0);
  run.phase='reward';
  $('#rwHd').innerHTML=(afterBoss?'알레테이아 격파 · <b>사이클 '+run.cycle+'</b>'
                                 :(run.wave===0?'선행 보급':'웨이브 '+run.wave+' 완료'))+' &nbsp;—&nbsp; 하나를 고르세요';
  $('#rwRow').innerHTML=rwPicks.map((b,i)=>
    '<div class="bc'+(b.sp?' sp':'')+'" data-i="'+i+'">'+
    '<div class="num">'+(i+1)+'</div>'+
    '<div class="k">'+b.tag+'</div>'+
    '<div class="n">'+b.n+'</div>'+
    '<div class="d">'+b.d+'</div>'+
    '<div class="st">'+(boonLv(b.k)?'보유 '+boonLv(b.k)+' / '+b.max:'신규')+'</div>'+
    '</div>').join('');
  const own=Object.keys(run.boons);
  $('#rwOwn').innerHTML=own.length
    ? '보유 — '+own.map(k=>{const b=boonDef(k);return '<b>'+b.n+'</b>'+(run.boons[k]>1?' ×'+run.boons[k]:'');}).join(' · ')
    : '';
  $('#reward').classList.add('on');
  sfx('wave');
}
/* v2.52 보상 새로고침 — 생존/보급의 '새로고침' 강화와 보상 '새로고침 +1'로 횟수를 얻는다 */
function rerollReward(){
  if(!run||run.phase!=='reward'||!(run.rerolls>0)) return;
  run.rerolls--; sfx('ui'); openReward(run.rwBoss);
}
$('#rwReroll').onclick=rerollReward;
function takeReward(i){
  const b=rwPicks[i]; if(!b) return;
  run.boons[b.k]=(run.boons[b.k]||0)+1;
  if(b.sp) stat('specials');   // v2.68
  b.fn();
  $('#reward').classList.remove('on');
  run.phase='break'; run.phaseT=Math.max(run.phaseT,0.9);   // v2.2 보스 직후 CYCLE 연출 시간 유지
  say(b.n,'cyan'); sfx('heal'); burst(P.x,P.y,'cyan',14,150);
  if(run.startRewards>0){ run.startRewards--; openReward(false); }   // v2.17 선행 보급 2단계
}
$('#rwRow').addEventListener('click',e=>{
  const c=e.target.closest('.bc'); if(!c) return;
  takeReward(+c.dataset.i);
});

function nearestEnemy(){
  let best=null,bd=1e9;
  ens.forEach(e=>{const d=dist(e.x,e.y,P.x,P.y); if(d<bd){bd=d;best=e;}});
  return best;
}

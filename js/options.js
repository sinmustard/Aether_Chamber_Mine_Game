"use strict";
/* ================= 옵션 · 저장 (v1.3) ================= */
const OPT={vol:80, bgm:40, lowfx:0, shake:1, cb:0, lockMouse:1, tutSeen:0, inputBuf:0.12, holdParry:1, padPos:'bottom', swapSticks:0, mode:'normal', dmgNum:1, fixedSticks:0, fixMove:0, fixAim:0, posMove:null, posAim:null, posSkill:null, skillRing:0, keyParry:'e', keySkill:'f', keyWall:'q', keyR:'r', pimgMode:'off', pimgRotate:1, pimgNoBg:1, pimgBgLv:1, pimgAnimMove:0};   // v2.89 커스텀 캐릭터 이미지
/* v1.4.1 키 설정 — 이동(WASD·방향키)과 ESC는 고정 */
const KEY_RESERVED=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','escape','tab','meta','capslock'];
const KEY_DEFAULT={keyParry:'e', keySkill:'f', keyWall:'q', keyR:'r'};
let binding=null, bindMsg='';
const keyName=k=>k===' '?'SPACE':(k.length===1?k.toUpperCase():k.charAt(0).toUpperCase()+k.slice(1));
const SAVE_KEY='aether_chamber_save_v1';
/* v2.46 재화를 더하거나 뺄 때는 저장된 최신 값을 먼저 읽는다.
   탭을 두 개 열어 두면, 오래된 탭이 저장하면서 다른 탭에서 번 재화를 덮어써 버렸다 */
function syncMeta(){
  try{ const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');
    if(d&&d.meta&&isFinite(d.meta.cur)) META.cur=d.meta.cur;
    if(d&&d.meta&&isFinite(d.meta.best)) META.best=Math.max(META.best,d.meta.best);
    if(d&&d.upg) Object.keys(d.upg).forEach(k=>{ const u=UPG.find(x=>x.k===k); if(u&&d.upg[k]>u.lv) u.lv=clamp(d.upg[k]|0,0,u.max); });
  }catch(e){}
  if(!isFinite(META.cur)) META.cur=0;
}
addEventListener('storage',e=>{   // 다른 탭에서 저장하면 이 탭도 바로 맞춘다
  if(e.key!==SAVE_KEY) return;
  syncMeta();
  if(typeof screen!=='undefined'&&screen==='hub'){ $('#cur').textContent=META.cur.toLocaleString(); renderCards(); renderDetail(); }
});
function save(){ try{ const upg={}; UPG.forEach(u=>upg[u.k]=u.lv);
  localStorage.setItem(SAVE_KEY,JSON.stringify({meta:META,upg,opt:OPT})); }catch(e){} }
function setLv(k,v){ const u=UPG.find(x=>x.k===k); if(u)u.lv=clamp(v|0,0,u.max); }
function load(){
  try{
    const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'null'); if(!d)return;
    Object.assign(META,d.meta||{});
    if(Array.isArray(d.upg)){   // v1.3.x 저장 → 패링 강화를 사거리·시야각·페널티에 그대로 이어줌
      const old=['parry','move','bullet','vital','multi'];
      d.upg.forEach((v,i)=>{ if(old[i]==='parry') ['range','fov','penalty'].forEach(k=>setLv(k,v)); else setLv(old[i],v); });
    } else if(d.upg) Object.keys(d.upg).forEach(k=>setLv(k,d.upg[k]));
    Object.assign(OPT,d.opt||{});
    if(OPT.tutSeen===undefined) OPT.tutSeen=1;   // v3.4 이미 저장 데이터가 있던 기존 플레이어는 튜토리얼을 건너뛴다
    if(META.skill==='phase'){ if(!META.skillQ) META.skillQ='phase'; META.skill=''; }
  }catch(e){}
}
/* v2.51 확인 팝업 */
let cfOk=null;
let optTab='game';   // v2.68 설정 탭
queueMicrotask(()=>{ const rb=$('#respec'); if(!rb) return;
  rb.onclick=()=>{ const back=respecRefund();
    if(back<=0){ askConfirm('되돌릴 강화가 없어요','아직 찍은 강화가 없어요.','확인',()=>{}); return; }
    askConfirm('강화를 되돌릴까요?','찍은 강화가 모두 0단계로 돌아가고, 쓴 재화의 40%인 ◆ '+back.toLocaleString()+'을 돌려받아요. 장착한 스킬도 해제돼요.','되돌리기',doRespec); };
});
queueMicrotask(()=>{
  $('#cfNo').onclick=closeConfirm;
  $('#cfYes').onclick=()=>{ const f=cfOk; closeConfirm(); if(f) f(); };
  $('#confirm').addEventListener('click',e=>{ if(e.target.id==='confirm') closeConfirm(); });
});
function askConfirm(title,desc,okLabel,onOk){
  $('#cfT').textContent=title; $('#cfD').textContent=desc; $('#cfYes').textContent=okLabel||'확인';
  cfOk=onOk; $('#confirm').classList.add('on'); sfx('ui');
}
function closeConfirm(){ $('#confirm').classList.remove('on'); cfOk=null; }
/* v2.52 강화 되돌리기 — 쓴 재화의 40%를 돌려받고 강화를 0으로. 폰 전용 홀드 패링은 유지 */
function respecRefund(){ let t=0; UPG.forEach(u=>{ if(u.phoneOnly) return; for(let i=0;i<u.lv;i++) t+=u.cost[i]||0; }); return Math.floor(t*0.4); }
function doRespec(){
  syncMeta(); const back=respecRefund();
  UPG.forEach(u=>{ if(!u.phoneOnly) u.lv=0; });
  META.skill=''; META.skillQ=''; META.skillR=''; META.cur+=back; save();
  $('#cur').textContent=META.cur.toLocaleString(); renderCards(); renderDetail(); renderSkillSel(); renderRecs();
  sfx('heal');
}
function wipe(){ META.cur=0;META.best=0;META.bestCycle=1;META.skill='';META.skillQ='';META.skillR=''; UPG.forEach(u=>u.lv=0); save(); }
load();
/* v2.49 터치 기기면 홀드 패링을 무료로 해금 */
const isTouchDev=()=>(navigator.maxTouchPoints||0)>0||!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
if(isTouchDev()){ const u=UPG.find(x=>x.k==='mparry'); if(u&&u.lv<1){ u.lv=1; save(); } }

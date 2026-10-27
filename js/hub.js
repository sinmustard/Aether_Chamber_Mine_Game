"use strict";
/* ================= HUB ================= */
/* v3.6 스킬트리 — 노드 하나. 원 안에는 레벨, 아래에 이름을 짧게 붙인다 */
/* v3.5 스킬트리(선행 조건)는 유지하되, 화면은 카드 목록으로 되돌렸다 — 노드+연결선 트리가 너무 안 보인다는 피드백 */
function cardHTML(u,i){
  const rMet=reqMet(u);
  return '<div class="card'+(i===sel?' sel':'')+(u.skill?' skill':'')+((u.skill&&!u.lv)||!rMet?' locked':'')+'" data-i="'+i+'"><div class="n">'+u.n+(u.skill&&!u.lv?' · 잠김':'')+'</div>'+
    (rMet?'<div class="s">'+u.s+'</div>':'<div class="s">🔒 '+reqLabel(u)+' 필요</div>')+'<div class="pips">'+
    Array.from({length:u.max},(_,k)=>'<div class="pip'+(k<u.lv?' f':'')+'"></div>').join('')+
    '</div></div>';
}
/* v2.14 강화와 능력을 나눠서 보여준다 */
let skFolder=null;
const SK_SLOTS=[['f','F 스킬','skill'],['q','Q 스킬','skillQ'],['r','R 스킬','skillR']];
const skSlot=u=>u.skill===1?'f':u.skill;
function renderCards(){
  const idx=UPG.map((u,i)=>[u,i]);
  const groups=[['강화', idx.filter(([u])=>!u.skill&&!u.grp)],
                ['생존 / 보급', idx.filter(([u])=>u.grp==='life')]];
  let html=groups.map(([title,list])=>
    list.length? '<div class="grp">'+title+'</div>'+list.map(([u,i])=>cardHTML(u,i)).join('') : ''
  ).join('');
  if(!skFolder){
    html+='<div class="grp">능력 해방 / 강화</div>'+SK_SLOTS.map(([k,t,mk])=>{
      const list=UPG.filter(u=>u.skill&&skSlot(u)===k), got=list.filter(u=>u.lv>0).length;
      const eq=UPG.find(u=>u.k===META[mk]&&u.lv>0);
      return '<div class="card folder" data-skf="'+k+'"><div class="n">'+t+'<i>›</i></div>'+
        '<div class="s">해금 '+got+' / '+list.length+(eq?'<br>장착 · '+eq.n.replace(/^[FQR] · /,''):'<br>장착 없음')+'</div></div>';
    }).join('');
  } else {
    const t=SK_SLOTS.find(s=>s[0]===skFolder)[1];
    html+='<div class="grp">능력 해방 › '+t+'</div><div class="card folder back" data-skf="">'+'<div class="n">‹ 뒤로</div><div class="s">F · Q · R 고르기</div></div>'+
      idx.filter(([u])=>u.skill&&skSlot(u)===skFolder).map(([u,i])=>cardHTML(u,i)).join('');
  }
  $('#cards').innerHTML=html;
}
function renderDetail(){
  const u=UPG[sel],maxed=u.lv>=u.max,cost=maxed?0:u.cost[u.lv],rMet=reqMet(u);
  $('#detail').innerHTML=
    '<h4>'+u.n+' <span style="color:var(--dim);font-size:11px">Lv '+u.lv+' / '+u.max+'</span></h4>'+
    '<div class="eff">'+(u.d||u.s)+'<br><br>현재 <b>'+u.steps[u.lv]+'</b>'+
    (maxed?'':'<br><span class="arrow">↓ 다음</span><br><b>'+u.steps[u.lv+1]+'</b>')+
    (rMet?'':'<br><br><span style="color:var(--red)">🔒 선행 조건: '+reqLabel(u)+'</span>')+'</div>'+
    '<button class="buy" id="buy"'+(maxed||!rMet||cost>META.cur||(u.phoneOnly&&!isTouchDev())?' disabled':'')+'>'+
    (maxed?'MAX':(u.phoneOnly&&!isTouchDev())?'폰 전용':!rMet?'선행 조건 필요':((u.skill&&u.lv===0)?'해금':'강화')+'  ◆ '+cost.toLocaleString())+'</button>';
  const b=$('#buy');
  if(b)b.onclick=()=>{
    if(hubBusy()) return;   // v3.62
    syncMeta();   // v2.46
    if(u.lv>=u.max||!reqMet(u)||u.cost[u.lv]>META.cur||(u.phoneOnly&&!isTouchDev()))return;
    META.cur-=u.cost[u.lv];u.lv++;
    if(u.skill===1&&u.lv===1&&!META.skill) META.skill=u.k;      // 처음 해금한 스킬은 자동 장착
    if(u.skill==='q'&&u.lv===1&&!META.skillQ) META.skillQ=u.k;
    if(u.skill==='r'&&u.lv===1&&!META.skillR) META.skillR=u.k;
    save(); sfx('ui'); renderSkillSel();
    $('#cur').textContent=META.cur.toLocaleString();
    renderCards();renderDetail();
  };
}
function renderSkillSel(){
  const row=(slot,label,opts,cur)=>'<div class="sr"><span>'+label+'</span>'+opts.map(([k,n])=>{
    const ok=!k||lv(k)>0;
    return '<button data-slot="'+slot+'" data-skill="'+k+'"'+(cur===k?' class="on"':'')+(ok?'':' disabled')+'>'+n+(ok?'':' (잠김)')+'</button>';
  }).join('')+'</div>';
  $('#skillSel').innerHTML=
    row('f','F',[['heal','회복'],['guard','방어'],['dash','대시'],['slow','시간 감속'],['shock','충격파'],['absorb','흡수'],['','없음']],META.skill)+
    row('q','Q',[['wall','벽 생성'],['phase','위상 이동'],['hook','구속'],['decoy','미끼'],['gravity','중력장'],['frost','정지장'],['','없음']],META.skillQ)+
    row('r','R',[['overwrite','덮어쓰기'],['echo','복제'],['emp','해킹'],['autoparry','자동 패링'],['nova','반전 폭발'],['blaze','오버클럭'],['','없음']],META.skillR);   // v3.16
}
$('#skillSel').addEventListener('click',e=>{
  const b=e.target.closest('button[data-skill]'); if(!b||b.disabled||hubBusy())return;
  const slot=b.dataset.slot;
  if(slot==='q') META.skillQ=b.dataset.skill;
  else if(slot==='r') META.skillR=b.dataset.skill;
  else META.skill=b.dataset.skill;   // v3.62 예전엔 이 줄이 아래 상성 if의 else라서 Q · R을 고를 때마다 F 칸이 덮어써졌다
  if(META.skillQ==='frost'&&META.skillR==='blaze'){ if(slot==='q') META.skillR=''; else META.skillQ=''; toast('상성 충돌 — 정지장과 오버클럭은 같이 쓸 수 없어요 ('+(slot==='q'?'R':'Q')+' 해제)'); }
  save(); sfx('ui'); renderSkillSel();
});
let debug=false;
/* v2.30 폰에서도 디버그를 켤 수 있게 — HUB 제목을 1.5초 안에 5번 두드리면 전환된다 */
let dbgTaps=0, dbgTapT=0;
$('#hubTitle').addEventListener('click',()=>{
  const now=performance.now();
  if(now-dbgTapT>1500) dbgTaps=0;
  dbgTapT=now; dbgTaps++;
  if(dbgTaps>=5){ dbgTaps=0; toggleDebug(); }
});
/* v2.64 디버그는 개발자 계정만 — 켤 때 서버에 (닉네임 + 비밀번호)로 개발자인지 확인한다. 끄는 건 언제나 가능 */
let devOK=null, devName='';
async function toggleDebug(){
  if(!debug){
    const ss=getSession();
    if(!ss){ flashDbg('개발자 계정으로 로그인해야 디버그를 쓸 수 있어요'); return; }
    if(devOK===null||devName!==ss.name){
      try{ const d=await cloudCall('aether_is_dev',{p_name:ss.name,p_pin:pinOf(ss)}); devOK=(d===true||d==='true'); devName=ss.name; }
      catch(e){ flashDbg('개발자 확인에 실패했어요 (인터넷 연결 확인)'); return; }
    }
    if(!devOK){ flashDbg('디버그는 개발자 계정만 쓸 수 있어요'); return; }
  }
  setDebug(!debug);
}
function flashDbg(t){ if(screen==='game') say(t,'red'); const el=$('#dbgTag'); if(!el) return; el.textContent=' · '+t; el.style.color='var(--red)';
  clearTimeout(flashDbg._t); flashDbg._t=setTimeout(()=>{ el.textContent=debug?'· DEBUG':''; el.style.color=''; },2200); }
const DBG_BAK='aether_dbg_backup';
function dbgBackupGet(){ try{ return JSON.parse(localStorage.getItem(DBG_BAK)||'null'); }catch(e){ return null; } }
function dbgBackupMake(){
  const ss=getSession(), cur=dbgBackupGet();
  if(cur&&cur.dirty&&(!ss||cur.name===ss.name)) return;
  save();
  const cfg={}; SPECS.concat(TOGS).forEach(sp=>cfg[sp.k]=CFG[sp.k]);
  try{ localStorage.setItem(DBG_BAK,JSON.stringify({at:Date.now(),name:ss?ss.name:'',data:JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'),cfg})); }catch(e){}
}
function dbgMarkDirty(){ const b=dbgBackupGet(); if(b&&!b.dirty){ b.dirty=1; try{ localStorage.setItem(DBG_BAK,JSON.stringify(b)); }catch(e){} } }
function dbgDiff(b){
  const d=b.data||{}, m=d.meta||{}, up=d.upg||{}, out=[];
  if((m.cur||0)!==META.cur) out.push('재화 '+META.cur.toLocaleString()+' → '+(m.cur||0).toLocaleString());
  UPG.forEach(u=>{ const was=up[u.k]||0; if(was!==u.lv) out.push(u.n+' '+u.lv+' → '+was); });
  return out;
}
function dbgBackupLabel(){
  const b=dbgBackupGet(), el=$('#dbgRestore'); if(!el) return;
  el.disabled=!b;
  el.textContent=b?'디버그 전으로 복구 ('+new Date(b.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+')':'복구 지점 없음';
}
async function dbgRestore(){
  const b=dbgBackupGet(); if(!b) return;
  const ss=getSession();
  if(b.name&&ss&&b.name!==ss.name){ flashDbg('다른 계정('+b.name+')의 복구 지점이라 되돌릴 수 없어요'); return; }
  const diff=dbgDiff(b), when=new Date(b.at).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  if(!diff.length){ try{ localStorage.removeItem(DBG_BAK); }catch(e){} dbgBackupLabel(); flashDbg('되돌릴 변화가 없어요'); return; }
  if(!confirm('디버그를 켠 시점('+when+')으로 되돌릴까요?\n바뀌는 것 '+diff.length+'개:\n· '+diff.slice(0,8).join('\n· ')+(diff.length>8?'\n· …':'')+'\n\n그 뒤에 직접 찍은 강화도 같이 되돌아가요. 설정(조작 · 소리 · 캐릭터 이미지 등)은 그대로예요.')) return;
  const d=JSON.parse(JSON.stringify(b.data||{})), at=META.cloudAt;
  d.opt=OPT; applySave(d); META.cloudAt=at; save();
  Object.assign(CFG,b.cfg||{}); syncUI();
  try{ localStorage.removeItem(DBG_BAK); }catch(e){}
  setDebug(false);
  if(screen==='hub'){ $('#cur').textContent=META.cur.toLocaleString(); renderCards(); renderDetail(); renderSkillSel(); renderRecs(); }
  const r=await cloudAutoSave();
  flashDbg(r===true?'디버그 전으로 복구했어요':'복구했어요 (서버 저장은 다음 판에)');
  $('#dbgTag').style.color='var(--cyan)';
}
function setDebug(on){
  if(on) dbgBackupMake();
  else { const b=dbgBackupGet(); if(b&&!b.dirty){ try{ localStorage.removeItem(DBG_BAK); }catch(e){} }
    Object.assign(CFG,DBG_DEF); syncUI(); }   // v3.64
  debug=on;
  document.body.classList.toggle('debug',debug);
  const d=$('details.dev'); if(d) d.open=debug;
  $('#dbgTag').textContent=debug?'· DEBUG':'';
  dbgBackupLabel();
  sfx('ui');
}
/* v2.5 몹 확인 모드 — 디버그 중 웨이브 진행과 상관없이 적을 바로 소환해서 스프라이트·크기·패턴을 볼 수 있다 */
$('#debugSpawn').addEventListener('click',e=>{
  const b=e.target.closest('[data-spawn]'); if(!b||screen!=='game'||!run)return;
  const k=b.dataset.spawn;
  if(k==='clear'){ ens.length=0; bullets.length=0; queue.length=0; say('전부 제거','warn'); }
  else{ spawnEnemy(k); say('소환 '+k,'warn'); }
  sfx('ui');
});
$('#debugBtns').addEventListener('click',e=>{
  const b=e.target.closest('[data-dbg]'); if(!b)return;
  const k=b.dataset.dbg;
  if(k==='restore'){ dbgRestore(); return; }
  if(k==='bot'){ openBotPanel(); return; }
  if(k==='cur'||k==='max'||k==='zero') dbgMarkDirty();
  if(k==='cur') META.cur+=10000;
  if(k==='max') UPG.forEach(u=>{ u.lv=u.max; });
  if(k==='zero') UPG.forEach(u=>{ u.lv=0; });
  if(k==='max'){ if(!META.skill)META.skill='heal'; if(!META.skillQ)META.skillQ='wall'; if(!META.skillR)META.skillR='overwrite'; }
  if(k==='zero'){ META.skill=''; META.skillQ=''; META.skillR=''; }
  save(); sfx('ui');
  if(screen==='hub'){ $('#cur').textContent=META.cur.toLocaleString(); renderCards(); renderDetail(); renderSkillSel(); }
});
function renderRecs(){
  $('#recs').innerHTML='최고 점수 <b>'+META.best.toLocaleString()+
    '</b> · 도달 사이클 <b>'+META.bestCycle+'</b>';
}
$('#cards').addEventListener('click',e=>{
  const f=e.target.closest('[data-skf]');
  if(f){ skFolder=f.dataset.skf||null;
    if(skFolder){ const i=UPG.findIndex(u=>u.skill&&skSlot(u)===skFolder); if(i>=0&&!(UPG[sel].skill&&skSlot(UPG[sel])===skFolder)) sel=i; }
    renderCards(); renderDetail(); sfx('ui'); return; }
  const c=e.target.closest('.card'); if(!c)return;
  sel=+c.dataset.i; renderCards(); renderDetail();
});

"use strict";
const BUILD=((document.querySelector('.caption')||{}).textContent||'').match(/v([0-9.]+)/)?.[1]||'0';
const verNum=v=>String(v).split(/[~.]/).slice(0,2).map(Number);   // '2.31~2.33' → [2,31]
const verGt=(a,b)=>{ const x=verNum(a), y=verNum(b); return x[0]!==y[0]? x[0]>y[0] : (x[1]||0)>(y[1]||0); };
/* v2.48 온라인 랭킹 — Supabase 'game lanking' 프로젝트 (공개용 키)
   v3.21 노멀 랭킹 탭은 aether_normal(이름만으로 등록 → 서버에 직접 보내면 사칭 가능) 대신
   로그인 계정으로만 기록되는 aether_verified를 보여 준다 */
const RANK={url:'https://oijsrlbzxowlaxzmsxpt.supabase.co', key:'sb_publishable_m57hm2tIzHx_7GpppTBesg_BL4kNd26', table:'aether_verified'};
const escH=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function rankFetch(limit){
  const r=await fetch(RANK.url+'/rest/v1/'+RANK.table+'?select=name,score,cycle,wave,updated_at&order=score.desc,updated_at.asc&limit='+(limit||50),
    {headers:{apikey:RANK.key}});
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
/* v2.50 같은 이름은 한 줄만 — 서버 함수가 더 높은 점수일 때만 덮어쓴다 */
async function rankSend(row){
  const r=await fetch(RANK.url+'/rest/v1/rpc/submit_aether_normal',{method:'POST',
    headers:{apikey:RANK.key,'Content-Type':'application/json'},
    body:JSON.stringify({p_name:row.name,p_score:row.score,p_cycle:row.cycle,p_wave:row.wave,p_kills:row.kills,p_build:row.build})});
  if(!r.ok) throw new Error('HTTP '+r.status);
  const d=await r.json(); return Array.isArray(d)?d[0]:d;   // {rank, best, updated}
}
const myName=()=>{ try{ return localStorage.getItem('aether_rank_name')||''; }catch(e){ return ''; } };
/* v2.52 클라우드 저장 — 이름 + 비밀번호로 서버에 저장하고, 다른 기기에서 불러온다 */
/* v2.58 계정 — 시작할 때 닉네임 + 비밀번호로 들어가고, 판이 끝날 때·출격할 때 자동으로 서버에 저장한다 */
const SESSION_KEY='aether_session';
let offlineOK=false;
const getSession=()=>{ try{ const d=JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); return d&&d.name&&d.pin?d:null; }catch(e){ return null; } };
function setSession(name,pin){ try{ localStorage.setItem(SESSION_KEY,JSON.stringify({name,pin})); localStorage.setItem('aether_rank_name',name); }catch(e){} }
function clearSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){} }
function applySave(data){
  localStorage.setItem(SAVE_KEY,JSON.stringify(data||{}));
  UPG.forEach(u=>u.lv=0);
  Object.assign(META,{cur:0,best:0,bestCycle:1,skill:'',skillQ:'',skillR:'',stats:{},ach:{},cloudAt:''});
  load();
  if(isTouchDev()){ const u=UPG.find(x=>x.k==='mparry'); if(u&&u.lv<1) u.lv=1; }
  save(); refreshKeyLabels();
}
async function cloudAutoSave(){
  const ss=getSession(); if(!ss) return null;
  try{ save(); const data=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    const at=await cloudCall('aether_cloud_save',{p_name:ss.name,p_pin:ss.pin,p_data:data});
    if(at){ META.cloudAt=String(at); try{ const d2=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'); d2.meta=META; localStorage.setItem(SAVE_KEY,JSON.stringify(d2)); }catch(e){} }   // v2.68
    return true; }
  catch(e){ return badSession(e)?'badpin':false; }
}
function openLogin(){
  $('#modalBox').innerHTML='<div class="logHd"><h4>시작하기</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div class="login"><div class="lead">닉네임과 비밀번호로 시작해요. 처음이면 새로 만들어지고, 다른 기기에서도 같은 닉네임·비밀번호로 이어서 할 수 있어요. '+
    '판이 끝나면 자동으로 저장돼요.</div>'+
    '<input id="lgName" maxlength="12" placeholder="닉네임 (1~12자)" autocomplete="username" value="'+escH(myName())+'">'+
    '<input id="lgPin" type="password" maxlength="20" placeholder="비밀번호 (4~20자)" autocomplete="current-password">'+
    '<button class="go" id="lgGo">시작하기</button><button class="off" id="lgOff">오프라인으로 하기 (저장 안 됨)</button>'+
    '<div class="msg" id="lgMsg"></div></div>';
  $('#modal').classList.add('on');
  const msg=t=>$('#lgMsg').textContent=t;
  const submit=async()=>{
    const name=$('#lgName').value.trim(), pin=$('#lgPin').value;
    if(name.length<1||name.length>12) return msg('닉네임은 1~12자로 써 주세요.');
    if(pin.length<4) return msg('비밀번호는 4자 이상이에요.');
    $('#lgGo').disabled=true; msg('확인 중…');
    try{
      const d=await cloudCall('aether_cloud_load',{p_name:name,p_pin:pin}); const row=Array.isArray(d)?d[0]:d;
      if(row&&row.data){ applySave(row.data); META.cloudAt=String(row.updated_at||''); save(); }   // v2.68
      setSession(name,pin); $('#modal').classList.remove('on'); go('hub');
    }catch(e){
      const m=String(e.message||'');
      if(/없어요/.test(m)){   // 처음 쓰는 닉네임 → 지금 이 기기 진행 상황으로 새 계정
        try{ save(); const data=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
          const at=await cloudCall('aether_cloud_save',{p_name:name,p_pin:pin,p_data:data});
          META.cloudAt=String(at||''); save();   // v2.68
          setSession(name,pin); $('#modal').classList.remove('on'); go('hub'); return;
        }catch(e2){ msg(/비밀번호/.test(String(e2.message))?'이미 있는 닉네임이에요. 비밀번호가 달라요.':'만들지 못했어요. 인터넷 연결을 확인해 주세요.'); }
      } else if(/비밀번호/.test(m)) msg('비밀번호가 달라요.');
      else { msg('서버에 연결하지 못했어요. 인터넷을 확인하거나 오프라인으로 할 수 있어요.'); $('#lgOff').style.display='block'; }
      $('#lgGo').disabled=false;
    }
  };
  $('#lgGo').onclick=submit;
  $('#lgPin').addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
  $('#lgName').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#lgPin').focus(); });
  $('#lgOff').onclick=()=>{ offlineOK=true; $('#modal').classList.remove('on'); go('hub'); };
  setTimeout(()=>{ const el=$('#lgName'); if(el&&!el.value) el.focus(); else if($('#lgPin')) $('#lgPin').focus(); },50);
}
/* v2.68 ① 여러 기기 저장 덮어쓰기 방지 — 다른 기기가 더 늦게 저장했으면 그걸 먼저 불러온다 */
function toast(msg){ let t=document.getElementById('toastBox');
  if(!t){ t=document.createElement('div'); t.id='toastBox'; document.body.appendChild(t); }
  t.textContent=msg; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('on'),3200); }
let syncing=false;
async function syncFromCloud(){
  const ss=getSession(); if(!ss||syncing) return; syncing=true;
  try{
    const st=await cloudCall('aether_cloud_stamp',{p_name:ss.name,p_pin:ss.pin});
    const remote=Date.parse(st)||0, local=Date.parse(META.cloudAt||'')||0;
    if(remote>local+1500){
      const d=await cloudCall('aether_cloud_load',{p_name:ss.name,p_pin:ss.pin}); const row=Array.isArray(d)?d[0]:d;
      if(row&&row.data){ applySave(row.data); META.cloudAt=String(row.updated_at||st); save();
        if(screen==='hub'){ $('#cur').textContent=META.cur.toLocaleString(); renderCards(); renderDetail(); renderSkillSel(); renderRecs(); }
        toast('다른 기기에서 진행한 최신 기록을 불러왔어요'); }
    }
  }catch(e){ badSession(e); } finally{ syncing=false; }
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&screen!=='game') syncFromCloud(); });
async function cloudCall(fn,body){
  const r=await fetch(RANK.url+'/rest/v1/rpc/'+fn,{method:'POST',headers:{apikey:RANK.key,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const txt=await r.text(); let d=null; try{ d=JSON.parse(txt); }catch(e){}
  if(!r.ok){ const er=new Error((d&&d.message)||('HTTP '+r.status)); er.status=r.status; er.code=d&&d.code; throw er; }
  return d;
}
/* v2.76 이 기기에 기억된 비밀번호가 서버와 다르면(28P01 / 403) 계속 실패만 했다 → 로그인을 풀고 다시 입력하게 */
function badSession(e){
  if(!e||!(e.code==='28P01'||(e.status===403&&/비밀번호/.test(String(e.message))))) return false;
  clearSession(); offlineOK=false;
  toast('이 기기에 기억된 비밀번호가 계정과 달라요. HUB에 들어갈 때 다시 로그인해 주세요.');
  return true;
}
function openCloud(){
  $('#modalBox').innerHTML='<div class="logHd"><h4>클라우드 저장</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div class="cloud"><div class="rkNote">같은 이름과 비밀번호를 쓰면 폰과 PC에서 이어서 할 수 있어요. 비밀번호는 잊으면 찾을 수 없어요.</div>'+
    '<input id="cdName" maxlength="12" placeholder="이름 (1~12자)" autocomplete="off" value="'+escH(myName())+'">'+
    '<input id="cdPin" type="password" maxlength="20" placeholder="비밀번호 (4~20자)" autocomplete="off">'+
    '<div class="row2"><button id="cdSave">이 기기 → 저장</button><button id="cdLoad" class="ld">불러와서 덮어쓰기</button></div>'+
    '<div class="msg" id="cdMsg"></div></div>';
  $('#modal').classList.add('on');
  const msg=t=>$('#cdMsg').textContent=t;
  ['#cdName','#cdPin'].forEach(s=>$(s).addEventListener('keydown',e=>e.stopPropagation()));
  $('#cdSave').onclick=async()=>{
    const name=$('#cdName').value.trim(), pin=$('#cdPin').value;
    if(name.length<1||name.length>12) return msg('이름은 1~12자로 써 주세요.');
    if(pin.length<4) return msg('비밀번호는 4자 이상이에요.');
    msg('저장 중…');
    try{ save(); const data=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
      await cloudCall('aether_cloud_save',{p_name:name,p_pin:pin,p_data:data});
      try{ localStorage.setItem('aether_rank_name',name); }catch(e){}
      msg('저장했어요. 다른 기기에서 같은 이름·비밀번호로 불러오세요.');
    }catch(e){ msg(/비밀번호/.test(e.message)?'이미 있는 이름이에요. 비밀번호가 달라요.':'저장하지 못했어요. 잠시 뒤 다시 해 주세요.'); }
  };
  $('#cdLoad').onclick=()=>{
    const name=$('#cdName').value.trim(), pin=$('#cdPin').value;
    if(!name||pin.length<4) return msg('이름과 비밀번호를 써 주세요.');
    askConfirm('불러올까요?','지금 이 기기의 강화·재화·기록이 서버에 저장된 내용으로 바뀌어요.','불러오기',async()=>{
      msg('불러오는 중…');
      try{ const d=await cloudCall('aether_cloud_load',{p_name:name,p_pin:pin}); const row=Array.isArray(d)?d[0]:d;
        if(!row||!row.data) throw new Error('없음');
        localStorage.setItem(SAVE_KEY,JSON.stringify(row.data));
        try{ localStorage.setItem('aether_rank_name',name); }catch(e){}
        msg('불러왔어요. 잠시 뒤 새로고침돼요.'); setTimeout(()=>location.reload(),700);
      }catch(e){ msg(/비밀번호/.test(e.message)?'비밀번호가 달라요.':/없어요|없음/.test(e.message)?'그 이름으로 저장된 데이터가 없어요.':'불러오지 못했어요. 잠시 뒤 다시 해 주세요.'); }
    });
  };
}
/* v2.68 랭킹 탭 */
const rkTabs=cur=>'<div class="optTabs">'+[['normal','노멀'],['hard','하드'],['daily','오늘의 데일리']].map(([k,n])=>'<button data-rtab="'+k+'" class="'+(k===cur?'on':'')+'">'+n+'</button>').join('')+'</div>';
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('[data-rtab]'); if(b){ openRanking(b.dataset.rtab); sfx('ui'); } });
async function openRankTable(tab){
  const hard=tab==='hard', day=todayKST();
  $('#modalBox').innerHTML='<div class="logHd"><h4>'+(hard?'하드 랭킹':'데일리 · '+day)+'</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+rkTabs(tab)+
    '<div class="rkNote">'+(hard?'로그인 계정으로 하드 모드를 한 기록 · 계정당 최고 1줄':'오늘('+day+') 모두 같은 맵·적으로 한 기록 · 강화 없이 기본 능력치')+'</div><ul class="rkList" id="rkList"><li>불러오는 중…</li></ul>';
  $('#modal').classList.add('on');
  try{ const q=hard?'aether_hard?select=name,score,cycle,wave&order=score.desc,updated_at.asc&limit=50'
                   :'aether_daily?select=name,score,cycle,wave&day=eq.'+day+'&order=score.desc,updated_at.asc&limit=50';
    const r=await fetch(RANK.url+'/rest/v1/'+q,{headers:{apikey:RANK.key}}); if(!r.ok) throw 0; const rows=await r.json();
    const me=(getSession()||{}).name||myName();
    $('#rkList').innerHTML=rows.length? rows.map((r,i)=>'<li class="'+(i<3?'top ':'')+(me&&r.name===me?'me':'')+'"><span class="no">'+(i+1)+'</span><span class="nm">'+escH(r.name)+'</span><span class="sc">'+Number(r.score).toLocaleString()+'</span><span class="cw">C'+r.cycle+' · W'+r.wave+'</span></li>').join('')
      : '<li>'+(hard?'아직 하드 기록이 없어요.':'오늘은 아직 기록이 없어요. 첫 번째로 도전해 보세요.')+'</li>';
  }catch(e){ $('#rkList').innerHTML='<li>랭킹을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</li>'; }
}
async function openRanking(tab){
  if(tab==='hard'||tab==='daily') return openRankTable(tab);
  $('#modalBox').innerHTML='<div class="logHd"><h4>에테르 챔버 · 노멀 랭킹</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+rkTabs('normal')+
    '<div class="rkNote">상위 50명 · 로그인 계정으로 한 기록 · 계정당 최고 1줄 · 점수가 같으면 먼저 등록한 사람이 위</div><ul class="rkList" id="rkList"><li>불러오는 중…</li></ul>';
  $('#modal').classList.add('on');
  try{
    const rows=await rankFetch(50), me=(getSession()||{}).name||myName();
    $('#rkList').innerHTML=rows.length? rows.map((r,i)=>
      '<li class="'+(i<3?'top ':'')+(me&&r.name===me?'me':'')+'"><span class="no">'+(i+1)+'</span>'+
      '<span class="nm">'+escH(r.name)+'</span><span class="sc">'+Number(r.score).toLocaleString()+'</span>'+
      '<span class="cw">C'+r.cycle+' · W'+r.wave+'</span></li>').join('')
      : '<li>아직 등록된 기록이 없어요. 첫 번째 주인공이 되어 보세요.</li>';
    /* v2.52 50위 밖이어도 내 순위를 아래에 붙인다 */
    if(me && !rows.some(r=>r.name===me)){
      try{ const r=await fetch(RANK.url+'/rest/v1/rpc/aether_verified_rank',{method:'POST',headers:{apikey:RANK.key,'Content-Type':'application/json'},body:JSON.stringify({p_name:me})});
        const d=r.ok? await r.json():[]; const m=Array.isArray(d)?d[0]:d;
        if(m&&m.rank) $('#rkList').insertAdjacentHTML('beforeend','<li class="me"><span class="no">'+m.rank+'</span><span class="nm">'+escH(me)+'</span>'+
          '<span class="sc">'+Number(m.score).toLocaleString()+'</span><span class="cw">C'+m.cycle+' · W'+m.wave+'</span></li>');
      }catch(e){}
    }
  }catch(e){ $('#rkList').innerHTML='<li>랭킹을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</li>'; }
}
/* 결과 화면 — 디버그를 쓴 판은 등록하지 않는다 */
/* v3.0 공개 랭킹(aether_normal)은 이름만으로 등록돼서 남의 닉네임을 사칭할 수 있었다(이슈 #8).
   비밀번호 없이 이름만 보내는 서버 API라 자유 입력란을 없애고, 로그인 계정 이름으로만 자동 등록한다 */
function setupRankBox(){
  const box=$('#rankBox'), ss=getSession(), hide=()=>{ box.style.display='none'; box.innerHTML=''; };
  if(run.score<=0||run.mode!=='normal'){ hide(); return; }   // v2.68 공개 랭킹은 노멀만 · v3.21 카오스도 제외(#13)
  /* v3.21 노멀 랭킹 결과는 #discStat 한 줄(aether_verified)로 보여 준다.
     aether_normal은 디스코드 봇(#1)이 aether_verified로 옮길 때까지만 화면 표시 없이 계속 올린다 */
  if(ss){ hide();
    if(!run.cheat) rankSend({name:ss.name, score:Math.round(run.score), cycle:run.cycle, wave:run.wave, kills:run.kills, build:BUILD})
      .then(()=>{ run.rankSent=true; }).catch(()=>{});
    return; }
  box.style.display='flex';
  if(run.cheat){ box.innerHTML='<div id="rkMsg">디버그 기능을 쓴 판은 랭킹에 등록할 수 없어요.</div>'; return; }
  box.innerHTML='<div id="rkMsg">노멀 랭킹은 로그인 계정으로만 기록돼요(이름 사칭 방지). '+
    '<button id="rkLogin" style="margin-left:4px;padding:3px 9px;font:inherit;font-size:10.5px;cursor:pointer;background:transparent;color:var(--cyan);border:1px solid var(--cyan);border-radius:6px">로그인</button>'+
    ' — 로그인하면 다음 판부터 자동 기록돼요.</div>';
}
$('#rankBox').addEventListener('click',e=>{ if(e.target&&e.target.id==='rkLogin') openLogin(); });
/* v2.70 ⑤ 업적 — 한 번에 큰 목표 대신 단계별로 점진 증가 (10·30·50·100식) */
const ACH_GROUPS=[
 {id:'boss', name:'보스 격파', get:s=>s.bossKills||0, tiers:[
   {n:1,  r:300, d:'보스를 처음으로 쓰러뜨리기'},
   {n:5,  r:600, d:'보스 5회 격파'},
   {n:15, r:1200,d:'보스 15회 격파'},
   {n:30, r:2000,d:'보스 30회 격파'}]},
 {id:'parry', name:'패링', get:s=>s.parries||0, tiers:[
   {n:10,  r:150, d:'누적 패링 10회'},
   {n:30,  r:250, d:'누적 패링 30회'},
   {n:50,  r:350, d:'누적 패링 50회'},
   {n:100, r:500, d:'누적 패링 100회'},
   {n:300, r:900, d:'누적 패링 300회'},
   {n:1000,r:1600,d:'누적 패링 1,000회'},
   {n:3000,r:2500,d:'누적 패링 3,000회'}]},
 {id:'kill', name:'처치', get:s=>s.kills||0, tiers:[
   {n:50,   r:150, d:'누적 처치 50'},
   {n:150,  r:300, d:'누적 처치 150'},
   {n:500,  r:600, d:'누적 처치 500'},
   {n:1000, r:1000,d:'누적 처치 1,000'},
   {n:3000, r:1800,d:'누적 처치 3,000'},
   {n:10000,r:3000,d:'누적 처치 10,000'}]},
 {id:'cycle', name:'사이클 도달', get:()=>META.bestCycle||1, tiers:[
   {n:2, r:200, d:'한 판에서 2사이클 도달'},
   {n:3, r:400, d:'한 판에서 3사이클 도달'},
   {n:4, r:700, d:'한 판에서 4사이클 도달'},
   {n:5, r:1100,d:'한 판에서 5사이클 도달'},
   {n:7, r:1800,d:'한 판에서 7사이클 도달'}]},
 {id:'ret', name:'왕복', get:s=>s.bestRet||0, tiers:[
   {n:3,  r:150, d:'한 탄환으로 왕복 3번'},
   {n:5,  r:250, d:'한 탄환으로 왕복 5번'},
   {n:10, r:450, d:'한 탄환으로 왕복 10번'},
   {n:20, r:800, d:'한 탄환으로 왕복 20번'},
   {n:30, r:1200,d:'한 탄환으로 왕복 30번'}]},
 {id:'nohit', name:'무결 웨이브', get:s=>s.noHit||0, tiers:[
   {n:10, r:200, d:'피격 없이 넘긴 웨이브 10번'},
   {n:30, r:400, d:'피격 없이 넘긴 웨이브 30번'},
   {n:50, r:650, d:'피격 없이 넘긴 웨이브 50번'},
   {n:100,r:1100,d:'피격 없이 넘긴 웨이브 100번'},
   {n:300,r:2200,d:'피격 없이 넘긴 웨이브 300번'}]},
 {id:'score', name:'점수', get:s=>s.bestScore||0, tiers:[
   {n:10000, r:200, d:'한 판 10,000점'},
   {n:25000, r:450, d:'한 판 25,000점'},
   {n:50000, r:800, d:'한 판 50,000점'},
   {n:100000,r:1500,d:'한 판 100,000점'},
   {n:200000,r:2800,d:'한 판 200,000점'}]},
 {id:'hardboss', name:'하드 보스 격파', get:s=>s.hardBoss||0, tiers:[
   {n:1, r:500, d:'하드 모드에서 보스 격파'},
   {n:3, r:900, d:'하드 모드 보스 3회 격파'},
   {n:10,r:1800,d:'하드 모드 보스 10회 격파'}]},
 {id:'daily', name:'데일리', get:s=>s.dailyRuns||0, tiers:[
   {n:5, r:200, d:'데일리 챌린지 5판'},
   {n:10,r:350, d:'데일리 챌린지 10판'},
   {n:30,r:800, d:'데일리 챌린지 30판'},
   {n:50,r:1300,d:'데일리 챌린지 50판'}]},
 {id:'special', name:'특수 특전', get:s=>s.specials||0, tiers:[
   {n:5, r:150, d:'특수 특전 5번 획득'},
   {n:15,r:350, d:'특수 특전 15번 획득'},
   {n:30,r:650, d:'특수 특전 30번 획득'},
   {n:50,r:1000,d:'특수 특전 50번 획득'}]},
 {id:'play', name:'플레이 시간', get:s=>Math.floor((s.playTime||0)/60), tiers:[   // 분 단위
   {n:60,  r:250, d:'총 플레이 1시간'},
   {n:180, r:600, d:'총 플레이 3시간'},
   {n:300, r:1000,d:'총 플레이 5시간'},
   {n:600, r:1800,d:'총 플레이 10시간'},
   {n:1200,r:3200,d:'총 플레이 20시간'}]}
];
function checkAch(){ const s=META.stats||{}; META.ach=META.ach||{}; const got=[];
  ACH_GROUPS.forEach(g=>{ const v=g.get(s);
    g.tiers.forEach(t=>{ const id=g.id+'_'+t.n;
      if(!META.ach[id]&&v>=t.n){ META.ach[id]=Date.now(); got.push({id,n:t.d,r:t.r}); } }); });
  return got; }
function openAch(){ const s=META.stats||{}; META.ach=META.ach||{};
  let totalDone=0, totalTiers=0;
  const rows=ACH_GROUPS.map(g=>{
    const v=g.get(s);
    totalTiers+=g.tiers.length;
    const next=g.tiers.find(t=>!META.ach[g.id+'_'+t.n]);
    const doneN=g.tiers.filter(t=>META.ach[g.id+'_'+t.n]).length; totalDone+=doneN;
    const last=g.tiers[g.tiers.length-1];
    const goal=next?next.n:last.n, cur=Math.min(v,goal);
    const pips=g.tiers.map(t=>'<i class="'+(META.ach[g.id+'_'+t.n]?'on':'')+'" title="'+t.n.toLocaleString()+'"></i>').join('');
    return '<li class="'+(next?'':'on')+'"><b>'+g.name+' · '+doneN+'/'+g.tiers.length+'</b>'+
      '<span class="rw">'+(next?'◆ '+next.r.toLocaleString():'전 단계 완료')+'</span>'+
      '<span class="dd">'+(next?next.d:last.d)+'</span><span class="pips">'+pips+'</span>'+
      '<span class="bar"><i style="width:'+Math.min(100,Math.round(cur/goal*100))+'%"></i></span><span class="pc">'+cur.toLocaleString()+' / '+goal.toLocaleString()+'</span></li>'; }).join('');
  $('#modalBox').innerHTML='<div class="logHd"><h4>업적 '+totalDone+' / '+totalTiers+'</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<ul class="achList">'+rows+'</ul>';
  $('#modal').classList.add('on'); }
/* v2.68 ⑧ 누적 기록 */
function openStats(){ const s=META.stats||{}; const h=Math.floor((s.playTime||0)/3600), mi=Math.floor((s.playTime||0)%3600/60);
  const rows=[['플레이한 판',(s.runs||0).toLocaleString()],['총 플레이 시간',h+'시간 '+mi+'분'],['누적 패링',(s.parries||0).toLocaleString()],
    ['누적 처치',(s.kills||0).toLocaleString()],['보스 격파',(s.bossKills||0).toLocaleString()],['최고 점수',(Math.max(s.bestScore||0,META.best||0)).toLocaleString()],
    ['최고 사이클',META.bestCycle||1],['최장 왕복','×'+(s.bestRet||0)],['피격 없이 넘긴 웨이브',(s.noHit||0).toLocaleString()],
    ['특수 특전 획득',(s.specials||0).toLocaleString()],['하드 보스 격파',(s.hardBoss||0).toLocaleString()],['데일리 플레이',(s.dailyRuns||0).toLocaleString()]];
  $('#modalBox').innerHTML='<div class="logHd"><h4>누적 기록</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div class="statGrid">'+rows.map(([a,b])=>'<div><span>'+a+'</span><b>'+b+'</b></div>').join('')+'</div>'+
    '<div class="rkNote">로그인 중이면 다른 기기와 함께 이어져요.</div>';
  $('#modal').classList.add('on'); }
function openLog(){
  $('#modalBox').innerHTML='<div class="logHd"><h4>업데이트 내역</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div><div class="log">'+
    CHANGELOG.map(([v,items])=>'<div class="lv'+(v===BUILD?' cur':'')+'"><b>v'+v+'</b><ul>'+
      items.map(t=>'<li>'+t+'</li>').join('')+'</ul></div>').join('')+
    '</div>';
  $('#modal').classList.add('on');
  try{ localStorage.setItem('aether_seen_ver',BUILD); }catch(e){}
  $('#logNew').textContent='';
}
/* 마지막으로 본 버전보다 새 버전이면 타이틀의 업데이트 버튼에 NEW 표시 */
(function(){ try{ const seen=localStorage.getItem('aether_seen_ver');
  if(!seen||verGt(BUILD,seen)) $('#logNew').textContent='NEW'; }catch(e){} })();
/* 배포된 파일의 버전을 확인해서, 지금 실행 중인 것보다 새것이면 새로고침 안내를 띄운다 */
async function checkUpdate(){
  if(!/^https?:/.test(location.protocol)) return;
  try{
    const r=await fetch(location.pathname+'?_='+Date.now(),{cache:'no-store'});
    const t=await r.text();
    const m=t.match(/통합 빌드 v([0-9.]+)/);
    if(m && verGt(m[1],BUILD)){
      $('#updMsg').textContent='새 버전 v'+m[1]+'이(가) 나왔어요. 새로고침하면 적용돼요.';
      $('#updBar').classList.add('on');
    }
  }catch(e){}
}
$('#updGo').onclick=()=>location.reload();
$('#updX').onclick=()=>$('#updBar').classList.remove('on');
setTimeout(checkUpdate,3000);
setInterval(checkUpdate,90000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) checkUpdate(); });
function openModal(kind){
  if(kind==='tutorial'){ openTutorial(); return; }
  if(kind==='log'){ openLog(); return; }   // v2.38
  if(kind==='rank'){ openRanking(); return; }   // v2.48
  if(kind==='ach'){ openAch(); return; }   // v2.68
  if(kind==='stats'){ openStats(); return; }   // v2.68
  if(kind==='appearance'){ openAppearance(); return; }   // v2.89
  const rows=[['효과음','vol',OPT.vol?OPT.vol+'':'끔'],
              ['배경음','bgm',OPT.bgm?OPT.bgm+'':'끔'],                                        // v2.52
              ['화면 흔들림','shake',({0:'끔',0.5:'약하게',1:'보통',1.6:'강하게'})[OPT.shake]||'보통'],   // v2.52
              ['저사양 모드','lowfx',OPT.lowfx?'켬 · 효과 줄임':'끔'],                          // v2.52
              ['색각 보조','cb',OPT.cb?'켬 · 적 탄환 ◆':'끔'],
              ['마우스 가두기','lockMouse',OPT.lockMouse?'켬':'끔'],
              ['입력 여유','inputBuf',({0:'끔',0.08:'짧게',0.12:'보통',0.18:'넉넉히'})[OPT.inputBuf]||'보통'],
              ['피해 숫자','dmgNum',OPT.dmgNum?'켬':'끔']]   // v2.68
              .concat(isTouchDev()?[['패링 방식 (폰)','holdParry',OPT.holdParry?'누르고 있으면 자동':'손 떼면 패링'],
                ['버튼 위치 (폰)','padPos',({bottom:'아래',top:'위',right:'오른쪽',left:'왼쪽'})[OPT.padPos]||'아래'],
                ['조작 좌우 바꾸기 (폰)','swapSticks',OPT.swapSticks?'켬 · 왼쪽 조준 / 오른쪽 이동':'끔'],
                ['이동 조이스틱 고정 (폰)','fixMove',OPT.fixMove?'켬 · 정해진 자리':'끔 · 누른 곳에서 시작'],
                ['패링 조이스틱 고정 (폰)','fixAim',OPT.fixAim?'켬 · 정해진 자리':'끔 · 누른 곳에서 시작'],
                ['스킬 버튼 위치 (폰)','skillRing',OPT.skillRing?'패링 조이스틱 옆':'아래 버튼 줄']]:[]);   // v2.79   // v2.63   // v2.42 · v2.49
  /* v2.68 ⑦ 설정을 탭으로 — 게임 · 조작 · 소리 · 계정 */
  const R2=ks=>ks.map(k=>rows.find(r=>r[1]===k)).filter(Boolean).map(([a,k,v])=>'<div class="opt-row opt-tg" data-opt="'+k+'"><span>'+a+'</span><i>'+v+'</i></div>').join('');
  const tabH='<div class="optTabs">'+[['game','게임'],['ctrl','조작'],['sound','소리'],['acct','계정']].map(([k,n])=>'<button data-otab="'+k+'" class="'+(optTab===k?'on':'')+'">'+n+'</button>').join('')+'</div>';
  const fsRow='<div class="opt-row opt-tg" data-fs="1"><span>전체화면</span><i>'+(document.fullscreenElement?'켬':'끔')+'</i></div>'+
    (escLockable()?'<div class="opt-desc">전체화면에서 ESC를 <b>짧게</b> 누르면 창만 닫히고, <b>길게</b> 누르면 전체화면이 꺼져요.</div>':'');
  const phoneDesc=isTouchDev()?'<div class="opt-desc">패링 방식 — <b>누르고 있으면 자동</b>: 오른쪽 손가락으로 조준하고 있으면 탄환이 들어올 때 알아서 패링해요. '+
      '<b>손 떼면 패링</b>: 조준한 뒤 손을 떼는 순간 패링해요(예전 방식). 누를 때마다 바뀌어요. 자동 방식은 4초 넘게 계속 누르고 있으면 <b>패링 과부하</b>로 잠깐 경직돼요.</div>':'';
  const keyRows=[['패링 키','keyParry',' / 좌클릭'],['F 스킬 키','keySkill',''],['Q 스킬 키','keyWall',''],['R 스킬 키','keyR','']].map(([a,k,suf])=>
      '<div class="opt-row opt-tg" data-bind="'+k+'"><span>'+a+'</span><i>'+(binding===k?'<span style="color:var(--warn)">키를 누르세요… (ESC 취소)</span>':keyName(OPT[k])+suf)+'</i></div>').join('')+
    '<div class="opt-row opt-tg" data-bind="reset"><span>키 설정</span><i>기본값으로</i></div>'+(bindMsg?'<div style="font-size:10.5px;color:var(--red);padding:4px 0">'+bindMsg+'</div>':'');
  const acct='<div class="opt-row opt-tg" data-cloud="1"><span>계정</span><i>'+(getSession()?escH(getSession().name)+' · 로그아웃':'로그인 안 됨 · 로그인')+'</i></div>'+
    '<button class="buy" id="optReset" style="color:var(--red);border-color:var(--line)">저장 데이터 초기화</button>';
  const stickEditRow=isTouchDev()?'<div class="opt-row opt-tg" data-stickedit="1"><span>조이스틱 자리 편집 (폰)</span><i>'+((OPT.posMove||OPT.posAim)?'직접 지정함 · ':'')+'끌어서 옮기기</i></div>':'';   // v2.81
  const pimgRow='<div class="opt-row opt-tg" data-appearance="1"><span>캐릭터 이미지</span><i>'+({off:'기본 원',single:'이미지 1장',"4dir":'4방향 이미지'}[OPT.pimgMode]||'기본 원')+'</i></div>';   // v2.89
  const body=optTab==='ctrl'? R2(['lockMouse','holdParry','fixMove','fixAim'])+stickEditRow+R2(['skillRing','padPos','swapSticks'])+phoneDesc+keyRows
           : optTab==='sound'? R2(['vol','bgm'])
           : optTab==='acct'? acct
           : R2(['shake','lowfx','cb','inputBuf','dmgNum'])+pimgRow+fsRow;
  $('#modalBox').innerHTML='<div class="logHd"><h4>설정</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+tabH+body;
  $('#modal').classList.add('on');
}
$('#modalBox').addEventListener('click',e=>{
  const ot=e.target.closest('[data-otab]'); if(ot){ optTab=ot.dataset.otab; binding=null; bindMsg=''; openModal(); sfx('ui'); return; }   // v2.68
  const r=e.target.closest('[data-opt]');
  const kb=e.target.closest('[data-bind]');
  const fs=e.target.closest('[data-fs]');
  if(fs){ toggleFullscreen(); setTimeout(openModal,150); sfx('ui'); return; }
  if(e.target.closest('[data-stickedit]')){ sfx('ui'); $('#modal').classList.remove('on'); openStickEdit(); return; }   // v2.81
  if(e.target.closest('[data-appearance]')){ sfx('ui'); openAppearance(); return; }   // v2.89
  const pm=e.target.closest('[data-pmode]');
  if(pm){ OPT.pimgMode=pm.dataset.pmode; pimgErr=''; save(); openAppearance(); sfx('ui'); return; }   // v2.89
  const pc=e.target.closest('[data-pimgclear]');
  if(pc){ const d=pc.dataset.pimgclear; clearPImg(d); delete SPRITES[pimgSpriteKey(d)]; openAppearance(); sfx('ui'); return; }   // v2.89
  if(e.target.closest('[data-protate]')){ OPT.pimgRotate=OPT.pimgRotate?0:1; save(); openAppearance(); sfx('ui'); return; }   // v2.91
  if(e.target.closest('[data-panim]')){ OPT.pimgAnimMove=OPT.pimgAnimMove?0:1; save(); openAppearance(); sfx('ui'); return; }   // v3.12
  if(e.target.closest('[data-pbglv]')){ OPT.pimgBgLv=((OPT.pimgBgLv|0)+1)%3; save(); sfx('ui'); reprocessPImgs().then(openAppearance,openAppearance); return; }   // v3.08
  if(e.target.closest('[data-pnobg]')){ OPT.pimgNoBg=OPT.pimgNoBg?0:1; save(); sfx('ui'); reprocessPImgs().then(openAppearance,openAppearance); return; }   // v2.93 · v3.07 원본으로 다시 처리
  if(e.target.closest('[data-cloud]')){ sfx('ui');   // v2.58 계정 — 로그아웃 / 로그인
    if(getSession()) askConfirm('로그아웃할까요?','지금 진행 상황을 서버에 저장한 뒤, 이 기기에서 계정 연결을 풀어요. 다시 시작할 때 닉네임·비밀번호를 입력해요.','로그아웃',
      async()=>{ await cloudAutoSave(); clearSession(); offlineOK=false; $('#modal').classList.remove('on'); go('title'); });
    else { $('#modal').classList.remove('on'); offlineOK=false; openLogin(); }
    return; }   // v2.52   // v3.3 전환 애니메이션 끝나고 라벨 갱신
  if(kb){ const k=kb.dataset.bind; bindMsg='';
    if(k==='reset'){ Object.assign(OPT,KEY_DEFAULT); binding=null; save(); refreshKeyLabels(); sfx('ui'); }
    else binding=(binding===k?null:k);
    openModal(); return; }
  if(r){ const k=r.dataset.opt;
    if(k==='vol') OPT.vol=OPT.vol>=100?0:OPT.vol+20;
    else if(k==='bgm'){ OPT.bgm=OPT.bgm>=100?0:OPT.bgm+20; bgmStart(); bgmApply(); }   // v2.52
    else if(k==='shake'){ const L=[0,0.5,1,1.6]; OPT.shake=L[(L.indexOf(OPT.shake)+1)%L.length]; }   // v2.52
    else if(k==='padPos'){ const L=['bottom','top','right','left']; OPT.padPos=L[(L.indexOf(OPT.padPos)+1)%L.length]; applyPadPos(); }   // v2.63
    else if(k==='inputBuf'){ const L=[0,0.08,0.12,0.18]; OPT.inputBuf=L[(L.indexOf(OPT.inputBuf)+1)%L.length]; }   // v2.42
    else OPT[k]=OPT[k]?0:1;
    if(k==='skillRing'||k==='swapSticks'){ applyPadPos(); ringKey=''; }   // v2.79
    if(k==='lockMouse'&&!OPT.lockMouse) unlockMouse();
    save(); openModal(); sfx('ui'); return; }
  if(e.target.id==='tutClose'){ OPT.tutSeen=1; save(); $('#modal').classList.remove('on'); return; }
  if(e.target.id==='tutPlay'){ OPT.tutSeen=1; save(); $('#modal').classList.remove('on'); startTutorial(); return; }   // v2.60
  if(e.target.id==='optClose'){
    binding=null; bindMsg=''; $('#modal').classList.remove('on');
    if(screen==='game'&&paused&&!$('#pause').classList.contains('on')) togglePause();   // v3.4 · v2.52 일시정지 메뉴에서 연 창은 닫아도 메뉴로 돌아간다
  }
  if(e.target.id==='optReset'){   // v2.51 브라우저 기본 창 대신 게임 안 확인 팝업
    askConfirm('정말로 지우시겠습니까?','강화 · 재화 · 최고 기록 · 장착한 스킬이 모두 사라지고 되돌릴 수 없어요. 로그인 중이면 다음 자동 저장 때 계정 데이터도 초기화돼요. 온라인 랭킹 기록은 지워지지 않아요.','지우기',
      ()=>{ wipe(); $('#modal').classList.remove('on'); go('title'); });
  }
});
/* v2.89 캐릭터 이미지 — 단일 이미지(회전) 또는 4방향 이미지 중 골라서 올린다. 이 기기에만 저장됨 */
let pimgErr='';
function pimgPrevHTML(d,img,cls){   // v3.12 영상이면 시트의 첫 프레임만 보이게 + 프레임 수 배지
  const m=pimgMeta(d);
  if(!m) return '<img src="'+img+'" class="pimgPrev">';
  return '<div class="pimgPrev pimgAnim" style="background-image:url('+img+');background-size:'+(m.n*100)+'% 100%"><b>▶ '+m.n+'</b></div>';
}
function openAppearance(){
  const mode=OPT.pimgMode||'off';
  const modeBtns='<div class="pimgModes">'+
    [['off','기본 원'],['single','이미지 1장'],['4dir','4방향 이미지']].map(([k,n])=>
      '<button data-pmode="'+k+'" class="'+(mode===k?'on':'')+'">'+n+'</button>').join('')+'</div>';
  let body='';
  if(mode==='single'){
    const img=getPImg('single');
    body='<div class="pimgUp"><label class="buy pimgFileBtn">'+(img?'이미지 바꾸기':'이미지 올리기')+
      '<input type="file" accept="image/*,video/*" id="pimgSingle" style="display:none"></label>'+
      (img?pimgPrevHTML('single',img)+'<button class="ghost" data-pimgclear="single">지우기</button>':'')+'</div>'+
      '<div class="opt-row opt-tg" data-protate="1"><span>회전</span><i>'+(OPT.pimgRotate?'바라보는 방향으로 회전':'회전 안 함 · 그대로 표시')+'</i></div>'+
      '<div class="opt-desc">회전을 켜면 올린 이미지가 바라보는 방향에 맞춰 계속 돌아가요. 끄면 이미지가 그대로 고정돼요.</div>';
  } else if(mode==='4dir'){
    body='<div class="pimgGrid">'+['up','down','left','right'].map(d=>{
      const lab={up:'위',down:'아래',left:'왼쪽',right:'오른쪽'}[d], img=getPImg(d);
      return '<div class="pimgSlot"><div class="pimgLab">'+lab+'</div>'+
        (img?pimgPrevHTML(d,img):'<div class="pimgEmpty">없음</div>')+
        '<label class="buy pimgFileBtn">'+(img?'바꾸기':'올리기')+'<input type="file" accept="image/*,video/*" data-pimgdir="'+d+'" style="display:none"></label>'+
        (img?'<button class="ghost" data-pimgclear="'+d+'">지우기</button>':'')+'</div>';
    }).join('')+'</div>'+
    '<div class="opt-desc">4장 다 올려야 적용돼요. 바라보는 방향에 맞는 이미지로 바뀌어 보여요(회전 없음).</div>';
  }
  const hasAnim=['single','up','down','left','right'].some(k=>pimgMeta(k)&&getPImg(k));
  const animRow=mode!=='off'?'<div class="opt-row opt-tg" data-panim="1"><span>영상 캐릭터 재생</span><i>'+(OPT.pimgAnimMove?'움직일 때만':'항상 반복')+'</i></div>'+
    '<div class="opt-desc">이미지 대신 <b>짧은 영상(최대 3초)</b>이나 움짤도 올릴 수 있어요 — 최대 12장으로 잘라서 반복 재생해요.'+(hasAnim?'':' 단색 배경에서 제자리 동작을 찍은 영상이 가장 깔끔해요.')+'</div>':'';
  const tipRow=mode!=='off'?'<div class="opt-desc"><b>올리기 전에</b> — 캐릭터가 이미지의 80% 이상을 차지하도록 가깝게 자른 사진을 올려주세요. 배경이 많이 남으면 가운데를 정사각형으로 잘라서 캐릭터가 작게 나오거나 잘릴 수 있어요.</div>':'';
  const bgRow=mode!=='off'?'<div class="opt-row opt-tg" data-pnobg="1"><span>배경 제거</span><i>'+(OPT.pimgNoBg?'켬':'끔')+'</i></div>'+
    (OPT.pimgNoBg?'<div class="opt-row opt-tg" data-pbglv="1"><span>배경 제거 강도</span><i>'+(['약 · 덜 지움','보통','강 · 그라데이션·빛 효과도'][OPT.pimgBgLv|0]||'보통')+'</i></div>':'')+   // v3.08
    '<div class="opt-desc">올릴 때 테두리에서부터 비슷한 색을 따라 배경을 지워요. 그라데이션·그림자 정도는 괜찮지만, 배경이 피사체만큼 울긋불긋하면 잘 안 될 수 있어요.</div>':'';
  $('#modalBox').innerHTML='<div class="logHd"><h4>캐릭터 이미지</h4><button class="xBtn" id="optClose" title="닫기">✕</button></div>'+
    '<div class="opt-desc">플레이어는 기본적으로 원으로 표시돼요. 이미지를 올리면 바꿀 수 있어요 — 이 브라우저에만 저장되고 다른 기기에는 안 보여요.</div>'+
    modeBtns+tipRow+bgRow+animRow+body+(pimgErr?'<div style="font-size:10.5px;color:var(--red);padding:6px 0">'+pimgErr+'</div>':'');
  $('#modal').classList.add('on');
}
$('#modalBox').addEventListener('change',async e=>{
  const single=e.target.id==='pimgSingle';
  const dir=e.target.dataset&&e.target.dataset.pimgdir;
  if(!single&&!dir) return;
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  pimgErr='';
  const key0=single?'single':dir;
  /* v3.12 영상 · 움짤이면 프레임 시트로 */
  if(/^video\//.test(file.type)||file.type==='image/gif'){
    try{
      const v=/^video\//.test(file.type)?await readPVideoFile(file,!!OPT.pimgNoBg):await readPGifFile(file,!!OPT.pimgNoBg);
      if(v){
        clearPImg(key0);
        const ok=setPImg(key0,v.url)&&setPImg(key0+'_n',v.n+','+v.fps); setPImg(key0+'_o',v.orig);
        if(!ok){ clearPImg(key0); pimgErr='저장 공간이 부족해요 — 다른 방향의 영상을 지우거나 더 짧은 영상을 써 주세요.'; }
        else { applyPImg(key0,v.url); if(v.res&&!v.res.ok) pimgErr='배경이 복잡해서 지우지 않고 원본 그대로 넣었어요.'; sfx('ui'); }
        openAppearance(); return;
      }
    }catch(err){ pimgErr=err&&err.message||'영상을 불러오지 못했어요.'; openAppearance(); return; }
  }
  try{
    try{ localStorage.removeItem(pimgKey(key0+'_n')); }catch(e){}   // 이미지로 바꾸면 영상 정보 지움
    const dataUrl=await readPImgFile(file,!!OPT.pimgNoBg);
    const r=readPImgFile.last;   // v3.06 배경을 못 지웠으면 이유 안내 (그림은 원본 그대로 저장)
    if(r&&!r.ok) pimgErr=r.why==='complex'?'배경이 여러 색이라 지우지 않고 원본 그대로 넣었어요. 단색 배경 이미지를 쓰면 깔끔하게 지워져요.':'캐릭터와 배경 색이 거의 같아서 지우지 않고 원본 그대로 넣었어요.';
    const key=single?'single':dir;
    setPImg(key,dataUrl); applyPImg(key,dataUrl);
    if(readPImgFile.orig) setPImg(key+'_o',readPImgFile.orig);   // v3.07
    sfx('ui');
  }catch(err){ pimgErr='이미지를 불러오지 못했어요.'; }
  openAppearance();
});

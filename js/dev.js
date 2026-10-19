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

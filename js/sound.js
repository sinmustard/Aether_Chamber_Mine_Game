"use strict";
/* ================= 사운드 (WebAudio 합성, 외부 파일 없음) ================= */
let AC=null;
function ac(){
  if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return null;} }
  if(AC.state==='suspended')AC.resume();
  return AC;
}
/* v2.52 배경음 — 외부 파일 없이 합성한 잔잔한 패드 + 느린 아르페지오. 효과음과 볼륨을 따로 쓴다 */
let BGM=null, bgmTimer=null, bgmStep=0;
function bgmStart(){
  const a=ac(); if(!a||BGM) return;
  const out=a.createGain(); out.gain.value=0; out.connect(a.destination);
  const filt=a.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=520; filt.Q.value=3; filt.connect(out);
  [[55,'triangle',.16],[82.41,'sawtooth',.045],[110,'sawtooth',.035]].forEach(([f,ty,gv],i)=>{
    const o=a.createOscillator(); o.type=ty; o.frequency.value=f; o.detune.value=(i-1)*6;
    const g=a.createGain(); g.gain.value=gv; o.connect(g).connect(filt); o.start(); });
  const lfo=a.createOscillator(); lfo.frequency.value=0.06; const lg=a.createGain(); lg.gain.value=280;
  lfo.connect(lg).connect(filt.frequency); lfo.start();
  BGM={out,filt};
  const notes=[220,261.63,329.63,392,329.63,261.63,196,246.94];
  /* v2.68 ⑨ 보스가 있으면 단조 · 두 배 빠른 박자 · 필터를 열어 더 날카롭게 */
  const bossNotes=[196,233.08,293.66,349.23,293.66,233.08,174.61,220];
  let tick=0, wasBoss=false;
  bgmTimer=setInterval(()=>{
    if(!BGM||OPT.bgm<=0||screen!=='game'||paused) return;
    const boss=!!(typeof ens!=='undefined'&&ens&&ens.some(e=>e.grade==='boss'));
    if(boss!==wasBoss){ wasBoss=boss; try{ BGM.filt.frequency.setTargetAtTime(boss?950:520,a.currentTime,0.8); }catch(e){} }
    tick++; if(!boss&&tick%2) return;
    const t=a.currentTime, f=(boss?bossNotes:notes)[bgmStep++%8];
    const o=a.createOscillator(), g=a.createGain(); o.type=boss?'triangle':'sine'; o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime((boss?0.06:0.05)*OPT.bgm/100,t+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,t+(boss?0.45:0.9)); o.connect(g).connect(a.destination); o.start(t); o.stop(t+1);
  },230);
  bgmApply();
}
function bgmApply(){
  if(!BGM) return; const a=ac(); if(!a) return;
  const target=(OPT.bgm/100)*0.45*(screen==='game'&&!paused?1:0.45);
  BGM.out.gain.setTargetAtTime(target,a.currentTime,0.5);
}
addEventListener('pointerdown',()=>bgmStart(),{once:true});
addEventListener('error',e=>{ if(e&&e.message) reportErr('page',e.error||e.message); });   // v2.54
addEventListener('keydown',()=>bgmStart(),{once:true});
function tone(f0,f1,dur,type,gain,delay){
  const a=ac(); if(!a||OPT.vol<=0)return;
  const t=a.currentTime+(delay||0), o=a.createOscillator(), g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  g.gain.setValueAtTime(gain*OPT.vol/100,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t+dur+0.02);
}
function noise(dur,gain){
  const a=ac(); if(!a||OPT.vol<=0)return;
  const n=Math.floor(a.sampleRate*dur), buf=a.createBuffer(1,n,a.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const src=a.createBufferSource(), g=a.createGain();
  src.buffer=buf; g.gain.value=gain*OPT.vol/100; src.connect(g).connect(a.destination); src.start();
}
function sfx(k,n){
  switch(k){
    case 'parry':{ const f=520*Math.pow(1.12,Math.min(n||1,12)); tone(f,f*2,0.12,'square',0.07); tone(f*1.5,f*3,0.08,'sine',0.06,0.03); break; }
    case 'miss':   tone(160,90,0.25,'sawtooth',0.07); break;
    case 'hit':    tone(240,70,0.14,'triangle',0.16); noise(0.06,0.05); break;
    case 'kill':   tone(300,60,0.3,'triangle',0.18); noise(0.18,0.08); break;
    case 'seize':  tone(700,260,0.18,'sawtooth',0.045); break;
    case 'breach': noise(0.22,0.14); tone(120,50,0.25,'square',0.08); break;
    case 'boss':   tone(90,45,0.8,'sawtooth',0.12); tone(135,60,0.8,'square',0.06); break;
    case 'wave':   tone(440,880,0.16,'sine',0.06); break;
    case 'ui':     tone(660,660,0.05,'square',0.04); break;
    case 'heal':   tone(400,800,0.3,'sine',0.08); tone(600,1200,0.3,'sine',0.05,0.08); break;
    case 'guard':  tone(300,600,0.2,'triangle',0.1); tone(450,900,0.15,'sine',0.05,0.05); break;
    case 'block':  tone(900,500,0.08,'square',0.06); break;
    case 'phase':  tone(200,1200,0.35,'sine',0.07); tone(300,1500,0.3,'triangle',0.03,0.05); break;
    case 'wall':   tone(140,90,0.18,'square',0.1); noise(0.08,0.06); break;
    case 'dash':   tone(500,140,0.14,'sawtooth',0.09); break;
    case 'hook':   tone(220,680,0.16,'square',0.08); break;
    case 'overwrite': tone(180,900,0.3,'sawtooth',0.09); tone(260,1300,0.25,'square',0.05,0.05); break;
    case 'echo':   tone(500,650,0.2,'sine',0.07); tone(500,650,0.2,'sine',0.05,0.09); break;
  }
}

function lv(k){ return UPG.find(u=>u.k===k).lv; }
/* v3.5 스킬트리 — 선행 조건 확인 */
const reqMet=u=>!u.req||u.req.every(r=>lv(r.k)>=r.lv);
const reqLabel=u=>(u.req||[]).filter(r=>lv(r.k)<r.lv)
  .map(r=>UPG.find(x=>x.k===r.k).n+' Lv.'+r.lv).join(' · ');
function statsFromUpgrades(){
  const r=lv('range'), f=lv('fov'), pe=lv('penalty'), m=lv('move'), b=lv('bullet'), v=lv('vital'), mu=lv('multi'), hm=lv('homing'), gr=lv('greed'), sp=lv('supply'),
        h=lv('heal'), g=lv('guard'), ph=lv('phase'), wl=lv('wall'), da=lv('dash'), hk=lv('hook'), ow=lv('overwrite'), ec=lv('echo'), em=lv('emp'), ap=lv('autoparry'), as=lv('antiseize'), sl=lv('slow'), sh=lv('shock'), ab=lv('absorb'), dc=lv('decoy'), gv=lv('gravity'), nv=lv('nova');
  return {
    rangeM: 3.2+0.3*r, fov: 55+5*f, whiff: 1.30-0.10*pe,   /* v2.61 기본 스탯 너프 (사거리 3.5→3.2m, 시야 60→55°, 빗나감 1.2→1.3s) */
    moveSpd: 230+15*m,
    accel: 1.20+0.04*b, scoreMul: [1,1.1,1.2,1.35,1.5,1.7][b],
    hpMax: 85+15*v,   /* v2.61 기본 체력 100→85 */ iframe: [0.40,0.45,0.50,0.55,0.60,0.70][v],
    multi: 1+mu,
    homing: [0,0.8,1.4,2.0,2.8,3.6][hm],
    gainMul: 1+0.06*gr, startRewards: sp,   /* v2.65 재화 획득 너프 8%→6% */
    skill: (META.skill&&META.skill!=='phase'&&lv(META.skill)>0)?META.skill:'',
    qSkill: (META.skillQ&&lv(META.skillQ)>0)?META.skillQ:'',
    skillR: (META.skillR&&lv(META.skillR)>0)?META.skillR:'',
    healAmt:[0,18,22,26,30,36][h], healCd:[0,32,30,28,26,24][h],   /* v2.61 회복 너프 */
    guardDur:[0,1.5,1.8,2.1,2.5,3.0][g], guardCd:[0,18,16,14,12,10][g],
    phaseDur:[0,2,2.5,3,3.5,4][ph], phaseCd:[0,16,15,13,12,10][ph],
    wallMax:(META.skillQ==='wall'&&wl>0)?wl:0,
    dashDist:[0,140,155,170,185,200][da], dashCd:[0,8.0,7.4,6.8,6.2,5.5][da],
    hookCd:[0,9.0,8.0,7.0,6.0,5.0][hk], bindDur:[0,.8,1.0,1.2,1.4,1.6][hk],
    seizeMul:[1,.9,.8,.7,.6,.5][as],
    slowDur:[0,2,2.5,3,3.5,4][sl], slowCd:[0,20,18,16,14,12][sl],
    shockR:[0,150,170,190,210,230][sh], shockCd:[0,14,13,12,11,10][sh],
    absorbDur:[0,1.2,1.5,1.8,2.1,2.5][ab], absorbCd:[0,22,20,18,16,14][ab],
    decoyDur:[0,2.5,3,3.5,4,4.5][dc], decoyCd:[0,14,13,12,11,10][dc],
    owCd:[0,26,23,20,17,14][ow], echoCd:[0,22,19,16,13,10][ec],
    /* v2.18 R 슬롯은 충전식 — 장착한 R 스킬의 단계가 오를수록 필요 충전량이 준다 */
    empDur: [0,0.5,0.8,1.5][em],
    autoDur: [0,3,4,5.5][ap],
    gravDur: [0,2.5,3,3.5,4,4.5][gv], gravCd: [0,16,15,14,13,12][gv], novaR: [0,200,240,280][nv],   // v3.16 자동 패링 (폰은 ×2)
    rerolls: lv('reroll'),   // v2.52
    randBoosts: lv('randstat'),   // v2.63
    revives: lv('revive'), waveHeal: 0.05+0.01*lv('waveHeal'), killHeal: lv('killHeal'), shieldPierce: [0,0.2,0.35,0.5][lv('shieldPierce')], reviveHp: 0.05*lv('reviveHp'), specialChance: [0,0.25,0.30,0.35][lv('special')]   /* v2.44 일반 확률 낮춤 */,
    specialBoss: [0,0.38,0.47,0.50][lv('special')],   // v2.47 보스 처치 후 확률
    rNeed: META.skillR==='nova' ? 70 : (META.skillR==='emp'||META.skillR==='autoparry') ? EMP_NEED   // v3.16 자동 패링도 100 고정
         : [50,50,46,42,38,34][ (META.skillR==='overwrite'?ow : META.skillR==='echo'?ec : 0) ]
  };
}

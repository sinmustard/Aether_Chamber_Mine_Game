"use strict";
/* ================= v2.0 웨이브 보상 ================= */
/* 한 판 안에서만 유지되는 성장. HUB 강화(영구)와 구분된다.
   apply 안에서 CFG를 직접 바꾸거나 run.boons 플래그로 동작을 연다 */
const prismUseful=()=>CFG.qSkill==='wall'||!!(run&&allWalls().some(o=>o.prism));
const BOONS=[
 {k:'range', n:'관측 확장', d:'패링 사거리 +0.4m',            max:3, tag:'사거리', moduleTags:["반격"], fn:()=>CFG.rangeM+=0.4},
 {k:'fov',   n:'광각 처리', d:'패링 시야 +12°',               max:3, tag:'시야', moduleTags:["광학"],   fn:()=>CFG.fov=Math.min(180,CFG.fov+12)},
 {k:'calm',  n:'침착',      d:'빗나감 경직 −0.25초',          max:3, tag:'경직', moduleTags:["집중"],   fn:()=>CFG.whiff=Math.max(0,CFG.whiff-0.25)},
 {k:'accel', n:'과충전',    d:'왕복당 가속 +0.10',            max:3, tag:'탄환', moduleTags:["증폭"],   fn:()=>CFG.accel+=0.10},
 {k:'move',  n:'경보',      d:'이동 속도 +25',                max:3, tag:'이동', moduleTags:["기동"],   fn:()=>CFG.moveSpd+=25},
 {k:'vital', n:'예비 회로', d:'최대 체력 +25, 즉시 25 회복',   max:3, tag:'생존', moduleTags:["생명"],   fn:()=>{CFG.hpMax+=25;P.hp=Math.min(CFG.hpMax,P.hp+25);}},
 {k:'iframe',n:'잔상',      d:'피격 무적 +0.15초',            max:2, tag:'생존', moduleTags:["생명"],   fn:()=>CFG.iframe+=0.15},
 {k:'greed', n:'탐욕',      d:'점수 배율 +0.30, 최대 체력 −10',max:2, tag:'점수', moduleTags:["혼돈"],   fn:()=>{CFG.scoreMul+=0.30;CFG.hpMax=Math.max(40,CFG.hpMax-10);P.hp=Math.min(P.hp,CFG.hpMax);}},
 {k:'pierce',n:'관통',      d:'패링한 탄환이 적을 뚫고 지나간다 (레벨당 +1기)', max:3, tag:'탄환', moduleTags:["탄도"], fn:()=>{}},
 {k:'shard', n:'파편',      d:'명중 시 주변 적에게 0.5칸 추가 피해',  max:2, tag:'탄환', moduleTags:["폭발"], fn:()=>{}},
 {k:'grit',  n:'집념',      d:'왕복 3회 이상 탄환의 피해 배율 (레벨당 +100%p, 1중첩 ×2·2중첩 ×3)',  max:2, tag:'탄환', moduleTags:["증폭"],   fn:()=>{}},
 {k:'flow',  n:'무결',      d:'패링에 성공하면 회복 경직이 없다', max:1, tag:'경직', moduleTags:["반격"], fn:()=>{}},
 {k:'multi', n:'분배',      d:'한 번에 빼앗는 탄환 +1',        max:1, tag:'패링', moduleTags:["반격"],   fn:()=>CFG.multi+=1},
 /* v3.1 웨이브 보상 3종 추가 */
 {k:'overload', n:'회로 과부하', d:'장착한 F·Q 스킬의 재사용 대기시간 −10%', max:3, tag:'스킬', moduleTags:["스킬"],
  fn:()=>{ SKILL_CD_KEYS.forEach(k=>{ if(CFG[k]) CFG[k]*=0.9; }); CFG.cdrMul=(CFG.cdrMul||1)*0.9; }},   // v3.55 새 스킬 · 벽 생성도 포함
 {k:'stable',   n:'안정화',      d:'적의 재탈취 확률 −10%',                    max:3, tag:'탄환', moduleTags:["탄도"], fn:()=>CFG.seizeMul*=0.9},
 {k:'aftershock',n:'여진',       d:'적 처치 시 주변 적에게 0.4칸 추가 피해',     max:2, tag:'탄환', moduleTags:["폭발"], fn:()=>{}},
 {k:'leech',     n:'처치 회복',   d:'적을 처치할 때마다 체력 +2 (보스는 +10), 최대 3중첩',  max:3, tag:'생존', moduleTags:["생명"],   fn:()=>{}},
 {k:'counter',   n:'역습',        d:'맞으면 2초 동안 이동 속도 +40 · 패링 사거리 +0.4m (레벨당)',  max:2, tag:'생존', moduleTags:["반격"],   fn:()=>{}},   // v3.50
 {k:'fury',      n:'분노',        d:'맞을 때마다 R 충전 +5 (레벨당)',                          max:2, tag:'스킬', moduleTags:["스킬"],   fn:()=>{}},   // v3.50
 {k:'reroll',    n:'새로고침 +1', d:'보상 새로고침 횟수 +1',                     max:3, tag:'보급',   fn:()=>{run.rerolls=(run.rerolls||0)+1;}},   // v2.52
 {k:'prismdur',  n:'프리즘 공명', d:'프리즘 벽이 내 탄을 가를 수 있는 횟수 +1',  max:3, tag:'프리즘', moduleTags:["프리즘"], req:'Q 스킬이 벽이거나 맵에 프리즘이 있을 때', ok:()=>prismUseful(), fn:()=>{}},
 {k:'decoyabs',  n:'미끼 흡수',   d:'미끼가 주변 적 탄을 빨아들임 — 대신 시간이 아니라 체력으로 버팀 (체력 6, 탄 1발에 −1)', max:1, tag:'미끼', moduleTags:["미끼"], req:'Q 스킬이 미끼일 때', ok:()=>CFG.qSkill==='decoy', fn:()=>{}}
];
/* v2.37 특수 특전 — 생존 트리의 '특수 특전'을 찍으면 웨이브 보상에 확률로 하나 섞여 나온다 */
const SPECIALS=[
 {k:'s_revive', n:'재기동',      d:'이번 판 부활 횟수 +1',                               max:3, tag:'특수 특전', sp:1, fn:()=>{run.revives++;}},
 {k:'s_boss',   n:'거인 사냥꾼', d:'보스에게 주는 피해 +50%',                              max:1, tag:'특수 특전', moduleTags:["증폭","탄도"], sp:1, extra:{d:"방패 관통 확률 +8%p",fn:()=>CFG.shieldPierce=Math.min(0.75,CFG.shieldPierce+0.08)}, fn:()=>{}},
 {k:'s_revhp',  n:'강인한 재기', d:'부활할 때 체력 +15%',                                  max:1, tag:'특수 특전', moduleTags:["생명","보급"], sp:1, extra:{d:"웨이브 종료 시 최대 체력 회복 +2%p",fn:()=>CFG.waveHeal+=0.02}, fn:()=>{run.reviveHp=(run.reviveHp||0)+0.15;}},
 {k:'s_homing', n:'추적 회로',   d:'유도 +2.0, 유도 시간 1.4초 → 3초',                       max:1, tag:'특수 특전', moduleTags:["광학","탄도"], sp:1, extra:{d:"반격탄의 왕복당 가속 +0.06",fn:()=>CFG.accel+=0.06}, fn:()=>{CFG.homing+=2.0; CFG.homeTime+=1.6;}},
 {k:'s_focus',  n:'패링 집중',   d:'패링에 성공하면 3초 동안 빗나감 페널티가 75% 줄어든다', max:1, tag:'특수 특전', moduleTags:["반격","집중"], sp:1, extra:{d:"패링 실패 경직 기본값 −0.10초",fn:()=>CFG.whiff=Math.max(0,CFG.whiff-0.10)}, fn:()=>{}},
 /* v2.43 점수 배율 — 한 번만 얻을 수 있다 */
 {k:'s_score',  n:'고득점 회로', d:'이번 판 점수 배율 ×1.35',                              max:1, tag:'특수 특전', moduleTags:["증폭","혼돈"], sp:1, extra:{d:"탄환 치명타 확률 +6%p (피해 ×1.8)",fn:()=>run.cartridgeCritBonus=0.06}, fn:()=>{CFG.scoreMul*=1.35;}},
 /* v2.45 패링 범위 — 각각 한 번만 */
 {k:'s_range',  n:'장거리 감응', d:'패링 사거리 +20%',                                     max:1, tag:'특수 특전', moduleTags:["반격","집중"], sp:1, extra:{d:"패링 실패 경직 기본값 −0.12초",fn:()=>CFG.whiff=Math.max(0,CFG.whiff-0.12)}, fn:()=>{CFG.rangeM*=1.2;}},
 {k:'s_fov',    n:'광역 감응',   d:'패링 시야각 +25°',                                     max:1, tag:'특수 특전', moduleTags:["광학","반격"], sp:1, extra:{d:"패링 사거리 +0.20m",fn:()=>CFG.rangeM+=0.2}, fn:()=>{CFG.fov=Math.min(180,CFG.fov+25);}},
 {k:'s_prismsplit', n:'분광',   d:'프리즘 벽에서 갈라지는 탄환 +2 (피해를 합치면 그대로)',   max:1, tag:'특수 특전', moduleTags:["프리즘","탄도"], sp:1, extra:{d:"방패 관통 확률 +8%p",fn:()=>CFG.shieldPierce=Math.min(0.75,CFG.shieldPierce+0.08)}, req:'Q 스킬이 벽이거나 맵에 프리즘이 있을 때', ok:()=>prismUseful(), fn:()=>{}},
 {k:'s_prismdur',   n:'강화 프리즘', d:'프리즘 벽이 내 탄을 가를 수 있는 횟수 +3',      max:1, tag:'특수 특전', moduleTags:["프리즘","보급"], sp:1, extra:{d:"장착 시 최대 체력의 15% 회복, 이후 웨이브 종료 회복량 +1%p",fn:()=>{CFG.waveHeal+=0.01;P.hp=Math.min(CFG.hpMax,P.hp+Math.round(CFG.hpMax*0.15));}}, req:'Q 스킬이 벽이거나 맵에 프리즘이 있을 때', ok:()=>prismUseful(), fn:()=>{}},
 {k:'s_decoyhp',    n:'미끼 강화',   d:'미끼 체력 +6 (자폭 미끼면 탄 6발 분량)',   max:1, tag:'특수 특전', moduleTags:["미끼","생명"], sp:1, extra:{d:"최대 체력 +15, 즉시 15 회복",fn:()=>{CFG.hpMax+=15;P.hp=Math.min(CFG.hpMax,P.hp+15);}}, req:'Q 스킬이 미끼이고 「미끼 흡수」를 가졌을 때', ok:()=>CFG.qSkill==='decoy'&&boonLv('decoyabs')>0, fn:()=>{ if(P.decoyHp!=null){ const v=P.decoyBomb?6*decoyHitDmg({}):6; P.decoyHp+=v; P.decoyHpMax+=v; } }},
 {k:'s_decoybomb',  n:'자폭 미끼',   d:'미끼 체력이 내 체력과 같아짐 (흡수한 탄 피해만큼 깎임) · 미끼가 서 있을 때 Q를 다시 누르면 폭발해 흡수한 탄을 사방으로 뱉음 (내 탄) · 대신 미끼 재사용 대기 ×1.5', max:1, tag:'특수 특전', moduleTags:["미끼","폭발"], sp:1, extra:{d:"자폭 미끼가 뿜는 탄환 피해 ×1.25",fn:()=>run.cartridgeDecoyDamage=1.25}, req:'Q 스킬이 미끼이고 「미끼 흡수」를 가졌을 때', ok:()=>CFG.qSkill==='decoy'&&boonLv('decoyabs')>0, fn:()=>{}},
 {k:'s_mirror',     n:'거울 반사',   d:'거울 벽이 내 탄을 튕겨 냄 (벽 반사 강화가 없어도) · 거울에 튕길 때마다 그 탄의 피해 +50% (최대 ×3)', max:1, tag:'특수 특전', moduleTags:["탄도","증폭"], sp:1, extra:{d:"2왕복 이상 탄환 피해 +8%p",fn:()=>CFG.rallyDmg+=0.08}, req:'맵에 거울 벽이 있을 때', ok:()=>!!(run&&run.mapWalls&&run.mapWalls.some(o=>o.mirror)), fn:()=>{}}
];
const CARTRIDGE_MODULES=[
 ['lens','코팅 렌즈','광학','패링 시야 +8°',()=>CFG.fov=Math.min(180,CFG.fov+8)],
 ['guide','레이저 추적기','광학','탄환 유도 +0.35',()=>CFG.homing+=0.35],
 ['track','추적 렌즈','광학','탄환 유도 시간 +0.4초',()=>CFG.homeTime+=0.4,()=>CFG.homing>0],
 ['rally_amp','왕복 증폭기','증폭','2왕복 이상 반격탄 피해 +10%p',()=>CFG.rallyDmg+=0.10],
 ['fine_lock','정밀 조정기','집중','패링 실패 경직 −0.12초',()=>CFG.whiff=Math.max(0,CFG.whiff-0.12)],
 ['quick_parry','정밀 복귀','집중','패링 성공 후 경직 −15%'],
 ['fast_reset','복귀 회로','집중','스킬 재사용 대기시간 −5%',()=>{
   SKILL_CD_KEYS.forEach(k=>CFG[k]*=0.95); CFG.cdrMul*=0.95;
 },()=>!!(CFG.skill||CFG.qSkill||CFG.skillR)],
 ['light_step','경량 구동부','기동','이동 속도 +16',()=>CFG.moveSpd+=16],
 ['dash_rail','대시 레일','기동','대시 거리 +24',()=>CFG.dashDist+=24,()=>CFG.skill==='dash'],
 ['dash_reset','대시 복귀기','기동','대시 재사용 대기시간 −0.8초',()=>CFG.dashCd=Math.max(1,CFG.dashCd-0.8),()=>CFG.skill==='dash'],
 ['phase_drive','위상 구동부','기동','위상 이동 지속 +0.5초',()=>CFG.phaseDur+=0.5,()=>CFG.qSkill==='phase'],
 ['phase_reset','위상 복귀기','기동','위상 이동 재사용 대기시간 −1초',()=>CFG.phaseCd=Math.max(1,CFG.phaseCd-1),()=>CFG.qSkill==='phase'],
 ['wave_med','자동 정비기','생명','웨이브 회복량 +2%p',()=>CFG.waveHeal+=0.02],
 ['salvage','회수 회로','재화','이번 판 HUB 재화 +8%',()=>CFG.gainMul*=1.08],
 ['kill_salvage','잔해 선별기','재화','적 처치 재화 +20%'],
 ['wave_salvage','구역 수거기','재화','웨이브 재화 +25%'],
 ['boss_salvage','거대 잔해 회수기','재화','보스 격파 재화 +20%'],
 ['score_salvage','성과 환전기','재화','점수 재화 +8%'],
 ['hit_salvage','충돌 회수기','재화','탄환 명중 5회당 재화 +1'],
 ['impact_blast','충격 파편','폭발','탄환 명중 시 주변 적에게 0.2칸 피해'],
 ['chain_blast','연쇄 기폭기','폭발','적 처치 시 주변 적에게 0.2칸 피해'],
 ['wide_blast','확산 화약','폭발','명중과 처치 폭발 반경 +20',undefined,()=>!!(boonLv('shard')||boonLv('aftershock')||boonLv('impact_blast')||boonLv('chain_blast'))],
 ['r_cap','에테르 축전기','스킬','R 스킬 필요 충전량 −4',()=>CFG.rNeed=Math.max(1,CFG.rNeed-4),()=>!!CFG.skillR],
 ['parry_cell','패링 전지','스킬','탄환 패링 성공 시 R 추가 충전 +1',undefined,()=>!!CFG.skillR],
 ['r_reserve','예비 축전지','스킬','R 스킬 필요 충전량 −2',()=>CFG.rNeed=Math.max(1,CFG.rNeed-2),()=>!!CFG.skillR],
 ['guard_plate','가드 증폭판','스킬','가드 지속 +0.4초',()=>CFG.guardDur+=0.4,()=>CFG.skill==='guard'],
 ['shock_coil','충격장 코일','스킬','충격파 반경 +25',()=>CFG.shockR+=25,()=>CFG.skill==='shock'],
 ['absorb_cell','흡수장 전지','스킬','흡수장 지속 +0.4초',()=>CFG.absorbDur+=0.4,()=>CFG.skill==='absorb'],
 ['roll_supply','보급 트레이','보급','새로고침이 없을 때 4웨이브마다 1회 보충'],
 ['guard_supply','가드 보조 전원','보급','가드 재사용 대기시간 −1.2초',()=>CFG.guardCd=Math.max(1,CFG.guardCd-1.2),()=>CFG.skill==='guard'],
 ['heal_supply','의무 보급 회로','보급','회복 스킬 회복량 +8',()=>CFG.healAmt+=8,()=>CFG.skill==='heal'],
 ['wall_supply','벽 설치 보급함','보급','설치 가능한 벽 수 +1',()=>CFG.wallMax++,()=>CFG.qSkill==='wall'],
 ['prism_shell','프리즘 외장','프리즘','프리즘 내구도 +2',undefined,prismUseful],
 ['prism_align','분광 정렬기','프리즘','분열탄 사이 각도 −20%',undefined,prismUseful],
 ['prism_power','굴절 증폭기','프리즘','분열탄 피해 +12%',undefined,prismUseful],
 ['decoy_timer','잔류 홀로그램','미끼','미끼 지속 +1초',()=>CFG.decoyDur+=1,()=>CFG.qSkill==='decoy'],
 ['decoy_battery','미끼 보조 전지','미끼','미끼 재사용 대기시간 −1.2초',()=>CFG.decoyCd=Math.max(1,CFG.decoyCd-1.2),()=>CFG.qSkill==='decoy'],
 ['decoy_pull','미끼 집속기','미끼','흡수 미끼 탄환 유인 반경 +25',undefined,()=>CFG.qSkill==='decoy'&&boonLv('decoyabs')>0],
 ['chaos_crit','요동 증폭기','혼돈','탄환 명중 시 15% 확률로 피해 ×1.8'],
 ['chaos_roll','불안정 탄심','혼돈','명중 피해가 ×0.8~×1.3으로 변동'],
 ['chaos_trade','과열 절연체','혼돈','점수 배율 ×1.18, 받는 피해 +8%',()=>{CFG.scoreMul*=1.18; run.diff*=1.08;}],
 ['chaos_step','불규칙 구동부','혼돈','이동 속도 +9%, 패링 실패 경직 +0.12초',()=>{CFG.moveSpd*=1.09; CFG.whiff+=0.12;}]
].map(([k,n,tag,d,fn=()=>{},ok])=>({k,n,tag,d,fn,ok,max:1,moduleTags:[tag]}));
const boonDef=k=>BOONS.find(x=>x.k===k)||SPECIALS.find(x=>x.k===k)||CARTRIDGE_MODULES.find(x=>x.k===k);
const boonLv=k=>(run&&run.boons&&run.boons[k])||0;

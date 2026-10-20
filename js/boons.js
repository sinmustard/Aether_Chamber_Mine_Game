"use strict";
/* ================= v2.0 웨이브 보상 ================= */
/* 한 판 안에서만 유지되는 성장. HUB 강화(영구)와 구분된다.
   apply 안에서 CFG를 직접 바꾸거나 run.boons 플래그로 동작을 연다 */
const BOONS=[
 {k:'range', n:'관측 확장', d:'패링 사거리 +0.4m',            max:3, tag:'사거리', fn:()=>CFG.rangeM+=0.4},
 {k:'fov',   n:'광각 처리', d:'패링 시야 +12°',               max:3, tag:'시야',   fn:()=>CFG.fov=Math.min(180,CFG.fov+12)},
 {k:'calm',  n:'침착',      d:'빗나감 경직 −0.25초',          max:3, tag:'경직',   fn:()=>CFG.whiff=Math.max(0,CFG.whiff-0.25)},
 {k:'accel', n:'과충전',    d:'왕복당 가속 +0.10',            max:3, tag:'탄환',   fn:()=>CFG.accel+=0.10},
 {k:'move',  n:'경보',      d:'이동 속도 +25',                max:3, tag:'이동',   fn:()=>CFG.moveSpd+=25},
 {k:'vital', n:'예비 회로', d:'최대 체력 +25, 즉시 25 회복',   max:3, tag:'생존',   fn:()=>{CFG.hpMax+=25;P.hp=Math.min(CFG.hpMax,P.hp+25);}},
 {k:'iframe',n:'잔상',      d:'피격 무적 +0.15초',            max:2, tag:'생존',   fn:()=>CFG.iframe+=0.15},
 {k:'greed', n:'탐욕',      d:'점수 배율 +0.30, 최대 체력 −10',max:2, tag:'점수',   fn:()=>{CFG.scoreMul+=0.30;CFG.hpMax=Math.max(40,CFG.hpMax-10);P.hp=Math.min(P.hp,CFG.hpMax);}},
 {k:'pierce',n:'관통',      d:'패링한 탄환이 적을 뚫고 지나간다 (레벨당 +1기)', max:3, tag:'탄환', fn:()=>{}},
 {k:'shard', n:'파편',      d:'명중 시 주변 적에게 0.5칸 추가 피해',  max:2, tag:'탄환', fn:()=>{}},
 {k:'grit',  n:'집념',      d:'왕복 3회 이상 탄환의 피해 배율 (레벨당 +100%p, 1중첩 ×2·2중첩 ×3)',  max:2, tag:'탄환',   fn:()=>{}},
 {k:'flow',  n:'무결',      d:'패링에 성공하면 회복 경직이 없다', max:1, tag:'경직', fn:()=>{}},
 {k:'multi', n:'분배',      d:'한 번에 빼앗는 탄환 +1',        max:1, tag:'패링',   fn:()=>CFG.multi+=1},
 /* v3.1 웨이브 보상 3종 추가 */
 {k:'overload', n:'회로 과부하', d:'장착한 스킬(F·Q·R)의 재사용 대기시간 −10%', max:3, tag:'스킬',
  fn:()=>{ SKILL_CD_KEYS.forEach(k=>{ if(CFG[k]) CFG[k]*=0.9; }); CFG.cdrMul=(CFG.cdrMul||1)*0.9; }},   // v3.55 새 스킬 · 벽 생성도 포함
 {k:'stable',   n:'안정화',      d:'적의 재탈취 확률 −10%',                    max:3, tag:'탄환', fn:()=>CFG.seizeMul*=0.9},
 {k:'aftershock',n:'여진',       d:'적 처치 시 주변 적에게 0.4칸 추가 피해',     max:2, tag:'탄환', fn:()=>{}},
 {k:'leech',     n:'처치 회복',   d:'적을 처치할 때마다 체력 +3 (보스는 +12), 최대 3중첩',  max:3, tag:'생존',   fn:()=>{}},
 {k:'counter',   n:'역습',        d:'맞으면 2초 동안 이동 속도 +40 · 패링 사거리 +0.4m (레벨당)',  max:2, tag:'생존',   fn:()=>{}},   // v3.50
 {k:'fury',      n:'분노',        d:'맞을 때마다 R 충전 +5 (레벨당)',                          max:2, tag:'스킬',   fn:()=>{}},   // v3.50
 {k:'reroll',    n:'새로고침 +1', d:'보상 새로고침 횟수 +1',                     max:3, tag:'보급',   fn:()=>{run.rerolls=(run.rerolls||0)+1;}}   // v2.52
];
/* v2.37 특수 특전 — 생존 트리의 '특수 특전'을 찍으면 웨이브 보상에 확률로 하나 섞여 나온다 */
const SPECIALS=[
 {k:'s_revive', n:'재기동',      d:'이번 판 부활 횟수 +1',                               max:3, tag:'특수 특전', sp:1, fn:()=>{run.revives++;}},
 {k:'s_boss',   n:'거인 사냥꾼', d:'보스에게 주는 피해 +50%',                              max:1, tag:'특수 특전', sp:1, fn:()=>{}},
 {k:'s_revhp',  n:'강인한 재기', d:'부활할 때 체력 +15%',                                  max:1, tag:'특수 특전', sp:1, fn:()=>{run.reviveHp=(run.reviveHp||0)+0.15;}},
 {k:'s_homing', n:'추적 회로',   d:'유도 +2.0, 유도 시간 1.4초 → 3초',                       max:1, tag:'특수 특전', sp:1, fn:()=>{CFG.homing+=2.0; CFG.homeTime+=1.6;}},
 {k:'s_focus',  n:'패링 집중',   d:'패링에 성공하면 3초 동안 빗나감 페널티가 75% 줄어든다', max:1, tag:'특수 특전', sp:1, fn:()=>{}},
 /* v2.43 점수 배율 — 한 번만 얻을 수 있다 */
 {k:'s_score',  n:'고득점 회로', d:'이번 판 점수 배율 ×1.35',                              max:1, tag:'특수 특전', sp:1, fn:()=>{CFG.scoreMul*=1.35;}},
 /* v2.45 패링 범위 — 각각 한 번만 */
 {k:'s_range',  n:'장거리 감응', d:'패링 사거리 +20%',                                     max:1, tag:'특수 특전', sp:1, fn:()=>{CFG.rangeM*=1.2;}},
 {k:'s_fov',    n:'광역 감응',   d:'패링 시야각 +25°',                                     max:1, tag:'특수 특전', sp:1, fn:()=>{CFG.fov=Math.min(180,CFG.fov+25);}}
];
const boonDef=k=>BOONS.find(x=>x.k===k)||SPECIALS.find(x=>x.k===k);
const boonLv=k=>(run&&run.boons&&run.boons[k])||0;

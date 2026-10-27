// 게임을 실제 브라우저로 돌려 보는 테스트 묶음. 서버는 전부 가짜(lib.js fakeSupabase)
const { TOKEN, wait, openGame, click, visible, screens, toHub, launchRun, finishRun, submits } = require('./lib');

const playKeys = async (page, n) => {   // 이동 · 조준 · 패링 · 스킬을 대충 섞어 누른다
  const box = await page.locator('#gamecv').boundingBox(), ks = ['w', 'd', 's', 'a'];
  for (let i = 0; i < n; i++) {
    await page.keyboard.down(ks[i % 4]);
    await page.mouse.move(box.x + box.width * (0.2 + 0.6 * Math.random()), box.y + box.height * (0.2 + 0.6 * Math.random()));
    await page.keyboard.press('e'); if (i % 6 === 3) for (const k of ['f', 'q', 'r', 'Enter']) await page.keyboard.press(k);
    await wait(200); await page.keyboard.up(ks[i % 4]);
    if (await visible(page, '#reward')) await page.locator('#rwRow > *').first().click({ timeout: 1000 }).catch(() => {});
  }
};
const noErrors = (t, g, where) => t.ok(g.errors.length === 0, where + ' 오류 없음', g.errors.join(' | '));

module.exports = {
  async '기본 흐름: 타이틀 → HUB → 출격 → 전투 → 일시정지 → HUB'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page;
    t.eq(await screens(p), 'title', '타이틀 화면');
    await toHub(p); t.eq(await screens(p), 'hub', 'HUB 진입');
    await launchRun(p); t.eq(await screens(p), 'game', '출격');
    await playKeys(p, 25);
    await p.keyboard.press('Escape'); await wait(400);
    if (await screens(p) === 'game') {   // 그새 죽었으면 결과 화면
      t.ok(await visible(p, '#pause'), '일시정지 메뉴');
      await p.click('#pmHub'); await wait(400); if (await visible(p, '#cfYes')) await p.click('#cfYes'); await wait(1000);
      t.eq(await screens(p), 'hub', '일시정지 → HUB');
    }
    noErrors(t, g, '기본 흐름'); await p.close();
  },

  async '메뉴 · 튜토리얼 · 모드 · 디버그'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page;
    for (const m of ['opt', 'rank', 'ach', 'stats', 'log']) {
      await click(p, '#title [data-modal=' + m + ']'); await wait(500);
      t.ok(await visible(p, '#modal.on'), '창 열림: ' + m);
      await p.evaluate(() => $('#modal').classList.remove('on')); await wait(150);
    }
    await click(p, '#title [data-modal=tutorial]'); await wait(400);
    if (await visible(p, '#tutPlay')) await p.click('#tutPlay'); await wait(1200);
    t.eq(await screens(p), 'game', '튜토리얼 시작'); await playKeys(p, 10);
    await p.evaluate(() => { if (typeof endTutorial === 'function') endTutorial('title'); else go('title'); }); await wait(800);
    await toHub(p);
    for (const mode of ['hard', 'daily']) {
      await launchRun(p, mode); t.eq(await p.evaluate(() => run.mode), mode, mode + ' 출격');
      await playKeys(p, 8); await p.evaluate(() => { paused = false; go('hub'); }); await wait(900);
    }
    await p.evaluate(() => document.body.classList.add('debug'));
    await launchRun(p, 'normal'); await playKeys(p, 5);
    t.ok(await p.locator('#debugBtns').count() > 0, '디버그 패널 있음');
    noErrors(t, g, '메뉴 · 모드'); await p.close();
  },

  async '랭킹: 노멀 탭은 인증 랭킹, 모드별 결과 기록'(t, { browser, url }) {
    const rows = [{ name: '봉봉', score: 9000, cycle: 3, wave: 2, build: '3.24-chaos' }, { name: 'Cheese', score: 3312, cycle: 1, wave: 7, build: '3.17' }];
    let g = await openGame(browser, url, { supabase: { rows } }), p = g.page;
    await click(p, '#title [data-modal=rank]'); await wait(800);
    t.ok(g.calls.some(c => c.fn === 'GET:aether_verified'), '노멀 탭이 aether_verified를 읽음');
    t.eq(await p.$$eval('#rkList .nm', a => a.map(x => x.textContent).join(', ')), '봉봉(카오스), Cheese', '카오스 기록에 (카오스) 표시');
    await click(p, '[data-rtab=hard]'); await wait(800);
    t.ok(g.calls.some(c => c.fn === 'GET:aether_hard'), '하드 탭이 aether_hard를 읽음');
    await p.close();
    const expect = { normal: ['aether_submit_verified', 'submit_aether_normal'], hard: ['aether_submit_hard'], daily: ['aether_submit_daily'] };
    for (const mode of Object.keys(expect)) {
      g = await openGame(browser, url, { save: { opt: { tutSeen: 1, chaos: 0 } } }); p = g.page;
      await toHub(p); await launchRun(p, mode); await finishRun(p);
      t.eq(g.calls.filter(c => /submit/.test(c.fn)).map(c => c.fn).join(','), expect[mode].join(','), mode + ' 판 → ' + expect[mode].join(' + '));
      t.ok(/랭킹/.test(await p.textContent('#discStat')), mode + ' 결과 화면 랭킹 안내', await p.textContent('#discStat'));
      noErrors(t, g, mode + ' 결과'); await p.close();
    }
    g = await openGame(browser, url, { session: null }); p = g.page;
    await click(p, '#title [data-go=hub]'); await wait(800);
    await p.evaluate(() => { offlineOK = true; $('#modal').classList.remove('on'); go('hub'); }); await wait(800);
    await launchRun(p, 'normal'); await finishRun(p);
    t.eq(submits(g.calls).length, 0, '로그인 안 하면 랭킹 기록 안 보냄');
    t.ok(/로그인/.test(await p.textContent('#rankBox')), '로그인 안내 표시');
    await p.close();
  },

  async '카오스: 노멀 · 하드 옵션, 랭킹 (카오스) 표시'(t, { browser, url }) {
    let g = await openGame(browser, url, { save: { opt: { tutSeen: 1, mode: 'chaos' } } }), p = g.page;
    await toHub(p);
    t.eq(JSON.stringify(await p.evaluate(() => [OPT.mode, OPT.chaos])), '["normal",1]', '옛 저장(mode=chaos) → 노멀 + 카오스');
    await click(p, '#hub [data-mode=daily]'); await wait(100);
    t.ok(await p.$eval('#chaosTg', b => b.disabled), '데일리에선 카오스 버튼 꺼짐');
    await p.close();
    const cases = [['normal', 1, ['aether_submit_verified(3.X-chaos)', 'submit_aether_normal(3.X-chaos)']], ['hard', 1, ['aether_submit_hard(3.X-chaos)']],
      ['daily', 1, ['aether_submit_daily(3.X)']], ['normal', 0, ['aether_submit_verified(3.X)', 'submit_aether_normal(3.X)']]];
    for (const [mode, chaos, want] of cases) {
      g = await openGame(browser, url); p = g.page; await toHub(p); await launchRun(p, mode, chaos);
      t.eq(await p.evaluate(() => run.chaos), !!chaos && mode !== 'daily', mode + ' 카오스=' + chaos + ' → run.chaos');
      await finishRun(p);
      t.eq(submits(g.calls).map(s => s.replace(/\d+\.\d+/, '3.X')).join(','), want.join(','), mode + ' 카오스=' + chaos + ' 기록 표시');
      noErrors(t, g, mode + ' 카오스'); await p.close();
    }
    g = await openGame(browser, url, { supabase: { rejectChaosTag: true } }); p = g.page;
    await toHub(p); await launchRun(p, 'normal', 1); await finishRun(p);
    const v = g.calls.filter(c => c.fn === 'aether_submit_verified').map(c => c.body.p_build);
    t.ok(v.length === 2 && /-chaos$/.test(v[0]) && !/-chaos$/.test(v[1]), '서버가 -chaos를 거절하면 표시 없이 다시 보냄', v.join(' → '));
    t.ok(/기록 갱신/.test(await p.textContent('#discStat')), '다시 보낸 기록이 등록됨');
    await p.close();
    for (const chaos of [1, 0]) {
      g = await openGame(browser, url); p = g.page; await toHub(p); await launchRun(p, 'normal', chaos);
      const changed = await p.evaluate(() => { const r = []; for (let i = 0; i < 3; i++) { const w = JSON.stringify(run.mapWalls); waveSpawn(); r.push(JSON.stringify(run.mapWalls) !== w); } return r; });
      t.eq(changed.slice(1).every(x => x === !!chaos), true, '카오스=' + chaos + ' → 웨이브 2·3 벽 ' + (chaos ? '바뀜' : '그대로'), JSON.stringify(changed));
      await p.close();
    }
  },

  async '로그인 토큰 (#11)'(t, { browser, url }) {
    const stored = p => p.evaluate(() => JSON.parse(localStorage.getItem('aether_session') || 'null'));
    const login = async p => { await click(p, '#title [data-go=hub]'); await wait(600);
      await p.fill('#lgName', 'tester'); await p.fill('#lgPin', '1234'); await p.click('#lgGo'); await wait(1500); };
    let g = await openGame(browser, url, { session: null, supabase: { login: 'token' } }), p = g.page; await login(p);
    let s = await stored(p); t.ok(s && s.tk === TOKEN && !s.pin, '서버 지원: 로그인 후 토큰만 저장(비밀번호 없음)', JSON.stringify(s));
    t.ok(g.calls.filter(c => c.fn === 'aether_cloud_stamp').every(c => c.body.p_pin === 'tk:' + TOKEN), '그 뒤 요청은 tk:토큰으로'); await p.close();
    g = await openGame(browser, url, { session: null, supabase: { login: 'legacy' } }); p = g.page; await login(p);
    s = await stored(p); t.ok(s && s.pin === '1234' && !s.tk, '서버 미지원(404): 예전처럼 비밀번호 세션 유지', JSON.stringify(s));
    t.eq(await screens(p), 'hub', '서버 미지원이어도 HUB 진입'); await p.close();
    g = await openGame(browser, url, { session: { name: 'tester', pin: '1234' }, supabase: { login: 'token' } }); p = g.page;
    await toHub(p); await wait(800); s = await stored(p); t.ok(s && s.tk === TOKEN && !s.pin, '예전 비밀번호 세션 → HUB 진입 때 토큰으로 자동 전환', JSON.stringify(s)); await p.close();
    g = await openGame(browser, url, { session: { name: 'tester', tk: TOKEN }, supabase: { login: 'token' } }); p = g.page;
    await toHub(p); await launchRun(p); await finishRun(p);
    const sub = g.calls.filter(c => /submit_aether_|aether_submit|cloud_save/.test(c.fn) && c.fn !== 'submit_aether_normal');
    t.ok(sub.length > 0 && sub.every(c => c.body.p_pin === 'tk:' + TOKEN), '판 끝 저장 · 랭킹도 토큰으로'); noErrors(t, g, '토큰 세션'); await p.close();
    g = await openGame(browser, url, { session: { name: 'tester', tk: TOKEN }, supabase: { login: 'expired' } }); p = g.page;
    await toHub(p); await wait(800); t.eq(await stored(p), null, '토큰 만료(28P01) → 로그인 풀림'); await p.close();
    g = await openGame(browser, url, { session: { name: 'tester', tk: TOKEN }, supabase: { login: 'token' } }); p = g.page;
    await toHub(p); await p.evaluate(() => clearSession()); await wait(500);
    t.ok(g.calls.some(c => c.fn === 'aether_logout' && c.body.p_pin === 'tk:' + TOKEN), '로그아웃 → 서버 토큰 삭제 요청'); await p.close();
  },

  async '히든 모드: 핫드 · 혼돈이야~'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p);
    t.eq(await p.evaluate(() => [...document.querySelectorAll('#hub [data-mode=hotd], #hub [data-mode=chaosx]')].filter(b => b.style.display !== 'none').length), 0, '처음엔 히든 모드 버튼 안 보임');
    for (let i = 0; i < 3; i++) await click(p, '#hub [data-mode=hard]'); await wait(2000);
    for (let i = 0; i < 3; i++) await click(p, '#chaosTg'); await wait(2000);
    t.eq(JSON.stringify(await p.evaluate(() => META.hidden)), '{"hotd":1,"chaosx":1}', '하드 · 카오스 3번 누르면 해금');
    for (const [mode, want] of [['hotd', 'aether_submit_hotd'], ['chaosx', 'aether_submit_chaosx']]) {
      g.calls.length = 0; await launchRun(p, mode, 0); t.eq(await p.evaluate(() => run.mode), mode, mode + ' 출격');
      await finishRun(p); t.eq(g.calls.filter(c => /submit/.test(c.fn)).map(c => c.fn).join(','), want, mode + ' 판 → ' + (want || '랭킹 기록 없음'));
      await p.evaluate(() => go('hub')); await wait(800);
    }
    noErrors(t, g, '히든 모드'); await p.close();
  },

  /* ---- v3.62 ~ v3.69 수정 확인 ---- */
  async '스킬 장착 · 보상 화면 입력 (v3.62 · v3.67)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p);
    t.eq(await p.evaluate(() => { META.skill = 'heal'; const b = document.createElement('button'); b.dataset.slot = 'q'; b.dataset.skill = 'wall';
      $('#skillSel').appendChild(b); b.click(); return META.skill + '/' + META.skillQ; }), 'heal/wall', 'Q 스킬을 골라도 F 스킬 유지');
    await launchRun(p);
    /* 보상 창을 열고 같은 순간에 고르면 '잠금 풀림' 알림이 늦게 와서 일시정지가 걸린다 — 사람 손으론 못 하는 속도라 테스트에서만 잠금을 끈다 */
    await p.evaluate(() => { OPT.lockMouse = 0; });
    t.eq(await p.evaluate(() => { run.phase = 'build'; run.phaseT = 12; run.startRewards = 0; openReward(false); takeReward(0); return run.phase; }), 'build', '선행 보급 보상 뒤 벽 설치 단계 유지');
    t.eq(await p.evaluate(() => { run.phase = 'break'; openReward(false); takeReward(0); return run.phase; }), 'break', '일반 보상 뒤 break');
    await p.evaluate(() => { run.rerolls = 3; openReward(false); dispatchEvent(new KeyboardEvent('keydown', { key: 'r', repeat: true })); });
    t.eq(await p.evaluate(() => run.rerolls), 3, '꾹 눌러 생긴 반복 R은 무시');
    await p.keyboard.press('r'); t.eq(await p.evaluate(() => run.rerolls), 3, '보상 창이 열리자마자 누른 R은 무시 (v3.67)');
    await wait(600); await p.keyboard.press('r'); t.eq(await p.evaluate(() => run.rerolls), 2, '0.5초 뒤 R은 새로고침');
    await p.keyboard.press('r'); t.eq(await p.evaluate(() => run.rerolls), 1, '이어서 누른 R도 새로고침');
    t.eq(await p.evaluate(() => { run.rerolls = 3; openReward(false); $('#rwReroll').click(); return run.rerolls; }), 2, '새로고침 버튼은 바로 됨');
    t.eq(await p.evaluate(() => { P.lock = 0; P.pbuf = 0; doParry(true); return P.lock; }), 0, '보상 고르는 중엔 패링 안 됨');
    t.eq(await p.evaluate(() => { takeReward(0); paused = false; keys.w = true; dispatchEvent(new Event('blur')); return keys.w; }), false, '창 포커스를 잃으면 눌린 키 해제');
    noErrors(t, g, '보상 화면'); await p.close();
  },

  async '데일리 시드 고정 (v3.62)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p);
    const [a, b] = await p.evaluate(() => {
      const snap = n => { startRun('daily'); const res = [];
        for (let k = 0; k < 6; k++) { for (let i = 0; i < n * (k + 1); i++) Math.random(); ens.length = 0; waveSpawn(); res.push(ens.map(e => e.grade).join('/')); }
        res.push(JSON.stringify(run.mapWalls.map(o => [o.x | 0, o.y | 0])));
        for (let i = 0; i < n; i++) Math.random(); openReward(false); res.push(rwPicks.map(x => x.k).join()); takeReward(0);
        return res.join(' '); };
      return [snap(3), snap(777)]; });
    t.eq(a, b, '중간에 쓴 난수 양이 달라도 6웨이브까지 적 · 벽 · 보상이 같음');
    noErrors(t, g, '데일리'); await p.close();
  },

  async '저장 · 로그인 동기화 (v3.62 · v3.67)'(t, { browser, url }) {
    const progress = { meta: { cur: 7777, best: 4000 }, upg: { range: 2 }, opt: { tutSeen: 1, keyParry: 'k' } };
    let g = await openGame(browser, url), p = g.page; await toHub(p);
    t.ok(await p.evaluate(() => { UPG.find(u => u.k === 'range').lv = 3; META.cur = 10; save();
      const d = JSON.parse(localStorage.getItem(SAVE_KEY)); d.upg.range = 0; d.meta.cur = 999; localStorage.setItem(SAVE_KEY, JSON.stringify(d)); syncMeta();
      return UPG.find(u => u.k === 'range').lv === 0 && META.cur === 999; }), '다른 탭 저장을 재화 · 강화 한 쌍으로 받음 (되돌리기 재화 복사 막기)');
    t.ok(await p.evaluate(() => { META.hidden = { hotd: 1 }; applySave({ meta: { cur: 1 }, opt: { tutSeen: 1 } }); return !hiddenOn('hotd'); }), '계정 기록을 불러오면 히든 해금도 그 계정 것');
    t.eq(await p.evaluate(() => { syncing = true; syncAt = performance.now(); $('#launch').click(); const s = screen; syncing = false; return s; }), 'hub', '다른 기기 기록 확인 중엔 출격 대기');
    const sent = await p.evaluate(async () => { const n = [], oc = cloudCall; run = { chaos: 1 };
      for (const st of [500, 400]) { cloudCall = async (fn, body) => { n.push(st + ':' + body.p_build); const e = new Error('x'); e.status = st; throw e; };
        await rankCall('aether_submit_verified', { p_build: BUILD + '-chaos' }).catch(() => {}); }
      cloudCall = oc; run = null; return n.map(s => s.replace(/\d+\.\d+/, 'V')); });
    t.eq(sent.join(','), '500:V-chaos,400:V-chaos,400:V', '서버 오류(5xx)는 재전송 안 함, 거절(4xx)만 표시 없이 재전송');
    await p.close();
    const login = async (p, name) => { await click(p, '#title [data-go=hub]'); await wait(600);
      await p.fill('#lgName', name); await p.fill('#lgPin', '1234'); await p.click('#lgGo'); await wait(1200); };
    g = await openGame(browser, url, { session: null, save: progress, supabase: { load: { meta: { cur: 500, best: 100 }, upg: { range: 1 }, opt: { tutSeen: 1 } } } }); p = g.page;
    await login(p, 'tester');
    t.ok(await visible(p, '#confirm.on'), '오프라인 진행이 서버와 다르면 고르는 창', await p.textContent('#cfD'));
    await p.click('#cfNo'); await wait(800);
    const up = g.calls.filter(c => c.fn === 'aether_cloud_save').pop();
    t.ok(up && up.body.p_data.meta.cur === 7777 && await p.evaluate(() => META.cur) === 7777, '"이 기기 기록 쓰기" → 이 기기 기록을 서버에 올림');
    await p.close();
    g = await openGame(browser, url, { session: null, save: progress, supabase: { load: { meta: { cur: 500, best: 100 }, upg: { range: 1 }, opt: { tutSeen: 1 } } } }); p = g.page;
    await login(p, 'tester'); await p.click('#cfYes'); await wait(800);
    t.eq(await p.evaluate(() => META.cur), 500, '"서버 기록 불러오기" → 서버 기록'); await p.close();
    g = await openGame(browser, url, { session: null, save: progress, supabase: { load: 'none' } }); p = g.page;
    await p.evaluate(() => localStorage.setItem('aether_rank_name', 'alice')); await login(p, 'bob');
    let sv = g.calls.filter(c => c.fn === 'aether_cloud_save').pop();
    t.ok(sv && !(sv.body.p_data.meta && sv.body.p_data.meta.cur), '로그아웃 뒤 새 계정 → 앞 계정 진행을 올리지 않음 (v3.67)');
    t.ok(await p.evaluate(() => META.cur === 0 && UPG.find(u => u.k === 'range').lv === 0 && OPT.keyParry === 'k' && screen === 'hub'), '새 계정은 진행 0 · 설정 유지');
    await p.close();
    g = await openGame(browser, url, { session: null, save: progress, supabase: { load: 'none' } }); p = g.page;
    await login(p, 'carol'); sv = g.calls.filter(c => c.fn === 'aether_cloud_save').pop();
    t.ok(sv && sv.body.p_data.meta.cur === 7777, '로그인한 적 없는 오프라인 진행은 새 계정으로 옮김');
    noErrors(t, g, '저장 · 로그인'); await p.close();
  },

  async '전투: 정지장 · 구속 (v3.63)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p);
    const r = await p.evaluate(() => {
      run.phase = 'fight'; run.phaseT = 99; ens.length = 0; bullets.length = 0; P.x = 500; P.y = 300; CFG.god = 1; run.mapWalls = [];
      const mk = (gr, x, y) => { spawnEnemyAt(gr, x, y); const e = ens[ens.length - 1]; e.ax = e.x = x; e.ay = e.y = y; return e; };
      const step = n => { for (let i = 0; i < n; i++) { hitstop = 0; update(1 / 60); } };
      const stasis = () => { P.stasis = { x: 800, y: 300, r: 190, t: 999 }; }, o = {};
      stasis(); const sn = mk('sniper', 800, 300); sn.snipeT = 1.5; step(120); o.sniper = sn.snipeT === 1.5;
      P.stasis = null; step(10); o.sniperResume = sn.snipeT < 1.5;
      ens.length = 0; stasis(); mk('healer', 800, 300); const v = mk('mob', 820, 320); v.hp = v.hpMax * 0.5; const h0 = v.hp; step(60); o.healer = v.hp === h0;
      ens.length = 0; const su = mk('summoner', 800, 300); su.summonT = 0.5; step(120); o.summoner = ens.length === 1;
      ens.length = 0; P.stasis = null; spawnEnemyAt('boss', 800, 300); const bo = ens[ens.length - 1]; bo.variant = 'phantom'; bo.blinkT = 0.3; bo.bindT = 5; step(60); o.phantom = bo.blinkT === 0.3;
      ens.length = 0; P.stasis = { x: 520, y: 300, r: 190, t: 999 }; const tr = mk('tracker', 520, 300); tr.lungePhase = 'dash'; tr.lungeT = 1; tr.lungeHit = false; P.x = 525; step(5); o.tracker = tr.lungeHit === false;
      ens.length = 0; P.stasis = null; hitstop = 0.18; const snd = [], os = sfx; sfx = k => snd.push(k); killEnemy(mk('mob', 900, 100)); sfx = os;
      o.hitstop = hitstop === 0.18; o.killSound = snd.includes('kill');
      o.overload = /F·Q 스킬/.test(BOONS.find(b => b.k === 'overload').d);
      return o; });
    t.ok(r.sniper && r.sniperResume, '정지장 안 저격수는 조준이 멈추고, 나오면 다시 진행');
    t.ok(r.healer, '정지장 안 힐러는 회복 안 함'); t.ok(r.summoner, '정지장 안 소환사는 소환 안 함');
    t.ok(r.phantom, '구속된 환영형은 순간이동 안 함'); t.ok(r.tracker, '멈춘 추적자는 돌진 피해 없음');
    t.ok(r.hitstop, '일반 처치가 보스 처치 멈춤을 끊지 않음'); t.ok(r.killSound, '처치 효과음은 그대로'); t.ok(r.overload, '회로 과부하 설명 F·Q');
    noErrors(t, g, '정지장 · 구속'); await p.close();
  },

  async '입력 · 디버그 (v3.64)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p);
    const r = await p.evaluate(() => {
      const kd = (key, code, ty) => dispatchEvent(new KeyboardEvent(ty || 'keydown', { key, code })), o = {};
      run.phase = 'fight'; kd('ㅈ', 'KeyW'); o.ime = keys.w === true; kd('w', 'KeyW', 'keyup'); o.imeUp = keys.w === false;
      let n = 0; const od = doParry; doParry = () => { n++; }; kd('Process', 'KeyE'); doParry = od; o.process = n === 1;
      binding = 'keySkill'; const ks = OPT.keySkill; kd('`', 'Backquote'); o.reserved = OPT.keySkill === ks; binding = null; $('#modal').classList.remove('on');
      META.best = 100; META.stats = { runs: 5 }; const bc = META.bestCycle; run.score = 99999; run.cheat = 1; run.cycle = 9; P.hp = 0; endRun();
      o.cheat = META.best === 100 && META.stats.runs === 5 && META.bestCycle === bc;
      return o; });
    t.ok(r.ime && r.imeUp, '한글 입력 상태(ㅈ)도 W로 인식, 한/영 바꿔 떼도 해제'); t.ok(r.process, "'Process' 키도 자판 위치로 패링");
    t.ok(r.reserved, '` 키는 스킬 키로 지정 못 함'); t.ok(r.cheat, '디버그 판은 최고 기록 · 누적 기록에 안 들어감');
    await p.evaluate(() => go('hub')); await wait(800); await launchRun(p);
    t.eq(await p.evaluate(() => { let n = 0; const oe = endRun; endRun = function () { n++; return oe.apply(this, arguments); };
      BOT.on = true; BOT.speed = 6; CFG.god = 0; P.inv = 0; P.hp = 0; loop(performance.now() + 16); BOT.on = false; endRun = oe; return n; }), 1, '봇 ×6 배속에서도 판 종료는 한 번');
    t.ok(await p.evaluate(() => { debug = true; CFG.maxB = 1; CFG.god = 1; setDebug(false); return CFG.maxB === DBG_DEF.maxB && !CFG.god; }), '디버그를 끄면 튜닝 값 복구');
    noErrors(t, g, '입력 · 디버그'); await p.close();
  },

  async '보스 변종 패턴 (v3.69)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p);
    const r = await p.evaluate(() => {
      const dist = (v, cycle, mode, p2) => { run.mode = mode; run.cycle = cycle; const e = { grade: 'boss', variant: v, p2 }, c = {};
        for (let i = 0; i < 3000; i++) { const q = pickPattern(e); c[q.n] = (c[q.n] || 0) + 1; } return c; };
      const names = a => a.map(q => q.n), o = { bad: [] }, P2C = names(BOSS_P2S);
      for (const [v, first] of [['warden', 2], ['phantom', 3], ['collapse', 4]]) {
        const vp = VARIANT_PATTERNS[v], own = names(vp.base), own2 = names(vp.p2), late = names(vp.base.filter(q => q.late));
        let d = dist(v, first, 'normal', false), ks = Object.keys(d);
        if (!ks.every(k => own.includes(k))) o.bad.push(v + ' 1페이즈에 다른 패턴');
        if (ks.some(k => late.includes(k))) o.bad.push(v + ' 첫 등장에 어려운 패턴');
        if (!Object.keys(dist(v, first + 4, 'normal', false)).some(k => late.includes(k))) o.bad.push(v + ' 다음 등장에 어려운 패턴 없음');
        if (!Object.keys(dist(v, first, 'hard', false)).some(k => late.includes(k))) o.bad.push(v + ' 하드에 어려운 패턴 없음');
        d = dist(v, first + 4, 'normal', true);
        const a = own2.reduce((s, k) => s + (d[k] || 0), 0), b = P2C.reduce((s, k) => s + (d[k] || 0), 0);
        if (!(a > 400 && b > 400 && Math.abs(a - b) < 250)) o.bad.push(v + ' 2페이즈 전용/공용 비율 ' + a + '/' + b);
      }
      const core = dist(undefined, 2, 'normal', false); o.coreMix = ['TWIN', 'ORBIT', 'OVERLOAD'].some(k => core[k]);
      o.fit = Object.values(VARIANT_PATTERNS).every(v => v.base.concat(v.p2).every(q => q.specs.length <= CFG.maxB));
      run.mode = 'normal'; o.fired = {};
      for (const v of ['warden', 'phantom', 'collapse']) {
        ens.length = 0; bullets.length = 0; queue.length = 0; run.phase = 'fight'; run.phaseT = 99; run.cycle = 5; P.x = 150; P.y = 300; CFG.god = 1; P.stasis = null;
        spawnEnemyAt('boss', 700, 300); const bb = ens[ens.length - 1]; bb.variant = v; bb.fireT = 0;
        Object.assign(bb, { callT: 999, wardT: 999, blinkT: 999, spiralT: 999, mortT: 999, gunT: 999, ringT: 999 });
        const seen = new Set(), op = pickPattern; pickPattern = function (e) { const q = op(e); if (e === bb) seen.add(q.n); return q; };
        for (let i = 0; i < 60 * 20; i++) { hitstop = 0; update(1 / 60); }
        pickPattern = op; o.fired[v] = [...seen].every(n => names(VARIANT_PATTERNS[v].base.concat(VARIANT_PATTERNS[v].p2)).includes(n)) ? seen.size : -1;
      }
      return o; });
    t.eq(r.bad.join(' · '), '', '변종은 자기 패턴만 · 첫 등장엔 어려운 패턴 빼기 · 2페이즈 전용/공용 반반');
    t.ok(r.coreMix, '기본형만 일반 패턴(TWIN · ORBIT · OVERLOAD) 섞음'); t.ok(r.fit, '모든 변종 패턴이 8발 이하');
    t.ok(Object.values(r.fired).every(n => n >= 3), '실제 전투에서 변종마다 자기 패턴을 쏨', JSON.stringify(r.fired));
    noErrors(t, g, '보스 패턴'); await p.close();
  },
};

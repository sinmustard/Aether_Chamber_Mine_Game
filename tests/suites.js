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

  /* ---- v3.61 ~ v3.71 새 적 · 보스 · 판 기록표 ---- */
  async '새 적 등장 조건 · 패턴 (v3.61 · v3.71)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p);
    const seen = await p.evaluate(() => { const out = {};
      for (const c of [1, 2]) for (let w = 3; w <= 10; w++) { run.cycle = c; run.wave = w; const s = new Set();
        for (let i = 0; i < 300; i++) rollWave(6).forEach(x => s.add(x)); out[c + '-' + w] = [...s]; }
      return out; });
    const rule = { gunner: (c, w) => w >= 4, sprayer: (c, w) => w >= 6, weaver: (c, w) => c >= 2 && w >= 3, mortar: (c, w) => c >= 2 && w >= 4, trapper: (c, w) => c >= 2 && w >= 4 };
    for (const [gr, ok] of Object.entries(rule)) {
      const bad = Object.entries(seen).filter(([k, s]) => { const [c, w] = k.split('-').map(Number); return s.includes(gr) !== ok(c, w); }).map(([k]) => k);
      t.eq(bad.join(','), '', gr + ' 등장 조건 (사이클-웨이브)');
    }
    const fired = await p.evaluate(() => { run.phase = 'fight'; run.phaseT = 99; run.cycle = 2; run.mapWalls = []; CFG.god = 1; P.x = 150; P.y = 300; P.stasis = null;
      const names = gr => POOL[gr].map(i => PATTERNS[i].n), out = {};
      for (const gr of ['gunner', 'weaver', 'mortar', 'sprayer', 'trapper']) {
        ens.length = 0; bullets.length = 0; queue.length = 0; run.mortars = [];
        spawnEnemyAt(gr, 750, 300); const e = ens[ens.length - 1]; e.fireT = 0; let mort = 0;
        const s = new Set(), op = pickPattern; pickPattern = function (x) { const q = op(x); if (x === e) s.add(q.n); return q; };
        for (let i = 0; i < 60 * 15; i++) { hitstop = 0; update(1 / 60); mort = Math.max(mort, (run.mortars || []).length); if (!ens.includes(e)) break; }
        pickPattern = op; out[gr] = { n: s.size, own: [...s].every(n => names(gr).includes(n)), mort };
      } return out; });
    for (const [gr, r] of Object.entries(fired)) t.ok(r.n > 0 && r.own, gr + ' 은(는) 자기 패턴 풀에서 쏨', JSON.stringify(r));
    t.ok(fired.mortar.mort > 0, '박격병은 포격 원을 그림');
    const sd = await p.evaluate(() => { ens.length = 0; bullets.length = 0; queue.length = 0; run.phase = 'fight';
      spawnEnemyAt('sprayer', 750, 300); const e = ens[ens.length - 1]; e.fireT = 0; const op = pickPattern, seen = new Set();
      pickPattern = x => x === e ? PATTERNS.find(q => q.n === 'SPRAY DOUBLE') : op(x);
      for (let i = 0; i < 60; i++) { hitstop = 0; update(1 / 60); if (i === 0) e.fireT = 99; bullets.forEach(b => { if (b.owner === 'enemy') seen.add(b); }); }
      pickPattern = op; return seen.size; });
    t.eq(sd, 9, '분사병 SPRAY DOUBLE은 9발이 다 나감 (v3.79)');
    noErrors(t, g, '새 적'); await p.close();
  },

  async '새 탄 동작: 덫 · 곡선 · 느린 탄 · 포격 (v3.61 · v3.71)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p);
    const r = await p.evaluate(() => {
      run.phase = 'fight'; run.phaseT = 99; run.mapWalls = []; P.x = 150; P.y = 300; P.stasis = null; ens.length = 0; bullets.length = 0; queue.length = 0;
      /* 웨이브가 비어 끝나지 않게, 쏘지 못하는 적 하나를 정지장 안에 세워 둔다 */
      spawnEnemyAt('mob', 900, 520); const dummy = ens[ens.length - 1]; dummy.ax = dummy.x = 900; dummy.ay = dummy.y = 520;
      const hold = () => { P.stasis = { x: 900, y: 520, r: 60, t: 999 }; };
      const step = (n, f) => { for (let i = 0; i < n; i++) { hitstop = 0; hold(); update(1 / 60); if (f) f(); } };
      const fire = spec => { queue.push({ t: 0, spec, ex: 700, ey: 300, boss: false, hack: false, src: dummy }); step(1); return bullets[bullets.length - 1]; };
      const o = {}; CFG.god = 1;
      const tb = fire({ t: 0, ang: 0.6, trap: 1 }); let p1 = null, p2 = null, goSpd = 0, goStraight = 0;
      step(150, () => { if (tb.age > 0.6 && !p1) p1 = [tb.x, tb.y]; if (tb.age > 1.7 && !p2) p2 = [tb.x, tb.y]; if (tb.trapGo && !goSpd) { goSpd = tb.spd; goStraight = tb.straight; } });
      o.trap = p1 && p2 && dist(p1[0], p1[1], p2[0], p2[1]) < 0.5 && goSpd > 0 && goStraight === 1;
      /* v3.74 멈춰 있는 덫 탄을 빼앗으면 내 탄이 되어 날아가야 한다 (예전엔 속도 0이라 그 자리에 굳음) */
      bullets.length = 0; P.x = 150; const hb = fire({ t: 0, ang: 0, trap: 1 }); step(50);
      P.x = hb.x - 70; P.y = hb.y; P.face = Math.atan2(hb.y - P.y, hb.x - P.x); hb.ready = true; hb.coy = 1; P.lock = 0; P.pbuf = 0; doParry(true);
      const h0 = [hb.x, hb.y]; step(20); o.trapSeize = hb.owner === 'player' && dist(h0[0], h0[1], hb.x, hb.y) > 30;
      P.x = 150; P.y = 300;
      bullets.length = 0; const cb = fire({ t: 0, curl: 1 }); const d0 = cb.dir; step(55); o.curl = Math.abs(norm(cb.dir - d0)) > 1.5;
      bullets.length = 0; queue.length = 0; PATTERNS.find(q => q.n === 'ARC PAIR').specs.forEach(sp => queue.push({ t: 0, spec: sp, ex: 700, ey: 300, boss: false, hack: false, src: dummy }));
      step(1); o.arc = bullets.length === 2 && bullets[0].curl === -bullets[1].curl;
      bullets.length = 0; const sb = fire({ t: 0, slow: 0.75 }); o.slow = Math.abs(sb.base - CFG.spd * 0.75) < 1;
      bullets.length = 0; CFG.god = 0; P.guard = 0; P.phase = 0;
      const boom = (x, y, setup) => { P.inv = 0; P.barrier = 0; P.hp = 80; if (setup) setup(); run.mortars = []; dropMortar(x, y); step(90); return { hp: P.hp, barrier: P.barrier }; };
      o.mortarHit = boom(P.x, P.y).hp < 80; o.mortarMiss = boom(P.x + 300, P.y).hp === 80;
      const bar = boom(P.x, P.y, () => { P.barrier = 1; }); o.mortarBarrier = bar.hp === 80 && bar.barrier === 0;
      CFG.god = 1; return o; });
    t.ok(r.trap, '덫 탄: 퍼진 뒤 제자리에 멈춰 있다가 플레이어 쪽 직선으로 날아감');
    t.ok(r.trapSeize, '멈춰 있는 덫 탄을 패링하면 내 탄이 되어 날아감 (v3.74)');
    t.ok(r.curl, '곡선 탄: 처음 1초 동안 크게 휨'); t.ok(r.arc, 'ARC PAIR: 두 발이 서로 반대로 휨'); t.ok(r.slow, '분사 탄: 기본 탄속의 0.75배');
    t.ok(r.mortarHit, '포격 원 안에 있으면 1.3초 뒤 피해'); t.ok(r.mortarMiss, '포격 원 밖이면 피해 없음'); t.ok(r.mortarBarrier, '보호막이 있으면 보호막이 대신 깨짐');
    noErrors(t, g, '새 탄'); await p.close();
  },

  async '보스: 환영 분신 · 붕괴형 · 정지장 (v3.61)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p);
    const r = await p.evaluate(() => {
      run.phase = 'fight'; run.phaseT = 99; run.cycle = 5; run.mapWalls = []; CFG.god = 1; P.x = 150; P.y = 300; P.stasis = null;
      const step = n => { for (let i = 0; i < n; i++) { hitstop = 0; update(1 / 60); } };
      const boss = v => { ens.length = 0; bullets.length = 0; queue.length = 0; run.mortars = []; spawnEnemyAt('boss', 750, 300); const b = ens[ens.length - 1]; b.variant = v;
        Object.assign(b, { fireT: 99, callT: 999, wardT: 999, blinkT: 999, spiralT: 999, mortT: 999, gunT: 999, ringT: 999 }); return b; };
      const ill = () => ens.filter(e => e.grade === 'illusion'), o = {};
      let b = boss('phantom'); b.blinkT = 0.01; step(2); o.illSpawn = ill().length === 2 && ill().every(e => e.ttl > 6);
      b.blinkT = 999; ill().forEach(e => { e.fireT = 99; }); step(60 * 7.3); o.illGone = ill().length === 0;
      /* v3.79 보스가 죽으면 분신도 바로 사라짐 → 웨이브가 분신 수명(7초)을 기다리지 않음 */
      b = boss('phantom'); run.wave = 11; b.blinkT = 0.01; step(2); const had = ill().length; killEnemy(b); step(2); o.illBossDeath = had === 2 && ill().length === 0;
      /* v3.79 분신 처치 — 점수 · 처치 수 · R 충전은 그대로, 처치 회복만 없음 */
      b = boss('phantom'); b.blinkT = 0.01; step(2); run.boons.leech = 1; P.rChg = 0;
      P.hp = 50; let k0 = run.kills, s0 = run.score; killEnemy(ill()[0]); o.illReward = P.hp === 50 && run.kills === k0 + 1 && run.score > s0 && P.rChg > 0;
      spawnEnemyAt('mob', 400, 500); P.hp = 50; killEnemy(ens[ens.length - 1]); o.mobLeech = P.hp > 50; delete run.boons.leech;
      b = boss('collapse'); b.spiralT = 0.01; step(2); o.spiral = bullets.length + queue.length >= 8;
      b = boss('collapse'); b.mortT = 0.01; step(2); o.mortar = run.mortars.length === 3;
      b = boss('collapse'); b.p2 = 1; b.gunT = 0.01; step(2); o.gunners = ens.filter(e => e.grade === 'gunner').length === 2;
      b = boss('collapse'); b.spiralT = 0.01; b.mortT = 0.01; P.stasis = { x: 750, y: 300, r: 190, t: 999 }; step(60); o.stasis = run.mortars.length === 0 && bullets.length + queue.length === 0;
      P.stasis = null; ens.length = 0; spawnEnemyAt('mortar', 750, 300); const m = ens[ens.length - 1]; m.mortarT = 0.01; m.fireT = 99; run.mortars = [];
      P.stasis = { x: 750, y: 300, r: 190, t: 999 }; step(60); o.mortarStasis = run.mortars.length === 0; P.stasis = null;
      return o; });
    t.ok(r.illSpawn, '환영형 순간이동 → 분신 2기 (7초 수명)'); t.ok(r.illGone, '분신은 7초 뒤 사라짐');
    t.ok(r.illBossDeath, '보스가 죽으면 분신도 바로 사라짐 (v3.79)');
    t.ok(r.illReward, '분신 처치: 점수 · 처치 수 · R 충전은 들어오고 처치 회복은 없음 (v3.79)'); t.ok(r.mobLeech, '일반 적 처치 회복은 그대로');
    t.ok(r.spiral, '붕괴형 나선 탄막'); t.ok(r.mortar, '붕괴형 포격 3발'); t.ok(r.gunners, '붕괴형 2페이즈 연사병 2기 호출');
    t.ok(r.stasis, '정지장 안 붕괴형은 나선 · 포격을 멈춤'); t.ok(r.mortarStasis, '정지장 안 박격병은 포격을 못 함');
    noErrors(t, g, '보스'); await p.close();
  },

  async '판 기록표 (#12, v3.68)'(t, { browser, url }) {
    for (const mode of ['normal', 'hard']) {
      const g = await openGame(browser, url, { save: { opt: { tutSeen: 1, chaos: 0 } } }), p = g.page; await toHub(p); await launchRun(p, mode); await wait(500);
      const start = g.calls.find(c => c.fn === 'aether_run_start');
      t.ok(start && start.body.p_mode === mode && start.body.p_pin === '1234', mode + ' 출격 → aether_run_start(p_mode=' + mode + ')');
      await finishRun(p);
      const subs = g.calls.filter(c => /submit/.test(c.fn));
      t.ok(subs.length > 0 && subs.every(c => c.body.p_run === 'run-' + mode), mode + ' 랭킹 기록에 같은 기록표(p_run)', subs.map(c => c.fn + ':' + c.body.p_run).join(' '));
      await p.close();
    }
    let g = await openGame(browser, url, { session: null }), p = g.page;
    await click(p, '#title [data-go=hub]'); await wait(600); await p.evaluate(() => { offlineOK = true; $('#modal').classList.remove('on'); go('hub'); }); await wait(600);
    await launchRun(p); await wait(400); t.ok(!g.calls.some(c => c.fn === 'aether_run_start'), '로그인 안 하면 기록표 안 받음'); await p.close();
    g = await openGame(browser, url); p = g.page; await click(p, '#title [data-modal=tutorial]'); await wait(400);
    if (await visible(p, '#tutPlay')) await p.click('#tutPlay'); await wait(1000);
    t.ok(!g.calls.some(c => c.fn === 'aether_run_start'), '튜토리얼은 기록표 안 받음'); await p.close();
  },

  async '디버그 소환 버튼 (v3.70 · v3.71)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p);
    const r = await p.evaluate(() => { const out = {};
      for (const b of document.querySelectorAll('#debugSpawn [data-spawn]')) { const k = b.dataset.spawn; if (k === 'clear') continue;
        ens.length = 0; b.click(); const e = ens[ens.length - 1];
        out[k] = !!e && (k.startsWith('boss') ? e.grade === 'boss' && e.variant === (k.split(':')[1] || 'core') : e.grade === k); }
      return out; });
    const keys = Object.keys(r);
    t.ok(['gunner', 'weaver', 'mortar', 'sprayer', 'trapper', 'boss:warden', 'boss:phantom', 'boss:collapse'].every(k => keys.includes(k)), '새 적 · 보스 변형 버튼 있음', keys.join(' '));
    t.eq(keys.filter(k => !r[k]).join(','), '', '버튼마다 그 적(보스는 그 변형)이 소환됨');
    noErrors(t, g, '디버그 소환'); await p.close();
  },

  /* ---- v3.82 ---- */
  async '이미지 · 소리 · 랭킹 표시 · 박격포 (v3.82)'(t, { browser, url }) {
    const rows = [{ name: '봉봉', score: 100, cycle: '<img src=x>', wave: 2, build: '3.80' }];
    let g = await openGame(browser, url, { supabase: { rows } }), p = g.page;
    await click(p, '#title [data-modal=rank]'); await wait(800);
    t.eq(await p.$$eval('#rkList img', a => a.length), 0, '랭킹 숫자 칸에 HTML이 들어와도 그대로 그려지지 않음');
    await p.close();

    g = await openGame(browser, url); p = g.page; await toHub(p); await launchRun(p); await wait(1500);
    const r = await p.evaluate(() => { const o = {};
      o.bad = performance.getEntriesByType('resource').filter(e => e.initiatorType === 'img' && e.responseStatus >= 400).map(e => e.name);
      const want = [...document.querySelectorAll('#debugSpawn [data-spawn]')].map(b => b.dataset.spawn).filter(k => k !== 'clear')
        .map(k => k.startsWith('boss') ? (k.includes(':') ? 'boss_' + k.split(':')[1] : 'boss') : k).concat(['illusion']);
      o.missing = want.filter(k => !(GRADES[k] && GRADES[k].vector) && !(SPRITES[k] && SPRITES[k].naturalWidth > 0));   // vector: 일부러 도형으로 그리는 적
      const real = AC; let resumed = 0; AC = { state: 'interrupted', resume() { resumed++; } }; ac(); AC = real; o.resumed = resumed;
      ens.length = 0; bullets.length = 0; queue.length = 0; run.phase = 'fight'; dropMortar(P.x, P.y); const hp = P.hp;
      for (let i = 0; i < 10; i++) { hitstop = 0; update(1 / 60); }
      o.cleared = run.phase !== 'fight' && run.mortars.length === 0;
      for (let i = 0; i < 120; i++) { hitstop = 0; update(1 / 60); }
      o.noHit = P.hp >= hp; return o; });
    t.eq(r.bad.join(' '), '', '불러오는 이미지 중 없는 파일 없음');
    t.eq(r.missing.join(','), '', '모든 적 · 보스 변형 · 분신 이미지가 실제로 불러와짐');
    t.ok(r.resumed === 1, "아이폰 소리가 'interrupted'로 멈추면 다시 켬");
    t.ok(r.cleared, '웨이브가 끝나면 남은 박격포 장판도 지워짐'); t.ok(r.noHit, '웨이브가 끝난 뒤 박격포에 안 맞음');
    noErrors(t, g, '이미지 · 소리 · 박격포'); await p.close();
  },

  /* ---- v3.89 추가 기능 (js/extras.js) ---- */
  async '추가 기능: 전투 표시 · 결과 화면 (v3.89)'(t, { browser, url }) {
    const g = await openGame(browser, url), p = g.page; await toHub(p); await launchRun(p); await wait(1500);
    const a = await p.evaluate(async () => { const o = {}, sleep = ms => new Promise(r => setTimeout(r, ms));
      ens.length = 0; bullets.length = 0; queue.length = 0; CFG.god = 1;
      const rnd = Math.random; Math.random = () => 0.1;
      run.cycle = 1; spawnEnemy('elite'); o.affix1 = ens[ens.length - 1].affix || '';
      run.cycle = 2; spawnEnemy('elite'); const el = ens[ens.length - 1]; o.affix2 = el.affix;
      Math.random = () => 0.9; spawnEnemy('elite'); const plain = ens[ens.length - 1]; o.plain = plain.affix || ''; o.hpMul = el.hpMax / plain.hpMax;
      Math.random = rnd; run.cycle = 1; ens.length = 0;
      for (let i = 0; i < 6; i++) { sfx('parry', 2); await sleep(60); }
      o.streak = run.ex.streak; P.inv = 0; onHurt(); o.streakAfter = run.ex.streak; o.best = run.ex.best;
      spawnEnemy('boss'); const b = ens[ens.length - 1]; b.variant = 'warden'; o.warn = run.ex.warn > 0;
      b.exT0 = run.time - 61.2; killEnemy(b); o.boss = run.ex.boss.map(x => x.v + ':' + x.t.toFixed(1)).join(); o.warnOff = run.ex.warn === 0;
      try { o.stored = JSON.parse(localStorage.getItem('aether_x_bossT')).hasOwnProperty('normal:warden'); } catch (e) { o.stored = false; }
      P.hp = Math.round(CFG.hpMax * 0.2); await sleep(200);
      return o; });
    t.eq(a.affix1, '', '1사이클 엘리트는 접두사 없음');
    t.ok(a.affix2 === '강철' && a.plain === '' && Math.abs(a.hpMul - 1.6) < 0.01, '2사이클 엘리트 절반에 접두사 — 강철은 체력 ×1.6', a.affix2 + ' ×' + a.hpMul);
    t.ok(a.streak === 6 && a.streakAfter === 0 && a.best === 6, '무피격 연속 패링: 패링마다 +1, 맞으면 0 (최고 기록은 남음)', JSON.stringify(a));
    t.ok(a.warn && a.warnOff, '보스 등장 경고 띠 → 보스가 죽으면 바로 꺼짐');
    t.ok(a.boss === 'warden:61.2' && a.stored, '보스 처치 시간 기록 (변형별, 이 기기에 최고 기록 저장)', a.boss);
    // 연사병 탄에 쓰러지기 → 결과 화면
    await p.evaluate(() => { ens.length = 0; bullets.length = 0; queue.length = 0; CFG.god = 0; P.inv = 0; run.revives = 0; P.barrier = 0; run.phase = 'fight';
      document.querySelector('#debugSpawn [data-spawn="gunner"]').click(); const e = ens[ens.length - 1]; e.x = P.x + 200; e.y = P.y; e.fireT = 0.1; P.hp = 1; });
    for (let i = 0; i < 40 && await p.evaluate(() => screen) === 'game'; i++) await wait(250);
    const r = await p.evaluate(() => ({ screen, txt: ($('#exRes') || {}).innerText || '', bars: document.querySelectorAll('#exRes [title*="피해"]').length,
      copy: !!$('#exCopy'), rp: !!$('#exRpBtn'), share: exShareText(run, run.ex, true) }));
    t.eq(r.screen, 'result', '쓰러지면 결과 화면');
    t.ok(/쓰러진 원인 — 연사병 탄/.test(r.txt), '쓰러진 원인 — 연사병 탄', r.txt.split('\n').slice(0, 3).join(' / '));
    t.ok(/가장 많이 맞은 것/.test(r.txt) && /최장 무피격 연속 패링 — 6/.test(r.txt) && /보스 처치 시간 — 수호형 1:01.2/.test(r.txt), '피해 출처 · 연속 패링 · 보스 처치 시간 줄');
    t.ok(r.bars > 0, '웨이브별 피해 · 처치 막대', 'bars ' + r.bars);
    t.ok(/패링 \d+회 · 빗나감 \d+회 · 성공률 \d+%/.test(r.txt), '패링 통계 줄');
    t.ok(r.copy && /^에테르 챔버 v[\d.]+ · 노멀\n/.test(r.share) && /쓰러진 원인: 연사병 탄/.test(r.share), '결과 문구 복사 — 모드 · 점수 · 웨이브 이모지 · 원인', r.share.replace(/\n/g, ' / '));
    t.ok(r.rp, '마지막 5초 보기 버튼');
    if (r.rp) { await click(p, '#exRpBtn'); await wait(500); t.ok(await p.evaluate(() => !!$('#exRp') && $('#modal').classList.contains('on')), '리플레이 창이 열림'); }
    await p.evaluate(() => { $('#modal').classList.remove('on'); go('title'); }); await wait(300);
    await click(p, '#exDex'); await wait(300);
    const dex = await p.evaluate(() => ({ n: $('#modalBox').querySelectorAll('img').length, txt: $('#modalBox').innerText }));
    t.ok(dex.n >= 21 && /흡수체/.test(dex.txt) && /붕괴형/.test(dex.txt), '적 도감 — 모든 적 · 보스 변형 + 흡수체', 'img ' + dex.n);
    noErrors(t, g, '추가 기능 전투 표시'); await p.close();
  },

  async '추가 기능: 새 적 · 웨이브 · 모드 · 설정 (v3.89)'(t, { browser, url }) {
    const g = await openGame(browser, url, { save: { opt: { tutSeen: 1, chaos: 0 } } }), p = g.page;
    const ids = await p.evaluate(() => ['exDex', 'exPrac', 'exRush', 'exMis'].filter(id => !$('#' + id)));
    t.eq(ids.join(','), '', '타이틀 버튼: 도감 · 연습장 · 보스 러시 · 일일 미션');
    // 설정: 패링 목표 미리보기 (기본 꺼짐)
    await p.evaluate(() => openModal('opt')); await wait(200);
    const opt0 = await p.evaluate(() => ({ v: OPT.aimPrev, row: !!document.querySelector('[data-opt=aimPrev]') }));
    await click(p, '[data-opt=aimPrev]'); await wait(150);
    t.ok(opt0.row && opt0.v === 0 && await p.evaluate(() => OPT.aimPrev) === 1, '설정 "패링 목표 미리보기" — 기본 꺼짐, 누르면 켜짐');
    await p.evaluate(() => $('#modal').classList.remove('on'));
    // HUB 프리셋
    await toHub(p);
    const pre = await p.evaluate(() => { META.cur = 5000; const u = UPG.find(x => !x.phoneOnly && x.cost && x.cost[0] <= META.cur); u.lv = 1; META.cur -= u.cost[0]; save(); renderCards();
      const cur1 = META.cur; $('#exPreA').click(); $('#cfYes').click();
      u.lv = 0; META.cur += u.cost[0]; renderCards(); $('#exPreA').click(); $('#cfYes').click();
      return { lv: u.lv, ok: META.cur === cur1 }; });
    t.ok(pre.lv === 1 && pre.ok, '강화 프리셋 A: 저장 → 강화를 바꾼 뒤 불러오면 그 빌드로 돌아오고 재화도 맞음', JSON.stringify(pre));
    await p.evaluate(() => closeConfirm());
    await launchRun(p); await wait(1500);
    const a = await p.evaluate(async () => { const o = {}, sleep = ms => new Promise(r => setTimeout(r, ms));
      o.first = (run.ex.firstQ || []).map(f => f.g).join(); CFG.god = 1; run.phase = 'fight';
      // 흡수체: 다가오는 적 탄을 먹고, 죽으면 모은 만큼 터뜨림
      ens.length = 0; bullets.length = 0; queue.length = 0; spawnEnemy('absorber'); const ab = ens[0]; ab.x = ab.ax = 700; ab.y = ab.ay = 300; ab.bindT = 99;
      const mk = (x, y, dir) => ({ x, y, dir, spd: 200, base: 200, owner: 'enemy', returns: 0, boss: 0, age: 0, trail: [], glow: 0, hcd: 0, tried: [], ready: false, feint: 0, orbitDir: 0, orbitAmt: 0, straight: 1 });
      await sleep(50); bullets.push(mk(ab.x - 140, ab.y, 0), mk(ab.x, ab.y - 140, Math.PI / 2), mk(ab.x - 130, ab.y + 50, -0.37)); await sleep(1300);   // 흡수체 실제 자리 기준 (벽에 밀려 옮겨질 수 있음)
      o.charge = ab.charge; killEnemy(ab); o.boom = bullets.filter(b => b.from === '흡수체 폭발').length;
      // 거울 벽: 내 탄이 닿으면 적 쪽으로 꺾임
      bullets.length = 0; ens.length = 0; const m = run.mapWalls.find(w => w.mirror); o.mirrorWall = !!m && !m.prism;
      if (m) { const c = m.col; spawnEnemyAt('mob', 100, 100); const up = c.y > 120, sy = up ? c.y - 60 : c.y + c.h + 60;
        bullets.push({ x: c.x + c.w / 2, y: sy, dir: up ? Math.PI / 2 : -Math.PI / 2, spd: 300, base: 300, owner: 'player', returns: 1, age: 0, trail: [], glow: 1, hcd: 0.4, tried: [], ready: false, feint: 0, orbitDir: 0, orbitAmt: 0, pierceLeft: 0 });
        await sleep(900); o.bent = run.ex.mirror || 0; }
      // 랠리 피니시
      ens.length = 0; bullets.length = 0; const e = spawnEnemyAt('mob', P.x + 200, P.y), s0 = run.score;
      bullets.push({ x: e.x, y: e.y, dir: 0, spd: 1, base: 1, owner: 'player', returns: 6, age: 0, trail: [], glow: 1, hcd: 9, tried: [], ready: false, feint: 0, orbitDir: 0, orbitAmt: 0 });
      killEnemy(e); o.finish = msgs.some(m => /랠리 피니시 ×6/.test(m.text)) ? Math.round(run.score - s0) : 0;
      bullets.length = 0;
      return o; });
    t.ok(/mob/.test(a.first), '첫 등장 안내 — 처음 보는 잡몹', a.first);
    t.ok(a.charge >= 3 && a.boom === Math.min(24, 4 + a.charge), '흡수체: 적 탄을 빨아들이고 죽으면 4+모은 수만큼 터짐', a.charge + ' → ' + a.boom);
    t.ok(a.mirrorWall && a.bent >= 1, '거울 벽(프리즘 아님)에 닿은 내 탄이 적 쪽으로 꺾임', JSON.stringify({ w: a.mirrorWall, b: a.bent }));
    t.ok(a.finish > 0, '왕복 5회 이상 탄으로 처치 → 랠리 피니시 보너스', '+' + a.finish);
    const solo = await p.evaluate(async () => { ens.length = 0; bullets.length = 0; queue.length = 0; run.phase = 'fight'; CFG.god = 1;
      spawnEnemy('absorber'); const ab = ens[ens.length - 1]; ab.fireT = 0.1; let own = 0;
      for (let i = 0; i < 25; i++) { await new Promise(r => setTimeout(r, 100)); own = Math.max(own, bullets.filter(b => b.srcE === ab).length); }
      const o = { own, charge: ab.charge || 0 }; ens.length = 0; bullets.length = 0; return o; });
    t.ok(solo.own > 0 && solo.charge === 0, '흡수체 혼자 남으면 쏘고 자기 탄은 안 먹음 — 패링해서 잡을 수 있음', JSON.stringify(solo));
    const pab = await p.evaluate(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms)), o = {};
      ens.length = 0; bullets.length = 0; queue.length = 0; run.phase = 'fight'; CFG.god = 1; const rnd = Math.random;
      const shot = (e) => bullets.push({ x: e.x - 70, y: e.y, dir: 0, spd: 300, base: 300, owner: 'player', returns: 2, age: 0, trail: [], glow: 1, hcd: 0, tried: [e], ready: false, feint: 0, orbitDir: 0, orbitAmt: 0, pierceLeft: 0, htg: e });   // tried: 재탈취 안 함
      spawnEnemy('absorber'); const ab = ens[ens.length - 1]; ab.x = ab.ax = 600; ab.y = ab.ay = 300; ab.fireT = 99; ab.bindT = 99; await sleep(50); const hp0 = ab.hp;   // 구속으로 제자리에
      GRADES.absorber.eatP = 1; shot(ab); await sleep(600); o.ate = { charge: ab.charge || 0, pAbs: ab.pAbs || 0, hp: ab.hp === hp0 };
      GRADES.absorber.eatP = 0; shot(ab); await sleep(600); o.hit = ab.hp < hp0 || !ens.includes(ab); GRADES.absorber.eatP = 0.3;
      const s0 = run.score; if (ens.includes(ab)) killEnemy(ab); o.bonus = msgs.some(m => /흡수 보너스 \+40/.test(m.text)); o.gain = Math.round(run.score - s0);
      ens.length = 0; bullets.length = 0; return o; });
    t.ok(pab.ate.charge === 2 && pab.ate.pAbs === 1 && pab.ate.hp, '내 탄도 확률로 먹음 — 먹으면 피해 없이 충전 +2', JSON.stringify(pab.ate));
    t.ok(pab.hit, '확률에 안 걸린 내 탄은 그대로 맞음');
    t.ok(pab.bonus, '먹은 내 탄 1발 → 흡수체를 잡을 때 점수 +40', '+' + pab.gain);
    // 위험 계약: 웨이브 비우기 → 3초 안에 T → 다음 웨이브 ×1.5 → 버티면 보상 하나 더
    await p.evaluate(() => { ens.slice().forEach(e => killEnemy(e)); queue.length = 0; });
    for (let i = 0; i < 30 && await p.evaluate(() => run.phase) !== 'clear'; i++) await wait(100);
    const offer = await p.evaluate(() => run.riskOffer); await p.keyboard.press('t'); await wait(100);
    const next = await p.evaluate(() => run.riskNext);
    t.ok(offer === 1 && next === 1, '웨이브 클리어 직후 T → 위험 계약 수락');
    for (let i = 0; i < 80; i++) { const st = await p.evaluate(() => ({ ph: run.phase, rw: $('#reward').classList.contains('on') }));
      if (st.rw) { await wait(600); await p.keyboard.press('1'); await wait(300); continue; } if (st.ph === 'fight') break; await wait(200); }
    const risk = await p.evaluate(() => ({ on: run.riskOn, sr0: run.startRewards || 0 }));
    await p.evaluate(() => { ens.slice().forEach(e => killEnemy(e)); queue.length = 0; });
    for (let i = 0; i < 30 && await p.evaluate(() => run.phase) !== 'clear'; i++) await wait(100);
    t.ok(risk.on === 1 && await p.evaluate(() => run.startRewards || 0) === risk.sr0 + 1, '계약한 웨이브를 비우면 다음 보상 1개 더');
    // 탄 폭풍 (강제)
    await p.evaluate(() => { run.forceStorm = 1; });
    for (let i = 0; i < 80; i++) { const st = await p.evaluate(() => ({ ph: run.phase, rw: $('#reward').classList.contains('on') }));
      if (st.rw) { await wait(600); await p.keyboard.press('1'); await wait(300); continue; } if (st.ph === 'fight') break; await wait(200); }
    await wait(1500);
    const storm = await p.evaluate(() => ({ s: run.storm, ens: ens.length, b: bullets.filter(b => b.from === '탄 폭풍').length, q: queue.length }));
    t.ok(storm.s === 1 && storm.ens === 0 && storm.b > 0 && storm.q > 0, '탄 폭풍 웨이브: 적 없이 탄만', JSON.stringify(storm));
    // 일일 미션
    const mis = await p.evaluate(() => { run.cheat = 0; ['parries', 'kills', 'noHit', 'bossKills'].forEach(k => stat(k, 1)); const M0 = JSON.parse(localStorage.getItem('aether_x_mission')); const k = M0.list.find(x => ['parries', 'kills', 'noHit', 'bossKills'].includes(x)) || M0.list[0];
      const map = { parries: 1, kills: 1, noHit: 1, bossKills: 1 };
      const M1 = JSON.parse(localStorage.getItem('aether_x_mission')); return { n: M0.list.length, k, prog: M1.prog[k] || 0, statKey: !!map[k] }; });
    t.ok(mis.n === 3 && (!mis.statKey || mis.prog === 1), '일일 미션 3개, 기록이 미션 진행에 들어감', JSON.stringify(mis));
    await p.evaluate(() => go('hub')); await wait(300);
    // 연습장: 저격수, 쓰러져도 안 끝남 · 기록 안 함
    await p.evaluate(() => go('title')); await wait(200); await click(p, '#exPrac'); await wait(200);
    await p.evaluate(() => $('#modalBox [data-prac="sniper"]').click()); await wait(2500);
    const pr = await p.evaluate(async () => { const o = { p: !!run.practice, cheat: run.cheat, g: ens.map(e => e.grade).join() }; P.hp = 0; await new Promise(r => setTimeout(r, 300)); o.screen = screen; o.hp = P.hp; return o; });
    t.ok(pr.p && pr.cheat === 1 && /sniper/.test(pr.g), '연습장 — 고른 적만 나오고 기록 안 함', JSON.stringify(pr));
    t.ok(pr.screen === 'game' && pr.hp > 0, '연습장에선 쓰러져도 체력이 다시 참');
    await p.evaluate(() => go('hub')); await wait(200);
    // 보스 러시: 네 변형 → 결과
    await p.evaluate(() => go('title')); await wait(200); await click(p, '#exRush'); await wait(2500);
    const order = [];
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 80; i++) { const st = await p.evaluate(() => ({ ph: run.phase, rw: $('#reward').classList.contains('on') }));
        if (st.rw) { await wait(600); await p.keyboard.press('1'); await wait(300); continue; } if (st.ph === 'fight') break; await wait(200); }
      order.push(await p.evaluate(() => { CFG.god = 1; const b = ens.find(e => e.grade === 'boss'); const v = b && b.variant; if (b) killEnemy(b); ens.slice().forEach(e => killEnemy(e)); queue.length = 0; return v; }));
      for (let i = 0; i < 30 && await p.evaluate(() => screen === 'game' && run.phase === 'fight'); i++) await wait(100);   // 처치 직후엔 아직 fight — 단계가 넘어갈 때까지
    }
    for (let i = 0; i < 60 && await p.evaluate(() => screen) === 'game'; i++) { if (await p.evaluate(() => $('#reward').classList.contains('on'))) { await wait(500); await p.keyboard.press('1'); } await wait(250); }
    const rush = await p.evaluate(() => ({ screen, txt: ($('#exMore') || {}).innerText || '', cheat: run && run.cheat }));
    t.eq(order.join(), 'core,warden,phantom,collapse', '보스 러시 순서: 기본형 → 수호형 → 환영형 → 붕괴형');
    t.ok(rush.screen === 'result' && /보스 러시 — 완주/.test(rush.txt), '네 변형을 다 잡으면 완주 시간과 함께 결과 화면', rush.txt.replace(/\n/g, ' / '));
    noErrors(t, g, '추가 기능 새 적 · 모드'); await p.close();
  },
};

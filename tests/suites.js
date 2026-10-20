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
    for (const [mode, want] of [['hotd', 'aether_submit_hotd'], ['chaosx', '']]) {
      g.calls.length = 0; await launchRun(p, mode, 0); t.eq(await p.evaluate(() => run.mode), mode, mode + ' 출격');
      await finishRun(p); t.eq(g.calls.filter(c => /submit/.test(c.fn)).map(c => c.fn).join(','), want, mode + ' 판 → ' + (want || '랭킹 기록 없음'));
      await p.evaluate(() => go('hub')); await wait(800);
    }
    noErrors(t, g, '히든 모드'); await p.close();
  },
};

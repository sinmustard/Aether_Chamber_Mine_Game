// 테스트 공용 도구 — 게임 폴더를 로컬 서버로 띄우고, 설치된 크롬으로 연다.
// Supabase 요청은 전부 가짜 응답으로 받는다 → 실제 서버 · 랭킹 · 계정에는 아무것도 안 보낸다.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json' };
const wait = ms => new Promise(r => setTimeout(r, ms));

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, s) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { s.writeHead(404); return s.end(); }
      s.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(s);
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}

// CHROME_PATH 환경 변수 > 설치된 Chrome > 설치된 Edge
async function launch() {
  const headless = !process.env.HEADED;
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, headless });
  for (const channel of ['chrome', 'msedge']) { try { return await chromium.launch({ channel, headless }); } catch (e) {} }
  throw new Error('크롬/엣지를 찾지 못했어요. CHROME_PATH 환경 변수로 브라우저 경로를 알려 주세요.');
}

/* 가짜 Supabase
   opts.login  : 'legacy'(aether_login 없음, 기본) | 'token'(토큰 발급) | 'expired'(토큰 거절)
   opts.rows   : 랭킹 테이블 GET 응답
   opts.rejectChaosTag : build에 -chaos가 붙으면 400으로 거절
   opts.load   : aether_cloud_load가 돌려줄 저장 데이터 | 'none'(처음 쓰는 닉네임 → 400 '없어요')
   calls 배열에 {fn, body}가 쌓인다 (GET은 fn='GET:<table>') */
const TOKEN = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';
function fakeSupabase(page, opts = {}) {
  const calls = [];
  const login = opts.login || 'legacy';
  return page.route(/supabase\.co/, route => {
    const req = route.request(), url = req.url();
    const j = (status, obj) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(obj) });
    if (req.method() === 'GET') {
      const table = (url.split('/rest/v1/')[1] || '').split('?')[0];
      calls.push({ fn: 'GET:' + table });
      return j(200, opts.rows || []);
    }
    const fn = (url.match(/rpc\/([a-z_]+)/) || [])[1];
    let body = {}; try { body = req.postDataJSON() || {}; } catch (e) {}
    calls.push({ fn, body });
    const pin = body.p_pin, deny = () => j(400, { code: '28P01', message: '비밀번호가 달라요' });
    if (fn === 'aether_login') {
      if (login === 'legacy') return j(404, { code: 'PGRST202', message: 'Could not find the function' });
      return pin === '1234' ? j(200, TOKEN) : deny();
    }
    if (fn === 'aether_logout') return j(200, null);
    if (fn === 'aether_verified_rank' || fn === 'aether_my_rank') return j(200, []);
    if (fn === 'submit_aether_normal') return j(200, [{ rank: 1, best: 0, updated: true }]);
    const okPin = pin === '1234' || (login === 'token' && pin === 'tk:' + TOKEN);
    if (!okPin) return deny();
    if (/^aether_submit_/.test(fn)) {
      if (opts.rejectChaosTag && /-chaos$/.test(body.p_build || '')) return j(400, { code: 'P0001', message: 'invalid build' });
      return j(200, [{ rank: 1, best: 0, updated: true }]);
    }
    if (fn === 'aether_cloud_load') return opts.load === 'none' ? j(400, { code: 'P0001', message: '계정이 없어요' })
      : j(200, [{ data: opts.load || { opt: { tutSeen: 1 } }, updated_at: '2026-01-01T00:00:00Z' }]);
    if (fn === 'aether_cloud_stamp') return j(200, '2000-01-01T00:00:00Z');
    if (fn === 'aether_cloud_save') return j(200, '2026-01-01T00:00:01Z');
    if (fn === 'aether_is_dev') return j(200, false);
    if (fn === 'aether_run_start') return j(200, 'run-' + body.p_mode);   // v3.68 판 기록표 (#12)
    return j(200, null);
  }).then(() => calls);
}

/* 새 페이지. session: {name,pin}|{name,tk}|null, save: 저장 데이터(기본: 튜토리얼 본 상태)
   seed는 처음 한 번만 (새로고침해도 다시 심지 않음). errors: 페이지 오류 · 콘솔 오류(리소스 로드 실패 제외) */
async function openGame(browser, url, { session = { name: 'tester', pin: '1234' }, save = { opt: { tutSeen: 1 } }, supabase = {}, viewport } = {}) {
  const page = await browser.newPage({ viewport: viewport || { width: 1280, height: 800 } });
  const calls = await fakeSupabase(page, supabase);
  await page.addInitScript(([ss, sv]) => {
    if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
    if (ss) localStorage.setItem('aether_session', JSON.stringify(ss));
    if (sv) localStorage.setItem('aether_chamber_save_v1', JSON.stringify(sv));
  }, [session, save]);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url); await wait(800);
  return { page, calls, errors };
}

const click = (page, sel) => page.$eval(sel, e => e.click());   // 겹친 요소에 가려도 직접 누른다
const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
const screens = page => page.evaluate(() => screen);   // 게임 안 변수: 'title' | 'hub' | 'game' | 'result'
async function toHub(page) {
  await click(page, '#title [data-go=hub]'); await wait(1000);
  if (await visible(page, '#tutClose')) { await page.click('#tutClose'); await wait(300); }
}
async function launch_(page, mode = 'normal', chaos) {
  await click(page, '#hub [data-mode=' + mode + ']');
  if (chaos !== undefined) await page.evaluate(c => { OPT.chaos = c ? 1 : 0; syncModeUI(); }, chaos);
  await click(page, '#launch'); await wait(1200);
}
async function finishRun(page, score = 777) {   // 판을 바로 끝내고 결과 화면으로
  await page.evaluate(s => { run.score = s; endRun(); }, score); await wait(1200);
}
const submits = calls => calls.filter(c => /submit/.test(c.fn || '')).map(c => c.fn + '(' + c.body.p_build + ')');

module.exports = { ROOT, TOKEN, wait, serve, launch, openGame, click, visible, screens, toHub, launchRun: launch_, finishRun, submits };

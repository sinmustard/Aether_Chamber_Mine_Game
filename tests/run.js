// 사용법: tests 폴더에서 npm install 한 번 → npm test
//   node run.js 랭킹      ← 이름에 "랭킹"이 들어간 묶음만
//   HEADED=1 npm test      ← 브라우저 창을 띄워서 보기
const { serve, launch } = require('./lib');
const checkCode = require('./check-code');
const suites = require('./suites');

(async () => {
  const filter = process.argv[2] || '';
  const { srv, url } = await serve();
  const browser = await launch();
  let pass = 0, fail = 0;
  const list = [['코드 구조 검사', (t, c) => checkCode(t, c.browser)], ...Object.entries(suites)].filter(([n]) => n.includes(filter));
  for (const [name, fn] of list) {
    console.log('\n▶ ' + name);
    const t = {
      ok(cond, msg, detail) { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg + (detail ? '\n      ' + detail : '')); } },
      eq(a, b, msg) { this.ok(a === b, msg, '기대 ' + JSON.stringify(b) + ' / 실제 ' + JSON.stringify(a)); },
      fail(msg) { this.ok(false, msg); },
    };
    try { await fn(t, { browser, url }); } catch (e) { t.fail('테스트 중단: ' + e.message.split('\n')[0]); }
  }
  await browser.close(); srv.close();
  console.log('\n' + (fail ? '✗ 실패 ' + fail + '개 · ' : '✓ ') + '통과 ' + pass + '개');
  process.exit(fail ? 1 : 0);
})();

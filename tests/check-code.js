// js/*.js 를 index.html에 적힌 순서대로 읽어서 검사한다
// - 문법 오류
// - 같은 이름을 두 파일에서 선언 (전역 범위를 공유하므로 충돌)
// - 파일 맨 위에서 바로 실행되는 코드가 뒤 파일의 이름을 쓰는 경우 (그 시점엔 아직 없음)
// - 파일 맨 위의 this
// - 브라우저 기본 전역 이름(window.xxx)과 겹치는 선언 (알려진 것은 KNOWN_OK)
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk');
const { ROOT } = require('./lib');

const KNOWN_OK = new Set(['screen']);   // let screen — 코드에서 window.screen으로 따로 접근하므로 괜찮음

function loadOrder() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/\[((?:'[a-z0-9-]+',?\s*)+)\]\s*\.forEach\(function\(n\)\{ document\.write\('<script src="js\//);
  if (!m) throw new Error('index.html에서 js 파일 목록을 찾지 못했어요');
  return m[1].match(/[a-z0-9-]+/g);
}

module.exports = async function checkCode(t, browser) {
  const order = loadOrder();
  const onDisk = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3));
  onDisk.filter(f => !order.includes(f)).forEach(f => t.fail('js/' + f + '.js 가 index.html 파일 목록에 없어요 (불러오지 않음)'));
  order.filter(f => !onDisk.includes(f)).forEach(f => t.fail('index.html 목록의 js/' + f + '.js 파일이 없어요'));

  const decl = new Map(), asts = [];
  for (const n of order) {
    const file = path.join(ROOT, 'js', n + '.js');
    if (!fs.existsSync(file)) continue;
    try { asts.push({ n, ast: acorn.parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'script', locations: true }) }); }
    catch (e) { t.fail('문법 오류 js/' + n + '.js: ' + e.message); }
  }
  const namesOf = s => {
    if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') return [s.id.name];
    if (s.type !== 'VariableDeclaration') return [];
    const out = []; s.declarations.forEach(d => walk.full(d.id, x => { if (x.type === 'Identifier') out.push(x.name); })); return out;
  };
  asts.forEach(({ n, ast }, i) => ast.body.forEach(s => namesOf(s).forEach(name => {
    if (decl.has(name)) t.fail('같은 이름 "' + name + '"이 js/' + decl.get(name).n + '.js 와 js/' + n + '.js 에 둘 다 있어요');
    else decl.set(name, { n, i });
  })));
  const FN = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
  asts.forEach(({ n, ast }, i) => ast.body.forEach(s => {
    if (s.type === 'FunctionDeclaration') return;
    (function visit(node) {
      if (!node || typeof node.type !== 'string' || FN.has(node.type)) return;
      if (node.type === 'ThisExpression') t.fail('js/' + n + '.js:' + node.loc.start.line + ' 파일 맨 위에서 this를 써요');
      if (node.type === 'Identifier') { const d = decl.get(node.name);
        if (d && d.i > i) t.fail('js/' + n + '.js:' + node.loc.start.line + ' 바로 실행되는 코드가 뒤 파일(js/' + d.n + '.js)의 "' + node.name + '"을 써요'); }
      for (const k in node) {
        if (k === 'loc') continue;
        if (k === 'key' && node.type === 'Property' && !node.computed && !node.shorthand) continue;
        if (k === 'property' && node.type === 'MemberExpression' && !node.computed) continue;
        const v = node[k]; if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v);
      }
    })(s);
  }));
  const page = await browser.newPage();
  const win = new Set(await page.evaluate(() => { const s = []; for (let o = window; o; o = Object.getPrototypeOf(o)) s.push(...Object.getOwnPropertyNames(o)); return s; }));
  await page.close();
  [...decl.keys()].filter(k => win.has(k) && !KNOWN_OK.has(k))
    .forEach(k => t.fail('"' + k + '"(js/' + decl.get(k).n + '.js)가 브라우저 기본 전역 이름과 겹쳐요'));
  t.ok(true, 'js 파일 ' + order.length + '개 · 전역 이름 ' + decl.size + '개 검사');
};

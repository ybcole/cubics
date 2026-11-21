"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname, '../../', file), 'utf8');

function fieldHarness() {
  let cursor = 0, effects = [], timers = [], states = [], refs = [];
  const navigations = [];
  const element = (type, props) => ({ type, props });
  const context = {
    exports: {}, window: {}, URL, encodeURIComponent,
    setTimeout: callback => { timers.push(callback); return callback; },
    clearTimeout: callback => { timers = timers.filter(item => item !== callback); },
    require: name => name === 'react' ? {
      useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useRef: initial => { const i = cursor++; return refs[i] ||= { current: initial }; },
      useId: () => 'suggestions',
      useEffect: callback => effects.push(callback),
    } : name === 'react/jsx-runtime' ? { jsx: element, jsxs: element } : new Proxy({}, { get: (_, key) => key }),
  };
  vm.runInNewContext(ts.transpileModule(read('src/components/AddressField.tsx'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  const render = () => { cursor = 0; effects = []; return context.exports.default({ url: '', floating: true, onNavigate: url => navigations.push(url) }); };
  const input = tree => tree.props.children.find(child => child?.type === 'input');
  const type = value => { let tree = render(); input(tree).props.onFocus(); tree = render(); input(tree).props.onChange({ target: { value } }); return render(); };
  return { context, render, input, type, navigations, runEffects: () => effects.forEach(callback => callback()), runTimers: () => timers.splice(0).forEach(callback => callback()) };
}

test('M12.06 canvas field submits search, URLs and rejects empty/unsafe input', () => {
  for (const [query, expected] of [
    ['quiet workspace', 'https://www.google.com/search?q=quiet%20workspace'],
    ['example.com/path?q=hello', 'https://example.com/path?q=hello'],
    ['', undefined], ['https://user:password@example.com', undefined], ['javascript://example.com', undefined],
  ]) {
    const h = fieldHarness(), tree = h.type(query);
    tree.props.onSubmit({ preventDefault() {} });
    assert.equal(h.navigations[0], expected);
    assert.equal(h.navigations.length, expected ? 1 : 0);
  }
});

test('M12.06 suggestions use the same bridge and keyboard accepts the selected result', async () => {
  const h = fieldHarness();
  h.context.window.cubics = { suggestAddress: async query => {
    assert.equal(query, 'quiet');
    return { items: [{ kind: 'search', label: 'quiet workspace' }] };
  } };
  h.type('quiet'); h.runEffects(); h.runTimers();
  await Promise.resolve(); await Promise.resolve();
  let tree = h.render();
  h.input(tree).props.onKeyDown({ key: 'ArrowDown', nativeEvent: {}, preventDefault() {} });
  tree = h.render();
  h.input(tree).props.onKeyDown({ key: 'Enter', nativeEvent: {}, preventDefault() {}, stopPropagation() {} });
  assert.equal(h.navigations[0], 'https://www.google.com/search?q=quiet%20workspace');
});

test('M12.06 floating field preserves draft when focus moves to Search; IME does not submit', () => {
  const h = fieldHarness(); let tree = h.type('keep this query');
  h.input(tree).props.onBlur(); tree = h.render();
  assert.equal(h.input(tree).props.value, 'keep this query');
  let prevented = false;
  h.input(tree).props.onKeyDown({ key: 'Enter', nativeEvent: { isComposing: true }, preventDefault() { prevented = true; } });
  assert.ok(prevented); assert.equal(h.navigations.length, 0);
});

test('M12.06 canvas shortcut ignores controls/dialogs/repeats and uses existing private creation', () => {
  const canvas = read('src/app/spaces/[id]/page.tsx');
  assert.match(canvas, /e\.defaultPrevented \|\| e\.isComposing \|\| e\.repeat/);
  assert.match(canvas, /showTabPicker \|\| showCanvasSearch \|\| document\.querySelector\('\[role="dialog"\]'\)/);
  assert.match(canvas, /target\?\.closest\('button, a,/);
  assert.match(canvas, /if \(e\.key === "Enter" && !e\.shiftKey\)/);
  assert.match(canvas, /void openInNewWidget\(url\)/);
  assert.match(canvas, /writePersonalNavigation\(roomId, widget\.id, clerkUserId, url\)/);
  const search = read('src/components/CanvasSearch.tsx');
  assert.match(search, /<Modal open/);
  assert.match(search, /opener\.focus\(\{ preventScroll: true \}\)/);
});

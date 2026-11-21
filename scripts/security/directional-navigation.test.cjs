"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const file = path.resolve(__dirname, '../../src/lib/canvas', name + '.ts');
  const context = { exports: {}, Math, Number };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, context);
  return context.exports;
}
const { cameraForTab, keyDirection, tabCenter, findDirectionalTab, canNavigateCanvas } = load('directional-navigation');
const { createCameraMotion } = load('camera-motion');
const tab = (id, cx, cy, w = 100, h = 100) => ({ id, x: cx-w/2, y: cy-h/2, w, h });
const origin = { x: 0, y: 0 };

test('M10.03 WASD and arrows map identically; unrelated keys do nothing', () => {
  for (const [letter, arrow, direction] of [['w','ArrowUp','up'], ['a','ArrowLeft','left'], ['s','ArrowDown','down'], ['d','ArrowRight','right']]) {
    assert.equal(keyDirection(letter), direction);
    assert.equal(keyDirection(letter.toUpperCase()), direction);
    assert.equal(keyDirection(arrow), direction);
  }
  assert.equal(keyDirection('Enter'), null);
});

test('M10.03 chooses nearest aligned neighbor in every half-plane from SCREEN center', () => {
  const tabs = [tab('origin', 0, 0), tab('up',0,-200), tab('far-up',0,-5000), tab('down',0,200), tab('left',-200,0), tab('right',200,0)];
  for (const direction of ['up', 'down', 'left', 'right']) assert.equal(findDirectionalTab(tabs, origin, direction).id, direction);
  assert.equal(findDirectionalTab(tabs, { x: 0, y: -210 }, 'up').id, 'far-up');
  assert.equal(findDirectionalTab(tabs, { x: 0, y: -210 }, 'down').id, 'up');
});

test('M10.03 no distance cutoff or cone; a very distant diagonal remains reachable', () => {
  const tabs = [tab('diagonal', 999999, -1)];
  assert.equal(findDirectionalTab(tabs, origin, 'up').id, 'diagonal');
  assert.equal(findDirectionalTab(tabs, origin, 'down'), null);
  assert.equal(findDirectionalTab([], origin, 'up'), null);
});

test('M10.03 alignment preference balances proximity, sizes use centers, ties are stable', () => {
  assert.equal(findDirectionalTab([tab('aligned',0,-130), tab('diagonal',60,-100)], origin, 'up').id, 'aligned');
  assert.equal(findDirectionalTab([tab('too-far',0,-10000), tab('near-diagonal',60,-100)], origin, 'up').id, 'near-diagonal');
  const equal = [tab('b', -10, -100), tab('a', 10, -100)];
  assert.equal(findDirectionalTab(equal, origin, 'up').id, 'a');
  assert.equal(findDirectionalTab(equal.reverse(), origin, 'up').id, 'a');
  assert.equal(findDirectionalTab([tab('wide', 100, -200, 1000, 600)], origin, 'right').id, 'wide');
  assert.equal(findDirectionalTab([tab('same',0,0), tab('bad',NaN,-1), tab('zero',0,-1,0)], origin, 'up'), null);
});

test('M10.03 rapid presses choose beyond the pending destination, reversing can return', () => {
  const tabs = [tab('a',0,0),tab('b',0,-200),tab('c',0,-400)];
  const b = findDirectionalTab(tabs, origin, 'up');
  assert.equal(findDirectionalTab(tabs, tabCenter(b), 'up', b.id).id, 'c');
  assert.equal(findDirectionalTab(tabs, tabCenter(b), 'down', b.id).id, 'a');
});

test('M12.06 canvas-only focus protects browser guests, typing, sidebar, dialogs and held keys', () => {
  const body = {}, input = {}, guest = {}, control = {};
  let dialog = false;
  const doc = { body, activeElement: body, querySelector: () => dialog };
  const canvas = { ownerDocument: doc };
  const event = { target: body };
  assert.ok(canNavigateCanvas(event, canvas));
  doc.activeElement = canvas;
  assert.ok(canNavigateCanvas({ target: canvas }, canvas));
  for (const target of [input, guest, control]) {
    assert.equal(canNavigateCanvas({ target }, canvas), false);
    doc.activeElement = target;
    assert.equal(canNavigateCanvas(event, canvas), false);
  }
  doc.activeElement = body;
  for (const flag of ['defaultPrevented','repeat','isComposing','metaKey','ctrlKey','altKey','shiftKey']) {
    assert.equal(canNavigateCanvas({ ...event, [flag]: true }, canvas), false);
  }
  dialog = true; assert.equal(canNavigateCanvas(event, canvas), false);
  assert.equal(canNavigateCanvas(event, null), false);
});

function animation() {
  let time = 0, next = 0, completed = 0;
  const pending = new Map(), writes = [];
  const motion = createCameraMotion({ now: () => time,
    request: callback => { pending.set(++next, callback); return next; },
    cancel: id => pending.delete(id),
  }, point => writes.push(point), () => completed++);
  return { motion, pending, writes, get completed() { return completed; },
    advance(to) { time = to; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(time)); } };
}

test('M10.02 camera writes once per frame, settles exactly, completes once without a queued tail', () => {
  const h = animation();
  h.motion.move(origin, { x: 1000, y: -500 });
  assert.equal(h.pending.size, 1); assert.equal(h.writes.length, 0);
  h.advance(16); assert.equal(h.writes.length, 1); assert.equal(h.pending.size, 1);
  assert.ok(h.writes[0].x > 0 && h.writes[0].x < 1000);
  h.advance(180);
  assert.equal(h.writes.at(-1).x, 1000); assert.equal(h.writes.at(-1).y, -500);
  assert.equal(h.completed, 1); assert.equal(h.pending.size, 0); assert.equal(h.motion.running, false);
});

test('M10.02 retarget immediately from current camera with one pending frame; stale work cannot win', () => {
  const h = animation();
  h.motion.move(origin, { x: 1000, y: 0 }); h.advance(45);
  const current = h.writes.at(-1), stale = [...h.pending.values()][0];
  h.motion.move(current, { x: -500, y: 700 });
  assert.equal(h.pending.size, 1);
  const count = h.writes.length; stale(1000); assert.equal(h.writes.length, count);
  h.advance(45); assert.equal(h.writes.at(-1).x, current.x);
  h.advance(225); assert.equal(h.writes.at(-1).x, -500); assert.equal(h.writes.at(-1).y, 700);
  assert.equal(h.completed, 1);
});

test('M10.02 cancel/room exit stops stale callbacks; reduced motion is immediate', () => {
  const h = animation(); h.motion.move(origin, { x: 5, y: 10 });
  const stale = [...h.pending.values()][0];
  assert.ok(h.motion.stop()); stale(180);
  assert.equal(h.writes.length, 0); assert.equal(h.completed, 0);
  assert.equal(h.pending.size, 0); assert.equal(h.motion.stop(), false);
  h.motion.move(origin, { x: 30, y: 40 }, true);
  assert.equal(h.writes.at(-1).x, 30); assert.equal(h.completed, 1); assert.equal(h.pending.size, 0);
  h.motion.move(origin, { x: NaN, y: 0 }); assert.equal(h.pending.size, 0);
});

test('M10.02 100 rapid redirects never queue animations or deliver stale destinations', () => {
  const h = animation(); let from = origin;
  for (let i = 1; i <= 100; i++) {
    h.motion.move(from, { x: i*100, y: i*200 }); h.advance(i*2);
    from = h.writes.at(-1); assert.equal(h.pending.size, 1);
  }
  h.advance(1000); assert.equal(h.writes.at(-1).x, 10000);
  assert.equal(h.writes.at(-1).y, 20000); assert.equal(h.completed, 1);
});

test('M10.03 large layouts remain deterministic and geometry is never mutated', () => {
  const tabs = Object.freeze(Array.from({ length: 10000 }, (_, i) => Object.freeze(tab(String(i), i*10, -100-i*10))));
  assert.equal(findDirectionalTab(tabs, origin, 'up').id, '0');
  assert.equal(findDirectionalTab(tabs, origin, 'down'), null);
});


test('M10.01 exact centering at fractional zoom, viewport sizes and world edges without changing zoom', () => {
  for (const zoom of [0.1, 0.375, 1, 2, 5]) {
    for (const [width, height] of [[320,480],[1280,800],[2560,1440]]) {
      for (const destination of [tab('edge',50,50),tab('far',99000,99000),tab('fractional',123.75,456.125,333,777)]) {
        const camera = cameraForTab(destination, zoom, width, height);
        const center = tabCenter(destination);
        assert.ok(Math.abs(center.x * zoom - camera.x - width/2) < 1e-8);
        assert.ok(Math.abs(center.y * zoom - camera.y - height/2) < 1e-8);
      }
    }
  }
});

test('M10.02 integration keeps frame writes local and cancels camera ownership on competing gestures', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../../src/app/spaces/[id]/page.tsx'), 'utf8');
  const frames = page.slice(page.indexOf('const motion = createCameraMotion'), page.indexOf('cameraMotionRef.current = motion'));
  assert.doesNotMatch(frames, /setWidgets|_setZoom|setZOrder|fetch\(|\.emit\(|localStorage|clientWidth|getBoundingClientRect/);
  assert.match(frames, /applyCamera\(\)/);
  assert.match(page, /motion\.move\(camRef\.current, cameraForTab\(next, z, width, height\)/);
  assert.match(page, /const origin = pending \? tabCenter\(pending\)/);
  assert.match(page, /onPointerDownCapture=\{stopTabNavigation\}/);
  assert.match(page, /onBlurCapture=\{stopTabNavigation\}/);
  assert.match(page, /const onWheel = \(e: WheelEvent\) => \{\s+stopTabNavigation\(\)/);
  assert.match(page, /const zoomTo = useCallback\(\(value: number\) => \{\s+stopTabNavigation\(\)/);
  assert.match(page, /current\.x !== pending\.x/);
});

"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), ts = require('typescript');
function clock() {
  let time = 0, sequence = 0;
  const timers = new Map();
  return { now: () => time,
    schedule(fn, delay) { const id = ++sequence; timers.set(id, { at: time + delay, fn }); return id; },
    cancel(id) { timers.delete(id); },
    advance(to) {
      while (true) {
        const next = [...timers].filter(([, v]) => v.at <= to).sort((a,b) => a[1].at-b[1].at)[0];
        if (!next) break;
        time = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      time = to;
    },
    get size() { return timers.size; },
  };
}
function modules(environment = {}) {
  const cache = new Map();
  return function load(name) {
    name = name.replace('./', '');
    if (cache.has(name)) return cache.get(name);
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/lib/canvas', name + '.ts'), 'utf8');
    const context = { exports: {}, performance, console, ...environment, require: load };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    } }).outputText, context);
    cache.set(name, context.exports);
    return context.exports;
  };
}

test('M10.02 1000 pointer samples produce one camera write per display frame with latest coordinates', () => {
  const { createLatestFrame } = modules()('latest-frame');
  let callback, cancelled = 0;
  const writes = [];
  const frame = createLatestFrame(fn => { assert.equal(callback, undefined); callback = fn; return 1; }, () => { callback = undefined; cancelled++; }, value => writes.push(value));
  for (let i=0;i<1000;i++) frame.push({ x:i,y:i*2 });
  assert.equal(writes.length,0); const first = callback; callback = undefined; first();
  assert.equal(writes.length,1); assert.equal(writes[0].x,999);
  frame.push({x:1000}); frame.flush(); assert.equal(writes.at(-1).x,1000); assert.equal(cancelled,1);
  frame.push({x:2000}); const stale=callback; frame.cancel(); stale();
  assert.equal(writes.length,2);
  frame.push({x:3000}); stale(); assert.equal(writes.length,2);
  const last=callback; callback=undefined; last(); assert.equal(writes.at(-1).x,3000);
});

test('M11.04 expensive jobs wait through continuous pan and resume one per slot after quiet', () => {
  const c=clock(), {createDeferredWork}=modules()('deferred-work');
  const q=createDeferredWork(c), ran=[];
  for(let i=0;i<100;i++)q.enqueue({},()=>ran.push(c.now()));
  for(let t=0;t<=500;t+=16){c.advance(t);q.touch();}
  assert.equal(ran.length,0); assert.equal(c.size,1);
  c.advance(595); assert.equal(ran.length,0);
  c.advance(596); assert.equal(ran.length,1);
  c.advance(628); assert.equal(ran.length,2);
  q.dispose();c.advance(10000);assert.equal(ran.length,2);assert.equal(c.size,0);
});

test('M11.04 pending jobs coalesce by identity, prioritize nearest and cancel on unmount', () => {
  const c=clock(),{createDeferredWork}=modules()('deferred-work');const q=createDeferredWork(c), key={}, removed={},ran=[];
  q.enqueue({},()=>ran.push('far'),1000);q.enqueue(key,()=>ran.push('stale'),1);
  q.enqueue(key,()=>ran.push('latest'),1);q.enqueue(removed,()=>ran.push('removed'),0);q.cancel(removed);
  assert.equal(q.pending,2);c.advance(32);assert.deepEqual(ran,['latest']);
  c.advance(64);assert.deepEqual(ran,['latest','far']);assert.equal(c.size,0);
  q.dispose();q.enqueue({},()=>ran.push('disposed'));c.advance(100);assert.equal(ran.length,2);
});

function visibilityHarness() {
  const c=clock(),observers=[];
  class Observer {
    constructor(callback,options){this.callback=callback;this.options=options;this.elements=new Set();observers.push(this);}
    observe(el){this.elements.add(el);} unobserve(el){this.elements.delete(el);} disconnect(){this.elements.clear();}
    emit(entries){this.callback(entries);}
  }
  const load=modules({ performance:{now:c.now},window:{setTimeout:c.schedule,clearTimeout:c.cancel,innerWidth:1000,innerHeight:800},IntersectionObserver:Observer });
  return {c,observers,...load('visibility'),work:load('deferred-work').canvasWork};
}
const entry=(target,visible=true,x=0,ratio=1)=>({target,isIntersecting:visible,intersectionRatio:ratio,boundingClientRect:{x,y:0,width:800,height:600}});

test('M11.04 one observer serves 100 cold guests; none start during motion, nearest starts first', () => {
  const h=visibilityHarness(),elements=Array.from({length:100},()=>({})),ran=[],cleanup=[];
  for(let i=0;i<100;i++)cleanup.push(h.observeColdGuest(elements[i],()=>ran.push(i)));
  assert.equal(h.observers.length,1);
  h.observers[0].emit(elements.map((el,i)=>entry(el,true,i*1000)));
  h.work.touch();h.c.advance(299);assert.equal(ran.length,0);
  h.c.advance(300);assert.deepEqual(ran,[0]);h.c.advance(332);assert.deepEqual(ran,[0,1]);
  h.observers[0].emit([entry(elements[0])]);h.c.advance(364);assert.deepEqual(ran,[0,1,2]);
  cleanup.forEach(fn=>fn());h.c.advance(10000);assert.equal(ran.length,3);assert.equal(h.work.pending,0);
});

test('M11.04 passing or removed cold tabs never start; fallback is paced without IntersectionObserver', () => {
  const h=visibilityHarness(),a={},b={},ran=[];
  h.observeColdGuest(a,()=>ran.push('a'));const cancel=h.observeColdGuest(b,()=>ran.push('b'));
  h.observers[0].emit([entry(a),entry(b)]);h.observers[0].emit([entry(a,false)]);cancel();
  h.c.advance(1000);assert.deepEqual(ran,[]);
  const c=clock();const load=modules({performance:{now:c.now},window:{setTimeout:c.schedule,clearTimeout:c.cancel}});
  load('visibility').observeColdGuest({},()=>ran.push('fallback'));
  c.advance(31);assert.deepEqual(ran,[]);c.advance(32);assert.deepEqual(ran,['fallback']);
});

test('M11.04 stream visibility uses one observer and publishes only latest ratios after motion', () => {
  const h=visibilityHarness(),a={},b={},ran=[];
  const offA=h.observeStreamVisibility(a,(visible,ratio)=>ran.push(['a',visible,ratio]));
  const offB=h.observeStreamVisibility(b,(visible,ratio)=>ran.push(['b',visible,ratio]));
  assert.equal(h.observers.length,1);
  h.observers[0].emit([entry(a,true,0,1),entry(b,true,0,0.1)]);h.work.touch();
  h.observers[0].emit([entry(a,false,0,0),entry(b,true,0,0.75)]);
  h.c.advance(299);assert.equal(ran.length,0);h.c.advance(300);
  assert.deepEqual(ran,[['a',false,0],['b',true,0.75]]);
  h.observers[0].emit([entry(a)]);offA();offB();h.c.advance(1000);assert.equal(ran.length,2);
});

test('M10/M11 integration avoids eager browser grants, O(n²) rendering and guest destruction', () => {
  const read=file=>fs.readFileSync(path.resolve(__dirname,'../../',file),'utf8');
  const page=read('src/app/spaces/[id]/page.tsx'),personal=read('src/components/PersonalTabView.tsx'),partition=read('src/lib/browser/useGuestPartition.ts');
  assert.match(page,/const widgetElements = useMemo/);assert.doesNotMatch(page,/zOrder\.indexOf/);
  assert.match(page,/gestures\.pointer/);assert.match(page,/gestures\.endPan/);
  const camera=page.slice(page.indexOf('const setCamera ='),page.indexOf('const cameraMotionRef ='));
  assert.doesNotMatch(camera,/clientWidth|clientHeight|getBoundingClientRect/);
  assert.match(personal,/observeColdGuest\(el, \(\) => setHasEnteredViewport\(true\)\)/);
  assert.doesNotMatch(personal,/setHasEnteredViewport\(false\)/);
  assert.match(personal,/useGuestPartition\("personal", userId, widget.id, hasEnteredViewport\)/);
  assert.match(partition,/if \(!enabled \|\| !userId/);
  assert.match(personal,/observeColdGuest\(element, \(\) => setGuestAdmitted\(true\)\)/);
  assert.match(personal,/key=\{partition \+ ":" \+ generation\}/);
  assert.match(read('src/components/StreamedTabView.tsx'),/observeStreamVisibility/);
});

test('M11.02 actual room page reuses widget elements across chat and pan UI renders', () => {
  let cursor=0, stateOrdinal=0, creations=0;
  const hooks=[], setters=[];
  const react={
    memo: component=>component,
    useRef(value){const i=cursor++;return hooks[i]??=( {current:value} );},
    useState(initial){const i=cursor++,ordinal=stateOrdinal++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;
      const set=value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;};setters[ordinal]??=set;return[hooks[i],setters[ordinal]];},
    useMemo(create,deps){const i=cursor++,old=hooks[i];if(!old||!deps||deps.some((v,n)=>v!==old.deps[n]))hooks[i]={value:create(),deps};return hooks[i].value;},
    useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
    useEffect(){cursor++;},useLayoutEffect(){cursor++;},
  };
  const jsx=(type,props)=>{if(type?.name==='WidgetRenderer')creations++;return{type,props};};
  const user={id:'owner',fullName:'Owner',imageUrl:null}, getToken=()=>Promise.resolve(null);
  const dummy=()=>null;
  const requireMock=name=>{
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
    if(name==='next/navigation')return{useParams:()=>({id:'room'})};
    if(name==='@clerk/nextjs')return{useUser:()=>({user,isLoaded:true}),useAuth:()=>({getToken})};
    if(name.endsWith('/latest-frame'))return{createLatestFrame:()=>({cancel(){},flush(){},push(){}})};
    return new Proxy({__esModule:true,default:dummy},{get:(target,key)=>target[key]??dummy});
  };
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/app/spaces/[id]/page.tsx'),'utf8');
  const context={exports:{},require:requireMock,performance,console,process:{env:{NODE_ENV:"test"}}};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,context);
  const render=()=>{cursor=0;stateOrdinal=0;return context.exports.default();};
  render();
  setters[0](Array.from({length:100},(_,i)=>({id:String(i),roomId:'room',createdBy:'owner',x:i*900,y:0,w:800,h:600,type:'iframe'})));
  render();assert.equal(creations,100);
  for(let i=0;i<20;i++){setters[1]([{id:String(i),content:'message',createdAt:'2026-11-21'}]);render();}
  assert.equal(creations,100,'chat updates must not recreate the browser widget tree');
  // Trigger every boolean page state (including pan state). None belongs to
  // the widget-list dependencies; existing guests keep their element identities.
  const booleanHooks=hooks.map((value,i)=>typeof value==='boolean'?i:-1).filter(i=>i>=0);
  for(const i of booleanHooks)hooks[i]=!hooks[i];
  render();assert.equal(creations,100,'pan/chrome state must not recreate browser widgets');
});

test('M11.04 deferred partition hook performs no eager IPC and still honors account revocation', async () => {
  let cursor=0,calls=0,revoked;
  const hooks=[],pending=[];
  const react={
    useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=initial;return[hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];},
    useEffect(create,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n])){
      hooks[i]={deps,cleanup:old?.cleanup};pending.push(()=>{hooks[i].cleanup?.();hooks[i].cleanup=create();});
    }},
  };
  const cubics={isElectron:true,
    onBrowserAccountRevoked(listener){revoked=listener;return()=>{};},
    onBrowserDataCleared(){return()=>{};},
    async getBrowserPartition(kind,id,userId){calls++;assert.equal(kind,'personal');assert.equal(id,null);assert.equal(userId,'owner');return'protected';},
  };
  const context={exports:{},window:{cubics},require:name=>{assert.equal(name,'react');return react;}};
  const file=path.resolve(__dirname,'../../src/lib/browser/useGuestPartition.ts');
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
  const render=enabled=>{cursor=0;return context.exports.useGuestPartition('personal','owner','tab',enabled);};
  const flush=()=>pending.splice(0).forEach(fn=>fn());
  assert.equal(render(false).partition,null);flush();await Promise.resolve();assert.equal(calls,0);
  render(true);flush();await Promise.resolve();await Promise.resolve();
  assert.equal(render(true).partition,'protected');assert.equal(calls,1);
  revoked({userId:'owner'});assert.equal(render(true).partition,null);assert.equal(calls,1);
});

test('M10.04 actual sidebar-reflow callback preserves the pan anchor instead of snapping back', () => {
  const page=fs.readFileSync(path.resolve(__dirname,'../../src/app/spaces/[id]/page.tsx'),'utf8');
  const body=page.match(/const ro = new ResizeObserver\(\(\) => \{([\s\S]*?)\n    \}\);/)[1];
  let left=300,top=0;
  const context={ enabled:true,lastLeft:300,lastTop:0,
    main:{getBoundingClientRect:()=>({left,top})},
    camRef:{current:{x:500,y:600}},scrollAtStart:{current:{x:500,y:600}},isPanning:{current:true},
    gestures:{flush(){}},stopTabNavigation(){},setCamera(x,y){context.camRef.current={x,y};},
  };
  vm.createContext(context);
  left=72;top=10;
  vm.runInContext('(function(){'+body+'})()',context);
  assert.equal(context.camRef.current.x,272);assert.equal(context.scrollAtStart.current.x,272);
  assert.equal(context.camRef.current.y,610);assert.equal(context.scrollAtStart.current.y,610);
  // The next pointer sample must preserve the sidebar compensation.
  const nextCamera=context.scrollAtStart.current.x-100;
  assert.equal(nextCamera,172);
  assert.equal(1000-nextCamera+left,900,'screen position equals pre-reflow position plus drag delta');
  context.isPanning.current=false;left=0;
  vm.runInContext('(function(){'+body+'})()',context);
  assert.equal(context.scrollAtStart.current.x,272,'idle reflow must not mutate an inactive drag anchor');
});

test('M10.03 held canvas pan blocks deferred jobs even while the pointer is stationary',()=>{
 const c=clock(),{createDeferredWork}=modules()('deferred-work'),q=createDeferredWork(c,300),hold={},ran=[];
 q.enqueue({},()=>ran.push('job'));q.hold(hold);q.hold(hold);c.advance(5000);
 assert.equal(ran.length,0);assert.equal(c.size,0);
 q.release(hold);c.advance(5299);assert.equal(ran.length,0);c.advance(5300);assert.deepEqual(ran,['job']);
});

test('M11.04 quick 140ms gesture gaps do not admit expensive startup or metadata work',()=>{
 const c=clock(),{createDeferredWork}=modules()('deferred-work'),q=createDeferredWork(c,300),ran=[];
 q.enqueue({},()=>ran.push(c.now()));
 for(let t=0;t<=1400;t+=140){c.advance(t);q.touch();}
 assert.equal(ran.length,0);c.advance(1699);assert.equal(ran.length,0);c.advance(1700);assert.equal(ran.length,1);
});

test('M11.04 jobs require a browser idle budget and new input invalidates an admitted idle callback',()=>{
 const c=clock(),{createDeferredWork}=modules()('deferred-work'),idle=new Map();let sequence=0,ran=0;
 const q=createDeferredWork({...c,now:c.now,schedule:c.schedule,cancel:c.cancel,
  idle:{request:fn=>{idle.set(++sequence,fn);return sequence;},cancel:id=>idle.delete(id)}},100);
 q.enqueue({},()=>ran++);c.advance(100);assert.equal(ran,0);assert.equal(idle.size,1);
 const stale=[...idle.values()][0];q.touch();assert.equal(idle.size,0);
 c.advance(200);stale(50);assert.equal(ran,0);
 let fn=[...idle.values()][0];idle.clear();fn(0);assert.equal(ran,0);
 c.advance(232);fn=[...idle.values()][0];idle.clear();fn(8);assert.equal(ran,1);
});

test('M11.04 holds, room disposal and canceled jobs remove browser idle callbacks',()=>{
 const c=clock(),{createDeferredWork}=modules()('deferred-work'),idle=new Map();let sequence=0,ran=0;
 const q=createDeferredWork({now:c.now,schedule:c.schedule,cancel:c.cancel,
  idle:{request:fn=>{idle.set(++sequence,fn);return sequence;},cancel:id=>idle.delete(id)}},100);
 const key={},hold={};q.enqueue(key,()=>ran++);c.advance(100);const stale=[...idle.values()][0];
 q.hold(hold);assert.equal(idle.size,0);q.release(hold);c.advance(200);q.dispose();stale(50);
 assert.equal(idle.size,0);assert.equal(ran,0);assert.equal(q.pending,0);
});

test('M10.02 local frame diagnostics stay bounded, numeric and resettable',()=>{
 const{createFrameDiagnostics}=modules()('frame-diagnostics'),d=createFrameDiagnostics(3);
 for(let i=1;i<=10;i++){d.frame(i,2*i);d.job(i);d.longTask(50+i);}
 const report=d.read();assert.equal(report.frames,10);assert.equal(report.inputToFrame.samples,3);
 assert.equal(report.inputToFrame.maxMs,10);assert.equal(report.cameraCallback.maxMs,20);
 assert.equal(report.deferredJobs.count,10);assert.equal(report.longTasks.count,10);
 assert.doesNotMatch(JSON.stringify(report),/url|title|cookie|token|image/i);
 d.reset();assert.equal(d.read().frames,0);assert.equal(d.read().inputToFrame.samples,0);
});

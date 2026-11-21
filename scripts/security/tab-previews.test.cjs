"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function moduleAt(file,extra={},requireMock){const context={exports:{},AbortController,Blob,Uint8Array,atob,console,...extra,require:requireMock??(()=>({}))};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);return context.exports;}
const{createPreviewCoordinator}=moduleAt('src/lib/canvas/preview-cache.ts');
const{createPreviewMotion}=moduleAt('src/lib/canvas/preview-motion.ts');
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function pool(limits={count:8,bytes:8e6,pixels:6e6}){
 const jobs=new Map(),released=[],published=[];let time=0,every=null,stops=0;
 const work={enqueue:(key,run)=>jobs.set(key,run),cancel:key=>jobs.delete(key)};
 const cache=createPreviewCoordinator(work,{now:()=>time,every:fn=>{every=fn;return 1;},stop(){stops++;every=null;}},limits);
 const image=(name,bytes=20,pixels=100)=>({url:'blob:'+name,bytes,pixels,release(){released.push(name);}});
 return{cache,jobs,released,published,image,get stops(){return stops;},advance(ms){time+=ms;every?.();},
  add(name,capture=async()=>image(name)){return cache.register(capture,url=>published.push([name,url]));},
  async drain(){for(let i=0;i<100&&jobs.size;i++){const[key,fn]=[...jobs][0];jobs.delete(key);fn();await settle();}},
  one(){const[key,fn]=[...jobs][0];jobs.delete(key);fn();},
 };
}

test('M11 bounded preview cache serializes capture and only captures visible guests',async()=>{
 const h=pool();let active=0,maximum=0;
 const make=name=>h.add(name,async()=>{active++;maximum=Math.max(maximum,active);await Promise.resolve();active--;return h.image(name);});
 const a=make('a'),b=make('b'),off=make('off');a.visible(true);b.visible(true);await h.drain();
 assert.equal(maximum,1);assert.equal(h.cache.stats().count,2);assert.equal(h.published.some(([name])=>name==='off'),false);
 a.dispose();b.dispose();off.dispose();assert.equal(h.cache.stats().count,0);assert.equal(h.stops,1);
});

test('M11 cached preview LRU respects image, encoded-byte and decoded-pixel budgets',async()=>{
 for(const limits of[{count:2,bytes:1000,pixels:1000},{count:8,bytes:45,pixels:1000},{count:8,bytes:1000,pixels:210}]){
  const h=pool(limits),a=h.add('a'),b=h.add('b'),c=h.add('c');a.visible(true);b.visible(true);c.visible(true);await h.drain();
  const s=h.cache.stats();assert.ok(s.count<=limits.count);assert.ok(s.bytes<=limits.bytes);assert.ok(s.pixels<=limits.pixels);
  assert.ok(h.released.includes('a'));a.dispose();b.dispose();c.dispose();assert.equal(h.released.length,3);
 }
});

test('M05 deleting a tab before preview publication releases its prepared image',async()=>{
 const h=pool(),a=h.add('a');a.visible(true);h.one();await settle();assert.equal(h.published.length,0);
 a.dispose();await h.drain();assert.deepEqual(h.released,['a']);assert.equal(h.cache.stats().count,0);assert.equal(h.published.length,0);
});

test('M05 navigation/reset aborts in-flight preview capture and rejects stale images',async()=>{
 const h=pool();let resolve,signal;
 const a=h.add('a',s=>{signal=s;return new Promise(done=>{resolve=done;});});a.visible(true);h.one();await settle();
 a.invalidate();assert.equal(signal.aborted,true);resolve(h.image('stale'));await settle();a.dispose();await h.drain();
 assert.deepEqual(h.released,['stale']);assert.equal(h.published.length,0);
});

test('M11 missing/failed captures retry and refresh only while visible',async()=>{
 const h=pool();let attempts=0;
 const a=h.add('a',async()=>{attempts++;throw new Error('capture unavailable');});a.visible(true);await h.drain();
 assert.equal(attempts,1);assert.equal(h.published.length,0);a.visible(false);h.advance(3000);await h.drain();assert.equal(attempts,1);
 a.visible(true);await h.drain();assert.equal(attempts,2);a.dispose();assert.equal(h.jobs.size,0);
});

function motion(){let now=0,id=0;const timers=new Map(),changes=[];
 const m=createPreviewMotion({now:()=>now,schedule:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},cancel:id=>timers.delete(id)}, {x:0,y:0,zoom:1},value=>changes.push(value));
 return{m,timers,changes,advance(to){while(true){const next=[...timers].filter(([,v])=>v.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=to;}};
}

test('M10 fast movement switches previews once across quick bursts and restores after quiet',()=>{
 const h=motion();h.advance(16);h.m.sample({x:100,y:0,zoom:1},1000);assert.deepEqual(h.changes,[true]);
 h.advance(150);h.m.sample({x:200,y:0,zoom:1.5},1000);h.advance(449);assert.deepEqual(h.changes,[true]);
 h.advance(450);assert.deepEqual(h.changes,[true,false]);
});

test('M10 all camera motion is protected; held pan remains a preview until release',()=>{
 const h=motion(),hold={};h.advance(16);h.m.sample({x:1,y:0,zoom:1},1000);assert.deepEqual(h.changes,[true]);
 h.m.hold(hold);h.advance(32);h.m.sample({x:101,y:0,zoom:1},1000);h.advance(5000);assert.deepEqual(h.changes,[true]);
 h.m.release(hold);h.advance(5299);assert.deepEqual(h.changes,[true]);h.advance(5300);assert.deepEqual(h.changes,[true,false]);
});

test('M10 preview-mode disposal cancels timers and restores live visuals',()=>{
 const h=motion();h.advance(16);h.m.sample({x:500,y:0,zoom:1},1000);h.m.dispose();h.advance(10000);
 assert.deepEqual(h.changes,[true,false]);assert.equal(h.timers.size,0);
});

function preparer(){const jobs=new Map(),revoked=[],removed=[];let resized=0,resolveDecode;
 class Image{set src(value){this.url=value;}decode(){return new Promise(resolve=>{resolveDecode=resolve;});}removeAttribute(name){removed.push(name);}}
 const work={enqueue:(key,fn)=>jobs.set(key,fn),cancel:key=>jobs.delete(key)};
 const exports=moduleAt('src/lib/browser/useTabPreview.ts',{Image,URL:{createObjectURL:()=> 'blob:private-local',revokeObjectURL:url=>revoked.push(url)}},name=>{
  if(name==='react')return{};if(name.includes('deferred-work'))return{canvasWork:work};if(name.includes('preview-cache'))return{createPreviewCoordinator};return{};
 });
 const native={isEmpty:()=>false,getSize:()=>({width:1920,height:1080}),resize(options){resized++;assert.ok(options.width<=960&&options.height<=720);return this;},toDataURL:()=> 'data:image/png;base64,AQID'};
 return{jobs,revoked,removed,native,prepare:exports.prepareGuestPreview,get resized(){return resized;},decode(){resolveDecode();},flush(){const[key,fn]=[...jobs][0];jobs.delete(key);fn();}};
}

test('M11 native readback completion does not encode eagerly during renewed movement',async()=>{
 const h=preparer(),abort=new AbortController(),guest={isConnected:true,capturePage:async()=>h.native};
 const promise=h.prepare(guest,abort.signal);await settle();assert.equal(h.resized,0);assert.equal(h.jobs.size,1);
 h.flush();assert.equal(h.resized,1);h.decode();const image=await promise;
 assert.equal(image.url,'blob:private-local');assert.ok(image.pixels<=6e6);image.release();image.release();assert.equal(h.revoked.length,1);
});

test('M05 revocation cancels queued image preparation and revokes decoded local URLs',async()=>{
 const h=preparer(),abort=new AbortController(),guest={isConnected:true,capturePage:async()=>h.native};
 const first=h.prepare(guest,abort.signal);await settle();abort.abort();await assert.rejects(first);assert.equal(h.jobs.size,0);assert.equal(h.resized,0);
 const next=new AbortController(),second=h.prepare(guest,next.signal);await settle();h.flush();next.abort();await assert.rejects(second);
 assert.deepEqual(h.revoked,['blob:private-local']);h.decode();await settle();assert.equal(h.revoked.length,1);
});

test('M05 preview integration does not replace/destroy/pause/mute the native guest or sync pixels',()=>{
 const read=file=>fs.readFileSync(path.resolve(__dirname,'../../',file),'utf8');
 const view=read('src/components/PersonalTabView.tsx'),hook=read('src/lib/browser/useTabPreview.ts'),css=read('src/app/globals.css');
 assert.match(view,/<webview/);assert.match(view,/key=\{partition \+ ":" \+ generation\}/);
 assert.match(view,/useTabPreview\(containerRef, frameRef, previewScope, ready\)/);
 assert.doesNotMatch(hook,/localStorage|fetch\(|\.emit\(|pause\(|setAudioMuted|loadURL|executeJavaScript|destroy\(/);
 assert.match(hook,/did-start-loading/);assert.match(hook,/record.dispose\(\)/);
 assert.match(css,/\[data-camera-moving="true"\] \[data-camera-guest="true"\] webview \{ display: none !important/);
});

test('M11 oversized guest surfaces decline native readback',async()=>{
 const h=preparer(),abort=new AbortController();let captures=0;
 await assert.rejects(h.prepare({isConnected:true,clientWidth:100000,clientHeight:100000,capturePage:async()=>{captures++;return h.native;}},abort.signal),/too large/);
 assert.equal(captures,0);assert.equal(h.jobs.size,0);
});


test('M10 protection begins before the first transform and rapid inputs extend its deadline',()=>{
 const h=motion();h.m.begin();assert.deepEqual(h.changes,[true]);
 h.advance(299);h.m.begin();h.advance(598);assert.deepEqual(h.changes,[true]);
 h.advance(599);assert.deepEqual(h.changes,[true,false]);
});

test('M11 transient capture failure preserves the last good preview until navigation invalidates it',async()=>{
 const h=pool();let fail=false;
 const a=h.add('a',async()=>{if(fail)throw Error('readback failed');return h.image('good');});
 a.visible(true);await h.drain();fail=true;h.advance(1500);await h.drain();
 assert.equal(h.cache.stats().count,1);assert.deepEqual(h.released,[]);
 a.invalidate();assert.deepEqual(h.released,['good']);assert.equal(h.cache.stats().count,0);a.dispose();
});

test('M11 DOM-ready guests can prepare a preview while subresources are still loading',async()=>{
 const h=preparer(),abort=new AbortController();
 const promise=h.prepare({isConnected:true,isLoading:()=>true,capturePage:async()=>h.native},abort.signal);
 await settle();h.flush();h.decode();const image=await promise;assert.equal(image.url,'blob:private-local');image.release();
});


test('M10 retained pre-update motion controllers cannot block pan, zoom or WASD',()=>{
 const file=path.resolve(__dirname,'../../src/app/spaces/[id]/page.tsx');
 const source=fs.readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const calls=[];
 const visit=node=>{if(ts.isCallExpression(node)&&node.expression.getText(ast)==='previewMotionRef.current?.begin')calls.push(node.getText(ast));ts.forEachChild(node,visit);};
 visit(ast);assert.equal(calls.length,4,'All four movement entry points are covered');
 for(const current of [null,{sample(){},hold(){},release(){},dispose(){}}]){
  const context={previewMotionRef:{current}};
  for(const call of calls)assert.doesNotThrow(()=>vm.runInNewContext(call,context));
 }
 let starts=0;for(const call of calls)vm.runInNewContext(call,{previewMotionRef:{current:{begin(){starts++;}}}});
 assert.equal(starts,4,'Current controllers still activate protection before movement');
 assert.match(source,/\[roomId, createPreviewMotion\]/,'Factory replacement must recreate the effect controller');
});

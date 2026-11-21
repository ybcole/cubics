"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache=new Map();
function load(name){name=name.replace('./','');if(cache.has(name))return cache.get(name);
 const context={exports:{},require:load};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../src/lib/canvas',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
 cache.set(name,context.exports);return context.exports;}
const{zoomAt,createCameraGesture}=load('camera-gesture');
function harness(initial={x:200,y:300,zoom:1}){
 let pose=initial,id=0;const frames=new Map(),writes=[],points=[];
 const g=createCameraGesture({request:fn=>{frames.set(++id,fn);return id;},cancel:id=>frames.delete(id),read:()=>pose,constrain:v=>v,write:v=>{pose=v;writes.push(v);},pointer:v=>points.push(v)});
 return{g,frames,writes,points,get pose(){return pose;},paint(){const queued=[...frames.values()];frames.clear();queued.forEach(fn=>fn());},rebase(x,y){g.flush();pose={...pose,x:pose.x+x,y:pose.y+y};}};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);

test('M10.01 anchored zoom preserves the world point at multiple scales and anchors',()=>{
 for(const zoom of[0.1,0.5,1,2,5])for(const x of[0,321.125,1200]){
  const camera={x:123.25,y:-45.5,zoom:0.75},anchor={x,y:430.875},next=zoomAt(camera,zoom,anchor);
  near((next.x+x)/next.zoom,(camera.x+x)/camera.zoom);near((next.y+anchor.y)/next.zoom,(camera.y+anchor.y)/camera.zoom);
 }
 const camera={x:0,y:0,zoom:1};assert.equal(zoomAt(camera,NaN,{x:0,y:0}),camera);
 assert.equal(zoomAt(camera,2,{x:Infinity,y:0}),camera);
});

test('M10.02 1000 zoom samples share one pending frame; the final pose paints once',()=>{
 const h=harness();for(let i=0;i<1000;i++)h.g.wheel(-1,0,false,{x:400,y:300},800);
 assert.equal(h.frames.size,1);assert.equal(h.writes.length,0);h.paint();assert.equal(h.writes.length,1);
 near(h.pose.zoom,Math.exp(0.5));near((h.pose.x+400)/h.pose.zoom,600);
});

test('M10.03 pan then zoom then pan compose without replacing the zoom-adjusted camera',()=>{
 const h=harness();h.g.beginPan({x:100,y:100});h.g.pointer({x:120,y:130});
 h.g.zoomTo(2,{x:400,y:300});h.g.pointer({x:150,y:160});
 assert.equal(h.frames.size,1);h.paint();assert.equal(h.writes.length,1);
 near(h.pose.x,730);near(h.pose.y,810);near(h.pose.zoom,2);
 // An additional pointer sample uses the updated pose instead of a pre-zoom drag origin.
 h.g.pointer({x:160,y:170});h.paint();near(h.pose.x,720);near(h.pose.y,800);
});

test('M10.03 moving wheel anchors compose each event in order, independent of frame boundaries',()=>{
 const one=harness(),many=harness();
 const samples=[{delta:-5,x:0,y:0},{delta:10,x:800,y:600},{delta:-20,x:450,y:310}];
 for(const s of samples){one.g.wheel(s.delta,0,true,s,800);many.g.wheel(s.delta,0,true,s,800);many.paint();}
 one.paint();near(one.pose.x,many.pose.x);near(one.pose.y,many.pose.y);near(one.pose.zoom,many.pose.zoom);
});

test('M10.03 releasing a pan preserves queued zoom and the final pointer position',()=>{
 const h=harness();h.g.beginPan({x:0,y:0});h.g.zoomTo(2,{x:200,y:100});h.g.pointer({x:50,y:25});h.g.endPan();
 assert.equal(h.frames.size,0);assert.equal(h.writes.length,1);near(h.pose.x,550);near(h.pose.y,675);
 h.g.pointer({x:100,y:100});h.paint();assert.equal(h.writes.length,1,'hover must not move camera');
});

test('M10.03 pan/zoom survives sidebar reflow; room cancellation prevents stale writes',()=>{
 const h=harness();h.g.beginPan({x:100,y:100});h.g.pointer({x:120,y:100});h.g.zoomTo(2,{x:400,y:300});
 h.rebase(-228,0);const before=h.pose.x;h.g.pointer({x:130,y:100});h.paint();near(h.pose.x,before-10);
 h.g.zoomTo(3,{x:100,y:100});const stale=[...h.frames.values()][0],count=h.writes.length;h.g.cancel();stale();
 assert.equal(h.writes.length,count);assert.equal(h.frames.size,0);
});

test('M10.01 wheel modes and limits are bounded; invalid inputs do not queue work',()=>{
 const h=harness();h.g.wheel(1,1,false,{x:0,y:0},800);h.paint();near(h.pose.zoom,Math.exp(-33*0.0005));
 h.g.zoomTo(500,{x:0,y:0});h.paint();assert.equal(h.pose.zoom,5);
 h.g.zoomTo(-10,{x:0,y:0});h.paint();assert.equal(h.pose.zoom,0.1);
 h.g.wheel(NaN,0,false,{x:0,y:0},800);h.g.pointer({x:NaN,y:0});assert.equal(h.frames.size,0);
 const page=harness();page.g.wheel(1,2,false,{x:0,y:0},800);page.paint();near(page.pose.zoom,Math.exp(-100*0.0005));
});

test('M10/M11 real page zoom stays render-free per frame and synchronizes scale before widget drag',()=>{
 let cursor=0,ordinal=0,creations=0,zoomSets=0,flushes=0,time=0,sequence=0,transforms=0;
 const hooks=[],setters=[],effects=[],layouts=[],frames=new Map(),jobs=new Map();
 const react={memo:fn=>fn,startTransition:fn=>fn(),
  useRef(initial){const i=cursor++;return hooks[i]??={current:initial};},
  useState(initial){const i=cursor++,n=ordinal++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;
   setters[n]??=value=>{if(initial===1)zoomSets++;hooks[i]=typeof value==='function'?value(hooks[i]):value;};return[hooks[i],setters[n]];},
  useMemo(create,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))hooks[i]={value:create(),deps};return hooks[i].value;},
  useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
  useEffect(fn){cursor++;effects.push(fn);},useLayoutEffect(fn){cursor++;layouts.push(fn);},
 };
 const jsx=(type,props)=>{if(type?.name==='WidgetRenderer')creations++;return{type,props};};
 const user={id:'owner',fullName:'Owner',imageUrl:null},getToken=()=>Promise.resolve(null),listeners={};
 const dummy=()=>null;
 const win={requestAnimationFrame(fn){frames.set(++sequence,fn);return sequence;},cancelAnimationFrame(id){frames.delete(id);},
  dispatchEvent(){},matchMedia:()=>({matches:false})};
 const work={touch(){},hold(){},release(){},enqueue(key,fn){jobs.set(key,fn);},cancel(key){jobs.delete(key);}};
 const requireMock=name=>{
  if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
  if(name==='react-dom')return{flushSync:fn=>{flushes++;fn();}};
  if(name==='next/navigation')return{useParams:()=>({id:'room'})};
  if(name==='@clerk/nextjs')return{useUser:()=>({user,isLoaded:true}),useAuth:()=>({getToken})};
  if(name.endsWith('/camera-gesture'))return{createCameraGesture};
  if(name.endsWith('/deferred-work'))return{canvasWork:work};
  return new Proxy({__esModule:true,default:dummy},{get:(o,k)=>o[k]??dummy});
 };
 const context={exports:{},require:requireMock,process:{env:{NODE_ENV:"test"}},window:win,performance:{now:()=>time},setTimeout:()=>++sequence,clearTimeout(){},
  Event:class{},ResizeObserver:class{observe(){}disconnect(){}}};
 const source=fs.readFileSync(path.resolve(__dirname,'../../src/app/spaces/[id]/page.tsx'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,context);
 const render=()=>{cursor=0;ordinal=0;return context.exports.default();};
 const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;const children=node.props?.children;for(const child of(Array.isArray(children)?children:[children])){
  if(Array.isArray(child)){for(const item of child){const found=find(item,predicate);if(found)return found;}}else{const found=find(child,predicate);if(found)return found;}
 }return null;};
 render();setters[0](Array.from({length:100},(_,i)=>({id:String(i),roomId:'room',createdBy:'owner',x:i*900,y:0,w:800,h:600,type:'iframe'})));
 let tree=render(),main=find(tree,node=>node.type==='main');
 const element={clientWidth:1000,clientHeight:800,getBoundingClientRect:()=>({left:0,top:0}),
  addEventListener(type,fn){listeners[type]=fn;},removeEventListener(){},focus(){},setPointerCapture(){},hasPointerCapture(){return false;}};
 main.props.ref.current=element;
 const world=find(main,node=>node.props?.ref&&node.type==='div');
 const style={_transform:'',set transform(value){transforms++;this._transform=value;},get transform(){return this._transform;}};
 world.props.ref.current={style};
 find(tree,node=>node.type==='span'&&node.props.ref)?.props.ref&&(find(tree,node=>node.type==='span'&&node.props.ref).props.ref.current={textContent:'100%'});
 const range=find(tree,node=>node.props?.type==='range');range.props.ref.current={value:'100'};
 layouts[0]();effects.find(fn=>fn.toString().includes('const onWheel'))();
 const paint=()=>{time+=16;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));};
 const wheel=()=>listeners.wheel({deltaY:-2,deltaMode:0,ctrlKey:false,clientX:500,clientY:400,preventDefault(){}});
 for(let i=0;i<20;i++){wheel();assert.equal(frames.size,1);paint();tree=render();}
 assert.equal(zoomSets,0,'physical zoom must not call React zoom setter per frame');
 assert.equal(creations,100,'100 tab wrappers remain unchanged throughout zoom');
 assert.equal(transforms,20);assert.equal(jobs.size,1,'one latest metadata commit is pending');
 assert.ok(Number(range.props.ref.current.value)>100,'HUD tracks physical zoom immediately');
 const commit=[...jobs.values()];jobs.clear();commit.forEach(fn=>fn());tree=render();assert.equal(zoomSets,1);assert.equal(creations,200);
 wheel();paint();tree=render();main=find(tree,node=>node.type==='main');
 main.props.onPointerDownCapture({target:{closest:()=>({})}});tree=render();
 assert.equal(flushes,1,'pending physical scale is synchronously committed before widget input');
 const parse=()=>{const m=style.transform.match(/translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/);return{x:-Number(m[1]),y:-Number(m[2]),zoom:Number(m[3])};};
 const widget=find(tree,node=>node.type?.name==='WidgetRenderer');near(widget.props.zoom,parse().zoom);
 main=find(tree,node=>node.type==='main');
 main.props.onPointerDown({clientX:100,clientY:100,pointerId:1,target:{closest:()=>null},currentTarget:element});
 const before=parse(),writes=transforms;
 wheel();main.props.onPointerMove({clientX:120,clientY:130});assert.equal(frames.size,1);paint();
 assert.equal(transforms,writes+1,'combined pan/zoom paints once');
 const after=parse(),ratio=Math.exp(0.001);near(after.x,(before.x+500)*ratio-500-20);near(after.y,(before.y+400)*ratio-400-30);
});

test('M10.02 camera diagnostics distinguish queued-frame delay from callback work',()=>{
 let time=0,callback,pose={x:0,y:0,zoom:1};const samples=[];
 const g=createCameraGesture({request:fn=>{callback=fn;return 1;},cancel(){},read:()=>pose,constrain:x=>x,
  write:x=>{pose=x;time+=3;},pointer(){},measure:{now:()=>time,frame:(wait,work)=>samples.push({wait,work})}});
 g.zoomTo(2,{x:100,y:100});time=5;g.zoomTo(3,{x:100,y:100});time=40;callback();
 assert.deepEqual(samples,[{wait:40,work:3}]);
 g.pointer({x:1,y:2});time=80;callback();assert.equal(samples.length,1,'hover alone is not a camera frame');
});

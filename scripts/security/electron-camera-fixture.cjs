"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Own synthetic page: large raster, nested frame and animated filtered content.
// No third-party assets, credentials, screenshots or customer content in logs.
function serveCameraFixture(req, res) {
  if (!['/motion-guest', '/motion-nested'].includes(req.url)) return false;
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  if (req.url === '/motion-nested') res.end('<!doctype html><p>Nested rendering fixture</p>');
  else res.end(`<!doctype html><style>body{margin:0;height:4000px}canvas{width:227px;height:80px;filter:drop-shadow(0 0 8px #555)}iframe{width:280px;height:100px}</style>
    <input id="draft"><canvas width="7263" height="2561"></canvas><iframe src="/motion-nested"></iframe>
    <script>window.identity=Math.random().toString(36);const c=document.querySelector('canvas'),ctx=c.getContext('2d');
    ctx.fillStyle='#9ab';ctx.fillRect(0,0,c.width,c.height);let tick=0;
    function paint(){ctx.fillStyle=tick++%2?'#456':'#789';ctx.fillRect(0,0,200,200);requestAnimationFrame(paint)}paint();</script>`);
  return true;
}

async function testCameraGuestContinuity({ win, origin, webContents, until }) {
  win.show(); win.focus();
  // Test the actual production selector, including its uncached-tab branch.
  const css = fs.readFileSync(path.resolve(__dirname, '../../src/app/globals.css'), 'utf8');
  const suppression = css.match(/\[data-camera-moving="true"\] \[data-camera-guest="true"\] webview \{[^}]+\}/)?.[0];
  assert.ok(suppression, 'Native surface suppression selector missing');
  const id = await win.webContents.executeJavaScript(`(async()=>{
    const partition=await window.cubics.getBrowserPartition('tab','widget_motion','user_test');
    const style=document.createElement('style');style.id='motion-style';style.textContent=${JSON.stringify(suppression)};document.head.appendChild(style);
    const root=document.createElement('div');root.id='motion-world';root.style.cssText='position:fixed;left:0;top:0;width:100000px;height:100000px;transform-origin:0 0';
    const card=document.createElement('div');card.dataset.cameraGuest='true';card.style.cssText='position:absolute;left:100px;top:100px;width:640px;height:480px';
    const body=document.createElement('div');body.id='motion-body';body.style.cssText='position:relative;width:640px;height:480px';
    const guest=document.createElement('webview');guest.id='motion-view';guest.setAttribute('partition',partition);guest.style.cssText='display:inline-flex;width:100%;height:100%';
    const ready=new Promise(resolve=>guest.addEventListener('dom-ready',resolve,{once:true}));
    guest.src=${JSON.stringify(origin + '/motion-guest')};body.appendChild(guest);card.appendChild(body);root.appendChild(card);document.body.appendChild(root);
    await ready;return guest.getWebContentsId();
  })()`);
  const guest = webContents.fromId(id);
  assert.ok(guest && !guest.isDestroyed());
  const initial = await guest.executeJavaScript(`(async()=>{
    document.querySelector('#draft').value='preserve unsaved draft';scrollTo(0,300);
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(Audio){window.motionAudio=new Audio();const oscillator=motionAudio.createOscillator(),gain=motionAudio.createGain();gain.gain.value=0;oscillator.connect(gain).connect(motionAudio.destination);oscillator.start();await motionAudio.resume().catch(()=>{});}
    return {identity:window.identity,draft:document.querySelector('#draft').value,scroll:scrollY,audio:window.motionAudio?.state};
  })()`, true);
  const capture = await win.webContents.executeJavaScript(`(async()=>{
    const image=await document.querySelector('#motion-view').capturePage();const size=image.getSize();
    return {empty:image.isEmpty(),width:size.width,height:size.height,bytes:image.resize({width:320,height:240,quality:'good'}).toJPEG(72).length};
  })()`);
  assert.equal(capture.empty, false); assert.ok(capture.width > 0 && capture.height > 0 && capture.bytes > 0);
  const timings = await win.webContents.executeJavaScript(`(async()=>{
    const root=document.querySelector('#motion-world'),guest=document.querySelector('#motion-view'),body=document.querySelector('#motion-body');
    const results={};
    for(const mode of ['live','visibility','protected']){
      root.removeAttribute('data-camera-moving');guest.style.visibility=mode==='visibility'?'hidden':'';
      if(mode==='protected')root.dataset.cameraMoving='true';
      const intervals=[];let previous=0;
      for(let frame=0;frame<40;frame++)await new Promise((resolve,reject)=>requestAnimationFrame(time=>{try{
        if(previous)intervals.push(time-previous);previous=time;
        root.style.transform='translate('+((frame%7)*9)+'px,'+((frame%5)*7)+'px) scale('+(0.7+(frame%9)*0.03)+')';
        if(mode==='protected'&&getComputedStyle(guest).display!=='none')throw Error('Uncached guest stayed live during motion');
        if(body.clientWidth!==640||body.clientHeight!==480)throw Error('Preview body geometry changed');resolve();
      }catch(error){reject(error)}}));
      intervals.sort((a,b)=>a-b);results[mode]={median:intervals[Math.floor(intervals.length/2)],p95:intervals[Math.floor(intervals.length*0.95)]};
    }
    root.removeAttribute('data-camera-moving');guest.style.visibility='';root.style.transform='none';
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    for(let gesture=0;gesture<6;gesture++){
      root.dataset.cameraMoving='true';await new Promise(resolve=>requestAnimationFrame(resolve));
      root.removeAttribute('data-camera-moving');await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    if(getComputedStyle(guest).display==='none')throw Error('Guest did not restore');
    return results;
  })()`);
  assert.equal(guest.isDestroyed(), false);
  const restored = await guest.executeJavaScript(`({identity:window.identity,draft:document.querySelector('#draft').value,scroll:scrollY,audio:window.motionAudio?.state})`);
  assert.deepEqual(restored, initial, 'Motion changed guest memory/form/scroll/audio-context state');
  assert.equal(await win.webContents.executeJavaScript("document.querySelector('#motion-view').getWebContentsId()"), id);
  console.log('M10_NATIVE_CAMERA_TIMINGS:' + JSON.stringify(timings));
  console.log('M10_NATIVE_CAMERA_PASS: real capturePage/NativeImage, uncached surface suppression, stable body, guest identity, draft, scroll and audio-context state');
  await guest.executeJavaScript('window.motionAudio?.close()');
  await win.webContents.executeJavaScript("document.querySelector('#motion-world').remove();document.querySelector('#motion-style').remove()");
  await until(() => guest.isDestroyed());
}
module.exports = { serveCameraFixture, testCameraGuestContinuity };

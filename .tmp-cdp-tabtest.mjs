import fs from 'fs';
import WebSocket from 'ws';
const list = await (await fetch('http://127.0.0.1:9335/json/list')).json();
const page = list.find(x => x.type === 'page');
if (!page) throw new Error('no page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.id && pending.has(msg.id)) { const {resolve,reject}=pending.get(msg.id); pending.delete(msg.id); msg.error?reject(new Error(JSON.stringify(msg.error))):resolve(msg.result); }
  else if (msg.method) events.push(msg);
});
await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
const send = (method, params={}) => new Promise((resolve,reject)=>{ const i=++id; pending.set(i,{resolve,reject}); ws.send(JSON.stringify({id:i,method,params})); });
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');
await send('Log.enable');
await new Promise(r=>setTimeout(r,2500));
console.log('URL', await evalJs('location.href'));
console.log('CLERK', await evalJs('typeof window.Clerk'));
console.log('BODY', (await evalJs('document.body.innerText.slice(0,300)')) || '');
const ticket = fs.readFileSync('/tmp/cubics-ticket-tabtest','utf8').trim();
try {
  const status = await evalJs(`(async()=>{ await window.Clerk.load(); const si=await window.Clerk.client.signIn.create({strategy:'ticket',ticket:${JSON.stringify(ticket)}}); await window.Clerk.setActive({session:si.createdSessionId}); return si.status; })()`);
  console.log('SIGNIN', status);
} catch (e) { console.log('SIGNIN_ERR', e.message); }
await new Promise(r=>setTimeout(r,2500));
console.log('URL2', await evalJs('location.href'));
console.log('BODY2', (await evalJs('document.body.innerText.slice(0,500)')) || '');
const errors = events.filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error').map(e => e.params.args.map(a=>a.value||a.description).join(' '));
console.log('CONSOLE_ERRORS', JSON.stringify(errors.slice(0,10), null, 2));
const exceptions = events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails.text + ' ' + (e.params.exceptionDetails.exception?.description||''));
console.log('EXCEPTIONS', JSON.stringify(exceptions.slice(0,10), null, 2));
fs.writeFileSync('/tmp/cdp-tabtest-events.json', JSON.stringify(events, null, 2));
ws.close();

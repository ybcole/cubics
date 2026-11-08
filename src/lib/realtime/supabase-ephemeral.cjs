"use strict";

/* M02/M15 provider boundary for the future Supabase private Realtime path.
 * Injection of createClient keeps hosting-provider APIs out of canvas code.
 * This adapter intentionally supports ONLY EPHEMERAL data. Durable mutations
 * and LiveKit host/control leases MUST use authenticated server authority.
 *
 * NOT connected to the production canvas until full Socket.IO event parity.
 */
const ROOM_ID=/^[A-Za-z0-9_-]{3,128}$/;
const COLOR=/^#[0-9a-fA-F]{6}$/;
const JOIN_TIMEOUT_MS=10000;
const MIN_CURSOR_GAP_MS=32;

function validateConfig(url,publishableKey) {
  const parsed=new URL(url);
  if(parsed.protocol!=="https:" || parsed.username || parsed.password ||
     parsed.search || parsed.hash || !["","/"].includes(parsed.pathname)) {
    throw new Error("Supabase URL must be a bare HTTPS origin");
  }
  if(typeof publishableKey!=="string" || publishableKey.length<12 ||
     /^sb_secret_|^service_role$/i.test(publishableKey)) {
    throw new Error("Supabase public client key missing or privileged");
  }
  return parsed.origin;
}

function safeCursor(message) {
  const value=message?.payload || message;
  if(!value || typeof value!=="object" ||
      !Number.isFinite(value.x) || !Number.isFinite(value.y) ||
      Math.abs(value.x)>10000000 || Math.abs(value.y)>10000000) return null;
  return {
    // Client broadcast identity cannot be trusted; caller must associate
    // ephemeral frames to an independently verified presence identity.
    x:value.x, y:value.y,
    color:typeof value.color==="string" && COLOR.test(value.color) ? value.color : "#64748b",
    label:"Member",
  };
}

function createSupabaseEphemeralTransport({
  createClient, projectUrl, publishableKey, getAccessToken,
  onCursor=()=>{}, onPresence=()=>{}, now=()=>Date.now(),
}={}) {
  if(typeof createClient!=="function" || typeof getAccessToken!=="function")
    throw new Error("Supabase client factory and Clerk token provider required");
  const origin=validateConfig(projectUrl,publishableKey);
  const client=createClient(origin,publishableKey,{
    accessToken:async()=>await getAccessToken(),
    auth:{autoRefreshToken:false,persistSession:false,detectSessionInUrl:false},
  });
  let channel=null,roomId=null,interval=null,lastCursor=0;
  async function refreshToken(){
    const token=await getAccessToken();
    if(!token) {
      await leave();
      throw new Error("Clerk session no longer available");
    }
    // Supabase rechecks private RLS when a fresh JWT is sent to Realtime.
    await client.realtime.setAuth(token);
  }
  async function leave(){
    if(interval)clearInterval(interval);
    interval=null;
    const closing=channel;
    channel=null;
    roomId=null;
    if(closing)await client.removeChannel(closing);
  }
  async function join(nextRoom) {
    if(typeof nextRoom!=="string" || !ROOM_ID.test(nextRoom))
      throw new Error("Invalid workspace ID");
    await leave();
    await refreshToken();
    roomId=nextRoom;
    const target=client.channel("cubics:room:"+nextRoom,{
      config:{private:true,broadcast:{self:false},presence:{key:"cubics-device"}},
    });
    channel=target;
    target.on("broadcast",{event:"cursor:move"},message=>{
      const parsed=safeCursor(message);
      if(channel===target && parsed)onCursor(parsed);
    });
    target.on("presence",{event:"sync"},()=>{
      if(channel!==target)return;
      const state=target.presenceState();
      const count=Object.values(state||{}).reduce((sum,items)=>
        sum+(Array.isArray(items)?items.length:0),0);
      onPresence({onlineCount:Math.min(Math.max(count,0),100000)});
    });
    try{
      await new Promise((resolve,reject)=>{
        const timeout=setTimeout(()=>reject(Error("Realtime channel join timed out")),JOIN_TIMEOUT_MS);
        target.subscribe(status=>{
          if(status==="SUBSCRIBED"){clearTimeout(timeout);resolve();}
          else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){
            clearTimeout(timeout);reject(Error("Private Realtime authorization failed: "+status));
          }
        });
      });
    }catch(error){await leave();throw error;}
    interval=setInterval(()=>{void refreshToken().catch(()=>{void leave()});},25000);
    interval.unref?.();
  }
  async function publishCursor(value){
    if(!channel || !roomId)throw Error("Not joined to an authorized room");
    const cursor=safeCursor(value);
    if(!cursor)throw Error("Invalid cursor payload");
    const time=now();
    if(time-lastCursor<MIN_CURSOR_GAP_MS)return false;
    lastCursor=time;
    const result=await channel.send({
      type:"broadcast",event:"cursor:move",
      payload:{x:cursor.x,y:cursor.y,color:cursor.color},
    });
    if(result!=="ok" && result!==undefined)throw Error("Cursor broadcast rejected");
    return true;
  }
  async function publishPresence(){
    if(!channel || !roomId)throw Error("Not joined");
    return channel.track({ online:true, updatedAt:Math.floor(now()/1000) });
  }
  return {
    provider:"supabase",join,leave,refreshToken,publishCursor,publishPresence,
    // No arbitrary emit/event surface: widget and control operations must
    // remain authenticated API actions with server-derived actor/role.
    sendWorkspaceMutation(){throw Error("Supabase Broadcast is not a workspace write API");},
  };
}

module.exports={createSupabaseEphemeralTransport,safeCursor,validateConfig};

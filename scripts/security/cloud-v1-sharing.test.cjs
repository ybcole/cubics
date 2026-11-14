"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("member-sharing API does not expose emails or arbitrary profile data",()=>{
  const source=read("src/app/v1/workspaces/[id]/members/route.ts");
  assert.match(source,/getRoomAccess/);
  assert.match(source,/!canView/);
  assert.match(source,/displayName/);
  assert.doesNotMatch(source,/email:\s*member/);
});
test("read-only legacy sync never claims durable revisions",()=>{
  const source=read("src/app/v1/workspaces/[id]/snapshot/route.ts");
  assert.match(source,/revision:\s*null/);
  assert.match(source,/legacy-unversioned/);
  assert.match(source,/operations:\s*\[\]/);
  assert.match(source,/getRoomAccess/);
});

test("v1 workspace widget metadata is redacted by the same server policy",()=>{
  const source=read("src/app/v1/workspaces/[id]/widgets/route.ts");
  assert.match(source,/redactWidgetForViewer\(widget, userId\)/);
  assert.match(source,/title:visible.title/);
  assert.match(source,/safeUrl = url.origin;/);
  assert.doesNotMatch(source,/url.origin \+ url.pathname/);
});

test("M05 media membership endpoint resolves DB widget type and verified creator",()=>{
  const source=read("src/app/api/internal/realtime/membership/route.ts");
  assert.match(source,/select: \{ createdBy: true, type: true \}/);
  assert.match(source,/media\.host\.live/);
  assert.match(source,/media\.host\.shared/);
  assert.match(source,/control\.send/);
  assert.match(source,/isSharedWidget/);
  assert.match(source,/isLiveWidget/);
  const socket=read("socket-server.cjs");
  assert.match(socket,/event === "tab:join" \? "media\.view"/);
  assert.match(socket,/event === "tab:input" \? "control\.send"/);
  assert.match(socket,/tabViewers\.get\(widgetId\)\?\.has\(socket\.id\)/);
  assert.match(socket,/sanitizeSharedInput\(input\)/);
});

test("M05 LiveKit viewing cannot publish and publisher grants are widget-scoped",()=>{
  const token=read("src/app/api/livekit/token/route.ts");
  assert.match(token,/publishWidgetId/);
  assert.match(token,/canPublishWidget\(role, userId, widget\)/);
  assert.match(token,/canPublish: requestedPublisher/);
  assert.match(token,/canSubscribe: !requestedPublisher/);
  assert.match(token,/identity: requestedPublisher/);
  assert.match(token,/ttl: "5m"/);
  const sfu=read("src/lib/live/sfu.ts");
  assert.match(sfu,/publishedIdentityMatches\(p.identity, widgetId\)/);
  assert.match(sfu,/publishWidgetTrack/);
  assert.doesNotMatch(sfu,/lp\.publishTrack\(track,[\s\S]*?(?=\n  private find)/);
});

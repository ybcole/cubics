"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const read = p => fs.readFileSync(path.resolve(__dirname, "../../", p), "utf8");

test("Safari tab toolbar has back, forward, centered hostname, inline reload and trash only", () => {
  const bar = read("src/components/SafariTabBar.tsx");
  assert.match(bar, /siteLabel\(url\)/);
  assert.match(bar, /url\.hostname\.replace/);
  assert.match(bar, /!grid-cols-\[56px_minmax\(0,1fr\)_56px\]/);
  assert.match(bar, /aria-label="Back"/);
  assert.match(bar, /aria-label="Forward"/);
  assert.match(bar, /aria-label="Reload"/);
  assert.match(bar, /aria-label="Remove tab"/);
  assert.match(bar, /className="btn-icon-sm absolute right-1 top-1\/2/);
  assert.match(bar, /setEditing\(true\)/);
  assert.match(bar, /inputRef\.current\?\.select\(\)/);
  assert.match(bar, /editing \? "text-left" : "text-center"/);
  assert.match(bar, /inputRef\.current\?\.blur\(\)/);
  assert.match(bar, /if \(e\.key === "Escape"\)/);
  assert.match(bar, /onNavigate\(next\)/);
});
test("Personal, Live and Shared use ONE Safari header and keep drag cancellation", () => {
  const personal = read("src/components/PersonalTabView.tsx");
  const streamed = read("src/components/StreamedTabView.tsx");
  const canvas = read("src/app/spaces/[id]/page.tsx");
  assert.match(personal, /<SafariTabBar/);
  assert.match(streamed, /<SafariTabBar/);
  assert.equal((streamed.match(/<SafariTabBar/g) || []).length, 1);
  assert.doesNotMatch(streamed, /aria-label="Tab URL"/);
  assert.doesNotMatch(streamed, /clearSharedBrowsing|className="widget-card-header"/);
  assert.doesNotMatch(personal, /clearPersonalBrowsing|className="widget-card-header"/);
  assert.match(canvas, /cancel="\.tab-control"/);
  assert.match(personal, /writePersonalNavigation/);
  assert.doesNotMatch(personal, /src=\{widget\.url\}/);
  assert.match(streamed, /<ViewerSurface/);
  assert.match(streamed, /Stop sharing/);
});

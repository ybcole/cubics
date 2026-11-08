"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const css = read("src/app/globals.css");
const rail = read("src/components/SpaceRail.tsx");
const canvas = read("src/app/spaces/[id]/page.tsx");

test("theme uses a light neutral palette without decorative glass", () => {
  assert.match(css, /--color-canvas: #ffffff;/);
  assert.match(css, /--color-surface: #f7f8fa;/);
  assert.match(css, /--color-accent: #245bd6;/);
  assert.doesNotMatch(css, /backdrop-filter|\.glass\s*\{/);
  assert.match(css, /\.canvas-grid\s*\{/);
});

test("rail has an explicit collapse toggle and consistent account access", () => {
  assert.match(css, /width: 264px;/);
  assert.match(css, /\.rail-shell\.is-collapsed\s*\{ width: 68px;/);
  assert.match(rail, /Collapse sidebar/);
  assert.match(rail, /Expand sidebar/);
  assert.match(rail, /<ProfileDropdown sidebar compact=\{!expanded\}/);
  assert.doesNotMatch(rail, /is-focused|cubics:collapse-sidebar/);
});

test("canvas keeps native Tab navigation and has discoverable tab actions", () => {
  assert.doesNotMatch(canvas, /e\.key === "Tab"/);
  assert.match(canvas, /e\.key\.toLowerCase\(\) === "n"/);
  assert.match(canvas, /className="canvas-toolbar"/);
  assert.match(canvas, /Start with a tab/);
  assert.match(canvas, /Canvas unavailable/);
  assert.match(canvas, /Reset zoom to 100%/);
  assert.match(canvas, /Choose who can see and control this tab/);
});

test("modals manage keyboard focus and restore prior focus", () => {
  const modal = read("src/components/ui/Modal.tsx");
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /aria-labelledby=/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /previousFocus\.focus\(\)/);
});

test("navigation, settings and auth share a consistent system", () => {
  assert.match(read("src/app/inbox/page.tsx"), /<SpaceRail/);
  assert.match(read("src/components/AuthShell.tsx"), /auth-mark/);
  assert.match(read("src/components/SettingsModal.tsx"), /Sign out/);
  assert.match(read("src/components/ProfileDropdown.tsx"), /event\.key === "Escape"/);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const css = read("src/app/globals.css");

test("light glass materials and accessibility fallbacks exist", () => {
  for (const token of [
    "--glass-fill:", "--glass-fill-strong:", "--glass-solid:", "--glass-edge:",
    "--glass-border:", "--glass-blur:", "--glass-shadow:", "--glass-shadow-float:",
    "--glass-radius-card:", "--glass-radius-panel:",
  ]) assert.ok(css.includes(token), token);
  assert.ok(css.includes("prefers-reduced-transparency: reduce"));
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
  assert.ok(css.includes("@supports not (backdrop-filter:"));
});

test("shared chrome and authentication reuse material classes", () => {
  for (const selector of [".card", ".menu", ".modal", ".rail-card", ".rail-tooltip",
    ".app-header", ".chat-composer", ".widget-card-header", ".widget-toolbar", ".zoom-hud"]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.ok(read("src/components/AuthShell.tsx").includes("card auth-panel"));
  assert.ok(read("src/app/spaces/[id]/page.tsx").includes("zoom-hud flex"));
});

test("webviews stay opaque and camera grid layer counts match", () => {
  assert.ok(css.includes(".widget-card-body { background: #ffffff; }"));
  const canvas = read("src/app/spaces/[id]/page.tsx");
  assert.ok(canvas.includes("GRID_LIGHT"));
  assert.ok(canvas.includes("main.style.backgroundSize = `${major}, ${major}, ${minor}, ${minor}, 100% 100%, 100% 100%`;"));
  assert.ok(canvas.includes("main.style.backgroundPosition = `${pos}, ${pos}, ${pos}, ${pos}, 0 0, 0 0`;"));
});

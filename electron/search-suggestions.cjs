"use strict";

/* Address-bar suggestions (M05.08): fixed provider endpoints only.
 * Google is tried first; DuckDuckGo is a silent failover. The main process
 * fetches without cookies, credentials or renderer-supplied URLs. */

const GOOGLE_SUGGEST_URL = "https://suggestqueries.google.com/complete/search?client=firefox&q=";
const DUCKDUCKGO_SUGGEST_URL = "https://duckduckgo.com/ac/?type=list&q=";
const MAX_QUERY_LENGTH = 200;
const MAX_ITEMS = 8;
const MAX_LABEL_LENGTH = 120;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 50;

function normalizeQuery(value) {
  if (typeof value !== "string") return null;
  const query = value.trim();
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) return null;
  if (/[\u0000-\u001f\u007f]/.test(query)) return null;
  return query;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

// Remote suggestion providers only receive search-shaped text. A typed URL,
// hostname or private path stays local and is never sent to Google/DDG.
function looksLikeUrl(query) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(query)) return true;
  return !/\s/.test(query) && /^[^\s/]+\.[a-z]{2,}(?:[:/?#]|$)/i.test(query);
}

function cleanLabel(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_LENGTH);
}

function cleanPhrases(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(phrase => typeof phrase === "string" ? cleanLabel(phrase) :
      (phrase && typeof phrase.phrase === "string" ? cleanLabel(phrase.phrase) : ""))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

// Google returns [query, [phrases...], ...]. DuckDuckGo returns either the
// same shape or an array of { phrase } objects depending on response mode.
function parseSuggestPayload(payload) {
  if (Array.isArray(payload)) {
    if (Array.isArray(payload[1])) return cleanPhrases(payload[1]);
    if (payload.every(entry => entry && typeof entry === "object")) return cleanPhrases(payload);
    return [];
  }
  if (payload && Array.isArray(payload.suggestions)) return cleanPhrases(payload.suggestions);
  return [];
}

function matches(value, query) {
  return typeof value === "string" && value.toLowerCase().includes(query);
}

function localItems(openTabs, history, query) {
  const items = [];
  const seenUrls = new Set();
  const add = (kind, entry) => {
    const url = safeHttpUrl(entry && entry.url);
    if (!url || seenUrls.has(url)) return;
    const label = cleanLabel(entry.label || entry.title || url) || url;
    if (!matches(label, query) && !matches(url, query)) return;
    seenUrls.add(url);
    items.push({ kind, label, url });
  };
  for (const tab of Array.isArray(openTabs) ? openTabs : []) add("tab", tab);
  for (const entry of Array.isArray(history) ? history : []) add("history", entry);
  return items;
}

function combineSuggestions({ query, openTabs = [], history = [], remote = [] }) {
  const needle = query.toLowerCase();
  const items = [];
  const seenUrls = new Set();
  const seenLabels = new Set();

  const push = item => {
    if (items.length >= MAX_ITEMS) return;
    const label = cleanLabel(item.label);
    if (!label) return;
    if (item.url) {
      const url = safeHttpUrl(item.url);
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      seenLabels.add(label.toLowerCase());
      items.push({ kind: item.kind, label, url });
      return;
    }
    if (seenLabels.has(label.toLowerCase())) return;
    seenLabels.add(label.toLowerCase());
    items.push({ kind: item.kind, label });
  };

  for (const item of localItems(openTabs, history, needle)) push(item);
  for (const phrase of remote) push({ kind: "search", label: phrase });
  return items;
}

function createSearchSuggestions({ fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  const cache = new Map();

  async function fetchSuggestions(url, query) {
    const response = await fetchImpl(url + encodeURIComponent(query), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "application/json" },
      redirect: "error",
      credentials: "omit",
    });
    if (!response.ok) return [];
    return parseSuggestPayload(await response.json());
  }

  async function remoteSuggestions(query) {
    const key = query.toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.items;
    let items = [];
    try { items = await fetchSuggestions(GOOGLE_SUGGEST_URL, query); } catch {}
    if (!items.length) {
      try { items = await fetchSuggestions(DUCKDUCKGO_SUGGEST_URL, query); } catch {}
    }
    if (items.length) {
      if (cache.size >= CACHE_MAX) cache.clear();
      cache.set(key, { at: Date.now(), items });
    }
    return items;
  }

  return {
    async suggest({ query, openTabs = [], history = [] }) {
      const normalized = normalizeQuery(query);
      if (!normalized) return [];
      return combineSuggestions({
        query: normalized,
        openTabs,
        history,
        remote: looksLikeUrl(normalized) ? [] : await remoteSuggestions(normalized),
      });
    },
  };
}

module.exports = {
  normalizeQuery,
  looksLikeUrl,
  parseSuggestPayload,
  combineSuggestions,
  createSearchSuggestions,
  MAX_ITEMS,
};

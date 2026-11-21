"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Globe, History, RotateCw, Search } from "lucide-react";

const SEARCH_RESULTS_URL = "https://www.google.com/search?q=";
const URL_INPUT_RE = /^(?:[a-z][a-z0-9+.-]*:\/\/|localhost(?::\d+)?(?:[/?#]|$)|\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:[/?#]|$)|[^\s/]+\.[a-z]{2,}(?::\d+)?(?:[/?#]|$))/i;

interface AddressSuggestion {
  kind: "tab" | "history" | "search";
  label: string;
  url?: string;
}

/** Safari-style minimal tab chrome shared by Personal, Live and Shared tabs.
 * Display-only hostname is never used for navigation: editing always reveals
 * the exact, full URL supplied by the owning browser/webview.
 */
export function siteLabel(value: string): string {
  const raw = value.trim();
  if (!raw || raw === "about:blank") return "";
  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.hostname.replace(/^www\./i, "") + (url.port ? `:${url.port}` : "");
  } catch { return raw; }
}

export function normalizeAddress(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username || url.password) return "";
    return url.href;
  } catch { return ""; }
}

interface AddressFieldProps {
  url: string;
  onNavigate?: (url: string) => void;
  onReload?: () => void;
  canReload?: boolean;
  editable?: boolean;
  placeholder?: string;
  floating?: boolean;
}

/** Shared address/search behavior for tab chrome and canvas search (M12.06). */
export default function AddressField({ url, onNavigate, onReload, canReload = true,
  editable = true, placeholder = "Search or enter URL", floating = false }: AddressFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const typedRef = useRef(false);
  const requestRef = useRef(0);
  const listId = useId();

  useEffect(() => {
    if (floating) inputRef.current?.focus();
  }, [floating]);

  useEffect(() => {
    if (!editing && !floating) setDraft(url);
  }, [url, editing, floating]);

  // 200ms debounce. Stale answers are dropped; failures stay silent.
  useEffect(() => {
    const requestId = ++requestRef.current;
    if (!editing || !typedRef.current) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return;
    }
    const query = draft.trim();
    if (query.length < 2 || !window.cubics?.suggestAddress) {
      setSuggestions([]);
      setActiveSuggestion(-1);
      return;
    }
    const timer = setTimeout(() => {
      void window.cubics!.suggestAddress(query).then(result => {
        if (requestId !== requestRef.current) return;
        setSuggestions(Array.isArray(result?.items) ? result.items.slice(0, 8) : []);
        setActiveSuggestion(-1);
      }).catch(() => {
        if (requestId !== requestRef.current) return;
        setSuggestions([]);
        setActiveSuggestion(-1);
      });
    }, 200);
    return () => { clearTimeout(timer); requestRef.current += 1; };
  }, [draft, editing]);

  useEffect(() => () => { requestRef.current += 1; }, []);

  // Focus changes the value from hostname to the full URL; select only after
  // React paints the expanded value, so the entire link is actually selected.
  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
      if (inputRef.current) inputRef.current.scrollLeft = 0;
    }
  }, [editing]);

  const submit = () => {
    if (!editable || !onNavigate) return;
    const raw = draft.trim();
    if (URL_INPUT_RE.test(raw)) {
      const next = normalizeAddress(raw);
      if (next) onNavigate(next);
      inputRef.current?.blur();
      return;
    }
    if (raw) onNavigate(SEARCH_RESULTS_URL + encodeURIComponent(raw));
    inputRef.current?.blur();
  };

  const chooseSuggestion = (suggestion: AddressSuggestion) => {
    typedRef.current = false;
    setSuggestions([]);
    setActiveSuggestion(-1);
    setEditing(false);
    if (suggestion.kind === "search") {
      const target = SEARCH_RESULTS_URL + encodeURIComponent(suggestion.label);
      setDraft(target);
      onNavigate?.(target);
    } else if (suggestion.url) {
      setDraft(suggestion.url);
      onNavigate?.(suggestion.url);
    }
    inputRef.current?.blur();
  };

  return (
        <form className={floating ? "relative min-w-0" : "relative min-w-0 flex-1 max-w-[60%] flex items-center"} onSubmit={e => {
        e.preventDefault();
        submit();
      }}>
        {floating && <Search className="absolute left-4 top-4 w-5 h-5 text-fg-muted pointer-events-none" />}
        <input ref={inputRef} type="text" inputMode="url" autoComplete="off"
          autoCapitalize="off" spellCheck={false}
          value={editing || floating ? draft : siteLabel(url)}
          role="combobox" aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          aria-controls={suggestions.length > 0 ? listId : undefined}
          aria-activedescendant={activeSuggestion >= 0 ? `${listId}-${activeSuggestion}` : undefined}
          onFocus={() => {
            typedRef.current = false;
            setSuggestions([]);
            setActiveSuggestion(-1);
            if (!floating) setDraft(url === "about:blank" ? "" : url);
            setEditing(true);
          }}
          onBlur={() => {
            typedRef.current = false;
            setSuggestions([]);
            setActiveSuggestion(-1);
            setEditing(false);
            if (!floating) setDraft(url);
          }}
          onChange={e => { typedRef.current = true; setDraft(e.target.value); }}
          onKeyDown={e => {
            if (e.nativeEvent.isComposing) { e.preventDefault(); return; }
            if (e.key === "Escape") {
              setDraft(url);
              setSuggestions([]);
              setActiveSuggestion(-1);
              inputRef.current?.blur();
            }
            if (e.key === "ArrowDown") {
              if (!suggestions.length) return;
              e.preventDefault();
              setActiveSuggestion(index => (index + 1) % suggestions.length);
            }
            if (e.key === "ArrowUp") {
              if (!suggestions.length) return;
              e.preventDefault();
              setActiveSuggestion(index => (index <= 0 ? suggestions.length - 1 : index - 1));
            }
            if (e.key === "Enter") {
              e.stopPropagation();
              if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
                e.preventDefault();
                chooseSuggestion(suggestions[activeSuggestion]);
              }
            }
          }}
          readOnly={!editable}
          placeholder={placeholder}
          aria-label="Tab URL or search"
          className={floating ? "input-base w-full !py-4 !pl-12 !pr-32" : `tab-control w-full min-w-0 h-7 rounded-md border border-line bg-canvas text-small text-fg
            outline-none focus:border-line-strong focus:ring-1 focus:ring-line-strong
            pl-2 pr-8 select-text truncate transition-colors ${editing ? "text-left" : "text-center"}
            ${editable ? "cursor-text" : "cursor-default"}`}
        />
        {floating ? <button type="submit" className="btn btn-primary btn-sm absolute right-3 top-3" disabled={!draft.trim()}>Search</button> : <button type="button" disabled={!canReload} onClick={onReload} onMouseDown={e => e.preventDefault()}
          className="btn-icon-sm tab-control absolute right-1 top-1/2 -translate-y-1/2"
          title="Reload" aria-label="Reload">
          <RotateCw className="w-3.5 h-3.5" />
        </button>}
        {suggestions.length > 0 && (
          <div id={listId} role="listbox" aria-label="Address suggestions"
            className={floating ? "menu !shadow-none !border-0 mt-2 max-h-60 overflow-y-auto" : "menu absolute left-0 right-0 top-full mt-1 z-50 max-h-60 overflow-y-auto"}>
            {suggestions.map((suggestion, index) => (
              <button key={`${suggestion.kind}:${suggestion.url || suggestion.label}`}
                type="button" role="option" tabIndex={-1}
                id={`${listId}-${index}`}
                aria-selected={index === activeSuggestion}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setActiveSuggestion(index)}
                onClick={() => chooseSuggestion(suggestion)}
                className={`menu-item ${index === activeSuggestion ? "bg-hover" : ""}`}>
                {suggestion.kind === "tab" ? <Globe className="w-3.5 h-3.5 shrink-0 text-fg-subtle" /> :
                  suggestion.kind === "history" ? <History className="w-3.5 h-3.5 shrink-0 text-fg-subtle" /> :
                    <Search className="w-3.5 h-3.5 shrink-0 text-fg-subtle" />}
                <span className="truncate">{suggestion.label}</span>
              </button>
            ))}
          </div>
        )}
      </form>
  );
}

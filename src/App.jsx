import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Sun, Moon, LogOut, Plus, Trash2, ChevronRight,
  Trophy, Map as MapIcon, NotebookText, StickyNote, ListChecks, Check, X, Eye,
  EyeOff, User as UserIcon, Loader2, ShieldCheck, AlertCircle,
  Bold, Italic, List, Quote, Code, Sigma, Heading2, RefreshCw, Link2, ExternalLink, Type, Pin
} from "lucide-react";

/* ---------------------------------------------------------------- */
/* Storage helpers                                                   */
/* ---------------------------------------------------------------- */

async function sGet(key, shared) {
  try {
    const r = await window.storage.get(key, shared);
    return r ? JSON.parse(r.value) : null;
  } catch (e) {
    return null;
  }
}
async function sSet(key, value, shared) {
  try {
    await window.storage.set(key, JSON.stringify(value), shared);
    return true;
  } catch (e) {
    console.error("storage set failed", key, e);
    return false;
  }
}
const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------------------------------------------------------------- */
/* Password hashing (client-side, salted SHA-256 via Web Crypto)     */
/* ---------------------------------------------------------------- */

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------------------------------------------------------- */
/* Theme                                                             */
/* ---------------------------------------------------------------- */

const LIGHT = {
  mode: "light",
  bg: "#EEF1F5", surface: "#FFFFFF", surfaceAlt: "#F5F7FA", border: "#D9DFE6",
  text: "#1E2A38", textMuted: "#5B6675", accent: "#2F6F4E", accentSoft: "#DDEAE2",
  gold: "#A97B22", goldSoft: "#F2E5C4", red: "#AE4E3E", redSoft: "#F1DAD4",
  yellow: "#B98A28", yellowSoft: "#F3E7C6", green: "#2F6F4E", greenSoft: "#D9EAE0",
  shadow: "0 1px 2px rgba(30,42,56,0.06), 0 1px 1px rgba(30,42,56,0.04)",
};
const DARK = {
  mode: "dark",
  bg: "#0F151E", surface: "#171F2A", surfaceAlt: "#1D2634", border: "#2B3646",
  text: "#E7EAEE", textMuted: "#93A0B0", accent: "#4FA37B", accentSoft: "#1B2B23",
  gold: "#E1B85B", goldSoft: "#332A19", red: "#D9836F", redSoft: "#37241F",
  yellow: "#E1B85B", yellowSoft: "#332A19", green: "#4FA37B", greenSoft: "#1B2B23",
  shadow: "0 1px 2px rgba(0,0,0,0.3)",
};

const FONT_HEAD = "'Source Serif 4', Georgia, serif";
const FONT_BODY = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";
// The size input is labeled in points (like a word processor), not pixels —
// 1pt = 4/3px at standard screen density, so "12" (normal) renders at 16px
// rather than a literal, cramped 12px.
const PT_TO_PX = 4 / 3;

const COLOR_PRESETS = ["#2F6F4E", "#A97B22", "#AE4E3E", "#2F6F92", "#7C4FA0", "#4F7FA3", "#8A4F6B", "#5B7F3A"];

/* ---------------------------------------------------------------- */
/* Seed data                                                         */
/* ---------------------------------------------------------------- */

function seedTree() {
  const s1 = "s_math";
  const t1 = "t_algebra", t2 = "t_geometry";
  const st1 = "st_linear", st2 = "st_quadratic", st3 = "st_circle";
  return {
    subjects: [{ id: s1, name: "Mathematics" }],
    topics: [
      { id: t1, subjectId: s1, name: "Algebra" },
      { id: t2, subjectId: s1, name: "Geometry" },
    ],
    subtopics: [
      { id: st1, topicId: t1, name: "Linear Equations" },
      { id: st2, topicId: t1, name: "Quadratic Equations" },
      { id: st3, topicId: t2, name: "Circle Theorems" },
    ],
    outcomes: [
      { id: uid(), subtopicId: st1, name: "Solve one-step linear equations" },
      { id: uid(), subtopicId: st1, name: "Solve two-step linear equations" },
      { id: uid(), subtopicId: st1, name: "Graph a line from slope-intercept form" },
      { id: uid(), subtopicId: st2, name: "Factorise a quadratic expression" },
      { id: uid(), subtopicId: st2, name: "Solve using the quadratic formula" },
      { id: uid(), subtopicId: st3, name: "Apply the angle-in-semicircle theorem" },
      { id: uid(), subtopicId: st3, name: "Apply the tangent-radius theorem" },
    ],
    notesTopics: [],
    notesSubtopics: [],
  };
}

/* ---------------------------------------------------------------- */
/* Math + rich text for collaborative / personal docs                */
/* ---------------------------------------------------------------- */

let _katexPromise = null;
function loadKatex() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.katex) return Promise.resolve(true);
  if (_katexPromise) return _katexPromise;
  _katexPromise = new Promise((resolve) => {
    try {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    } catch (e) {
      resolve(false);
    }
  });
  return _katexPromise;
}
function useKatexReady() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.katex);
  useEffect(() => { let live = true; loadKatex().then((ok) => live && setReady(ok)); return () => { live = false; }; }, []);
  return ready;
}

// MathLive powers the visual math input in the toolbar's math popover: typing
// "/" makes a fraction, "^" makes an exponent, "sqrt" becomes a root symbol,
// and so on — much closer to Mathspace/Desmos than hand-writing LaTeX. It
// registers a <math-field> custom element once loaded; the LaTeX it produces
// is still what actually gets rendered and stored, so nothing about how math
// is saved or displayed changes, only how it's typed in.
let _mathLivePromise = null;
function loadMathLive() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.customElements && window.customElements.get("math-field")) return Promise.resolve(true);
  if (_mathLivePromise) return _mathLivePromise;
  _mathLivePromise = new Promise((resolve) => {
    try {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mathlive/dist/mathlive.min.js";
      script.onload = () => {
        if (window.customElements && window.customElements.whenDefined) {
          window.customElements.whenDefined("math-field").then(() => resolve(true)).catch(() => resolve(false));
        } else {
          resolve(!!(window.customElements && window.customElements.get("math-field")));
        }
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    } catch (e) {
      resolve(false);
    }
  });
  return _mathLivePromise;
}
function useMathLiveReady() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!(window.customElements && window.customElements.get("math-field")));
  useEffect(() => { let live = true; loadMathLive().then((ok) => live && setReady(ok)); return () => { live = false; }; }, []);
  return ready;
}

// Thin React wrapper around the <math-field> custom element — it's not a
// normal form control, so its value has to be read/written imperatively
// through the DOM node rather than via React props.
function MathFieldInput({ value, onChange, theme }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(el.value);
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [onChange]);
  useEffect(() => {
    if (ref.current && ref.current.value !== value) ref.current.value = value;
  }, [value]);
  return (
    <math-field
      ref={ref}
      virtual-keyboard-mode="onfocus"
      math-virtual-keyboard-policy="auto"
      style={{
        display: "block", width: "100%", boxSizing: "border-box", fontSize: 17,
        padding: "8px 10px", borderRadius: 6, border: `1px solid ${theme.border}`,
        background: theme.surfaceAlt, color: theme.text,
        colorScheme: theme.mode,
        // MathLive reads these as CSS custom properties (including through its
        // shadow DOM boundary). Left unset, it defaults to a light highlight
        // for whichever fraction/subexpression the caret is inside — which is
        // a light background behind light dark-mode text, i.e. invisible.
        "--text-color": theme.text,
        "--background-color": theme.surfaceAlt,
        "--caret-color": theme.accent,
        "--selection-color": theme.text,
        "--selection-background-color": theme.accentSoft,
        "--contains-highlight-background-color": theme.accentSoft,
        "--smart-fence-color": theme.textMuted,
      }}
    />
  );
}

// Parses the OLD lightweight markdown-like syntax into a block tree. Only used
// once, to migrate documents saved before notes became a live rich editor —
// new documents are stored as real HTML and never go through this.
function parseDoc(text) {
  const lines = (text || "").split("\n");
  let i = 0;
  function parseBlocks(stopLevel) {
    const blocks = [];
    let paraBuf = [];
    let listBuf = null;
    const flushPara = () => { if (paraBuf.length) { blocks.push({ kind: "para", text: paraBuf.join(" ") }); paraBuf = []; } };
    const flushList = () => { if (listBuf) { blocks.push(listBuf); listBuf = null; } };
    while (i < lines.length) {
      const line = lines[i];
      const headingMatch = /^(#{2,4})\s+(.*)$/.exec(line);
      if (headingMatch) {
        const level = headingMatch[1].length;
        if (stopLevel !== null && level <= stopLevel) break;
        flushPara(); flushList();
        i++;
        const title = headingMatch[2].trim();
        const children = parseBlocks(level);
        blocks.push({ kind: "section", level, title, children });
        continue;
      }
      if (/^\$\$\s*$/.test(line)) {
        flushPara(); flushList();
        i++;
        const mathLines = [];
        while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) { mathLines.push(lines[i]); i++; }
        i++;
        blocks.push({ kind: "mathblock", text: mathLines.join("\n") });
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        flushPara();
        if (!listBuf) listBuf = { kind: "list", items: [] };
        listBuf.items.push(line.replace(/^\s*[-*]\s+/, ""));
        i++;
        continue;
      }
      flushList();
      if (/^>\s?/.test(line)) {
        flushPara();
        blocks.push({ kind: "quote", text: line.replace(/^>\s?/, "") });
        i++;
        continue;
      }
      if (line.trim() === "") { flushPara(); flushList(); i++; continue; }
      paraBuf.push(line.trim());
      i++;
    }
    flushPara(); flushList();
    return blocks;
  }
  return parseBlocks(null);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderMathHtml(tex, display, katexReady) {
  if (katexReady && typeof window !== "undefined" && window.katex) {
    try { return window.katex.renderToString(tex, { throwOnError: false, displayMode: !!display }); }
    catch (e) { /* fall through */ }
  }
  return `<span style="font-family:${FONT_MONO};opacity:.7">${escapeHtml(display ? `$$${tex}$$` : `$${tex}$`)}</span>`;
}
function inlineToHtml(text, katexReady) {
  const re = /\$([^$\n]+)\$|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  let out = "", last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out += escapeHtml(text.slice(last, m.index));
    if (m[1] !== undefined) out += renderMathHtml(m[1], false, katexReady);
    else if (m[2] !== undefined) out += `<strong>${escapeHtml(m[2])}</strong>`;
    else if (m[3] !== undefined) out += `<code>${escapeHtml(m[3])}</code>`;
    else if (m[4] !== undefined) out += `<em>${escapeHtml(m[4])}</em>`;
    last = re.lastIndex;
  }
  if (last < text.length) out += escapeHtml(text.slice(last));
  return out;
}
function blocksToHtml(blocks, katexReady) {
  return blocks.map((b) => {
    if (b.kind === "section") {
      const tag = b.level === 2 ? "h2" : b.level === 3 ? "h3" : "h4";
      return `<${tag}>${escapeHtml(b.title)}</${tag}>${blocksToHtml(b.children, katexReady)}`;
    }
    if (b.kind === "para") return `<p>${inlineToHtml(b.text, katexReady)}</p>`;
    if (b.kind === "list") return `<ul>${b.items.map((it) => `<li>${inlineToHtml(it, katexReady)}</li>`).join("")}</ul>`;
    if (b.kind === "quote") return `<blockquote>${inlineToHtml(b.text, katexReady)}</blockquote>`;
    if (b.kind === "mathblock") return `<div class="sm-mathblock">${renderMathHtml(b.text, true, katexReady)}</div>`;
    return "";
  }).join("");
}
// One-time conversion of a legacy plain-text doc into HTML, so old notes still
// render correctly the first time they're opened in the new live editor.
function mdTextToHtml(text, katexReady) {
  if (!text || !text.trim()) return "";
  return blocksToHtml(parseDoc(text), katexReady);
}

// execCommand('formatBlock', ...) is inconsistent enough across browsers that
// toggling a heading back off with it doesn't reliably work — so headings and
// quotes are toggled by directly inspecting and swapping the DOM block tag
// instead of going through that command at all.
function getCurrentBlock(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  let node = sel.getRangeAt(0).startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  if (!root.contains(node)) return null;
  while (node && node.parentNode !== root) node = node.parentNode;
  return node; // a direct child of root, or root itself if there's no block wrapper yet
}
function placeCaretAtEnd(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function replaceBlockTag(root, newTag) {
  const block = getCurrentBlock(root);
  const target = !block || block === root ? null : block;
  const replacement = document.createElement(newTag);
  if (target) {
    while (target.firstChild) replacement.appendChild(target.firstChild);
    target.parentNode.replaceChild(replacement, target);
  } else {
    // No block wrapper yet (e.g. the very first line) — wrap everything at
    // the top level of the editor into one new block.
    while (root.firstChild) replacement.appendChild(root.firstChild);
    root.appendChild(replacement);
  }
  placeCaretAtEnd(replacement);
}

// Matches a URL token: http(s):// or bare www. addresses, stopping before
// trailing punctuation that's obviously not part of the link (a period
// ending a sentence, a closing paren around it, etc.) so "see example.com."
// links just example.com, not example.com. with the period baked in.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
function trimTrailingPunctuation(raw) {
  const m = /[)\].,;:!?'"]+$/.exec(raw);
  return m ? [raw.slice(0, -m[0].length), m[0]] : [raw, ""];
}
function makeLink(urlText) {
  const a = document.createElement("a");
  a.href = /^https?:\/\//i.test(urlText) ? urlText : `https://${urlText}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = urlText;
  return a;
}

// Full-document sweep: used right after content is loaded or synced in from
// someone else, so plain-text URLs that were typed before this feature
// existed (or written elsewhere and pasted in) still end up clickable.
function linkifyElement(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest("a") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const targets = [];
  let node;
  while ((node = walker.nextNode())) {
    URL_RE.lastIndex = 0;
    if (URL_RE.test(node.textContent)) targets.push(node);
  }
  for (const textNode of targets) {
    const text = textNode.textContent;
    URL_RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = URL_RE.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const [url, trailing] = trimTrailingPunctuation(m[0]);
      if (url) frag.appendChild(makeLink(url));
      if (trailing) frag.appendChild(document.createTextNode(trailing));
      last = URL_RE.lastIndex;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  }
}

// Live-typing check: fires on every keystroke but only actually does
// anything the moment you finish a URL with a space or newline, converting
// just that one word into a link and leaving the cursor exactly where it
// was — much cheaper and less disruptive than re-scanning the whole
// document (and re-parsing the whole doc would fight the browser's own
// cursor handling while someone's mid-sentence).
function linkifyBeforeCursor(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  const offset = range.startOffset;
  if (node.nodeType !== Node.TEXT_NODE) return;
  if (node.parentElement && node.parentElement.closest("a")) return;

  const before = node.textContent.slice(0, offset);
  const m = /(\S+)(\s)$/.exec(before);
  if (!m) return;
  const [url, trailingPunct] = trimTrailingPunctuation(m[1]);
  URL_RE.lastIndex = 0;
  if (!url || !URL_RE.test(url) || URL_RE.lastIndex !== url.length) return;

  const tokenStart = offset - m[0].length;
  const urlEnd = tokenStart + url.length;
  const text = node.textContent;
  const beforeNode = document.createTextNode(text.slice(0, tokenStart));
  const link = makeLink(url);
  const afterNode = document.createTextNode(text.slice(urlEnd));

  const parent = node.parentNode;
  parent.replaceChild(afterNode, node);
  parent.insertBefore(link, afterNode);
  parent.insertBefore(beforeNode, link);

  const newRange = document.createRange();
  const posInAfter = Math.max(0, Math.min(offset - urlEnd, afterNode.length));
  newRange.setStart(afterNode, posInAfter);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

const TOOLBAR_ITEMS = [
  { cmd: "bold", icon: Bold, title: "Bold" },
  { cmd: "italic", icon: Italic, title: "Italic" },
  { cmd: "heading", icon: Heading2, title: "Heading" },
  { cmd: "insertUnorderedList", icon: List, title: "Bullet list" },
  { cmd: "quote", icon: Quote, title: "Quote" },
  { cmd: "code", icon: Code, title: "Inline code" },
];

// A single always-editable, always-formatted document: what you see while
// typing IS what's saved — there's no separate preview mode. Every change is
// auto-saved a moment after you stop typing (no Save button), and while the
// editor isn't focused it polls for anyone else's changes and merges them in,
// so two people working on the same doc converge within a few seconds —
// not true simultaneous character-by-character editing like a live Google
// Doc (that needs a real-time backend this environment doesn't have), but
// close enough for notes that aren't being typed into by two people at once.
function RichEditor({ theme, storageKey, label, icon: Icon, emptyHint, privateNote, katexReady, mathliveReady }) {
  const elRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [empty, setEmpty] = useState(true);
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | saving | syncing
  const [updatedAt, setUpdatedAt] = useState(null);
  const [mathOpen, setMathOpen] = useState(false);
  const [mathDraft, setMathDraft] = useState("");
  const [mathMode, setMathMode] = useState("visual"); // "visual" (MathLive) or "latex" (raw text)
  const [sizeInput, setSizeInput] = useState("");
  const lastHtmlRef = useRef("");
  const lastUpdatedAtRef = useRef(0);
  const savedRangeRef = useRef(null);
  const savedFontRangeRef = useRef(null);
  const saveTimerRef = useRef(null);

  const refreshEmpty = () => setEmpty(!elRef.current || !elRef.current.textContent.trim());

  useEffect(() => {
    let live = true;
    setReady(false);
    (async () => {
      const raw = await sGet(storageKey, true);
      let html = "", ts = null;
      if (raw) {
        if (raw.html !== undefined) { html = raw.html; ts = raw.updatedAt; }
        else if (raw.text !== undefined) { html = mdTextToHtml(raw.text, katexReady); ts = raw.updatedAt; }
        else if (Array.isArray(raw)) { html = mdTextToHtml(raw.map((n) => n.text).join("\n\n"), katexReady); ts = raw.length ? raw[raw.length - 1].ts : null; }
      }
      if (!live) return;
      lastHtmlRef.current = html;
      lastUpdatedAtRef.current = ts || 0;
      if (elRef.current) { elRef.current.innerHTML = html; linkifyElement(elRef.current); }
      setUpdatedAt(ts);
      refreshEmpty();
      setReady(true);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (!elRef.current || document.activeElement === elRef.current) return;
      const raw = await sGet(storageKey, true);
      if (!raw) return;
      const remoteHtml = raw.html !== undefined ? raw.html : (raw.text !== undefined ? mdTextToHtml(raw.text, katexReady) : "");
      const remoteTs = raw.updatedAt || 0;
      if (remoteTs > lastUpdatedAtRef.current) {
        setStatus("syncing");
        lastUpdatedAtRef.current = remoteTs;
        lastHtmlRef.current = remoteHtml;
        elRef.current.innerHTML = remoteHtml;
        linkifyElement(elRef.current);
        setUpdatedAt(remoteTs);
        refreshEmpty();
        setTimeout(() => setStatus("idle"), 600);
      }
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const doSave = async () => {
    if (!elRef.current) return;
    const html = elRef.current.innerHTML;
    if (html === lastHtmlRef.current) return;
    const ts = Date.now();
    lastHtmlRef.current = html;
    lastUpdatedAtRef.current = ts;
    setStatus("saving");
    await sSet(storageKey, { html, updatedAt: ts }, true);
    setUpdatedAt(ts);
    setStatus("idle");
  };
  const scheduleSave = () => {
    refreshEmpty();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 700);
  };

  const handleInput = () => {
    linkifyBeforeCursor(elRef.current);
    scheduleSave();
  };

  // Pasted text keeps any URLs in it clickable too, rather than only
  // linkifying URLs you type by hand.
  const handlePaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    URL_RE.lastIndex = 0;
    if (!text || !URL_RE.test(text)) return; // no URLs — let the default paste happen as normal
    e.preventDefault();
    URL_RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0, m;
    while ((m = URL_RE.exec(text))) {
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const [url, trailing] = trimTrailingPunctuation(m[0]);
      if (url) frag.appendChild(makeLink(url));
      if (trailing) frag.appendChild(document.createTextNode(trailing));
      last = URL_RE.lastIndex;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const lastChild = frag.lastChild;
    range.insertNode(frag);
    if (lastChild) {
      const after = document.createRange();
      after.setStartAfter(lastChild);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    scheduleSave();
  };

  const exec = (cmd) => {
    elRef.current.focus();
    if (cmd === "heading") {
      const block = getCurrentBlock(elRef.current);
      const tag = block && block !== elRef.current ? block.tagName : "";
      replaceBlockTag(elRef.current, /^H[2-4]$/.test(tag) ? "P" : "H3");
    } else if (cmd === "quote") {
      const block = getCurrentBlock(elRef.current);
      const tag = block && block !== elRef.current ? block.tagName : "";
      replaceBlockTag(elRef.current, tag === "BLOCKQUOTE" ? "P" : "BLOCKQUOTE");
    } else if (cmd === "code") {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const text = sel.toString();
      const codeEl = document.createElement("code");
      codeEl.appendChild(document.createTextNode(text || "\u200b"));
      range.deleteContents();
      range.insertNode(codeEl);
      const after = document.createRange();
      after.selectNodeContents(codeEl);
      after.collapse(false);
      sel.removeAllRanges();
      sel.addRange(after);
    } else {
      document.execCommand(cmd, false, null);
    }
    scheduleSave();
  };

  // The number input steals focus the moment it's clicked into, so the
  // current range is captured on mousedown (before that happens) and
  // re-applied here once a size is actually entered.
  const applyFontSize = (rawPx) => {
    const pt = parseFloat(rawPx);
    if (!pt || pt <= 0 || !savedFontRangeRef.current) return;
    const px = pt * PT_TO_PX;
    elRef.current.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    const range = savedFontRangeRef.current;
    sel.addRange(range);
    if (range.collapsed) {
      // Nothing highlighted — resize the whole block the cursor is in.
      const block = getCurrentBlock(elRef.current);
      if (block && block !== elRef.current) block.style.fontSize = `${px}px`;
    } else {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      try {
        range.surroundContents(span);
      } catch (e) {
        // Selection spans multiple elements — surroundContents can't wrap
        // that directly, so extract the fragment and wrap it instead.
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
      const after = document.createRange();
      after.selectNodeContents(span);
      after.collapse(false);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    scheduleSave();
  };

  const openMath = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && elRef.current && elRef.current.contains(sel.getRangeAt(0).startContainer)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      savedRangeRef.current = null;
    }
    setMathDraft("");
    setMathOpen(true);
  };
  const insertMath = () => {
    if (!mathDraft.trim()) { setMathOpen(false); return; }
    elRef.current.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    let range;
    if (savedRangeRef.current) {
      range = savedRangeRef.current;
    } else {
      range = document.createRange();
      range.selectNodeContents(elRef.current);
      range.collapse(false);
    }
    range.deleteContents();
    const wrapper = document.createElement("span");
    wrapper.setAttribute("contenteditable", "false");
    wrapper.innerHTML = renderMathHtml(mathDraft.trim(), false, katexReady);
    range.insertNode(wrapper);
    const zwsp = document.createTextNode("\u200b");
    wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
    const after = document.createRange();
    after.setStart(zwsp, 1);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    setMathOpen(false);
    setMathDraft("");
    scheduleSave();
  };

  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: theme.textMuted, fontSize: 12.5 }}>
          <Icon size={13} /> {label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {TOOLBAR_ITEMS.map((it) => (
            <button key={it.cmd} title={it.title} onMouseDown={(e) => { e.preventDefault(); exec(it.cmd); }}
              style={{
                width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent",
                color: theme.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <it.icon size={14} />
            </button>
          ))}
          <label title="Text size (points, 12 is normal)" style={{
            display: "flex", alignItems: "center", gap: 4, padding: "0 4px", color: theme.textMuted,
          }}>
            <Type size={14} />
            <input
              type="number"
              min={6}
              max={72}
              placeholder="12"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onMouseDown={() => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount && elRef.current.contains(sel.getRangeAt(0).startContainer)) {
                  savedFontRangeRef.current = sel.getRangeAt(0).cloneRange();
                } else {
                  savedFontRangeRef.current = null;
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { applyFontSize(sizeInput); e.target.blur(); } }}
              onBlur={() => { if (sizeInput) applyFontSize(sizeInput); }}
              style={{
                width: 40, fontFamily: FONT_BODY, fontSize: 12, border: `1px solid ${theme.border}`,
                borderRadius: 4, background: theme.surfaceAlt, color: theme.text, outline: "none",
                padding: "3px 4px",
              }} />
          </label>
          <button title="Insert math" onMouseDown={(e) => { e.preventDefault(); openMath(); }}
            style={{
              width: 26, height: 26, borderRadius: 5, border: "none", background: "transparent",
              color: theme.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <Sigma size={14} />
          </button>
        </div>
      </div>

      {mathOpen && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
            <div style={{ flex: 1 }}>
              {mathMode === "visual" && mathliveReady ? (
                <MathFieldInput theme={theme} value={mathDraft} onChange={setMathDraft} />
              ) : (
                <input autoFocus={mathMode === "latex"} value={mathDraft} onChange={(e) => setMathDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") insertMath(); if (e.key === "Escape") setMathOpen(false); }}
                  placeholder="LaTeX, e.g. \frac{a}{b}"
                  style={{
                    width: "100%", boxSizing: "border-box", fontFamily: FONT_MONO, fontSize: 13, padding: "8px 10px",
                    borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, outline: "none",
                  }} />
              )}
            </div>
            <Btn theme={theme} variant="solid" onClick={insertMath}>
              <Check size={13} /> Insert
            </Btn>
            <Btn theme={theme} onClick={() => setMathOpen(false)}><X size={13} /></Btn>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              {mathMode === "visual" && mathliveReady
                ? 'Type like normal math — "/" makes a fraction, "^" a power, "sqrt" a root.'
                : "Type LaTeX directly."}
            </span>
            {mathliveReady && (
              <button onClick={() => setMathMode((m) => (m === "visual" ? "latex" : "visual"))}
                style={{ background: "none", border: "none", cursor: "pointer", color: theme.accent, fontSize: 11, fontWeight: 600, padding: 0 }}>
                {mathMode === "visual" ? "Switch to raw LaTeX" : "Switch to visual editor"}
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ position: "relative" }}>
        {empty && !focused && (
          <div style={{ position: "absolute", top: 0, left: 0, fontSize: 12 * PT_TO_PX, color: theme.textMuted, pointerEvents: "none" }}>
            {ready ? emptyHint : "Loading…"}
          </div>
        )}
        <div
          ref={elRef}
          contentEditable={ready}
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); linkifyElement(elRef.current); doSave(); }}
          className="sm-doc"
          style={{
            minHeight: 90, fontSize: 12 * PT_TO_PX, lineHeight: 1.6, color: theme.text, outline: "none",
            "--sm-quote": theme.gold, "--sm-code-bg": theme.surfaceAlt, "--sm-border": theme.border, "--sm-link": theme.accent,
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: theme.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
        {status !== "idle" && <RefreshCw size={11} className={status === "saving" ? "" : "animate-spin"} />}
        {status === "saving" ? "Saving…" : status === "syncing" ? "Syncing changes from someone else…" :
          updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}` : "Not saved yet"}
        {privateNote ? " · only visible to you" : ""}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Resources: shared external links per topic / subtopic             */
/* ---------------------------------------------------------------- */

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; }
}

function ResourceList({ theme, storageKey, user }) {
  const [items, setItems] = useState(null); // null = loading
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    let live = true;
    setItems(null);
    (async () => {
      const raw = await sGet(storageKey, true);
      if (live) setItems(Array.isArray(raw) ? raw : []);
    })();
    return () => { live = false; };
  }, [storageKey]);

  const persist = async (next) => {
    setItems(next);
    await sSet(storageKey, next, true);
  };
  const addResource = () => {
    let clean = url.trim();
    if (!clean) return;
    if (!/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
    const item = { id: uid(), title: title.trim() || hostOf(clean), url: clean, addedBy: user.email, addedByName: user.displayName, ts: Date.now() };
    persist([...(items || []), item]);
    setTitle(""); setUrl("");
  };
  const removeResource = (id) => persist((items || []).filter((r) => r.id !== id));

  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: theme.textMuted, fontSize: 12.5 }}>
        <Link2 size={13} /> Resources
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {items === null && <span style={{ fontSize: 13, color: theme.textMuted }}>Loading…</span>}
        {items && items.length === 0 && <span style={{ fontSize: 13, color: theme.textMuted }}>No resources yet — add a link below.</span>}
        {items && items.map((r) => (
          <div key={r.id} style={{
            display: "flex", alignItems: "flex-start", gap: 10, border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: "10px 12px", background: theme.surfaceAlt,
          }}>
            <ExternalLink size={14} style={{ marginTop: 2, flexShrink: 0, color: theme.accent }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 13.5, fontWeight: 600, color: theme.accent, textDecoration: "none", wordBreak: "break-word" }}>
                {r.title}
              </a>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                {hostOf(r.url)} · added by {r.addedByName}
              </div>
            </div>
            {r.addedBy === user.email && (
              <button onClick={() => removeResource(r.id)} title="Remove"
                style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted, flexShrink: 0 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)"
          style={{
            flex: "1 1 140px", fontFamily: FONT_BODY, fontSize: 13, padding: "8px 10px", borderRadius: 6,
            border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, outline: "none",
          }} />
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addResource()}
          placeholder="https://…"
          style={{
            flex: "2 1 200px", fontFamily: FONT_BODY, fontSize: 13, padding: "8px 10px", borderRadius: 6,
            border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, outline: "none",
          }} />
        <Btn theme={theme} variant="solid" onClick={addResource}><Plus size={13} /> Add link</Btn>
      </div>
    </div>
  );
}
function Btn({ children, onClick, theme, variant = "ghost", style, ...rest }) {
  const base = {
    fontFamily: FONT_BODY, fontSize: 13, fontWeight: 500, borderRadius: 6,
    padding: "6px 12px", cursor: "pointer", display: "inline-flex",
    alignItems: "center", gap: 6, border: `1px solid ${theme.border}`,
    transition: "background .12s, border-color .12s", background: "transparent",
    color: theme.text,
  };
  const variants = {
    ghost: {},
    solid: { background: theme.accent, borderColor: theme.accent, color: "#fff" },
    subtle: { background: theme.surfaceAlt },
    danger: { color: theme.red, borderColor: theme.redSoft },
    gold: { background: theme.gold, borderColor: theme.gold, color: "#fff" },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

function AddTile({ theme, label, onAdd, wide }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const commit = () => {
    const v = val.trim();
    if (v) onAdd(v);
    setVal("");
    setOpen(false);
  };
  if (open) {
    return (
      <div
        style={{
          border: `1.5px dashed ${theme.accent}`, borderRadius: 8, padding: 12,
          minWidth: wide ? 220 : 180, background: theme.surfaceAlt,
          display: "flex", flexDirection: "column", gap: 8,
        }}
      >
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setOpen(false); }}
          placeholder={label}
          style={{
            fontFamily: FONT_BODY, fontSize: 13, padding: "6px 8px", borderRadius: 5,
            border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text,
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <Btn theme={theme} variant="solid" onClick={commit}><Check size={13} /> Add</Btn>
          <Btn theme={theme} onClick={() => setOpen(false)}><X size={13} /></Btn>
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={() => setOpen(true)}
      style={{
        border: `1.5px dashed ${theme.border}`, borderRadius: 8, padding: 12,
        minWidth: wide ? 220 : 180, minHeight: 64, background: "transparent",
        color: theme.textMuted, cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", gap: 6, fontFamily: FONT_BODY,
        fontSize: 13, textAlign: "center",
      }}
    >
      <Plus size={15} /> {label}
    </button>
  );
}

function Breadcrumb({ theme, items, onJump }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 16, fontFamily: FONT_BODY, fontSize: 13 }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight size={13} color={theme.textMuted} />}
          <span
            onClick={() => onJump(i)}
            style={{
              cursor: i < items.length - 1 ? "pointer" : "default",
              color: i === items.length - 1 ? theme.text : theme.textMuted,
              fontWeight: i === items.length - 1 ? 600 : 400,
            }}
          >
            {it}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

// Used by the Map, Notes, and Personal ("My notes") tabs so pinning behaves
// and looks identical everywhere. `subjects` is expected to already be in
// pinned-first order — this component just renders the strip and the pin
// toggle, it doesn't do the sorting itself.
function SubjectTabStrip({ theme, subjects, activeId, accent, onSelect, isPinned, onTogglePin }) {
  return (
    <>
      {subjects.map((s) => {
        const pinned = isPinned(s.id);
        const active = activeId === s.id;
        return (
          <div key={s.id} onClick={() => onSelect(s.id)} style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_BODY, fontSize: 13.5,
            fontWeight: 600, padding: "8px 8px 8px 16px", borderRadius: "8px 8px 0 0", cursor: "pointer",
            border: `1px solid ${theme.border}`, borderBottom: active ? `3px solid ${accent}` : `1px solid ${theme.border}`,
            background: active ? theme.surface : theme.surfaceAlt, color: active ? theme.text : theme.textMuted,
          }}>
            <span>{s.name}</span>
            <button onClick={(e) => { e.stopPropagation(); onTogglePin(s.id); }} title={pinned ? "Unpin" : "Pin to top"}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center",
                color: pinned ? theme.gold : theme.textMuted, opacity: pinned ? 1 : 0.4,
              }}>
              <Pin size={12} fill={pinned ? "currentColor" : "none"} />
            </button>
          </div>
        );
      })}
    </>
  );
}

const TRAFFIC = [
  { key: "red", label: "Needs work" },
  { key: "yellow", label: "Getting there" },
  { key: "green", label: "Confident" },
];

function TrafficLight({ theme, status, onSet }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {TRAFFIC.map((t) => {
        const active = status === t.key;
        const color = theme[t.key];
        const soft = theme[t.key + "Soft"];
        return (
          <button
            key={t.key}
            title={t.label}
            onClick={() => onSet(active ? null : t.key)}
            style={{
              width: 22, height: 22, borderRadius: "50%", cursor: "pointer",
              border: `2px solid ${color}`, background: active ? color : soft,
              opacity: active ? 1 : 0.55,
            }}
          />
        );
      })}
    </div>
  );
}

// Small popover of preset swatches + a "reset to default" option.
function ColorPicker({ theme, value, onChange, onClose }) {
  return (
    <div style={{
      position: "absolute", top: "100%", right: 0, marginTop: 4, background: theme.surface,
      border: `1px solid ${theme.border}`, borderRadius: 8, padding: 8, display: "flex", gap: 6,
      boxShadow: theme.shadow, zIndex: 5, flexWrap: "wrap", width: 132,
    }} onClick={(e) => e.stopPropagation()}>
      {COLOR_PRESETS.map((c) => (
        <button key={c} onClick={() => { onChange(c); onClose(); }} title={c} style={{
          width: 18, height: 18, borderRadius: "50%", background: c, cursor: "pointer", padding: 0,
          border: value === c ? `2px solid ${theme.text}` : "1px solid rgba(0,0,0,.15)",
        }} />
      ))}
      <button onClick={() => { onChange(null); onClose(); }} title="Reset to default" style={{
        width: 18, height: 18, borderRadius: "50%", background: "transparent", padding: 0,
        border: `1.5px dashed ${theme.textMuted}`, cursor: "pointer",
      }} />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Auth screen (sign up / sign in)                                   */
/* ---------------------------------------------------------------- */

function AuthScreen({ theme, onSignup, onSignin, error, busy }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");

  const submit = () => {
    if (busy) return;
    if (mode === "signup") onSignup({ email, password, confirm, displayName });
    else onSignin({ email, password });
  };

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", fontSize: 14,
    borderRadius: 7, border: `1px solid ${theme.border}`, background: theme.surfaceAlt,
    color: theme.text, outline: "none", marginBottom: 12, fontFamily: FONT_BODY,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: theme.bg, fontFamily: FONT_BODY,
    }}>
      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
        padding: "40px 36px", width: 360, boxShadow: theme.shadow,
      }} onKeyDown={(e) => e.key === "Enter" && submit()}>
        <div style={{ width: 40, height: 6, background: theme.gold, borderRadius: 3, marginBottom: 18 }} />
        <h1 style={{ fontFamily: FONT_HEAD, fontSize: 26, color: theme.text, margin: "0 0 6px" }}>Study Map</h1>
        <p style={{ color: theme.textMuted, fontSize: 13.5, margin: "0 0 22px", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 6 }}>
          <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 2 }} />
          {mode === "signup"
            ? "Create an account — your password is salted and hashed before it's ever stored. You'll stay signed in on this device."
            : "Sign in to see your progress. You'll stay signed in on this device."}
        </p>

        {mode === "signup" && (
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (shown on the leaderboard)" style={inputStyle} />
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
          placeholder="Email" style={inputStyle} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
          placeholder="Password" style={inputStyle} />
        {mode === "signup" && (
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password"
            placeholder="Confirm password" style={inputStyle} />
        )}

        {error && (
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 6, color: theme.red, fontSize: 12.5,
            background: theme.redSoft, borderRadius: 6, padding: "8px 10px", marginBottom: 12,
          }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        <Btn theme={theme} variant="solid" style={{ width: "100%", justifyContent: "center", padding: "10px 0" }}
          onClick={submit} disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : (mode === "signup" ? "Create account" : "Sign in")}
        </Btn>

        <div style={{ marginTop: 16, fontSize: 12.5, color: theme.textMuted, textAlign: "center" }}>
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <span onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            style={{ color: theme.accent, cursor: "pointer", fontWeight: 600 }}>
            {mode === "signup" ? "Sign in" : "Create one"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Main app                                                          */
/* ---------------------------------------------------------------- */

export default function StudyMapApp() {
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [user, setUser] = useState(null); // { email, displayName }
  const [tree, setTree] = useState({ subjects: [], topics: [], subtopics: [], outcomes: [], notesTopics: [], notesSubtopics: [] });
  const [progress, setProgress] = useState({});
  const [todo, setTodo] = useState([]); // schedule items: { id, type: 'outcome'|'subtopic', refId, dueDate, done }
  const [pinnedSubjects, setPinnedSubjects] = useState([]); // subject ids, per-account
  const [tab, setTab] = useState("map");
  const [mapPath, setMapPath] = useState({ subjectId: null, topicId: null, subtopicId: null });
  const [notesPath, setNotesPath] = useState({ subjectId: null, topicId: null, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null });
  const [personalPath, setPersonalPath] = useState({ subjectId: null, topicId: null, subtopicId: null });
  const [personalSection, setPersonalSection] = useState("schedule"); // lifted so it survives re-renders (see PersonalTab)
  const [showOutcomesInNotes, setShowOutcomesInNotes] = useState(false);
  const [lbScope, setLbScope] = useState("overall");
  const [lbData, setLbData] = useState(null);
  const theme = dark ? DARK : LIGHT;
  const katexReady = useKatexReady();
  const mathliveReady = useMathLiveReady();

  // Refs mirror the latest state so mutators never build the "next" value
  // from a stale closure — this is what previously let rapid updates
  // (e.g. checking several outcomes green in quick succession) silently
  // overwrite each other and undercount on the leaderboard.
  const progressRef = useRef({});
  const todoRef = useRef([]);
  const pinnedRef = useRef([]);
  const treeRef = useRef(tree);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { todoRef.current = todo; }, [todo]);
  useEffect(() => { pinnedRef.current = pinnedSubjects; }, [pinnedSubjects]);
  useEffect(() => { treeRef.current = tree; }, [tree]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let t = await sGet("tree", true);
      if (!t) {
        t = seedTree();
        await sSet("tree", t, true);
      }
      if (!t.notesTopics) t.notesTopics = t.pendingTopics || [];
      if (!t.notesSubtopics) t.notesSubtopics = [];
      treeRef.current = t;
      setTree(t);

      // Stay-signed-in: a small per-device session pointer, stored in this
      // browser/account's own personal (non-shared) storage slot.
      const session = await sGet("session", false);
      if (session && session.email) {
        const account = await sGet(`account:${session.email}`, true);
        if (account) await completeLogin(account.email, account.displayName);
        else await sSet("session", null, false);
      }
      setLoading(false);
    })();
  }, []);

  /* ---- auth ---- */
  const signup = async ({ email, password, confirm, displayName }) => {
    setAuthError("");
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return setAuthError("Enter a valid email address.");
    if (!displayName.trim()) return setAuthError("Pick a display name.");
    if (password.length < 6) return setAuthError("Password must be at least 6 characters.");
    if (password !== confirm) return setAuthError("Passwords don't match.");
    setAuthBusy(true);
    const existing = await sGet(`account:${cleanEmail}`, true);
    if (existing) { setAuthBusy(false); return setAuthError("An account with that email already exists — sign in instead."); }
    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    const account = { email: cleanEmail, displayName: displayName.trim(), salt, hash, createdAt: Date.now() };
    await sSet(`account:${cleanEmail}`, account, true);
    const directory = (await sGet("directory", true)) || [];
    directory.push({ email: cleanEmail, displayName: account.displayName });
    await sSet("directory", directory, true);
    await completeLogin(cleanEmail, account.displayName);
  };

  const signin = async ({ email, password }) => {
    setAuthError("");
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) return setAuthError("Enter a valid email address.");
    if (!password) return setAuthError("Enter your password.");
    setAuthBusy(true);
    const account = await sGet(`account:${cleanEmail}`, true);
    if (!account) { setAuthBusy(false); return setAuthError("No account found for that email."); }
    const hash = await hashPassword(password, account.salt);
    if (hash !== account.hash) { setAuthBusy(false); return setAuthError("Incorrect password."); }
    await completeLogin(cleanEmail, account.displayName);
  };

  const completeLogin = async (email, displayName) => {
    const prog = (await sGet(`progress:${email}`, true)) || {};
    let td = (await sGet(`todo:${email}`, true)) || [];
    // Migrate the old { outcomeId, done } shape to the new scheduling shape.
    td = td.map((x) => (x.type ? x : { id: uid(), type: "outcome", refId: x.outcomeId, dueDate: null, done: !!x.done }));
    const pinned = (await sGet(`pinned:${email}`, true)) || [];
    progressRef.current = prog;
    todoRef.current = td;
    pinnedRef.current = pinned;
    setProgress(prog);
    setTodo(td);
    setPinnedSubjects(pinned);
    setUser({ email, displayName });
    setAuthBusy(false);
    await sSet("session", { email }, false);
  };

  const logout = async () => {
    setUser(null); setProgress({}); setTodo([]); setPinnedSubjects([]); setTab("map"); setAuthError("");
    setMapPath({ subjectId: null, topicId: null, subtopicId: null });
    progressRef.current = {}; todoRef.current = []; pinnedRef.current = [];
    await sSet("session", null, false);
  };

  /* ---- tree mutations (all go through the ref so concurrent edits never clobber each other) ---- */
  const saveTree = async (updater) => {
    const base = treeRef.current;
    const next = typeof updater === "function" ? updater(base) : updater;
    treeRef.current = next;
    setTree(next);
    await sSet("tree", next, true);
  };
  const addSubject = (name) => saveTree((t) => ({ ...t, subjects: [...t.subjects, { id: uid(), name }] }));
  const addTopic = (subjectId, name) => saveTree((t) => ({ ...t, topics: [...t.topics, { id: uid(), subjectId, name }] }));
  const addSubtopic = (topicId, name) => saveTree((t) => ({ ...t, subtopics: [...t.subtopics, { id: uid(), topicId, name }] }));
  const addOutcome = (subtopicId, name) => saveTree((t) => ({ ...t, outcomes: [...t.outcomes, { id: uid(), subtopicId, name }] }));
  const setTopicColor = (topicId, color) => saveTree((t) => ({ ...t, topics: t.topics.map((x) => (x.id === topicId ? { ...x, color } : x)) }));
  const setSubtopicColor = (subtopicId, color) => saveTree((t) => ({ ...t, subtopics: t.subtopics.map((x) => (x.id === subtopicId ? { ...x, color } : x)) }));
  const setNotesTopicColor = (notesTopicId, color) => saveTree((t) => ({ ...t, notesTopics: t.notesTopics.map((x) => (x.id === notesTopicId ? { ...x, color } : x)) }));

  // Topics created from Notes stay notes-only unless their creator chooses to add
  // them to the Map — no one else needs to approve or can promote someone else's.
  const createNotesTopic = (subjectId, name) => saveTree((t) => ({
    ...t,
    notesTopics: [...t.notesTopics, { id: uid(), subjectId, name, createdBy: user.email, createdByName: user.displayName, ts: Date.now() }],
  }));
  const promoteNotesTopic = (notesTopicId) => {
    const p = treeRef.current.notesTopics.find((x) => x.id === notesTopicId);
    if (!p || p.createdBy !== user.email) return;
    saveTree((t) => ({
      ...t,
      topics: [...t.topics, { id: p.id, subjectId: p.subjectId, name: p.name, color: p.color }],
      notesTopics: t.notesTopics.filter((x) => x.id !== notesTopicId),
    }));
  };
  const removeNotesTopic = (notesTopicId) => {
    const p = treeRef.current.notesTopics.find((x) => x.id === notesTopicId);
    if (!p || p.createdBy !== user.email) return;
    saveTree((t) => ({ ...t, notesTopics: t.notesTopics.filter((x) => x.id !== notesTopicId) }));
  };
  const setNotesSubtopicColor = (notesSubtopicId, color) => saveTree((t) => ({ ...t, notesSubtopics: t.notesSubtopics.map((x) => (x.id === notesSubtopicId ? { ...x, color } : x)) }));

  // Same idea one level down: a subtopic added from Notes under a topic that's
  // already on the Map asks its creator whether to push it to the Map too.
  // (Subtopics added under a notes-only topic skip this — see NotesTab — since
  // there's no map position for them to go to until their parent topic is added.)
  const createNotesSubtopic = (topicId, name) => saveTree((t) => ({
    ...t,
    notesSubtopics: [...t.notesSubtopics, { id: uid(), topicId, name, createdBy: user.email, createdByName: user.displayName, ts: Date.now() }],
  }));
  const promoteNotesSubtopic = (notesSubtopicId) => {
    const p = treeRef.current.notesSubtopics.find((x) => x.id === notesSubtopicId);
    if (!p || p.createdBy !== user.email) return;
    saveTree((t) => ({
      ...t,
      subtopics: [...t.subtopics, { id: p.id, topicId: p.topicId, name: p.name, color: p.color }],
      notesSubtopics: t.notesSubtopics.filter((x) => x.id !== notesSubtopicId),
    }));
  };
  const removeNotesSubtopic = (notesSubtopicId) => {
    const p = treeRef.current.notesSubtopics.find((x) => x.id === notesSubtopicId);
    if (!p || p.createdBy !== user.email) return;
    saveTree((t) => ({ ...t, notesSubtopics: t.notesSubtopics.filter((x) => x.id !== notesSubtopicId) }));
  };

  /* ---- progress ---- */
  const setOutcomeStatus = async (outcomeId, status) => {
    const next = { ...progressRef.current, [outcomeId]: { ...(progressRef.current[outcomeId] || {}), status } };
    progressRef.current = next;
    setProgress(next);
    await sSet(`progress:${user.email}`, next, true);
  };
  const setOutcomeComment = async (outcomeId, comment) => {
    const next = { ...progressRef.current, [outcomeId]: { ...(progressRef.current[outcomeId] || {}), comment } };
    progressRef.current = next;
    setProgress(next);
    await sSet(`progress:${user.email}`, next, true);
  };

  /* ---- schedule (to-do, with optional due dates, for outcomes or whole subtopics) ---- */
  const scheduleItem = async (type, refId, dueDate = null) => {
    if (todoRef.current.some((x) => x.type === type && x.refId === refId)) return;
    const next = [...todoRef.current, { id: uid(), type, refId, dueDate, done: false }];
    todoRef.current = next;
    setTodo(next);
    await sSet(`todo:${user.email}`, next, true);
  };
  const unscheduleByRef = async (type, refId) => {
    const next = todoRef.current.filter((x) => !(x.type === type && x.refId === refId));
    todoRef.current = next;
    setTodo(next);
    await sSet(`todo:${user.email}`, next, true);
  };
  const toggleSchedule = async (id) => {
    const next = todoRef.current.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
    todoRef.current = next;
    setTodo(next);
    await sSet(`todo:${user.email}`, next, true);
  };
  const removeSchedule = async (id) => {
    const next = todoRef.current.filter((x) => x.id !== id);
    todoRef.current = next;
    setTodo(next);
    await sSet(`todo:${user.email}`, next, true);
  };
  const setScheduleDueDate = async (id, dueDate) => {
    const next = todoRef.current.map((x) => (x.id === id ? { ...x, dueDate } : x));
    todoRef.current = next;
    setTodo(next);
    await sSet(`todo:${user.email}`, next, true);
  };
  // A task you write yourself, not tied to any outcome or subtopic on the map.
  const addCustomTask = async (label) => {
    const next = [...todoRef.current, { id: uid(), type: "custom", label, dueDate: null, done: false }];
    todoRef.current = next;
    setTodo(next);
    await sSet(`todo:${user.email}`, next, true);
  };

  // Pinned subjects are per-account and just reorder the subject strip in
  // Map, Notes, and Personal — they don't affect anyone else's view.
  const togglePinSubject = async (subjectId) => {
    const has = pinnedRef.current.includes(subjectId);
    const next = has ? pinnedRef.current.filter((id) => id !== subjectId) : [...pinnedRef.current, subjectId];
    pinnedRef.current = next;
    setPinnedSubjects(next);
    await sSet(`pinned:${user.email}`, next, true);
  };
  const isPinned = (subjectId) => pinnedSubjects.includes(subjectId);
  const sortedSubjects = () => {
    const pinnedOnes = tree.subjects.filter((s) => pinnedSubjects.includes(s.id));
    const rest = tree.subjects.filter((s) => !pinnedSubjects.includes(s.id));
    return [...pinnedOnes, ...rest];
  };

  /* ---- collaborative & personal notes: just key builders now — RichEditor
     owns its own load/save/poll cycle per document (see above) ---- */
  const notesKey = (type, id) => `notes:${type}:${id}`;
  const resourcesKey = (type, id) => `resources:${type}:${id}`;
  const pnotesKey = (type, id) => `pnotes:${user.email}:${type}:${id}`;

  /* ---- leaderboard ---- */
  const loadLeaderboard = useCallback(async (scope) => {
    setLbData(null);
    const directory = (await sGet("directory", true)) || [];
    let outcomeFilter = null;
    if (scope !== "overall") {
      const topicIds = new Set(tree.topics.filter((t) => t.subjectId === scope).map((t) => t.id));
      const subIds = new Set(tree.subtopics.filter((st) => topicIds.has(st.topicId)).map((st) => st.id));
      outcomeFilter = new Set(tree.outcomes.filter((o) => subIds.has(o.subtopicId)).map((o) => o.id));
    }
    const rows = await Promise.all(directory.map(async (d) => {
      const p = (await sGet(`progress:${d.email}`, true)) || {};
      let count = 0;
      for (const [oid, v] of Object.entries(p)) {
        if (v.status !== "green") continue;
        if (outcomeFilter && !outcomeFilter.has(oid)) continue;
        count++;
      }
      return { name: d.displayName, email: d.email, count };
    }));
    rows.sort((a, b) => b.count - a.count);
    setLbData(rows);
  }, [tree]);

  useEffect(() => { if (tab === "leaderboard" && user) loadLeaderboard(lbScope); }, [tab, lbScope, user, loadLeaderboard]);

  /* ---- derived lookups ---- */
  const topicsOf = (subjectId) => tree.topics.filter((t) => t.subjectId === subjectId);
  const subtopicsOf = (topicId) => tree.subtopics.filter((s) => s.topicId === topicId);
  const outcomesOf = (subtopicId) => tree.outcomes.filter((o) => o.subtopicId === subtopicId);
  const notesTopicsOf = (subjectId) => tree.notesTopics.filter((p) => p.subjectId === subjectId);
  const notesSubtopicsOf = (topicId) => tree.notesSubtopics.filter((p) => p.topicId === topicId);
  const findSubject = (id) => tree.subjects.find((s) => s.id === id);
  const findTopic = (id) => tree.topics.find((t) => t.id === id);
  const findSubtopic = (id) => tree.subtopics.find((s) => s.id === id);
  const outcomeBreadcrumb = (outcomeId) => {
    const o = tree.outcomes.find((x) => x.id === outcomeId);
    if (!o) return ["Unknown"];
    const st = findSubtopic(o.subtopicId);
    const t = st && findTopic(st.topicId);
    const s = t && findSubject(t.subjectId);
    return [s?.name || "?", t?.name || "?", st?.name || "?", o.name];
  };

  /* ---------------------------------------------------------- */

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.bg }}>
        <Loader2 className="animate-spin" color={theme.textMuted} size={22} />
      </div>
    );
  }
  if (!user) return <AuthScreen theme={theme} onSignup={signup} onSignin={signin} error={authError} busy={authBusy} />;

  /* ---- MAP TAB ---- */
  function MapTab() {
    const { subjectId, topicId, subtopicId } = mapPath;
    const subject = findSubject(subjectId);
    const topic = findTopic(topicId);
    const subtopic = findSubtopic(subtopicId);

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          <SubjectTabStrip theme={theme} subjects={sortedSubjects()} activeId={subjectId} accent={theme.accent}
            onSelect={(id) => setMapPath({ subjectId: id, topicId: null, subtopicId: null })}
            isPinned={isPinned} onTogglePin={togglePinSubject} />
          <div style={{ alignSelf: "center", marginLeft: 4 }}>
            <AddTile theme={theme} label="Add subject" onAdd={addSubject} />
          </div>
        </div>

        {!subject && <EmptyHint theme={theme} text="Pick a subject above, or add a new one, to see its topics." />}

        {subject && !topic && (
          <>
            <Breadcrumb theme={theme} items={[subject.name]} onJump={() => {}} />
            <Grid>
              {topicsOf(subject.id).map((t) => (
                <GridCard key={t.id} theme={theme} title={t.name}
                  sub={`${subtopicsOf(t.id).length} subtopic${subtopicsOf(t.id).length === 1 ? "" : "s"}`}
                  color={t.color}
                  onColorChange={(c) => setTopicColor(t.id, c)}
                  onClick={() => setMapPath({ subjectId: subject.id, topicId: t.id, subtopicId: null })} />
              ))}
              <AddTile theme={theme} label="Add topic" onAdd={(name) => addTopic(subject.id, name)} />
            </Grid>
          </>
        )}

        {subject && topic && !subtopic && (
          <>
            <Breadcrumb theme={theme} items={[subject.name, topic.name]}
              onJump={(i) => i === 0 && setMapPath({ subjectId: subject.id, topicId: null, subtopicId: null })} />
            <Grid>
              {subtopicsOf(topic.id).map((st) => {
                const outs = outcomesOf(st.id);
                const done = outs.filter((o) => progress[o.id]?.status === "green").length;
                const inSchedule = todo.some((x) => x.type === "subtopic" && x.refId === st.id);
                return (
                  <GridCard key={st.id} theme={theme} title={st.name}
                    sub={`${done}/${outs.length} confident`}
                    color={st.color}
                    onColorChange={(c) => setSubtopicColor(st.id, c)}
                    schedule={{
                      active: inSchedule,
                      title: inSchedule ? "Remove whole subtopic from schedule" : "Schedule whole subtopic",
                      onToggle: () => (inSchedule ? unscheduleByRef("subtopic", st.id) : scheduleItem("subtopic", st.id)),
                    }}
                    onClick={() => setMapPath({ subjectId: subject.id, topicId: topic.id, subtopicId: st.id })} />
                );
              })}
              <AddTile theme={theme} label="Add subtopic" onAdd={(name) => addSubtopic(topic.id, name)} />
            </Grid>
          </>
        )}

        {subject && topic && subtopic && (
          <>
            <Breadcrumb theme={theme} items={[subject.name, topic.name, subtopic.name]}
              onJump={(i) => {
                if (i === 0) setMapPath({ subjectId: subject.id, topicId: null, subtopicId: null });
                if (i === 1) setMapPath({ subjectId: subject.id, topicId: topic.id, subtopicId: null });
              }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {outcomesOf(subtopic.id).map((o) => (
                <OutcomeRow key={o.id} theme={theme} outcome={o}
                  status={progress[o.id]?.status || null}
                  comment={progress[o.id]?.comment || ""}
                  onStatus={(s) => setOutcomeStatus(o.id, s)}
                  onComment={(c) => setOutcomeComment(o.id, c)}
                  onToggleSchedule={() => (todo.some((x) => x.type === "outcome" && x.refId === o.id)
                    ? unscheduleByRef("outcome", o.id)
                    : scheduleItem("outcome", o.id))}
                  inSchedule={todo.some((x) => x.type === "outcome" && x.refId === o.id)} />
              ))}
              <AddTile theme={theme} label="Add outcome" wide onAdd={(name) => addOutcome(subtopic.id, name)} />
            </div>
          </>
        )}
      </div>
    );
  }

  /* ---- NOTES TAB (collaborative) ---- */
  function NotesTab() {
    const { subjectId, topicId, subtopicId, notesOnlyId, notesOnlySubtopicId } = notesPath;
    const subject = findSubject(subjectId);
    const topic = findTopic(topicId);
    const subtopic = findSubtopic(subtopicId);
    const notesOnlyItem = notesOnlyId ? tree.notesTopics.find((p) => p.id === notesOnlyId) : null;
    const notesOnlySubtopicItem = notesOnlySubtopicId ? tree.notesSubtopics.find((p) => p.id === notesOnlySubtopicId) : null;

    // Merge real topics and notes-only topics into one list, tagging the latter.
    const combinedTopics = subject
      ? [
          ...topicsOf(subject.id).map((t) => ({ ...t, _notesOnly: false })),
          ...notesTopicsOf(subject.id).map((p) => ({ ...p, _notesOnly: true })),
        ]
      : [];
    // Same merge one level down — only meaningful under a real (on-map) topic,
    // since a notes-only topic's subtopics are all notes-only by definition.
    const combinedSubtopics = topic
      ? [
          ...subtopicsOf(topic.id).map((s) => ({ ...s, _notesOnly: false })),
          ...notesSubtopicsOf(topic.id).map((p) => ({ ...p, _notesOnly: true })),
        ]
      : [];

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          <SubjectTabStrip theme={theme} subjects={sortedSubjects()} activeId={subjectId} accent={theme.gold}
            onSelect={(id) => setNotesPath({ subjectId: id, topicId: null, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null })}
            isPinned={isPinned} onTogglePin={togglePinSubject} />
        </div>

        {!subject && <EmptyHint theme={theme} text="Pick a subject to browse or add collaborative notes." />}

        {subject && !topic && !notesOnlyItem && (
          <>
            <Breadcrumb theme={theme} items={[subject.name]} onJump={() => {}} />
            <Grid>
              {combinedTopics.map((t) => (
                <GridCard key={t.id} theme={theme} title={t.name}
                  badge={t._notesOnly ? "Notes only" : null}
                  sub={t._notesOnly ? "No map outcomes — notes only" : `${subtopicsOf(t.id).length} subtopic${subtopicsOf(t.id).length === 1 ? "" : "s"}`}
                  color={t.color}
                  onColorChange={(c) => (t._notesOnly ? setNotesTopicColor(t.id, c) : setTopicColor(t.id, c))}
                  onClick={() => (t._notesOnly
                    ? setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: null, notesOnlyId: t.id, notesOnlySubtopicId: null })
                    : setNotesPath({ subjectId: subject.id, topicId: t.id, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null }))} />
              ))}
              <AddNodeWithConfirm theme={theme} nodeLabel="topic"
                onAddToMap={(name) => addTopic(subject.id, name)}
                onNotesOnly={(name) => createNotesTopic(subject.id, name)} />
            </Grid>
          </>
        )}

        {subject && notesOnlyItem && !subtopic && (
          <>
            <Breadcrumb theme={theme} items={[subject.name, notesOnlyItem.name]}
              onJump={(i) => i === 0 && setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null })} />
            <NotesOnlyNodeCard item={notesOnlyItem} kind="topic" />
            {/* Subtopics under a notes-only topic have nowhere on the Map to go yet,
                so adding one here never asks — it's added directly, and will show up
                on the Map automatically if/when this topic itself gets promoted. */}
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.textMuted, marginBottom: 10 }}>Subtopics</div>
              <Grid>
                {subtopicsOf(notesOnlyItem.id).map((st) => (
                  <GridCard key={st.id} theme={theme} title={st.name}
                    sub="Notes only — parent topic isn't on the map"
                    color={st.color}
                    onColorChange={(c) => setSubtopicColor(st.id, c)}
                    onClick={() => setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: st.id, notesOnlyId: notesOnlyItem.id, notesOnlySubtopicId: null })} />
                ))}
                <AddTile theme={theme} label="Add subtopic" onAdd={(name) => addSubtopic(notesOnlyItem.id, name)} />
              </Grid>
            </div>
          </>
        )}

        {subject && notesOnlyItem && subtopic && (
          <>
            <Breadcrumb theme={theme} items={[subject.name, notesOnlyItem.name, subtopic.name]}
              onJump={(i) => {
                if (i === 0) setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null });
                if (i === 1) setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: null, notesOnlyId: notesOnlyItem.id, notesOnlySubtopicId: null });
              }} />
            <NotesPanel type="subtopic" id={subtopic.id} />
          </>
        )}

        {subject && topic && !subtopic && !notesOnlySubtopicItem && (
          <>
            <Breadcrumb theme={theme} items={[subject.name, topic.name]}
              onJump={(i) => i === 0 && setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null })} />
            <NotesPanel type="topic" id={topic.id} />
            <div style={{ marginTop: 22 }}>
              <Grid>
                {combinedSubtopics.map((st) => (
                  <GridCard key={st.id} theme={theme} title={st.name}
                    badge={st._notesOnly ? "Notes only" : null}
                    sub={st._notesOnly ? "No map outcomes — notes only" : `${outcomesOf(st.id).length} outcomes`}
                    color={st.color}
                    onColorChange={(c) => (st._notesOnly ? setNotesSubtopicColor(st.id, c) : setSubtopicColor(st.id, c))}
                    onClick={() => (st._notesOnly
                      ? setNotesPath({ subjectId: subject.id, topicId: topic.id, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: st.id })
                      : setNotesPath({ subjectId: subject.id, topicId: topic.id, subtopicId: st.id, notesOnlyId: null, notesOnlySubtopicId: null }))} />
                ))}
                <AddNodeWithConfirm theme={theme} nodeLabel="subtopic"
                  onAddToMap={(name) => addSubtopic(topic.id, name)}
                  onNotesOnly={(name) => createNotesSubtopic(topic.id, name)} />
              </Grid>
            </div>
          </>
        )}

        {subject && topic && notesOnlySubtopicItem && (
          <>
            <Breadcrumb theme={theme} items={[subject.name, topic.name, notesOnlySubtopicItem.name]}
              onJump={(i) => {
                if (i === 0) setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null });
                if (i === 1) setNotesPath({ subjectId: subject.id, topicId: topic.id, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null });
              }} />
            <NotesOnlyNodeCard item={notesOnlySubtopicItem} kind="subtopic" />
          </>
        )}

        {subject && topic && subtopic && (
          <>
            <Breadcrumb theme={theme} items={[subject.name, topic.name, subtopic.name]}
              onJump={(i) => {
                if (i === 0) setNotesPath({ subjectId: subject.id, topicId: null, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null });
                if (i === 1) setNotesPath({ subjectId: subject.id, topicId: topic.id, subtopicId: null, notesOnlyId: null, notesOnlySubtopicId: null });
              }} />
            <Btn theme={theme} variant="subtle" onClick={() => setShowOutcomesInNotes((v) => !v)} style={{ marginBottom: 14 }}>
              {showOutcomesInNotes ? <EyeOff size={13} /> : <Eye size={13} />}
              {showOutcomesInNotes ? "Hide outcomes" : "Show outcomes"}
            </Btn>
            {showOutcomesInNotes && (
              <div style={{
                border: `1px solid ${theme.border}`, borderRadius: 8, padding: 12, marginBottom: 18,
                background: theme.surfaceAlt, display: "flex", flexDirection: "column", gap: 6,
              }}>
                {outcomesOf(subtopic.id).map((o) => (
                  <div key={o.id} style={{ fontSize: 13, color: theme.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: progress[o.id]?.status ? theme[progress[o.id].status] : theme.border,
                    }} />
                    {o.name}
                  </div>
                ))}
                {outcomesOf(subtopic.id).length === 0 && <span style={{ fontSize: 13, color: theme.textMuted }}>No outcomes added yet.</span>}
              </div>
            )}
            <NotesPanel type="subtopic" id={subtopic.id} />
          </>
        )}
      </div>
    );
  }

  // A topic or subtopic created from Notes that its creator hasn't chosen to add
  // to the Map yet. Anyone can discuss it here; only its creator sees the option
  // to add or remove it. `kind` is "topic" or "subtopic" — both share the same
  // notesKey scheme, just a different promote/remove pair and notes type.
  function NotesOnlyNodeCard({ item, kind }) {
    const isCreator = item.createdBy === user.email;
    const promote = kind === "topic" ? promoteNotesTopic : promoteNotesSubtopic;
    const remove = kind === "topic" ? removeNotesTopic : removeNotesSubtopic;
    return (
      <div style={{ border: `1px dashed ${theme.gold}`, borderRadius: 10, padding: 16, background: theme.goldSoft }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: FONT_HEAD, fontSize: 15.5, color: theme.text, flex: 1 }}>{item.name}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: theme.gold, background: theme.surface, borderRadius: 4, padding: "2px 6px" }}>Notes only</span>
          {isCreator && (
            <>
              <Btn theme={theme} variant="gold" onClick={() => promote(item.id)}><Check size={13} /> Add to map</Btn>
              <Btn theme={theme} onClick={() => remove(item.id)} title="Remove"><Trash2 size={13} /></Btn>
            </>
          )}
        </div>
        <NotesPanel type={kind} id={item.id} />
      </div>
    );
  }

  // Adding a topic or subtopic from Notes asks its creator, right away, whether
  // it should also go on the Map — no one else's confirmation is needed either way.
  function AddNodeWithConfirm({ theme, nodeLabel, onAddToMap, onNotesOnly }) {
    const [step, setStep] = useState("idle"); // idle | typing | confirm
    const [name, setName] = useState("");

    if (step === "confirm") {
      return (
        <div style={{
          border: `1.5px solid ${theme.gold}`, borderRadius: 8, padding: 12, minWidth: 220,
          background: theme.goldSoft, display: "flex", flexDirection: "column", gap: 8,
        }}>
          <span style={{ fontSize: 13, color: theme.text, lineHeight: 1.4 }}>
            Add <strong>"{name}"</strong> to the map too, or keep it in Notes only?
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Btn theme={theme} variant="gold" onClick={() => { onAddToMap(name); setName(""); setStep("idle"); }}>
              <Check size={13} /> Add to map
            </Btn>
            <Btn theme={theme} variant="subtle" onClick={() => { onNotesOnly(name); setName(""); setStep("idle"); }}>
              Notes only
            </Btn>
          </div>
        </div>
      );
    }
    if (step === "typing") {
      return (
        <div style={{
          border: `1.5px dashed ${theme.accent}`, borderRadius: 8, padding: 12, minWidth: 180,
          background: theme.surfaceAlt, display: "flex", flexDirection: "column", gap: 8,
        }}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) setStep("confirm");
              if (e.key === "Escape") setStep("idle");
            }}
            placeholder={`New ${nodeLabel} name`}
            style={{
              fontFamily: FONT_BODY, fontSize: 13, padding: "6px 8px", borderRadius: 5,
              border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, outline: "none",
            }} />
          <div style={{ display: "flex", gap: 6 }}>
            <Btn theme={theme} variant="solid" onClick={() => name.trim() && setStep("confirm")}><Check size={13} /> Next</Btn>
            <Btn theme={theme} onClick={() => setStep("idle")}><X size={13} /></Btn>
          </div>
        </div>
      );
    }
    return (
      <button onClick={() => setStep("typing")} style={{
        border: `1.5px dashed ${theme.border}`, borderRadius: 8, padding: 12, minWidth: 180, minHeight: 64,
        background: "transparent", color: theme.textMuted, cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center", gap: 6, fontFamily: FONT_BODY, fontSize: 13,
      }}>
        <Plus size={15} /> Add {nodeLabel}
      </button>
    );
  }

  function NotesPanel({ type, id }) {
    const [view, setView] = useState("notes");
    const key = notesKey(type, id);
    const resKey = resourcesKey(type, id);
    return (
      <div>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          <button onClick={() => setView("notes")} style={{
            fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, padding: "6px 14px", cursor: "pointer",
            border: "none", borderBottom: view === "notes" ? `2px solid ${theme.accent}` : "2px solid transparent",
            background: "transparent", color: view === "notes" ? theme.text : theme.textMuted,
          }}>Notes</button>
          <button onClick={() => setView("resources")} style={{
            fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 600, padding: "6px 14px", cursor: "pointer",
            border: "none", borderBottom: view === "resources" ? `2px solid ${theme.accent}` : "2px solid transparent",
            background: "transparent", color: view === "resources" ? theme.text : theme.textMuted,
          }}>Resources</button>
        </div>
        {view === "notes" && (
          <RichEditor key={key} theme={theme} storageKey={key} icon={NotebookText} label="Collaborative notes"
            emptyHint="Nothing here yet. Start typing!"
            katexReady={katexReady} mathliveReady={mathliveReady} />
        )}
        {view === "resources" && <ResourceList key={resKey} theme={theme} storageKey={resKey} user={user} />}
      </div>
    );
  }

  function PersonalNotesPanel({ type, id }) {
    const key = pnotesKey(type, id);
    return (
      <RichEditor key={key} theme={theme} storageKey={key} icon={StickyNote} label="Your private notes"
        emptyHint="Nothing here yet. Start typing!"
        privateNote
        katexReady={katexReady} mathliveReady={mathliveReady} />
    );
  }

  /* ---- PERSONAL TAB (private schedule + private notes, mirrors the map/notes tree) ---- */
  function PersonalTab() {
    // NOTE: this used to be `const [section, setSection] = useState("schedule")` here,
    // but PersonalTab is redefined on every StudyMapApp render (it's a nested function),
    // so React treated it as a brand-new component each time and remounted it — silently
    // resetting local state back to its initial value. Using state lifted to the parent
    // (personalSection/setPersonalSection) fixes that, since it isn't tied to this
    // component's identity.
    const section = personalSection, setSection = setPersonalSection;
    const { subjectId, topicId, subtopicId } = personalPath;
    const subject = findSubject(subjectId);
    const topic = findTopic(topicId);
    const subtopic = findSubtopic(subtopicId);

    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <Btn theme={theme} variant={section === "schedule" ? "solid" : "subtle"} onClick={() => setSection("schedule")}>
            <ListChecks size={13} /> Schedule
          </Btn>
          <Btn theme={theme} variant={section === "notes" ? "solid" : "subtle"} onClick={() => setSection("notes")}>
            <StickyNote size={13} /> My notes
          </Btn>
        </div>

        {section === "schedule" && <ScheduleTab />}

        {section === "notes" && (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              <SubjectTabStrip theme={theme} subjects={sortedSubjects()} activeId={subjectId} accent={theme.accent}
                onSelect={(id) => setPersonalPath({ subjectId: id, topicId: null, subtopicId: null })}
                isPinned={isPinned} onTogglePin={togglePinSubject} />
            </div>

            {!subject && <EmptyHint theme={theme} text="Pick a subject to write private notes for its topics and subtopics." />}

            {subject && !topic && (
              <>
                <Breadcrumb theme={theme} items={[subject.name]} onJump={() => {}} />
                <Grid>
                  {topicsOf(subject.id).map((t) => (
                    <GridCard key={t.id} theme={theme} title={t.name}
                      sub={`${subtopicsOf(t.id).length} subtopic${subtopicsOf(t.id).length === 1 ? "" : "s"}`}
                      color={t.color}
                      onClick={() => setPersonalPath({ subjectId: subject.id, topicId: t.id, subtopicId: null })} />
                  ))}
                </Grid>
                {topicsOf(subject.id).length === 0 && <EmptyHint theme={theme} text="No topics on the map for this subject yet." />}
              </>
            )}

            {subject && topic && !subtopic && (
              <>
                <Breadcrumb theme={theme} items={[subject.name, topic.name]}
                  onJump={(i) => i === 0 && setPersonalPath({ subjectId: subject.id, topicId: null, subtopicId: null })} />
                <PersonalNotesPanel type="topic" id={topic.id} />
                <div style={{ marginTop: 22 }}>
                  <Grid>
                    {subtopicsOf(topic.id).map((st) => (
                      <GridCard key={st.id} theme={theme} title={st.name}
                        sub={`${outcomesOf(st.id).length} outcomes`}
                        color={st.color}
                        onClick={() => setPersonalPath({ subjectId: subject.id, topicId: topic.id, subtopicId: st.id })} />
                    ))}
                  </Grid>
                </div>
              </>
            )}

            {subject && topic && subtopic && (
              <>
                <Breadcrumb theme={theme} items={[subject.name, topic.name, subtopic.name]}
                  onJump={(i) => {
                    if (i === 0) setPersonalPath({ subjectId: subject.id, topicId: null, subtopicId: null });
                    if (i === 1) setPersonalPath({ subjectId: subject.id, topicId: topic.id, subtopicId: null });
                  }} />
                <PersonalNotesPanel type="subtopic" id={subtopic.id} />
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---- LEADERBOARD TAB ---- */
  function LeaderboardTab() {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Trophy size={16} color={theme.gold} />
          <select value={lbScope} onChange={(e) => setLbScope(e.target.value)}
            style={{
              fontFamily: FONT_BODY, fontSize: 13.5, padding: "6px 10px", borderRadius: 6,
              border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text,
            }}>
            <option value="overall">Overall</option>
            {tree.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {!lbData && <span style={{ fontSize: 13, color: theme.textMuted }}>Loading standings…</span>}
        {lbData && lbData.length === 0 && <EmptyHint theme={theme} text="No one has logged any progress yet." />}
        {lbData && lbData.length > 0 && (
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, overflow: "hidden", background: theme.surface }}>
            {lbData.map((row, i) => (
              <div key={row.email} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 18px",
                borderBottom: i < lbData.length - 1 ? `1px solid ${theme.border}` : "none",
                background: row.email === user.email ? theme.accentSoft : "transparent",
              }}>
                <span style={{ fontFamily: FONT_HEAD, fontSize: 16, color: theme.textMuted, width: 24 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: row.email === user.email ? 700 : 500, color: theme.text }}>
                  {row.name}{row.email === user.email ? " (you)" : ""}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: theme.accent }}>{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ---- SCHEDULE TAB (outcomes and/or whole subtopics, with due dates) ---- */
  function ScheduleTab() {
    const [customDraft, setCustomDraft] = useState("");
    const label = (item) => {
      if (item.type === "outcome") {
        const crumb = outcomeBreadcrumb(item.refId);
        return { title: crumb[3], path: `${crumb[0]} › ${crumb[1]} › ${crumb[2]}` };
      }
      if (item.type === "custom") {
        return { title: item.label, path: "Your own task" };
      }
      const st = findSubtopic(item.refId);
      const t = st && findTopic(st.topicId);
      const s = t && findSubject(t.subjectId);
      return { title: st ? `${st.name} — all outcomes` : "Unknown subtopic", path: `${s?.name || "?"} › ${t?.name || "?"}` };
    };
    const sorted = [...todo].sort((a, b) => {
      if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    });
    const submitCustom = () => {
      const v = customDraft.trim();
      if (!v) return;
      addCustomTask(v);
      setCustomDraft("");
    };
    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={customDraft} onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitCustom()}
            placeholder="Add your own task…"
            style={{
              flex: 1, fontFamily: FONT_BODY, fontSize: 13, padding: "8px 10px", borderRadius: 6,
              border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text, outline: "none",
            }} />
          <Btn theme={theme} variant="solid" onClick={submitCustom}><Plus size={13} /> Add task</Btn>
        </div>
        {todo.length === 0 && <EmptyHint theme={theme} text="Nothing scheduled yet. Add outcomes or whole subtopics from the Map tab, or write your own task above." />}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((item) => {
            const { title, path } = label(item);
            const overdue = item.dueDate && !item.done && item.dueDate < todayISO();
            return (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface,
              }}>
                <button onClick={() => toggleSchedule(item.id)} style={{
                  width: 20, height: 20, borderRadius: 5, border: `1.5px solid ${theme.accent}`,
                  background: item.done ? theme.accent : "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {item.done && <Check size={13} color="#fff" />}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14, color: theme.text,
                    textDecoration: item.done ? "line-through" : "none",
                    opacity: item.done ? 0.55 : 1,
                  }}>{title}</div>
                  <div style={{ fontSize: 11.5, color: overdue ? theme.red : theme.textMuted, marginTop: 2 }}>
                    {path}{overdue ? " · overdue" : ""}
                  </div>
                </div>
                <input type="date" value={item.dueDate || ""} onChange={(e) => setScheduleDueDate(item.id, e.target.value || null)}
                  style={{
                    fontFamily: FONT_BODY, fontSize: 12, padding: "4px 6px", borderRadius: 5,
                    border: `1px solid ${theme.border}`, background: theme.surfaceAlt, color: theme.text,
                  }} />
                <button onClick={() => removeSchedule(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---- outcome row (used in Map) ---- */
  function OutcomeRow({ theme, outcome, status, comment, onStatus, onComment, onToggleSchedule, inSchedule }) {
    const [showComment, setShowComment] = useState(false);
    const [draft, setDraft] = useState(comment);
    return (
      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: "12px 14px", background: theme.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <TrafficLight theme={theme} status={status} onSet={onStatus} />
          <span style={{ flex: 1, fontSize: 14, color: theme.text }}>{outcome.name}</span>
          <button onClick={() => setShowComment((v) => !v)} title="Notes on what to study next"
            style={{ background: "none", border: "none", cursor: "pointer", color: comment ? theme.gold : theme.textMuted }}>
            <StickyNote size={15} />
          </button>
          <button onClick={onToggleSchedule} title={inSchedule ? "Remove from schedule" : "Add to schedule"}
            style={{ background: "none", border: "none", cursor: "pointer", color: inSchedule ? theme.accent : theme.textMuted }}>
            {inSchedule ? <Check size={15} /> : <Plus size={15} />}
          </button>
        </div>
        {showComment && (
          <div style={{ marginTop: 10 }}>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
              onBlur={() => onComment(draft)}
              placeholder="What to study next for this outcome…"
              rows={2}
              style={{
                width: "100%", boxSizing: "border-box", fontFamily: FONT_BODY, fontSize: 13,
                padding: "8px 10px", borderRadius: 6, border: `1px solid ${theme.border}`,
                background: theme.surfaceAlt, color: theme.text, outline: "none", resize: "vertical",
              }} />
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------- */

  const NAV = [
    { key: "map", label: "Map", icon: MapIcon },
    { key: "notes", label: "Notes", icon: NotebookText },
    { key: "personal", label: "Personal", icon: StickyNote },
    { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, fontFamily: FONT_BODY, paddingBottom: 64 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .sm-doc { font-family: ${FONT_BODY}; }
        .sm-doc h2, .sm-doc h3, .sm-doc h4 { font-family: ${FONT_HEAD}; font-weight: 600; margin: 14px 0 6px; }
        .sm-doc h2 { font-size: 22px; } .sm-doc h3 { font-size: 19px; } .sm-doc h4 { font-size: 17px; }
        .sm-doc p { margin: 6px 0; }
        .sm-doc ul, .sm-doc ol { margin: 6px 0; padding-left: 20px; }
        .sm-doc blockquote { border-left: 3px solid var(--sm-quote, #999); margin: 8px 0; padding-left: 10px; font-style: italic; opacity: 0.85; }
        .sm-doc code { background: var(--sm-code-bg, rgba(127,127,127,.18)); padding: 1px 5px; border-radius: 4px; font-size: 0.9em; font-family: ${FONT_MONO}; }
        .sm-doc a { color: var(--sm-link, inherit); text-decoration: underline; text-underline-offset: 2px; }
        .sm-doc .sm-mathblock { margin: 10px 0; overflow-x: auto; }
        .sm-doc:empty:before { content: ""; }
      `}</style>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: `1px solid ${theme.border}`, background: theme.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 22, background: theme.gold, borderRadius: 2 }} />
          <span style={{ fontFamily: FONT_HEAD, fontSize: 19, fontWeight: 600, color: theme.text }}>Study Map</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button onClick={() => setDark((d) => !d)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: theme.text }}>
            <UserIcon size={14} /> {user.displayName}
          </div>
          <button onClick={logout} title="Log out" style={{ background: "none", border: "none", cursor: "pointer", color: theme.textMuted }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, padding: "0 24px", marginTop: 18, flexWrap: "wrap" }}>
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = tab === n.key;
          return (
            <button key={n.key} onClick={() => setTab(n.key)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
              fontSize: 13.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer",
              border: "none", borderBottom: active ? `2.5px solid ${theme.accent}` : "2.5px solid transparent",
              background: "transparent", color: active ? theme.text : theme.textMuted,
            }}>
              <Icon size={15} /> {n.label}
            </button>
          );
        })}
      </div>
      <div style={{ height: 1, background: theme.border, margin: "0 24px 24px" }} />

      <div style={{ padding: "0 24px", maxWidth: 980, margin: "0 auto" }}>
        {tab === "map" && <MapTab />}
        {tab === "notes" && <NotesTab />}
        {tab === "personal" && <PersonalTab />}
        {tab === "leaderboard" && <LeaderboardTab />}
      </div>

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, borderTop: `1px solid ${theme.border}`,
        background: theme.surface,
      }}>
        <button onClick={() => setTab(tab === "quickschedule" ? "map" : "quickschedule")} style={{
          display: "flex", alignItems: "center", gap: 8, margin: "0 auto", padding: "8px 20px",
          fontSize: 12.5, fontWeight: 600, fontFamily: FONT_BODY, cursor: "pointer", border: "none",
          background: "transparent", color: tab === "quickschedule" ? theme.accent : theme.textMuted,
        }}>
          <ListChecks size={14} /> Schedule
          {todo.filter((t) => !t.done).length > 0 && (
            <span style={{
              background: theme.gold, color: "#fff", borderRadius: 10, fontSize: 10.5,
              padding: "1px 6px", fontWeight: 700,
            }}>{todo.filter((t) => !t.done).length}</span>
          )}
        </button>
        {tab === "quickschedule" && (
          <div style={{ maxHeight: "45vh", overflowY: "auto", padding: "0 24px 20px", maxWidth: 980, margin: "0 auto" }}>
            <ScheduleTab />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Layout helpers                                                    */
/* ---------------------------------------------------------------- */

function Grid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
      {children}
    </div>
  );
}

function GridCard({ theme, title, sub, onClick, badge, color, onColorChange, schedule }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const accent = color || theme.accent;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={onClick} style={{
        textAlign: "left", cursor: "pointer", border: `1px solid ${theme.border}`,
        borderBottom: `3px solid ${accent}`, borderRadius: "8px 8px 6px 6px",
        background: theme.surface, padding: "16px 14px", minHeight: 64, width: "100%",
        display: "flex", flexDirection: "column", gap: 6, boxShadow: theme.shadow,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: FONT_HEAD, fontSize: 15.5, color: theme.text, flex: 1 }}>{title}</span>
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 700, color: theme.gold, background: theme.goldSoft, borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>
              {badge}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: theme.textMuted }}>{sub}</span>
      </button>

      {schedule && (
        <button onClick={(e) => { e.stopPropagation(); schedule.onToggle(); }} title={schedule.title}
          style={{
            position: "absolute", bottom: 6, right: 6, width: 20, height: 20, borderRadius: 5,
            background: schedule.active ? theme.accentSoft : "transparent", border: "none",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            color: schedule.active ? theme.accent : theme.textMuted,
          }}>
          {schedule.active ? <Check size={13} /> : <Plus size={13} />}
        </button>
      )}

      {onColorChange && (
        <button onClick={(e) => { e.stopPropagation(); setPickerOpen((v) => !v); }} title="Customise colour"
          style={{
            position: "absolute", top: 8, right: 8, width: 14, height: 14, borderRadius: "50%",
            background: accent, border: `1px solid ${theme.surface}`, cursor: "pointer", padding: 0,
          }} />
      )}
      {pickerOpen && onColorChange && (
        <ColorPicker theme={theme} value={color} onChange={onColorChange} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

function EmptyHint({ theme, text }) {
  return (
    <div style={{
      border: `1px dashed ${theme.border}`, borderRadius: 10, padding: "28px 20px",
      textAlign: "center", color: theme.textMuted, fontSize: 13.5,
    }}>
      {text}
    </div>
  );
}

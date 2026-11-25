// V3-I18N-A: DOM-Übersetzer. Deutsch ist die Ausgangssprache (steht im Code/HTML); bei Englisch ersetzt dieser Beobachter
// jeden Text/Titel/Platzhalter, den das Spiel (statisch oder dynamisch) ins DOM schreibt, anhand der Wörterbücher
// (js/i18n/en_ui.js, en_units.js). Die deutsche Vorlage wird am Knoten gemerkt → Zurückschalten stellt alles wieder her.
// Ausgenommen: Elemente mit [data-notr] (Nutzereingaben, Karten-/Spielernamen), <script>, <style>, <textarea>.
import { translateText } from './engine.js';

const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
let on = false;
let observer = null;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CANVAS']);

function skipped(el) { return !el || (el.closest && el.closest('[data-notr]')) || SKIP.has(el.nodeName); }

function tx(node) {
  const el = node.parentNode;
  if (!el || skipped(el)) return;
  const cur = node.data;
  if (node.__en !== undefined && cur === node.__en) return;            // schon übersetzt, unverändert
  if (!/[\p{L}]/u.test(cur)) return;
  const en = translateText(cur);
  if (en !== cur) { node.__de = cur; node.__en = en; node.data = en; } else { node.__de = undefined; node.__en = undefined; }
}
function ta(el) {
  if (skipped(el)) return;
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    const key = '__a_' + a;
    const rec = el[key];
    if (rec && cur === rec.en) continue;
    const en = cur && /\p{L}/u.test(cur) ? translateText(cur) : cur;
    if (en !== cur) { el[key] = { de: cur, en }; el.setAttribute(a, en); } else el[key] = undefined;
  }
}
function walk(root) {
  if (!root) return;
  if (root.nodeType === 3) return tx(root);
  if (root.nodeType !== 1 && root.nodeType !== 11) return;
  if (root.nodeType === 1) { if (skipped(root)) return; ta(root); }
  for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
}
function restore(root) {
  const w = document.createTreeWalker(root, 1 | 4);
  let n = w.nextNode();
  while (n) {
    if (n.nodeType === 3) { if (n.__en !== undefined && n.data === n.__en) n.data = n.__de; n.__de = n.__en = undefined; }
    else for (const a of ATTRS) { const r = n['__a_' + a]; if (r && n.getAttribute(a) === r.en) n.setAttribute(a, r.de); n['__a_' + a] = undefined; }
    n = w.nextNode();
  }
}
const onMut = (list) => {
  if (!on) return;
  for (const m of list) {
    if (m.type === 'childList') m.addedNodes.forEach((n) => walk(n));
    else if (m.type === 'characterData') tx(m.target);
    else if (m.type === 'attributes') ta(m.target);
  }
};
export function enableDomTranslate() {
  if (on || typeof document === 'undefined') return;
  on = true;
  walk(document.documentElement);
  if (!observer) observer = new MutationObserver(onMut);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
export function disableDomTranslate() {
  if (!on) return;
  on = false;
  if (observer) { onMut(observer.takeRecords()); observer.disconnect(); }
  restore(document.documentElement);
}
export function retranslate() { if (on) walk(document.documentElement); }

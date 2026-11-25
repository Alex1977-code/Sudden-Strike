// Übersetzung (V3-MENU, Grundgerüst). Deutsch ist die Ausgangssprache und steht direkt im Code bzw. in index.html;
// eine spätere englische Fassung trägt nur noch ein Wörterbuch ein.
//
//   t(key, fallbackDe, vars?)   → Text in der aktiven Sprache; ohne Eintrag fallbackDe (Platzhalter {name} aus vars)
//   applyI18n(root)             → setzt [data-i18n] (textContent), [data-i18n-title], [data-i18n-placeholder],
//                                 [data-i18n-aria] aus dem Wörterbuch; der deutsche Originaltext wird beim ersten Lauf
//                                 gemerkt (data-i18n-de), damit ein Zurückschalten funktioniert
//   registerStrings(lang, obj)  → Wörterbuch ergänzen, z. B. registerStrings('en', { 'menu.campaign': 'Campaign' })
//   getLang() / setLang(lang) / onLangChange(fn) / LANGS / isLangAvailable(lang)
//
// Schlüssel-Konvention: bereich.element, z. B. menu.campaign, settings.tab.audio, end.stat.kills.
// data-i18n nur auf Elemente setzen, die ausschließlich Text enthalten (Icons stehen in eigenen <i>-Geschwistern).
// Stand: Englisch ist vorbereitet, aber noch nicht verfügbar (isLangAvailable('en') === false) – folgt.

import { enableDomTranslate, disableDomTranslate } from './i18n/domtr.js';
import { translateText, setNameSources, unitNameEn, unitDescEn, abilityNameEn, abilityDescEn, weaponNameEn } from './i18n/engine.js';
import { EN_UI } from './i18n/en_ui.js';

const LANG_KEY = 'steppensturm.lang';
export const LANGS = { de: 'Deutsch', en: 'English' };
const dict = { de: {}, en: {} };
const available = { de: true, en: false };
const listeners = [];
let lang = 'de';

const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : String(s));

export function t(key, fallbackDe, vars) {
  const s = (dict[lang] && dict[lang][key]) ?? (lang !== 'de' ? dict.de[key] : undefined) ?? fallbackDe ?? key;
  return fill(s, vars);
}
export function getLang() { return lang; }
export function isLangAvailable(l) { return !!available[l]; }
export function registerStrings(l, obj, { makeAvailable = false } = {}) {
  dict[l] = Object.assign(dict[l] || {}, obj);
  if (makeAvailable) available[l] = true;
}
export function onLangChange(fn) { listeners.push(fn); }
function applyDomMode() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  applyI18n(document);
  if (lang === 'en') enableDomTranslate(); else disableDomTranslate();
}
// Erststart: gespeicherte Wahl, sonst Browsersprache (de* → Deutsch, sonst Englisch)
export function initLang() {
  let l = null;
  try { l = localStorage.getItem(LANG_KEY); } catch (e) { /* ignorieren */ }
  if (!l || !available[l]) {
    const nav = (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]))) || 'de';
    l = String(nav).toLowerCase().startsWith('de') ? 'de' : 'en';
    try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* ignorieren */ }
  }
  lang = available[l] ? l : 'de';
  if (lang === 'en') applyDomMode();
  return lang;
}
// Zentrale Namens-Helfer (Einheit/Fähigkeit/Waffe): Deutsch = Wert im Code, Englisch = Tabelle js/i18n/en_units.js
export const unitName = (type) => (lang === 'en' ? unitNameEn(type) : (type?.name ?? ''));
export const unitDesc = (type) => (lang === 'en' ? unitDescEn(type) : (type?.desc ?? ''));
export const abilityName = (id, a) => (lang === 'en' ? abilityNameEn(id, a) : (a?.name ?? ''));
export const abilityDesc = (id, a) => (lang === 'en' ? abilityDescEn(id, a) : (a?.desc ?? ''));
export const weaponName = (id, w) => (lang === 'en' ? weaponNameEn(id, w) : (w?.name ?? ''));
// beliebigen deutschen Text für die Anzeige übersetzen (z. B. Sprachfunk); bei Deutsch unverändert
export const tr = (s) => (lang === 'en' ? translateText(s) : s);
export { setNameSources };
// Zahlen/Dezimaltrenner nach Sprache (Anzeige): fmtNum(1.5) → „1,5“ (de) / „1.5“ (en)
export function fmtNum(n, digits = 1) { return Number(n).toLocaleString(lang === 'en' ? 'en-GB' : 'de-DE', { maximumFractionDigits: digits }); }

export function setLang(l) {
  if (!available[l] || l === lang) return false;
  lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* ignorieren */ }
  applyDomMode();
  listeners.forEach((f) => { try { f(l); } catch (e) { console.warn('[i18n]', e); } });
  return true;
}

export function applyI18n(root = document) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    if (el.dataset.i18nDe === undefined) el.dataset.i18nDe = el.textContent;
    el.textContent = t(el.dataset.i18n, el.dataset.i18nDe);
  });
  for (const [attr, prop] of [['title', 'i18nTitle'], ['placeholder', 'i18nPlaceholder'], ['aria-label', 'i18nAria']]) {
    root.querySelectorAll(`[data-i18n-${attr === 'aria-label' ? 'aria' : attr}]`).forEach((el) => {
      const deKey = prop + 'De';
      if (el.dataset[deKey] === undefined) el.dataset[deKey] = el.getAttribute(attr) || '';
      el.setAttribute(attr, t(el.dataset[prop], el.dataset[deKey]));
    });
  }
}

registerStrings('en', EN_UI, { makeAvailable: true });
initLang();

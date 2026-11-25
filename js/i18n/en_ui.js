// V3-I18N-A: Englisches Oberflächen-Wörterbuch (Schlüssel = deutscher Originaltext), Muster und Glossar. Teile: en_ui_a/b/c/d.js
import { TEXT_A } from './en_ui_a.js';
import { TEXT_B, PATTERNS_B, GLOSS_B } from './en_ui_b.js';
import { TEXT_C, PATTERNS_C, GLOSS_C } from './en_ui_c.js';
export const EN_UI = {};                    // optionale Schlüssel-Einträge (data-i18n), falls ein deutscher Text mehrdeutig ist
export const TEXT = { ...TEXT_A, ...TEXT_B, ...TEXT_C };
export const PATTERNS = [...PATTERNS_B, ...PATTERNS_C];
export const GLOSS = { ...GLOSS_B, ...GLOSS_C };

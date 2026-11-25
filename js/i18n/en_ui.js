// V3-I18N-A: Englisches Oberflächen-Wörterbuch (Schlüssel = deutscher Originaltext), Muster und Glossar. Teile: en_ui_a/b/c/d.js
import { TEXT_A } from './en_ui_a.js';
import { TEXT_B, PATTERNS_B, GLOSS_B } from './en_ui_b.js';
import { TEXT_C, PATTERNS_C, GLOSS_C } from './en_ui_c.js';
import { TEXT_D, PATTERNS_D, GLOSS_D } from './en_ui_d.js';
import { TEXT_E, PATTERNS_E } from './en_ui_e.js';
export const EN_UI = {};                    // optionale Schlüssel-Einträge (data-i18n), falls ein deutscher Text mehrdeutig ist
export const TEXT = { ...TEXT_A, ...TEXT_B, ...TEXT_C, ...TEXT_D, ...TEXT_E };
export const PATTERNS = [...PATTERNS_B, ...PATTERNS_C, ...PATTERNS_D, ...PATTERNS_E];
export const GLOSS = { ...GLOSS_B, ...GLOSS_C, ...GLOSS_D };

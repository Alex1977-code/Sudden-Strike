# TODO

## Englische Sprachversion (zurückgestellt)

Stand: angefangen, auf Wunsch angehalten. Das Spiel bleibt standardmäßig **deutsch**; die Sprachumschaltung in den
Einstellungen ist für Englisch deaktiviert. Vorschau des bisherigen Stands: URL-Parameter `?lang=en`.

Vorhanden:
- `js/i18n.js` – `t()`, `tr()`, `unitName/abilityName/weaponName`, `setLang/getLang`, Browsersprache-Erkennung
  (greift erst, wenn Englisch freigeschaltet ist), Freischaltung per `registerStrings('en', …, { makeAvailable: true })`.
- `js/i18n/en_ui*.js`, `en_units.js`, `engine.js`, `domtr.js` – Oberfläche, Einheiten-/Fähigkeits-/Waffennamen
  (Teil A, nicht abgeschlossen: Stapel D/E unvollständig, Abschlusstest fehlt).
- `js/i18n/runtime.js`, `js/i18n/en_missions/*.js` – Missions-/Kampagnentexte, Funksprüche, Ziele (Teil B, nicht
  abgeschlossen: Ukraine/Tutorial/Westalliierte begonnen, Rote Armee und deutsche Seite offen, Afghanistan leer).

Offen:
1. Teil A fertigstellen (restliche UI-Texte inkl. Speichern/Laden, Medaillen, Schwierigkeit, Sichtlinien-Werkzeug,
   Sprachfunk mit englischer Stimme, Wiederholungen/Zuschauer/Koop), DOM-Restfund-Test = 0.
2. Teil B fertigstellen (alle Kampagnen inkl. Afghanistan), Restquote ≤ 2 % (`window.__i18nMissing`).
3. Danach in `js/i18n.js` `makeAvailable: true` setzen (EN_PREVIEW entfernen).

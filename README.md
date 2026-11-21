# STEPPENSTURM – Front Ukraine

Ein 3D-Echtzeit-Taktikspiel in der Tradition klassischer Weltkriegs-Taktikspiele (keine Basis, feste Einheiten, Nebel des Krieges, Deckung) – versetzt in den modernen Drohnen- und Raketenkrieg. Läuft direkt im Browser auf **PC, Handy und Tablet**.

> Fiktive Handlung, inspiriert von realen Ereignissen. Alle Personen der Story sind erfunden.

## Starten

Das Spiel ist rein statisch (kein Build-Schritt, alle Bibliotheken liegen in `vendor/`):

```bash
python3 -m http.server 8000
# dann http://localhost:8000 im Browser öffnen
```

Oder über GitHub Pages / jeden Webserver ausliefern. Auf dem Handy lässt es sich über „Zum Startbildschirm hinzufügen" als App (PWA, offline-fähig) installieren.
`?unlock=all` an die URL anhängen schaltet alle Missionen frei.

## Als Einzeldatei bauen

`tools/build-artifact.mjs` bündelt Three.js und den gesamten Spielcode mit esbuild in eine eigenständige HTML-Datei (z. B. für ein Claude-Artifact):

```bash
npm i esbuild
node tools/build-artifact.mjs esbuild dist/steppensturm.html
```

## Kampagne „Stahl und Sonnenblumen"

| # | Mission | Schauplatz | Kern |
|---|---------|-----------|------|
| 1 | Die Straße nach Kyjiw | Oblast Kyjiw, Feb. 2022 (Winter) | Hinterhalt auf Kolonnen mit Javelin-Teams, Aufklärungsdrohne (Tutorial) |
| 2 | Schwarm über Charkiw | Charkiw, Sept. 2022 | Orlan-Aufklärer abschießen, Artillerie mit **FPV-Schwärmen** jagen, Lancet-Drohnen, EloKa-Störsender |
| 3 | Nacht der Hyperschallraketen | Kyjiw, Mai 2023 (Nacht) | Flugabwehr: Shahed-Schwärme, Kalibr-Marschflugkörper, **Kinschal-Hyperschallraketen** mit Patriot abfangen |
| 4 | Durchbruch bei Saporischschja | Juni 2023 | Leopard 2, Minenfelder per Drohne aufdecken, HIMARS, Ka-52 |
| 5 | **Die Krimbrücke** | Straße von Kertsch, Juli 2023 | SSO-Kommando gegen S-400/Panzir, **Seedrohnen** und Storm Shadow gegen die Brückensegmente |

## Features

- **Moderne Grafik (WebGL/Three.js):** PBR-Materialien, dynamischer Himmel mit Umgebungsreflexionen, Echtzeit-Schatten, ACES-Tonemapping, Bloom, animiertes Wasser, Partikel-Explosionen, Rauch, Leuchtspur, Nachtmission, Winter/Herbst/Sommer.
- **SSU-Upscaling (DLSS-ähnlich):** Rendern mit reduzierter interner Auflösung und Hochskalieren per kantenbewusstem Bikubik-Filter plus kontrastadaptivem Nachschärfen (wie AMD FSR 1). Modi: Qualität, Ausgewogen, Leistung, Ultra-Leistung und **dynamisch** (hält die Ziel-FPS). Echtes NVIDIA DLSS braucht native Treiber-Schnittstellen und ist im Browser nicht verfügbar. SSU läuft dagegen auf jeder GPU, auch auf Handys.
- **Drohnentechnik:** Aufklärungsdrohnen (Nebel des Krieges), FPV-Kamikazedrohnen mit Top-Attack, feindliche Orlan, Lancet und Shahed, Seedrohnen, elektronische Kampfführung (Störsender).
- **Raketen:** Kinschal-Hyperschallraketen mit Vorwarnung und Abfang-Mechanik (Patriot, IRIS-T), Marschflugkörper im Tiefflug, HIMARS, Javelin/TOW, Abfangraketen-Simulation.
- **Taktik:** Frontpanzerung, Deckung in Wald und Ortschaften, Tarnung, Minenfelder, Artillerie mit Beobachtern, Wegfindung (A*), Formationen, Kontrollgruppen.
- **Steuerung:** Maus/Tastatur und Touch (Tippen, Ziehen, Pinch-Zoom, Drehen, Auswahlrahmen-Modus).

## Steuerung (Kurzfassung)

| PC | Handy |
|----|-------|
| Linksklick / Ziehen: auswählen | Tippen: auswählen |
| Rechtsklick: bewegen / angreifen | Gelände/Feind antippen: bewegen / angreifen |
| WASD, Bildschirmrand, Mausrad, Q/E | Ein Finger: schieben · zwei Finger: Zoom & Drehen |
| F1–F4: Fähigkeiten · H: Feuer halten · S: Halt | Fähigkeit tippen, dann Ziel |
| Strg+1–9 / 1–9: Gruppen · Leertaste: Pause | „Rahmen": Auswahlrahmen ziehen |

## Projektstruktur

```
index.html, css/style.css     UI und Menüs
js/engine/                    Renderer (Post-Processing, SSU), Gelände, Nebel, Partikel, Audio, Wegfindung
js/game/                      Einheiten, Waffen, Kampf, Fähigkeiten, KI, Eingabe, HUD
js/missions/                  Kampagne mit 5 Missionen
vendor/three/                 Three.js r170 (MIT)
sw.js, manifest.webmanifest   PWA / Offline
```

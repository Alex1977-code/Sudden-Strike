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

## Gefecht gegen KI (1v1 bis 6v6)

Im Titelmenü öffnet **„Gefecht"** den Setup-Bildschirm. Dort wählst du:
- Modus 1v1–6v6, Team und Rolle: 🛡️ Panzerkeil, 🪖 Infanterie & Aufklärung, 💥 Artillerie & Flugabwehr oder 🚚 Logistik & Pioniere. Die KI besetzt die übrigen Rollen und spiegelt sie beim Gegner.
- Kartenthema: Flussübergang, Stadtkampf, Höhenzug, Eisenbahnknoten, Wald & Sumpf, Küste oder Offene Steppe.
- Größe (klein, mittel, groß; zu kleine Karten werden automatisch vergrößert), Jahreszeit, Nacht und KI-Stärke.
- Verstärkungsintervall, Siegbedingung (Vernichtung, Punkte-Limit oder Zeitlimit) und Seed. Eine Kartenvorschau zeigt Punkte und Aufmarschräume.

**Kern des Gefechts:**
- **Eroberungspunkte:** Zeppeline, Fesselballone, Flugfeld, Depot, Funkturm, Bahnhof und Dorf. Steht 6 s nur ein Team im Ring, wechselt der Besitzer. Stehen beide Teams im Ring, ist der Punkt umkämpft. Die Besitzerfarbe zeigen Fahne, Leitwerk, Bodenring, Punkteleiste und Minikarte.
- **Verstärkungs-Countdown:** Oben steht „Verstärkung in m:ss", in den letzten 30 s rot und mit Ton. Wer einen Punkt beim Ablauf hält, bekommt ein Paket; am Zeppelin kommen Fallschirmjäger und Fähigkeitsladungen dazu. Ein unbewachter Punkt lässt sich so in letzter Sekunde klauen. Das schwächere Team erhält zusätzlich eine kleine Reserve.
- **Frontlinie und Logistik:**
  - Munition und Treibstoff sind begrenzt. Versorgungs-Lkw füllen im Umkreis auf, Bergepanzer reparieren Fahrzeuge und zerstörte Ketten.
  - Pioniere bauen Panzersperren, Sandsäcke, Gräben und Minenfelder, räumen Minen und sprengen.
  - Beschädigte Fahrzeuge werden von der Besatzung verlassen; Infanterie kann sie übernehmen.
- **Sicht und Hinterhalt:**
  - Hügelkämme, Wald und Häuser blockieren Sichtlinie und Schusslinie.
  - Beobachter sehen im Stand mit dem Fernglas weit in einem Kegel.
  - Infanterie kann Häuser besetzen und erhält dort Deckung sowie mehr Sicht und Reichweite.

## Online-Multiplayer

Im Titelmenü öffnet **„Online-Gefecht"** das Online-Menü. Gespielt wird ein Gefecht (1v1 bis 6v6) mit Menschen und KI-Plätzen gemischt.

**Raum erstellen (Host):** Namen eingeben, Verbindung **„Internet (PeerJS)"** wählen und auf „Raum erstellen" tippen. Der Raumcode (z. B. `stst-K7PXM`) steht groß oben in der Lobby. Mit „Kopieren" landet er in der Zwischenablage, sonst wird er markiert. In der Lobby stellt der Host Modus, Kartenthema, Größe, Jahreszeit, Nacht, Verstärkungsintervall, Siegbedingung und KI-Stärke ein. Freie Plätze kann er auf KI (leicht/normal/schwer) oder „geschlossen" setzen. Spieler kann er entfernen (✖).

**Raum beitreten:** Namen eingeben, Raumcode eintragen, „Raum beitreten". In der Lobby wählt jeder Spieler Team und Rolle, schreibt im Chat und meldet sich bereit. Die Einstellungen sehen Mitspieler nur zur Ansicht. Der Host startet, sobald alle bereit sind. Offene Plätze übernimmt dann die KI.

**Im Spiel:**
- Der Host berechnet die gesamte Simulation einschließlich der KI-Kommandeure (host-autoritativ).
- Mitspieler schicken nur Befehle und erhalten etwa 10 Zustandsbilder pro Sekunde, die geglättet dargestellt werden.
- Jeder Mitspieler bekommt nur die feindlichen Einheiten, die sein Team tatsächlich sieht. Ein Maphack über die Netzwerkdaten ist damit nicht möglich.
- **Enter** öffnet den Chat. `/t Text` schickt die Nachricht nur ans eigene Team.
- **Esc** öffnet ein Menü. Das Spiel läuft dabei weiter, eine Pause gibt es online nicht.

**Verbindungsabbrüche:**
- Verlässt ein Mitspieler das Spiel oder bricht seine Verbindung ab, übernimmt die KI seine Einheiten. Alle bekommen dazu eine Meldung.
- Verlässt der Host das Spiel, endet es für alle mit einem Hinweis und der Rückkehr ins Menü.

**Lokaler Test:** Die Verbindungsart „Lokal (gleicher Browser, Test)" verbindet Tabs und Fenster desselben Browsers auf einem Gerät über `BroadcastChannel`. Dafür ist kein Internet nötig. Damit lassen sich Lobby und Spiel ohne zweites Gerät ausprobieren.

**Hosting über GitHub Pages:**
- Das Spiel ist statisch und braucht keinen eigenen Server. Repository → Settings → Pages → Branch wählen. Danach unter `https://<name>.github.io/<repo>/` öffnen.
- Die Spieler verbinden sich per WebRTC direkt miteinander. Nur der Verbindungsaufbau läuft über den öffentlichen PeerJS-Vermittlungsserver (`0.peerjs.com`).
- Die Bibliothek liegt in `vendor/peerjs/` und wird erst beim Online-Spiel nachgeladen.
- Mit `?room=stst-XXXXX` in der URL ist der Raumcode beim Beitreten schon ausgefüllt.

**TURN-Server (Mobilfunk):**
- Hinter Mobilfunk-NAT (CGNAT) oder strengen Firmen-Firewalls scheitern direkte WebRTC-Verbindungen oft. Dann braucht es einen TURN-Server, der die Daten weiterleitet, z. B. einen eigenen coturn-Server oder einen gehosteten Dienst.
- Eingetragen wird er in `js/net/onlineui.js`, Konstante `NET_CONFIG.peerOptions.config.iceServers`:

```js
iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:turn.example.org:3478', username: 'benutzer', credential: 'passwort' },
]
```

- Alternativ geht das ohne Codeänderung per `<script>window.STST_NET_CONFIG = { peerOptions: { config: { iceServers: [...] } } };</script>` vor `js/main.js` in `index.html`.
- Dort lässt sich mit `peerOptions: { host, port, path, secure }` auch ein eigener PeerJS-Server angeben.

**Claude-Artifact:** Im Artifact (`window.__ARTIFACT === true`) sind Netzwerkverbindungen gesperrt. Der Internet-Modus ist dort deaktiviert, mit dem Hinweis „Online-Spiel nur in der Web-Version (z. B. GitHub Pages)". Der lokale Test funktioniert weiterhin.

Technik: `js/net/transport.js` (PeerJS bzw. BroadcastChannel), `js/net/lobby.js` (Lobby-Protokoll), `js/net/codec.js` (kompakte Zustandsbilder), `js/net/session.js` (Host-Simulation, Zustandsbilder je Team, Ereignisse, Client-Interpolation) und `js/net/onlineui.js` (Menüs, Lobby, Chat).

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
js/skirmish/                  Gefecht 1v1–6v6: Kartengenerator, Eroberungspunkte, KI-Kommandeure
js/net/                       Online-Multiplayer: Transport, Lobby, Codec, Sitzung (Host/Client), Online-Menüs
vendor/three/                 Three.js r170 (MIT)
vendor/peerjs/                PeerJS (MIT) für WebRTC-Verbindungen
sw.js, manifest.webmanifest   PWA / Offline
```

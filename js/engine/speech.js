// Sprachfunk (V3-X): Funksprüche (game 'say' – auch sayTo, wenn der lokale Spieler gemeint ist) per Web Speech API vorlesen.
//   • abschaltbar (Einstellungen → Audio), Standard: an, sobald eine Stimme für die Sprache verfügbar ist
//   • Lautstärke/Tempo, Stimme nach i18n-Sprache (de-DE, später en), Tonhöhe je Sprecher (Hash des Namens)
//   • Warteschlange mit Priorität (Warnungen zuerst), keine Überlappung, veraltete Meldungen verfallen
//   • kurzer Funk-Piepton davor (audio.radio), still in Pause/Menü/beim Vorspulen eines Spielstands
//   • im Claude-Artifact (window.__ARTIFACT) oder ohne speechSynthesis stillschweigend aus
// API: const v = new RadioVoice(game, settings, { getLang, isActive }); v.available, v.enabled, v.setEnabled(b), v.update(dt)
const HIGH = /(⚠|alarm|achtung|warnung|luftangriff|im anflug|feuer frei|zurückziehen|rückzug|verloren|gefallen|hilfe)/i;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// Sonderzeichen/Emoji entfernen, Abkürzungen sprechbar machen
export function speakable(text, lang = 'de') {
  const en = lang === 'en';
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u{1F000}-\u{1FFFF}☀-➿⬀-⯿️★✔✖✚⚑⚠]/gu, ' ')
    .replace(/\bkm\/h\b/g, en ? 'kilometers per hour' : 'Kilometer pro Stunde').replace(/(\d)\s?m\b/g, en ? '$1 meters' : '$1 Meter')
    .replace(/\s+/g, ' ').trim();
}

export class RadioVoice {
  constructor(game, settings, { getLang = () => 'de', isActive = () => true, tr = null } = {}) {
    this.tr = tr; // V3-I18N-A: Übersetzung des (deutschen) Funktexts bei Englisch
    this.g = game; this.settings = settings; this.getLang = getLang; this.isActive = isActive;
    this.queue = []; this.speaking = null; this.waitT = 0; this.stats = { spoken: 0, dropped: 0 };
    this.synth = (typeof window !== 'undefined' && !window.__ARTIFACT && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function') ? window.speechSynthesis : null;
    this.voices = [];
    if (this.synth) {
      const load = () => { try { this.voices = this.synth.getVoices() || []; } catch (e) { this.voices = []; } this._applyDefault(); };
      load();
      try { this.synth.addEventListener?.('voiceschanged', load); } catch (e) { /* */ }
    }
    game.on('say', (speaker, text, dur) => this.enqueue(speaker, text, dur));
    game.on('loaded', () => this.clear());
  }
  get available() { return !!this.synth; }
  get hasVoice() { return !!this.voice(); }
  get enabled() { return this.available && this.settings.speech !== false && (this.settings.speech === true || this.hasVoice); }
  _applyDefault() { if (this.settings.speech === undefined && this.hasVoice) this.settings.speech = true; }
  setEnabled(v) { this.settings.speech = !!v; if (!v) this.clear(); }
  langCode() { return this.getLang() === 'en' ? 'en' : 'de'; }
  voice() {
    if (!this.voices.length) return null;
    const lc = this.langCode();
    return this.voices.find((v) => (v.lang || '').toLowerCase().startsWith(lc) && /google|natural|neural/i.test(v.name || ''))
      || this.voices.find((v) => (v.lang || '').toLowerCase().startsWith(lc)) || null;
  }
  pitchFor(speaker) { return 0.72 + (hash(String(speaker || '')) % 57) / 100; } // 0,72 … 1,28
  enqueue(speaker, text, dur = 5) {
    const g = this.g;
    if (!this.enabled || g.replaying || g.demo || !g.active) return;
    const msg = speakable(this.tr ? this.tr(text) : text, this.getLang());
    if (!msg) return;
    const now = g.time || 0;
    if (this.queue.some((q) => q.text === msg) || (this.speaking && this.speaking.text === msg)) return;
    const prio = HIGH.test(text) || HIGH.test(speaker) ? 2 : 1;
    this.queue.push({ speaker: String(speaker || ''), text: msg, prio, t: now });
    this.queue.sort((a, b) => b.prio - a.prio || a.t - b.t);
    while (this.queue.length > 5) { this.queue.splice(this.queue.findLastIndex((q) => q.prio === Math.min(...this.queue.map((x) => x.prio))), 1); this.stats.dropped++; }
  }
  clear() { this.queue = []; this.waitT = 0; if (this.synth && this.speaking) { try { this.synth.cancel(); } catch (e) { /* */ } } this.speaking = null; }
  // je Frame aus main.js: still in Pause/Menü, sonst nächste Meldung sprechen
  update(dt) {
    if (!this.synth) return;
    const g = this.g;
    const quiet = !this.enabled || !this.isActive() || g.paused || g.replaying || !g.active || g.demo;
    if (quiet) {
      if (this.speaking) { try { this.synth.cancel(); } catch (e) { /* */ } this.speaking = null; }
      if (!this.enabled) this.queue = [];
      return;
    }
    if (this.speaking) {
      // Sicherheitsnetz, falls 'end' ausbleibt
      if (performance.now() - this.speaking.start > 15000 + this.speaking.text.length * 120) this.speaking = null;
      return;
    }
    if (this.waitT > 0) { this.waitT -= dt; return; }
    // veraltete Meldungen (Spielzeit) verwerfen
    const now = g.time || 0;
    this.queue = this.queue.filter((q) => { const keep = now - q.t < (q.prio > 1 ? 30 : 18); if (!keep) this.stats.dropped++; return keep; });
    const q = this.queue.shift();
    if (!q) return;
    this._speak(q);
  }
  _speak(q) {
    const s = this.settings;
    try { this.g.audio?.radio?.(0.22); } catch (e) { /* */ }
    let u;
    try { u = new window.SpeechSynthesisUtterance(q.text); } catch (e) { return; }
    const v = this.voice();
    if (v) u.voice = v;
    u.lang = v?.lang || (this.langCode() === 'en' ? 'en-US' : 'de-DE');
    u.pitch = this.pitchFor(q.speaker);
    u.rate = Math.max(0.6, Math.min(1.6, s.speechRate ?? 1.05));
    u.volume = Math.max(0, Math.min(1, s.speechVolume ?? 0.9));
    const cur = { ...q, start: performance.now(), u };
    this.speaking = cur;
    u.onend = u.onerror = () => { if (this.speaking === cur) { this.speaking = null; this.waitT = 0.35; } };
    // kurzer Abstand nach dem Piepton
    setTimeout(() => {
      if (this.speaking !== cur) return;
      try { this.synth.speak(u); this.stats.spoken++; } catch (e) { this.speaking = null; }
    }, 160);
  }
}

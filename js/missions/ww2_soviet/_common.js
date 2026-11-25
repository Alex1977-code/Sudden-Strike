// Gemeinsame Bausteine der Kampagne „WK2 – Rote Armee“ (ww2-soviet): Einheitenschlüssel, Zonen, Minenfelder.
// Spielerseite = 'UA' (Rote Armee, Typen ww2_su_* / ww2_t34_* …), Gegenseite = 'RU' (Wehrmacht-Typen ww2_de_* …, ohne Symbole).

export const S = {
  rifle: 'ww2_su_rifle', dp: 'ww2_su_dp28', smg: 'ww2_su_ppsh', at: 'ww2_su_ptrd', sniper: 'ww2_su_sniper', eng: 'ww2_su_engineer',
  off: 'ww2_su_officer', med: 'ww2_su_medic', mortar: 'ww2_su_mortar',
  t34: 'ww2_t34_76', t85: 'ww2_t34_85', kv1: 'ww2_kv1', is2: 'ww2_is2', su76: 'ww2_su76', su100: 'ww2_su100',
  bm13: 'ww2_bm13', truck: 'ww2_zis_truck', ba64: 'ww2_ba64', zis3: 'ww2_zis3', flak: 'ww2_61k',
};
export const E = {
  rifle: 'ww2_de_rifle', mg: 'ww2_de_mg42', smg: 'ww2_de_mp40', at: 'ww2_de_panzer', sniper: 'ww2_de_sniper', eng: 'ww2_de_engineer',
  off: 'ww2_de_officer', med: 'ww2_de_medic', mortar: 'ww2_de_mortar',
  pz4: 'ww2_pz4', panther: 'ww2_panther', tiger: 'ww2_tiger', stug: 'ww2_stug3', hetzer: 'ww2_hetzer', jagd: 'ww2_jagdpz4',
  htr: 'ww2_sdkfz251', puma: 'ww2_puma', pak: 'ww2_pak40', flak88: 'ww2_flak88', flak37: 'ww2_flak37', wespe: 'ww2_wespe',
  opel: 'ww2_opel', kubel: 'ww2_kubel', neb: 'ww2_nebelwerfer',
  mgnest: 'ww2_mgnest', bunker: 'ww2_bunker', wire: 'ww2_barbedwire', trap: 'ww2_tetrahedron', hole: 'ww2_foxhole', ditch: 'ww2_antitank_ditch',
};

const isBody = (u) => !u.type.air && !u.type.noAutoTarget && !u.type.rail;
// Gegner / eigene Einheiten (ohne Flugzeuge und Sperren) im Kreis
export const foes = (g, x, z, r) => g.unitsInArea(x, z, r, 'RU').filter(isBody);
export const ours = (g, x, z, r) => g.unitsInArea(x, z, r, 'UA').filter((u) => !u.type.air && !u.type.structure);
export const ourCount = (g) => g.units.filter((u) => u.alive && u.side === 'UA' && !u.type.air && !u.type.structure).length;
export const foeCount = (g, tag) => (tag ? g.countTag(tag) : g.units.filter((u) => u.alive && u.side === 'RU' && isBody(u)).length);

// Zone einnehmen: Gegner im Radius <= allow, eigene >= need, secs Sekunden lang → true (einmalig, bleibt true)
export function capture(m, g, dt, key, o) {
  const st = ((m._cap ||= {})[key] ||= { t: 0, done: false });
  if (st.done) return true;
  const en = foes(g, o.x, o.z, o.enemyR ?? o.r + 4).length, us = ours(g, o.x, o.z, o.r).length;
  if (en <= (o.allow || 0) && us >= (o.need ?? 2)) { st.t += dt; if (st.t >= (o.secs ?? 3)) st.done = true; } else st.t = Math.max(0, st.t - dt * 0.5);
  return st.done;
}

// Gruppe mit AngriffsKI (Gegenangriff/Verstärkung); points = [[x,z],…]
export function wave(g, side, list, x, z, points, o = {}) {
  return g.spawnGroup(list, side, x, z, { spacing: o.spacing || 6, cols: o.cols || 5, tags: o.tags, ai: { mode: 'attackMove', points, after: o.after || 'guard', aggressive: true, aggroRadius: o.aggro || 40 } });
}
// Eigene Verstärkung: ohne KI (Spieler führt sie), mit Funkspruch und Marker
export function reinforce(g, list, x, z, o = {}) {
  const us = g.spawnGroup(list, 'UA', x, z, { spacing: o.spacing || 5, cols: o.cols || 5, heading: o.heading, tags: o.tags });
  g.markerTo?.('UA', x, z, 0x5db8ff, 8, 14);
  return us;
}

// Verdeckte Minenfelder (Spieler sieht sie erst, wenn Pioniere/Spähtrupps nah heran sind oder eine Mine auslöst).
// Pioniere im Feld räumen es (5 s). Fahrzeuge/Infanterie in Bewegung lösen Minen aus.
export function setupMines(m, g, list) {
  m.mines = list.map(([x, z, r]) => ({ x, z, r, found: false, cleared: false, t: 0, marker: { x, z, r, label: '⚠ Minen', color: '#ff6b6b', hidden: true } }));
  m.markers = [...(m.markers || []), ...m.mines.map((k) => k.marker)];
}
export function updateMines(m, g, dt, lines = {}) {
  for (const k of m.mines || []) {
    if (k.cleared) continue;
    const near = g.units.filter((u) => u.alive && u.side === 'UA' && !u.type.air && !u.type.structure && Math.hypot(u.pos.x - k.x, u.pos.z - k.z) < k.r + (u.type.engineer ? 26 : 12));
    if (!k.found && near.length) {
      k.found = true; k.marker.hidden = false;
      g.effects.marker(k.x, k.z, 0xff3030, 9999, k.r).userData.persistent = true;
      g.say(lines.who || 'Pionier', lines.found || 'Minenfeld entdeckt und markiert! Pioniere vor – oder umgehen.', 4);
    }
    const eng = g.units.filter((u) => u.alive && u.side === 'UA' && u.type.engineer && Math.hypot(u.pos.x - k.x, u.pos.z - k.z) < k.r);
    if (eng.length) {
      k.t += dt * Math.min(2, eng.length);
      if (k.t > 5) { k.cleared = true; k.marker.hidden = true; g.say(lines.who || 'Pionier', 'Gasse ist geräumt.', 3); continue; }
    }
    for (const u of near) {
      if (!u.moving || Math.hypot(u.pos.x - k.x, u.pos.z - k.z) > k.r) continue;
      if (Math.random() < (u.type.vehicle ? 0.35 : 0.14) * dt) {
        g.effects.explosion(u.pos.x, u.pos.y, u.pos.z, u.type.vehicle ? 1.4 : 0.7);
        g.applyDamage(u, u.type.vehicle ? 380 : 90, { vs: { soft: 1, light: 1, heavy: 0.9, struct: 0, air: 0 } }, null, { topAttack: true });
        if (!k.found) { k.found = true; k.marker.hidden = false; g.effects.marker(k.x, k.z, 0xff3030, 9999, k.r).userData.persistent = true; }
      }
    }
  }
}

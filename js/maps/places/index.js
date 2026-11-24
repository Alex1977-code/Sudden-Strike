// Kartenvorlagen realer Orte („angelehnt an …“) für Kampagnen und Gefechte.
// Jede Vorlage: { id, name, label, era: 'ww2'|'modern'|'afghan', size, date?, map, env, camera, landmarks:[{name,x,z}],
//                 spawns?, structures?, notes, attribution? }
// Maßstab verdichtet (Spielkarte 400–600 m), Norden = −z. Nach geografischem Wissen nachgebaut (keine Vermessung);
// Orte mit OSM-Grundlage tragen attribution '© OpenStreetMap-Mitwirkende (ODbL)'.
import stalingrad from './stalingrad.js';
import berlin from './berlin.js';
import koenigsberg from './koenigsberg.js';
import remagen from './remagen.js';
import bastogne from './bastogne.js';
import arnheim from './arnheim.js';
import carentan from './carentan.js';
import duenkirchen from './duenkirchen.js';
import tobruk from './tobruk.js';
import elalamein from './elalamein.js';
import pegasus from './pegasus.js';
import omaha from './omaha.js';
import seelow from './seelow.js';
import prochorowka from './prochorowka.js';
import brest from './brest.js';
import ebenemael from './ebenemael.js';
import bachmut from './bachmut.js';
import awdijiwka from './awdijiwka.js';
import kertsch from './kertsch.js';
import cherson from './cherson.js';
import pokrowsk from './pokrowsk.js';
import kunduz from './kunduz.js';
import kabul from './kabul.js';
import salang from './salang.js';
import pandschir from './pandschir.js';

export const PLACES = [
  stalingrad, berlin, koenigsberg, remagen, bastogne, arnheim, carentan, duenkirchen, tobruk, elalamein, pegasus, omaha,
  seelow, prochorowka, brest, ebenemael,
  bachmut, awdijiwka, kertsch, cherson, pokrowsk,
  kunduz, kabul, salang, pandschir,
];
export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p]));
export const placesOfEra = (era) => PLACES.filter((p) => p.era === era);

// Macht aus einer Ortsvorlage ein ladbares Missionsobjekt für game.load(): Landmarken als beschriftete Marker,
// Kennzeichnung „angelehnt an …“ (+ ggf. OSM-Attribution) in title/place. setup(g) der Kampagne optional.
// opts.structures (Standard true): Bunker/Gräben/Sperren der Vorlage als Bauwerke der Seite opts.defender ('RU') setzen.
export function placeMission(place, { setup, defender = 'RU', structures = true, markers = true, ...rest } = {}) {
  const credit = place.attribution ? ` · ${place.attribution}` : '';
  return {
    id: 'place_' + place.id,
    title: place.name,
    place: place.label + credit,
    date: place.date,
    map: place.map,
    env: place.env,
    camera: place.camera,
    markers: markers ? place.landmarks.map((l) => ({ x: l.x, z: l.z, r: 6, label: l.name, color: '#ffe9a8' })) : [],
    ...rest,
    setup(g) {
      if (structures) for (const s of place.structures || []) g.spawn(s.kind, s.side || defender, s.x, s.z, { heading: s.rot || 0 });
      if (setup) setup.call(this, g);
    },
  };
}

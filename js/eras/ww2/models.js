// WK2-Modelle registrieren (Fraktionsfarben/Kennzeichen aus type.faction)
import { registerModel } from '../../game/models.js';
import { TANK_MODELS } from './mod_tanks.js';
import { WHEELED_MODELS } from './mod_wheeled.js';
import { GUN_MODELS } from './mod_guns.js';
import { INF_MODELS } from './mod_inf.js';
import { MISC_MODELS } from './mod_misc.js';

for (const set of [TANK_MODELS, WHEELED_MODELS, GUN_MODELS, INF_MODELS, MISC_MODELS]) {
  for (const [k, fn] of Object.entries(set)) registerModel(k, fn);
}

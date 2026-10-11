import { UNITS } from '../src/data/units';
import { SYNERGIES } from '../src/data/synergies';
import { EVENTS } from '../src/data/events';
import { FIELDS } from '../src/data/battlefields';
import { ENEMIES } from '../src/data/enemies';
console.log(JSON.stringify({
  units: Object.fromEntries(UNITS.map((u) => [u.id, { name: u.name, ct: u.ctype, tt: u.ttype, syn: [...u.factions, ...u.traits], starter: !u.noStarter }])),
  syn: Object.fromEntries(SYNERGIES.map((s) => [s.id, { name: s.name, tiers: s.tiers, kind: s.kind }])),
  events: Object.fromEntries(EVENTS.map((e) => [e.id, { title: e.title, choices: e.choices.map((c) => c.label), req: e.req || null, fields: e.fields || null }])),
  fields: Object.fromEntries(FIELDS.map((f) => [f.id, f.name])),
  enemies: Object.fromEntries(ENEMIES.map((e) => [e.id, e.name])),
}));

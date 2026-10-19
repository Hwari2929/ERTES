import { CFG } from '../src/config';
import * as R from '../src/engine/run';
import { buildBattle } from '../src/engine/build';
import { provMult, type CUnit } from '../src/engine/combat';
import { UNIT_BY_ID } from '../src/data/units';
import { ALL_ADVANCED, gearRank } from '../src/data/items';
import type { Elem } from '../src/types';
import { powNum } from '../src/ui/abil';
let checks = 0;
function ok(v: unknown, msg: string) { if (!v) throw new Error(msg); checks++; }
function near(a: number,b: number,msg: string) { ok(Math.abs(a-b)<1e-7, `${msg}: ${a} != ${b}`); }
function battle(id='jaehwon') {
 const run=R.newRun(123,[id],'waste',0); run.pending=[];
 return buildBattle(run,R.genEncounter(run,'battle'));
}
function plain(u:CUnit) {
 u.hooks=[]; u.mods=[];u.taken=[];u.statuses=[];u.mem={};u.synergies.clear();
 u.st.maxHp=1e8;u.hp=1e8;u.shield=0;u.st.armor=0;u.st.eva=0;u.st.crit=1;u.st.critDmg=2;u.st.armorPen=0;u.phaseAmp=1;u.keywords=['struct'];u.category='struct';
}
// Route configuration: one added node and first adversity replaced, later phases untouched.
ok(CFG.supply.p1 && !CFG.supply.front,'P1 supply enabled, no per-phase supply');
const p1=R.phaseMap(1).map(x=>x[0]);
ok(p1.length===13 && p1[0]==='supply' && p1[5]==='supply','P1 supply positions');
ok(p1.filter(x=>x==='adversity').length===1 && p1[p1.length-1]==='boss','one remaining adversity and final boss');
ok(R.phaseMap(2).length===12 && R.phaseMap(2)[0][0]==='battle','P2 unchanged');
// Damage rules, both sides and every attack kind, even explicit tech crit permissions.
for(const side of [0,1]) for(const kind of ['shoot','strike','tech'] as const) {
 const b=battle(), src=b.units.find(x=>x.side===side)!, tgt=b.units.find(x=>x.side!==side)!;
 plain(src);plain(tgt);src.mem.techCrit=1;src.mem.lowTechCrit=1;
 for(const elem of ['phys','elec','chem','psy','holy'] as Elem[]) {
  const r=b.dealDamage(src,tgt,100,{elem,tag:'skill',kind});
  near(r.amount,elem==='phys'?200:125,`${side}/${kind}/${elem}`);
  ok(r.crit===(elem==='phys'),`crit gate ${elem}`);
 }
 src.st.crit=0;
 for(const elem of ['phys','elec','chem','psy','holy','true'] as Elem[]) {
  const expected=['elec','chem','psy','holy'].includes(elem)?125:100;
  near(b.dealDamage(src,tgt,100,{elem,tag:'dot',kind:'tech'}).amount,expected,`dot ${elem}`);
  near(b.dealDamage(src,tgt,100,{elem,tag:'proc',kind:'tech'}).amount,expected,`proc ${elem}`);
  near(b.rawHit(src,tgt,100,elem),expected,`raw ${elem}`);
  near(b.rawHit(src,tgt,100,elem,true),100,`resolved raw ${elem} no double boost`);
 }
}
// Jaehwon: real skill events are electrical and never critical; passive restricted to basic crit.
{
 const b=battle(),u=b.units.find(x=>x.defId==='jaehwon')!,t=b.units.find(x=>x.side===1)!;
 plain(t);u.st.crit=1;u.st.acc=10;u.target=t;b.events=[];
 ok(u.skill!.cast(b,u),'Jaehwon skill cast');
 const hits=b.events.filter(x=>x.k==='dmg'&&x.src===u.id);
 ok(hits.length===5&&hits.every(x=>x.k==='dmg'&&x.elem==='elec'&&!x.crit),'five electric noncrit skill hits');
 u.cd=5; b.dealDamage(u,t,10,{elem:'phys',tag:'basic',kind:'shoot'});near(u.cd,3.75,'basic crit reduces 1.25s');
 u.cd=5;b.dealDamage(u,t,10,{elem:'phys',tag:'skill',kind:'shoot'});near(u.cd,5,'skill crit does not reduce cooldown');
 for(const h of u.hooks)h.onSkill?.(b,u);
 near(u.statuses.filter(s=>s.key.startsWith('jaehwon.haste.')).reduce((s,x)=>s+(x.delta?.atkSpd||0),0),0.25,'haste first stack');
 u.hooks=[];u.mem.inert=1;t.mem.inert=1; b.step(2);
 const hook=UNIT_BY_ID.jaehwon.trait.effect!.hooks!;hook.onSkill!(b,u);
 near(u.statuses.filter(s=>s.key.startsWith('jaehwon.haste.')).reduce((s,x)=>s+(x.delta?.atkSpd||0),0),0.5,'haste two stacks');
 hook.onSkill!(b,u);
 ok(u.statuses.filter(s=>s.key.startsWith('jaehwon.haste.')).length===2,'haste max 2');
 b.step(5.1);ok(!u.statuses.some(s=>s.key.startsWith('jaehwon.haste.')),'haste expiry');
}
// Fotini's real skill creates a 5-second +2.5 threat status and 15% vulnerability.
{
 const b=battle('fotini'),u=b.units.find(x=>x.defId==='fotini')!,t=b.units.find(x=>x.side===1)!;
 plain(t);u.st.acc=10;u.target=t;const before=provMult(b,t);
 ok(u.skill!.cast(b,u),'Fotini cast');
 near(provMult(b,t)-before,2.5,'target threat +2.5');
 const v=t.statuses.find(s=>s.key==='vuln.fotini');
 ok(v&&v.dur===5&&v.taken?.some(x=>x.kind==='vuln'&&x.v===0.15),'15% vulnerability 5s');
 u.skill!.cast(b,u);near(provMult(b,t)-before,2.5,'recast refreshes, no unlimited stacking');
 u.hooks=[];u.mem.inert=1;t.mem.inert=1;b.step(5.1);near(provMult(b,t),before,'threat expiry');
}
// Hundreds of encounters across phases verify exact 3 slots and random grade coverage.
const grades=new Set<number>();let enemies=0;
for(const diff of [7,8,9]) for(const phase of [1,3,6])for(let seed=1;seed<=30;seed++) {
 const run=R.newRun(seed,['jaehwon'],'waste',diff);run.phase=phase;
 for(const e of R.genEncounter(run,'adversity').enemies){ok(e.items?.length===3,'hard adversity exact 3');for(const it of e.items!) grades.add(gearRank(it));enemies++;}
}
ok(grades.size===3 && !grades.has(5),'three grades only, no legendary equipment');
{
 const r=R.newRun(99,['jaehwon'],'waste',6);
 ok(R.genEncounter(r,'adversity').enemies.every(e=>(e.items?.length||0)<=1),'lower difficulty phase1 not forced 3');
}
ok(powNum({b:null,c:null,p:{}},'shoot',0.9,false,false,'elec').includes('112.5%'),'electric coefficient tooltip includes multiplier');
// Opening supply is usable and actual battles with both changed units finish cleanly.
{
 const run=R.newRun(911,['jaehwon','fotini'],'waste',7);run.pending=[];
 R.enterNode(run,'supply');const p=run.pending.find(x=>x.t==='supply');ok(p,'opening supply queued');
 if(p?.t==='supply'){R.flipAllSupply(run,p);ok(p.options.every(c=>c.open),'opening supply cards resolve');}
}
for(const id of ['jaehwon','fotini'])for(const field of ['waste','olympus','livin']) {
 const run=R.newRun(87,[id],'waste',7);run.field=field;run.pending=[];
 for(const type of ['battle','adversity','boss'] as const){
  const b=buildBattle(run,R.genEncounter(run,type));b.runToEnd();
  ok(b.over&&b.units.every(u=>Number.isFinite(u.hp)&&Number.isFinite(u.counters.dmg)),`battle completes ${id}/${field}/${type}`);
 }
}
console.log(JSON.stringify({passed:true,checks,enemies,gradeValues:[...grades],legendCandidates:ALL_ADVANCED.length}));

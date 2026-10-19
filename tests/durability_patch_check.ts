import { CFG } from '../src/config';
import * as R from '../src/engine/run';
import { buildBattle, computeStats } from '../src/engine/build';
import { guardThreatTakenMult, provMult } from '../src/engine/combat';
import { SYN_BY_ID, UNI_XP } from '../src/data/synergies';
import type { EffectCtx } from '../src/engine/effects';
let n=0;
function near(a:number,b:number,msg:string){if(Math.abs(a-b)>1e-7)throw Error(`${msg}: ${a}/${b}`);n++;}
function ok(v:unknown,msg:string){if(!v)throw Error(msg);n++;}
near(CFG.adversityMult,1.25,'adversity strength');
{
 const r=R.newRun(1,['lindiwe'],'waste',7),u=r.units[0];
 const a=computeStats(u,[]).st;u.perm.vit++;u.perm.def++;const b=computeStats(u,[]).st;
 near(b.maxHp-a.maxHp,138,'one vitality grants 138 HP');near(b.armor-a.armor,69,'one defense grants 69 armor');
}
for(let t=1;t<=4;t++){
 const ctx={run:null,unit:null,counts:{MED:t*2},phase:1,credits:0} as EffectCtx;
 const e=SYN_BY_ID.MED.team!(t,ctx);near(e!.pct!.maxHp!,[0.1,0.2,0.4,0.6][t-1],`MED tier ${t}`);
}
// Verify real post-battle UNI XP award against a zero-award control, same composition and RNG.
for(let t=1;t<=4;t++){
 const ids=['gebek','west','mirinae','issac','eden','winter','donovan','yelena','chloe'].slice(0,[3,5,7,9][t-1]);
 const settle=(award:number)=>{
  const run=R.newRun(90,ids,'waste',3);run.pending=[];
  run.units.forEach((u,i)=>{u.pos={c:i%5,r:Math.floor(i/5)};if(i>=7)u.mod='M_UNI';});
  R.enterNode(run,'battle');const b=buildBattle(run,run.node!.enc!);b.winner=0;
  const old=UNI_XP[t];UNI_XP[t]=award;const result=R.resolveBattle(run,b);UNI_XP[t]=old;
  return result.xp;
 };
 const zero=settle(0),full=settle(UNI_XP[t]);
 for(let i=0;i<full.length;i++)near(full[i].amount-zero[i].amount,UNI_XP[t],`UNI tier ${t} extra XP`);
}
// Real GUARD member setup and actual damage, including true damage and direct field damage.
for(const count of [2,4,6,8]){
 const run=R.newRun(1,['lindiwe'],'waste',7);const enc=R.genEncounter(run,'battle');const b=buildBattle(run,enc);
 const u=b.units.find(x=>x.side===0)!,foe=b.units.find(x=>x.side===1)!;
 u.hooks=[];u.statuses=[];u.mods=[];u.taken=[];u.mem={};u.st.maxHp=1e8;u.hp=1e8;u.shield=0;u.st.armor=0;u.keywords=['struct'];u.category='struct';u.synergies.add('GUARD');
 const ctx={run,unit:run.units[0],counts:{GUARD:count},phase:1,credits:0} as EffectCtx;
 SYN_BY_ID.GUARD.member!(count/2,ctx)!.setup!(u,b,ctx);
 near(provMult(b,u),4.5,'van + guard threat');
 const rate=count===8?0.1:count>=4?0.05:0;const f=1-4.5*rate;
 near(guardThreatTakenMult(b,u),f,`GUARD ${count} multiplier`);
 foe.hooks=[];foe.mods=[];foe.taken=[];foe.mem={};foe.phaseAmp=1;foe.st.crit=0;
 near(b.dealDamage(foe,u,100,{elem:'true',tag:'skill',kind:'shoot'}).amount,100*f,`GUARD ${count} true damage reduction`);
 near(b.rawHit(foe,u,100,'phys'),100*f,`GUARD ${count} direct damage reduction`);
 near(b.rawHit(foe,u,100*f,'phys',true),100*f,`GUARD ${count} resolved transfer no double reduction`);
 u.mem.provPlus=2;near(guardThreatTakenMult(b,u),1-6.5*rate,'gear threat dynamic');
 u.mem.provPlus=100;near(guardThreatTakenMult(b,u),rate?1-CFG.reductionCap:1,'existing reduction cap');
}
console.log(JSON.stringify({passed:true,checks:n}));

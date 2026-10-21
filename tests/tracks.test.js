import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_TRACKS,groupTracks,mergeTracks} from '../src/tracks.js';
import {personalBests} from '../src/laps.js';
test('Track groups preserve every legacy configuration ID and separate layouts',()=>{
 const legacy=['sow_cw','sow_ccw','big_willow','btn_cw13','btn_ccw13','btn_circuit','btn_cw1','chuck_cw','chuck_ccw','laguna','sonoma','thunder','spring_mtn','lvms','tsukuba'];
 assert.equal(new Set(BUILTIN_TRACKS.map(t=>t.id)).size,BUILTIN_TRACKS.length);
 for(const id of legacy)assert.ok(BUILTIN_TRACKS.find(t=>t.id===id));
 const groups=groupTracks(BUILTIN_TRACKS),buttonwillow=groups.find(g=>g.name==='Buttonwillow');
 assert.equal(groups.filter(g=>g.name==='Buttonwillow').length,1);
 assert.ok(buttonwillow.layouts.some(t=>t.id==='btn_cw13'));
 assert.ok(buttonwillow.layouts.some(t=>t.id==='btn_ccw1'));
 assert.ok(buttonwillow.layouts.some(t=>t.id==='btn_ccw13a'));
 assert.ok(groups.find(g=>g.name==='Thunderhill').layouts.some(t=>t.id==='thunder_east_bypass'));
 assert.match(BUILTIN_TRACKS.find(t=>t.id==='sonoma').variant,/unspecified/);
 // Existing named submissions resolve directly to their original layout.
 for(const [id,name,variant] of [
  ['btn_cw13','Buttonwillow','Classic #13 · CW'],
  ['btn_ccw13','Buttonwillow','Classic #13 · CCW'],
  ['btn_cw1','Buttonwillow','Classic #1 · CW'],
  ['btn_circuit','Buttonwillow','The Circuit'],
  ['sow_ccw','Streets of Willow','CCW'],
  ['thunder','Thunderhill','5 mile · combined'],
 ]){const t=BUILTIN_TRACKS.find(t=>t.id===id);assert.equal(t.name,name);assert.equal(t.variant,variant);}
});
test('Custom layouts join their circuit without duplicating IDs or losing distinct configurations',()=>{
 const merged=mergeTracks([{id:'sow_cw',name:'Duplicate',variant:'CW',region:'SoCal'},{id:'sow_new',name:'Streets of Willow',variant:'New configuration',region:'SoCal'}]);
 assert.equal(merged.length,BUILTIN_TRACKS.length+1);
 assert.equal(groupTracks(merged).find(g=>g.name==='Streets of Willow').layouts.length,3);
});
test('Same driver and car retain distinct PBs for every configuration',()=>{
 const laps=['btn_cw13','btn_ccw13','btn_cw13a','thunder_east_cyclone','thunder_east_bypass'].map((track,i)=>({track,driver:'Driver',car:'GR86',time:`1:2${i}.000`}));
 assert.equal(personalBests(laps).length,5);
 assert.equal(personalBests(laps,{track:'btn_cw13'}).length,1);
});

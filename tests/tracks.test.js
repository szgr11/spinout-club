import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILTIN_TRACKS,groupTracks,mergeTracks,listedBoardTracks} from '../src/tracks.js';
import {getTrackMap,TRACE_PRESETS} from '../src/track-maps.js';
import {personalBests} from '../src/laps.js';
test('Track groups preserve every legacy configuration ID and separate layouts',()=>{
 const legacy=['sow_cw','sow_ccw','big_willow','btn_cw13','btn_ccw13','btn_circuit','btn_cw1','chuck_cw','chuck_ccw','laguna','sonoma','thunder','spring_mtn','lvms','tsukuba'];
 assert.equal(new Set(BUILTIN_TRACKS.map(t=>t.id)).size,BUILTIN_TRACKS.length);
 for(const id of legacy)assert.ok(BUILTIN_TRACKS.find(t=>t.id===id));
 const groups=groupTracks(BUILTIN_TRACKS),buttonwillow=groups.find(g=>g.key==='buttonwillow');
 assert.equal(groups.filter(g=>g.key==='buttonwillow').length,1);
 assert.ok(buttonwillow.layouts.some(t=>t.id==='btn_cw13'));
 assert.ok(buttonwillow.layouts.some(t=>t.id==='btn_ccw1'));
 assert.ok(buttonwillow.layouts.some(t=>t.id==='btn_ccw13a'));
 assert.ok(groups.find(g=>g.key==='thunderhill').layouts.some(t=>t.id==='thunder_east_bypass'));
 assert.match(BUILTIN_TRACKS.find(t=>t.id==='sonoma').variant,/unspecified/);
 // Existing named submissions resolve directly to their original layout.
 for(const [id,name,variant] of [
  ['btn_cw13','Buttonwillow Raceway Park','Classic #13 · CW'],
  ['btn_ccw13','Buttonwillow Raceway Park','Classic #13 · CCW'],
  ['btn_cw1','Buttonwillow Raceway Park','Classic #1 · CW'],
  ['btn_circuit','Buttonwillow Raceway Park','The Circuit'],
  ['sow_ccw','Streets of Willow Springs','CCW'],
  ['thunder','Thunderhill Raceway Park','5 mile · combined'],
 ]){const t=BUILTIN_TRACKS.find(t=>t.id===id);assert.equal(t.name,name);assert.equal(t.variant,variant);}
});
test('Saved catalog overrides built-ins and preserves stable circuit grouping',()=>{
 const merged=mergeTracks([{id:'sow_cw',name:'Renamed Streets',variant:'Clockwise',region:'SoCal',hidden:true},{id:'sow_new',circuit_id:'streets_of_willow',name:'Renamed Streets',variant:'New configuration',region:'SoCal'}]);
 assert.equal(merged.length,BUILTIN_TRACKS.length+1);
 assert.equal(merged.find(t=>t.id==='sow_cw').name,'Renamed Streets');
 assert.equal(merged.find(t=>t.id==='sow_cw').hidden,true);
 assert.equal(groupTracks(merged).find(g=>g.key==='streets_of_willow').layouts.length,3);
});
test('Same driver and car retain distinct PBs for every configuration',()=>{
 const laps=['btn_cw13','btn_ccw13','btn_cw13a','thunder_east_cyclone','thunder_east_bypass'].map((track,i)=>({track,driver:'Driver',car:'GR86',time:`1:2${i}.000`}));
 assert.equal(personalBests(laps).length,5);
 assert.equal(personalBests(laps,{track:'btn_cw13'}).length,1);
});

test('Boards auto-hide empty layouts and circuits while respecting manual visibility',()=>{
 const tracks=BUILTIN_TRACKS.map(t=>t.id==='sow_cw'?{...t,active:false}:t.id==='btn_ccw13'?{...t,hidden:true}:t);
 const approved=[{track:'sow_cw',time:'1:30.000',type:'optimal'},{track:'btn_cw13',time:'2:00.000'},{track:'btn_ccw13',time:'1:59.000'},{track:'lvms',time:'invalid'}];
 const listed=listedBoardTracks(tracks,approved);
 assert.deepEqual(listed.map(t=>t.id),['sow_cw','btn_cw13']);
 assert.equal(groupTracks(listed).find(g=>g.key==='buttonwillow').layouts.length,1);
 assert.equal(groupTracks(listed).some(g=>g.key==='lvms'),false);
 assert.equal(listed[0].active,false); // Archived history is still listed.
 assert.equal(listedBoardTracks(tracks,[]).length,0);
 const firstTime=[...approved,{track:'btn_circuit',time:'1:58.000'}];
 assert.ok(listedBoardTracks(tracks,firstTime).some(t=>t.id==='btn_circuit'));
 assert.equal(listedBoardTracks(tracks,firstTime.filter(l=>l.track!=='btn_cw13')).some(t=>t.id==='btn_cw13'),false);
 assert.ok(tracks.some(t=>t.id==='btn_cw25a'&&t.active&&!t.hidden)); // First-time submissions stay possible.
});

test('Map credits and configuration identities follow their actual references',()=>{
 for(const map of Object.values(TRACE_PRESETS)){assert.match(map.source,/^https:\/\//);assert.ok(map.path.length>20);}
 const by=id=>getTrackMap(BUILTIN_TRACKS.find(t=>t.id===id));
 assert.notEqual(by('thunder_east_bypass').path,by('thunder_east_cyclone').path);
 assert.equal(by('btn_cw13').path,by('btn_ccw13').path);
 assert.notEqual(by('btn_cw13').path,by('btn_circuit').path);
 assert.notEqual(by('btn_cw13').path,by('btn_cw13a').path);
 assert.notEqual(by('btn_cw25').path,by('btn_cw25a').path);
 for(const id of ['sow_cw','sonoma','spring_mtn','thunder','tsukuba'])assert.equal(by(id).scope,'venue');
 assert.equal(by('lvms'),null); // Its historical CW entry does not identify a particular road course.
 const custom=getTrackMap({name:'New track',variant:'New layout',map_path:'M1 2L3 4Z',map_source:'javascript:alert(1)'});
 assert.equal(custom,null);
});

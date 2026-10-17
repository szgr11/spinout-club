import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateLaps,personalBests,memberLapHistory,personalBestKey,readLapPages} from '../src/laps.js';
test('duplicate imports collapse without hiding separate days, layouts or conditions',()=>{
 const lap={id:'a',track:'btn_cw13',driver:'Ray',time:'2:00.00',date:'2026-10-16',temp:'20C',type:'real'};
 const result=deduplicateLaps([lap,{...lap,id:'b'},{...lap,id:'c',track:'btn_ccw13'},{...lap,id:'d',date:'2026-10-17'},{...lap,id:'e',type:'optimal'},{...lap,id:'f',temp:'30C'}]);
 assert.deepEqual(result.map(x=>x.id),['a','c','d','e','f']);
});
const lap={id:'old',track:'btn_cw13',driver:'Ray',car:'GR86',time:'2:05.00',date:'2026-09-01',type:'real',submittedBy:'ray'};
test('boards retain a separate PB per driver, vehicle and layout, without altering history',()=>{
 const input=[lap,{...lap,id:'new',time:'2:01.23',date:'2026-10-17'},{...lap,id:'m3',car:'M3',time:'1:58.00'},{...lap,id:'other-driver',driver:'Annie'},{...lap,id:'other-layout',track:'btn_ccw13'}];
 assert.deepEqual(personalBests(input,{track:'btn_cw13'}).map(l=>l.id),['m3','new','other-driver']);
 assert.equal(personalBests(input).length,4);assert.equal(input.length,5);
 assert.deepEqual(memberLapHistory(input,'ray').map(l=>l.id),['new','m3','old','other-driver','other-layout']);
});
test('label normalization ignores formatting without merging different models and trims',()=>{
 const rows=personalBests([lap,{...lap,id:'formatted',driver:'  RAY ',car:' gr86  ',time:'2:00.00'},{...lap,id:'trim',car:'GR86 Premium'},{...lap,id:'other',car:'Toyota GR86'}]);
 assert.equal(rows.length,3);assert.equal(rows[0].id,'formatted');
 assert.equal(personalBests([{...lap,driver:'__proto__'},lap]).length,2);
});
test('real/optimal filtering happens before selecting each vehicle PB',()=>{
 const rows=[lap,{...lap,id:'optimal',type:'optimal',time:'1:59.00'},{...lap,id:'invalid',time:'0:99.00'}];
 assert.deepEqual(personalBests(rows,{type:'real'}).map(l=>l.id),['old']);
 assert.deepEqual(personalBests(rows,{type:'optimal'}).map(l=>l.id),['optimal']);
 assert.equal(personalBests(rows)[0].id,'optimal');assert.equal(memberLapHistory(rows,'ray').length,3);
});
test('equal PBs resolve deterministically to the earlier achievement',()=>{
 const rows=[{...lap,id:'later',date:'2026-10-17'},lap];
 assert.equal(personalBests(rows)[0].id,'old');assert.equal(personalBests([...rows].reverse())[0].id,'old');
 assert.equal(personalBestKey(lap),personalBestKey({...lap,car:' GR86 '}));
});
test('member history uses submission ownership, supports all filters and keeps slower laps',()=>{
 const rows=[lap,{...lap,id:'new',date:'2026-10-17',time:'2:10.00'},{...lap,id:'not-mine',submittedBy:'someone-else'},{...lap,id:'unclaimed',submittedBy:null},{...lap,id:'m3',car:'M3',type:'optimal'},{...lap,id:'ccw',track:'btn_ccw13'}];
 assert.deepEqual(memberLapHistory(rows,'ray',{track:'btn_cw13',car:'gr86',type:'real'}).map(l=>l.id),['new','old']);
 assert.equal(memberLapHistory(rows,'someone-else').length,1);assert.deepEqual(memberLapHistory(rows,''),[]);
 assert.equal(memberLapHistory([{...lap,submittedBy:undefined,submitted_by:'ray'}],'ray').length,1);
});
test('duplicate-import cleanup never hides another account’s identical result',()=>{
 assert.equal(deduplicateLaps([lap,{...lap,id:'duplicate'},{...lap,id:'other-member',submittedBy:'annie'}]).length,2);
});
test('approved lap loading follows stable pages and never reports a partial history as complete',async()=>{
 const calls=[],rows=[lap,{...lap,id:'two'},{...lap,id:'three'}];let fail=false;
 const client={from:table=>({select:columns=>({order:key=>({range:async(from,to)=>{calls.push({table,columns,key,from,to});return fail&&from>0?{data:null,error:{message:'unavailable'}}:{data:rows.slice(from,to+1),error:null};}})})})};
 const result=await readLapPages(client,'laps','id,time',2);assert.equal(result.data.length,3);assert.deepEqual(calls.map(c=>[c.from,c.to]),[[0,1],[2,3]]);assert.ok(calls.every(c=>c.key==='id'&&c.columns==='id,time'));
 fail=true;const failure=await readLapPages(client,'laps','id,time',2);assert.equal(failure.data,null);assert.equal(failure.error.message,'unavailable');
});

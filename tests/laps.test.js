import test from 'node:test';
import assert from 'node:assert/strict';
import {deduplicateLaps} from '../src/laps.js';
test('duplicate imports collapse without hiding separate days, layouts or conditions',()=>{
 const lap={id:'a',track:'btn_cw13',driver:'Ray',time:'2:00.00',date:'2026-10-16',temp:'20C',type:'real'};
 const result=deduplicateLaps([lap,{...lap,id:'b'},{...lap,id:'c',track:'btn_ccw13'},{...lap,id:'d',date:'2026-10-17'},{...lap,id:'e',type:'optimal'},{...lap,id:'f',temp:'30C'}]);
 assert.deepEqual(result.map(x=>x.id),['a','c','d','e','f']);
});

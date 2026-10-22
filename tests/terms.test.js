import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {TERMS,TERMS_HASH,TERMS_WAIT_SECONDS,canonicalTerms} from '../src/terms.js';
test('the displayed document matches the immutable server version and fingerprint',async()=>{
 assert.equal(createHash('sha256').update(canonicalTerms).digest('hex'),TERMS_HASH);
 assert.equal(TERMS_WAIT_SECONDS,12);
 const sql=await readFile(new URL('../supabase/migrations/20261022032823_publish_public_and_member_terms.sql',import.meta.url),'utf8');
 assert.ok(sql.includes(`values('${TERMS.version}','${TERMS_HASH}','${canonicalTerms.replaceAll("'","''")}'::jsonb,true)`));
 assert.ok(TERMS.sections.some(s=>s.title.includes('Copyright')));
 assert.ok(TERMS.sections.some(s=>s.title.startsWith('7.1.')));
 assert.doesNotMatch(canonicalTerms,/WING ACE|WALMART|UCLA|Rudnicki|Drafting Review|Sources reviewed/);
});

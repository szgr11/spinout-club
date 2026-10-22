import test from 'node:test';
import assert from 'node:assert/strict';
import {TERMS,TERMS_HASH} from '../src/terms.js';
import {PUBLIC_TERMS_KEY,parsePublicAcceptance,readPublicAcceptance,savePublicAcceptance} from '../src/public-terms.js';

test('public acceptance survives a return visit and is tied to the precise agreement',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 assert.equal(readPublicAcceptance(storage),null);
 const {receipt,persisted}=savePublicAcceptance(storage,new Date('2026-10-22T03:30:00Z'));
 assert.equal(persisted,true);
 assert.deepEqual(readPublicAcceptance(storage),receipt);
 assert.equal(receipt.version,TERMS.version);assert.equal(receipt.contentHash,TERMS_HASH);
 for(const override of [{version:'2026-10-21'},{contentHash:'0'.repeat(64)},{agreed:false},{scope:'member'},{acceptedAt:'invalid'}]){
  assert.equal(parsePublicAcceptance(JSON.stringify({...receipt,...override})),null);
 }
 values.delete(PUBLIC_TERMS_KEY);assert.equal(readPublicAcceptance(storage),null);
 assert.equal('auth_user_id' in receipt,false);
});
test('blocked or corrupted browser storage cannot crash the public agreement',()=>{
 assert.equal(parsePublicAcceptance('broken'),null);
 assert.equal(parsePublicAcceptance('null'),null);
 const storage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(readPublicAcceptance(storage),null);
 const result=savePublicAcceptance(storage);
 assert.equal(result.persisted,false);assert.equal(result.receipt.agreed,true);
 assert.equal(readPublicAcceptance(null),null);
});

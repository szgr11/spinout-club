import test from 'node:test';
import assert from 'node:assert/strict';
import {canModerate,canSuspend,isAdmin,roleLabel} from '../src/permissions.js';
const admin={role:'admin',banned:false},mod={role:'member',moderator:true,banned:false},member={role:'member',moderator:false,banned:false};
test('moderators receive content controls but never admin controls',()=>{
 assert.equal(canModerate(admin),true);assert.equal(isAdmin(admin),true);
 assert.equal(canModerate(mod),true);assert.equal(isAdmin(mod),false);
 for(const account of [null,member,{...mod,banned:true},{...admin,banned:true},{role:'system',moderator:true}])assert.equal(canModerate(account),false);
});
test('suspension controls protect staff from mods',()=>{
 assert.equal(canSuspend(mod,member),true);assert.equal(canSuspend(mod,mod),false);assert.equal(canSuspend(mod,admin),false);
 assert.equal(canSuspend(admin,mod),true);assert.equal(canSuspend(admin,admin),false);assert.equal(canSuspend(member,member),false);
 assert.equal(canSuspend({...mod,banned:true},member),false);
});
test('role labels retain staff identity when suspended without granting permissions',()=>{
 assert.equal(roleLabel({...mod,banned:true}),'◇ MOD');assert.equal(roleLabel(admin),'◆ ADMIN');assert.equal(roleLabel(member),'◇ MEMBER');
});

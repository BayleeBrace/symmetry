import test from 'node:test';
import assert from 'node:assert/strict';
import {renewStaffSession,resetStaffSession,StaffSignInRequired} from '../src/lib/staff-client.ts';
test('concurrent diary requests share a renewal and do not repeatedly rotate tokens',async()=>{
 const original=globalThis.fetch;let requests=0;resetStaffSession();
 globalThis.fetch=async()=>{requests++;await new Promise(r=>setTimeout(r,5));return Response.json({ok:true});};
 try{await Promise.all([renewStaffSession(),renewStaffSession(),renewStaffSession()]);await renewStaffSession();assert.equal(requests,1);}finally{globalThis.fetch=original;resetStaffSession();}
});
test('rejected renewal requires sign-in and transient failures remain retryable',async()=>{
 const original=globalThis.fetch;resetStaffSession();
 try{globalThis.fetch=async()=>Response.json({error:'Sign in again'},{status:401});await assert.rejects(renewStaffSession(),StaffSignInRequired);globalThis.fetch=async()=>Response.json({ok:true});await renewStaffSession();}finally{globalThis.fetch=original;resetStaffSession();}
});

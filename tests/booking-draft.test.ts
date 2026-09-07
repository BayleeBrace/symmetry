import test from 'node:test';
import assert from 'node:assert/strict';
import {readDraft,encodeDraft} from '../src/lib/booking-draft.ts';
const basket=[{date:'2026-10-01',time:720,barber:'sean' as const,service:'fade',duration:40,price:24}];
test('booking recovery keeps trim choices but strips personal fields',()=>{
 const raw=encodeDraft([{...basket[0],...{email:'never-save@example.com',card:'never-save',preferences:'private'}}],1000);
 assert(!raw.includes('never-save'));assert(!raw.includes('private'));
 assert.deepEqual(readDraft(raw,1001)?.basket,basket);
});
test('stale, malformed and tampered drafts are discarded',()=>{
 assert.equal(readDraft(encodeDraft(basket,1000),7201001),null);
 assert.equal(readDraft('broken'),null);
 assert.equal(readDraft(JSON.stringify({savedAt:1000,basket:[{...basket[0],barber:'other'}]}),1001),null);
 assert.equal(readDraft(encodeDraft(basket,2000),1000),null);
});

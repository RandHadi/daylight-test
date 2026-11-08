import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, task } from '../lib/planner-model.ts';
import { selectPlannerDraft, missingTaskIds, applyUndo } from '../lib/planner-sync.ts';

const before = () => initialState('2026-11-07');
const imported = () => {
    const state = before();
    state.tasks.push({...task('Imported task', '2026-11-07', 'product'), id:'sunsama:restored', sample:false});
    return state;
};
test('old draft is preserved separately while cloud tasks remain active through sync and reload', () => {
    const cloud = imported();
    const old = structuredClone(cloud);old.tasks.pop();
    const raw = JSON.stringify({state:old,revision:4});
    const result = selectPlannerDraft(cloud, 9, raw);
    assert.equal(result.archive, raw);assert.equal(result.recovered,false);
    assert.deepEqual(result.state, cloud);
    // Calendar synchronization writes only from the selected cloud state.
    const synchronized = structuredClone(result.state);synchronized.blocks=[];
    const next = selectPlannerDraft(cloud,9,JSON.stringify({state:synchronized,revision:9}));
    assert.ok(next.state.tasks.some(t=>t.id==='sunsama:restored'));
});
test('already-rebased stale draft is also rejected even when its revision matches', () => {
    const cloud=imported(),stale=structuredClone(cloud);stale.tasks.pop();
    const raw=JSON.stringify({state:stale,revision:9});
    assert.equal(selectPlannerDraft(cloud,9,raw).archive,raw);
    assert.deepEqual(missingTaskIds(cloud,stale),['sunsama:restored']);
});
test('same-revision unsaved edits recover normally without mutating the cloud', () => {
    const cloud=imported(),draft=structuredClone(cloud);draft.tasks.at(-1)!.title='Pending edit';
    const result=selectPlannerDraft(cloud,9,JSON.stringify({state:draft,revision:9}));
    assert.equal(result.recovered,true);assert.equal(result.archive,null);
    assert.equal(result.state.tasks.at(-1)!.title,'Pending edit');
    assert.equal(cloud.tasks.at(-1)!.title,'Imported task');
});
test('malformed and invalid drafts are preserved without becoming the active planner', () => {
    const cloud=imported();
    for(const raw of ['not JSON',JSON.stringify({state:{tasks:[]},revision:9})]) {
        assert.equal(selectPlannerDraft(cloud,9,raw).archive,raw);
        assert.deepEqual(selectPlannerDraft(cloud,9,raw).state,cloud);
    }
});
test('normal edits, trash, reordering and clearing samples do not trip the server guard', () => {
    const cloud=imported(),next=structuredClone(cloud);
    next.tasks=next.tasks.filter(t=>!t.sample).reverse();next.tasks[0].deleted=new Date().toISOString();
    assert.deepEqual(missingTaskIds(cloud,next),[]);
});
test('undoing creation retains a recoverable tombstone and satisfies the save guard', () => {
    const previous=before(),current=structuredClone(previous);
    current.tasks.push({...task('New task','2026-11-07','product'),id:'new',sample:false});
    const saved=structuredClone(current);applyUndo(current,previous);
    assert.ok(current.tasks.find(t=>t.id==='new')!.deleted);
    assert.deepEqual(missingTaskIds(saved,current),[]);
});
test('no local draft uses saved cloud directly', () => {
    const cloud=imported();assert.deepEqual(selectPlannerDraft(cloud,9,null),{state:cloud,archive:null,recovered:false});
});

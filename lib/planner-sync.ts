import type { State } from './planner-model.ts';
import { stateSchema } from './state-schema.ts';

// Deletion uses tombstones. A whole-planner save must never silently drop real
// task IDs, even if an old client has accidentally rebased its stale revision.
export function missingTaskIds(saved: State, incoming: State): string[] {
    const ids = new Set(incoming.tasks.map(task => task.id));
    return saved.tasks.filter(task => !task.sample && !ids.has(task.id)).map(task => task.id);
}

export function selectPlannerDraft(cloud: State, revision: number, raw: string | null): {
    state: State; archive: string | null; recovered: boolean;
} {
    if (!raw) return { state: cloud, archive: null, recovered: false };
    try {
        const draft = JSON.parse(raw);
        const parsed = stateSchema.safeParse(draft.state);
        if (draft.revision === revision && parsed.success && !missingTaskIds(cloud, parsed.data as State).length) {
            return { state: parsed.data as State, archive: null, recovered: true };
        }
    } catch { /* Preserve malformed drafts too, for manual recovery. */ }
    return { state: cloud, archive: raw, recovered: false };
}

export function applyUndo(current: State, previous: State): void {
    const restored = structuredClone(previous);
    const ids = new Set(restored.tasks.map(task => task.id));
    for (const task of current.tasks) {
        if (!task.sample && !ids.has(task.id)) restored.tasks.push({ ...task, deleted: new Date().toISOString() });
    }
    Object.assign(current, restored);
}

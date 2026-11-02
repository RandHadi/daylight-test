import { z } from 'zod';
import { type State, task, moveTask } from './planner-model.ts';
import { sortDay } from './planner-advanced.ts';
const action = z.object({ kind: z.enum(['create', 'update', 'schedule', 'prioritize']), taskId: z.string(), title: z.string().max(500), date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/), minutes: z.number().int().min(5).max(720), channel: z.string(), priority: z.enum(['low', 'normal', 'important', 'urgent']), notes: z.string().max(10000) }).strict();
export const assistantSchema = z.object({ message: z.string().max(6000), actions: z.array(action).max(50) }).strict();
export type Suggestion = z.infer<typeof assistantSchema>;
export const outputSchema = { type: 'object', additionalProperties: false, required: ['message', 'actions'], properties: { message: { type: 'string' }, actions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['kind', 'taskId', 'title', 'date', 'minutes', 'channel', 'priority', 'notes'], properties: { kind: { type: 'string', enum: ['create', 'update', 'schedule', 'prioritize'] }, taskId: { type: 'string' }, title: { type: 'string' }, date: { type: 'string' }, minutes: { type: 'integer' }, channel: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'important', 'urgent'] }, notes: { type: 'string' } } } } } };
export function validateSuggestion(result: unknown, s: State): Suggestion {
    const parsed = assistantSchema.parse(result);
    for (const a of parsed.actions) {
        if (a.date && new Date(a.date + 'T12:00:00Z').toISOString().slice(0, 10) !== a.date)
            throw Error('The assistant returned an invalid date.');
        if (!s.channels.some(c => c.id === a.channel))
            throw Error('The assistant returned an unknown channel.');
        if (a.kind !== 'create' && !s.tasks.some(t => t.id === a.taskId && !t.deleted))
            throw Error('The assistant referenced a task that is no longer available.');
        if (a.kind === 'create' && !a.title.trim())
            throw Error('A proposed task needs a title.');
    }
    return parsed;
}
export function applySuggestion(s: State, result: Suggestion): void { const valid = validateSuggestion(result, s); for (const a of valid.actions) {
    if (a.kind === 'create') {
        const t = task(a.title.trim(), a.date || null, a.channel, a.minutes);
        t.priority = a.priority;
        t.notes = a.notes;
        s.tasks.push(t);
    }
    else {
        const t = s.tasks.find(t => t.id === a.taskId)!;
        if (a.kind === 'update') {
            t.title = a.title.trim() || t.title;
            t.minutes = a.minutes;
            t.channel = a.channel;
            t.notes = a.notes;
            t.edited = true;
        }
        if (a.kind === 'schedule' || a.kind === 'update')
            moveTask(s, t.id, a.date || null);
        t.priority = a.priority;
    }
} if (s.settings.autoSort)
    for (const d of new Set(valid.actions.map(a => a.date).filter(Boolean)))
        sortDay(s, d); }

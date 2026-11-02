import { type Block, type State, uid, shiftDate } from './planner-model.ts';
import { zonedParts, wallToEpoch, validTimezone } from './calendar-time.ts';
export function parseCalendar(text: string, timezone: string): {
    events: Block[];
    warnings: string[];
} {
    if (!text.includes('BEGIN:VCALENDAR'))
        throw Error('Choose a valid .ics calendar file.');
    const normalized = text.replace(/\r?\n[ \t]/g, '');
    const events: Block[] = [], warnings: string[] = [];
    for (const raw of normalized.split('BEGIN:VEVENT').slice(1, 1001)) {
        const lines = raw.split('END:VEVENT')[0].split(/\r?\n/), fields = new Map<string, {
            key: string;
            value: string;
        }>();
        for (const line of lines) {
            const at = line.indexOf(':');
            if (at < 0)
                continue;
            const key = line.slice(0, at);
            fields.set(key.split(';')[0], { key, value: line.slice(at + 1) });
        }
        const val = (key: string) => fields.get(key)?.value || '';
        const title = val('SUMMARY').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').slice(0, 500) || 'Calendar event';
        if (val('STATUS') === 'CANCELLED')
            continue;
        if (fields.has('RRULE')) {
            warnings.push(`“${title}” repeats: only the supplied occurrence will be imported.`);
        }
        function stamp(name: string) { const f = fields.get(name); if (!f)
            return null; const match = f.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!match)
            throw Error('Unsupported calendar date.'); const day = `${match[1]}-${match[2]}-${match[3]}`, minute = Number(match[4] || 0) * 60 + Number(match[5] || 0), zone = f.key.match(/TZID=([^;]+)/)?.[1].replace(/^"|"$/g, '') || timezone; if (match[7])
            return Date.UTC(+match[1], +match[2] - 1, +match[3], +(match[4] || 0), +(match[5] || 0)); if (!validTimezone(zone))
            throw Error(`Unsupported timezone ${zone}.`); return wallToEpoch(day, minute, zone); }
        try {
            let start = stamp('DTSTART');
            if (start === null)
                continue;
            const allDay = /^\d{8}$/.test(val('DTSTART'));
            let end = stamp('DTEND') ?? start + (allDay ? 86400000 : 1800000);
            if (end <= start || end - start > 32 * 86400000)
                throw Error('Invalid event duration.');
            const source = val('UID') || `${title}:${start}`;
            while (start < end) {
                const p = zonedParts(start, timezone), midnight = wallToEpoch(shiftDate(p.day, 1), 0, timezone), until = Math.min(end, midnight);
                const ending = until === midnight ? 1440 : zonedParts(until, timezone).minute;
                const minutes = Math.max(5, ending - p.minute);
                events.push({ id: uid(), title, date: p.day, start: p.minute, minutes: Math.min(1440 - p.minute, minutes), color: '#779bc1', busy: val('TRANSP') !== 'TRANSPARENT', sourceUid: `${source}:${p.day}` });
                start = until;
            }
        }
        catch {
            warnings.push(`“${title}” was skipped because its date or timezone could not be read.`);
        }
    }
    if (events.length > 2000)
        throw Error('Import a smaller calendar export.');
    return { events, warnings: [...new Set(warnings)] };
}
export function mergeCalendar(s: State, events: Block[]): {
    added: number;
    updated: number;
} { let added = 0, updated = 0; for (const event of events) {
    const existing = s.blocks.find(b => b.sourceUid && b.sourceUid === event.sourceUid);
    if (existing) {
        Object.assign(existing, { ...event, id: existing.id });
        updated++;
    }
    else {
        s.blocks.push(event);
        added++;
    }
} return { added, updated }; }

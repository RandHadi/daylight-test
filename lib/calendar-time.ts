/** Calendar wall-clock values belong to the saved planner timezone, never the current device. */
export function zonedParts(epoch: number, timezone: string) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(epoch).map(p => [p.type, p.value]));
    return { day: `${p.year}-${p.month}-${p.day}`, minute: Number(p.hour) * 60 + Number(p.minute), second: Number(p.second) };
}
export function wallToEpoch(day: string, minute: number, timezone: string) {
    const [y, m, d] = day.split('-').map(Number), target = Date.UTC(y, m - 1, d, 0, minute);
    let guess = target;
    for (let i = 0; i < 4; i++) {
        const p = zonedParts(guess, timezone), [py, pm, pd] = p.day.split('-').map(Number), seen = Date.UTC(py, pm - 1, pd, 0, p.minute, p.second);
        const delta = target - seen;
        if (!delta)
            return guess;
        guess += delta;
    }
    return guess;
}
export function validTimezone(value: string) { try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
}
catch {
    return false;
} }

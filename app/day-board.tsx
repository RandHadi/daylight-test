'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { shiftDate } from '@/lib/planner-model';

const BUFFER = 9;
const WINDOW_DAYS = 21;

/** A bounded strip that replenishes dates at either edge without moving the visible days. */
export function DayBoard({ selected, onSelect, renderDay }: {
    selected: string;
    onSelect: (day: string) => void;
    renderDay: (day: string) => ReactNode;
}) {
    const [start, setStart] = useState(() => shiftDate(selected, -BUFFER));
    const viewport = useRef<HTMLDivElement>(null);
    const settled = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reported = useRef<string | null>(null);
    const previousStart = useRef(start);
    const latestSelected = useRef(selected);
    latestSelected.current = selected;
    const days = Array.from({ length: WINDOW_DAYS }, (_, i) => shiftDate(start, i));

    useLayoutEffect(() => {
        const el = viewport.current;
        if (!el) return;
        if (settled.current) clearTimeout(settled.current);
        const index = days.indexOf(selected);
        if (index < 0 || index > WINDOW_DAYS - 3) {
            setStart(shiftDate(selected, -BUFFER));
            return;
        }
        // Native scrolling has already positioned this date. Keep fractional positions intact.
        if (reported.current !== selected || previousStart.current !== start) {
            const width = el.firstElementChild?.getBoundingClientRect().width || 0;
            el.scrollLeft = index * width;
        }
        reported.current = null;
        previousStart.current = start;
    }, [selected, start]);

    useLayoutEffect(() => {
        const el = viewport.current;
        if (!el) return;
        let previousWidth = el.clientWidth;
        const observer = new ResizeObserver(() => {
            if (!el.clientWidth || el.clientWidth === previousWidth) return;
            previousWidth = el.clientWidth;
            if (settled.current) clearTimeout(settled.current);
            const columns = Array.from(el.children) as HTMLElement[];
            const index = columns.findIndex(column => column.dataset.dropDay === latestSelected.current);
            if (index >= 0) el.scrollLeft = index * columns[0].getBoundingClientRect().width;
        });
        observer.observe(el);
        return () => {
            observer.disconnect();
            if (settled.current) clearTimeout(settled.current);
        };
    }, []);

    function onScroll() {
        if (settled.current) clearTimeout(settled.current);
        settled.current = setTimeout(() => {
            const el = viewport.current;
            const width = el?.firstElementChild?.getBoundingClientRect().width || 0;
            if (!el || !width) return;
            const index = Math.max(0, Math.min(WINDOW_DAYS - 1, Math.round(el.scrollLeft / width)));
            const day = shiftDate(start, index);
            reported.current = day;
            if (day !== latestSelected.current) onSelect(day);
            if (index < 3 || index > WINDOW_DAYS - 6) setStart(shiftDate(day, -BUFFER));
        }, 180);
    }

    return <div ref={viewport} className="board board-scroll" role="region" tabIndex={0}
        aria-label="Day board. Scroll left or right for more days."
        onScroll={onScroll}
        onKeyDown={event => {
            if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            onSelect(shiftDate(selected, event.key === 'ArrowRight' ? 3 : -3));
        }}>
        {days.map(renderDay)}
    </div>;
}

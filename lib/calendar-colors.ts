import type { CSSProperties } from 'react';

/** Keep the calendar's source color, with readable text on the solid fill. */
export function calendarColors(color: string): CSSProperties {
  const hex = /^#[\da-f]{6}$/i.test(color) ? color : '#709b8d';
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  const foreground = (luminance + .05) / .0676 >= 4.6 ? '#202521'
    : 1.05 / (luminance + .05) >= 4.5 ? '#ffffff' : '#000000';
  return {
    '--calendar-color': hex,
    '--calendar-foreground': foreground,
    '--calendar-stripe': foreground === '#ffffff' ? '#00000018' : '#ffffff33',
  } as CSSProperties;
}

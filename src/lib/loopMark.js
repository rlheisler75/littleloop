// Single source for the littleloop double-curly-loop mark (viewBox 0 0 40 20).
export const LOOP_MARK_PATH = 'M2.5 15.5C8 15.5 17 12.5 17 7.5 17 3 9.5 3 9.5 7.5 9.5 12.5 16 15.5 21 15.5 26.5 15.5 35.5 12.5 35.5 7.5 35.5 3 28 3 28 7.5 28 12.5 33 15.5 38 15.5';

// Inline SVG string for printable HTML (invoices, statements).
export function loopMarkSvg(color = '#E8553F', height = 18) {
  return `<svg width="${height * 2}" height="${height}" viewBox="0 0 40 20" fill="none" style="vertical-align:-2px;margin-right:6px"><path d="${LOOP_MARK_PATH}" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

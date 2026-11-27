import { useEffect, useRef, useState } from 'react';

// A row of menu tabs that may not fit on a phone (the daycare menu has up to 15).
// When more tabs are off to one side, that edge fades and a ‹ / › button appears there,
// so people can tell the row swipes; tapping the button slides it along. On a screen
// wide enough for every tab, nothing extra shows. Keeps the selected tab in view.
// Robert 2026-11-26: "need a way to let users know they can scroll the icons at top".
export default function ScrollRow({ children, className = '', style, outerStyle, activeKey }) {
  const ref = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  // Bring the selected tab into view (e.g. after opening a tab near the end).
  useEffect(() => {
    const el = ref.current;
    const active = el?.querySelector('.nav-tab.active');
    if (!el || !active) return;
    const left = active.offsetLeft, right = left + active.offsetWidth;
    if (left < el.scrollLeft) el.scrollTo({ left: left - 40, behavior: 'smooth' });
    else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth + 40, behavior: 'smooth' });
  }, [activeKey]);

  const nudge = dir => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: 'smooth' });
  const mask = edges.left || edges.right
    ? `linear-gradient(to right, ${edges.left ? 'transparent 0, #000 48px' : '#000 0'}, ${edges.right ? '#000 calc(100% - 48px), transparent 100%' : '#000 100%'})`
    : undefined;

  return (
    <div style={{ position: 'relative', ...outerStyle }}>
      <div ref={ref} className={className} style={{ ...style, WebkitMaskImage: mask, maskImage: mask }}>
        {children}
      </div>
      {edges.left && (
        <button type="button" className="scroll-row-btn left" aria-label="Show earlier menu items" onClick={() => nudge(-1)}>‹</button>
      )}
      {edges.right && (
        <button type="button" className="scroll-row-btn right" aria-label="Show more menu items" onClick={() => nudge(1)}>›</button>
      )}
    </div>
  );
}

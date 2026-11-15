import { LOOP_MARK_PATH } from '../../lib/loopMark';

// Brand loop mark. Replaces the ➿ emoji as the logo, which Windows draws as a
// blue key-cap tile that ignores the theme. Stroke follows the theme accent.
export default function LoopMark({ size = 22, color = 'var(--accent)', style }) {
  return (
    <svg
      width={size * 2}
      height={size}
      viewBox="0 0 40 20"
      fill="none"
      aria-hidden="true"
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
    >
      <path
        d={LOOP_MARK_PATH}
        stroke={color}
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Stored avatars can be the ➿ emoji (the default sitter avatar). Draw the mark
// instead so it isn't a blue tile; pass anything else through unchanged.
export function AvatarGlyph({ value, size = 22, color }) {
  if (value === '➿') return <LoopMark size={size * 0.55} color={color}/>;
  return value;
}

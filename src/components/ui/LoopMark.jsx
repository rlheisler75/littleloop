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
        d="M2.5 15.5C8 15.5 17 12.5 17 7.5 17 3 9.5 3 9.5 7.5 9.5 12.5 16 15.5 21 15.5 26.5 15.5 35.5 12.5 35.5 7.5 35.5 3 28 3 28 7.5 28 12.5 33 15.5 38 15.5"
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

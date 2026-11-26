export default function Spinner({ size = 16 }) {
  return (
    <span
      className="spin"
      style={{
        width:  size,
        height: size,
        border: '2px solid color-mix(in srgb,currentColor 25%,transparent)',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

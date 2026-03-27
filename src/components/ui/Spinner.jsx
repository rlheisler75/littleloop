export default function Spinner({ size = 16 }) {
  return (
    <span
      className="spin"
      style={{
        width:  size,
        height: size,
        border: '2px solid rgba(255,255,255,.2)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  );
}

import { useState } from 'react';

export default function StarRating({ value, onChange, size = 20 }) {
  const [hover, setHover] = useState(0);

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onClick={() => onChange && onChange(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{
            fontSize: size,
            cursor:   onChange ? 'pointer' : 'default',
            color:    (hover || value) >= i ? '#F5C518' : 'rgba(255,255,255,.2)',
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

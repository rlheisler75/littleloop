export default function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize:      10,
      fontWeight:    600,
      letterSpacing: '0.9px',
      textTransform: 'uppercase',
      color:         'var(--text-faint)',
      marginBottom:  10,
    }}>
      {children}
    </div>
  );
}

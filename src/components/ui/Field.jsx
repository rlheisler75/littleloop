export default function Field({
  label,
  type         = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required     = true,
  as           = 'input',
  rows         = 3,
}) {
  return (
    <div>
      <label className="fl">{label}</label>
      {as === 'textarea'
        ? (
          <textarea
            className="fi"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={rows}
            style={{ resize: 'vertical', marginBottom: 14 }}
          />
        ) : (
          <input
            className="fi"
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            required={required}
          />
        )
      }
    </div>
  );
}

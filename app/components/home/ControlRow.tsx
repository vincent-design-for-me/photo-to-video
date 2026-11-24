export function ControlRow({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  hint?: string | null;
}) {
  const name = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="control-row">
      <span className="control-label">
        {label}
        {hint && <span className="detected-hint">{hint}</span>}
      </span>
      <div className="pill-group">
        {options.map(opt => (
          <label className="pill-option" key={opt.value}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

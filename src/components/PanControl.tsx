import { formatPan } from "../domain/pan";

interface PanControlProps {
  /** スライダーの名前。どの系統の左右かを読み上げで区別する。 */
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (pan: number) => void;
}

// 左右を調整する折りたたみ。普段は隠し、必要なときだけ開く。
export function PanControl({ label, value, disabled = false, onChange }: PanControlProps) {
  return (
    <details className="pan">
      <summary className="pan__summary">左右</summary>
      <div className="app-card__row">
        <input
          type="range"
          min={-100}
          max={100}
          value={value}
          aria-label={label}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output className="app-card__value">{formatPan(value)}</output>
      </div>
    </details>
  );
}

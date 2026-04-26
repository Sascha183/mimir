import type { Bit } from '../../lib/gates/types';

interface Props {
  value: Bit;
  onChange: (v: Bit) => void;
  label: string;
  disabled?: boolean;
}

/**
 * Stand-alone iOS-style toggle. Used as a circuit input pin and anywhere else
 * we need a binary on/off control with consistent styling.
 *
 * Renders as a real <button role="switch"> so screen readers, keyboard nav,
 * and focus styling all work without any custom plumbing.
 */
export default function InputSwitch({ value, onChange, label, disabled = false }: Props) {
  const isOn = value === 1;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={`${label}, currently ${isOn ? 'on' : 'off'}. Click to toggle.`}
        onClick={() => !disabled && onChange(isOn ? 0 : 1)}
        disabled={disabled}
        className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-apple-blue focus-visible:ring-offset-2 focus-visible:ring-offset-apple-bg motion-reduce:transition-none ${
          isOn ? 'bg-apple-blue' : 'bg-apple-border'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <span
          className={`inline-block h-7 w-7 transform rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none ${
            isOn ? 'translate-x-8' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-xs text-apple-text-secondary">{label}</span>
    </div>
  );
}

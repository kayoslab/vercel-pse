"use client";

type QuantityStepperProps = {
  /** Unique per instance — the cart renders one of these per line. */
  id: string;
  /** Accessible name, e.g. the product being adjusted. */
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
};

/**
 * Shared by the product page and the cart, so the two cannot drift apart.
 *
 * Clamping lives here rather than in each caller: every consumer needs the same
 * bounds behaviour, and a stepper that can emit an out-of-range value pushes the
 * problem onto whoever forgot to guard it.
 */
export function QuantityStepper({
  id,
  label,
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
}: QuantityStepperProps) {
  const ceiling = Math.max(min, max);
  const clamp = (n: number) => Math.min(ceiling, Math.max(min, n));

  return (
    <div className="flex items-center rounded-md border border-border">
      <Step
        label={`Decrease quantity of ${label}`}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
      >
        −
      </Step>
      <label className="sr-only" htmlFor={id}>
        Quantity of {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={ceiling}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
        /*
          Fixed width so the control cannot resize as digits change, and the
          native spinner is hidden in favour of the explicit buttons — a 16px
          spinner is a poor touch target.
        */
        className="w-12 border-x border-border bg-transparent py-2 text-center text-sm tabular-nums outline-none [appearance:textfield] focus-visible:bg-surface disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <Step
        label={`Increase quantity of ${label}`}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= ceiling}
      >
        +
      </Step>
    </div>
  );
}

function Step({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    /*
      The rendered button is 36px — visually right inside the bordered group —
      but Apple's guideline for touch targets is 44pt, and these are the two
      most-tapped controls on a phone. The invisible ::after overlay extends
      the hit area to 44px without moving a pixel of layout.
    */
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="relative size-9 shrink-0 text-base text-foreground transition-colors after:absolute after:-inset-1 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

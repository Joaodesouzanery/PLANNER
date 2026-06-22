import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  clampNumber,
  formatNumberBR,
  parseCurrencyBR,
  validateNumber,
  type NumberConstraints,
} from "@/lib/currency";

interface BaseProps extends NumberConstraints {
  label?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
}

/**
 * Input numerico com mascara pt-BR que NAO quebra a digitacao:
 * mantem um texto interno enquanto focado e formata/valida (faixa, sinal,
 * inteiro) no blur. Emite sempre o valor numerico ja saneado.
 */
const MaskedNumberInput = ({
  value,
  onChange,
  decimals,
  prefix,
  suffix,
  nullable,
  label,
  className,
  inputClassName,
  placeholder,
  helperText,
  disabled,
  min,
  max,
  allowNegative,
  integer,
}: BaseProps & {
  value: number | null;
  onChange: (value: number | null) => void;
  decimals: number;
  prefix?: string;
  suffix?: string;
  nullable?: boolean;
}) => {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState("");
  const constraints: NumberConstraints = { min, max, allowNegative, integer };

  const display = focused
    ? text
    : value == null
      ? ""
      : formatNumberBR(value, decimals);

  const error = value == null ? null : validateNumber(value, constraints);

  return (
    <div className={className}>
      {label && <Label htmlFor={id} className="text-xs">{label}</Label>}
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>
        )}
        <Input
          id={id}
          inputMode="decimal"
          disabled={disabled}
          placeholder={placeholder}
          value={display}
          className={cn("font-mono", prefix && "pl-9", suffix && "pr-8", error && "border-destructive focus-visible:ring-destructive", inputClassName)}
          onFocus={() => {
            setFocused(true);
            setText(value == null ? "" : String(value).replace(".", ","));
          }}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            if (t.trim() === "") {
              onChange(nullable ? null : 0);
              return;
            }
            const n = parseCurrencyBR(t);
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => {
            setFocused(false);
            const n = parseCurrencyBR(text);
            if (text.trim() === "" && nullable) { onChange(null); return; }
            onChange(clampNumber(Number.isFinite(n) ? n : 0, constraints));
          }}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-destructive">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
};

/** Campo monetario BRL (2 casas, prefixo R$, nunca negativo por padrao). */
export const CurrencyInput = ({
  value,
  onChange,
  ...rest
}: BaseProps & { value: number; onChange: (value: number) => void }) => (
  <MaskedNumberInput
    {...rest}
    value={value}
    onChange={(v) => onChange(v ?? 0)}
    decimals={2}
    prefix="R$"
  />
);

/** Campo numerico generico (inteiro, percentual, cambio...). */
export const NumberField = ({
  value,
  onChange,
  decimals,
  suffix,
  nullable,
  ...rest
}: BaseProps & {
  value: number | null;
  onChange: (value: number | null) => void;
  decimals?: number;
  suffix?: string;
  nullable?: boolean;
}) => (
  <MaskedNumberInput
    {...rest}
    value={value}
    onChange={onChange}
    decimals={decimals ?? (rest.integer ? 0 : 2)}
    suffix={suffix}
    nullable={nullable}
  />
);

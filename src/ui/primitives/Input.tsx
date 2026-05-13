import { forwardRef, type InputHTMLAttributes } from "react";

/**
 * Input — typed wrapper that applies the `.tpc-input` class.
 *
 * Mirrors the prototype's input treatment: bg + rule-2 border, accent
 * focus ring (3px accent-wash box-shadow). Accepts all standard
 * HTMLInputElement props.
 */
export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", ...rest },
  ref,
) {
  return (
    <input ref={ref} {...rest} className={`tpc-input ${className}`.trim()} />
  );
});

export default Input;

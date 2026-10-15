import { flushSync } from "react-dom";

// Renders the field errors first, so the field that receives focus is already
// marked invalid and described by its message when it's announced.
export function showFieldErrors(form: HTMLFormElement | null, update: () => void) {
  flushSync(update);
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

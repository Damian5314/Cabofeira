import { useEffect } from "react";
export default function useDialogFocus(ref, open) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const dialog = ref.current;
    if (!dialog) return;
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
    const frame = requestAnimationFrame(() => (focusable()[0] || dialog).focus());
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) { event.preventDefault(); dialog.focus(); return; }
      if (event.shiftKey && (document.activeElement === elements[0] || document.activeElement === dialog)) { event.preventDefault(); elements[elements.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === elements[elements.length - 1]) { event.preventDefault(); elements[0].focus(); }
    };
    dialog.addEventListener("keydown", trap);
    return () => { cancelAnimationFrame(frame); dialog.removeEventListener("keydown", trap); previous?.focus?.(); };
  }, [ref, open]);
}

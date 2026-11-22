import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { OverlayType } from "./useOverlayNavigation";
import "./overlays.css";
export default function OverlayHost({
  type,
  onClose,
  onDismissDialog,
  children,
}: {
  type: OverlayType;
  onClose: () => void;
  onDismissDialog?: () => boolean;
  children: ReactNode;
}) {
  const openRef = useRef(type !== "none");
  openRef.current = type !== "none";
  const callbacks = useRef({ onClose, onDismissDialog });
  callbacks.current = { onClose, onDismissDialog };
  const ref = useRef<HTMLDivElement>(null),
    opener = useRef<HTMLElement | null>(null),
    wasOpen = useRef(false);
  useLayoutEffect(() => {
    const open = type !== "none";
    if (open) {
      if (!wasOpen.current)
        opener.current = document.activeElement as HTMLElement;
      ref.current?.querySelector<HTMLElement>("[data-overlay-close]")?.focus();
    } else if (wasOpen.current && opener.current?.isConnected) {
      opener.current.focus();
    }
    wasOpen.current = open;
  }, [type]);
  useEffect(() => {
    if (type === "none") return;
    const host = ref.current!;
    const scope = () =>
      [...host.querySelectorAll<HTMLElement>('.modal-overlay [role="dialog"]')]
        .filter((e) => e.getClientRects().length)
        .at(-1) ?? host;
    const buttons = (root: HTMLElement) =>
      [
        ...root.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (e) => e.getClientRects().length && !e.closest("[hidden],[inert]"),
      );
    const key = (e: KeyboardEvent) => {
      if (!openRef.current || e.isComposing) return;
      const root = scope();
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (root !== host) callbacks.current.onDismissDialog?.();
        else callbacks.current.onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const all = buttons(root);
      if (!all.length) {
        e.preventDefault();
        host.focus();
        return;
      }
      const index = all.indexOf(document.activeElement as HTMLElement);
      if (
        index < 0 ||
        (e.shiftKey && index === 0) ||
        (!e.shiftKey && index === all.length - 1)
      ) {
        e.preventDefault();
        (e.shiftKey ? all[all.length - 1] : all[0]).focus();
      }
    };
    const focus = () => {
      if (!openRef.current) return;
      const root = scope();
      if (!root.contains(document.activeElement))
        (buttons(root)[0] ?? host).focus();
    };
    const observer = new MutationObserver(focus);
    observer.observe(host, { childList: true, subtree: true });
    document.addEventListener("keydown", key, true);
    document.addEventListener("focusin", focus);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("focusin", focus);
    };
  }, [type]);
  return (
    <div
      className="overlay-host"
      data-open={type !== "none"}
      data-type={type}
      ref={ref}
      role={type === "none" ? undefined : "dialog"}
      aria-modal={type === "none" ? undefined : true}
      aria-labelledby={type === "none" ? undefined : "overlay-title"}
      tabIndex={-1}
    >
      <div className="overlay-surface">{children}</div>
    </div>
  );
}

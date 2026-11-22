import { useCallback, useEffect, useRef, useState } from "react";
export type OverlayType = "none" | "building" | "management";
export interface OverlayState {
  overlay: OverlayType;
  previousOverlay: OverlayType;
}
export function useOverlayNavigation() {
  const [state, setState] = useState<OverlayState>({
    overlay: "none",
    previousOverlay: "none",
  });
  const current = useRef(state),
    id = useRef(`ashen-${Date.now()}-${Math.random()}`),
    pendingBack = useRef(false),
    queued = useRef<OverlayType | null>(null);
  const apply = useCallback((next: OverlayState) => {
    current.current = next;
    setState(next);
  }, []);
  const go = useCallback(
    (overlay: OverlayType) => {
      if (pendingBack.current) {
        queued.current = overlay;
        return;
      }
      const old = current.current;
      if (old.overlay === overlay) return;
      const next = { overlay, previousOverlay: old.overlay };
      if (overlay === "none") {
        apply(next);
        if (window.history.state?.ashenSession === id.current) {
          pendingBack.current = true;
          window.history.back();
        }
      } else {
        const marker = {
          ...window.history.state,
          ashenSession: id.current,
          ...next,
        };
        if (old.overlay === "none") window.history.pushState(marker, "");
        else window.history.replaceState(marker, "");
        apply(next);
      }
    },
    [apply],
  );
  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      pendingBack.current = false;
      const waiting = queued.current;
      queued.current = null;
      if (waiting && waiting !== "none") {
        const next = { overlay: waiting, previousOverlay: "none" as const };
        window.history.pushState({ ashenSession: id.current, ...next }, "");
        apply(next);
        return;
      }
      const value = event.state;
      apply(
        value?.ashenSession === id.current &&
          ["building", "management"].includes(value.overlay)
          ? {
              overlay: value.overlay,
              previousOverlay: value.previousOverlay ?? "none",
            }
          : { overlay: "none", previousOverlay: current.current.overlay },
      );
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [apply]);
  return { ...state, go };
}

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import "./management.css";
export default function ManagementView({
  children,
  active,
  onOpenGuide,
}: {
  children: ReactNode;
  active: boolean;
  onOpenGuide?: () => void;
}) {
  const scroll = useRef<HTMLDivElement>(null),
    savedScroll = useRef(0);
  useLayoutEffect(() => {
    if (active && scroll.current)
      scroll.current.scrollTop = savedScroll.current;
  }, [active]);
  return (
    <section
      className="management-view"
      hidden={!active}
      inert={!active}
      aria-label="공동체 운영실"
      data-active={active}
    >
      <header className="management-header">
        <div>
          <span className="console-signal" />
          <span>DAWN / OPERATIONS TERMINAL</span>
          <h1>공동체 운영실</h1>
        </div>
        <p>정책과 작업을 결정하고, 도시로 돌아가 변화를 관찰하세요.</p>
        {onOpenGuide && (
          <button onClick={onOpenGuide}>
            <CircleHelp size={16} />
            플레이 가이드
          </button>
        )}
      </header>
      <div
        className="management-scroll"
        role="region"
        aria-label="운영실 내용"
        tabIndex={0}
        ref={scroll}
        data-testid="management-scroll"
        onScroll={() => {
          if (active && scroll.current)
            savedScroll.current = scroll.current.scrollTop;
        }}
      >
        {children}
      </div>
    </section>
  );
}

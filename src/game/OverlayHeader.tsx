import { X, ArrowLeft, Settings2, Building2 } from "lucide-react";
import type { OverlayType } from "./useOverlayNavigation";
export default function OverlayHeader({
  type,
  previous,
  title,
  detail,
  onClose,
  onOther,
  onGuide,
}: {
  type: OverlayType;
  previous: OverlayType;
  title: string;
  detail: string;
  onClose: () => void;
  onOther: () => void;
  onGuide?: () => void;
}) {
  return (
    <header className="overlay-header" aria-label="오버레이 제어">
      <div>
        <span>
          {type === "building"
            ? "BUILDING / CUTAWAY"
            : "ASHEN CITY / OPERATIONS"}
        </span>
        <h1 id="overlay-title">{title}</h1>
        <p>{detail}</p>
      </div>
      <div className="overlay-actions">
        <button onClick={onClose}>
          <ArrowLeft size={15} />
          도시로 돌아가기
        </button>
        <button onClick={onOther}>
          {type === "building" ? (
            <Settings2 size={15} />
          ) : (
            <Building2 size={15} />
          )}
          {type === "building"
            ? "관리"
            : previous === "building"
              ? "건물로 돌아가기"
              : "건물 내부"}
        </button>
        {type === "management" && onGuide && (
          <button onClick={onGuide}>플레이 가이드</button>
        )}
        <button
          className="overlay-close"
          aria-label="오버레이 닫기"
          data-overlay-close
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
    </header>
  );
}

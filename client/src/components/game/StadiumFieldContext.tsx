import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  stadiumImagePointToPx,
  type ImagePoint,
} from "./stadiumFieldCoords";

interface StadiumFieldContextValue {
  containerRef: RefObject<HTMLDivElement | null>;
  size: { width: number; height: number };
}

const StadiumFieldContext = createContext<StadiumFieldContextValue | null>(null);

export function StadiumFieldProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const value = useMemo(
    () => ({ containerRef, size }),
    [size.width, size.height],
  );

  return (
    <StadiumFieldContext.Provider value={value}>
      {children}
    </StadiumFieldContext.Provider>
  );
}

function useStadiumFieldContext() {
  const ctx = useContext(StadiumFieldContext);
  if (!ctx) {
    throw new Error("StadiumFieldMarker must be used within StadiumFieldProvider");
  }
  return ctx;
}

export function useStadiumFieldPoint(point: ImagePoint): CSSProperties {
  const { size } = useStadiumFieldContext();
  const { left, top } = stadiumImagePointToPx(point, size.width, size.height);
  return {
    left: `${left}px`,
    top: `${top}px`,
  };
}

interface StadiumFieldMarkerProps {
  point: ImagePoint;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** translate(-50%, -50%) 기본, false면 좌상단 기준 */
  center?: boolean;
  testId?: string;
}

export function StadiumFieldMarker({
  point,
  className = "",
  style,
  children,
  center = true,
  testId,
}: StadiumFieldMarkerProps) {
  const posStyle = useStadiumFieldPoint(point);
  return (
    <div
      className={`absolute ${className}`}
      style={{
        ...posStyle,
        transform: center ? "translate(-50%, -50%)" : undefined,
        ...style,
      }}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** 컨테이너 ref — 주루 keyframes 등 px 좌표 생성용 */
export function useStadiumFieldContainer() {
  return useStadiumFieldContext();
}

export function useStadiumFieldPx(point: ImagePoint): { left: number; top: number } {
  const { size } = useStadiumFieldContext();
  return stadiumImagePointToPx(point, size.width, size.height);
}

export function useStadiumFieldSize() {
  const { size } = useStadiumFieldContext();
  return size;
}

/** Provider 없이도 쓸 수 있는 px 변환 (size 인자) */
export function imagePointStyle(
  point: ImagePoint,
  width: number,
  height: number,
  center = true,
): CSSProperties {
  const { left, top } = stadiumImagePointToPx(point, width, height);
  return {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    transform: center ? "translate(-50%, -50%)" : undefined,
  };
}

export function useImagePointStyle(point: ImagePoint, center = true): CSSProperties {
  const pos = useStadiumFieldPoint(point);
  return {
    ...pos,
    transform: center ? "translate(-50%, -50%)" : undefined,
  };
}

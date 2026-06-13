import { useState, useEffect, useCallback } from "react";

const DEFAULT_ROW_HEIGHT = 64;
const BASE_OVERHEAD = 400;
const MIN_ROWS = 3;

export function useResponsivePageSize(extraOffset: number = 0, rowHeight: number = DEFAULT_ROW_HEIGHT): number {
  const calculatePageSize = useCallback(() => {
    const availableHeight = window.innerHeight - BASE_OVERHEAD - extraOffset;
    return Math.max(MIN_ROWS, Math.floor(availableHeight / rowHeight));
  }, [extraOffset, rowHeight]);

  const [pageSize, setPageSize] = useState(calculatePageSize);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setPageSize(calculatePageSize());
      }, 200);
    };

    setPageSize(calculatePageSize());

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, [calculatePageSize]);

  return pageSize;
}

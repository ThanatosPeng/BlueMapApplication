import { useEffect, useState } from "react";

/**
 * 窄屏判断。用来切换「只读模式」：手机上看树、开抽屉、复习，
 * 但不给拖节点、连线、删节点这些编辑能力。
 */
export function useIsNarrow(query = "(max-width: 860px)"): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setNarrow(mql.matches);
    setNarrow(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return narrow;
}

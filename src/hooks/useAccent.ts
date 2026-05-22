import { useEffect } from "react";
import { applyAccent } from "../services/mottoColor";
import { useScope } from "../store/scopeStore";

export function useAccent() {
  const accent = useScope((s) => s.day?.accent_rgb ?? null);
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);
}

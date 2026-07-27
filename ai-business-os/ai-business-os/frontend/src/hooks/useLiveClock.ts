import { useEffect, useState } from "react";

/** Ticking clock, updated once per second (Part 04, Phase 5 — live-status chrome). */
export function useLiveClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

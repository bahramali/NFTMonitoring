import { useCallback, useState } from "react";
import { useStomp } from "./useStomp";

const DEFAULT_STATS = {
  lux: { average: null, deviceCount: 0 },
  humidity: { average: null, deviceCount: 0 },
  temperature: { average: null, deviceCount: 0 },
  do: { average: null, deviceCount: 0 },
  airpump: { average: null, deviceCount: 0 },
};

export function useLiveNow() {
  const [stats, setStats] = useState(DEFAULT_STATS);

  const handleMessage = useCallback((_topic, msg) => {
    if (msg && typeof msg === "object") {
      setStats({
        lux: {
          average: msg?.lux?.average ?? null,
          deviceCount: msg?.lux?.deviceCount ?? 0,
        },
        humidity: {
          average: msg?.humidity?.average ?? null,
          deviceCount: msg?.humidity?.deviceCount ?? 0,
        },
        temperature: {
          average: msg?.temperature?.average ?? null,
          deviceCount: msg?.temperature?.deviceCount ?? 0,
        },
        do: {
          average: msg?.do?.average ?? null,
          deviceCount: msg?.do?.deviceCount ?? 0,
        },
        airpump: {
          average: msg?.airpump?.average ?? null,
          deviceCount: msg?.airpump?.deviceCount ?? 0,
        },
      });
    } else {
      setStats(DEFAULT_STATS);
    }
  }, []);

  useStomp("live_now", handleMessage);

  return stats;
}


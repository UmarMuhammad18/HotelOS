import { useEffect } from 'react';
import { API_BASE } from '../config/env';
import { useHotelStore } from '../store/useHotelStore';

/** Load rooms/tasks/metrics from REST on launch and when API base changes */
export function useBootstrapData() {
  const { setRooms, setTasks, setMetrics } = useHotelStore();
  const configVersion = useHotelStore((s) => s.configVersion);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE()}/api/state`);
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setRooms(data.rooms || []);
        setTasks(data.tasks || []);
        setMetrics(data.metrics || null);
      } catch {
        /* offline — cached zustand data remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setRooms, setTasks, setMetrics, configVersion]);
}

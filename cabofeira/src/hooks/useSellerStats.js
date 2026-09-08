import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function useSellerStats(sellerId) {
  const [stats, setStats] = useState({ total: 0, active: 0, views: 0, loading: true, error: false });
  useEffect(() => {
    let alive = true;
    setStats({ total: 0, active: 0, views: 0, loading: !!sellerId, error: false });
    if (sellerId) (async () => {
      const result = { total: 0, active: 0, views: 0, loading: false, error: false };
      for (let offset = 0; alive; offset += 1000) {
        const { data, error } = await supabase.from("products").select("id,status,views")
          .eq("seller_id", sellerId).order("id").range(offset, offset + 999);
        if (error) throw error;
        for (const row of data || []) {
          result.total += 1;
          if (row.status === "active") result.active += 1;
          result.views += Number(row.views) || 0;
        }
        if (!data || data.length < 1000) break;
      }
      if (alive) setStats(result);
    })().catch(() => { if (alive) setStats({ total: 0, active: 0, views: 0, loading: false, error: true }); });
    return () => { alive = false; };
  }, [sellerId]);
  return stats;
}

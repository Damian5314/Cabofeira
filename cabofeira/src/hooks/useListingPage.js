import { useEffect, useState } from "react";
import { useProducts } from "../context/ProductsContext";

// A dedicated server query avoids the 200-item homepage cache limit.
export default function useListingPage(options, enabled = true) {
  const { fetchProducts } = useProducts();
  const key = JSON.stringify(options);
  const [state, setState] = useState({ items: [], total: 0, loading: true, error: false });
  useEffect(() => {
    let alive = true;
    setState({ items: [], total: 0, loading: enabled, error: false });
    if (enabled) fetchProducts(JSON.parse(key))
      .then((result) => { if (alive) setState({ ...result, loading: false, error: false }); })
      .catch(() => { if (alive) setState({ items: [], total: 0, loading: false, error: true }); });
    return () => { alive = false; };
  }, [key, enabled, fetchProducts]);
  return state;
}

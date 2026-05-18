import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useToast } from "../components/Toast";
import { defaultPostingPrices, FEATURED_SURCHARGE } from "../data/postingPrices";

const PricingContext = createContext(null);

const DEBOUNCE_MS = 400;

export function PricingProvider({ children }) {
  const toast = useToast();
  const [prices, setPrices] = useState(defaultPostingPrices);
  const [featuredPrice, setFeaturedPriceState] = useState(FEATURED_SURCHARGE);

  // Refs so debounced DB writes always see the latest values, even if
  // React hasn't re-rendered yet between rapid keystrokes.
  const pricesRef = useRef(prices);
  const featuredRef = useRef(featuredPrice);
  const pricesTimer = useRef(null);
  const featuredTimer = useRef(null);

  useEffect(() => {
    pricesRef.current = prices;
  }, [prices]);
  useEffect(() => {
    featuredRef.current = featuredPrice;
  }, [featuredPrice]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["posting_prices", "featured_price"]);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[pricing] load:", error);
      return;
    }
    for (const row of data || []) {
      if (row.key === "posting_prices" && row.value && typeof row.value === "object") {
        setPrices({ ...defaultPostingPrices, ...row.value });
      }
      if (row.key === "featured_price") {
        setFeaturedPriceState(Number(row.value) || 0);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: pick up changes made by other admins / browsers.
  useEffect(() => {
    const channel = supabase
      .channel("app_settings-pricing")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const persistPrices = () => {
    clearTimeout(pricesTimer.current);
    pricesTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "posting_prices", value: pricesRef.current });
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[pricing] save prices:", error);
        toast.error("Could not save category prices.");
      }
    }, DEBOUNCE_MS);
  };

  const persistFeatured = () => {
    clearTimeout(featuredTimer.current);
    featuredTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "featured_price", value: featuredRef.current });
      if (error) {
        // eslint-disable-next-line no-console
        console.error("[pricing] save featured:", error);
        toast.error("Could not save featured price.");
      }
    }, DEBOUNCE_MS);
  };

  const getPrice = (categoryId) =>
    prices[categoryId] ?? defaultPostingPrices[categoryId] ?? 0;

  const setPrice = (categoryId, value) => {
    const val = Math.max(0, Number(value) || 0);
    const next = { ...pricesRef.current, [categoryId]: val };
    pricesRef.current = next;
    setPrices(next);
    persistPrices();
  };

  const setFeaturedPrice = (value) => {
    const val = Math.max(0, Number(value) || 0);
    featuredRef.current = val;
    setFeaturedPriceState(val);
    persistFeatured();
  };

  const resetPrices = async () => {
    pricesRef.current = defaultPostingPrices;
    featuredRef.current = FEATURED_SURCHARGE;
    setPrices(defaultPostingPrices);
    setFeaturedPriceState(FEATURED_SURCHARGE);
    clearTimeout(pricesTimer.current);
    clearTimeout(featuredTimer.current);
    const { error } = await supabase.from("app_settings").upsert([
      { key: "posting_prices", value: defaultPostingPrices },
      { key: "featured_price", value: FEATURED_SURCHARGE },
    ]);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[pricing] reset:", error);
      toast.error("Could not reset prices.");
    } else {
      toast.success("Prices reset to defaults.");
    }
  };

  return (
    <PricingContext.Provider
      value={{ prices, getPrice, setPrice, featuredPrice, setFeaturedPrice, resetPrices }}
    >
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within PricingProvider");
  return ctx;
}

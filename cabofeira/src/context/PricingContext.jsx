import React, { createContext, useContext, useEffect, useState } from "react";
import { defaultPostingPrices, FEATURED_SURCHARGE } from "../data/postingPrices";

const PricingContext = createContext(null);
const STORAGE_KEY = "cabofeira_posting_prices";
const FEATURED_KEY = "cabofeira_featured_price";

export function PricingProvider({ children }) {
  const [prices, setPrices] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultPostingPrices, ...JSON.parse(raw) } : defaultPostingPrices;
    } catch {
      return defaultPostingPrices;
    }
  });

  const [featuredPrice, setFeaturedPrice] = useState(() => {
    try {
      const raw = localStorage.getItem(FEATURED_KEY);
      return raw ? Number(raw) : FEATURED_SURCHARGE;
    } catch {
      return FEATURED_SURCHARGE;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  }, [prices]);

  useEffect(() => {
    localStorage.setItem(FEATURED_KEY, String(featuredPrice));
  }, [featuredPrice]);

  const getPrice = (categoryId) =>
    prices[categoryId] ?? defaultPostingPrices[categoryId] ?? 0;

  const setPrice = (categoryId, value) =>
    setPrices((p) => ({ ...p, [categoryId]: Math.max(0, Number(value) || 0) }));

  const resetPrices = () => {
    setPrices(defaultPostingPrices);
    setFeaturedPrice(FEATURED_SURCHARGE);
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

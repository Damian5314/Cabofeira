import React, { createContext, useContext, useEffect, useState } from "react";
import { initialProducts } from "../data/products";

const ProductsContext = createContext(null);

const STORAGE_KEY = "cabofeira_products";
const FAV_KEY = "cabofeira_favorites";

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : initialProducts;
    } catch {
      return initialProducts;
    }
  });

  const [favorites, setFavorites] = useState(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const addProduct = (product) => {
    const newProduct = {
      ...product,
      id: `p${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      views: 0,
    };
    setProducts((prev) => [newProduct, ...prev]);
    return newProduct;
  };

  const updateProduct = (id, patch) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const removeProduct = (id) =>
    setProducts((prev) => prev.filter((p) => p.id !== id));

  const getProduct = (id) => products.find((p) => p.id === id);

  const incrementViews = (id) =>
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, views: (p.views || 0) + 1 } : p))
    );

  const toggleFavorite = (id) =>
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const isFavorite = (id) => favorites.includes(id);

  const userProducts = (userId) => products.filter((p) => p.seller.id === userId);

  return (
    <ProductsContext.Provider
      value={{
        products,
        addProduct,
        updateProduct,
        removeProduct,
        getProduct,
        incrementViews,
        favorites,
        toggleFavorite,
        isFavorite,
        userProducts,
      }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductsContext);
  if (!ctx) throw new Error("useProducts must be used within ProductsProvider");
  return ctx;
}

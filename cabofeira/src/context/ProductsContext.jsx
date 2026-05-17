import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const ProductsContext = createContext(null);

const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  price: Number(r.price),
  currency: r.currency,
  category: r.category,
  subcategory: r.subcategory,
  condition: r.condition,
  location: { city: r.location_city, island: r.location_island },
  images: r.images || [],
  featured: r.featured,
  views: r.views || 0,
  createdAt: (r.created_at || "").slice(0, 10),
  seller: {
    id: r.seller_id,
    name: r.seller_name,
    phone: r.seller_phone,
    email: r.seller_email,
    memberSince: r.seller_member_since,
    verified: r.seller_verified,
  },
});

const toRow = (p, sellerId) => ({
  seller_id: sellerId,
  title: p.title,
  description: p.description,
  price: p.price,
  currency: p.currency,
  category: p.category,
  subcategory: p.subcategory,
  condition: p.condition,
  location_city: p.location.city,
  location_island: p.location.island,
  images: p.images,
  featured: p.featured,
  seller_name: p.seller.name,
  seller_phone: p.seller.phone,
  seller_email: p.seller.email,
  seller_member_since: p.seller.memberSince || null,
  seller_verified: p.seller.verified ?? false,
});

export function ProductsProvider({ children }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const refreshProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setProducts(data.map(fromRow));
  }, []);

  const refreshFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      return;
    }
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id);
    if (!error && data) setFavorites(data.map((f) => f.product_id));
  }, [user]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  const addProduct = async (product) => {
    if (!user) throw new Error("You must be signed in to post an ad.");
    const { data, error } = await supabase
      .from("products")
      .insert(toRow(product, user.id))
      .select()
      .single();
    if (error) throw error;
    const created = fromRow(data);
    setProducts((prev) => [created, ...prev]);
    return created;
  };

  const updateProduct = async (id, patch) => {
    const dbPatch = {};
    if ("title" in patch) dbPatch.title = patch.title;
    if ("description" in patch) dbPatch.description = patch.description;
    if ("price" in patch) dbPatch.price = patch.price;
    if ("currency" in patch) dbPatch.currency = patch.currency;
    if ("category" in patch) dbPatch.category = patch.category;
    if ("subcategory" in patch) dbPatch.subcategory = patch.subcategory;
    if ("condition" in patch) dbPatch.condition = patch.condition;
    if (patch.location) {
      dbPatch.location_city = patch.location.city;
      dbPatch.location_island = patch.location.island;
    }
    if ("images" in patch) dbPatch.images = patch.images;
    if ("featured" in patch) dbPatch.featured = patch.featured;
    if (patch.seller) {
      dbPatch.seller_name = patch.seller.name;
      dbPatch.seller_phone = patch.seller.phone;
      dbPatch.seller_email = patch.seller.email;
    }
    const { data, error } = await supabase
      .from("products")
      .update(dbPatch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const updated = fromRow(data);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const removeProduct = async (id) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const getProduct = (id) => products.find((p) => p.id === id);

  const incrementViews = async (id) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, views: (p.views || 0) + 1 } : p))
    );
    await supabase.rpc("increment_product_views", { p_id: id });
  };

  const toggleFavorite = async (id) => {
    if (!user) return;
    const isFav = favorites.includes(id);
    if (isFav) {
      setFavorites((prev) => prev.filter((x) => x !== id));
      await supabase
        .from("favorites")
        .delete()
        .match({ user_id: user.id, product_id: id });
    } else {
      setFavorites((prev) => [...prev, id]);
      await supabase
        .from("favorites")
        .insert({ user_id: user.id, product_id: id });
    }
  };

  const isFavorite = (id) => favorites.includes(id);

  const userProducts = (userId) =>
    products.filter((p) => p.seller.id === userId);

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

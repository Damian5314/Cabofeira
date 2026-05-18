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

const PRODUCT_SELECT = `
  id, title, description, price, currency, category, subcategory, condition,
  location_city, location_island, images, featured, views, created_at, seller_id,
  seller:profiles!products_seller_id_fkey(id, name, phone, email, member_since, verified)
`;

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
    id: r.seller?.id || r.seller_id,
    name: r.seller?.name || "",
    phone: r.seller?.phone || "",
    email: r.seller?.email || "",
    memberSince: r.seller?.member_since || null,
    verified: r.seller?.verified ?? false,
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
});

export function ProductsProvider({ children }) {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const refreshProducts = useCallback(async () => {
    // Cached pool for Home/MyAds/Favorites lookups. Capped to 200 most recent
    // ads — pages that need broader access (Search, Admin) use fetchProducts
    // for server-side paginated queries instead.
    setProductsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .order("created_at", { ascending: false })
      .range(0, 199);
    if (!error && data) setProducts(data.map(fromRow));
    setProductsLoading(false);
  }, []);

  // Fetch a single product (used when navigating to an old ad that fell out
  // of the cache window). Returns the product or null. Adds to local cache.
  const fetchProduct = useCallback(async (id) => {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const product = fromRow(data);
    setProducts((prev) =>
      prev.some((p) => p.id === product.id)
        ? prev.map((p) => (p.id === product.id ? product : p))
        : [...prev, product]
    );
    return product;
  }, []);

  // Server-side filtered + paginated query for Search / Admin.
  const fetchProducts = useCallback(async (opts = {}) => {
    const {
      search = "",
      category = "",
      island = "",
      sellerId = "",
      featured = null,
      minPrice = null,
      maxPrice = null,
      sort = "newest",
      range = [0, 23],
    } = opts;

    let q = supabase
      .from("products")
      .select(PRODUCT_SELECT, { count: "exact" });

    if (search.trim()) {
      const pat = `%${search.trim()}%`;
      q = q.or(`title.ilike.${pat},description.ilike.${pat}`);
    }
    if (category) q = q.eq("category", category);
    if (island) q = q.eq("location_island", island);
    if (sellerId) q = q.eq("seller_id", sellerId);
    if (featured !== null) q = q.eq("featured", featured);
    if (minPrice !== null && minPrice !== "") q = q.gte("price", Number(minPrice));
    if (maxPrice !== null && maxPrice !== "") q = q.lte("price", Number(maxPrice));

    switch (sort) {
      case "price-asc":
        q = q.order("price", { ascending: true });
        break;
      case "price-desc":
        q = q.order("price", { ascending: false });
        break;
      case "popular":
        q = q.order("views", { ascending: false });
        break;
      case "newest":
      default:
        q = q.order("created_at", { ascending: false });
    }

    q = q.range(range[0], range[1]);

    const { data, error, count } = await q;
    if (error) throw error;
    return { items: (data || []).map(fromRow), total: count || 0 };
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
      .select(PRODUCT_SELECT)
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
    const { data, error } = await supabase
      .from("products")
      .update(dbPatch)
      .eq("id", id)
      .select(PRODUCT_SELECT)
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
        productsLoading,
        addProduct,
        updateProduct,
        removeProduct,
        getProduct,
        fetchProduct,
        fetchProducts,
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

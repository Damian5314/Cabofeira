import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { useToast } from "../components/Toast";
import { useT } from "../i18n/I18nContext";

const ProductsContext = createContext(null);

const PRODUCT_SELECT = `
  id, title, description, price, currency, category, subcategory, condition,
  location_city, location_island, images, featured, views, status, created_at, seller_id,
  seller:profiles!products_seller_id_fkey(id, name, phone, email, member_since, verified)
`;

const PRODUCT_IMAGES_BUCKET = "product-images";
const STORAGE_PUBLIC_MARKER = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;

// Extract the object path from a public Storage URL, or null for anything
// else (legacy base64 data: URLs, picsum fallbacks, external links).
const storagePathFromUrl = (url) => {
  if (typeof url !== "string") return null;
  const idx = url.indexOf(STORAGE_PUBLIC_MARKER);
  if (idx === -1) return null;
  try { return decodeURIComponent(url.slice(idx + STORAGE_PUBLIC_MARKER.length)); }
  catch { return null; }
};

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
  status: r.status,
  createdAt: r.created_at || "",
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
  const toast = useToast();
  const t = useT();
  const favoritePending = useRef(new Set());
  const viewed = useRef(new Set());
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const [products, setProducts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);

  const refreshProducts = useCallback(async () => {
    // Cached pool for Home/MyAds/Favorites lookups. Capped to 200 most recent
    // ads — pages that need broader access (Search, Admin) use fetchProducts
    // for server-side paginated queries instead.
    setProductsLoading(true);
    // Active-only: pairs with the products_sold_visibility.sql SELECT relax
    // (D-14). RLS now permits 'sold' publicly, so the feed MUST filter it out
    // here or sold ads leak into Home (Pitfall 1).
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("status", "active")
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
      subcategory = "",
      island = "",
      sellerId = "",
      ids = null,
      featured = null,
      minPrice = null,
      maxPrice = null,
      status = "active",
      sort = "newest",
      range = [0, 23],
    } = opts;

    let q = supabase
      .from("products")
      .select(PRODUCT_SELECT, { count: "exact" });

    // Active-only by default (Search). The seller's PUBLIC profile/ad list
    // (Plan 02-04) passes status:["active","sold"] to surface sold ads with a
    // badge (D-13). Pass an explicit array/string to override.
    if (Array.isArray(status)) q = q.in("status", status);
    else if (status) q = q.eq("status", status);

    if (search.trim()) {
      const literal = search.trim().replace(/[\\%_]/g, "\\$&");
      const pat = JSON.stringify(`%${literal}%`);
      q = q.or(`title.ilike.${pat},description.ilike.${pat}`);
    }
    if (category) q = q.eq("category", category);
    if (subcategory) q = q.eq("subcategory", subcategory);
    if (island) q = q.eq("location_island", island);
    if (sellerId) q = q.eq("seller_id", sellerId);
    if (ids) q = q.in("id", ids);
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

    q = q.order("id", { ascending: false }).range(range[0], range[1]);

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
    if (!error && data && userIdRef.current === user.id) setFavorites(data.map((f) => f.product_id));
  }, [user]);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  useEffect(() => {
    setFavorites([]);
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
    // status round-trips for mark-as-sold (D-11/D-12). The Phase-1
    // guard_products_update does NOT pin status, so owner updates are allowed.
    if ("status" in patch) dbPatch.status = patch.status;
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
    const target = products.find((p) => p.id === id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    setProducts((prev) => prev.filter((p) => p.id !== id));

    const paths = (target?.images || [])
      .map(storagePathFromUrl)
      .filter(Boolean);
    if (paths.length > 0) {
      // Best-effort: ad is already deleted from the DB. If storage cleanup
      // fails (network, permission), the row is gone — files become orphans
      // that a periodic cleanup job can sweep later.
      supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths).then(({ error: e }) => {
        if (e) console.warn("[products] storage cleanup failed:", e.message);
      });
    }
  };

  const getProduct = (id) => products.find((p) => p.id === id);

  const incrementViews = async (id) => {
    if (viewed.current.has(id)) return;
    const key = `cf_viewed_${id}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* storage unavailable */ }
    viewed.current.add(id);
    const { error } = await supabase.rpc("increment_product_views", { p_id: id });
    if (error) { viewed.current.delete(id); return; }
    try { sessionStorage.setItem(key, "1"); } catch { /* memory fallback */ }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, views: (p.views || 0) + 1 } : p))
    );
  };

  const toggleFavorite = async (id) => {
    if (!user) { toast.info(t("auth.signInIntro")); return; }
    if (favoritePending.current.has(id)) return;
    favoritePending.current.add(id);
    const accountId = user.id;
    const isFav = favorites.includes(id);
    try {
      const { error } = isFav
        ? await supabase.from("favorites").delete().match({ user_id: accountId, product_id: id })
        : await supabase.from("favorites").upsert({ user_id: accountId, product_id: id }, { onConflict: "user_id,product_id", ignoreDuplicates: true });
      if (error) throw error;
      if (userIdRef.current === accountId) setFavorites((prev) => isFav ? prev.filter((x) => x !== id) : [...new Set([...prev, id])]);
    } catch { toast.error(t("common.error")); }
    finally { favoritePending.current.delete(id); }
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

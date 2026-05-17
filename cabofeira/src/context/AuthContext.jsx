import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const fromProfile = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone || "",
  bio: row.bio || "",
  role: row.role,
  memberSince: row.member_since,
  verified: row.verified,
  avatar: row.avatar,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (id) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      setUser(null);
      return;
    }
    setUser(fromProfile(data));
  }, []);

  const refreshUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setUsers(data.map(fromProfile));
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) loadProfile(session.user.id);
      else setUser(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    refreshUsers();
  }, [user, refreshUsers]);

  const login = async ({ email, password }) => {
    if (!email || !password) {
      return { ok: false, error: "Email and password are required." };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const register = async ({ name, email, phone, password, confirmPassword }) => {
    if (!name || !email || !password) {
      return { ok: false, error: "Name, email and password are required." };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone: phone || "" } },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (patch) => {
    if (!user) return { ok: false, error: "Not signed in." };
    const dbPatch = {};
    if ("name" in patch) dbPatch.name = patch.name;
    if ("phone" in patch) dbPatch.phone = patch.phone;
    if ("bio" in patch) dbPatch.bio = patch.bio;
    if ("avatar" in patch) dbPatch.avatar = patch.avatar;
    const { data, error } = await supabase
      .from("profiles")
      .update(dbPatch)
      .eq("id", user.id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    setUser(fromProfile(data));
    refreshUsers();
    return { ok: true };
  };

  const allUsers = () => users;

  const isAdmin = user?.role === "admin";

  if (loading) return null;

  return (
    <AuthContext.Provider
      value={{ user, isAdmin, login, register, logout, updateProfile, allUsers }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

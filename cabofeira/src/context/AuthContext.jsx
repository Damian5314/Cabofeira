import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { useT } from "../i18n/I18nContext";

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

const RECOVERY_FLAG = "cf_recovering";

export function AuthProvider({ children }) {
  const t = useT();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(
    () => sessionStorage.getItem(RECOVERY_FLAG) === "1"
  );

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
      // Recovery flag should only count when the user is actively on the
      // reset page. Otherwise it's stale state from an abandoned reset flow.
      let recovering = sessionStorage.getItem(RECOVERY_FLAG) === "1";
      if (recovering && window.location.pathname !== "/reset-password") {
        sessionStorage.removeItem(RECOVERY_FLAG);
        setIsRecovering(false);
        recovering = false;
      }
      if (session?.user && !recovering) {
        await loadProfile(session.user.id);
      }
      setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // When the user clicks the password-reset link, Supabase fires
      // PASSWORD_RECOVERY with a temporary session. Redirect to the reset
      // page so they actually choose a new password instead of silently
      // landing on the home screen "logged in".
      if (event === "PASSWORD_RECOVERY") {
        sessionStorage.setItem(RECOVERY_FLAG, "1");
        setIsRecovering(true);
        setUser(null);
        if (window.location.pathname !== "/reset-password") {
          window.location.replace("/reset-password");
        }
        return;
      }
      // Ignore SIGNED_IN echoes while a recovery flow is still pending.
      if (sessionStorage.getItem(RECOVERY_FLAG) === "1") {
        setUser(null);
        return;
      }
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
      return { ok: false, error: t("auth.errors.missingCredentials") };
    }
    // Any pending recovery flag must be wiped before a fresh login so the
    // session listener doesn't silently mark the new session as "anonymous".
    sessionStorage.removeItem(RECOVERY_FLAG);
    setIsRecovering(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const register = async ({ name, email, phone, password, confirmPassword }) => {
    if (!name || !email || !password) {
      return { ok: false, error: t("auth.errors.missingFields") };
    }
    if (password.length < 6) {
      return { ok: false, error: t("auth.errors.passwordShort") };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: t("auth.errors.passwordMismatch") };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, phone: phone || "" } },
    });
    if (error) return { ok: false, error: error.message };
    // If email confirmation is enabled in Supabase, signUp returns no session
    // until the user clicks the verification link.
    return { ok: true, needsConfirmation: !data.session };
  };

  const resendConfirmation = async (email) => {
    if (!email) return { ok: false, error: t("auth.errors.missingCredentials") };
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const logout = async () => {
    sessionStorage.removeItem(RECOVERY_FLAG);
    setIsRecovering(false);
    await supabase.auth.signOut();
  };

  const requestPasswordReset = async (email) => {
    if (!email) return { ok: false, error: t("auth.errors.missingCredentials") };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const updatePassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, error: t("auth.errors.passwordShort") };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: error.message };
    // Recovery flow finished — clear the flag so future sessions log in normally.
    sessionStorage.removeItem(RECOVERY_FLAG);
    setIsRecovering(false);
    return { ok: true };
  };

  const deleteAccount = async () => {
    if (!user) return { ok: false, error: "Not signed in." };
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { ok: false, error: error.message };
    await supabase.auth.signOut();
    setUser(null);
    return { ok: true };
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

  const setUserRole = async (userId, role) => {
    if (!isAdmin) return { ok: false, error: "Not allowed." };
    if (userId === user.id) return { ok: false, error: "You can't change your own role." };
    if (!["user", "admin"].includes(role)) return { ok: false, error: "Invalid role." };
    const { data, error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    setUsers((prev) => prev.map((u) => (u.id === userId ? fromProfile(data) : u)));
    return { ok: true };
  };

  const setUserVerified = async (userId, verified) => {
    if (!isAdmin) return { ok: false, error: "Not allowed." };
    const { data, error } = await supabase
      .from("profiles")
      .update({ verified: !!verified })
      .eq("id", userId)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    setUsers((prev) => prev.map((u) => (u.id === userId ? fromProfile(data) : u)));
    return { ok: true };
  };

  if (loading) return null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isRecovering,
        login,
        register,
        logout,
        updateProfile,
        allUsers,
        setUserRole,
        setUserVerified,
        deleteAccount,
        requestPasswordReset,
        updatePassword,
        resendConfirmation,
      }}
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

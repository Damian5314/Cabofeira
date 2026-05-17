import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "cabofeira_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  // Frontend-only auth. A real backend will replace this later.
  const login = ({ email, password }) => {
    if (!email || !password) {
      return { ok: false, error: "Email and password are required." };
    }
    const fake = {
      id: "me",
      name: email.split("@")[0],
      email,
      phone: "",
      memberSince: new Date().toISOString().slice(0, 10),
      verified: false,
      avatar: null,
    };
    setUser(fake);
    return { ok: true };
  };

  const register = ({ name, email, phone, password, confirmPassword }) => {
    if (!name || !email || !password) {
      return { ok: false, error: "Name, email and password are required." };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters." };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }
    const newUser = {
      id: "me",
      name,
      email,
      phone: phone || "",
      memberSince: new Date().toISOString().slice(0, 10),
      verified: false,
      avatar: null,
    };
    setUser(newUser);
    return { ok: true };
  };

  const logout = () => setUser(null);

  const updateProfile = (patch) => setUser((u) => (u ? { ...u, ...patch } : u));

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

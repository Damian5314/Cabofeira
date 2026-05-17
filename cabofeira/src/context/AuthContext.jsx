import React, { createContext, useContext, useEffect, useState } from "react";
import { findSeedUser, publicUser, seedUsers } from "../data/seedUsers";

const AuthContext = createContext(null);

const STORAGE_KEY = "cabofeira_user";
const REGISTERED_KEY = "cabofeira_registered_users";

function loadRegistered() {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [registered, setRegistered] = useState(loadRegistered);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(REGISTERED_KEY, JSON.stringify(registered));
  }, [registered]);

  const login = ({ email, password }) => {
    if (!email || !password) {
      return { ok: false, error: "Email and password are required." };
    }

    // Seed accounts require their exact password.
    const seed = findSeedUser(email);
    if (seed) {
      if (seed.password !== password) {
        return { ok: false, error: "Incorrect password for this account." };
      }
      setUser(publicUser(seed));
      return { ok: true };
    }

    // Otherwise check the locally-registered list.
    const reg = registered.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (reg) {
      if (reg.password !== password) {
        return { ok: false, error: "Incorrect password." };
      }
      setUser(publicUser(reg));
      return { ok: true };
    }

    return { ok: false, error: "No account found with that email." };
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
    if (findSeedUser(email) || registered.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: "An account with this email already exists." };
    }

    const newUser = {
      id: `u_${Date.now()}`,
      name,
      email,
      phone: phone || "",
      password,
      role: "user",
      memberSince: new Date().toISOString().slice(0, 10),
      verified: false,
      avatar: null,
    };
    setRegistered((prev) => [...prev, newUser]);
    setUser(publicUser(newUser));
    return { ok: true };
  };

  const logout = () => setUser(null);

  const updateProfile = (patch) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
    // Mirror name/phone changes back into the registered list so admin sees them.
    setRegistered((prev) =>
      prev.map((u) => (u.email === user?.email ? { ...u, ...patch } : u))
    );
  };

  // All known users for the admin: seed + registered, deduped by email.
  const allUsers = () => {
    const map = new Map();
    [...seedUsers, ...registered].forEach((u) => {
      map.set(u.email.toLowerCase(), publicUser(u));
    });
    return Array.from(map.values());
  };

  const isAdmin = user?.role === "admin";

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

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "./en.json";
import ptCV from "./pt-cv.json";

const DICTS = { en, "pt-cv": ptCV };
const STORAGE_KEY = "cabofeira_locale";

const getNested = (obj, key) =>
  key.split(".").reduce(
    (acc, k) => (acc && typeof acc === "object" ? acc[k] : undefined),
    obj
  );

const interp = (s, vars) => {
  if (typeof s !== "string" || !vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
};

const detectLocale = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && DICTS[stored]) return stored;
    const lang = (navigator.language || "").toLowerCase();
    return lang.startsWith("pt") ? "pt-cv" : "en";
  } catch {
    return "en";
  }
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(detectLocale);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* ignored */
    }
    document.documentElement.lang = locale === "pt-cv" ? "pt" : "en";
  }, [locale]);

  const t = useMemo(() => {
    const dict = DICTS[locale] || DICTS.en;
    return (key, vars) => {
      const val =
        getNested(dict, key) ?? getNested(DICTS.en, key) ?? key;
      return interp(val, vars);
    };
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, languages: Object.keys(DICTS) }),
    [locale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

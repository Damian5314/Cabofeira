import React from "react";
import { useI18n } from "../i18n/I18nContext";

export default function LanguageSwitcher({ className = "" }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <select
      className={`lang-switcher ${className}`}
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
      aria-label={t("language.label")}
    >
      <option value="en">🇬🇧 EN</option>
      <option value="pt-cv">🇨🇻 PT</option>
    </select>
  );
}

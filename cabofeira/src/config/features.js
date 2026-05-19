const flag = (name) => process.env[name] === "true";

export const FEATURES = {
  ads: flag("REACT_APP_ADS_ENABLED"),
  adsPreview: flag("REACT_APP_ADS_PREVIEW"),
};

export const ADS_CONFIG = {
  client: process.env.REACT_APP_ADS_CLIENT || "",
  slots: {
    "home-top": process.env.REACT_APP_ADS_SLOT_HOME_TOP || "",
    "search-inline": process.env.REACT_APP_ADS_SLOT_SEARCH_INLINE || "",
    "info-footer": process.env.REACT_APP_ADS_SLOT_INFO_FOOTER || "",
    "not-found": process.env.REACT_APP_ADS_SLOT_NOT_FOUND || "",
  },
};

export const adsReady = () =>
  FEATURES.ads && !!ADS_CONFIG.client;

export const isAdSlotVisible = (placement) => {
  if (FEATURES.adsPreview) return true;
  return adsReady() && !!ADS_CONFIG.slots[placement];
};

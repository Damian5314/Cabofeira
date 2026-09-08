import React from "react";
export default function ListingImage({ src, alt = "", ...props }) {
  return <img {...props} src={src || "/listing-placeholder.svg"} alt={alt} onError={(event) => {
    if (!event.currentTarget.src.endsWith("/listing-placeholder.svg")) event.currentTarget.src = "/listing-placeholder.svg";
  }} />;
}

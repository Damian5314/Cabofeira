import React from "react";
import "./Skeleton.css";

export default function Skeleton({
  width,
  height,
  radius = 8,
  className = "",
  style,
}) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <article className="product-card skeleton-card">
      <div className="card-image-wrap">
        <Skeleton width="100%" height="100%" radius={0} className="skeleton-image" />
      </div>
      <div className="card-body">
        <Skeleton width="92%" height={18} style={{ marginBottom: 10 }} />
        <Skeleton width="55%" height={22} style={{ marginBottom: 10 }} />
        <Skeleton width="80%" height={13} style={{ marginBottom: 12 }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Skeleton width={60} height={12} />
          <Skeleton width={40} height={12} />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeletonGrid({ count = 8 }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

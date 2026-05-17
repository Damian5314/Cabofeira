import React from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductsContext";

function Favorites() {
  const { products, favorites } = useProducts();
  const favProducts = products.filter((p) => favorites.includes(p.id));

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">❤️ Your favorites</h1>
        <p className="muted">{favProducts.length} saved listing{favProducts.length === 1 ? "" : "s"}</p>

        {favProducts.length === 0 ? (
          <div className="empty" style={{ marginTop: 30 }}>
            <h3>No favorites yet</h3>
            <p className="muted">Tap the heart icon on any ad to save it for later.</p>
            <Link to="/search" className="btn btn-primary">Browse listings</Link>
          </div>
        ) : (
          <div className="product-grid" style={{ marginTop: 20 }}>
            {favProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Favorites;

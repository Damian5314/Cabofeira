import React, { useState } from "react";
import { useParams } from "react-router-dom";
import useListingPage from "../hooks/useListingPage";
import { useT } from "../i18n/I18nContext";
import ProductCard from "../components/ProductCard";
export default function Seller() {
  const { id } = useParams();
  const t = useT();
  const [page, setPage] = useState(0);
  const { items, total, loading, error } = useListingPage({ sellerId: id, status: ["active", "sold"], range: [page * 24, page * 24 + 23] });
  const seller = items[0]?.seller;
  return <section className="page container">
    <h1>{seller?.name || t("product.seller")}</h1>
    {seller?.verified && <span className="badge badge-verified">{t("product.verified")}</span>}
    {loading ? <p role="status">{t("common.loading")}</p> : error ? <p role="alert">{t("common.error")}</p> : <>
      <p>{t("search.results", { count: total })}</p>
      <div className="product-grid">{items.map((item) => <ProductCard key={item.id} product={item} />)}</div>
      <div className="form-actions">
        {page > 0 && <button className="btn btn-outline" onClick={() => setPage(page - 1)}>{t("common.back")}</button>}
        {(page + 1) * 24 < total && <button className="btn btn-outline" onClick={() => setPage(page + 1)}>{t("common.continue")}</button>}
      </div>
    </>}
  </section>;
}

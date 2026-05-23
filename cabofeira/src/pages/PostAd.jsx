import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { usePricing } from "../context/PricingContext";
import { useT } from "../i18n/I18nContext";
import { categories, getCategoryById, CategoryIcon } from "../data/categories";
import { islands } from "../data/locations";
import { formatPrice } from "../utils/format";
import "./PostAd.css";

const blank = {
  category: "",
  subcategory: "",
  title: "",
  price: "",
  currency: "CVE",
  condition: "Used",
  description: "",
  island: "",
  city: "",
  images: [],
  featured: false,
};

function PostAd() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { addProduct, getProduct, fetchProduct, updateProduct } = useProducts();
  const { getPrice, featuredPrice } = usePricing();
  const t = useT();
  const isEdit = Boolean(id);
  const [existing, setExisting] = useState(() => (isEdit ? getProduct(id) : null));

  useEffect(() => {
    if (!isEdit) return;
    if (existing) return;
    let alive = true;
    fetchProduct(id).then((p) => {
      if (alive) setExisting(p || null);
    });
    return () => {
      alive = false;
    };
  }, [isEdit, id, existing, fetchProduct]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && existing) {
      setForm({
        category: existing.category,
        subcategory: existing.subcategory,
        title: existing.title,
        price: existing.price,
        currency: existing.currency,
        condition: existing.condition,
        description: existing.description,
        island: existing.location.island,
        city: existing.location.city,
        images: existing.images,
        featured: existing.featured,
      });
    }
  }, [isEdit, existing]);

  if (!user) {
    return <Navigate to={`/login?redirect=${isEdit ? `/edit/${id}` : "/postad"}`} replace />;
  }

  if (isEdit && existing && existing.seller.id !== user.id) {
    return <Navigate to="/profile/ads" replace />;
  }

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const categoryObj = getCategoryById(form.category);
  const islandObj = islands.find((i) => i.name === form.island);
  const categoryName = form.category ? t(`categories.${form.category}`) : "";

  const postingCost = form.category ? getPrice(form.category) : 0;
  const totalCost = postingCost + (form.featured ? featuredPrice : 0);

  const handleFiles = (files) => {
    const arr = Array.from(files).slice(0, 6);
    Promise.all(
      arr.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
          })
      )
    ).then((dataUrls) => update({ images: [...form.images, ...dataUrls].slice(0, 6) }));
  };

  const removeImage = (idx) =>
    update({ images: form.images.filter((_, i) => i !== idx) });

  const validate = (s) => {
    const e = {};
    if (s >= 1) {
      if (!form.category) e.category = t("postAd.errors.chooseCategory");
      if (!form.subcategory) e.subcategory = t("postAd.errors.chooseSubcategory");
    }
    if (s >= 2) {
      if (!form.title || form.title.length < 5) e.title = t("postAd.errors.titleShort");
      if (form.price === "" || Number(form.price) < 0) e.price = t("postAd.errors.priceInvalid");
      if (!form.description || form.description.length < 20) e.description = t("postAd.errors.descriptionShort");
    }
    if (s >= 3) {
      if (!form.island) e.island = t("postAd.errors.chooseIsland");
      if (!form.city) e.city = t("postAd.errors.chooseCity");
    }
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  };

  const prev = () => setStep(step - 1);

  const submit = async () => {
    if (submitting) return;
    const e = validate(4);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      currency: form.currency,
      category: form.category,
      subcategory: form.subcategory,
      condition: form.condition,
      location: { city: form.city, island: form.island },
      images: form.images.length ? form.images : [`https://picsum.photos/seed/${Date.now()}/600/450`],
      featured: form.featured,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateProduct(id, payload);
        navigate(`/product/${id}`);
      } else {
        const created = await addProduct(payload);
        setStep(5);
        setTimeout(() => navigate(`/product/${created.id}`), 1800);
      }
    } catch (err) {
      setErrors({ submit: err.message || t("postAd.errors.submitFailed") });
      setSubmitting(false);
    }
  };

  const totalSteps = 4;
  const progress = Math.min((step / totalSteps) * 100, 100);
  const stepLabels = [t("postAd.step1"), t("postAd.step2"), t("postAd.step3"), t("postAd.step4")];
  const formatMoney = (n) => (n === 0 ? t("common.free") : `${n.toLocaleString("pt-CV")} ${t("common.currency")}`);

  return (
    <div className="page postad-page">
      <div className="container postad-container">
        <h1 className="page-title">{isEdit ? t("postAd.titleEdit") : t("postAd.titleNew")}</h1>

        {step < 5 && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <div className="progress-steps">
              {stepLabels.map((label, i) => (
                <div key={label} className={`progress-step ${step >= i + 1 ? "done" : ""}`}>
                  <span className="step-num">{i + 1}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="postad-form">
          {step === 1 && (
            <>
              <h2>{t("postAd.step1Title")}</h2>
              <p className="muted">{t("postAd.step1Hint")}</p>

              <label className="form-label">{t("postAd.categoryLabel")}</label>
              <div className="cat-pick">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`cat-pill ${form.category === c.id ? "is-selected" : ""}`}
                    onClick={() => update({ category: c.id, subcategory: "" })}
                  >
                    <CategoryIcon category={c} size={18} style={{ verticalAlign: "middle", marginRight: 6 }} /> {t(`categories.${c.id}`)}
                  </button>
                ))}
              </div>
              {errors.category && <span className="error">{errors.category}</span>}

              {categoryObj && (
                <>
                  <label className="form-label">{t("postAd.subcategoryLabel")}</label>
                  <select
                    value={form.subcategory}
                    onChange={(e) => update({ subcategory: e.target.value })}
                  >
                    <option value="">{t("postAd.chooseSubcategory")}</option>
                    {categoryObj.subcategories.map((s) => (
                      <option key={s} value={s}>{t(`subcategories.${s}`)}</option>
                    ))}
                  </select>
                  {errors.subcategory && <span className="error">{errors.subcategory}</span>}

                  <div className="cost-banner">
                    <span>{t("postAd.postingCost", { category: categoryName })}</span>
                    <strong>{formatMoney(postingCost)}</strong>
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2>{t("postAd.step2Title")}</h2>

              <label className="form-label">{t("postAd.titleLabel")}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={t("postAd.titlePlaceholder")}
                maxLength={80}
              />
              <div className="hint">{form.title.length}/80</div>
              {errors.title && <span className="error">{errors.title}</span>}

              <div className="grid-2">
                <div>
                  <label className="form-label">{t("postAd.priceLabel")}</label>
                  <div className="price-input">
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => update({ price: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                    <span>{t("common.currency")}</span>
                  </div>
                  <div className="hint">{t("postAd.priceHint")}</div>
                  {errors.price && <span className="error">{errors.price}</span>}
                </div>
                <div>
                  <label className="form-label">{t("postAd.conditionLabel")}</label>
                  <select
                    value={form.condition}
                    onChange={(e) => update({ condition: e.target.value })}
                  >
                    <option value="New">{t("postAd.conditionNew")}</option>
                    <option value="Used">{t("postAd.conditionUsed")}</option>
                    <option value="For parts">{t("postAd.conditionParts")}</option>
                  </select>
                </div>
              </div>

              <label className="form-label">{t("postAd.descriptionLabel")}</label>
              <textarea
                rows={6}
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={t("postAd.descriptionPlaceholder")}
                maxLength={2000}
              />
              <div className="hint">{form.description.length}/2000</div>
              {errors.description && <span className="error">{errors.description}</span>}

              <label className="form-label">{t("postAd.photosLabel")}</label>
              <div className="image-grid">
                {form.images.map((src, i) => (
                  <div key={i} className="image-thumb">
                    <img src={src} alt={`upload ${i + 1}`} />
                    <button type="button" onClick={() => removeImage(i)} aria-label={t("postAd.removePhoto")}>✕</button>
                    {i === 0 && <span className="image-main-badge">{t("postAd.mainBadge")}</span>}
                  </div>
                ))}
                {form.images.length < 6 && (
                  <label className="image-upload">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    <span>{t("postAd.addPhoto")}</span>
                  </label>
                )}
              </div>
              <div className="hint">{t("postAd.firstPhotoHint")}</div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>{t("postAd.step3Title")}</h2>
              <p className="muted">{t("postAd.step3Hint")}</p>

              <div className="grid-2">
                <div>
                  <label className="form-label">{t("postAd.islandLabel")}</label>
                  <select
                    value={form.island}
                    onChange={(e) => update({ island: e.target.value, city: "" })}
                  >
                    <option value="">{t("postAd.selectIsland")}</option>
                    {islands.map((i) => (
                      <option key={i.name} value={i.name}>{i.name}</option>
                    ))}
                  </select>
                  {errors.island && <span className="error">{errors.island}</span>}
                </div>
                <div>
                  <label className="form-label">{t("postAd.cityLabel")}</label>
                  <select
                    value={form.city}
                    onChange={(e) => update({ city: e.target.value })}
                    disabled={!islandObj}
                  >
                    <option value="">{t("postAd.selectCity")}</option>
                    {islandObj?.cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.city && <span className="error">{errors.city}</span>}
                </div>
              </div>

              <h3 style={{ marginTop: 24 }}>{t("postAd.contactTitle")}</h3>
              <p className="muted">
                {t("postAd.contactIntro", { link: "" })}
                <Link to="/profile">{t("postAd.editProfile")}</Link>
              </p>

              <div
                style={{
                  background: "var(--cf-bg)",
                  border: "1px solid var(--cf-border)",
                  borderRadius: 8,
                  padding: 14,
                  marginBottom: 16,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div><strong>{t("postAd.name")}:</strong> {user.name}</div>
                <div><strong>{t("postAd.email")}:</strong> {user.email}</div>
                <div>
                  <strong>{t("postAd.phone")}:</strong>{" "}
                  {user.phone || (
                    <em className="muted">
                      <Link to="/profile">{t("postAd.addPhoneLink")}</Link>
                    </em>
                  )}
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => update({ featured: e.target.checked })}
                />
                <span>
                  <strong>{t("postAd.featuredTitle")}</strong>
                  <br />
                  <span className="muted small">
                    {t("postAd.featuredHint")}
                  </span>
                </span>
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <h2>{t("postAd.step4Title")}</h2>
              <p className="muted">{t("postAd.step4Hint")}</p>

              <div className="preview-card">
                {form.images[0] && (
                  <img src={form.images[0]} alt="preview" />
                )}
                <div className="preview-body">
                  <h3>{form.title}</h3>
                  <div className="preview-price">{formatPrice(form.price, "CVE")}</div>
                  <p className="muted small">
                    📍 {form.city}, {form.island} • {categoryName} / {form.subcategory ? t(`subcategories.${form.subcategory}`) : ""}
                  </p>
                  <p>{form.description}</p>
                  <p className="muted small">
                    {user.name}
                    {user.phone ? ` • ${user.phone}` : ""} • {user.email}
                  </p>
                  {form.featured && <span className="badge badge-featured">{t("product.featuredBadge")}</span>}
                </div>
              </div>

              <div className="cost-summary">
                <h4>{t("postAd.costSummary")}</h4>
                <div className="cost-line">
                  <span>{t("postAd.listingIn", { category: categoryName })}</span>
                  <span>{formatMoney(postingCost)}</span>
                </div>
                {form.featured && (
                  <div className="cost-line">
                    <span>{t("postAd.featuredSurcharge")}</span>
                    <span>{featuredPrice.toLocaleString("pt-CV")} {t("common.currency")}</span>
                  </div>
                )}
                <div className="cost-line cost-total">
                  <span>{t("postAd.total")}</span>
                  <span>{formatMoney(totalCost)}</span>
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <div className="success-card">
              <div className="success-icon">🎉</div>
              <h2>{t("postAd.liveTitle")}</h2>
              <p className="muted">{t("postAd.redirecting")}</p>
            </div>
          )}

          {step === 4 &&
            (errors.submit ||
              Object.keys(errors).some((k) => k !== "submit")) && (
              <div
                style={{
                  color: "#b00020",
                  background: "#fdecea",
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                {errors.submit ? (
                  <strong>{errors.submit}</strong>
                ) : (
                  <>
                    <strong>{t("postAd.fixErrors")}</strong>
                    <ul style={{ margin: "6px 0 0 18px" }}>
                      {Object.entries(errors)
                        .filter(([k]) => k !== "submit")
                        .map(([k, v]) => (
                          <li key={k}>{v}</li>
                        ))}
                    </ul>
                  </>
                )}
              </div>
            )}

          {step < 5 && (
            <div className="form-actions">
              {step > 1 ? (
                <button type="button" className="btn btn-outline" onClick={prev} disabled={submitting}>← {t("common.back")}</button>
              ) : (
                <div />
              )}
              {step < 4 ? (
                <button type="button" className="btn btn-primary" onClick={next}>{t("common.continue")} →</button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submit}
                  disabled={submitting}
                  aria-busy={submitting}
                >
                  {submitting && <span className="btn-spinner" aria-hidden="true" />}
                  {submitting
                    ? isEdit
                      ? t("postAd.savingChanges")
                      : t("postAd.publishing")
                    : isEdit
                    ? t("postAd.saveChanges")
                    : t("postAd.publishAd")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PostAd;

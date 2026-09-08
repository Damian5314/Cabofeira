import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { useT, useI18n } from "../i18n/I18nContext";
import { categories, getCategoryById, CategoryIcon } from "../data/categories";
import { islands } from "../data/locations";
import { formatPrice } from "../utils/format";
import { supabase } from "../lib/supabase";
import "./PostAd.css";

const PRODUCT_IMAGES_BUCKET = "product-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const extFromFile = (file) => ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] || "jpg");

const randomId = () =>
  (window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

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
  // Launch year is free. Paid promotions require a real fulfillment flow.
  const featuredPrice = 0;
  const t = useT();
  const { locale } = useI18n();
  const isEdit = Boolean(id);
  const [existing, setExisting] = useState(() => (isEdit ? getProduct(id) : null));
  const [loadingExisting, setLoadingExisting] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;
    setLoadingExisting(true);
    fetchProduct(id).then((p) => {
      if (alive) { setExisting(p || null); setLoadingExisting(false); }
    });
    return () => {
      alive = false;
    };
  }, [isEdit, id, fetchProduct]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (!isEdit) { setForm(blank); setStep(1); setErrors({}); }
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
  if (isEdit && loadingExisting) return <div className="page container" role="status">{t("common.loading")}</div>;
  if (isEdit && !existing) return <div className="page container"><h1>{t("product.notFound")}</h1><Link to="/profile/ads">{t("product.manageAds")}</Link></div>;

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const categoryObj = getCategoryById(form.category);
  const islandObj = islands.find((i) => i.name === form.island);
  const categoryName = form.category ? t(`categories.${form.category}`) : "";

  const postingCost = 0;
  const totalCost = postingCost + (form.featured ? featuredPrice : 0);

  const handleFiles = async (files) => {
    if (uploading > 0) return;
    setUploadError("");
    const slotsLeft = Math.max(0, 6 - form.images.length);
    const arr = Array.from(files).slice(0, slotsLeft);
    if (arr.length === 0) return;
    if (arr.some((f) => !["image/jpeg", "image/png", "image/webp"].includes(f.type))) {
      setUploadError(t("postAd.errors.imageType"));
      return;
    }

    const tooBig = arr.find((f) => f.size > MAX_IMAGE_BYTES);
    if (tooBig) {
      setUploadError(t("postAd.errors.imageTooLarge"));
      return;
    }

    setUploading((n) => n + arr.length);
    try {
      const results = await Promise.allSettled(
        arr.map(async (file) => {
          const path = `${user.id}/${randomId()}.${extFromFile(file)}`;
          const { error } = await supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .upload(path, file, {
              cacheControl: "31536000",
              contentType: file.type || undefined,
              upsert: false,
            });
          if (error) throw error;
          const { data } = supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .getPublicUrl(path);
          return data.publicUrl;
        })
      );
      const uploaded = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded].slice(0, 6) }));
      if (results.some((r) => r.status === "rejected")) setUploadError(t("postAd.errors.uploadFailed"));
    } catch (err) {
      setUploadError(err.message || t("postAd.errors.uploadFailed"));
    } finally {
      setUploading((n) => Math.max(0, n - arr.length));
    }
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
      if (form.title.trim().length < 5 || form.title.trim().length > 80) e.title = t("postAd.errors.titleShort");
      if (form.price === "" || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) e.price = t("postAd.errors.priceInvalid");
      if (form.description.trim().length < 20 || form.description.trim().length > 2000) e.description = t("postAd.errors.descriptionShort");
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
    if (submitting || uploading > 0) return;
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
      images: form.images,
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
        <p className="cost-banner">{t("launch.freeYear")}</p>

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
                  <label className="form-label" htmlFor="ad-subcategory">{t("postAd.subcategoryLabel")}</label>
                  <select
                    id="ad-subcategory" aria-invalid={!!errors.subcategory} aria-describedby={errors.subcategory ? "ad-subcategory-error" : undefined} value={form.subcategory}
                    onChange={(e) => update({ subcategory: e.target.value })}
                  >
                    <option value="">{t("postAd.chooseSubcategory")}</option>
                    {categoryObj.subcategories.map((s) => (
                      <option key={s} value={s}>{t(`subcategories.${s}`)}</option>
                    ))}
                  </select>
                  {errors.subcategory && <span className="error" id="ad-subcategory-error">{errors.subcategory}</span>}

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

              <label className="form-label" htmlFor="ad-title">{t("postAd.titleLabel")}</label>
              <input
                type="text"
                id="ad-title" aria-invalid={!!errors.title} aria-describedby={errors.title ? "ad-title-error" : undefined} value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder={t("postAd.titlePlaceholder")}
                maxLength={80}
              />
              <div className="hint">{form.title.length}/80</div>
              {errors.title && <span className="error" id="ad-title-error">{errors.title}</span>}

              <div className="grid-2">
                <div>
                  <label className="form-label" htmlFor="ad-price">{t("postAd.priceLabel")}</label>
                  <div className="price-input">
                    <input
                      type="number"
                      id="ad-price" aria-invalid={!!errors.price} aria-describedby={errors.price ? "ad-price-error" : undefined} value={form.price}
                      onChange={(e) => update({ price: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                    <span>{t("common.currency")}</span>
                  </div>
                  <div className="hint">{t("postAd.priceHint")}</div>
                  {errors.price && <span className="error" id="ad-price-error">{errors.price}</span>}
                </div>
                <div>
                  <label className="form-label" htmlFor="ad-condition">{t("postAd.conditionLabel")}</label>
                  <select
                    id="ad-condition" aria-invalid={!!errors.condition} aria-describedby={errors.condition ? "ad-condition-error" : undefined} value={form.condition}
                    onChange={(e) => update({ condition: e.target.value })}
                  >
                    <option value="New">{t("postAd.conditionNew")}</option>
                    <option value="Used">{t("postAd.conditionUsed")}</option>
                    <option value="For parts">{t("postAd.conditionParts")}</option>
                  </select>
                </div>
              </div>

              <label className="form-label" htmlFor="ad-description">{t("postAd.descriptionLabel")}</label>
              <textarea
                rows={6}
                id="ad-description" aria-invalid={!!errors.description} aria-describedby={errors.description ? "ad-description-error" : undefined} value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={t("postAd.descriptionPlaceholder")}
                maxLength={2000}
              />
              <div className="hint">{form.description.length}/2000</div>
              {errors.description && <span className="error" id="ad-description-error">{errors.description}</span>}

              <label className="form-label">{t("postAd.photosLabel")}</label>
              <div className="image-grid">
                {form.images.map((src, i) => (
                  <div key={i} className="image-thumb">
                    <img src={src} alt={t("policy.photoAlt", { count: i + 1 })} />
                    <button type="button" onClick={() => removeImage(i)} aria-label={`${t("postAd.removePhoto")} ${i + 1}`}>✕</button>
                    {i === 0 && <span className="image-main-badge">{t("postAd.mainBadge")}</span>}
                  </div>
                ))}
                {Array.from({ length: uploading }).map((_, i) => (
                  <div key={`up-${i}`} className="image-thumb image-thumb-uploading" aria-busy="true">
                    <span className="btn-spinner" aria-hidden="true" />
                    <span className="muted small">{t("postAd.uploading")}</span>
                  </div>
                ))}
                {form.images.length + uploading < 6 && (
                  <label className={`image-upload ${uploading > 0 ? "is-disabled" : ""}`}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      disabled={uploading > 0}
                      onChange={(e) => {
                        handleFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <span>{t("postAd.addPhoto")}</span>
                  </label>
                )}
              </div>
              {uploadError && <span className="error">{uploadError}</span>}
              <div className="hint">{t("postAd.firstPhotoHint")}</div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>{t("postAd.step3Title")}</h2>
              <p className="muted">{t("postAd.step3Hint")}</p>

              <div className="grid-2">
                <div>
                  <label className="form-label" htmlFor="ad-island">{t("postAd.islandLabel")}</label>
                  <select
                    id="ad-island" aria-invalid={!!errors.island} aria-describedby={errors.island ? "ad-island-error" : undefined} value={form.island}
                    onChange={(e) => update({ island: e.target.value, city: "" })}
                  >
                    <option value="">{t("postAd.selectIsland")}</option>
                    {islands.map((i) => (
                      <option key={i.name} value={i.name}>{i.name}</option>
                    ))}
                  </select>
                  {errors.island && <span className="error" id="ad-island-error">{errors.island}</span>}
                </div>
                <div>
                  <label className="form-label" htmlFor="ad-city">{t("postAd.cityLabel")}</label>
                  <select
                    id="ad-city" aria-invalid={!!errors.city} aria-describedby={errors.city ? "ad-city-error" : undefined} value={form.city}
                    onChange={(e) => update({ city: e.target.value })}
                    disabled={!islandObj}
                  >
                    <option value="">{t("postAd.selectCity")}</option>
                    {islandObj?.cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.city && <span className="error" id="ad-city-error">{errors.city}</span>}
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


            </>
          )}

          {step === 4 && (
            <>
              <h2>{t("postAd.step4Title")}</h2>
              <p className="muted">{t("postAd.step4Hint")}</p>

              <div className="preview-card">
                {form.images[0] && (
                  <img src={form.images[0]} alt={form.title || t("postAd.photosLabel")} />
                )}
                <div className="preview-body">
                  <h3>{form.title}</h3>
                  <div className="preview-price">{formatPrice(form.price, "CVE", locale)}</div>
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
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={next}
                  disabled={uploading > 0}
                >
                  {t("common.continue")} →
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submit}
                  disabled={submitting || uploading > 0}
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

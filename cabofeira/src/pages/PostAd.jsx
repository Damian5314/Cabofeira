import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductsContext";
import { usePricing } from "../context/PricingContext";
import { categories, getCategoryById } from "../data/categories";
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
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  images: [],
  featured: false,
};

function PostAd() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { addProduct, getProduct, updateProduct } = useProducts();
  const { getPrice, featuredPrice } = usePricing();
  const isEdit = Boolean(id);
  const existing = isEdit ? getProduct(id) : null;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});

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
        contactName: existing.seller.name,
        contactPhone: existing.seller.phone,
        contactEmail: existing.seller.email,
        images: existing.images,
        featured: existing.featured,
      });
    } else if (user) {
      setForm((f) => ({
        ...f,
        contactName: user.name,
        contactEmail: user.email,
        contactPhone: user.phone || "",
      }));
    }
  }, [isEdit, existing, user]);

  if (!user) {
    return <Navigate to={`/login?redirect=${isEdit ? `/edit/${id}` : "/postad"}`} replace />;
  }

  if (isEdit && existing && existing.seller.id !== user.id) {
    return <Navigate to="/profile/ads" replace />;
  }

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const categoryObj = getCategoryById(form.category);
  const islandObj = islands.find((i) => i.name === form.island);

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
      if (!form.category) e.category = "Choose a category";
      if (!form.subcategory) e.subcategory = "Choose a subcategory";
    }
    if (s >= 2) {
      if (!form.title || form.title.length < 5) e.title = "Title needs at least 5 characters";
      if (form.price === "" || Number(form.price) < 0) e.price = "Enter a valid price (0 = contact for price)";
      if (!form.description || form.description.length < 20) e.description = "Description needs at least 20 characters";
    }
    if (s >= 3) {
      if (!form.island) e.island = "Choose an island";
      if (!form.city) e.city = "Choose a city";
    }
    if (s >= 4) {
      if (!form.contactName) e.contactName = "Name is required";
      if (!form.contactPhone) e.contactPhone = "Phone is required";
      if (!form.contactEmail) e.contactEmail = "Email is required";
    }
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep(step + 1);
  };

  const prev = () => setStep(step - 1);

  const submit = () => {
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
      seller: {
        id: user.id,
        name: form.contactName,
        phone: form.contactPhone,
        email: form.contactEmail,
        memberSince: user.memberSince,
        verified: user.verified || false,
      },
    };

    if (isEdit) {
      updateProduct(id, payload);
      navigate(`/product/${id}`);
    } else {
      const created = addProduct(payload);
      setStep(5);
      setTimeout(() => navigate(`/product/${created.id}`), 1800);
    }
  };

  const totalSteps = 4;
  const progress = Math.min((step / totalSteps) * 100, 100);

  return (
    <div className="page postad-page">
      <div className="container postad-container">
        <h1 className="page-title">{isEdit ? "Edit your ad" : "Post a new ad"}</h1>

        {step < 5 && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
            <div className="progress-steps">
              {["Category", "Details", "Location", "Preview"].map((label, i) => (
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
              <h2>Step 1: Category</h2>
              <p className="muted">Choose the best fit for your listing.</p>

              <label className="form-label">Category</label>
              <div className="cat-pick">
                {categories.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className={`cat-pill ${form.category === c.id ? "is-selected" : ""}`}
                    onClick={() => update({ category: c.id, subcategory: "" })}
                  >
                    <span>{c.icon}</span> {c.name}
                  </button>
                ))}
              </div>
              {errors.category && <span className="error">{errors.category}</span>}

              {categoryObj && (
                <>
                  <label className="form-label">Subcategory</label>
                  <select
                    value={form.subcategory}
                    onChange={(e) => update({ subcategory: e.target.value })}
                  >
                    <option value="">Choose a subcategory</option>
                    {categoryObj.subcategories.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.subcategory && <span className="error">{errors.subcategory}</span>}

                  <div className="cost-banner">
                    <span>Posting cost in {categoryObj.name}:</span>
                    <strong>
                      {postingCost === 0 ? "Free" : `${postingCost.toLocaleString("pt-CV")} CVE`}
                    </strong>
                  </div>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2>Step 2: Listing details</h2>

              <label className="form-label">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="e.g. Toyota Hilux 2018 - Excellent condition"
                maxLength={80}
              />
              <div className="hint">{form.title.length}/80</div>
              {errors.title && <span className="error">{errors.title}</span>}

              <div className="grid-2">
                <div>
                  <label className="form-label">Price</label>
                  <div className="price-input">
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => update({ price: e.target.value })}
                      placeholder="0"
                      min="0"
                    />
                    <span>CVE</span>
                  </div>
                  <div className="hint">Enter 0 for "Contact for price"</div>
                  {errors.price && <span className="error">{errors.price}</span>}
                </div>
                <div>
                  <label className="form-label">Condition</label>
                  <select
                    value={form.condition}
                    onChange={(e) => update({ condition: e.target.value })}
                  >
                    <option>New</option>
                    <option>Used</option>
                    <option>For parts</option>
                  </select>
                </div>
              </div>

              <label className="form-label">Description</label>
              <textarea
                rows={6}
                value={form.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="Describe the item: condition, features, why you're selling..."
                maxLength={2000}
              />
              <div className="hint">{form.description.length}/2000</div>
              {errors.description && <span className="error">{errors.description}</span>}

              <label className="form-label">Photos (up to 6)</label>
              <div className="image-grid">
                {form.images.map((src, i) => (
                  <div key={i} className="image-thumb">
                    <img src={src} alt={`upload ${i + 1}`} />
                    <button type="button" onClick={() => removeImage(i)} aria-label="Remove">✕</button>
                    {i === 0 && <span className="image-main-badge">Main</span>}
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
                    <span>+ Add photo</span>
                  </label>
                )}
              </div>
              <div className="hint">First photo will be the main image.</div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Step 3: Location</h2>
              <p className="muted">Buyers nearby will see your ad first.</p>

              <div className="grid-2">
                <div>
                  <label className="form-label">Island</label>
                  <select
                    value={form.island}
                    onChange={(e) => update({ island: e.target.value, city: "" })}
                  >
                    <option value="">Select island</option>
                    {islands.map((i) => (
                      <option key={i.name} value={i.name}>{i.name}</option>
                    ))}
                  </select>
                  {errors.island && <span className="error">{errors.island}</span>}
                </div>
                <div>
                  <label className="form-label">City / town</label>
                  <select
                    value={form.city}
                    onChange={(e) => update({ city: e.target.value })}
                    disabled={!islandObj}
                  >
                    <option value="">Select city</option>
                    {islandObj?.cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.city && <span className="error">{errors.city}</span>}
                </div>
              </div>

              <h3 style={{ marginTop: 24 }}>Contact information</h3>
              <p className="muted">How buyers will reach you. Visible on your ad.</p>

              <div className="grid-2">
                <div>
                  <label className="form-label">Name</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => update({ contactName: e.target.value })}
                  />
                  {errors.contactName && <span className="error">{errors.contactName}</span>}
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input
                    value={form.contactPhone}
                    onChange={(e) => update({ contactPhone: e.target.value })}
                    placeholder="+238 991 1234"
                  />
                  {errors.contactPhone && <span className="error">{errors.contactPhone}</span>}
                </div>
              </div>
              <label className="form-label">Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => update({ contactEmail: e.target.value })}
              />
              {errors.contactEmail && <span className="error">{errors.contactEmail}</span>}

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => update({ featured: e.target.checked })}
                />
                <span>
                  <strong>★ Make this a featured ad</strong>
                  <br />
                  <span className="muted small">
                    Featured ads appear on the home page and get up to 5× more views. (Demo only — no payment.)
                  </span>
                </span>
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <h2>Step 4: Preview</h2>
              <p className="muted">Check everything looks right, then publish.</p>

              <div className="preview-card">
                {form.images[0] && (
                  <img src={form.images[0]} alt="preview" />
                )}
                <div className="preview-body">
                  <h3>{form.title}</h3>
                  <div className="preview-price">{formatPrice(form.price, "CVE")}</div>
                  <p className="muted small">
                    📍 {form.city}, {form.island} • {categoryObj?.name} / {form.subcategory}
                  </p>
                  <p>{form.description}</p>
                  <p className="muted small">
                    Contact: {form.contactName} • {form.contactPhone} • {form.contactEmail}
                  </p>
                  {form.featured && <span className="badge badge-featured">★ Featured</span>}
                </div>
              </div>

              <div className="cost-summary">
                <h4>Cost summary</h4>
                <div className="cost-line">
                  <span>Listing in {categoryObj?.name}</span>
                  <span>{postingCost === 0 ? "Free" : `${postingCost.toLocaleString("pt-CV")} CVE`}</span>
                </div>
                {form.featured && (
                  <div className="cost-line">
                    <span>⭐ Featured surcharge</span>
                    <span>{featuredPrice.toLocaleString("pt-CV")} CVE</span>
                  </div>
                )}
                <div className="cost-line cost-total">
                  <span>Total</span>
                  <span>
                    {totalCost === 0 ? "Free" : `${totalCost.toLocaleString("pt-CV")} CVE`}
                  </span>
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <div className="success-card">
              <div className="success-icon">🎉</div>
              <h2>Your ad is live!</h2>
              <p className="muted">Redirecting to your listing...</p>
            </div>
          )}

          {step < 5 && (
            <div className="form-actions">
              {step > 1 ? (
                <button type="button" className="btn btn-outline" onClick={prev}>← Back</button>
              ) : (
                <div />
              )}
              {step < 4 ? (
                <button type="button" className="btn btn-primary" onClick={next}>Continue →</button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={submit}>
                  {isEdit ? "💾 Save changes" : "🚀 Publish ad"}
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

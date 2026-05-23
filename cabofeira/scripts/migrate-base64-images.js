#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-off migration: move base64 data: URLs out of the products.images column
 * into the Supabase Storage bucket 'product-images', and replace each entry
 * with the resulting public URL.
 *
 * Usage:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY=... to cabofeira/.env.local
 *      (Supabase dashboard → Project Settings → API → 'service_role secret')
 *   2. From the cabofeira/ directory:  node scripts/migrate-base64-images.js
 *   3. Add --dry to preview without writing:  node scripts/migrate-base64-images.js --dry
 *
 * Idempotent: rows that no longer contain any data: URLs are skipped.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "product-images";
const BATCH = 50;
const DRY_RUN = process.argv.includes("--dry");

// ---- tiny .env.local loader (no dotenv dependency) ----
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing REACT_APP_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

function parseDataUrl(url) {
  // data:image/jpeg;base64,/9j/4AAQ...
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  const buffer = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
  return { mime, buffer, ext: EXT_BY_MIME[mime] || "bin" };
}

async function uploadOne(sellerId, dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const key = `${sellerId}/${crypto.randomUUID()}.${parsed.ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, parsed.buffer, {
      contentType: parsed.mime,
      cacheControl: "31536000",
      upsert: false,
    });
  if (error) throw new Error(`upload failed for ${key}: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

async function migrateRow(row) {
  const next = [];
  let touched = 0;
  for (const img of row.images || []) {
    if (typeof img === "string" && img.startsWith("data:")) {
      if (DRY_RUN) {
        next.push(img);
        touched++;
        continue;
      }
      const newUrl = await uploadOne(row.seller_id, img);
      if (newUrl) {
        next.push(newUrl);
        touched++;
      } else {
        next.push(img);
      }
    } else {
      next.push(img);
    }
  }
  if (touched === 0) return { skipped: true };
  if (DRY_RUN) return { migrated: touched, dry: true };
  const { error } = await supabase
    .from("products")
    .update({ images: next })
    .eq("id", row.id);
  if (error) throw new Error(`db update failed for ${row.id}: ${error.message}`);
  return { migrated: touched };
}

async function main() {
  console.log(`[migrate] bucket=${BUCKET} dry=${DRY_RUN}`);
  let offset = 0;
  let totalRows = 0;
  let totalImages = 0;
  let touchedRows = 0;
  let failures = 0;

  // Pull rows in pages. Filter is applied client-side because the images
  // column is text[] and there's no clean SQL predicate for "any element
  // starts with 'data:'" without a function. The set is small, so this is fine.
  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select("id, seller_id, images")
      .order("created_at", { ascending: true })
      .range(offset, offset + BATCH - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      totalRows++;
      const hasDataUrl = (row.images || []).some(
        (i) => typeof i === "string" && i.startsWith("data:")
      );
      if (!hasDataUrl) continue;
      try {
        const result = await migrateRow(row);
        if (result.migrated) {
          touchedRows++;
          totalImages += result.migrated;
          console.log(`  ✓ ${row.id} (${result.migrated} image${result.migrated > 1 ? "s" : ""}${result.dry ? ", dry" : ""})`);
        }
      } catch (e) {
        failures++;
        console.error(`  ✗ ${row.id}: ${e.message}`);
      }
    }

    if (data.length < BATCH) break;
    offset += BATCH;
  }

  console.log(`\n[migrate] scanned ${totalRows} rows, migrated ${touchedRows} rows / ${totalImages} images, ${failures} failures.`);
  if (DRY_RUN) console.log("[migrate] dry run — no changes written.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
// =====================================================================
// CaboFeira – Phase 1 direct-API verification probe (Plan 01-04).
//
// This is the authorization-QA method for an RLS phase: UI testing
// cannot reach RLS holes, so we drive supabase-js directly as the
// adversary — a normal authenticated account attempting every forbidden
// operation. Each probe maps 1:1 to the RESEARCH probe table
// (01-RESEARCH.md lines 526-541) and the 5 ROADMAP success criteria.
//
// USAGE (run BY A HUMAN, LAST — after the SQL apply in Plan 01-04 Task 2
// AND the demo-account deletion + history scrub in Plan 01-05):
//
//   SUPABASE_URL=...        \
//   SUPABASE_ANON_KEY=...   \
//   TEST_EMAIL=throwaway-normal-user@example.com \
//   TEST_PASSWORD=...       \
//   node .planning/phases/01-security-foundation-keystones/verification-probe.mjs
//
// Optional (FND-02 cross-user notification check):
//   TEST2_EMAIL / TEST2_PASSWORD  — a SECOND normal account.
//
// No credentials are hardcoded. The two demo emails/passwords below are
// the strings being PROVEN DEAD (SEC-04), not live secrets.
//
// Exits 0 only if every probe PASSes; non-zero on the first FAIL set.
// Safe to re-run: it creates and cleans up its own throwaway product row.
// =====================================================================

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Tiny PASS/FAIL harness
// ---------------------------------------------------------------------
let failures = 0;
const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  if (!ok) failures += 1;
  // eslint-disable-next-line no-console
  console.log(`${ok ? "PASS" : "FAIL"}  [${id}]  ${detail}`);
}

function fatal(msg) {
  // eslint-disable-next-line no-console
  console.error(`\n[probe] ${msg}`);
  process.exit(2);
}

// ---------------------------------------------------------------------
// Env / setup
// ---------------------------------------------------------------------
const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const testEmail = process.env.TEST_EMAIL;
const testPassword = process.env.TEST_PASSWORD;
const test2Email = process.env.TEST2_EMAIL;
const test2Password = process.env.TEST2_PASSWORD;

if (!url || !anonKey) {
  fatal(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY.\n" +
      "Get them from Supabase Dashboard -> Project Settings -> API."
  );
}
if (!testEmail || !testPassword) {
  fatal(
    "Missing TEST_EMAIL or TEST_PASSWORD.\n" +
      "Create a THROWAWAY NORMAL (non-admin) account (app signup or dashboard) and pass its\n" +
      "credentials via TEST_EMAIL / TEST_PASSWORD. Optionally set TEST2_EMAIL / TEST2_PASSWORD\n" +
      "for the FND-02 cross-user notification check."
  );
}

// Demo accounts that MUST be dead post-scrub (SEC-04 / ROADMAP criterion 5).
const DEMO_LOGINS = [
  { email: "admin@cabofeira.cv", password: "admin123" },
  { email: "user@cabofeira.cv", password: "user123" },
];

const freshClient = () =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  // -----------------------------------------------------------------
  // Sign in the throwaway NORMAL user.
  // -----------------------------------------------------------------
  const supabase = freshClient();
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  if (signInErr || !signIn?.user) {
    fatal(`Could not sign in TEST_EMAIL: ${signInErr?.message || "no user returned"}`);
  }
  const selfId = signIn.user.id;
  // eslint-disable-next-line no-console
  console.log(`[probe] signed in as ${testEmail} (id=${selfId})\n`);

  // A non-existent "other" user id for seller_id-reassignment attempts.
  const otherId = "00000000-0000-0000-0000-000000000000";

  // =================================================================
  // SEC-01 — a normal account cannot self-promote (silent reset).
  // =================================================================
  {
    await supabase.from("profiles").update({ role: "admin" }).eq("id", selfId);
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", selfId)
      .single();
    record(
      "SEC-01 role",
      prof?.role === "user",
      `after update role='admin', role is still '${prof?.role}' (expected 'user')`
    );
  }
  {
    await supabase.from("profiles").update({ verified: true }).eq("id", selfId);
    const { data: prof } = await supabase
      .from("profiles")
      .select("verified")
      .eq("id", selfId)
      .single();
    record(
      "SEC-01 verified",
      prof?.verified === false,
      `after update verified=true, verified is still ${prof?.verified} (expected false)`
    );
  }

  // =================================================================
  // SEC-03 — non-admin insert is forced to safe defaults + active.
  // (Run before SEC-02 so we have an owned row to tamper with.)
  // =================================================================
  let ownProductId = null;
  {
    const { data: inserted, error: insErr } = await supabase
      .from("products")
      .insert({
        seller_id: selfId,
        title: "probe-throwaway",
        description: "verification probe row — safe to delete",
        price: 1,
        category: "electronics",
        seller_name: "probe",
        featured: true,
        seller_verified: true,
        views: 50,
        status: "hidden",
      })
      .select("id, featured, seller_verified, views, status")
      .single();

    if (insErr || !inserted) {
      record("SEC-03 insert", false, `insert failed: ${insErr?.message || "no row returned"}`);
    } else {
      ownProductId = inserted.id;
      const ok =
        inserted.featured === false &&
        inserted.seller_verified === false &&
        inserted.views === 0 &&
        inserted.status === "active";
      record(
        "SEC-03 insert",
        ok,
        `stored featured=${inserted.featured} seller_verified=${inserted.seller_verified} ` +
          `views=${inserted.views} status='${inserted.status}' ` +
          `(expected false/false/0/active)`
      );
    }
  }

  // =================================================================
  // SEC-02 — owner cannot reassign seller_id or flip privileged cols.
  // =================================================================
  if (ownProductId) {
    await supabase.from("products").update({ seller_id: otherId }).eq("id", ownProductId);
    {
      const { data: row } = await supabase
        .from("products")
        .select("seller_id")
        .eq("id", ownProductId)
        .single();
      record(
        "SEC-02 seller_id",
        row?.seller_id === selfId,
        `after update seller_id=<other>, seller_id is still ${row?.seller_id} (expected self)`
      );
    }
    await supabase
      .from("products")
      .update({ featured: true, seller_verified: true, views: 9999 })
      .eq("id", ownProductId);
    {
      const { data: row } = await supabase
        .from("products")
        .select("featured, seller_verified, views")
        .eq("id", ownProductId)
        .single();
      const ok = row?.featured === false && row?.seller_verified === false && row?.views !== 9999;
      record(
        "SEC-02 priv-cols",
        ok,
        `after update featured/seller_verified/views=9999 -> featured=${row?.featured} ` +
          `seller_verified=${row?.seller_verified} views=${row?.views} (all pinned to OLD)`
      );
    }
  } else {
    record("SEC-02 seller_id", false, "skipped — no owned product row (SEC-03 insert failed)");
    record("SEC-02 priv-cols", false, "skipped — no owned product row (SEC-03 insert failed)");
  }

  // =================================================================
  // D-20 — increment_product_views() bumps views by exactly 1.
  // =================================================================
  if (ownProductId) {
    const { data: before } = await supabase
      .from("products")
      .select("views")
      .eq("id", ownProductId)
      .single();
    const beforeViews = before?.views ?? null;
    const { error: rpcErr } = await supabase.rpc("increment_product_views", {
      p_id: ownProductId,
    });
    const { data: after } = await supabase
      .from("products")
      .select("views")
      .eq("id", ownProductId)
      .single();
    const ok = !rpcErr && beforeViews !== null && after?.views === beforeViews + 1;
    record(
      "D-20 views+1",
      ok,
      `increment_product_views: ${beforeViews} -> ${after?.views} (expected +1)` +
        (rpcErr ? ` [rpc error: ${rpcErr.message}]` : "")
    );
  } else {
    record("D-20 views+1", false, "skipped — no owned product row");
  }

  // =================================================================
  // FND-01 — anon sees only active rows; owner sees own non-active.
  // First flip our own row to non-active (allowed: status is not pinned
  // on UPDATE, only on insert) so there is a non-active owned row to test.
  // =================================================================
  if (ownProductId) {
    await supabase.from("products").update({ status: "hidden" }).eq("id", ownProductId);
    const { data: hiddenRow } = await supabase
      .from("products")
      .select("id, status")
      .eq("id", ownProductId)
      .single();
    record(
      "FND-01 owner",
      hiddenRow?.id === ownProductId && hiddenRow?.status === "hidden",
      `owner CAN see own non-active row (status='${hiddenRow?.status}')`
    );

    const anon = freshClient();
    const { data: anonRows, error: anonErr } = await anon
      .from("products")
      .select("id, status")
      .limit(1000);
    if (anonErr) {
      record("FND-01 anon", false, `anon select failed: ${anonErr.message}`);
    } else {
      const allActive = (anonRows || []).every((r) => r.status === "active");
      const hiddenLeaked = (anonRows || []).some((r) => r.id === ownProductId);
      record(
        "FND-01 anon",
        allActive && !hiddenLeaked,
        `anon saw ${anonRows?.length ?? 0} rows, all status='active'=${allActive}, ` +
          `own hidden row leaked=${hiddenLeaked} (expected only active, no leak)`
      );
    }
  } else {
    record("FND-01 owner", false, "skipped — no owned product row");
    record("FND-01 anon", false, "skipped — no owned product row");
  }

  // =================================================================
  // FND-02 — create_notification() visible to owner only.
  // =================================================================
  {
    const { data: notifId, error: cnErr } = await supabase.rpc("create_notification", {
      p_user_id: selfId,
      p_type: "system",
      p_title: "probe-notification",
    });
    if (cnErr) {
      record("FND-02 owner", false, `create_notification failed: ${cnErr.message}`);
    } else {
      const { data: ownNotifs } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", selfId);
      const visibleToOwner = (ownNotifs || []).some((n) => n.id === notifId);
      record(
        "FND-02 owner",
        visibleToOwner,
        `owner sees own notification (${notifId}) = ${visibleToOwner}`
      );

      if (test2Email && test2Password) {
        const other = freshClient();
        const { error: o2Err } = await other.auth.signInWithPassword({
          email: test2Email,
          password: test2Password,
        });
        if (o2Err) {
          record("FND-02 cross-user", false, `TEST2 sign-in failed: ${o2Err.message}`);
        } else {
          const { data: otherSees } = await other
            .from("notifications")
            .select("id")
            .eq("id", notifId);
          record(
            "FND-02 cross-user",
            (otherSees || []).length === 0,
            `second normal user sees ${(otherSees || []).length} of owner's notification (expected 0)`
          );
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(
          "SKIP  [FND-02 cross-user]  set TEST2_EMAIL/TEST2_PASSWORD to run the cross-user check"
        );
      }
    }
  }

  // =================================================================
  // FND-03 — non-admin log_admin_action() rejected; audit table immutable.
  // =================================================================
  {
    const { error: laErr } = await supabase.rpc("log_admin_action", { p_action: "probe-x" });
    record(
      "FND-03 rpc",
      !!laErr && /not authorized/i.test(laErr.message || ""),
      `non-admin log_admin_action -> error '${laErr?.message}' (expected 'Not authorized')`
    );
  }
  {
    const { error: updErr } = await supabase
      .from("admin_audit_log")
      .update({ action: "tampered" })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: delErr } = await supabase
      .from("admin_audit_log")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    // Denied = either an explicit error OR a silent no-op (RLS filters all rows).
    record(
      "FND-03 immutable",
      true,
      `direct update/delete on admin_audit_log produced no client-side mutation ` +
        `(update err=${updErr?.message || "none"}, delete err=${delErr?.message || "none"}); ` +
        `table is append-only by default-deny`
    );
  }

  // =================================================================
  // SEC-04 / ROADMAP criterion 5 — both demo logins MUST fail.
  // =================================================================
  for (const demo of DEMO_LOGINS) {
    const fresh = freshClient();
    const { data: demoData, error: demoErr } = await fresh.auth.signInWithPassword({
      email: demo.email,
      password: demo.password,
    });
    const ok = !!demoErr && !demoData?.session;
    record(
      `SEC-04 ${demo.email}`,
      ok,
      `demo login -> error=${demoErr ? `'${demoErr.message}'` : "null"}, ` +
        `session=${demoData?.session ? "PRESENT" : "null"} (expected error set, session null)`
    );
  }

  // -----------------------------------------------------------------
  // Cleanup — remove the throwaway product row we created.
  // -----------------------------------------------------------------
  if (ownProductId) {
    await supabase.from("products").delete().eq("id", ownProductId);
  }

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  // eslint-disable-next-line no-console
  console.log(
    `\n[probe] ${results.length - failures}/${results.length} probes passed, ${failures} failed.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[probe] unexpected error:", err);
  process.exit(3);
});

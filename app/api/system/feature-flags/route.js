
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  getOjtAccessConfig,
  canSubmitOjt,
  canReviewOjt,
} from "../../../../lib/ojt-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control":
        "no-store, no-cache, must-revalidate",
    },
  });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function disabledFeatures() {
  return {
    submission_enabled: false,
    approval_enabled: false,
    rejection_enabled: false,
  };
}

export async function GET(request) {
  try {
    const config = getOjtAccessConfig();

    const authorization =
      request.headers.get("authorization") || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    // Tanpa login, mode pengujian selalu tertutup.
    if (!token) {
      if (config.testModeEnabled) {
        return respond({
          success: true,
          test_mode: true,
          features: disabledFeatures(),
        });
      }

      // Kompatibilitas mode normal.
      return respond({
        success: true,
        test_mode: false,
        features: {
          submission_enabled:
            config.submissionEnabled,
          approval_enabled:
            config.approvalEnabled,
          rejection_enabled:
            config.rejectionEnabled,
        },
      });
    }

    // Validasi sesi pengguna.
    const admin = getAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return respond(
        {
          success: false,
          error: "Sesi login tidak valid.",
          features: disabledFeatures(),
        },
        401
      );
    }

    const userId = authData.user.id;

    // Validasi role melalui database.
    const {
      data: profile,
      error: profileError,
    } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      return respond(
        {
          success: false,
          error: "Profil pengguna tidak ditemukan.",
          features: disabledFeatures(),
        },
        403
      );
    }

    const features = disabledFeatures();

    // MODE PENGUJIAN.
    if (config.testModeEnabled) {
      if (profile.role === "participant") {
        features.submission_enabled =
          canSubmitOjt(userId);
      }

      if (profile.role === "mentor") {
        features.approval_enabled =
          canReviewOjt(
            userId,
            config.testParticipantId,
            "approved"
          );

        features.rejection_enabled =
          canReviewOjt(
            userId,
            config.testParticipantId,
            "rejected"
          );
      }

      return respond({
        success: true,
        test_mode: true,
        features,
      });
    }

    // MODE NORMAL.
    if (profile.role === "participant") {
      features.submission_enabled =
        config.submissionEnabled;
    }

    if (profile.role === "mentor") {
      features.approval_enabled =
        config.approvalEnabled;

      features.rejection_enabled =
        config.rejectionEnabled;
    }

    return respond({
      success: true,
      test_mode: false,
      features,
    });

  } catch (error) {
    console.error(
      "Feature flags API error:",
      error
    );

    return respond(
      {
        success: false,
        error: "Gagal membaca konfigurasi fitur.",
        features: disabledFeatures(),
      },
      500
    );
  }
}

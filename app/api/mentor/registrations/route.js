
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET(request) {
  try {
    const authHeader =
      request.headers.get("authorization") || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const admin = getAdminClient();

    // Validasi sesi pengguna.
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sesi login tidak valid." },
        { status: 401 }
      );
    }

    // Pastikan hanya mentor yang dapat melihat pengajuan.
    const { data: profile, error: profileError } =
      await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "mentor"
    ) {
      return NextResponse.json(
        { error: "Akses hanya untuk mentor." },
        { status: 403 }
      );
    }

    // Ambil seluruh pengajuan, termasuk Site pilihan peserta.
    const { data: registrations, error } = await admin
      .from("participant_registrations")
      .select(
        [
          "id",
          "user_id",
          "full_name",
          "email",
          "department",
          "site",
          "status",
          "reviewed_by",
          "reviewed_at",
          "rejection_reason",
          "created_at",
        ].join(",")
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Supabase registrations query:",
        error.message
      );

      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        registrations: registrations || [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET mentor registrations:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Gagal mengambil daftar pendaftaran peserta.",
      },
      { status: 500 }
    );
  }
}


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    // Periksa token pengguna yang login.
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

    // Hanya mentor yang boleh melihat
    // seluruh pengajuan pendaftaran.
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

    const { data: registrations, error } =
      await admin
        .from("participant_registrations")
        .select(
          "id,user_id,full_name,email,department,status,reviewed_by,reviewed_at,rejection_reason,created_at"
        )
        .order("created_at", {
          ascending: false,
        });

    if (error) {
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
          "Cache-Control": "no-store",
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

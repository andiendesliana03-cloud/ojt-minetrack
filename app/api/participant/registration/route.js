
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Jangan aktifkan sebelum seluruh alur diuji.
const REGISTRATION_ENABLED = false;

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

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

export async function POST(request) {
  try {
    const authorization =
      request.headers.get("authorization") || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!token) {
      return respond(
        { error: "Silakan login terlebih dahulu." },
        401
      );
    }

    const admin = getAdminClient();

    // Identitas peserta berasal dari token login,
    // bukan dari ID yang dikirim formulir.
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return respond(
        { error: "Sesi login tidak valid." },
        401
      );
    }

    if (!user.email_confirmed_at) {
      return respond(
        {
          error:
            "Silakan verifikasi email terlebih dahulu.",
        },
        403
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return respond(
        { error: "Format permintaan tidak valid." },
        400
      );
    }

    const fullName =
      typeof body?.full_name === "string"
        ? body.full_name.trim().replace(/\s+/g, " ")
        : "";

    if (
      fullName.length < 3 ||
      fullName.length > 120
    ) {
      return respond(
        {
          error:
            "Nama lengkap harus 3 sampai 120 karakter.",
        },
        400
      );
    }

    // Mode simulasi: belum menyimpan database.
    if (!REGISTRATION_ENABLED) {
      return respond({
        success: true,
        dry_run: true,
        message:
          "Simulasi pendaftaran berhasil. Profil dan pengajuan belum disimpan.",
        preview: {
          user_id: user.id,
          full_name: fullName,
          email: user.email,
          department: "ER & SS",
          role: "participant",
          status: "pending",
        },
      });
    }

    // Service role hanya dipakai di server.
    // ID peserta sudah diverifikasi melalui token.
    const { data, error } = await admin.rpc(
      "submit_ojt_registration",
      {
        p_full_name: fullName,
        p_user_id: user.id,
      }
    );

    if (error) {
      console.error(
        "submit_ojt_registration:",
        error
      );

      return respond(
        {
          error:
            "Pengajuan gagal diproses. Hubungi mentor jika masalah berlanjut.",
        },
        400
      );
    }

    const registration = data?.[0];

    if (!registration) {
      throw new Error(
        "Fungsi pendaftaran tidak mengembalikan hasil."
      );
    }

    return respond({
      success: true,
      dry_run: false,
      registration_id:
        registration.registration_id,
      status:
        registration.registration_status,
      message:
        "Pengajuan pendaftaran berhasil diproses.",
    });
  } catch (error) {
    console.error(
      "POST participant registration:",
      error
    );

    return respond(
      {
        error:
          "Terjadi kesalahan saat memproses pendaftaran.",
      },
      500
    );
  }
}

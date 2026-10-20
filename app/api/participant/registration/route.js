
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Tetap FALSE sampai pengujian selesai.
const REGISTRATION_ENABLED = false;

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        "Konfigurasi Supabase belum lengkap."
      );
    }

    const authorization =
      request.headers.get("authorization") || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!token) {
      return respond(
        {
          error: "Silakan login terlebih dahulu.",
        },
        401
      );
    }

    // Client menggunakan token peserta.
    // auth.uid() pada SQL akan membaca user ini.
    const supabase = createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return respond(
        {
          error: "Sesi login tidak valid.",
        },
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
        {
          error: "Format permintaan tidak valid.",
        },
        400
      );
    }

    const fullName =
      typeof body?.full_name === "string"
        ? body.full_name
            .trim()
            .replace(/\s+/g, " ")
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

    // Mode pengujian: tidak menulis database.
    if (!REGISTRATION_ENABLED) {
      return respond({
        success: true,
        dry_run: true,
        message:
          "Simulasi pendaftaran berhasil. Data belum disimpan.",
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

    // Fungsi SQL melakukan penyimpanan profil
    // dan pengajuan dalam satu transaksi.
    const { data, error } = await supabase.rpc(
      "submit_ojt_registration",
      {
        p_full_name: fullName,
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
            "Pendaftaran gagal diproses. Hubungi mentor jika masalah berlanjut.",
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

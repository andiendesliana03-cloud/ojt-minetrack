
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Jangan aktifkan sebelum proses pendaftaran
// dan keamanan database selesai diuji.
const REGISTRATION_ENABLED = false;

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

    // Verifikasi token langsung ke Supabase Auth.
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

    // Email wajib sudah diverifikasi.
    if (!user.email_confirmed_at) {
      return respond(
        {
          error:
            "Silakan verifikasi email sebelum mengajukan pendaftaran.",
        },
        403
      );
    }

    const body = await request.json();
    const fullName =
      typeof body?.full_name === "string"
        ? body.full_name.trim().replace(/\s+/g, " ")
        : "";

    if (fullName.length < 3 || fullName.length > 120) {
      return respond(
        {
          error:
            "Nama lengkap harus 3 sampai 120 karakter.",
        },
        400
      );
    }

    const { data: existingProfile, error: profileError } =
      await admin
        .from("profiles")
        .select("id,role,full_name")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    // Jangan mengubah akun mentor.
    if (
      existingProfile &&
      existingProfile.role !== "participant" &&
      existingProfile.role !== "peserta"
    ) {
      return respond(
        {
          error:
            "Akun ini tidak dapat digunakan untuk pendaftaran peserta.",
        },
        403
      );
    }

    const {
      data: existingRegistration,
      error: registrationError,
    } = await admin
      .from("participant_registrations")
      .select("id,status,created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (registrationError) {
      throw registrationError;
    }

    if (existingRegistration) {
      return respond(
        {
          success: true,
          already_registered: true,
          status: existingRegistration.status,
          message:
            "Akun ini sudah memiliki pengajuan pendaftaran.",
        },
        200
      );
    }

    // Akun yang sudah memiliki program OJT
    // tidak boleh membuat pengajuan baru.
    const {
      data: existingPrograms,
      error: programError,
    } = await admin
      .from("ojt_programs")
      .select("id")
      .eq("participant_id", user.id)
      .limit(1);

    if (programError) {
      throw programError;
    }

    if ((existingPrograms || []).length > 0) {
      return respond(
        {
          error:
            "Akun ini sudah memiliki program OJT. Hubungi mentor.",
        },
        409
      );
    }

    // Mode simulasi:
    // Tidak ada perubahan database.
    if (!REGISTRATION_ENABLED) {
      return respond({
        success: true,
        dry_run: true,
        message:
          "Simulasi pengajuan berhasil. Profil dan pendaftaran belum disimpan.",
        preview: {
          user_id: user.id,
          full_name: fullName,
          email: user.email,
          department: "ER & SS",
          role: "participant",
          registration_status: "pending",
        },
      });
    }

    // Pendaftaran asli sengaja belum diaktifkan.
    // Penyimpanan profil dan pengajuan harus
    // dilakukan secara atomik melalui transaksi
    // database agar tidak terjadi data sebagian.
    return respond(
      {
        error:
          "Pendaftaran asli belum diaktifkan. Gunakan mode simulasi.",
      },
      503
    );
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

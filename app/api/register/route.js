
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * OJT MineTrack v2.0
 * OFFICIAL PARTICIPANT REGISTRATION
 *
 * Pendaftaran langsung tanpa SMTP.
 *
 * - Auth melalui Supabase signUp
 * - Tidak membutuhkan email verifikasi
 * - Role selalu participant
 * - Pengajuan selalu pending
 * - Tidak membuat program OJT otomatis
 * - Mentor tetap menyetujui pengajuan
 * - Tidak mengubah database
 * - Tidak mengubah kalender global 25 minggu
 *
 * Environment:
 * OJT_REGISTRATION_ENABLED
 * NEXT_PUBLIC_SUPABASE_URL
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   atau NEXT_PUBLIC_SUPABASE_ANON_KEY
 * SUPABASE_SECRET_KEY
 */

const REGISTRATION_ENABLED =
  process.env.OJT_REGISTRATION_ENABLED === "true";

const ALLOWED_SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "HO",
];

const ALLOWED_DEPARTMENTS = [
  "ER & SS",
  "Emergency Response Group",
  "Operation",
  "Maintenance",
  "HSE",
  "Engineering",
  "Human Resources",
  "Lainnya",
];

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function fail(message, status = 400) {
  return respond(
    {
      success: false,
      error: message,
    },
    status
  );
}

export async function POST(request) {
  if (!REGISTRATION_ENABLED) {
    return fail(
      "Pendaftaran peserta sementara dinonaktifkan.",
      503
    );
  }

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Format permintaan tidak valid.");
    }

    const fullName = String(
      body?.full_name ?? ""
    )
      .trim()
      .replace(/\s+/g, " ");

    const email = String(
      body?.email ?? ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body?.password ?? ""
    );

    const department = String(
      body?.department ?? ""
    ).trim();

    const site = String(
      body?.site ?? ""
    )
      .trim()
      .toUpperCase();

    // =====================================
    // VALIDASI
    // =====================================

    if (
      fullName.length < 3 ||
      fullName.length > 120
    ) {
      return fail(
        "Nama lengkap harus 3–120 karakter."
      );
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return fail("Alamat email tidak valid.");
    }

    if (
      password.length < 8 ||
      password.length > 128
    ) {
      return fail(
        "Password harus 8–128 karakter."
      );
    }

    if (!ALLOWED_DEPARTMENTS.includes(department)) {
      return fail("Departemen tidak valid.");
    }

    if (!ALLOWED_SITES.includes(site)) {
      return fail("Site tidak valid.");
    }

    // =====================================
    // KONFIGURASI SUPABASE
    // =====================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publicKey || !secretKey) {
      console.error(
        "OJT registration: missing Supabase configuration"
      );

      return fail(
        "Konfigurasi server belum lengkap.",
        500
      );
    }

    const signupClient = createClient(
      supabaseUrl,
      publicKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const admin = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    // =====================================
    // BUAT AKUN PESERTA
    // =====================================

    const {
      data: signup,
      error: signupError,
    } = await signupClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signupError) {
      const message = signupError.message || "";

      if (
        /already|registered|exists|duplicate/i.test(
          message
        )
      ) {
        return fail(
          "Email sudah terdaftar. Silakan login.",
          409
        );
      }

      if (
        signupError.status === 429 ||
        /rate limit/i.test(message)
      ) {
        return fail(
          "Terlalu banyak percobaan pendaftaran. Silakan coba kembali nanti.",
          429
        );
      }

      console.error(
        "OJT signup failed:",
        message
      );

      return fail(
        "Pendaftaran gagal diproses.",
        500
      );
    }

    const user = signup?.user;
    const userId = user?.id;

    if (!userId) {
      return fail(
        "Akun tidak berhasil dibuat.",
        500
      );
    }

    // Cegah pemrosesan respons user terobfusikasi.
    if (
      Array.isArray(user.identities) &&
      user.identities.length === 0
    ) {
      return fail(
        "Email sudah terdaftar. Silakan login.",
        409
      );
    }

    /*
     * Pendaftaran ini memerlukan Confirm Email OFF.
     * Jika masih ON, session biasanya null.
     *
     * Jangan hapus akun pada kondisi ini, karena
     * akun mungkin sedang menunggu konfirmasi.
     */
    if (!signup?.session) {
      return fail(
        "Konfirmasi email masih aktif di Supabase. Hubungi administrator untuk menyelesaikan konfigurasi.",
        503
      );
    }

    // =====================================
    // ROLLBACK AKUN BARU
    // =====================================

    async function rollbackAccount() {
      const { error } =
        await admin.auth.admin.deleteUser(userId);

      if (error) {
        console.error(
          "OJT rollback error:",
          error.message
        );
        return false;
      }

      return true;
    }

    // =====================================
    // PROFIL PESERTA
    // =====================================

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name: fullName,
          department,
          role: "participant",
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      console.error(
        "OJT profile error:",
        profileError.message
      );

      const rolledBack =
        await rollbackAccount();

      return fail(
        rolledBack
          ? "Gagal menyimpan profil. Silakan coba kembali."
          : "Pendaftaran belum selesai. Hubungi Administrator.",
        500
      );
    }

    // =====================================
    // PENGAJUAN PENDING
    // =====================================

    const { error: registrationError } = await admin
      .from("participant_registrations")
      .insert({
        user_id: userId,
        full_name: fullName,
        email,
        department,
        site,
        status: "pending",
      });

    if (registrationError) {
      console.error(
        "OJT registration insert error:",
        registrationError.message
      );

      const rolledBack =
        await rollbackAccount();

      return fail(
        rolledBack
          ? "Gagal menyimpan pengajuan. Silakan coba kembali."
          : "Pendaftaran belum selesai. Hubungi Administrator.",
        500
      );
    }

    // =====================================
    // PENDAFTARAN BERHASIL
    // =====================================

    return respond(
      {
        success: true,
        status: "pending",
        verification_sent: false,
        message:
          "Pendaftaran berhasil. Akun peserta sudah dibuat dan dapat digunakan untuk login. Pengajuan OJT menunggu persetujuan Mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "OJT registration server error:",
      error
    );

    return fail(
      "Terjadi kesalahan pada server pendaftaran.",
      500
    );
  }
}


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * OJT MineTrack v2.0
 * OFFICIAL PARTICIPANT REGISTRATION
 *
 * - Registrasi resmi peserta OJT
 * - Verifikasi email melalui Supabase Auth
 * - Role selalu participant
 * - Pengajuan selalu pending
 * - Persetujuan Mentor tetap berlaku
 * - Tidak membuat program aktif otomatis
 * - Tidak mengubah struktur database
 * - Tidak mengubah kalender global 25 minggu
 *
 * Required:
 * OJT_REGISTRATION_ENABLED
 * NEXT_PUBLIC_SUPABASE_URL
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   atau NEXT_PUBLIC_SUPABASE_ANON_KEY
 * SUPABASE_SECRET_KEY
 * NEXT_PUBLIC_SITE_URL
 */

const REGISTRATION_ENABLED =
  process.env.OJT_REGISTRATION_ENABLED === "true";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://ojt-minetrack.vercel.app"
).replace(/\/+$/, "");

const SITES = [
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

const DEPARTMENTS = [
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
  // Registration lock tetap dikendalikan server.
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

    const fullName = String(body?.full_name ?? "")
      .trim()
      .replace(/\s+/g, " ");

    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();

    const password = String(body?.password ?? "");

    const department = String(body?.department ?? "")
      .trim();

    const site = String(body?.site ?? "")
      .trim()
      .toUpperCase();

    // ============================================
    // VALIDASI FORMULIR
    // ============================================

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

    if (!DEPARTMENTS.includes(department)) {
      return fail("Departemen tidak valid.");
    }

    if (!SITES.includes(site)) {
      return fail("Site tidak valid.");
    }

    // ============================================
    // SUPABASE CONFIGURATION
    // ============================================

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !publicKey || !secretKey) {
      console.error(
        "Registration: Supabase environment incomplete."
      );

      return fail(
        "Konfigurasi pendaftaran belum lengkap.",
        503
      );
    }

    // Client pendaftaran: tidak memakai admin privileges.
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

    // Client admin hanya berjalan pada server.
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

    // ============================================
    // SIGN UP & EMAIL VERIFICATION
    // ============================================

    const { data: signup, error: signupError } =
      await signupClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${SITE_URL}/login`,
          data: {
            full_name: fullName,
          },
        },
      });

    if (signupError) {
      console.error(
        "Registration signup error:",
        signupError.message
      );

      if (
        /already|registered|exists/i.test(
          signupError.message || ""
        )
      ) {
        return fail(
          "Email sudah terdaftar. Silakan login atau gunakan pemulihan password.",
          409
        );
      }

      if (
        signupError.status === 429 ||
        /rate limit/i.test(signupError.message || "")
      ) {
        return fail(
          "Terlalu banyak percobaan. Silakan coba kembali nanti.",
          429
        );
      }

      return fail(
        "Pendaftaran belum berhasil. Periksa email atau hubungi administrator.",
        500
      );
    }

    const user = signup?.user;
    const userId = user?.id;

    if (!userId) {
      return fail(
        "Server belum mengonfirmasi pembuatan akun.",
        500
      );
    }

    /*
     * Supabase dapat mengembalikan identitas kosong
     * untuk respons terobfusikasi akun yang sudah ada.
     * Jangan menulis profil/pengajuan untuk respons itu.
     */
    if (
      Array.isArray(user.identities) &&
      user.identities.length === 0
    ) {
      return respond({
        success: true,
        status: "verification_required",
        verification_sent: false,
        message:
          "Jika alamat email dapat didaftarkan, instruksi verifikasi akan dikirim. Periksa kotak masuk email Anda.",
      });
    }

    /*
     * Untuk alur resmi, Confirm Email di Supabase
     * wajib aktif. Jika signUp langsung membuat
     * session, konfigurasi email confirmation
     * kemungkinan tidak sesuai untuk alur ini.
     */
    if (signup?.session) {
      console.error(
        "Registration stopped: email confirmation is not enforced."
      );

      // Hanya hapus akun baru yang dibuat oleh request ini.
      if (userId) {
        const { error: cleanupError } =
          await admin.auth.admin.deleteUser(userId);

        if (cleanupError) {
          console.error(
            "Registration cleanup failed:",
            cleanupError.message
          );
        }
      }

      return fail(
        "Verifikasi email belum diwajibkan di Supabase. Hubungi administrator.",
        503
      );
    }

    // ============================================
    // ROLLBACK AKUN BARU
    // ============================================

    async function rollbackAccount() {
      const { error } =
        await admin.auth.admin.deleteUser(userId);

      if (error) {
        console.error(
          "Registration rollback failed:",
          error.message
        );

        return false;
      }

      return true;
    }

    // ============================================
    // SIMPAN PROFIL PESERTA
    // ============================================

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
        "Registration profile error:",
        profileError.message
      );

      const rolledBack = await rollbackAccount();

      return fail(
        rolledBack
          ? "Gagal menyimpan profil. Silakan coba kembali."
          : "Pendaftaran belum selesai. Hubungi administrator.",
        500
      );
    }

    // ============================================
    // PENGAJUAN OJT — PENDING
    // ============================================

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
        "Registration insert error:",
        registrationError.message
      );

      const rolledBack = await rollbackAccount();

      return fail(
        rolledBack
          ? "Gagal menyimpan pengajuan. Silakan coba kembali."
          : "Pendaftaran belum selesai. Hubungi administrator.",
        500
      );
    }

    // ============================================
    // SUCCESS
    // ============================================

    return respond(
      {
        success: true,
        status: "pending",
        verification_sent: true,
        message:
          "Pendaftaran berhasil diproses. Periksa email dan klik tautan verifikasi sebelum login. Setelah verifikasi, pengajuan OJT tetap menunggu persetujuan Mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "Official registration error:",
      error
    );

    return fail(
      "Terjadi kesalahan pada server pendaftaran.",
      500
    );
  }
}

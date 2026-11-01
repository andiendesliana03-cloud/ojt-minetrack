
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * OJT MineTrack v2.0
 * Registration API
 *
 * Pengaturan:
 * OJT_REGISTRATION_ENABLED
 * OJT_TEST_AUTO_CONFIRM_EMAIL
 *
 * Khusus pengujian:
 * - Pendaftaran dibuka melalui environment Vercel.
 * - Email akun pengujian dapat dikonfirmasi oleh server.
 * - Role selalu participant.
 * - Pengajuan tetap pending.
 * - Tidak membuat program OJT aktif.
 * - Tidak mengubah struktur database.
 *
 * MATIKAN kembali kedua flag setelah pengujian.
 */

const REGISTRATION_ENABLED =
  process.env.OJT_REGISTRATION_ENABLED === "true";

const TEST_AUTO_CONFIRM_EMAIL =
  process.env.OJT_TEST_AUTO_CONFIRM_EMAIL === "true";

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

function jsonResponse(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse(
    {
      success: false,
      error: message,
    },
    status
  );
}

export async function POST(request) {
  if (!REGISTRATION_ENABLED) {
    return errorResponse(
      "Pendaftaran peserta sementara dinonaktifkan.",
      503
    );
  }

  /*
   * Implementasi ini menggunakan konfirmasi email
   * langsung khusus akun pengujian.
   *
   * Jangan digunakan sebagai alur pendaftaran
   * publik permanen.
   */
  if (!TEST_AUTO_CONFIRM_EMAIL) {
    return errorResponse(
      "Pendaftaran pengujian belum dikonfigurasi. Hubungi administrator.",
      503
    );
  }

  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "Format permintaan tidak valid."
      );
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

    // VALIDASI NAMA
    if (
      fullName.length < 3 ||
      fullName.length > 120
    ) {
      return errorResponse(
        "Nama lengkap harus 3–120 karakter."
      );
    }

    // VALIDASI EMAIL
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return errorResponse(
        "Alamat email tidak valid."
      );
    }

    // VALIDASI PASSWORD
    if (
      password.length < 8 ||
      password.length > 128
    ) {
      return errorResponse(
        "Password harus 8–128 karakter."
      );
    }

    // VALIDASI DEPARTEMEN
    if (!ALLOWED_DEPARTMENTS.includes(department)) {
      return errorResponse(
        "Departemen tidak valid."
      );
    }

    // VALIDASI SITE
    if (!ALLOWED_SITES.includes(site)) {
      return errorResponse(
        "Site tidak valid."
      );
    }

    // SUPABASE SERVER CONFIGURATION
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !secretKey) {
      console.error(
        "Supabase server configuration incomplete."
      );

      return errorResponse(
        "Konfigurasi server belum lengkap.",
        500
      );
    }

    const admin = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    /*
     * BUAT AKUN PESERTA
     *
     * email_confirm: true hanya digunakan karena
     * mode pengujian secara eksplisit diaktifkan.
     *
     * Role tidak diambil dari input pengguna.
     */

    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      if (
        /already|registered|exists|duplicate/i.test(
          createError.message || ""
        )
      ) {
        return errorResponse(
          "Email sudah terdaftar. Silakan login.",
          409
        );
      }

      console.error(
        "Create participant failed:",
        createError
      );

      return errorResponse(
        "Pendaftaran gagal diproses.",
        500
      );
    }

    const userId = created?.user?.id;

    if (!userId) {
      return errorResponse(
        "Akun tidak berhasil dibuat.",
        500
      );
    }

    /*
     * ROLLBACK AKUN
     * Bila penyimpanan profil/pengajuan gagal.
     */
    async function rollbackAccount() {
      const { error } =
        await admin.auth.admin.deleteUser(userId);

      if (error) {
        console.error(
          "Rollback failed:",
          error
        );
        return false;
      }

      return true;
    }

    /*
     * PROFIL PESERTA
     * Role selalu participant.
     */
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
        "Profile creation failed:",
        profileError
      );

      const rolledBack = await rollbackAccount();

      return errorResponse(
        rolledBack
          ? "Gagal menyimpan profil peserta."
          : "Pendaftaran belum selesai. Hubungi administrator.",
        500
      );
    }

    /*
     * PENGAJUAN PENDAFTARAN
     * Tetap melalui alur persetujuan Mentor.
     */
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
        "Registration insert failed:",
        registrationError
      );

      const rolledBack = await rollbackAccount();

      return errorResponse(
        rolledBack
          ? "Gagal menyimpan pengajuan peserta."
          : "Pendaftaran belum selesai. Hubungi administrator.",
        500
      );
    }

    /*
     * SUKSES
     *
     * Akun bisa digunakan untuk autentikasi.
     * Persetujuan Mentor tetap wajib.
     * Tidak ada program OJT yang otomatis aktif.
     */
    return jsonResponse(
      {
        success: true,
        status: "pending",
        verification_sent: false,
        message:
          "Akun pengujian berhasil dibuat. Silakan login. Pengajuan OJT tetap menunggu persetujuan Mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "OJT registration error:",
      error
    );

    return errorResponse(
      "Terjadi kesalahan pada server.",
      500
    );
  }
}

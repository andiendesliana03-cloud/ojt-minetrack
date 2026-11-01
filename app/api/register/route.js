
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });

export async function POST(request) {
  try {
    // 1. Pengunci pendaftaran resmi
    const registrationEnabled =
      process.env.OJT_REGISTRATION_ENABLED === "true";

    if (!registrationEnabled) {
      return json(
        {
          success: false,
          message: "Pendaftaran peserta sementara dinonaktifkan.",
        },
        503
      );
    }

    // 2. Konfigurasi Supabase
    const supabaseUrl = (
      process.env.NEXT_PUBLIC_SUPABASE_URL || ""
    ).trim();

    const publicKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "";

    // Mendukung konfigurasi baru maupun yang sudah ada
    const serverKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "";

    if (!supabaseUrl || !publicKey || !serverKey) {
      console.error(
        "[REGISTER] Supabase environment configuration incomplete",
        {
          hasUrl: Boolean(supabaseUrl),
          hasPublicKey: Boolean(publicKey),
          hasServerKey: Boolean(serverKey),
        }
      );

      return json(
        {
          success: false,
          message: "Konfigurasi server belum lengkap.",
        },
        503
      );
    }

    // 3. Membaca formulir pendaftaran
    let body;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          success: false,
          message: "Format data pendaftaran tidak valid.",
        },
        400
      );
    }

    const full_name = String(body?.full_name || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(body?.password || "");
    const department = String(body?.department || "").trim();
    const site = String(body?.site || "").trim();

    if (
      !full_name ||
      !email ||
      !password ||
      !department ||
      !site
    ) {
      return json(
        {
          success: false,
          message: "Semua kolom pendaftaran wajib diisi.",
        },
        400
      );
    }

    if (
      full_name.length > 150 ||
      department.length > 150 ||
      site.length > 150 ||
      email.length > 254
    ) {
      return json(
        {
          success: false,
          message: "Data pendaftaran terlalu panjang.",
        },
        400
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return json(
        {
          success: false,
          message: "Format email tidak valid.",
        },
        400
      );
    }

    if (password.length < 6) {
      return json(
        {
          success: false,
          message: "Password minimal 6 karakter.",
        },
        400
      );
    }

    // 4. Client untuk pendaftaran peserta
    const signupClient = createClient(
      supabaseUrl,
      publicKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    // 5. Client administratif, hanya berjalan di server
    const adminClient = createClient(
      supabaseUrl,
      serverKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    );

    // 6. Membuat akun peserta
    const {
      data: signupData,
      error: signupError,
    } = await signupClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          department,
          site,
        },
      },
    });

    if (signupError) {
      console.error(
        "[REGISTER] Auth signup failed:",
        signupError.message
      );

      const duplicate =
        /already registered|already exists|already been registered/i.test(
          signupError.message
        );

      return json(
        {
          success: false,
          message: duplicate
            ? "Email sudah terdaftar. Silakan login."
            : signupError.message,
        },
        duplicate ? 409 : 400
      );
    }

    const user = signupData?.user;

    if (!user?.id) {
      return json(
        {
          success: false,
          message: "Akun peserta gagal dibuat.",
        },
        500
      );
    }

    // Menghindari akun duplikat yang disamarkan Supabase
    if (
      Array.isArray(user.identities) &&
      user.identities.length === 0
    ) {
      return json(
        {
          success: false,
          message: "Email sudah terdaftar. Silakan login.",
        },
        409
      );
    }

    // Alur aplikasi menggunakan pendaftaran tanpa konfirmasi email
    if (!signupData?.session) {
      return json(
        {
          success: false,
          message:
            "Akun belum dapat langsung diaktifkan. Periksa pengaturan Confirm Email di Supabase.",
        },
        503
      );
    }

    const userId = user.id;

    // 7. Membuat profil peserta
    const {
      error: profileError,
    } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: userId,
          full_name,
          department,
          role: "participant",
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      console.error(
        "[REGISTER] Profile failed:",
        profileError.message
      );

      await rollbackAccount(adminClient, userId);

      return json(
        {
          success: false,
          message: "Gagal menyimpan profil peserta.",
        },
        500
      );
    }

    // 8. Pengajuan peserta menunggu persetujuan Mentor
    const {
      error: registrationError,
    } = await adminClient
      .from("participant_registrations")
      .insert({
        user_id: userId,
        full_name,
        email,
        department,
        site,
        status: "pending",
      });

    if (registrationError) {
      console.error(
        "[REGISTER] Registration failed:",
        registrationError.message
      );

      await rollbackAccount(adminClient, userId);

      return json(
        {
          success: false,
          message: "Gagal menyimpan pengajuan peserta.",
        },
        500
      );
    }

    // 9. Pendaftaran berhasil
    return json(
      {
        success: true,
        message:
          "Pendaftaran berhasil. Silakan login dan tunggu persetujuan Mentor.",
        user_id: userId,
        status: "pending",
        role: "participant",
      },
      201
    );
  } catch (error) {
    console.error(
      "[REGISTER] Unexpected error:",
      error?.message || error
    );

    return json(
      {
        success: false,
        message:
          "Terjadi gangguan saat pendaftaran. Silakan coba kembali.",
      },
      500
    );
  }
}

// Menghapus akun yang baru dibuat jika penyimpanan data gagal
async function rollbackAccount(adminClient, userId) {
  try {
    const { error } =
      await adminClient.auth.admin.deleteUser(userId);

    if (error) {
      console.error(
        "[REGISTER] Rollback failed:",
        error.message
      );
    }
  } catch (error) {
    console.error(
      "[REGISTER] Rollback exception:",
      error?.message || error
    );
  }
}


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pendaftaran wajib tetap nonaktif selama pengujian.
const REGISTRATION_ENABLED = false;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://ojt-minetrack.vercel.app";

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

function errorResponse(message, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function POST(request) {
  // Pengunci server: tidak membuat akun atau menulis database.
  if (!REGISTRATION_ENABLED) {
    return errorResponse(
      "Pendaftaran peserta sementara dinonaktifkan sampai seluruh pengujian selesai.",
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
      body?.full_name || ""
    )
      .trim()
      .replace(/\s+/g, " ");

    const email = String(
      body?.email || ""
    )
      .trim()
      .toLowerCase();

    const department = String(
      body?.department || "ER & SS"
    ).trim();

    const password = String(
      body?.password || ""
    );

    const site =
      typeof body?.site === "string"
        ? body.site.trim().toUpperCase()
        : "";

    if (
      fullName.length < 3 ||
      fullName.length > 120
    ) {
      return errorResponse(
        "Nama lengkap harus 3–120 karakter."
      );
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return errorResponse(
        "Alamat email tidak valid."
      );
    }

    if (
      !department ||
      department.length > 100
    ) {
      return errorResponse(
        "Departemen tidak valid."
      );
    }

    if (
      password.length < 8 ||
      password.length > 128
    ) {
      return errorResponse(
        "Password harus 8–128 karakter."
      );
    }

    if (!ALLOWED_SITES.includes(site)) {
      return errorResponse(
        "Site wajib dipilih dari daftar Site yang tersedia."
      );
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!url || !secretKey) {
      console.error(
        "Konfigurasi Supabase server belum lengkap."
      );

      return errorResponse(
        "Konfigurasi Supabase belum lengkap.",
        500
      );
    }

    const admin = createClient(
      url,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // Buat akun baru sebagai belum terverifikasi.
    // Role tidak pernah diambil dari input pengguna.
    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
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
        "Pendaftaran gagal. Silakan coba kembali.",
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

    async function rollbackAccount() {
      const { error } =
        await admin.auth.admin.deleteUser(userId);

      if (error) {
        console.error(
          "Rollback participant failed:",
          error
        );

        return false;
      }

      return true;
    }

    // Simpan profil dengan role peserta.
    const {
      error: profileError,
    } = await admin
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
        "Participant profile failed:",
        profileError
      );

      const rolledBack =
        await rollbackAccount();

      return errorResponse(
        rolledBack
          ? "Gagal menyimpan profil. Silakan coba kembali."
          : "Pendaftaran belum selesai. Hubungi administrator.",
        500
      );
    }

    // Simpan Site agar bisa diteruskan ke persetujuan Mentor.
    const {
      error: registrationError,
    } = await admin
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

      const rolledBack =
        await rollbackAccount();

      return errorResponse(
        rolledBack
          ? "Gagal menyimpan pendaftaran. Silakan coba kembali."
          : "Pendaftaran belum selesai. Hubungi administrator.",
        500
      );
    }

    // Membuat tautan tidak sama dengan mengirim email.
    const {
      error: linkError,
    } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password,
      options: {
        redirectTo: `${SITE_URL}/login`,
      },
    });

    if (linkError) {
      console.error(
        "Verification link failed:",
        linkError
      );

      return NextResponse.json(
        {
          success: true,
          verification_sent: false,
          message:
            "Pendaftaran tersimpan dan menunggu persetujuan Mentor, tetapi tautan verifikasi belum berhasil dibuat. Hubungi administrator.",
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        verification_sent: false,
        message:
          "Pendaftaran tersimpan dengan status Menunggu Persetujuan Mentor. Pengiriman email verifikasi masih perlu dikonfigurasi.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Self-registration error:",
      error
    );

    return errorResponse(
      "Terjadi kesalahan server.",
      500
    );
  }
}

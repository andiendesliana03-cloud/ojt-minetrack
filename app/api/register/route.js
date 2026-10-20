
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://ojt-minetrack.vercel.app";

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
    ).trim();

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

    if (password.length < 8) {
      return errorResponse(
        "Password minimal 8 karakter."
      );
    }

    if (password.length > 128) {
      return errorResponse(
        "Password terlalu panjang."
      );
    }

    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publicKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!url || !publicKey || !secretKey) {
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

    // Membuat akun dengan email belum terkonfirmasi.
    // Hak akses peserta tidak diambil dari input pengguna.
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

    // Jika penyimpanan gagal, hapus akun
    // yang baru dibuat agar tidak tertinggal
    // sebagai akun tanpa pendaftaran.
    async function rollbackAccount() {
      const { error } =
        await admin.auth.admin.deleteUser(
          userId
        );

      if (error) {
        console.error(
          "Rollback participant failed:",
          error
        );

        return false;
      }

      return true;
    }

    // Profil peserta.
    // Tidak pernah menerima role dari pengguna.
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
          : "Pendaftaran belum selesai. Hubungi administrator sebelum mencoba lagi.",
        500
      );
    }

    // Simpan permohonan dengan status pending.
    // Peserta tidak menentukan site dan
    // periode OJT sendiri.
    const {
      error: registrationError,
    } = await admin
      .from("participant_registrations")
      .insert({
        user_id: userId,
        full_name: fullName,
        email,
        department,
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
          : "Pendaftaran belum selesai. Hubungi administrator sebelum mencoba lagi.",
        500
      );
    }

    // Kirim email verifikasi menggunakan
    // Supabase Auth.
    const {
      data: linkData,
      error: linkError,
    } =
      await admin.auth.admin.generateLink({
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

      return NextResponse.json({
        success: true,
        verification_sent: false,
        message:
          "Akun berhasil dibuat dan menunggu persetujuan mentor, tetapi email verifikasi belum terkirim. Hubungi administrator.",
      });
    }

    // generateLink membuat tautan,
    // tetapi tidak otomatis mengirim email.
    // Karena SMTP khusus belum disiapkan,
    // jangan menampilkan klaim bahwa
    // email sudah dikirim.
    return NextResponse.json({
      success: true,
      verification_sent: false,
      message:
        "Pendaftaran tersimpan dengan status Menunggu Persetujuan Mentor. Pengiriman email verifikasi masih perlu dikonfigurasi.",
    });
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


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PENGAMAN UTAMA
// false = hanya simulasi
// true  = pendaftaran asli diizinkan
//
// Jangan ubah menjadi true sebelum
// seluruh pengujian selesai.
const REGISTRATION_ENABLED = false;

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

function jsonError(message, status = 400) {
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

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function POST(request) {
  try {
    // 1. PENGAMAN SERVER
    // Tolak seluruh pendaftaran asli
    // sebelum menjalankan operasi apa pun.
    //
    // Simulasi tetap diperbolehkan.
    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Format permintaan tidak valid."
      );
    }

    const dryRun = body?.dry_run === true;

    if (!dryRun && !REGISTRATION_ENABLED) {
      return jsonError(
        "Pendaftaran asli sedang dinonaktifkan. Gunakan mode simulasi.",
        403
      );
    }

    // 2. Konfigurasi Supabase.
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const publicKey =
      process.env
        .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const secretKey =
      process.env.SUPABASE_SECRET_KEY;

    if (!url || !publicKey || !secretKey) {
      return jsonError(
        "Konfigurasi Supabase belum lengkap.",
        500
      );
    }

    const authClient = createClient(
      url,
      publicKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

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

    // 3. Verifikasi token login.
    const authHeader =
      request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonError(
        "Silakan login terlebih dahulu.",
        401
      );
    }

    const token =
      authHeader.slice(7).trim();

    const {
      data: authData,
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !authData?.user) {
      return jsonError(
        "Sesi login tidak valid.",
        401
      );
    }

    // 4. Pastikan pengguna adalah mentor.
    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", authData.user.id)
      .single();

    if (
      mentorError ||
      mentor?.role !== "mentor"
    ) {
      return jsonError(
        "Akses hanya untuk mentor.",
        403
      );
    }

    // 5. Validasi data peserta.
    const fullName = String(
      body.full_name || ""
    ).trim();

    const email = String(
      body.email || ""
    ).trim().toLowerCase();

    const department = String(
      body.department || "ER & SS"
    ).trim();

    const site = String(
      body.site || ""
    ).trim().toUpperCase();

    const startDate = String(
      body.start_date || ""
    ).trim();

    const endDate = String(
      body.end_date || ""
    ).trim();

    if (fullName.length < 3) {
      return jsonError(
        "Nama peserta minimal 3 karakter."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      return jsonError(
        "Format email peserta tidak valid."
      );
    }

    if (!department) {
      return jsonError(
        "Departemen wajib diisi."
      );
    }

    if (!ALLOWED_SITES.includes(site)) {
      return jsonError(
        "Site OJT tidak valid."
      );
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate)
    ) {
      return jsonError(
        "Tanggal mulai atau selesai tidak valid."
      );
    }

    if (endDate < startDate) {
      return jsonError(
        "Tanggal selesai tidak boleh lebih awal dari tanggal mulai."
      );
    }

    // 6. MODE SIMULASI
    // Tidak mengirim email.
    // Tidak membuat akun.
    // Tidak menyimpan data.
    if (dryRun) {
      return NextResponse.json(
        {
          success: true,
          dry_run: true,
          message:
            "Simulasi berhasil. Validasi data dan akses mentor berhasil diperiksa.",
          preview: {
            full_name: fullName,
            email,
            department,
            site,
            start_date: startDate,
            end_date: endDate,
            status: "active",
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    // 7. PENGAMAN TAMBAHAN
    // Blokir pendaftaran jika belum aktif.
    if (!REGISTRATION_ENABLED) {
      return jsonError(
        "Pendaftaran asli belum diaktifkan.",
        403
      );
    }

    // 8. Periksa email yang sudah terdaftar.
    let page = 1;

    while (true) {
      const {
        data: usersData,
        error: usersError,
      } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (usersError) {
        console.error(
          "List users failed:",
          usersError
        );

        return jsonError(
          "Gagal memeriksa email peserta.",
          500
        );
      }

      const users =
        usersData?.users || [];

      const existingUser = users.find(
        (user) =>
          user.email?.toLowerCase() === email
      );

      if (existingUser) {
        return jsonError(
          "Email peserta sudah terdaftar.",
          409
        );
      }

      if (users.length < 1000) {
        break;
      }

      page += 1;
    }

    // 9. Buat akun dan kirim undangan.
    const {
      data: invited,
      error: inviteError,
    } =
      await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            full_name: fullName,
          },
        }
      );

    if (inviteError) {
      console.error(
        "Invitation failed:",
        inviteError
      );

      return jsonError(
        "Gagal membuat akun peserta.",
        500
      );
    }

    const participantId =
      invited?.user?.id;

    if (!participantId) {
      return jsonError(
        "ID peserta tidak ditemukan setelah pembuatan akun.",
        500
      );
    }

    // 10. Simpan profil.
    // Site tidak disimpan di profiles.
    const {
      error: profileError,
    } = await admin
      .from("profiles")
      .upsert(
        {
          id: participantId,
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
        "Profile failed:",
        profileError
      );

      return jsonError(
        "Akun dibuat, tetapi profil gagal disimpan. Hubungi administrator sebelum mencoba lagi.",
        500
      );
    }

    // 11. Pastikan tidak ada program aktif.
    const {
      data: existingPrograms,
      error: checkError,
    } = await admin
      .from("ojt_programs")
      .select("id")
      .eq(
        "participant_id",
        participantId
      )
      .eq("status", "active")
      .limit(1);

    if (checkError) {
      console.error(
        "Program check failed:",
        checkError
      );

      return jsonError(
        "Gagal memeriksa program OJT. Hubungi administrator.",
        500
      );
    }

    if (existingPrograms?.length) {
      return jsonError(
        "Peserta sudah memiliki program OJT aktif.",
        409
      );
    }

    // 12. Buat program OJT.
    // Site disimpan di ojt_programs.
    const {
      data: program,
      error: programError,
    } = await admin
      .from("ojt_programs")
      .insert({
        participant_id: participantId,
        mentor_id: mentor.id,
        start_date: startDate,
        end_date: endDate,
        status: "active",
        site,
      })
      .select("id")
      .single();

    if (programError) {
      console.error(
        "Program creation failed:",
        programError
      );

      return jsonError(
        "Akun dibuat, tetapi program OJT gagal disimpan. Hubungi administrator sebelum mencoba lagi.",
        500
      );
    }

    // 13. Pendaftaran berhasil.
    return NextResponse.json(
      {
        success: true,
        dry_run: false,
        message:
          "Peserta dan program OJT berhasil dibuat.",
        participant_id: participantId,
        program_id: program.id,
        site,
        start_date: startDate,
        end_date: endDate,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Registration API error:",
      error
    );

    return jsonError(
      "Terjadi kesalahan server. Periksa status pendaftaran sebelum mencoba kembali.",
      500
    );
  }
}

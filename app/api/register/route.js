
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "HO",
  "PMO",
  "TSP",
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
      message,
      error: message,
    },
    status
  );
}

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function getClients() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).trim();

  const publicKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  const serverKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();

  if (!url || !publicKey || !serverKey) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  const authOptions = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  };

  return {
    signup: createClient(
      url,
      publicKey,
      authOptions
    ),
    admin: createClient(
      url,
      serverKey,
      authOptions
    ),
  };
}

async function rollbackUser(admin, userId) {
  if (!userId) return;

  try {
    const { error } =
      await admin.auth.admin.deleteUser(userId);

    if (error) {
      console.error(
        "[REGISTER] Rollback gagal:",
        error.message
      );
    }
  } catch (error) {
    console.error(
      "[REGISTER] Rollback exception:",
      error
    );
  }
}

export async function POST(request) {
  let createdUserId = null;
  let admin = null;
  let registrationSaved = false;

  try {
    // ==========================================
    // 1. FEATURE FLAG
    // ==========================================

    if (
      process.env.OJT_REGISTRATION_ENABLED !== "true"
    ) {
      return fail(
        "Pendaftaran peserta sementara dinonaktifkan.",
        503
      );
    }

    // ==========================================
    // 2. BACA FORMULIR
    // ==========================================

    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Format pendaftaran tidak valid.");
    }

    const fullName = String(
      body?.full_name || ""
    ).trim();

    const email = String(
      body?.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      body?.password || ""
    );

    const department = String(
      body?.department || ""
    ).trim();

    const site = String(
      body?.site || ""
    )
      .trim()
      .toUpperCase();

    // Formulir lama belum mengirim tanggal.
    // Jangan menganggap kalender global OJT
    // sebagai periode individual peserta.
    const startDate = String(
      body?.start_date || ""
    ).trim();

    const endDate = String(
      body?.end_date || ""
    ).trim();

    // ==========================================
    // 3. VALIDASI
    // ==========================================

    if (
      !fullName ||
      !email ||
      !password ||
      !department ||
      !site
    ) {
      return fail(
        "Semua data wajib pendaftaran harus diisi."
      );
    }

    if (
      fullName.length < 3 ||
      fullName.length > 150
    ) {
      return fail(
        "Nama lengkap harus 3–150 karakter."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return fail("Format email tidak valid.");
    }

    if (password.length < 6) {
      return fail(
        "Password minimal 6 karakter."
      );
    }

    if (department.length > 150) {
      return fail(
        "Nama departemen terlalu panjang."
      );
    }

    if (!VALID_SITES.includes(site)) {
      return fail("Site OJT tidak valid.");
    }

    const hasStartDate = startDate !== "";
    const hasEndDate = endDate !== "";

    if (hasStartDate !== hasEndDate) {
      return fail(
        "Tanggal mulai dan selesai harus diisi bersamaan."
      );
    }

    const hasIndividualPeriod =
      hasStartDate && hasEndDate;

    if (hasIndividualPeriod) {
      if (
        !isValidDate(startDate) ||
        !isValidDate(endDate)
      ) {
        return fail(
          "Format periode OJT tidak valid."
        );
      }

      if (endDate < startDate) {
        return fail(
          "Tanggal selesai tidak boleh lebih awal dari tanggal mulai."
        );
      }
    }

    // ==========================================
    // 4. SIAPKAN SUPABASE
    // ==========================================

    const clients = getClients();

    const signup = clients.signup;
    admin = clients.admin;

    // ==========================================
    // 5. BUAT AKUN AUTH
    // ==========================================

    const {
      data: signupData,
      error: signupError,
    } = await signup.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          department,
          site,
        },
      },
    });

    if (signupError) {
      const msg = String(
        signupError.message || ""
      ).toLowerCase();

      if (
        msg.includes("already registered") ||
        msg.includes("already exists") ||
        msg.includes("already been registered")
      ) {
        return fail(
          "Email sudah terdaftar. Silakan login.",
          409
        );
      }

      console.error(
        "[REGISTER] Auth:",
        signupError.message
      );

      return fail(
        "Pendaftaran akun gagal. Periksa data dan coba kembali.",
        400
      );
    }

    const user = signupData?.user;

    if (!user?.id) {
      return fail(
        "Akun peserta gagal dibuat.",
        500
      );
    }

    // Supabase dapat mengembalikan user tersamarkan
    // untuk email yang sudah terdaftar.
    if (
      Array.isArray(user.identities) &&
      user.identities.length === 0
    ) {
      return fail(
        "Email sudah terdaftar. Silakan login.",
        409
      );
    }

    createdUserId = user.id;

    // ==========================================
    // 6. SIMPAN PROFIL PESERTA
    // ==========================================

    const {
      error: profileError,
    } = await admin
      .from("profiles")
      .upsert(
        {
          id: createdUserId,
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
        "[REGISTER] Profile:",
        profileError.message
      );

      await rollbackUser(
        admin,
        createdUserId
      );

      return fail(
        "Profil peserta gagal disimpan.",
        500
      );
    }

    // ==========================================
    // 7. SIMPAN PERMINTAAN PENDAFTARAN
    // ==========================================

    let registrationId = null;
    let registrationSource = null;

    if (hasIndividualPeriod) {
      // Sistem baru: tanggal tersimpan langsung.
      const {
        data: registration,
        error: registrationError,
      } = await admin
        .from("ojt_registration_requests")
        .insert({
          participant_id: createdUserId,
          department,
          site,
          start_date: startDate,
          end_date: endDate,
          status: "pending",
        })
        .select("id")
        .single();

      if (registrationError) {
        console.error(
          "[REGISTER] New registration:",
          registrationError.message
        );

        await rollbackUser(
          admin,
          createdUserId
        );

        return fail(
          "Pengajuan OJT gagal disimpan.",
          500
        );
      }

      registrationId = registration.id;
      registrationSource = "new";
    } else {
      // Kompatibilitas formulir sebelumnya:
      // tanggal individual ditentukan Mentor
      // ketika menyetujui pengajuan legacy.
      const {
        data: registration,
        error: registrationError,
      } = await admin
        .from("participant_registrations")
        .insert({
          user_id: createdUserId,
          full_name: fullName,
          email,
          department,
          site,
          status: "pending",
        })
        .select("id")
        .single();

      if (registrationError) {
        console.error(
          "[REGISTER] Legacy registration:",
          registrationError.message
        );

        await rollbackUser(
          admin,
          createdUserId
        );

        return fail(
          "Data pendaftaran gagal disimpan.",
          500
        );
      }

      registrationId = registration.id;
      registrationSource = "legacy";
    }

    registrationSaved = true;

    // ==========================================
    // 8. RESPONS BERHASIL
    // ==========================================

    return respond(
      {
        success: true,
        message:
          "Pendaftaran berhasil. Silakan login dan tunggu persetujuan Mentor.",
        user_id: createdUserId,
        registration_id: registrationId,
        source: registrationSource,
        status: "pending",
        role: "participant",
        start_date:
          hasIndividualPeriod
            ? startDate
            : null,
        end_date:
          hasIndividualPeriod
            ? endDate
            : null,
      },
      201
    );
  } catch (error) {
    console.error(
      "[REGISTER] Server error:",
      error
    );

    if (
      admin &&
      createdUserId &&
      !registrationSaved
    ) {
      await rollbackUser(
        admin,
        createdUserId
      );
    }

    return fail(
      "Terjadi kesalahan server saat pendaftaran.",
      500
    );
  }
}

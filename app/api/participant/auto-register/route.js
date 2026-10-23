
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

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

export async function POST(request) {
  // Pendaftaran hanya boleh berjalan
  // jika mode umum sengaja diaktifkan.
  // Mode pengujian terbatas tidak membuka
  // pendaftaran akun anonim ini.
  if (
    process.env.OJT_SUBMISSION_ENABLED !== "true" ||
    process.env.OJT_TEST_MODE_ENABLED === "true"
  ) {
    return fail(
      "Pendaftaran OJT belum dibuka.",
      403
    );
  }

  let createdUserId = null;
  let admin = null;

  try {
    const body = await request.json();

    const fullName =
      typeof body.full_name === "string"
        ? body.full_name.trim().replace(/\s+/g, " ")
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const department = "ER & SS";

    const site =
      typeof body.site === "string"
        ? body.site.trim().toUpperCase()
        : "";

    const startDate = body.start_date;
    const endDate = body.end_date;

    // Validasi identitas.
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

    if (!SITES.includes(site)) {
      return fail("Site OJT tidak valid.");
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      endDate < startDate
    ) {
      return fail("Periode OJT tidak valid.");
    }

    admin = getAdminClient();

    // Pembuatan akun hanya di server.
    // Trigger auth.users akan membuat profil.
    //
    // email_confirm: true memungkinkan
    // login tanpa klik tautan email.
    // Ini BUKAN bukti kepemilikan email.
    const {
      data: authData,
      error: authError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        department,
        site,
        start_date: startDate,
        end_date: endDate,
      },
    });

    if (authError || !authData?.user?.id) {
      console.error(
        "OJT create user:",
        authError?.code || "unknown"
      );

      return fail(
        "Pendaftaran tidak dapat diproses. Periksa apakah email sudah terdaftar.",
        409
      );
    }

    createdUserId = authData.user.id;

    // Simpan satu pengajuan pending.
    // Peserta belum memperoleh program aktif.
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
        rejection_reason: null,
      })
      .select("id")
      .single();

    if (registrationError || !registration?.id) {
      console.error(
        "OJT insert registration:",
        registrationError?.code || "unknown"
      );

      // Upaya pemulihan bila akun berhasil
      // dibuat tetapi pengajuan gagal.
      const { error: deleteError } =
        await admin.auth.admin.deleteUser(
          createdUserId
        );

      if (deleteError) {
        console.error(
          "OJT account cleanup failed:",
          deleteError.code || "unknown"
        );
      }

      return fail(
        "Pengajuan belum dapat disimpan. Hubungi administrator sebelum mendaftar ulang.",
        500
      );
    }

    return respond(
      {
        success: true,
        status: "pending",
        message:
          "Pendaftaran berhasil. Pengajuan OJT menunggu keputusan mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "OJT auto registration:",
      error?.message || "unknown"
    );

    return fail(
      "Terjadi kesalahan saat pendaftaran.",
      500
    );
  }
}

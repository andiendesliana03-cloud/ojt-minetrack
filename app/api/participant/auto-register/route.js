
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

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
      "Konfigurasi Supabase belum lengkap."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Ambil alamat IP dari header yang
// disediakan oleh infrastruktur Vercel.
// Jangan menerima IP dari body formulir.
function getClientIp(request) {
  if (process.env.VERCEL !== "1") {
    return null;
  }

  const forwarded = request.headers.get(
    "x-vercel-forwarded-for"
  );

  if (!forwarded) {
    return null;
  }

  const ip = forwarded.split(",")[0].trim();

  return isIP(ip) ? ip : null;
}

// Alamat IP tidak disimpan mentah.
// Hanya hasil hash yang digunakan
// untuk menghitung percobaan.
function hashIp(ip) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "Kunci server belum tersedia."
    );
  }

  return createHmac("sha256", secret)
    .update(`ojt-signup-ip:${ip}`)
    .digest("hex");
}

export async function POST(request) {
  // Pendaftaran tidak boleh diproses
  // sampai administrator mengaktifkannya.
  if (
    process.env.OJT_SUBMISSION_ENABLED !== "true" ||
    process.env.OJT_TEST_MODE_ENABLED === "true"
  ) {
    return fail(
      "Pendaftaran OJT belum dibuka.",
      403
    );
  }

  try {
    const admin = getAdminClient();

    // Tolak permintaan tanpa IP terpercaya.
    // Ini sengaja dibuat fail-closed.
    const clientIp = getClientIp(request);

    if (!clientIp) {
      return fail(
        "Identitas koneksi tidak tersedia.",
        503
      );
    }

    // Maksimal 3 percobaan per 60 menit
    // untuk IP yang sama.
    const { data: allowed, error: limitError } =
      await admin.rpc(
        "check_ojt_signup_limit",
        {
          p_key_hash: hashIp(clientIp),
          p_max_attempts: 3,
          p_window_minutes: 60,
        }
      );

    // Bila pembatas database bermasalah,
    // pendaftaran harus tetap ditolak.
    if (limitError || allowed !== true) {
      if (limitError) {
        console.error(
          "OJT rate limit error:",
          limitError.code || "unknown"
        );

        return fail(
          "Sistem pendaftaran belum tersedia.",
          503
        );
      }

      return fail(
        "Terlalu banyak percobaan pendaftaran. Coba kembali setelah 60 menit.",
        429
      );
    }

    // Tolak body terlalu besar.
    const rawBody = await request.text();

    if (rawBody.length > 8192) {
      return fail(
        "Data pendaftaran terlalu besar.",
        413
      );
    }

    let body;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(
        "Format data pendaftaran tidak valid."
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return fail(
        "Data pendaftaran tidak valid."
      );
    }

    const fullName =
      typeof body.full_name === "string"
        ? body.full_name
            .trim()
            .replace(/\s+/g, " ")
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const site =
      typeof body.site === "string"
        ? body.site.trim().toUpperCase()
        : "";

    const startDate = body.start_date;
    const endDate = body.end_date;

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
      return fail(
        "Alamat email tidak valid."
      );
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
      return fail(
        "Site OJT tidak valid."
      );
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      endDate < startDate
    ) {
      return fail(
        "Periode OJT tidak valid."
      );
    }

    // Membuat akun Supabase.
    // Trigger database otomatis
    // membuat profil peserta.
    const {
      data: authData,
      error: authError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        department: "ER & SS",
        site,
        start_date: startDate,
        end_date: endDate,
      },
    });

    if (authError || !authData?.user?.id) {
      console.error(
        "OJT create user error:",
        authError?.code || "unknown"
      );

      return fail(
        "Akun tidak dapat dibuat. Periksa apakah email sudah terdaftar.",
        409
      );
    }

    const participantId = authData.user.id;

    // Pengajuan peserta otomatis
    // tercatat sebagai pending.
    const {
      data: registration,
      error: registrationError,
    } = await admin
      .from("ojt_registration_requests")
      .insert({
        participant_id: participantId,
        department: "ER & SS",
        site,
        start_date: startDate,
        end_date: endDate,
        status: "pending",
        rejection_reason: null,
      })
      .select("id")
      .single();

    if (
      registrationError ||
      !registration?.id
    ) {
      console.error(
        "OJT registration error:",
        registrationError?.code || "unknown"
      );

      // Jika pengajuan gagal disimpan,
      // coba hapus akun yang baru dibuat.
      // Akun lama tidak disentuh.
      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(
          participantId
        );

      if (cleanupError) {
        console.error(
          "OJT cleanup error:",
          cleanupError.code || "unknown"
        );
      }

      return fail(
        "Pengajuan tidak berhasil disimpan. Hubungi administrator sebelum mencoba lagi.",
        500
      );
    }

    return respond(
      {
        success: true,
        status: "pending",
        message:
          "Pendaftaran berhasil dan menunggu persetujuan mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "OJT signup unexpected error:",
      error?.message || "unknown"
    );

    return fail(
      "Terjadi gangguan pada sistem pendaftaran.",
      500
    );
  }
}

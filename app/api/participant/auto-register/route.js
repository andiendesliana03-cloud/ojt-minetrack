
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
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
    { success: false, error: message },
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

function getClientIp(request) {
  if (process.env.VERCEL !== "1") {
    return null;
  }

  const forwarded = request.headers.get(
    "x-vercel-forwarded-for"
  );

  if (!forwarded) return null;

  const ip = forwarded.split(",")[0].trim();

  return isIP(ip) ? ip : null;
}

function hashIp(ip) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Kunci server tidak tersedia.");
  }

  return createHmac("sha256", secret)
    .update(`ojt-signup-ip:${ip}`)
    .digest("hex");
}

// Periksa kode undangan secara aman.
// Jangan pernah mengirim kode rahasia
// dari server ke browser.
function validInviteCode(input) {
  const expected = process.env.OJT_INVITE_CODE;

  if (
    typeof expected !== "string" ||
    expected.length < 12 ||
    typeof input !== "string" ||
    input.length > 128
  ) {
    return false;
  }

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) return false;

  const expectedHash = createHmac(
    "sha256",
    secret
  )
    .update(expected)
    .digest();

  const receivedHash = createHmac(
    "sha256",
    secret
  )
    .update(input.trim())
    .digest();

  return timingSafeEqual(
    expectedHash,
    receivedHash
  );
}

export async function POST(request) {
  // Jangan buka pendaftaran jika fitur
  // masih nonaktif atau mode uji aktif.
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
    // Kode undangan harus sudah diatur.
    if (
      !process.env.OJT_INVITE_CODE ||
      process.env.OJT_INVITE_CODE.length < 12
    ) {
      return fail(
        "Konfigurasi pendaftaran belum lengkap.",
        503
      );
    }

    const admin = getAdminClient();

    // Pembatas percobaan berdasarkan IP.
    const clientIp = getClientIp(request);

    if (!clientIp) {
      return fail(
        "Identitas koneksi tidak tersedia.",
        503
      );
    }

    const {
      data: allowed,
      error: limitError,
    } = await admin.rpc(
      "check_ojt_signup_limit",
      {
        p_key_hash: hashIp(clientIp),
        p_max_attempts: 3,
        p_window_minutes: 60,
      }
    );

    if (limitError) {
      console.error(
        "OJT rate limit:",
        limitError.code || "unknown"
      );

      return fail(
        "Sistem pendaftaran belum tersedia.",
        503
      );
    }

    if (allowed !== true) {
      return fail(
        "Batas percobaan pendaftaran tercapai. Coba kembali setelah 60 menit.",
        429
      );
    }

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
        "Format pendaftaran tidak valid."
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

    // Validasi kode sebelum membuat akun.
    if (!validInviteCode(body.invite_code)) {
      return fail(
        "Kode pendaftaran ERG tidak sesuai.",
        403
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
      return fail("Site OJT tidak valid.");
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      endDate < startDate
    ) {
      return fail("Periode OJT tidak valid.");
    }

    // Buat akun melalui Supabase server.
    // Email ditandai confirmed secara
    // administratif, tanpa tautan email.
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
        "OJT create user:",
        authError?.code || "unknown"
      );

      return fail(
        "Akun tidak dapat dibuat. Periksa apakah email sudah terdaftar.",
        409
      );
    }

    const participantId = authData.user.id;

    // Trigger auth.users membuat profil.
    // API ini membuat pengajuan pending.
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
        "OJT registration:",
        registrationError?.code || "unknown"
      );

      // Pemulihan jika akun berhasil
      // dibuat tetapi pengajuan gagal.
      const { error: cleanupError } =
        await admin.auth.admin.deleteUser(
          participantId
        );

      if (cleanupError) {
        console.error(
          "OJT cleanup:",
          cleanupError.code || "unknown"
        );
      }

      return fail(
        "Pengajuan gagal disimpan. Hubungi administrator sebelum mencoba lagi.",
        500
      );
    }

    return respond(
      {
        success: true,
        status: "pending",
        message:
          "Pendaftaran berhasil. Menunggu persetujuan mentor.",
      },
      201
    );
  } catch (error) {
    console.error(
      "OJT signup error:",
      error?.message || "unknown"
    );

    return fail(
      "Terjadi gangguan sistem pendaftaran.",
      500
    );
  }
}

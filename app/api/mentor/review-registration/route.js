
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Pengaturan aktivasi terpusat dari Vercel.
// Hanya nilai "true" yang mengaktifkan transaksi nyata.
const GENERAL_APPROVAL_ENABLED =
  process.env.OJT_APPROVAL_ENABLED === "true";

const GENERAL_REJECTION_ENABLED =
  process.env.OJT_REJECTION_ENABLED === "true";

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

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
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
  try {
    let body;

    try {
      body = await request.json();
    } catch {
      return fail("Format JSON tidak valid.");
    }

    const requestId = body?.request_id;
    const decision = body?.decision;
    const dryRun = body?.dry_run === true;

    const reason =
      typeof body?.rejection_reason === "string"
        ? body.rejection_reason.trim()
        : "";

    // Pemeriksaan ID pengajuan.
    if (!isUuid(requestId)) {
      return fail("ID pengajuan tidak valid.");
    }

    // Keputusan hanya approved atau rejected.
    if (
      decision !== "approved" &&
      decision !== "rejected"
    ) {
      return fail("Keputusan mentor tidak valid.");
    }

    // Alasan penolakan wajib 5-1000 karakter.
    if (decision === "rejected") {
      if (
        reason.length < 5 ||
        reason.length > 1000
      ) {
        return fail(
          "Alasan penolakan harus 5–1000 karakter."
        );
      }
    }

    // Tolak transaksi nyata jika fitur
    // belum diaktifkan di Vercel.
    if (!dryRun) {
      if (
        decision === "approved" &&
        !GENERAL_APPROVAL_ENABLED
      ) {
        return fail(
          "Persetujuan nyata belum diaktifkan.",
          403
        );
      }

      if (
        decision === "rejected" &&
        !GENERAL_REJECTION_ENABLED
      ) {
        return fail(
          "Penolakan nyata belum diaktifkan.",
          403
        );
      }
    }

    // Token login mentor wajib tersedia.
    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return fail(
        "Silakan login sebagai mentor.",
        401
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return fail(
        "Token login tidak tersedia.",
        401
      );
    }

    const admin = getAdminClient();

    // Verifikasi token melalui Supabase Auth.
    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail(
        "Sesi login tidak valid.",
        401
      );
    }

    // ID mentor selalu berasal dari token,
    // bukan dikirim oleh pengguna.
    const mentorId = authData.user.id;

    // Pemeriksaan role mentor.
    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorError) throw mentorError;

    if (
      !mentor ||
      mentor.role !== "mentor"
    ) {
      return fail(
        "Hanya akun mentor yang boleh memproses pengajuan.",
        403
      );
    }

    // Semua mentor diperbolehkan memproses
    // seluruh pengajuan sistem baru.
    const {
      data: registration,
      error: registrationError,
    } = await admin
      .from("ojt_registration_requests")
      .select(`
        id,
        participant_id,
        department,
        site,
        start_date,
        end_date,
        status
      `)
      .eq("id", requestId)
      .maybeSingle();

    if (registrationError) {
      throw registrationError;
    }

    if (!registration) {
      return fail(
        "Pengajuan tidak ditemukan.",
        404
      );
    }

    // Pengajuan yang telah diproses
    // tidak boleh diproses ulang.
    if (registration.status !== "pending") {
      return fail(
        "Pengajuan sudah diproses.",
        409
      );
    }

    if (registration.participant_id === mentorId) {
      return fail(
        "Mentor tidak boleh memproses pengajuan sendiri.",
        403
      );
    }

    // Pemeriksaan profil peserta.
    const {
      data: participant,
      error: participantError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", registration.participant_id)
      .maybeSingle();

    if (participantError) {
      throw participantError;
    }

    if (
      !participant ||
      participant.role !== "participant"
    ) {
      return fail(
        "Profil peserta tidak valid.",
        409
      );
    }

    // TAMBAHAN LANGKAH 63A:
    // Pemeriksaan verifikasi email peserta.
    // Berlaku pada simulasi dan keputusan nyata.
    const {
      data: participantAuth,
      error: participantAuthError,
    } = await admin.auth.admin.getUserById(
      registration.participant_id
    );

    if (
      participantAuthError ||
      !participantAuth?.user ||
      !participantAuth.user.email_confirmed_at
    ) {
      return fail(
        "Email peserta belum terverifikasi atau akun tidak valid.",
        409
      );
    }

    // Pemeriksaan program OJT aktif
    // sebelum melakukan persetujuan.
    if (decision === "approved") {
      const {
        data: activePrograms,
        error: programError,
      } = await admin
        .from("ojt_programs")
        .select("id")
        .eq(
          "participant_id",
          registration.participant_id
        )
        .eq("status", "active")
        .limit(1);

      if (programError) {
        throw programError;
      }

      if (activePrograms?.length) {
        return fail(
          "Peserta sudah memiliki program OJT aktif.",
          409
        );
      }
    }

    // MODE SIMULASI:
    // Tidak mengubah database.
    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        database_changed: false,
        message:
          "Simulasi keputusan mentor berhasil. Database tidak berubah.",
        preview: {
          registration_id: requestId,
          participant_name:
            participant.full_name,
          mentor_name:
            mentor.full_name,
          decision,
          rejection_reason:
            decision === "rejected"
              ? reason
              : null,
          site: registration.site,
          start_date:
            registration.start_date,
          end_date:
            registration.end_date,
          participant_email_verified: true,
        },
      });
    }

    // KEPUTUSAN NYATA:
    // Menggunakan fungsi SQL 4 parameter.
    // Fungsi SQL melakukan validasi ulang
    // dan memproses keputusan secara transaksi.
    const {
      data: rpcResult,
      error: rpcError,
    } = await admin.rpc(
      "review_ojt_registration",
      {
        p_request_id: requestId,
        p_mentor_id: mentorId,
        p_decision: decision,
        p_rejection_reason:
          decision === "rejected"
            ? reason
            : null,
      }
    );

    if (rpcError) {
      console.error(
        "review_ojt_registration error:",
        rpcError.code
      );

      return fail(
        "Keputusan tidak dapat disimpan. Periksa status pengajuan sebelum mencoba kembali.",
        409
      );
    }

    const result = Array.isArray(rpcResult)
      ? rpcResult[0]
      : rpcResult;

    if (
      !result ||
      result.registration_status !== decision ||
      (decision === "approved" &&
        !result.program_id)
    ) {
      return fail(
        "Hasil keputusan belum dapat dipastikan. Periksa database sebelum mengulangi.",
        500
      );
    }

    return respond({
      success: true,
      dry_run: false,
      registration_id:
        result.registration_id,
      status:
        result.registration_status,
      program_id:
        result.program_id || null,
      message:
        decision === "approved"
          ? "Pengajuan disetujui. Program OJT aktif telah dibuat."
          : "Pengajuan ditolak dan alasan penolakan berhasil disimpan.",
    });
  } catch (error) {
    console.error(
      "Mentor review API error:",
      error
    );

    return fail(
      "Terjadi kesalahan server.",
      500
    );
  }
}

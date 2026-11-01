
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  canReviewOjt,
  getOjtAccessConfig,
} from "../../../../lib/ojt-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LEGACY_SITES = [
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

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isIsoDate(value) {
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

    // Default new untuk kompatibilitas request lama.
    const source = body?.source || "new";

    const reason =
      typeof body?.rejection_reason === "string"
        ? body.rejection_reason.trim()
        : "";

    // 1. VALIDASI PERMINTAAN

    if (!isUuid(requestId)) {
      return fail("ID pengajuan tidak valid.");
    }

    if (!["new", "legacy"].includes(source)) {
      return fail("Sumber pengajuan tidak valid.");
    }

    if (
      decision !== "approved" &&
      decision !== "rejected"
    ) {
      return fail("Keputusan mentor tidak valid.");
    }

    if (
      decision === "rejected" &&
      (reason.length < 5 || reason.length > 1000)
    ) {
      return fail(
        "Alasan penolakan harus 5–1000 karakter."
      );
    }

    // 2. VALIDASI TOKEN

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
      return fail("Token login tidak tersedia.", 401);
    }

    const admin = getAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !authData?.user) {
      return fail("Sesi login tidak valid.", 401);
    }

    const mentorId = authData.user.id;

    // 3. VALIDASI ROLE MENTOR

    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorError) throw mentorError;

    if (!mentor || mentor.role !== "mentor") {
      return fail(
        "Hanya akun mentor yang dapat memproses pengajuan.",
        403
      );
    }

    // 4. AMBIL DATA BERDASARKAN SUMBER

    let registration = null;
    let participantId = null;

    if (source === "new") {
      const {
        data,
        error,
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

      if (error) throw error;

      registration = data;
      participantId = data?.participant_id || null;
    }

    if (source === "legacy") {
      const {
        data,
        error,
      } = await admin
        .from("participant_registrations")
        .select(`
          id,
          user_id,
          department,
          site,
          status
        `)
        .eq("id", requestId)
        .maybeSingle();

      if (error) throw error;

      registration = data;
      participantId = data?.user_id || null;
    }

    if (!registration) {
      return fail("Pengajuan tidak ditemukan.", 404);
    }

    if (registration.status !== "pending") {
      return fail(
        "Pengajuan sudah diproses.",
        409
      );
    }

    if (!participantId || !isUuid(participantId)) {
      return fail(
        "Identitas peserta tidak valid.",
        409
      );
    }

    if (participantId === mentorId) {
      return fail(
        "Mentor tidak boleh memproses pengajuan sendiri.",
        403
      );
    }

    // 5. DATA PROGRAM UNTUK SISTEM LAMA

    let legacySite = null;
    let legacyStartDate = null;
    let legacyEndDate = null;

    if (source === "legacy" && decision === "approved") {
      legacySite =
        typeof body?.site === "string"
          ? body.site.trim()
          : registration.site;

      legacyStartDate = body?.start_date;
      legacyEndDate = body?.end_date;

      if (!LEGACY_SITES.includes(legacySite)) {
        return fail("Site OJT tidak valid.");
      }

      if (
        !isIsoDate(legacyStartDate) ||
        !isIsoDate(legacyEndDate) ||
        legacyEndDate < legacyStartDate
      ) {
        return fail(
          "Periode OJT tidak valid."
        );
      }
    }

    // 6. PENGAMAN TRANSAKSI SERVER

    if (
      !dryRun &&
      !canReviewOjt(
        mentorId,
        participantId,
        decision
      )
    ) {
      return fail(
        "Keputusan nyata belum diaktifkan atau akun ini tidak diizinkan.",
        403
      );
    }

    // 7. VALIDASI PROFIL PESERTA

    const {
      data: participant,
      error: participantError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", participantId)
      .maybeSingle();

    if (participantError) throw participantError;

    if (
      !participant ||
      participant.role !== "participant"
    ) {
      return fail(
        "Profil peserta tidak valid.",
        409
      );
    }

    // 8. VALIDASI EMAIL PESERTA

    const {
      data: participantAuth,
      error: participantAuthError,
    } = await admin.auth.admin.getUserById(
      participantId
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

    // 9. CEGAH PROGRAM GANDA

    if (decision === "approved") {
      let programQuery = admin
        .from("ojt_programs")
        .select("id")
        .eq("participant_id", participantId);

      if (source === "new") {
        // Sistem baru hanya mencegah
        // program yang masih aktif.
        programQuery = programQuery.eq(
          "status",
          "active"
        );
      }

      // Sistem lama mengikuti fungsi SQL:
      // tidak boleh ada program sebelumnya.
      const {
        data: existingPrograms,
        error: programError,
      } = await programQuery.limit(1);

      if (programError) throw programError;

      if (existingPrograms?.length) {
        return fail(
          source === "legacy"
            ? "Peserta sudah memiliki program OJT."
            : "Peserta sudah memiliki program OJT aktif.",
          409
        );
      }
    }

    // 10. SIMULASI TANPA DATABASE WRITE

    if (dryRun) {
      return respond({
        success: true,
        dry_run: true,
        database_changed: false,
        message:
          "Simulasi keputusan mentor berhasil. Database tidak berubah.",
        preview: {
          source,
          registration_id: requestId,
          participant_name: participant.full_name,
          mentor_name: mentor.full_name,
          decision,
          rejection_reason:
            decision === "rejected" ? reason : null,
          site:
            source === "legacy"
              ? legacySite || registration.site
              : registration.site,
          start_date:
            source === "legacy"
              ? legacyStartDate
              : registration.start_date,
          end_date:
            source === "legacy"
              ? legacyEndDate
              : registration.end_date,
          participant_email_verified: true,
        },
      });
    }

    // 11. VALIDASI ULANG SEBELUM TRANSAKSI

    if (
      !canReviewOjt(
        mentorId,
        participantId,
        decision
      )
    ) {
      return fail(
        "Transaksi tidak diizinkan oleh konfigurasi server.",
        403
      );
    }

    const accessConfig = getOjtAccessConfig();

    if (
      accessConfig.testModeEnabled &&
      (
        !accessConfig.testParticipantId ||
        !accessConfig.testMentorId
      )
    ) {
      return fail(
        "Akun pengujian belum dikonfigurasi.",
        403
      );
    }

    // 12. RPC SESUAI SUMBER DATA

    let rpcResult;
    let rpcError;

    if (source === "new") {
      const result = await admin.rpc(
        "review_ojt_registration",
        {
          p_request_id: requestId,
          p_mentor_id: mentorId,
          p_decision: decision,
          p_rejection_reason:
            decision === "rejected" ? reason : null,
        }
      );

      rpcResult = result.data;
      rpcError = result.error;
    }

    if (source === "legacy") {
      const result = await admin.rpc(
        "review_ojt_registration",
        {
          p_registration_id: requestId,
          p_mentor_id: mentorId,
          p_action:
            decision === "approved"
              ? "approve"
              : "reject",
          p_site: legacySite || registration.site || null,
          p_start_date: legacyStartDate || null,
          p_end_date: legacyEndDate || null,
          p_rejection_reason:
            decision === "rejected" ? reason : null,
        }
      );

      rpcResult = result.data;
      rpcError = result.error;
    }

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

    // 13. NORMALISASI HASIL RPC

    const result = Array.isArray(rpcResult)
      ? rpcResult[0]
      : rpcResult;

    const resultRegistrationId =
      result?.registration_id ??
      result?.result_registration_id;

    const resultStatus =
      result?.registration_status ??
      result?.result_status;

    const programId =
      result?.program_id ??
      result?.result_program_id ??
      null;

    if (
      !result ||
      resultStatus !== decision ||
      !resultRegistrationId ||
      (
        decision === "approved" &&
        !programId
      )
    ) {
      return fail(
        "Hasil keputusan belum dapat dipastikan. Periksa database sebelum mengulangi.",
        500
      );
    }

    // 14. RESPONS SUKSES

    return respond({
      success: true,
      dry_run: false,
      source,
      registration_id: resultRegistrationId,
      status: resultStatus,
      program_id: programId,
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

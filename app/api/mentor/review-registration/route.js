
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  canReviewOjt,
} from "../../../../lib/ojt-access";

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
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function getAdminClient() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).trim();

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    ""
  ).trim();

  if (!url || !key) {
    throw new Error(
      "Konfigurasi Supabase server belum lengkap."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function validUUID(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
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

function getResultRow(data) {
  return Array.isArray(data) ? data[0] : data;
}

export async function POST(request) {
  try {
    // ==========================================
    // 1. AUTENTIKASI
    // ==========================================

    const authorization =
      request.headers.get("authorization") || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!token) {
      return respond(
        {
          success: false,
          error: "Silakan login terlebih dahulu.",
        },
        401
      );
    }

    const admin = getAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    const user = authData?.user;

    if (authError || !user?.id) {
      return respond(
        {
          success: false,
          error: "Sesi login tidak valid.",
        },
        401
      );
    }

    // ==========================================
    // 2. VALIDASI MENTOR
    // ==========================================

    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (mentorError) {
      throw mentorError;
    }

    if (!mentor || mentor.role !== "mentor") {
      return respond(
        {
          success: false,
          error: "Akses hanya untuk Mentor.",
        },
        403
      );
    }

    // ==========================================
    // 3. VALIDASI PAYLOAD
    // ==========================================

    let body;

    try {
      body = await request.json();
    } catch {
      return respond(
        {
          success: false,
          error: "Format permintaan tidak valid.",
        },
        400
      );
    }

    const {
      request_id,
      source,
      decision,
      site,
      start_date,
      end_date,
      rejection_reason,
      dry_run,
    } = body || {};

    if (!validUUID(request_id)) {
      return respond(
        {
          success: false,
          error: "ID pengajuan tidak valid.",
        },
        400
      );
    }

    if (!["new", "legacy"].includes(source)) {
      return respond(
        {
          success: false,
          error: "Sumber pengajuan tidak valid.",
        },
        400
      );
    }

    if (!["approved", "rejected"].includes(decision)) {
      return respond(
        {
          success: false,
          error: "Keputusan tidak valid.",
        },
        400
      );
    }

    // API ini hanya menerima transaksi nyata.
    // Tidak ada simulasi keberhasilan.

    if (dry_run !== false) {
      return respond(
        {
          success: false,
          error: "Permintaan transaksi tidak valid.",
        },
        400
      );
    }

    // ==========================================
    // 4. AMBIL DATA PENDAFTARAN
    // ==========================================

    let registration;
    let registrationError;
    let participantId;

    if (source === "new") {
      const result = await admin
        .from("ojt_registration_requests")
        .select(`
          id,
          participant_id,
          site,
          start_date,
          end_date,
          status
        `)
        .eq("id", request_id)
        .maybeSingle();

      registration = result.data;
      registrationError = result.error;

      participantId =
        registration?.participant_id;

    } else {
      const result = await admin
        .from("participant_registrations")
        .select(`
          id,
          user_id,
          status
        `)
        .eq("id", request_id)
        .maybeSingle();

      registration = result.data;
      registrationError = result.error;

      participantId =
        registration?.user_id;
    }

    if (registrationError) {
      throw registrationError;
    }

    if (!registration) {
      return respond(
        {
          success: false,
          error: "Pendaftaran tidak ditemukan.",
        },
        404
      );
    }

    if (registration.status !== "pending") {
      return respond(
        {
          success: false,
          error:
            "Pendaftaran sudah diproses sebelumnya.",
        },
        409
      );
    }

    // ==========================================
    // 5. VALIDASI ROLE PESERTA
    // ==========================================

    const {
      data: participant,
      error: participantError,
    } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", participantId)
      .maybeSingle();

    if (participantError) {
      throw participantError;
    }

    if (
      !participant ||
      participant.role !== "participant"
    ) {
      return respond(
        {
          success: false,
          error:
            "Akun pendaftar bukan peserta OJT yang valid.",
        },
        403
      );
    }

    // ==========================================
    // 6. PEMERIKSAAN AKSES OJT
    // ==========================================

    // Mode normal:
    // Mengikuti environment variable.

    // Mode pengujian:
    // Mentor dan peserta harus sesuai whitelist.

    const allowed = canReviewOjt(
      mentor.id,
      participantId,
      decision
    );

    if (!allowed) {
      return respond(
        {
          success: false,
          error:
            "Akses keputusan tidak diizinkan. " +
            "Periksa konfigurasi akses OJT.",
        },
        403
      );
    }

    // ==========================================
    // 7. VALIDASI ALASAN PENOLAKAN
    // ==========================================

    let cleanReason = null;

    if (decision === "rejected") {
      cleanReason =
        typeof rejection_reason === "string"
          ? rejection_reason.trim()
          : "";

      if (
        cleanReason.length < 5 ||
        cleanReason.length > 1000
      ) {
        return respond(
          {
            success: false,
            error:
              "Alasan penolakan harus 5–1000 karakter.",
          },
          400
        );
      }
    }

    // ==========================================
    // 8. VALIDASI PERSETUJUAN
    // ==========================================

    if (
      decision === "approved" &&
      source === "new"
    ) {
      // Data site dan periode diambil dari
      // pengajuan baru, bukan dari frontend.

      if (!VALID_SITES.includes(registration.site)) {
        return respond(
          {
            success: false,
            error: "Site pengajuan tidak valid.",
          },
          400
        );
      }

      if (
        !validDate(registration.start_date) ||
        !validDate(registration.end_date) ||
        registration.end_date <
          registration.start_date
      ) {
        return respond(
          {
            success: false,
            error: "Periode pengajuan tidak valid.",
          },
          400
        );
      }
    }

    if (
      decision === "approved" &&
      source === "legacy"
    ) {
      if (!VALID_SITES.includes(site)) {
        return respond(
          {
            success: false,
            error: "Site OJT tidak valid.",
          },
          400
        );
      }

      if (
        !validDate(start_date) ||
        !validDate(end_date) ||
        end_date < start_date
      ) {
        return respond(
          {
            success: false,
            error: "Periode OJT tidak valid.",
          },
          400
        );
      }
    }

    // ==========================================
    // 9. EKSEKUSI TRANSAKSI RPC
    // ==========================================

    let rpcResult;

    if (source === "new") {
      // TABEL:
      // ojt_registration_requests
      //
      // RPC:
      // p_request_id
      // p_mentor_id
      // p_decision
      // p_rejection_reason

      rpcResult = await admin.rpc(
        "review_ojt_registration",
        {
          p_request_id: request_id,
          p_mentor_id: mentor.id,
          p_decision: decision,
          p_rejection_reason: cleanReason,
        }
      );

    } else {
      // TABEL:
      // participant_registrations
      //
      // RPC:
      // p_registration_id
      // p_mentor_id
      // p_action
      // p_site
      // p_start_date
      // p_end_date
      // p_rejection_reason

      rpcResult = await admin.rpc(
        "review_ojt_registration",
        {
          p_registration_id: request_id,
          p_mentor_id: mentor.id,

          p_action:
            decision === "approved"
              ? "approve"
              : "reject",

          p_site:
            decision === "approved"
              ? site
              : null,

          p_start_date:
            decision === "approved"
              ? start_date
              : null,

          p_end_date:
            decision === "approved"
              ? end_date
              : null,

          p_rejection_reason: cleanReason,
        }
      );
    }

    const { data, error: rpcError } = rpcResult;

    if (rpcError) {
      console.error(
        "[MENTOR REVIEW RPC]",
        {
          source,
          request_id,
          decision,
          message: rpcError.message,
        }
      );

      return respond(
        {
          success: false,
          error:
            rpcError.message ||
            "Keputusan gagal diproses.",
        },
        409
      );
    }

    // ==========================================
    // 10. VALIDASI HASIL TRANSAKSI
    // ==========================================

    const result = getResultRow(data);

    const resultStatus =
      source === "new"
        ? result?.registration_status
        : result?.result_status;

    const resultProgramId =
      source === "new"
        ? result?.program_id
        : result?.result_program_id;

    const resultRegistrationId =
      source === "new"
        ? result?.registration_id
        : result?.result_registration_id;

    if (
      !result ||
      resultStatus !== decision ||
      !resultRegistrationId ||
      (
        decision === "approved" &&
        !resultProgramId
      )
    ) {
      console.error(
        "[MENTOR REVIEW] Invalid RPC result:",
        result
      );

      return respond(
        {
          success: false,
          error:
            "Hasil transaksi belum dapat dipastikan. " +
            "Periksa status pendaftaran sebelum mengulang.",
        },
        500
      );
    }

    // ==========================================
    // 11. RESPONS BERHASIL
    // ==========================================

    return respond({
      success: true,
      dry_run: false,

      source,

      registration_id:
        resultRegistrationId,

      participant_id:
        participantId,

      status: resultStatus,

      program_id:
        resultProgramId || null,

      message:
        decision === "approved"
          ? "Pendaftaran berhasil disetujui dan program OJT dibuat."
          : "Pendaftaran berhasil ditolak.",

      mentor: {
        id: mentor.id,
        full_name: mentor.full_name,
        role: "mentor",
      },
    });

  } catch (error) {
    console.error(
      "[MENTOR REVIEW] Server error:",
      error
    );

    return respond(
      {
        success: false,
        error:
          "Terjadi kesalahan server saat memproses keputusan Mentor.",
      },
      500
    );
  }
}

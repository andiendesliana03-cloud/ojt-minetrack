
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ======================================================
// OJT MINETRACK V2.0
// API REVIEW REGISTRATION — MENTOR
//
// Mendukung:
// 1. Pengajuan baru:
//    public.ojt_registration_requests
//
// 2. Pendaftaran legacy:
//    public.participant_registrations
//
// RPC:
// - New: review_ojt_registration (4 parameter)
// - Legacy: review_ojt_registration (7 parameter)
//
// MODE PENGUJIAN:
// Kedua keputusan tetap nonaktif.
// ======================================================

// WAJIB false selama pengujian.
const APPROVAL_ENABLED = false;
const REJECTION_ENABLED = false;

// ======================================================
// VALID SITE
// ======================================================

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

// ======================================================
// RESPONSE
// ======================================================

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

// ======================================================
// SUPABASE ADMIN CLIENT
// ======================================================

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

// ======================================================
// VALIDATION HELPERS
// ======================================================

function validUUID(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
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

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validSite(value) {
  return (
    typeof value === "string" &&
    VALID_SITES.includes(value.trim())
  );
}

function normalizeDecision(value) {
  if (
    value === "approved" ||
    value === "rejected"
  ) {
    return value;
  }

  return null;
}

function normalizeSource(value) {
  if (
    value === "new" ||
    value === "legacy"
  ) {
    return value;
  }

  return null;
}

// ======================================================
// FEATURE CONTROL
// ======================================================

function isDecisionEnabled(decision) {
  if (decision === "approved") {
    return APPROVAL_ENABLED;
  }

  if (decision === "rejected") {
    return REJECTION_ENABLED;
  }

  return false;
}

// ======================================================
// AUTHENTICATION
// ======================================================

async function authenticateMentor(request, admin) {
  const authorization =
    request.headers.get("authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return {
      success: false,
      response: fail(
        "Silakan login sebagai Mentor OJT.",
        401
      ),
    };
  }

  const token = authorization
    .slice(7)
    .trim();

  if (!token) {
    return {
      success: false,
      response: fail(
        "Token login tidak tersedia.",
        401
      ),
    };
  }

  const {
    data: authData,
    error: authError,
  } = await admin.auth.getUser(token);

  if (
    authError ||
    !authData?.user?.id
  ) {
    return {
      success: false,
      response: fail(
        "Sesi login tidak valid.",
        401
      ),
    };
  }

  const {
    data: mentor,
    error: mentorError,
  } = await admin
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (mentorError) {
    throw mentorError;
  }

  if (
    !mentor ||
    mentor.role !== "mentor"
  ) {
    return {
      success: false,
      response: fail(
        "Akses hanya untuk Mentor OJT.",
        403
      ),
    };
  }

  return {
    success: true,
    mentor,
  };
}

// ======================================================
// LOAD NEW REGISTRATION
// ======================================================

async function loadNewRegistration(
  admin,
  requestId
) {
  const {
    data,
    error,
  } = await admin
    .from("ojt_registration_requests")
    .select(`
      id,
      participant_id,
      site,
      start_date,
      end_date,
      status
    `)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      success: false,
      response: fail(
        "Pengajuan OJT baru tidak ditemukan.",
        404
      ),
    };
  }

  if (data.status !== "pending") {
    return {
      success: false,
      response: fail(
        "Pengajuan sudah diproses sebelumnya.",
        409
      ),
    };
  }

  return {
    success: true,
    registration: data,
  };
}

// ======================================================
// LOAD LEGACY REGISTRATION
// ======================================================

async function loadLegacyRegistration(
  admin,
  requestId
) {
  const {
    data,
    error,
  } = await admin
    .from("participant_registrations")
    .select(`
      id,
      user_id,
      status
    `)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      success: false,
      response: fail(
        "Pendaftaran peserta tidak ditemukan.",
        404
      ),
    };
  }

  if (data.status !== "pending") {
    return {
      success: false,
      response: fail(
        "Pendaftaran sudah diproses sebelumnya.",
        409
      ),
    };
  }

  // Pastikan akun tujuan merupakan Participant.
  const {
    data: participant,
    error: profileError,
  } = await admin
    .from("profiles")
    .select("id,role")
    .eq("id", data.user_id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (
    !participant ||
    participant.role !== "participant"
  ) {
    return {
      success: false,
      response: fail(
        "Akun peserta tidak valid.",
        400
      ),
    };
  }

  return {
    success: true,
    registration: data,
  };
}

// ======================================================
// VALIDATE APPROVAL DATA
// ======================================================

function validateNewApproval(registration) {
  if (!validSite(registration.site)) {
    return "Site pada pengajuan OJT tidak valid.";
  }

  if (
    !validDate(registration.start_date) ||
    !validDate(registration.end_date)
  ) {
    return "Periode OJT pada pengajuan tidak valid.";
  }

  if (
    registration.end_date <
    registration.start_date
  ) {
    return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
  }

  return null;
}

function validateLegacyApproval(body) {
  const site = body.site;
  const startDate = body.start_date;
  const endDate = body.end_date;

  if (!validSite(site)) {
    return "Pilih site OJT yang valid.";
  }

  if (
    !validDate(startDate) ||
    !validDate(endDate)
  ) {
    return "Tanggal mulai atau selesai OJT tidak valid.";
  }

  if (endDate < startDate) {
    return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
  }

  return null;
}

// ======================================================
// RPC — NEW REGISTRATION
// ======================================================

async function processNewRegistration(
  admin,
  requestId,
  mentorId,
  decision,
  rejectionReason
) {
  const {
    data,
    error,
  } = await admin.rpc(
    "review_ojt_registration",
    {
      p_request_id: requestId,
      p_mentor_id: mentorId,
      p_decision: decision,
      p_rejection_reason:
        decision === "rejected"
          ? rejectionReason
          : null,
    }
  );

  if (error) {
    console.error(
      "[MENTOR REVIEW] New RPC:",
      error
    );

    throw error;
  }

  return data;
}

// ======================================================
// RPC — LEGACY REGISTRATION
// ======================================================

async function processLegacyRegistration(
  admin,
  requestId,
  mentorId,
  decision,
  body,
  rejectionReason
) {
  const {
    data,
    error,
  } = await admin.rpc(
    "review_ojt_registration",
    {
      p_registration_id: requestId,
      p_mentor_id: mentorId,

      p_action:
        decision === "approved"
          ? "approve"
          : "reject",

      p_site:
        decision === "approved"
          ? body.site.trim()
          : null,

      p_start_date:
        decision === "approved"
          ? body.start_date
          : null,

      p_end_date:
        decision === "approved"
          ? body.end_date
          : null,

      p_rejection_reason:
        decision === "rejected"
          ? rejectionReason
          : null,
    }
  );

  if (error) {
    console.error(
      "[MENTOR REVIEW] Legacy RPC:",
      error
    );

    throw error;
  }

  return data;
}

// ======================================================
// NORMALIZE RPC RESULT
// ======================================================

function normalizeRpcResult(data, source) {
  const result = Array.isArray(data)
    ? data[0]
    : data;

  if (!result) {
    throw new Error(
      "Transaksi tidak mengembalikan hasil."
    );
  }

  if (source === "new") {
    return {
      registration_id:
        result.registration_id,

      status:
        result.registration_status,

      program_id:
        result.program_id || null,
    };
  }

  return {
    registration_id:
      result.result_registration_id,

    status:
      result.result_status,

    program_id:
      result.result_program_id || null,
  };
}

// ======================================================
// MAIN POST
// ======================================================

export async function POST(request) {
  try {
    // ================================================
    // 1. SUPABASE
    // ================================================

    const admin = getAdminClient();

    // ================================================
    // 2. AUTHENTICATION
    // ================================================

    const auth = await authenticateMentor(
      request,
      admin
    );

    if (!auth.success) {
      return auth.response;
    }

    const mentor = auth.mentor;

    // ================================================
    // 3. READ REQUEST BODY
    // ================================================

    let body;

    try {
      body = await request.json();
    } catch {
      return fail(
        "Format permintaan tidak valid.",
        400
      );
    }

    const requestId = body?.request_id;
    const source = normalizeSource(body?.source);
    const decision = normalizeDecision(
      body?.decision
    );

    const rejectionReason =
      typeof body?.rejection_reason === "string"
        ? body.rejection_reason.trim()
        : "";

    // ================================================
    // 4. VALIDATE REQUEST
    // ================================================

    if (!validUUID(requestId)) {
      return fail(
        "ID pengajuan tidak valid.",
        400
      );
    }

    if (!source) {
      return fail(
        "Sumber pengajuan tidak valid.",
        400
      );
    }

    if (!decision) {
      return fail(
        "Keputusan Mentor tidak valid.",
        400
      );
    }

    if (
      decision === "rejected" &&
      (
        rejectionReason.length < 5 ||
        rejectionReason.length > 1000
      )
    ) {
      return fail(
        "Alasan penolakan harus 5–1000 karakter.",
        400
      );
    }

    // ================================================
    // 5. FEATURE CONTROL
    //
    // Tidak ada perubahan database ketika
    // fitur masih nonaktif.
    // ================================================

    if (!isDecisionEnabled(decision)) {
      return fail(
        decision === "approved"
          ? "Fitur persetujuan Mentor masih dinonaktifkan selama pengujian."
          : "Fitur penolakan Mentor masih dinonaktifkan selama pengujian.",
        423
      );
    }

    // ================================================
    // 6. LOAD REGISTRATION
    // ================================================

    let registration;

    if (source === "new") {
      const loaded =
        await loadNewRegistration(
          admin,
          requestId
        );

      if (!loaded.success) {
        return loaded.response;
      }

      registration = loaded.registration;

      if (
        registration.participant_id ===
        mentor.id
      ) {
        return fail(
          "Mentor dan peserta tidak boleh sama.",
          403
        );
      }

      if (decision === "approved") {
        const validation =
          validateNewApproval(registration);

        if (validation) {
          return fail(
            validation,
            400
          );
        }
      }
    } else {
      const loaded =
        await loadLegacyRegistration(
          admin,
          requestId
        );

      if (!loaded.success) {
        return loaded.response;
      }

      registration = loaded.registration;

      if (
        registration.user_id === mentor.id
      ) {
        return fail(
          "Mentor dan peserta tidak boleh sama.",
          403
        );
      }

      if (decision === "approved") {
        const validation =
          validateLegacyApproval(body);

        if (validation) {
          return fail(
            validation,
            400
          );
        }
      }
    }

    // ================================================
    // 7. EXECUTE RPC
    //
    // New    -> RPC 4 parameter
    // Legacy -> RPC 7 parameter
    //
    // Supabase menangani transaksi.
    // ================================================

    let rpcData;

    if (source === "new") {
      rpcData =
        await processNewRegistration(
          admin,
          requestId,
          mentor.id,
          decision,
          rejectionReason
        );
    } else {
      rpcData =
        await processLegacyRegistration(
          admin,
          requestId,
          mentor.id,
          decision,
          body,
          rejectionReason
        );
    }

    // ================================================
    // 8. NORMALIZE RESULT
    // ================================================

    const result = normalizeRpcResult(
      rpcData,
      source
    );

    if (
      result.registration_id !== requestId
    ) {
      throw new Error(
        "ID hasil transaksi tidak sesuai."
      );
    }

    if (result.status !== decision) {
      throw new Error(
        "Status hasil transaksi tidak sesuai keputusan."
      );
    }

    if (
      decision === "approved" &&
      !result.program_id
    ) {
      throw new Error(
        "Program OJT belum berhasil dibuat."
      );
    }

    // ================================================
    // 9. SUCCESS RESPONSE
    //
    // Format wajib sesuai frontend.
    // ================================================

    return respond({
      success: true,

      dry_run: false,

      source,

      request_id: requestId,

      registration_id:
        result.registration_id,

      status: result.status,

      program_id:
        result.program_id,

      message:
        decision === "approved"
          ? "Pendaftaran berhasil disetujui. Program OJT telah dibuat."
          : "Pendaftaran berhasil ditolak.",

      mentor: {
        id: mentor.id,
        full_name:
          mentor.full_name || "Mentor OJT",
      },
    });
  } catch (error) {
    console.error(
      "[MENTOR REVIEW] Server Error:",
      error
    );

    const message = String(
      error?.message || ""
    );

    // ==============================================
    // 10. DATABASE ERROR MAPPING
    // ==============================================

    if (
      message.includes("sudah diproses") ||
      message.includes("sudah memiliki program")
    ) {
      return fail(
        message,
        409
      );
    }

    if (
      message.includes("tidak ditemukan")
    ) {
      return fail(
        message,
        404
      );
    }

    if (
      message.includes("Akses ditolak") ||
      message.includes("mentor tidak valid")
    ) {
      return fail(
        "Akun Mentor tidak memiliki izin untuk memproses keputusan.",
        403
      );
    }

    if (
      message.includes("Alasan penolakan")
    ) {
      return fail(
        message,
        400
      );
    }

    return fail(
      "Terjadi kesalahan saat memproses keputusan Mentor. Periksa log server.",
      500
    );
  }
}


import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function normalizeStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase();

  if (
    status === "pending" ||
    status === "approved" ||
    status === "rejected"
  ) {
    return status;
  }

  return status || "unknown";
}

function normalizeDate(value) {
  if (!value) return null;

  return String(value).slice(0, 10);
}

function normalizeNew(row, profile) {
  return {
    id: row.id,

    source: "new",

    participant_id: row.participant_id,

    full_name:
      profile?.full_name ||
      "Peserta OJT",

    email: null,

    department:
      row.department ||
      profile?.department ||
      null,

    site: row.site || null,

    start_date: normalizeDate(
      row.start_date
    ),

    end_date: normalizeDate(
      row.end_date
    ),

    status: normalizeStatus(row.status),

    created_at: row.created_at || null,

    reviewed_by: row.reviewed_by || null,

    reviewed_at: row.reviewed_at || null,

    rejection_reason:
      row.rejection_reason || null,
  };
}

function normalizeLegacy(row, profile) {
  return {
    id: row.id,

    source: "legacy",

    participant_id: row.user_id,

    full_name:
      row.full_name ||
      profile?.full_name ||
      "Peserta OJT",

    email: row.email || null,

    department:
      row.department ||
      profile?.department ||
      null,

    site: row.site || null,

    // Tabel participant_registrations
    // tidak memiliki kolom tanggal.
    // Jangan mengarang periode individual.
    start_date: null,

    end_date: null,

    status: normalizeStatus(row.status),

    created_at: row.created_at || null,

    reviewed_by: row.reviewed_by || null,

    reviewed_at: row.reviewed_at || null,

    rejection_reason:
      row.rejection_reason || null,
  };
}

export async function GET(request) {
  try {
    // ===========================================
    // 1. VERIFIKASI TOKEN
    // ===========================================

    const authorization =
      request.headers.get("authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return fail(
        "Silakan login sebagai Mentor.",
        401
      );
    }

    const token = authorization
      .slice(7)
      .trim();

    if (!token) {
      return fail(
        "Token login tidak tersedia.",
        401
      );
    }

    const admin = getAdminClient();

    const {
      data: authData,
      error: authError,
    } = await admin.auth.getUser(token);

    if (
      authError ||
      !authData?.user?.id
    ) {
      return fail(
        "Sesi login tidak valid.",
        401
      );
    }

    const mentorId = authData.user.id;

    // ===========================================
    // 2. VALIDASI ROLE MENTOR
    // ===========================================

    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", mentorId)
      .maybeSingle();

    if (mentorError) {
      throw mentorError;
    }

    if (
      !mentor ||
      mentor.role !== "mentor"
    ) {
      return fail(
        "Hanya Mentor yang dapat melihat daftar pengajuan.",
        403
      );
    }

    // ===========================================
    // 3. AMBIL PENDAFTARAN SISTEM BARU
    // ===========================================

    const {
      data: newRegistrations,
      error: newError,
    } = await admin
      .from("ojt_registration_requests")
      .select(`
        id,
        participant_id,
        department,
        site,
        start_date,
        end_date,
        status,
        created_at,
        reviewed_by,
        reviewed_at,
        rejection_reason
      `)
      .order("created_at", {
        ascending: false,
      });

    if (newError) {
      console.error(
        "[MENTOR REGISTRATIONS] New:",
        newError.message
      );

      return fail(
        "Gagal membaca pengajuan OJT baru.",
        500
      );
    }

    // ===========================================
    // 4. AMBIL PENDAFTARAN SISTEM LAMA
    // ===========================================

    const {
      data: legacyRegistrations,
      error: legacyError,
    } = await admin
      .from("participant_registrations")
      .select(`
        id,
        user_id,
        full_name,
        email,
        department,
        site,
        status,
        created_at,
        reviewed_by,
        reviewed_at,
        rejection_reason
      `)
      .order("created_at", {
        ascending: false,
      });

    if (legacyError) {
      console.error(
        "[MENTOR REGISTRATIONS] Legacy:",
        legacyError.message
      );

      return fail(
        "Gagal membaca pendaftaran peserta.",
        500
      );
    }

    const newRows = newRegistrations || [];
    const legacyRows = legacyRegistrations || [];

    // ===========================================
    // 5. AMBIL IDENTITAS PESERTA
    // ===========================================

    const participantIds = [
      ...new Set(
        [
          ...newRows.map(
            (row) => row.participant_id
          ),
          ...legacyRows.map(
            (row) => row.user_id
          ),
        ].filter(Boolean)
      ),
    ];

    const profilesById = new Map();

    if (participantIds.length > 0) {
      // Batasi jumlah ID per permintaan agar
      // tidak membuat query terlalu besar.
      const batchSize = 100;

      for (
        let index = 0;
        index < participantIds.length;
        index += batchSize
      ) {
        const batch = participantIds.slice(
          index,
          index + batchSize
        );

        const {
          data: profiles,
          error: profileError,
        } = await admin
          .from("profiles")
          .select(
            "id,full_name,department,role"
          )
          .in("id", batch);

        if (profileError) {
          throw profileError;
        }

        for (const profile of profiles || []) {
          profilesById.set(
            profile.id,
            profile
          );
        }
      }
    }

    // ===========================================
    // 6. NORMALISASI SUMBER DATA
    // ===========================================

    const normalizedNew = newRows.map(
      (row) =>
        normalizeNew(
          row,
          profilesById.get(
            row.participant_id
          )
        )
    );

    const normalizedLegacy = legacyRows.map(
      (row) =>
        normalizeLegacy(
          row,
          profilesById.get(
            row.user_id
          )
        )
    );

    // Tetap tampilkan kedua sumber agar
    // riwayat pendaftaran tidak hilang.
    const registrations = [
      ...normalizedNew,
      ...normalizedLegacy,
    ].sort((a, b) => {
      const priority = {
        pending: 0,
        approved: 1,
        rejected: 2,
      };

      const priorityA =
        priority[a.status] ?? 3;

      const priorityB =
        priority[b.status] ?? 3;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const timeA = a.created_at
        ? new Date(a.created_at).getTime()
        : 0;

      const timeB = b.created_at
        ? new Date(b.created_at).getTime()
        : 0;

      return timeB - timeA;
    });

    // ===========================================
    // 7. STATISTIK
    // ===========================================

    const summary = {
      total: registrations.length,

      pending: registrations.filter(
        (row) => row.status === "pending"
      ).length,

      approved: registrations.filter(
        (row) => row.status === "approved"
      ).length,

      rejected: registrations.filter(
        (row) => row.status === "rejected"
      ).length,

      new: normalizedNew.length,

      legacy: normalizedLegacy.length,
    };

    // ===========================================
    // 8. RESPONSE
    // ===========================================

    return respond({
      success: true,

      registrations,

      summary,

      total: summary.total,

      mentor: {
        id: mentor.id,
        full_name:
          mentor.full_name || "Mentor OJT",
        role: "mentor",
      },
    });
  } catch (error) {
    console.error(
      "[MENTOR REGISTRATIONS] Server:",
      error
    );

    return fail(
      "Terjadi kesalahan server saat mengambil pengajuan.",
      500
    );
  }
}

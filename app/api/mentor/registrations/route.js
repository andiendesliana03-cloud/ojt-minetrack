
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

export async function GET(request) {
  try {
    // ==============================================
    // 1. VALIDASI TOKEN LOGIN
    // ==============================================

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

    if (authError || !authData?.user) {
      return respond(
        {
          success: false,
          error: "Sesi login tidak valid.",
        },
        401
      );
    }

    // ==============================================
    // 2. VALIDASI ROLE MENTOR
    // ==============================================

    const {
      data: mentor,
      error: mentorError,
    } = await admin
      .from("profiles")
      .select("id,role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (mentorError) {
      throw mentorError;
    }

    if (!mentor || mentor.role !== "mentor") {
      return respond(
        {
          success: false,
          error: "Akses hanya untuk mentor.",
        },
        403
      );
    }

    // ==============================================
    // 3. PENGAJUAN SISTEM BARU
    // HANYA ROLE PARTICIPANT
    // ==============================================

    const {
      data: newRequests,
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
        rejection_reason,
        reviewed_by,
        reviewed_at,
        created_at,
        peserta:profiles!ojt_registration_requests_participant_id_fkey(
          full_name,
          role
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (newError) {
      console.error(
        "New registration query failed:",
        newError
      );

      return respond(
        {
          success: false,
          error:
            "Gagal membaca pengajuan dari sistem baru.",
        },
        500
      );
    }

    // Filter berdasarkan role profil.
    const currentRegistrations = (
      newRequests || []
    )
      .filter(
        (item) =>
          item.peserta?.role === "participant"
      )
      .map((item) => ({
        id: item.id,
        participant_id: item.participant_id,
        user_id: item.participant_id,

        full_name:
          item.peserta?.full_name ||
          "Nama belum tersedia",

        email: null,
        department: item.department,
        site: item.site,
        start_date: item.start_date,
        end_date: item.end_date,
        status: item.status,
        reviewed_by: item.reviewed_by,
        reviewed_at: item.reviewed_at,

        rejection_reason:
          item.rejection_reason || null,

        created_at: item.created_at,
        source: "new",
      }));

    // ==============================================
    // 4. RIWAYAT PENDAFTARAN SISTEM LAMA
    // ==============================================

    const {
      data: oldRequests,
      error: oldError,
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
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at
      `)
      .order("created_at", {
        ascending: false,
      });

    if (oldError) {
      console.error(
        "Old registration query failed:",
        oldError
      );

      return respond(
        {
          success: false,
          error:
            "Gagal membaca riwayat pendaftaran lama.",
        },
        500
      );
    }

    // ==============================================
    // 5. VERIFIKASI ROLE RIWAYAT LAMA
    // ==============================================

    const oldUserIds = [
      ...new Set(
        (oldRequests || [])
          .map((item) => item.user_id)
          .filter(Boolean)
      ),
    ];

    let participantIds = new Set();

    if (oldUserIds.length > 0) {
      const {
        data: oldProfiles,
        error: profileError,
      } = await admin
        .from("profiles")
        .select("id,role")
        .in("id", oldUserIds);

      if (profileError) {
        console.error(
          "Legacy profile query failed:",
          profileError
        );

        return respond(
          {
            success: false,
            error:
              "Gagal memverifikasi identitas riwayat pendaftaran.",
          },
          500
        );
      }

      participantIds = new Set(
        (oldProfiles || [])
          .filter(
            (profile) =>
              profile.role === "participant"
          )
          .map((profile) => profile.id)
      );
    }

    // Hanya riwayat milik peserta.
    const legacyRegistrations = (
      oldRequests || []
    )
      .filter((item) =>
        participantIds.has(item.user_id)
      )
      .map((item) => ({
        id: item.id,
        participant_id: item.user_id,
        user_id: item.user_id,
        full_name: item.full_name,
        email: item.email,
        department: item.department,
        site: item.site,

        start_date: null,
        end_date: null,

        status: item.status,
        reviewed_by: item.reviewed_by,
        reviewed_at: item.reviewed_at,

        rejection_reason:
          item.rejection_reason || null,

        created_at: item.created_at,
        source: "legacy",
      }));

    // ==============================================
    // 6. GABUNGKAN DATA PESERTA
    // ==============================================

    const registrations = [
      ...currentRegistrations,
      ...legacyRegistrations,
    ].sort((a, b) => {
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

    // ==============================================
    // 7. RESPONSE
    // ==============================================

    return respond({
      success: true,

      registrations,

      total: registrations.length,

      new_count:
        currentRegistrations.length,

      legacy_count:
        legacyRegistrations.length,
    });

  } catch (error) {
    console.error(
      "GET mentor registrations:",
      error
    );

    return respond(
      {
        success: false,
        error:
          "Terjadi kesalahan saat mengambil daftar pengajuan.",
      },
      500
    );
  }
}

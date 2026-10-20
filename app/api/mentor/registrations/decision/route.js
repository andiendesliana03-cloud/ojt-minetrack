
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// WAJIB tetap false selama pengujian.
const APPROVAL_ENABLED = false;

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
];

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

function validUUID(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export async function POST(request) {
  try {
    const authorization =
      request.headers.get("authorization") || "";

    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";

    if (!token) {
      return respond(
        { error: "Silakan login terlebih dahulu." },
        401
      );
    }

    const admin = getAdminClient();

    // Verifikasi token login.
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return respond(
        { error: "Sesi login tidak valid." },
        401
      );
    }

    // Hanya mentor yang boleh mengambil keputusan.
    const { data: mentor, error: mentorError } =
      await admin
        .from("profiles")
        .select("id,role")
        .eq("id", user.id)
        .single();

    if (
      mentorError ||
      !mentor ||
      mentor.role !== "mentor"
    ) {
      return respond(
        { error: "Akses hanya untuk mentor." },
        403
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return respond(
        { error: "Format permintaan tidak valid." },
        400
      );
    }

    const {
      registration_id,
      action,
      site,
      start_date,
      end_date,
      rejection_reason,
    } = body || {};

    if (!validUUID(registration_id)) {
      return respond(
        { error: "ID pendaftaran tidak valid." },
        400
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return respond(
        { error: "Tindakan tidak valid." },
        400
      );
    }

    // Pastikan pengajuan masih pending.
    const {
      data: registration,
      error: registrationError,
    } = await admin
      .from("participant_registrations")
      .select(
        "id,user_id,full_name,status"
      )
      .eq("id", registration_id)
      .maybeSingle();

    if (registrationError) {
      throw registrationError;
    }

    if (!registration) {
      return respond(
        { error: "Pendaftaran tidak ditemukan." },
        404
      );
    }

    if (registration.status !== "pending") {
      return respond(
        {
          error:
            "Pendaftaran sudah diproses sebelumnya.",
        },
        409
      );
    }

    let reason = null;

    if (action === "approve") {
      if (!VALID_SITES.includes(site)) {
        return respond(
          { error: "Site OJT tidak valid." },
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
            error:
              "Tanggal mulai atau selesai OJT tidak valid.",
          },
          400
        );
      }
    } else {
      reason =
        typeof rejection_reason === "string"
          ? rejection_reason.trim()
          : "";

      if (reason.length < 5) {
        return respond(
          {
            error:
              "Alasan penolakan minimal 5 karakter.",
          },
          400
        );
      }
    }

    // MODE SIMULASI.
    // Tidak memanggil transaksi database.
    if (!APPROVAL_ENABLED) {
      return respond({
        success: true,
        dry_run: true,
        message:
          action === "approve"
            ? "Simulasi persetujuan berhasil. Database belum berubah."
            : "Simulasi penolakan berhasil. Database belum berubah.",
        preview: {
          registration_id,
          participant_id: registration.user_id,
          full_name: registration.full_name,
          mentor_id: mentor.id,
          action,
          ...(action === "approve"
            ? {
                site,
                start_date,
                end_date,
                status: "approved",
                program_status: "active",
              }
            : {
                rejection_reason: reason,
                status: "rejected",
              }),
        },
      });
    }

    // MODE ASLI:
    // Seluruh perubahan dilakukan dalam satu
    // transaksi melalui fungsi Supabase.
    const { data, error } = await admin.rpc(
      "review_ojt_registration",
      {
        p_registration_id: registration_id,
        p_mentor_id: mentor.id,
        p_action: action,
        p_site:
          action === "approve" ? site : null,
        p_start_date:
          action === "approve" ? start_date : null,
        p_end_date:
          action === "approve" ? end_date : null,
        p_rejection_reason:
          action === "reject" ? reason : null,
      }
    );

    if (error) {
      console.error(
        "review_ojt_registration:",
        error
      );

      return respond(
        {
          error:
            "Keputusan gagal diproses. Periksa status pendaftaran atau hubungi administrator.",
        },
        409
      );
    }

    const result = data?.[0];

    if (!result) {
      throw new Error(
        "Transaksi tidak mengembalikan hasil."
      );
    }

    return respond({
      success: true,
      dry_run: false,
      registration_id:
        result.result_registration_id,
      status: result.result_status,
      program_id: result.result_program_id,
      message:
        result.result_status === "approved"
          ? "Pendaftaran berhasil disetujui."
          : "Pendaftaran berhasil ditolak.",
    });
  } catch (error) {
    console.error(
      "POST mentor registration decision:",
      error
    );

    return respond(
      {
        error:
          "Terjadi kesalahan saat memproses keputusan mentor.",
      },
      500
    );
  }
}

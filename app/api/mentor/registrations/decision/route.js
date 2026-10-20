
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Tetap FALSE selama tahap pengujian.
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

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function respond(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request) {
  try {
    const authHeader =
      request.headers.get("authorization") || "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      return respond(
        { error: "Silakan login terlebih dahulu." },
        401
      );
    }

    const admin = getAdminClient();

    // Verifikasi identitas pengguna.
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

    const body = await request.json();

    const {
      registration_id,
      action,
      site,
      start_date,
      end_date,
      rejection_reason,
    } = body || {};

    if (
      typeof registration_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        registration_id
      )
    ) {
      return respond(
        { error: "ID pendaftaran tidak valid." },
        400
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return respond(
        { error: "Tindakan tidak dikenal." },
        400
      );
    }

    const {
      data: registration,
      error: registrationError,
    } = await admin
      .from("participant_registrations")
      .select(
        "id,user_id,full_name,email,department,status"
      )
      .eq("id", registration_id)
      .single();

    if (registrationError || !registration) {
      return respond(
        { error: "Pengajuan tidak ditemukan." },
        404
      );
    }

    if (registration.status !== "pending") {
      return respond(
        {
          error:
            "Pengajuan ini sudah diproses mentor.",
        },
        409
      );
    }

    if (action === "approve") {
      if (!VALID_SITES.includes(site)) {
        return respond(
          { error: "Site OJT tidak valid." },
          400
        );
      }

      if (
        !isValidDate(start_date) ||
        !isValidDate(end_date) ||
        end_date < start_date
      ) {
        return respond(
          {
            error:
              "Periode OJT tidak valid. Tanggal selesai harus sama atau setelah tanggal mulai.",
          },
          400
        );
      }
    }

    if (action === "reject") {
      if (
        typeof rejection_reason !== "string" ||
        rejection_reason.trim().length < 5
      ) {
        return respond(
          {
            error:
              "Alasan penolakan minimal 5 karakter.",
          },
          400
        );
      }
    }

    // MODE PENGUJIAN:
    // Tidak ada INSERT atau UPDATE database.
    if (!APPROVAL_ENABLED) {
      return respond({
        success: true,
        dry_run: true,
        message:
          action === "approve"
            ? "Simulasi persetujuan berhasil. Belum ada perubahan database."
            : "Simulasi penolakan berhasil. Belum ada perubahan database.",
        preview: {
          registration_id,
          participant_id: registration.user_id,
          full_name: registration.full_name,
          action,
          mentor_id: mentor.id,
          ...(action === "approve"
            ? {
                site,
                start_date,
                end_date,
                program_status: "active",
              }
            : {
                rejection_reason:
                  rejection_reason.trim(),
              }),
        },
      });
    }

    // Belum diimplementasikan:
    // Proses persetujuan asli harus memakai transaksi
    // database agar pembuatan program dan perubahan
    // status pendaftaran berlangsung secara atomik.
    return respond(
      {
        error:
          "Proses persetujuan asli belum diaktifkan. Gunakan mode simulasi.",
      },
      503
    );
  } catch (error) {
    console.error(
      "Mentor registration decision:",
      error
    );

    return respond(
      {
        error:
          "Gagal memproses keputusan mentor.",
      },
      500
    );
  }
}

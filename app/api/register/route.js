
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pengaman sementara.
// Registrasi akan diaktifkan setelah
// alur akun dan persetujuan mentor siap.
const SELF_REGISTRATION_ENABLED = false;

export async function POST() {
  if (!SELF_REGISTRATION_ENABLED) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Registrasi mandiri sedang disiapkan. Silakan coba kembali setelah fitur diaktifkan.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: "Registrasi belum dikonfigurasi.",
    },
    { status: 501 }
  );
}

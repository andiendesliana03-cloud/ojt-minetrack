
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Hanya nilai "true" yang mengaktifkan fitur.
  // Variabel kosong atau tidak tersedia = nonaktif.

  const submissionEnabled =
    process.env.OJT_SUBMISSION_ENABLED === "true";

  const approvalEnabled =
    process.env.OJT_APPROVAL_ENABLED === "true";

  const rejectionEnabled =
    process.env.OJT_REJECTION_ENABLED === "true";

  return NextResponse.json(
    {
      success: true,
      features: {
        submission_enabled: submissionEnabled,
        approval_enabled: approvalEnabled,
        rejection_enabled: rejectionEnabled,
      },
    },
    {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    }
  );
}

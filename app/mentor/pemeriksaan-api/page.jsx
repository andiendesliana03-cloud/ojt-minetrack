
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const CARD = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
};

const BUTTON = {
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  color: "#ffffff",
  background: "#2563eb",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

const TESTS = [
  {
    id: "submission",
    title: "Pengajuan Peserta",
    url: "/api/participant/registration",
    expected: "Pengajuan OJT belum diaktifkan",
    body: {
      dry_run: false,
    },
  },
  {
    id: "approval",
    title: "Persetujuan Mentor",
    url: "/api/mentor/review-registration",
    expected: "Persetujuan nyata belum diaktifkan",
    body: {
      request_id:
        "00000000-0000-4000-8000-000000000001",
      decision: "approved",
      dry_run: false,
    },
  },
  {
    id: "rejection",
    title: "Penolakan Mentor",
    url: "/api/mentor/review-registration",
    expected: "Penolakan nyata belum diaktifkan",
    body: {
      request_id:
        "00000000-0000-4000-8000-000000000001",
      decision: "rejected",
      rejection_reason:
        "Pengajuan perlu diperbaiki",
      dry_run: false,
    },
  },
];

async function readFeatureFlags() {
  const response = await fetch(
    "/api/system/feature-flags",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(
      "Tidak dapat membaca konfigurasi Vercel."
    );
  }

  const result = await response.json();

  if (result.success !== true || !result.features) {
    throw new Error(
      "Respons konfigurasi tidak valid."
    );
  }

  return result.features;
}

function allDisabled(features) {
  return (
    features.submission_enabled === false &&
    features.approval_enabled === false &&
    features.rejection_enabled === false
  );
}

export default function PemeriksaanApiPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        if (active) {
          setAuthorized(true);
        }
      } catch {
        if (active) {
          setMessage(
            "Gagal memverifikasi akses mentor."
          );
        }
      } finally {
        if (active) {
          setCheckingAccess(false);
        }
      }
    }

    checkAccess();

    return () => {
      active = false;
    };
  }, [router]);

  async function runTests() {
    if (!authorized || running) return;

    setRunning(true);
    setResults([]);
    setMessage("");

    try {
      // Pemeriksaan pertama:
      // seluruh transaksi harus nonaktif.
      const flags = await readFeatureFlags();

      if (!allDisabled(flags)) {
        throw new Error(
          "Pengujian dibatalkan. Ada fitur transaksi yang aktif di Vercel."
        );
      }

      const checked = [];

      for (const test of TESTS) {
        // Periksa lagi sebelum tiap permintaan.
        const currentFlags = await readFeatureFlags();

        if (!allDisabled(currentFlags)) {
          throw new Error(
            "Pengujian dihentikan karena konfigurasi berubah."
          );
        }

        let status = null;
        let responseText = "";
        let passed = false;

        try {
          // Sengaja TANPA token login pada request.
          // API harus menolak transaksi nyata
          // saat fitur masih false.
          const response = await fetch(test.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            credentials: "omit",
            body: JSON.stringify(test.body),
          });

          status = response.status;

          const contentType =
            response.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const data = await response.json();

            responseText = String(
              data.error || data.message || ""
            );
          } else {
            responseText =
              (await response.text()).slice(0, 150);
          }

          passed =
            status === 403 &&
            responseText.includes(test.expected);
        } catch (error) {
          responseText =
            error.message || "Kesalahan jaringan.";
        }

        const entry = {
          ...test,
          status,
          responseText,
          passed,
        };

        checked.push(entry);
        setResults([...checked]);
      }

      const passedCount = checked.filter(
        (item) => item.passed
      ).length;

      if (passedCount === TESTS.length) {
        setMessage(
          "LULUS: Ketiga API menolak transaksi nyata saat fitur dinonaktifkan."
        );
      } else {
        setMessage(
          "BELUM LULUS: Ada respons yang tidak sesuai. Jangan aktifkan transaksi nyata."
        );
      }
    } catch (error) {
      setMessage(
        error.message || "Pengujian dihentikan."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "24px 16px",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            ...CARD,
            background: "#0f172a",
            color: "#ffffff",
          }}
        >
          <h1>Pemeriksaan Keamanan API</h1>
          <p>
            OJT MineTrack v2.0
          </p>
          <p>
            Emergency Response Group
          </p>
        </header>

        <section style={CARD}>
          <h2>Langkah 73</h2>

          <p style={{ lineHeight: 1.7 }}>
            Halaman ini memeriksa apakah
            pengajuan, persetujuan, dan
            penolakan nyata ditolak saat
            fitur belum diaktifkan.
          </p>

          <p>
            <strong>
              Tidak menggunakan data peserta nyata.
            </strong>
          </p>

          <p style={{ color: "#64748b" }}>
            Pengujian hanya dapat dijalankan
            melalui halaman ini setelah login
            sebagai mentor.
          </p>

          {checkingAccess ? (
            <p>Memeriksa akses mentor...</p>
          ) : authorized ? (
            <button
              type="button"
              onClick={runTests}
              disabled={running}
              style={{
                ...BUTTON,
                background: running
                  ? "#94a3b8"
                  : "#2563eb",
              }}
            >
              {running
                ? "Memeriksa API..."
                : "Jalankan Pemeriksaan API"}
            </button>
          ) : (
            <p style={{ color: "#b91c1c" }}>
              Akses mentor belum terverifikasi.
            </p>
          )}
        </section>

        {results.length > 0 && (
          <section style={CARD}>
            <h2>Hasil Pemeriksaan</h2>

            {results.map((result) => (
              <div
                key={result.id}
                style={{
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  padding: 14,
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              >
                <h3>{result.title}</h3>

                <p>
                  <strong>Status HTTP:</strong>{" "}
                  {result.status ?? "Tidak tersedia"}
                </p>

                <p>
                  <strong>Respons:</strong>{" "}
                  {result.responseText || "-"}
                </p>

                <p
                  style={{
                    fontWeight: 700,
                    color: result.passed
                      ? "#15803d"
                      : "#b91c1c",
                  }}
                >
                  {result.passed
                    ? "✓ LULUS"
                    : "✕ BELUM LULUS"}
                </p>
              </div>
            ))}
          </section>
        )}

        {message && (
          <section
            role="status"
            style={{
              ...CARD,
              borderColor: "#94a3b8",
            }}
          >
            <strong>{message}</strong>
          </section>
        )}

        <button
          type="button"
          style={{
            ...BUTTON,
            background: "#475569",
          }}
          onClick={() => router.push("/")}
        >
          Kembali ke Dashboard Mentor
        </button>
      </div>
    </main>
  );
}

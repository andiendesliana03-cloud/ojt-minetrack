
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// PENGAMAN HALAMAN
// Keputusan nyata belum diaktifkan.
// API server juga harus tetap menolak
// keputusan nyata selama tahap persiapan.
const LIVE_DECISIONS_ENABLED = false;

const CARD = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
  boxSizing: "border-box",
};

const BUTTON = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(value) {
  if (!value) return "-";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Status({ value }) {
  const config = {
    pending: {
      label: "Menunggu Persetujuan",
      color: "#92400e",
      background: "#fef3c7",
    },
    approved: {
      label: "Disetujui",
      color: "#166534",
      background: "#dcfce7",
    },
    rejected: {
      label: "Ditolak",
      color: "#991b1b",
      background: "#fee2e2",
    },
  };

  const item = config[value] || {
    label: value || "-",
    color: "#334155",
    background: "#e2e8f0",
  };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "7px 11px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color: item.color,
        background: item.background,
      }}
    >
      {item.label}
    </span>
  );
}

export default function PersetujuanPesertaPage() {
  const router = useRouter();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("approved");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/mentor/registrations",
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        throw new Error(
          "Akses ditolak. Halaman hanya untuk mentor."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Gagal mengambil daftar pengajuan."
        );
      }

      setRegistrations(
        Array.isArray(result.registrations)
          ? result.registrations
          : []
      );
    } catch (err) {
      setRegistrations([]);
      setError(
        err.message || "Gagal memuat data."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  function openDecision(item, nextDecision) {
    if (
      processing ||
      item.source !== "new" ||
      item.status !== "pending"
    ) {
      return;
    }

    setSelected(item);
    setDecision(nextDecision);
    setError("");
    setMessage("");
    setPreview(null);
  }

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing) return;

    if (
      selected.source !== "new" ||
      selected.status !== "pending"
    ) {
      setError(
        "Hanya pengajuan baru yang masih pending dapat diproses."
      );
      return;
    }

    // Pengaman: tidak pernah mengirim
    // keputusan nyata selama flag false.
    const dryRun = !LIVE_DECISIONS_ENABLED;

    if (!dryRun) {
      const verb =
        decision === "approved"
          ? "MENYETUJUI"
          : "MENOLAK";

      const confirmed = window.confirm(
        `${verb} pengajuan OJT?\n\n` +
          `Peserta: ${selected.full_name}\n` +
          `Site: ${selected.site}\n` +
          `Mulai: ${formatDate(selected.start_date)}\n` +
          `Selesai: ${formatDate(selected.end_date)}\n\n` +
          "Keputusan ini akan mengubah database. Lanjutkan?"
      );

      if (!confirmed) return;
    }

    setProcessing(true);
    setError("");
    setMessage("");
    setPreview(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/mentor/review-registration",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            request_id: selected.id,
            decision,
            dry_run: dryRun,
          }),
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Keputusan tidak dapat diproses."
        );
      }

      if (dryRun) {
        if (
          result.success !== true ||
          result.dry_run !== true ||
          result.database_changed !== false
        ) {
          throw new Error(
            "Respons simulasi tidak sesuai."
          );
        }

        setMessage(
          result.message ||
            "Simulasi berhasil. Database tidak berubah."
        );

        setPreview(result.preview || null);
      } else {
        if (
          result.success !== true ||
          result.dry_run !== false ||
          result.status !== decision
        ) {
          throw new Error(
            "Hasil keputusan belum dapat dipastikan. " +
              "Periksa database sebelum mencoba lagi."
          );
        }

        if (
          decision === "approved" &&
          !result.program_id
        ) {
          throw new Error(
            "ID program tidak diterima. " +
              "Periksa database sebelum mengulangi."
          );
        }

        setMessage(
          result.message ||
            "Keputusan berhasil disimpan."
        );

        setPreview({
          status: result.status,
          registration_id:
            result.registration_id,
          program_id: result.program_id || null,
        });
      }

      setSelected(null);

      await loadRegistrations();

      if (!dryRun) {
        setFilter(
          decision === "approved"
            ? "approved"
            : "rejected"
        );
      }
    } catch (err) {
      setError(
        err.message ||
          "Terjadi kesalahan."
      );
    } finally {
      setProcessing(false);
    }
  }

  const filtered = registrations.filter(
    (item) =>
      filter === "all" ||
      item.status === filter
  );

  const count = (status) =>
    registrations.filter(
      (item) => item.status === status
    ).length;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "20px 15px",
        background: "#f1f5f9",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...CARD,
            background: "#0f172a",
            color: "#ffffff",
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            Persetujuan Peserta OJT
          </h1>

          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal</p>
        </header>

        <section
          style={{
            ...CARD,
            background: "#eff6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <strong style={{ color: "#1d4ed8" }}>
            MODE PERSIAPAN PENGGUNAAN UMUM
          </strong>

          <p
            style={{
              lineHeight: 1.7,
              marginBottom: 0,
            }}
          >
            Semua akun mentor dapat melihat
            daftar pengajuan OJT. Tombol
            persetujuan dan penolakan masih
            menjalankan simulasi. Keputusan
            nyata belum diaktifkan.
          </p>
        </section>

        <section style={CARD}>
          <h2>Ringkasan Pendaftaran</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(125px, 1fr))",
              gap: 10,
            }}
          >
            {[
              ["Menunggu", count("pending")],
              ["Disetujui", count("approved")],
              ["Ditolak", count("rejected")],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 14,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 13,
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={CARD}>
          <h2>Daftar Pengajuan Peserta</h2>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {[
              ["pending", "Menunggu"],
              ["approved", "Disetujui"],
              ["rejected", "Ditolak"],
              ["all", "Semua"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                style={{
                  ...BUTTON,
                  padding: "9px 12px",
                  background:
                    filter === value
                      ? "#2563eb"
                      : "#e2e8f0",
                  color:
                    filter === value
                      ? "#ffffff"
                      : "#334155",
                }}
                onClick={() => {
                  setFilter(value);
                  setSelected(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={loading || processing}
            onClick={loadRegistrations}
            style={{
              ...BUTTON,
              background: "#475569",
              marginBottom: 16,
            }}
          >
            {loading
              ? "Memuat..."
              : "↻ Perbarui Data"}
          </button>

          {loading && (
            <p>Memuat pengajuan peserta...</p>
          )}

          {!loading && filtered.length === 0 && (
            <p style={{ color: "#64748b" }}>
              Belum ada pengajuan pada kategori ini.
            </p>
          )}

          {!loading &&
            filtered.map((item) => (
              <div
                key={`${item.source}-${item.id}`}
                style={{
                  padding: 16,
                  marginBottom: 12,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {item.full_name ||
                      "Nama belum tersedia"}
                  </h3>

                  <span
                    style={{
                      alignSelf: "flex-start",
                      padding: "6px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        item.source === "new"
                          ? "#dbeafe"
                          : "#e2e8f0",
                      color:
                        item.source === "new"
                          ? "#1d4ed8"
                          : "#475569",
                    }}
                  >
                    {item.source === "new"
                      ? "Pengajuan Baru"
                      : "Riwayat Lama"}
                  </span>
                </div>

                <p>
                  Departemen:{" "}
                  {item.department || "-"}
                </p>

                <p>
                  Site:{" "}
                  <strong>
                    {item.site || "-"}
                  </strong>
                </p>

                {item.start_date && (
                  <p>
                    Periode OJT:{" "}
                    <strong>
                      {formatDate(item.start_date)}
                      {" s.d. "}
                      {formatDate(item.end_date)}
                    </strong>
                  </p>
                )}

                <p>
                  Tanggal Pengajuan:{" "}
                  {formatTime(item.created_at)}
                </p>

                <Status value={item.status} />

                {item.status === "rejected" &&
                  item.rejection_reason && (
                    <p>
                      Alasan: {item.rejection_reason}
                    </p>
                  )}

                {item.status === "pending" &&
                  item.source === "new" && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginTop: 16,
                      }}
                    >
                      <button
                        type="button"
                        disabled={processing}
                        style={{
                          ...BUTTON,
                          background: "#16a34a",
                        }}
                        onClick={() =>
                          openDecision(
                            item,
                            "approved"
                          )
                        }
                      >
                        {LIVE_DECISIONS_ENABLED
                          ? "✓ Setujui Pengajuan"
                          : "✓ Uji Persetujuan"}
                      </button>

                      <button
                        type="button"
                        disabled={processing}
                        style={{
                          ...BUTTON,
                          background: "#dc2626",
                        }}
                        onClick={() =>
                          openDecision(
                            item,
                            "rejected"
                          )
                        }
                      >
                        {LIVE_DECISIONS_ENABLED
                          ? "✕ Tolak Pengajuan"
                          : "✕ Uji Penolakan"}
                      </button>
                    </div>
                  )}

                {item.status === "pending" &&
                  item.source === "legacy" && (
                    <p
                      style={{
                        marginTop: 12,
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      Riwayat lama hanya ditampilkan.
                      Pemrosesan melalui sistem baru
                      tidak tersedia untuk data ini.
                    </p>
                  )}
              </div>
            ))}
        </section>

        {selected && (
          <section style={CARD}>
            <h2>
              {LIVE_DECISIONS_ENABLED
                ? decision === "approved"
                  ? "Konfirmasi Persetujuan"
                  : "Konfirmasi Penolakan"
                : decision === "approved"
                ? "Simulasi Persetujuan"
                : "Simulasi Penolakan"}
            </h2>

            <p>
              Peserta:{" "}
              <strong>
                {selected.full_name}
              </strong>
            </p>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: 10,
                padding: 14,
                marginBottom: 16,
                lineHeight: 1.8,
              }}
            >
              <div>
                <strong>Departemen:</strong>{" "}
                {selected.department || "-"}
              </div>

              <div>
                <strong>Site:</strong>{" "}
                {selected.site || "-"}
              </div>

              <div>
                <strong>Mulai:</strong>{" "}
                {formatDate(selected.start_date)}
              </div>

              <div>
                <strong>Selesai:</strong>{" "}
                {formatDate(selected.end_date)}
              </div>
            </div>

            <p
              style={{
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              {LIVE_DECISIONS_ENABLED
                ? "Keputusan akan diproses melalui API server."
                : "Ini hanya simulasi. Tidak ada data yang diubah."}
            </p>

            <form onSubmit={submitDecision}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <button
                  type="submit"
                  disabled={processing}
                  style={{
                    ...BUTTON,
                    background:
                      decision === "approved"
                        ? "#16a34a"
                        : "#dc2626",
                  }}
                >
                  {processing
                    ? "Memproses..."
                    : LIVE_DECISIONS_ENABLED
                    ? "Konfirmasi Keputusan"
                    : "Jalankan Simulasi"}
                </button>

                <button
                  type="button"
                  disabled={processing}
                  style={{
                    ...BUTTON,
                    background: "#64748b",
                  }}
                  onClick={() => {
                    setSelected(null);
                    setError("");
                  }}
                >
                  Batal
                </button>
              </div>
            </form>
          </section>
        )}

        {message && (
          <section
            role="status"
            style={{
              ...CARD,
              background: "#f0fdf4",
              borderColor: "#86efac",
            }}
          >
            <h3>Hasil Proses Pengajuan</h3>

            <p>{message}</p>

            {preview && (
              <pre
                style={{
                  background: "#ffffff",
                  padding: 12,
                  borderRadius: 9,
                  fontSize: 12,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {JSON.stringify(
                  preview,
                  null,
                  2
                )}
              </pre>
            )}
          </section>
        )}

        {error && (
          <section
            role="alert"
            style={{
              ...CARD,
              background: "#fff7f7",
              borderColor: "#fca5a5",
              color: "#b91c1c",
            }}
          >
            {error}
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
          ← Kembali ke Dashboard
        </button>
      </div>
    </main>
  );
}

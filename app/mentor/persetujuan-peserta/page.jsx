
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// Keputusan nyata tetap dinonaktifkan.
const LIVE_DECISIONS_ENABLED = false;

const CARD = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
};

const BUTTON = {
  padding: "12px 16px",
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] =
    String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
}

function statusLabel(status) {
  return {
    pending: "Menunggu Persetujuan",
    approved: "Disetujui",
    rejected: "Ditolak",
  }[status] || status || "-";
}

export default function PersetujuanPesertaPage() {
  const router = useRouter();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("approved");
  const [reason, setReason] = useState("");

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
          "Halaman ini hanya untuk mentor."
        );
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Gagal memuat pengajuan."
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
        err.message || "Terjadi kesalahan."
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
    setReason("");
    setMessage("");
    setError("");
    setPreview(null);
  }

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing) return;

    if (
      selected.source !== "new" ||
      selected.status !== "pending"
    ) {
      setError("Pengajuan tidak dapat diproses.");
      return;
    }

    const cleanReason = reason.trim();

    if (
      decision === "rejected" &&
      cleanReason.length < 5
    ) {
      setError(
        "Alasan penolakan minimal 5 karakter."
      );
      return;
    }

    const dryRun = !LIVE_DECISIONS_ENABLED;

    if (!dryRun) {
      const text =
        decision === "approved"
          ? "SETUJUI"
          : "TOLAK";

      const confirmed = window.confirm(
        `${text} pengajuan ${selected.full_name}?\n` +
        `Site: ${selected.site}\n` +
        `Periode: ${formatDate(selected.start_date)} ` +
        `s.d. ${formatDate(selected.end_date)}\n` +
        (decision === "rejected"
          ? `Alasan: ${cleanReason}\n`
          : "") +
        "\nKeputusan akan disimpan. Lanjutkan?"
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
          body: JSON.stringify({
            request_id: selected.id,
            decision,
            rejection_reason:
              decision === "rejected"
                ? cleanReason
                : null,
            dry_run: dryRun,
          }),
          cache: "no-store",
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
          "Gagal memproses keputusan."
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
          "Simulasi berhasil. " +
          "Alasan penolakan telah divalidasi " +
          "di formulir, tetapi belum disimpan."
        );

        setPreview({
          ...result.preview,
          ...(decision === "rejected"
            ? { rejection_reason: cleanReason }
            : {}),
        });
      } else {
        if (
          result.success !== true ||
          result.dry_run !== false ||
          result.status !== decision ||
          (decision === "approved" &&
            !result.program_id)
        ) {
          throw new Error(
            "Hasil keputusan belum dapat dipastikan. " +
            "Periksa database sebelum mencoba lagi."
          );
        }

        setMessage(
          result.message ||
          "Keputusan berhasil disimpan."
        );

        setPreview({
          registration_id: result.registration_id,
          status: result.status,
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
        err.message || "Terjadi kesalahan."
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
        background: "#f1f5f9",
        padding: 18,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 900, margin: "auto" }}>
        <header
          style={{
            ...CARD,
            background: "#0f172a",
            color: "#fff",
          }}
        >
          <h1>Persetujuan Peserta OJT</h1>
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
          <p style={{ lineHeight: 1.7 }}>
            Semua mentor dapat memeriksa pengajuan.
            Persetujuan dan penolakan masih simulasi.
            Alasan penolakan wajib diisi.
          </p>
        </section>

        <section style={CARD}>
          <h2>Ringkasan Pengajuan</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(120px,1fr))",
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
                  background: "#f8fafc",
                  padding: 14,
                  borderRadius: 10,
                }}
              >
                <div style={{ color: "#64748b" }}>
                  {label}
                </div>
                <strong style={{ fontSize: 28 }}>
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section style={CARD}>
          <h2>Daftar Pengajuan Peserta</h2>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
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
                type="button"
                key={value}
                style={{
                  ...BUTTON,
                  background:
                    filter === value
                      ? "#2563eb"
                      : "#e2e8f0",
                  color:
                    filter === value
                      ? "#fff"
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
            style={{
              ...BUTTON,
              background: "#475569",
              marginBottom: 14,
            }}
            disabled={loading || processing}
            onClick={loadRegistrations}
          >
            {loading
              ? "Memuat..."
              : "Perbarui Data"}
          </button>

          {loading && <p>Memuat pengajuan...</p>}

          {!loading && filtered.length === 0 && (
            <p>Belum ada pengajuan pada kategori ini.</p>
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
                <h3>{item.full_name || "Peserta"}</h3>

                <p>
                  Sumber:{" "}
                  {item.source === "new"
                    ? "Pengajuan Baru"
                    : "Riwayat Lama"}
                </p>

                <p>
                  Departemen: {item.department || "-"}
                </p>
                <p>Site: {item.site || "-"}</p>

                {item.start_date && (
                  <p>
                    Periode:{" "}
                    {formatDate(item.start_date)}
                    {" s.d. "}
                    {formatDate(item.end_date)}
                  </p>
                )}

                <p>
                  Diajukan: {formatTime(item.created_at)}
                </p>

                <p>
                  <strong>
                    {statusLabel(item.status)}
                  </strong>
                </p>

                {item.status === "rejected" && (
                  <p>
                    <strong>Alasan Penolakan:</strong>{" "}
                    {item.rejection_reason ||
                      "Belum tersedia"}
                  </p>
                )}

                {item.source === "new" &&
                  item.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
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
                          openDecision(item, "approved")
                        }
                      >
                        Uji Persetujuan
                      </button>

                      <button
                        type="button"
                        disabled={processing}
                        style={{
                          ...BUTTON,
                          background: "#dc2626",
                        }}
                        onClick={() =>
                          openDecision(item, "rejected")
                        }
                      >
                        Uji Penolakan
                      </button>
                    </div>
                  )}
              </div>
            ))}
        </section>

        {selected && (
          <section style={CARD}>
            <h2>
              {decision === "approved"
                ? "Persetujuan OJT"
                : "Penolakan OJT"}
            </h2>

            <p>
              Peserta: <strong>{selected.full_name}</strong>
            </p>
            <p>Site: {selected.site}</p>
            <p>
              Periode:{" "}
              {formatDate(selected.start_date)}
              {" s.d. "}
              {formatDate(selected.end_date)}
            </p>

            <form onSubmit={submitDecision}>
              {decision === "rejected" && (
                <label
                  htmlFor="rejection_reason"
                  style={{ display: "block" }}
                >
                  <strong>Alasan Penolakan *</strong>

                  <textarea
                    id="rejection_reason"
                    rows={4}
                    value={reason}
                    required
                    minLength={5}
                    maxLength={1000}
                    disabled={processing}
                    placeholder={
                      "Contoh: Periode OJT belum sesuai " +
                      "dengan jadwal pelaksanaan."
                    }
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    style={{
                      width: "100%",
                      padding: 12,
                      marginTop: 8,
                      marginBottom: 16,
                      boxSizing: "border-box",
                      border: "1px solid #cbd5e1",
                      borderRadius: 10,
                      fontSize: 16,
                    }}
                  />
                </label>
              )}

              <p style={{ color: "#64748b" }}>
                Saat ini keputusan hanya disimulasikan.
                Database belum akan berubah.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
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
                    : "Jalankan Simulasi"}
                </button>

                <button
                  type="button"
                  disabled={processing}
                  style={{
                    ...BUTTON,
                    background: "#64748b",
                  }}
                  onClick={() => setSelected(null)}
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
            }}
          >
            <h3>Hasil Proses</h3>
            <p>{message}</p>

            {preview && (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(preview, null, 2)}
              </pre>
            )}
          </section>
        )}

        {error && (
          <section
            role="alert"
            style={{
              ...CARD,
              background: "#fef2f2",
              color: "#991b1b",
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
          Kembali ke Dashboard
        </button>
      </div>
    </main>
  );
}

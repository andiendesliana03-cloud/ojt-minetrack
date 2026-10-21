
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO",
];

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
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const FIELD = {
  width: "100%",
  padding: 12,
  borderRadius: 9,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  boxSizing: "border-box",
  marginTop: 6,
  marginBottom: 12,
  fontSize: 16,
};

function formatDate(value) {
  if (!value) return "-";
  const parts = value.slice(0, 10).split("-");
  if (parts.length !== 3) return value;
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
    pending: ["Menunggu Persetujuan", "#92400e", "#fef3c7"],
    approved: ["Disetujui", "#166534", "#dcfce7"],
    rejected: ["Ditolak", "#991b1b", "#fee2e2"],
  };

  const item = config[value] || [
    value || "-",
    "#334155",
    "#e2e8f0",
  ];

  return (
    <span
      style={{
        display: "inline-block",
        background: item[2],
        color: item[1],
        padding: "7px 11px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12,
      }}
    >
      {item[0]}
    </span>
  );
}

export default function PersetujuanPesertaPage() {
  const router = useRouter();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);

  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState("approve");

  const [site, setSite] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace("/login");
        return;
      }

      // Verifikasi mentor di API server.
      const response = await fetch(
        "/api/mentor/registrations",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
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
        throw new Error("Akses hanya untuk mentor.");
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Gagal mengambil daftar pengajuan."
        );
      }

      setRegistrations(result.registrations || []);
    } catch (err) {
      setRegistrations([]);
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  function openDecision(item, nextAction) {
    if (processing || item.status !== "pending") return;

    setSelected(item);
    setAction(nextAction);
    setSite(SITES.includes(item.site) ? item.site : "");
    setStartDate(item.start_date || "");
    setEndDate(item.end_date || "");
    setRejectionReason("");
    setError("");
    setMessage("");
    setPreview(null);
  }

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing) return;

    const isNew = selected.source === "new";

    if (action === "approve") {
      if (!SITES.includes(site)) {
        setError("Site OJT tidak valid.");
        return;
      }

      if (!startDate || !endDate || endDate < startDate) {
        setError("Periode OJT tidak valid.");
        return;
      }
    }

    if (
      action === "reject" &&
      !isNew &&
      rejectionReason.trim().length < 5
    ) {
      setError("Alasan penolakan minimal 5 karakter.");
      return;
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

      if (sessionError || !session) {
        router.replace("/login");
        return;
      }

      let endpoint;
      let payload;

      if (isNew) {
        // API baru: SIMULASI saja.
        endpoint = "/api/mentor/review-registration";

        payload = {
          request_id: selected.id,
          decision:
            action === "approve" ? "approved" : "rejected",
          dry_run: true,
        };
      } else {
        // API lama: pengaman server harus false.
        endpoint = "/api/mentor/registrations/decision";

        payload = {
          registration_id: selected.id,
          action,
          ...(action === "approve"
            ? {
                site,
                start_date: startDate,
                end_date: endDate,
              }
            : {
                rejection_reason: rejectionReason.trim(),
              }),
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error || "Gagal memproses simulasi."
        );
      }

      // Wajib mendapat konfirmasi simulasi.
      if (result.dry_run !== true) {
        throw new Error(
          "Respons bukan simulasi. Periksa pengaman API."
        );
      }

      setMessage(
        result.message ||
          "Simulasi berhasil. Database tidak berubah."
      );
      setPreview(result.preview || null);
      setSelected(null);

      await loadRegistrations();
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setProcessing(false);
    }
  }

  const filtered = registrations.filter(
    (item) => filter === "all" || item.status === filter
  );

  const count = (value) =>
    registrations.filter((item) => item.status === value).length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 18,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 900, margin: "auto" }}>
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
          <p>PT Berau Coal 2026</p>
        </header>

        <section
          style={{
            ...CARD,
            background: "#eff6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <strong style={{ color: "#1d4ed8" }}>
            MODE SIMULASI AKTIF
          </strong>
          <p style={{ lineHeight: 1.6, marginBottom: 0 }}>
            Persetujuan dan penolakan saat ini hanya
            digunakan untuk pengujian. Tidak ada program
            OJT atau status pengajuan yang diubah.
          </p>
        </section>

        <section style={CARD}>
          <h2>Ringkasan Pendaftaran</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(130px, 1fr))",
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
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>
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
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                style={{
                  ...BUTTON,
                  background:
                    filter === value ? "#2563eb" : "#e2e8f0",
                  color:
                    filter === value ? "#ffffff" : "#334155",
                  padding: "9px 12px",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadRegistrations}
            disabled={loading || processing}
            style={{
              ...BUTTON,
              background: "#475569",
              marginBottom: 16,
            }}
          >
            {loading ? "Memuat..." : "↻ Perbarui Data"}
          </button>

          {loading && <p>Memuat daftar pengajuan...</p>}

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
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  marginBottom: 12,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>
                    {item.full_name || "Nama belum tersedia"}
                  </h3>

                  <span
                    style={{
                      background:
                        item.source === "new"
                          ? "#dbeafe"
                          : "#e2e8f0",
                      color:
                        item.source === "new"
                          ? "#1d4ed8"
                          : "#475569",
                      padding: "6px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {item.source === "new"
                      ? "Pendaftaran Baru"
                      : "Riwayat Lama"}
                  </span>
                </div>

                <p>Departemen: {item.department || "-"}</p>
                <p>
                  Site: <strong>{item.site || "-"}</strong>
                </p>

                {item.start_date && (
                  <p>
                    Periode OJT:{" "}
                    <strong>
                      {formatDate(item.start_date)} s.d.{" "}
                      {formatDate(item.end_date)}
                    </strong>
                  </p>
                )}

                <p>
                  Tanggal Pengajuan: {formatTime(item.created_at)}
                </p>

                <Status value={item.status} />

                {item.status === "rejected" &&
                  item.rejection_reason && (
                    <p>
                      Alasan: {item.rejection_reason}
                    </p>
                  )}

                {item.status === "pending" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
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
                        openDecision(item, "approve")
                      }
                    >
                      ✓ Uji Persetujuan
                    </button>

                    <button
                      type="button"
                      disabled={processing}
                      style={{
                        ...BUTTON,
                        background: "#dc2626",
                      }}
                      onClick={() =>
                        openDecision(item, "reject")
                      }
                    >
                      ✕ Uji Penolakan
                    </button>
                  </div>
                )}
              </div>
            ))}
        </section>

        {selected && (
          <section style={CARD}>
            <h2>
              {action === "approve"
                ? "Simulasi Persetujuan"
                : "Simulasi Penolakan"}
            </h2>

            <p>
              Peserta: <strong>{selected.full_name}</strong>
            </p>

            <form onSubmit={submitDecision}>
              {action === "approve" ? (
                selected.source === "new" ? (
                  <div
                    style={{
                      background: "#f0fdf4",
                      borderRadius: 10,
                      padding: 14,
                      marginBottom: 15,
                      lineHeight: 1.8,
                    }}
                  >
                    <strong>Data Pengajuan Peserta</strong>
                    <div>Site: {selected.site}</div>
                    <div>
                      Mulai: {formatDate(selected.start_date)}
                    </div>
                    <div>
                      Selesai: {formatDate(selected.end_date)}
                    </div>
                    <small>
                      Periode dan site mengikuti pengajuan peserta.
                    </small>
                  </div>
                ) : (
                  <>
                    <label>
                      Site OJT
                      <select
                        style={FIELD}
                        value={site}
                        onChange={(e) => setSite(e.target.value)}
                        required
                      >
                        <option value="">Pilih Site</option>
                        {SITES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Tanggal Mulai OJT
                      <input
                        type="date"
                        style={FIELD}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </label>

                    <label>
                      Tanggal Selesai OJT
                      <input
                        type="date"
                        style={FIELD}
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                      />
                    </label>
                  </>
                )
              ) : selected.source === "legacy" ? (
                <label>
                  Alasan Penolakan
                  <textarea
                    style={FIELD}
                    rows={4}
                    minLength={5}
                    required
                    value={rejectionReason}
                    onChange={(e) =>
                      setRejectionReason(e.target.value)
                    }
                    placeholder="Tuliskan alasan penolakan..."
                  />
                </label>
              ) : (
                <p style={{ color: "#64748b" }}>
                  Sistem baru belum menyimpan alasan penolakan.
                  Pengujian ini hanya memeriksa proses keputusan.
                </p>
              )}

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
                      action === "approve" ? "#16a34a" : "#dc2626",
                  }}
                >
                  {processing
                    ? "Menguji..."
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
            <h3>Hasil Simulasi</h3>
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
              borderColor: "#fca5a5",
              background: "#fff7f7",
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

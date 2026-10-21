
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const SITES = [
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

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
};

const button = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const field = {
  width: "100%",
  padding: 12,
  borderRadius: 9,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  boxSizing: "border-box",
  marginTop: 6,
  marginBottom: 12,
};

function formatDate(value) {
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
        background: item.background,
        color: item.color,
        padding: "7px 11px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12,
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

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Gagal mengambil daftar pendaftaran."
        );
      }

      setRegistrations(result.registrations || []);
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  function openDecision(item, nextAction) {
    setSelected(item);
    setAction(nextAction);

    // Isi Site dari data pendaftaran peserta.
    const registeredSite = SITES.includes(item.site)
      ? item.site
      : "";

    setSite(registeredSite);
    setStartDate("");
    setEndDate("");
    setRejectionReason("");
    setMessage("");
    setPreview(null);
    setError("");
  }

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing) return;

    if (action === "approve") {
      if (!SITES.includes(site)) {
        setError("Pilih Site OJT yang valid.");
        return;
      }

      if (!startDate || !endDate) {
        setError(
          "Tanggal mulai dan tanggal selesai wajib diisi."
        );
        return;
      }

      if (endDate < startDate) {
        setError(
          "Tanggal selesai tidak boleh sebelum tanggal mulai."
        );
        return;
      }
    }

    if (
      action === "reject" &&
      rejectionReason.trim().length < 5
    ) {
      setError(
        "Alasan penolakan minimal 5 karakter."
      );
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

      const payload = {
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

      const response = await fetch(
        "/api/mentor/registrations/decision",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Gagal menjalankan simulasi."
        );
      }

      setMessage(
        result.message || "Simulasi berhasil dijalankan."
      );

      setPreview(result.preview || null);

      // Mode simulasi: status database tidak berubah.
      await loadRegistrations();
    } catch (err) {
      setError(
        err.message || "Gagal menjalankan simulasi."
      );
    } finally {
      setProcessing(false);
    }
  }

  const filtered = registrations.filter(
    (item) =>
      filter === "all" || item.status === filter
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
            ...card,
            background: "#0f172a",
            color: "#ffffff",
          }}
        >
          <h1>Persetujuan Peserta OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
        </header>

        <section
          style={{
            ...card,
            background: "#fffbeb",
            borderColor: "#fcd34d",
          }}
        >
          <strong>MODE PENGUJIAN AKTIF</strong>
          <p>
            Persetujuan dan penolakan hanya disimulasikan.
            Data pendaftaran dan program OJT tidak diubah
            oleh proses simulasi ini.
          </p>
        </section>

        <section style={card}>
          <h2>Ringkasan Pendaftaran</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {[
              { label: "Menunggu", value: count("pending") },
              { label: "Disetujui", value: count("approved") },
              { label: "Ditolak", value: count("rejected") },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: 14,
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {item.label}
                </div>

                <div style={{ fontSize: 28, fontWeight: 800 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={card}>
          <h2>Daftar Pengajuan</h2>

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
                  ...button,
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
            style={{
              ...button,
              background: "#475569",
              marginBottom: 15,
            }}
            onClick={loadRegistrations}
            disabled={loading}
          >
            {loading ? "Memuat..." : "↻ Perbarui Data"}
          </button>

          {loading && <p>Memuat daftar pendaftaran...</p>}

          {!loading && filtered.length === 0 && (
            <p>Belum ada pengajuan pada kategori ini.</p>
          )}

          {!loading &&
            filtered.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 16,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  marginBottom: 12,
                  background: "#f8fafc",
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  {item.full_name || "Nama belum tersedia"}
                </h3>

                <p>Email: {item.email || "-"}</p>

                <p>
                  Departemen: {item.department || "-"}
                </p>

                <p>
                  Site pilihan peserta:{" "}
                  <strong>
                    {SITES.includes(item.site)
                      ? item.site
                      : "Belum tersedia"}
                  </strong>
                </p>

                <p>
                  Tanggal daftar: {formatDate(item.created_at)}
                </p>

                <Status value={item.status} />

                {item.status === "rejected" &&
                  item.rejection_reason && (
                    <p>
                      Alasan penolakan: {item.rejection_reason}
                    </p>
                  )}

                {item.status === "pending" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 14,
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        ...button,
                        background: "#16a34a",
                      }}
                      onClick={() => openDecision(item, "approve")}
                    >
                      ✓ Setujui
                    </button>

                    <button
                      type="button"
                      style={{
                        ...button,
                        background: "#dc2626",
                      }}
                      onClick={() => openDecision(item, "reject")}
                    >
                      ✕ Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
        </section>

        {selected && (
          <section style={card}>
            <h2>
              {action === "approve"
                ? "Simulasi Persetujuan"
                : "Simulasi Penolakan"}
            </h2>

            <p>
              Peserta: <strong>{selected.full_name}</strong>
            </p>

            {action === "approve" && (
              <p>
                Site dari pendaftaran:{" "}
                <strong>
                  {SITES.includes(selected.site)
                    ? selected.site
                    : "Belum tersedia"}
                </strong>
              </p>
            )}

            <form onSubmit={submitDecision}>
              {action === "approve" ? (
                <>
                  <label>
                    Site OJT
                    <select
                      style={field}
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
                      style={field}
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);

                        if (
                          endDate &&
                          e.target.value &&
                          endDate < e.target.value
                        ) {
                          setEndDate("");
                        }
                      }}
                      required
                    />
                  </label>

                  <label>
                    Tanggal Selesai OJT
                    <input
                      type="date"
                      style={field}
                      value={endDate}
                      min={startDate || undefined}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </label>
                </>
              ) : (
                <label>
                  Alasan Penolakan
                  <textarea
                    style={field}
                    rows={4}
                    value={rejectionReason}
                    onChange={(e) =>
                      setRejectionReason(e.target.value)
                    }
                    minLength={5}
                    required
                    placeholder="Tuliskan alasan penolakan..."
                  />
                </label>
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
                  style={{
                    ...button,
                    background:
                      action === "approve" ? "#16a34a" : "#dc2626",
                  }}
                  disabled={processing}
                >
                  {processing
                    ? "Memproses..."
                    : "Jalankan Simulasi"}
                </button>

                <button
                  type="button"
                  style={{
                    ...button,
                    background: "#64748b",
                  }}
                  onClick={() => {
                    setSelected(null);
                    setMessage("");
                    setPreview(null);
                    setError("");
                  }}
                  disabled={processing}
                >
                  Batal
                </button>
              </div>
            </form>
          </section>
        )}

        {message && (
          <section
            style={{
              ...card,
              background: "#f0fdf4",
              borderColor: "#86efac",
            }}
          >
            <h3>Hasil Simulasi</h3>
            <p>{message}</p>

            {preview && (
              <pre
                style={{
                  overflowX: "auto",
                  background: "#f8fafc",
                  padding: 12,
                  borderRadius: 9,
                  fontSize: 12,
                }}
              >
                {JSON.stringify(preview, null, 2)}
              </pre>
            )}
          </section>
        )}

        {error && (
          <section style={card}>
            <p style={{ color: "#dc2626" }}>{error}</p>
          </section>
        )}

        <button
          type="button"
          style={{
            ...button,
            background: "#475569",
          }}
          onClick={() => router.push("/")}
        >
          ← Kembali ke Dashboard Mentor
        </button>
      </div>
    </main>
  );
}

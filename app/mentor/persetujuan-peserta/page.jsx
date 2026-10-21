
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const FLAGS_URL = "/api/system/feature-flags";

const CARD = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
  boxSizing: "border-box",
};

const BUTTON = {
  padding: "12px 16px",
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 14,
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

  return date.toLocaleString("id-ID");
}

function statusLabel(value) {
  return {
    pending: "Menunggu Persetujuan",
    approved: "Disetujui",
    rejected: "Ditolak",
  }[value] || value || "-";
}

export default function PersetujuanPesertaPage() {
  const router = useRouter();

  const [features, setFeatures] = useState({
    approval_enabled: false,
    rejection_enabled: false,
  });

  const [flagsLoading, setFlagsLoading] =
    useState(true);

  const [registrations, setRegistrations] =
    useState([]);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] =
    useState(false);

  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] =
    useState("approved");
  const [reason, setReason] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);

  // Baca pengaturan dari Vercel.
  // Jika gagal, semua keputusan tetap simulasi.
  const loadFeatureFlags = useCallback(
    async () => {
      setFlagsLoading(true);

      const safeFlags = {
        approval_enabled: false,
        rejection_enabled: false,
      };

      try {
        const response = await fetch(FLAGS_URL, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            "Gagal membaca konfigurasi fitur."
          );
        }

        const result = await response.json();

        if (result?.success !== true) {
          throw new Error(
            "Konfigurasi fitur tidak valid."
          );
        }

        const nextFlags = {
          approval_enabled:
            result.features?.approval_enabled === true,
          rejection_enabled:
            result.features?.rejection_enabled === true,
        };

        setFeatures(nextFlags);
        return nextFlags;
      } catch (err) {
        console.error("Feature flags:", err);

        setFeatures(safeFlags);
        return safeFlags;
      } finally {
        setFlagsLoading(false);
      }
    },
    []
  );

  // Ambil seluruh pengajuan untuk mentor.
  const loadRegistrations = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
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
            "Akses hanya diperbolehkan untuk mentor."
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
          err.message || "Gagal membaca pengajuan."
        );
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    loadFeatureFlags();
    loadRegistrations();
  }, [loadFeatureFlags, loadRegistrations]);

  function decisionEnabled(type, currentFlags) {
    if (type === "approved") {
      return currentFlags.approval_enabled === true;
    }

    if (type === "rejected") {
      return currentFlags.rejection_enabled === true;
    }

    return false;
  }

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
    setError("");
    setMessage("");
    setPreview(null);
  }

  async function submitDecision(event) {
    event.preventDefault();

    if (
      !selected ||
      processing ||
      flagsLoading
    ) {
      return;
    }

    if (
      selected.source !== "new" ||
      selected.status !== "pending"
    ) {
      setError(
        "Pengajuan ini tidak dapat diproses."
      );
      return;
    }

    const cleanReason = reason.trim();

    if (
      decision === "rejected" &&
      (cleanReason.length < 5 ||
        cleanReason.length > 1000)
    ) {
      setError(
        "Alasan penolakan harus 5–1000 karakter."
      );
      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");
    setPreview(null);

    try {
      // Baca ulang status saat keputusan dilakukan.
      const latestFlags = await loadFeatureFlags();

      const enabled = decisionEnabled(
        decision,
        latestFlags
      );

      const dryRun = !enabled;

      if (!dryRun) {
        const action =
          decision === "approved"
            ? "MENYETUJUI"
            : "MENOLAK";

        const confirmed = window.confirm(
          `${action} pengajuan OJT?\n\n` +
            `Peserta: ${selected.full_name}\n` +
            `Site: ${selected.site}\n` +
            `Periode: ${formatDate(
              selected.start_date
            )} s.d. ${formatDate(
              selected.end_date
            )}\n` +
            (decision === "rejected"
              ? `Alasan: ${cleanReason}\n`
              : "") +
            "\nKeputusan ini akan disimpan ke database."
        );

        if (!confirmed) return;
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
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
            rejection_reason:
              decision === "rejected"
                ? cleanReason
                : null,
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
            "Keputusan gagal diproses."
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
          "Simulasi berhasil. Tidak ada perubahan database."
        );

        setPreview(result.preview || null);
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
          rejection_reason:
            decision === "rejected"
              ? cleanReason
              : null,
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

  const selectedEnabled = decisionEnabled(
    decision,
    features
  );

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
            STATUS FITUR MENTOR
          </strong>

          <p>
            Persetujuan:{" "}
            <strong>
              {flagsLoading
                ? "Memeriksa..."
                : features.approval_enabled
                ? "Aktif"
                : "Simulasi"}
            </strong>
          </p>

          <p>
            Penolakan:{" "}
            <strong>
              {flagsLoading
                ? "Memeriksa..."
                : features.rejection_enabled
                ? "Aktif"
                : "Simulasi"}
            </strong>
          </p>

          <p style={{ lineHeight: 1.7 }}>
            Semua mentor dapat memeriksa seluruh
            pengajuan OJT. Alasan penolakan wajib
            diisi. Keputusan nyata hanya dapat
            diproses apabila fitur diaktifkan
            pada server Vercel.
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
                  padding: 14,
                  borderRadius: 10,
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                  }}
                >
                  {label}
                </div>

                <strong
                  style={{
                    fontSize: 28,
                  }}
                >
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
            disabled={
              loading ||
              processing ||
              flagsLoading
            }
            style={{
              ...BUTTON,
              background: "#475569",
              marginBottom: 16,
            }}
            onClick={async () => {
              await Promise.all([
                loadRegistrations(),
                loadFeatureFlags(),
              ]);
            }}
          >
            {loading
              ? "Memuat..."
              : "Perbarui Data"}
          </button>

          {loading && <p>Memuat pengajuan...</p>}

          {!loading && filtered.length === 0 && (
            <p>
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
                <h3>
                  {item.full_name ||
                    "Nama belum tersedia"}
                </h3>

                <p>
                  Sumber:{" "}
                  {item.source === "new"
                    ? "Pengajuan Baru"
                    : "Riwayat Lama"}
                </p>

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
                    Periode:{" "}
                    {formatDate(item.start_date)}
                    {" s.d. "}
                    {formatDate(item.end_date)}
                  </p>
                )}

                <p>
                  Diajukan:{" "}
                  {formatTime(item.created_at)}
                </p>

                <p>
                  Status:{" "}
                  <strong>
                    {statusLabel(item.status)}
                  </strong>
                </p>

                {item.status === "rejected" && (
                  <p>
                    <strong>
                      Alasan Penolakan:
                    </strong>{" "}
                    {item.rejection_reason ||
                      "Belum tersedia"}
                  </p>
                )}

                {item.source === "new" &&
                  item.status === "pending" && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
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
                        {features.approval_enabled
                          ? "Setujui Pengajuan"
                          : "Uji Persetujuan"}
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
                        {features.rejection_enabled
                          ? "Tolak Pengajuan"
                          : "Uji Penolakan"}
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
              Peserta:{" "}
              <strong>
                {selected.full_name}
              </strong>
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
                  style={{
                    display: "block",
                  }}
                >
                  <strong>
                    Alasan Penolakan *
                  </strong>

                  <textarea
                    id="rejection_reason"
                    rows={4}
                    value={reason}
                    required
                    minLength={5}
                    maxLength={1000}
                    disabled={processing}
                    placeholder="Contoh: Periode OJT belum sesuai dengan jadwal pelaksanaan."
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    style={{
                      width: "100%",
                      marginTop: 8,
                      marginBottom: 16,
                      padding: 12,
                      boxSizing: "border-box",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius: 10,
                      fontSize: 16,
                      fontFamily: "inherit",
                    }}
                  />
                </label>
              )}

              <p
                style={{
                  color: "#64748b",
                  lineHeight: 1.7,
                }}
              >
                {flagsLoading
                  ? "Memeriksa status fitur..."
                  : selectedEnabled
                  ? "Keputusan ini akan disimpan ke database setelah dikonfirmasi."
                  : "Saat ini hanya simulasi. Database tidak akan berubah."}
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <button
                  type="submit"
                  disabled={
                    processing ||
                    flagsLoading
                  }
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
                    : flagsLoading
                    ? "Memeriksa..."
                    : selectedEnabled
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
                  onClick={() =>
                    setSelected(null)
                  }
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
            <h3>Hasil Proses</h3>
            <p>{message}</p>

            {preview && (
              <pre
                style={{
                  padding: 12,
                  background: "#ffffff",
                  borderRadius: 9,
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
              borderColor: "#fecaca",
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

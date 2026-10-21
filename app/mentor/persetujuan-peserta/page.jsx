
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TEST_PARTICIPANT_NAME = "Peserta OJT";
const TEST_SITE = "SMO";
const TEST_START = "2026-11-01";
const TEST_END = "2027-01-29";

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

function isTestRequest(item) {
  return (
    item?.source === "new" &&
    item?.status === "pending" &&
    item?.full_name === TEST_PARTICIPANT_NAME &&
    item?.site === TEST_SITE &&
    String(item?.start_date || "").slice(0, 10) ===
      TEST_START &&
    String(item?.end_date || "").slice(0, 10) ===
      TEST_END
  );
}

function Status({ value }) {
  const config = {
    pending: [
      "Menunggu Persetujuan",
      "#92400e",
      "#fef3c7",
    ],
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
  const [rejectionReason, setRejectionReason] =
    useState("");

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
          "Halaman ini hanya untuk mentor."
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
        err.message || "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  function openDecision(item, nextAction) {
    if (
      processing ||
      item.status !== "pending"
    ) {
      return;
    }

    setSelected(item);
    setAction(nextAction);

    setSite(
      SITES.includes(item.site) ? item.site : ""
    );

    setStartDate(
      String(item.start_date || "").slice(0, 10)
    );

    setEndDate(
      String(item.end_date || "").slice(0, 10)
    );

    setRejectionReason("");
    setError("");
    setMessage("");
    setPreview(null);
  }

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing) return;

    const isNew = selected.source === "new";

    // Hanya pengajuan baru Peserta OJT
    // yang boleh diproses secara nyata.
    const realApproval =
      action === "approve" &&
      isTestRequest(selected);

    if (action === "approve") {
      if (!SITES.includes(site)) {
        setError("Site OJT tidak valid.");
        return;
      }

      if (
        !startDate ||
        !endDate ||
        endDate < startDate
      ) {
        setError("Periode OJT tidak valid.");
        return;
      }
    }

    if (
      action === "reject" &&
      !isNew &&
      rejectionReason.trim().length < 5
    ) {
      setError(
        "Alasan penolakan minimal 5 karakter."
      );
      return;
    }

    if (realApproval) {
      const confirmed = window.confirm(
        "SETUJUI PENGAJUAN OJT?\n\n" +
          "Peserta: " +
          selected.full_name +
          "\n" +
          "Site: " +
          selected.site +
          "\n" +
          "Mulai: " +
          formatDate(selected.start_date) +
          "\n" +
          "Selesai: " +
          formatDate(selected.end_date) +
          "\n\n" +
          "Jika disetujui, sistem akan membuat " +
          "program OJT aktif dan menetapkan " +
          "akun mentor yang menyetujui.\n\n" +
          "Lanjutkan?"
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

      if (
        sessionError ||
        !session?.access_token
      ) {
        router.replace("/login");
        return;
      }

      let endpoint;
      let payload;

      if (isNew) {
        endpoint =
          "/api/mentor/review-registration";

        payload = {
          request_id: selected.id,
          decision:
            action === "approve"
              ? "approved"
              : "rejected",
          dry_run: !realApproval,
        };
      } else {
        // Pendaftaran lama tetap simulasi.
        endpoint =
          "/api/mentor/registrations/decision";

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
                rejection_reason:
                  rejectionReason.trim(),
              }),
        };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
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
          result.error ||
            "Gagal memproses pengajuan."
        );
      }

      if (realApproval) {
        if (
          result.success !== true ||
          result.dry_run !== false ||
          result.status !== "approved" ||
          !result.program_id
        ) {
          throw new Error(
            "Hasil persetujuan belum dapat " +
              "dipastikan. Periksa database " +
              "sebelum mencoba lagi."
          );
        }

        setMessage(
          "Pengajuan Peserta OJT berhasil " +
            "disetujui. Program OJT aktif " +
            "telah dibuat."
        );

        setPreview({
          registration_id:
            result.registration_id,
          status: result.status,
          program_id: result.program_id,
        });
      } else {
        if (result.dry_run !== true) {
          throw new Error(
            "Respons tidak sesuai dengan " +
              "mode simulasi."
          );
        }

        setMessage(
          result.message ||
            "Simulasi berhasil. " +
              "Database tidak berubah."
        );

        setPreview(result.preview || null);
      }

      setSelected(null);

      await loadRegistrations();

      if (realApproval) {
        setFilter("approved");
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

  const count = (value) =>
    registrations.filter(
      (item) => item.status === value
    ).length;

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
          <p>PT Berau Coal 2026</p>
        </header>

        <section
          style={{
            ...CARD,
            background: "#eff6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <strong
            style={{ color: "#1d4ed8" }}
          >
            MODE PENGUJIAN TERBATAS
          </strong>

          <p
            style={{
              lineHeight: 1.7,
              marginBottom: 0,
            }}
          >
            Persetujuan nyata hanya tersedia
            untuk pengajuan baru Peserta OJT
            yang sesuai data pengujian.
            Pengajuan lain dan penolakan
            tetap menggunakan simulasi.
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
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: 14,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "#64748b",
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
                onClick={() =>
                  setFilter(value)
                }
                style={{
                  ...BUTTON,
                  background:
                    filter === value
                      ? "#2563eb"
                      : "#e2e8f0",
                  color:
                    filter === value
                      ? "#ffffff"
                      : "#334155",
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
            {loading
              ? "Memuat..."
              : "↻ Perbarui Data"}
          </button>

          {loading && (
            <p>Memuat daftar pengajuan...</p>
          )}

          {!loading &&
            filtered.length === 0 && (
              <p
                style={{
                  color: "#64748b",
                }}
              >
                Belum ada pengajuan pada
                kategori ini.
              </p>
            )}

          {!loading &&
            filtered.map((item) => {
              const realEligible =
                isTestRequest(item);

              return (
                <div
                  key={`${item.source}-${item.id}`}
                  style={{
                    padding: 16,
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: 12,
                    marginBottom: 12,
                    background: "#f8fafc",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                      }}
                    >
                      {item.full_name ||
                        "Nama belum tersedia"}
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
                        {formatDate(
                          item.start_date
                        )}{" "}
                        s.d.{" "}
                        {formatDate(
                          item.end_date
                        )}
                      </strong>
                    </p>
                  )}

                  <p>
                    Tanggal Pengajuan:{" "}
                    {formatTime(
                      item.created_at
                    )}
                  </p>

                  <Status value={item.status} />

                  {item.status ===
                    "rejected" &&
                    item.rejection_reason && (
                      <p>
                        Alasan:{" "}
                        {item.rejection_reason}
                      </p>
                    )}

                  {item.status ===
                    "pending" && (
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
                            background:
                              "#16a34a",
                          }}
                          onClick={() =>
                            openDecision(
                              item,
                              "approve"
                            )
                          }
                        >
                          {realEligible
                            ? "✓ Setujui Pengajuan"
                            : "✓ Uji Persetujuan"}
                        </button>

                        <button
                          type="button"
                          disabled={processing}
                          style={{
                            ...BUTTON,
                            background:
                              "#dc2626",
                          }}
                          onClick={() =>
                            openDecision(
                              item,
                              "reject"
                            )
                          }
                        >
                          ✕ Uji Penolakan
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
        </section>

        {selected && (
          <section style={CARD}>
            <h2>
              {action === "approve"
                ? isTestRequest(selected)
                  ? "Konfirmasi Persetujuan OJT"
                  : "Simulasi Persetujuan"
                : "Simulasi Penolakan"}
            </h2>

            <p>
              Peserta:{" "}
              <strong>
                {selected.full_name}
              </strong>
            </p>

            {action === "approve" &&
              isTestRequest(selected) && (
                <div
                  style={{
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 15,
                    lineHeight: 1.7,
                  }}
                >
                  <strong>
                    Persetujuan Sungguhan
                  </strong>

                  <p
                    style={{
                      marginBottom: 0,
                    }}
                  >
                    Jika dikonfirmasi,
                    sistem akan mengubah
                    pengajuan menjadi approved
                    dan membuat program OJT
                    aktif dengan mentor
                    yang menyetujui.
                  </p>
                </div>
              )}

            <form onSubmit={submitDecision}>
              {action === "approve" ? (
                selected.source === "new" ? (
                  <div
                    style={{
                      background: "#f0fdf4",
                      padding: 14,
                      borderRadius: 10,
                      marginBottom: 15,
                      lineHeight: 1.8,
                    }}
                  >
                    <strong>
                      Data Pengajuan Peserta
                    </strong>

                    <div>
                      Site: {selected.site}
                    </div>

                    <div>
                      Mulai:{" "}
                      {formatDate(
                        selected.start_date
                      )}
                    </div>

                    <div>
                      Selesai:{" "}
                      {formatDate(
                        selected.end_date
                      )}
                    </div>

                    <small>
                      Site dan periode
                      mengikuti data
                      pengajuan peserta.
                    </small>
                  </div>
                ) : (
                  <>
                    <label>
                      Site OJT
                      <select
                        style={FIELD}
                        value={site}
                        required
                        onChange={(e) =>
                          setSite(
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Pilih Site
                        </option>

                        {SITES.map((value) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Tanggal Mulai
                      <input
                        type="date"
                        style={FIELD}
                        value={startDate}
                        required
                        onChange={(e) =>
                          setStartDate(
                            e.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Tanggal Selesai
                      <input
                        type="date"
                        style={FIELD}
                        value={endDate}
                        min={
                          startDate ||
                          undefined
                        }
                        required
                        onChange={(e) =>
                          setEndDate(
                            e.target.value
                          )
                        }
                      />
                    </label>
                  </>
                )
              ) : selected.source ===
                "legacy" ? (
                <label>
                  Alasan Penolakan
                  <textarea
                    style={FIELD}
                    rows={4}
                    minLength={5}
                    required
                    value={rejectionReason}
                    onChange={(e) =>
                      setRejectionReason(
                        e.target.value
                      )
                    }
                    placeholder="Tuliskan alasan penolakan..."
                  />
                </label>
              ) : (
                <p
                  style={{
                    color: "#64748b",
                  }}
                >
                  Penolakan sistem baru
                  saat ini masih simulasi.
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
                      action === "approve"
                        ? "#16a34a"
                        : "#dc2626",
                  }}
                >
                  {processing
                    ? "Memproses..."
                    : action === "approve" &&
                      isTestRequest(
                        selected
                      )
                    ? "Konfirmasi Persetujuan"
                    : "Jalankan Simulasi"}
                </button>

                <button
                  type="button"
                  disabled={processing}
                  style={{
                    ...BUTTON,
                    background:
                      "#64748b",
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
            <h3>
              Hasil Proses Pengajuan
            </h3>

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
          onClick={() =>
            router.push("/")
          }
        >
          ← Kembali ke Dashboard
        </button>
      </div>
    </main>
  );
}

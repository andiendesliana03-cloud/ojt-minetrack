
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const GENERAL_SUBMISSION_ENABLED = false;

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO",
];

const CARD = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  marginBottom: 16,
};

const FIELD = {
  width: "100%",
  padding: 12,
  marginTop: 7,
  marginBottom: 18,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  background: "#fff",
  color: "#0f172a",
  fontSize: 16,
  boxSizing: "border-box",
};

const BUTTON = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function formatDate(value) {
  if (!value) return "-";

  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function statusLabel(value) {
  return {
    pending: "Menunggu Persetujuan Mentor",
    approved: "Disetujui",
    rejected: "Ditolak",
  }[value] || value || "-";
}

export default function PengajuanPesertaPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [source, setSource] = useState("");
  const [history, setHistory] = useState([]);

  const [site, setSite] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      const {
        data: currentProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id,full_name,role,department")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (currentProfile?.role === "mentor") {
        router.replace("/");
        return;
      }

      if (
        !currentProfile ||
        currentProfile.role !== "participant"
      ) {
        throw new Error(
          "Profil peserta tidak valid. Hubungi administrator."
        );
      }

      setProfile(currentProfile);

      if (!currentUser.email_confirmed_at) {
        throw new Error(
          "Email belum terverifikasi."
        );
      }

      const {
        data: activeProgram,
        error: programError,
      } = await supabase
        .from("ojt_programs")
        .select("id")
        .eq("participant_id", currentUser.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (programError) throw programError;

      if (activeProgram) {
        router.replace("/dashboard-peserta");
        return;
      }

      const {
        data: newRequests,
        error: newError,
      } = await supabase
        .from("ojt_registration_requests")
        .select(
          "id,department,site,start_date,end_date,status,rejection_reason,created_at"
        )
        .eq("participant_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (newError) throw newError;

      const {
        data: legacy,
        error: legacyError,
      } = await supabase
        .from("participant_registrations")
        .select("id,site,status,created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (legacyError) throw legacyError;

      const requests = newRequests || [];
      setHistory(requests);

      // Semua riwayat baru tetap terbaca.
      // Pengajuan terbaru ditampilkan paling atas.
      if (legacy) {
        setRegistration(legacy);
        setSource("legacy");
      } else {
        setRegistration(requests[0] || null);
        setSource(requests.length ? "new" : "");
      }

      const latest = requests[0] || null;
      const metadata = currentUser.user_metadata || {};

      const initialSite = String(
        latest?.site || metadata.site || ""
      ).trim().toUpperCase();

      setSite(
        SITES.includes(initialSite) ? initialSite : ""
      );

      setStartDate(
        String(
          latest?.start_date ||
          metadata.start_date ||
          ""
        ).slice(0, 10)
      );

      setEndDate(
        String(
          latest?.end_date ||
          metadata.end_date ||
          ""
        ).slice(0, 10)
      );
    } catch (err) {
      setError(
        err.message || "Gagal membaca data pengajuan."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasPending = history.some(
    (item) => item.status === "pending"
  );

  const hasApproved = history.some(
    (item) => item.status === "approved"
  );

  const canSubmit =
    !!profile &&
    !!user?.email_confirmed_at &&
    !hasPending &&
    !hasApproved &&
    source !== "legacy" &&
    (!registration || registration.status === "rejected");

  async function handleSubmission(event) {
    event.preventDefault();

    if (!canSubmit || processing) return;

    setError("");
    setMessage("");
    setPreview(null);

    if (!SITES.includes(site)) {
      setError("Pilih site OJT yang valid.");
      return;
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      endDate < startDate
    ) {
      setError("Periode OJT tidak valid.");
      return;
    }

    // Tetap simulasi selama API umum belum dibuka.
    const dryRun = !GENERAL_SUBMISSION_ENABLED;

    if (!dryRun) {
      const confirmed = window.confirm(
        "Kirim pengajuan OJT?\n\n" +
        "Site: " + site + "\n" +
        "Mulai: " + formatDate(startDate) + "\n" +
        "Selesai: " + formatDate(endDate)
      );

      if (!confirmed) return;
    }

    setProcessing(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Sesi login berakhir. Silakan login kembali."
        );
      }

      const response = await fetch(
        "/api/participant/registration",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            full_name: profile.full_name,
            department: "ER & SS",
            site,
            start_date: startDate,
            end_date: endDate,
            dry_run: dryRun,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Pengajuan gagal diproses."
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
          "Simulasi berhasil. Data belum disimpan ke Supabase."
        );

        setPreview(result.preview || null);
      } else {
        if (
          result.success !== true ||
          result.dry_run !== false ||
          result.status !== "pending" ||
          !result.request_id
        ) {
          throw new Error(
            "Penyimpanan belum dapat dipastikan. " +
            "Periksa status sebelum mengirim ulang."
          );
        }

        setMessage(
          "Pengajuan berhasil dikirim dan menunggu mentor."
        );

        await loadData();
      }
    } catch (err) {
      setError(
        err.message || "Terjadi kesalahan pengajuan."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#0f172a",
        padding: "24px 15px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 650, margin: "auto" }}>
        <header
          style={{
            ...CARD,
            background: "#0f172a",
            color: "#fff",
            textAlign: "center",
          }}
        >
          <h1>Pengajuan Peserta OJT</h1>
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
            MODE PERSIAPAN PENDAFTARAN UMUM
          </strong>
          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
            Peserta dapat memeriksa status, alasan
            penolakan, dan memperbaiki pengajuan.
            Pengiriman nyata belum diaktifkan.
          </p>
        </section>

        {loading ? (
          <section style={CARD}>
            Memuat data peserta...
          </section>
        ) : (
          <>
            <section style={CARD}>
              <h2>Informasi Peserta</h2>
              <p>
                <strong>Nama:</strong>{" "}
                {profile?.full_name || "-"}
              </p>
              <p>
                <strong>Email:</strong>{" "}
                {user?.email || "-"}
              </p>
              <p>
                <strong>Departemen:</strong>{" "}
                {profile?.department || "ER & SS"}
              </p>
              <p>
                <strong>Status Email:</strong>{" "}
                {user?.email_confirmed_at
                  ? "Terverifikasi"
                  : "Belum Terverifikasi"}
              </p>
            </section>

            {registration && (
              <section style={CARD}>
                <h2>Status Pengajuan Terakhir</h2>

                <div
                  style={{
                    background:
                      registration.status === "approved"
                        ? "#dcfce7"
                        : registration.status === "pending"
                        ? "#fef3c7"
                        : "#fee2e2",
                    padding: 14,
                    borderRadius: 10,
                    fontWeight: 700,
                    marginBottom: 16,
                  }}
                >
                  {statusLabel(registration.status)}
                </div>

                <p>
                  <strong>Site:</strong>{" "}
                  {registration.site || "-"}
                </p>

                {registration.start_date && (
                  <p>
                    <strong>Periode:</strong>{" "}
                    {formatDate(registration.start_date)}
                    {" s.d. "}
                    {formatDate(registration.end_date)}
                  </p>
                )}

                {registration.status === "rejected" && (
                  <div
                    style={{
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      borderRadius: 10,
                      padding: 14,
                      marginTop: 14,
                    }}
                  >
                    <strong>Alasan Penolakan Mentor</strong>
                    <p style={{ lineHeight: 1.7 }}>
                      {registration.rejection_reason ||
                        "Alasan penolakan belum tersedia."}
                    </p>
                    <p style={{ marginBottom: 0 }}>
                      Silakan perbaiki site atau periode OJT,
                      kemudian ajukan kembali ketika
                      pendaftaran dibuka.
                    </p>
                  </div>
                )}
              </section>
            )}

            {canSubmit && (
              <section style={CARD}>
                <h2>
                  {registration?.status === "rejected"
                    ? "Perbaikan dan Pengajuan Ulang OJT"
                    : "Formulir Pengajuan OJT"}
                </h2>

                <form onSubmit={handleSubmission}>
                  <label htmlFor="site">
                    <strong>Site OJT</strong>
                  </label>
                  <select
                    id="site"
                    style={FIELD}
                    value={site}
                    disabled={processing}
                    required
                    onChange={(event) =>
                      setSite(event.target.value)
                    }
                  >
                    <option value="">Pilih Site</option>
                    {SITES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="startDate">
                    <strong>Tanggal Mulai</strong>
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    style={FIELD}
                    value={startDate}
                    disabled={processing}
                    required
                    onChange={(event) => {
                      const value = event.target.value;
                      setStartDate(value);
                      if (endDate && endDate < value) {
                        setEndDate("");
                      }
                    }}
                  />

                  <label htmlFor="endDate">
                    <strong>Tanggal Selesai</strong>
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    style={FIELD}
                    min={startDate || undefined}
                    value={endDate}
                    disabled={processing}
                    required
                    onChange={(event) =>
                      setEndDate(event.target.value)
                    }
                  />

                  <button
                    type="submit"
                    style={{
                      ...BUTTON,
                      background: processing
                        ? "#94a3b8"
                        : "#2563eb",
                    }}
                    disabled={processing}
                  >
                    {processing
                      ? "Memproses..."
                      : GENERAL_SUBMISSION_ENABLED
                      ? "Kirim Pengajuan OJT"
                      : "Jalankan Simulasi Pengajuan"}
                  </button>
                </form>
              </section>
            )}

            {history.length > 1 && (
              <section style={CARD}>
                <h2>Riwayat Pengajuan</h2>

                {history.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 12,
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      marginBottom: 10,
                    }}
                  >
                    <strong>
                      Pengajuan {history.length - index}
                    </strong>
                    <p>
                      Status: {statusLabel(item.status)}
                    </p>
                    <p>Site: {item.site}</p>
                    <p>
                      Periode: {formatDate(item.start_date)}
                      {" s.d. "}
                      {formatDate(item.end_date)}
                    </p>

                    {item.status === "rejected" && (
                      <p>
                        Alasan:{" "}
                        {item.rejection_reason ||
                          "Belum tersedia"}
                      </p>
                    )}
                  </div>
                ))}
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
                <strong>{message}</strong>

                {preview && (
                  <div style={{ marginTop: 12 }}>
                    <p>Site: {preview.site}</p>
                    <p>
                      Mulai: {formatDate(preview.start_date)}
                    </p>
                    <p>
                      Selesai: {formatDate(preview.end_date)}
                    </p>
                    <p>
                      Riwayat penolakan:{" "}
                      {preview.jumlah_riwayat_penolakan || 0}
                    </p>
                  </div>
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
                background: "#0f766e",
                marginBottom: 12,
              }}
              disabled={processing}
              onClick={loadData}
            >
              Perbarui Status
            </button>

            <button
              type="button"
              style={{
                ...BUTTON,
                background: "#475569",
              }}
              onClick={logout}
            >
              Keluar Akun
            </button>
          </>
        )}
      </div>
    </main>
  );
}

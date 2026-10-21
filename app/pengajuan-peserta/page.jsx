
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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
  background: "#ffffff",
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
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(value + "T00:00:00Z");

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function formatDate(value) {
  if (!value) return "-";

  const parts = String(value)
    .slice(0, 10)
    .split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function statusLabel(status) {
  const labels = {
    pending: "Menunggu Persetujuan Mentor",
    approved: "Disetujui",
    rejected: "Ditolak",
  };

  return labels[status] || status || "-";
}

export default function PengajuanPesertaPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [registrationSource, setRegistrationSource] =
    useState("");

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
        .select(
          "id,full_name,role,department"
        )
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
          "Profil peserta belum tersedia atau tidak valid."
        );
      }

      setProfile(currentProfile);

      if (!currentUser.email_confirmed_at) {
        throw new Error(
          "Email belum terverifikasi. Periksa email terlebih dahulu."
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
        data: newRegistration,
        error: newError,
      } = await supabase
        .from("ojt_registration_requests")
        .select(
          "id,department,site,start_date,end_date,status,created_at"
        )
        .eq("participant_id", currentUser.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (newError) throw newError;

      const {
        data: oldRegistration,
        error: oldError,
      } = await supabase
        .from("participant_registrations")
        .select(
          "id,site,status,created_at"
        )
        .eq("user_id", currentUser.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (oldError) throw oldError;

      if (oldRegistration) {
        setRegistration(oldRegistration);
        setRegistrationSource("legacy");
      } else if (newRegistration) {
        setRegistration(newRegistration);
        setRegistrationSource("new");
      } else {
        setRegistration(null);
        setRegistrationSource("");
      }

      const metadata =
        currentUser.user_metadata || {};

      const initialSite = String(
        newRegistration?.site ||
        oldRegistration?.site ||
        metadata.site ||
        ""
      )
        .trim()
        .toUpperCase();

      setSite(
        SITES.includes(initialSite)
          ? initialSite
          : ""
      );

      setStartDate(
        String(
          newRegistration?.start_date ||
          metadata.start_date ||
          ""
        ).slice(0, 10)
      );

      setEndDate(
        String(
          newRegistration?.end_date ||
          metadata.end_date ||
          ""
        ).slice(0, 10)
      );
    } catch (err) {
      setError(
        err.message ||
        "Gagal memuat data pengajuan."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function simulateSubmission(event) {
    event.preventDefault();

    if (
      processing ||
      loading ||
      registration ||
      !profile
    ) {
      return;
    }

    setError("");
    setMessage("");
    setPreview(null);

    if (!SITES.includes(site)) {
      setError("Silakan pilih site OJT.");
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

    setProcessing(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session?.access_token
      ) {
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
            dry_run: true,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Simulasi pengajuan gagal."
        );
      }

      if (
        result.success !== true ||
        result.dry_run !== true ||
        result.database_changed !== false
      ) {
        throw new Error(
          "Respons server tidak sesuai dengan mode simulasi."
        );
      }

      setPreview(result.preview || null);

      setMessage(
        "Validasi pengajuan berhasil. Data belum disimpan dan belum dikirim kepada mentor."
      );
    } catch (err) {
      setError(
        err.message ||
        "Terjadi kesalahan simulasi."
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
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 650,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...CARD,
            background: "#0f172a",
            color: "#ffffff",
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
          <strong
            style={{
              color: "#1d4ed8",
            }}
          >
            MODE PERSIAPAN PENDAFTARAN UMUM
          </strong>

          <p
            style={{
              lineHeight: 1.7,
              marginBottom: 0,
            }}
          >
            Formulir tersedia untuk seluruh
            akun peserta yang memenuhi syarat.
            Pengajuan sebenarnya belum
            diaktifkan. Tombol di bawah
            digunakan untuk pemeriksaan
            data tanpa menyimpan pengajuan.
          </p>
        </section>

        {loading ? (
          <section style={CARD}>
            Memeriksa akun dan pengajuan...
          </section>
        ) : (
          <>
            {error && (
              <section
                role="alert"
                style={{
                  ...CARD,
                  background: "#fef2f2",
                  borderColor: "#fecaca",
                  color: "#991b1b",
                }}
              >
                {error}
              </section>
            )}

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

            {registration ? (
              <section style={CARD}>
                <h2>Status Pengajuan OJT</h2>

                <div
                  style={{
                    padding: 15,
                    borderRadius: 10,
                    background:
                      registration.status === "pending"
                        ? "#fef3c7"
                        : registration.status === "approved"
                        ? "#dcfce7"
                        : "#fee2e2",
                    fontWeight: 700,
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
                    {formatDate(
                      registration.start_date
                    )}{" "}
                    s.d.{" "}
                    {formatDate(
                      registration.end_date
                    )}
                  </p>
                )}

                <p
                  style={{
                    color: "#64748b",
                  }}
                >
                  Sumber:{" "}
                  {registrationSource === "legacy"
                    ? "Pendaftaran lama"
                    : "Pengajuan sistem baru"}
                </p>

                <p>
                  Pengajuan sudah tercatat.
                  Tidak perlu melakukan
                  pengajuan ulang.
                </p>
              </section>
            ) : profile &&
              user?.email_confirmed_at ? (
              <section style={CARD}>
                <h2>Formulir Pengajuan OJT</h2>

                <p
                  style={{
                    color: "#64748b",
                    lineHeight: 1.6,
                  }}
                >
                  Lengkapi rencana penempatan
                  dan periode OJT.
                </p>

                <form onSubmit={simulateSubmission}>
                  <label htmlFor="site">
                    <strong>Site Penempatan</strong>
                  </label>

                  <select
                    id="site"
                    style={FIELD}
                    value={site}
                    required
                    disabled={processing}
                    onChange={(e) =>
                      setSite(e.target.value)
                    }
                  >
                    <option value="">
                      -- Pilih Site --
                    </option>

                    {SITES.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="start_date">
                    <strong>Tanggal Mulai OJT</strong>
                  </label>

                  <input
                    id="start_date"
                    type="date"
                    style={FIELD}
                    value={startDate}
                    required
                    disabled={processing}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStartDate(value);

                      if (
                        endDate &&
                        endDate < value
                      ) {
                        setEndDate("");
                      }
                    }}
                  />

                  <label htmlFor="end_date">
                    <strong>Tanggal Selesai OJT</strong>
                  </label>

                  <input
                    id="end_date"
                    type="date"
                    style={FIELD}
                    value={endDate}
                    min={startDate || undefined}
                    required
                    disabled={processing}
                    onChange={(e) =>
                      setEndDate(e.target.value)
                    }
                  />

                  <button
                    type="submit"
                    disabled={processing}
                    style={{
                      ...BUTTON,
                      background: processing
                        ? "#94a3b8"
                        : "#2563eb",
                    }}
                  >
                    {processing
                      ? "Memeriksa Pengajuan..."
                      : "Jalankan Simulasi Pengajuan"}
                  </button>
                </form>
              </section>
            ) : null}

            {message && (
              <section
                role="status"
                style={{
                  ...CARD,
                  background: "#f0fdf4",
                  borderColor: "#86efac",
                }}
              >
                <h3
                  style={{
                    color: "#166534",
                  }}
                >
                  Validasi Berhasil
                </h3>

                <p>{message}</p>

                {preview && (
                  <div
                    style={{
                      lineHeight: 1.8,
                    }}
                  >
                    <p>
                      Nama: {preview.full_name}
                    </p>

                    <p>
                      Site: {preview.site}
                    </p>

                    <p>
                      Mulai:{" "}
                      {formatDate(
                        preview.start_date
                      )}
                    </p>

                    <p>
                      Selesai:{" "}
                      {formatDate(
                        preview.end_date
                      )}
                    </p>

                    <strong>
                      Database tidak berubah.
                    </strong>
                  </div>
                )}
              </section>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={processing}
              style={{
                ...BUTTON,
                background: "#0f766e",
                marginBottom: 12,
              }}
            >
              Perbarui Status
            </button>

            <button
              type="button"
              onClick={logout}
              style={{
                ...BUTTON,
                background: "#475569",
              }}
            >
              Keluar Akun
            </button>
          </>
        )}
      </div>
    </main>
  );
}

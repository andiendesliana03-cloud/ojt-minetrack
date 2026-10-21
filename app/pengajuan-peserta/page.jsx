
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO",
];

const CARD = {
  background: "#ffffff",
  padding: 20,
  borderRadius: 15,
  border: "1px solid #e2e8f0",
  marginBottom: 16,
  boxSizing: "border-box",
};

const FIELD = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 16,
  boxSizing: "border-box",
};

const BUTTON = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "none",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function formatDate(value) {
  if (!value) return "-";

  const parts = value.slice(0, 10).split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value;
}

function StatusBox({ status }) {
  const options = {
    pending: {
      label: "Menunggu Persetujuan Mentor",
      message:
        "Pengajuan sudah tersimpan dan sedang menunggu pemeriksaan mentor.",
      background: "#fef3c7",
      color: "#92400e",
    },
    approved: {
      label: "Pengajuan Disetujui",
      message:
        "Pengajuan telah disetujui. Akses monitoring mengikuti program OJT yang tersedia.",
      background: "#dcfce7",
      color: "#166534",
    },
    rejected: {
      label: "Pengajuan Ditolak",
      message:
        "Pengajuan belum disetujui. Hubungi mentor untuk informasi selanjutnya.",
      background: "#fee2e2",
      color: "#991b1b",
    },
  };

  const config = options[status];

  if (!config) return null;

  return (
    <div
      style={{
        background: config.background,
        color: config.color,
        borderRadius: 12,
        padding: 17,
        marginBottom: 15,
      }}
    >
      <strong>{config.label}</strong>
      <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
        {config.message}
      </p>
    </div>
  );
}

export default function PengajuanPesertaPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [source, setSource] = useState("");

  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("ER & SS");
  const [site, setSite] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Periksa sesi login.
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      // Periksa profil.
      const {
        data: userProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id,full_name,role,department,site")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (userProfile?.role === "mentor") {
        router.replace("/");
        return;
      }

      if (
        userProfile &&
        userProfile.role !== "participant"
      ) {
        throw new Error(
          "Role akun tidak dikenali. Hubungi administrator."
        );
      }

      setProfile(userProfile || null);

      const metadata = currentUser.user_metadata || {};

      const name =
        userProfile?.full_name ||
        metadata.full_name ||
        metadata.name ||
        "";

      setFullName(name);
      setDepartment("ER & SS");

      const initialSite =
        userProfile?.site || metadata.site || "";

      const normalizedSite = String(initialSite)
        .trim()
        .toUpperCase();

      setSite(
        SITES.includes(normalizedSite)
          ? normalizedSite
          : ""
      );

      // Periksa apakah program sudah aktif.
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

      // Periksa pengajuan baru.
      const {
        data: newRegistration,
        error: newError,
      } = await supabase
        .from("ojt_registration_requests")
        .select(
          "id,department,site,start_date,end_date,status,created_at"
        )
        .eq("participant_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newError) throw newError;

      // Periksa pengajuan sistem lama.
      const {
        data: legacyRegistration,
        error: legacyError,
      } = await supabase
        .from("participant_registrations")
        .select(
          "id,full_name,department,site,status,rejection_reason,created_at"
        )
        .eq("user_id", currentUser.id)
        .limit(1)
        .maybeSingle();

      if (legacyError) throw legacyError;

      // Riwayat lama diprioritaskan untuk
      // mencegah pengajuan berulang.
      if (legacyRegistration) {
        setRegistration(legacyRegistration);
        setSource("legacy");
      } else if (newRegistration) {
        setRegistration(newRegistration);
        setSource("new");
      } else {
        setRegistration(null);
        setSource("");
      }
    } catch (err) {
      setError(
        err.message ||
          "Gagal memeriksa status pengajuan."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function validateForm() {
    if (
      fullName.trim().length < 3 ||
      fullName.trim().length > 120
    ) {
      return "Nama lengkap harus 3–120 karakter.";
    }

    if (department !== "ER & SS") {
      return "Departemen harus ER & SS.";
    }

    if (!SITES.includes(site)) {
      return "Pilih site OJT yang valid.";
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate)
    ) {
      return "Tanggal mulai dan selesai wajib diisi dengan benar.";
    }

    if (endDate < startDate) {
      return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    }

    return "";
  }

  async function simulateRegistration(event) {
    event.preventDefault();

    if (testing || loading || registration) return;

    setError("");
    setMessage("");
    setPreview(null);

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user?.email_confirmed_at) {
      setError(
        "Email belum diverifikasi. Periksa email terlebih dahulu."
      );
      return;
    }

    if (!profile) {
      setError(
        "Profil peserta belum tersedia. Hubungi administrator."
      );
      return;
    }

    setTesting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Sesi login tidak tersedia. Silakan login kembali."
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
            full_name: fullName.trim(),
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
        result.dry_run !== true
      ) {
        throw new Error(
          "Server tidak mengonfirmasi mode simulasi."
        );
      }

      setPreview(result.preview || null);

      setMessage(
        "Simulasi pengajuan berhasil. Data belum disimpan dan belum dikirim kepada mentor."
      );
    } catch (err) {
      setError(
        err.message || "Gagal menjalankan simulasi."
      );
    } finally {
      setTesting(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "25px 16px",
        background: "#f1f5f9",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
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

          <p style={{ lineHeight: 1.7, marginBottom: 0 }}>
            Pengajuan baru belum dapat disimpan.
            Simulasi digunakan untuk memeriksa
            validasi akun dan data OJT sebelum
            pendaftaran asli diaktifkan.
          </p>
        </section>

        {loading ? (
          <section style={CARD}>
            Memeriksa akun dan status pengajuan...
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
                {fullName || "Belum tersedia"}
              </p>

              <p>
                <strong>Email:</strong>{" "}
                {user?.email || "-"}
              </p>

              <p>
                <strong>Departemen:</strong> ER & SS
              </p>

              <p>
                <strong>Verifikasi Email:</strong>{" "}
                {user?.email_confirmed_at
                  ? "Terverifikasi"
                  : "Belum diverifikasi"}
              </p>
            </section>

            {registration ? (
              <section style={CARD}>
                <h2>Status Pengajuan OJT</h2>

                <StatusBox status={registration.status} />

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

                <p>
                  <strong>Sumber:</strong>{" "}
                  {source === "legacy"
                    ? "Riwayat pendaftaran lama"
                    : "Pengajuan sistem baru"}
                </p>

                {registration.status === "rejected" &&
                  registration.rejection_reason && (
                    <p>
                      <strong>Alasan Penolakan:</strong>{" "}
                      {registration.rejection_reason}
                    </p>
                  )}

                <p style={{ color: "#64748b" }}>
                  Akun ini sudah mempunyai pengajuan.
                  Pengajuan baru tidak dibuat otomatis.
                </p>
              </section>
            ) : (
              <section style={CARD}>
                <h2>Formulir Pengajuan OJT</h2>

                <p
                  style={{
                    color: "#64748b",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Lengkapi informasi OJT untuk
                  menjalankan simulasi pengajuan.
                </p>

                <form onSubmit={simulateRegistration}>
                  <label htmlFor="full_name">
                    <strong>Nama Lengkap</strong>
                  </label>

                  <input
                    id="full_name"
                    type="text"
                    style={FIELD}
                    value={fullName}
                    minLength={3}
                    maxLength={120}
                    required
                    disabled={testing}
                    onChange={(e) =>
                      setFullName(e.target.value)
                    }
                  />

                  <div style={{ height: 17 }} />

                  <label htmlFor="department">
                    <strong>Departemen</strong>
                  </label>

                  <input
                    id="department"
                    type="text"
                    style={{
                      ...FIELD,
                      background: "#f1f5f9",
                    }}
                    value={department}
                    readOnly
                  />

                  <div style={{ height: 17 }} />

                  <label htmlFor="site">
                    <strong>Site Penempatan OJT</strong>
                  </label>

                  <select
                    id="site"
                    style={FIELD}
                    value={site}
                    required
                    disabled={testing}
                    onChange={(e) => setSite(e.target.value)}
                  >
                    <option value="">
                      -- Pilih Site --
                    </option>

                    {SITES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>

                  <h3 style={{ marginTop: 24 }}>
                    Periode Program OJT
                  </h3>

                  <label htmlFor="start_date">
                    <strong>Tanggal Mulai</strong>
                  </label>

                  <input
                    id="start_date"
                    type="date"
                    style={FIELD}
                    value={startDate}
                    required
                    disabled={testing}
                    onChange={(e) => {
                      const value = e.target.value;
                      setStartDate(value);

                      if (endDate && endDate < value) {
                        setEndDate("");
                      }
                    }}
                  />

                  <div style={{ height: 17 }} />

                  <label htmlFor="end_date">
                    <strong>Tanggal Selesai</strong>
                  </label>

                  <input
                    id="end_date"
                    type="date"
                    style={FIELD}
                    value={endDate}
                    min={startDate || undefined}
                    required
                    disabled={testing}
                    onChange={(e) =>
                      setEndDate(e.target.value)
                    }
                  />

                  <button
                    type="submit"
                    disabled={testing || !profile || !user?.email_confirmed_at}
                    style={{
                      ...BUTTON,
                      marginTop: 24,
                      background:
                        testing || !profile || !user?.email_confirmed_at
                          ? "#94a3b8"
                          : "#2563eb",
                    }}
                  >
                    {testing
                      ? "Memeriksa Pengajuan..."
                      : "Jalankan Simulasi Pengajuan"}
                  </button>
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
                <h3 style={{ color: "#166534" }}>
                  Simulasi Berhasil
                </h3>

                <p>{message}</p>

                {preview && (
                  <div style={{ lineHeight: 1.8 }}>
                    <p>Nama: {preview.full_name}</p>
                    <p>Site: {preview.site}</p>
                    <p>
                      Mulai: {formatDate(preview.start_date)}
                    </p>
                    <p>
                      Selesai: {formatDate(preview.end_date)}
                    </p>
                    <p>Status Rencana: Menunggu Mentor</p>

                    <strong>
                      Tidak ada perubahan database.
                    </strong>
                  </div>
                )}
              </section>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={loading || testing}
              style={{
                ...BUTTON,
                background: "#0f766e",
                marginBottom: 12,
              }}
            >
              ↻ Perbarui Status
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

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// MENU MONITORING PENILAIAN — GLOBAL LIGHT / DARK MODE
//
// - Tema mengikuti html[data-theme]
// - Tidak menambahkan tombol tema
// - Seluruh menu dan navigasi dipertahankan
// - Hak akses dan kebijakan RLS dipertahankan
// - Nama lengkap akun login ditampilkan
// - Responsif desktop dan mobile
// =====================================================

const MENUS = [
  {
    name: "Fisik",
    icon: "🏃",
    desc: "Jarak lari dan riwayat kegiatan",
    path: "fisik",
    target: "25 km/minggu",
  },
  {
    name: "Samapta",
    icon: "🏋️",
    desc: "Hasil tes kesamaptaan",
    path: "samapta",
    target: "3 periode tes",
  },
  {
    name: "Internal Training",
    icon: "🎓",
    desc: "Pelatihan dan materi",
    path: "training",
    target: "4 kegiatan/minggu",
  },
  {
    name: "Coaching",
    icon: "👥",
    desc: "Pembinaan oleh mentor",
    path: "coaching",
    target: "1 kegiatan/minggu",
  },
  {
    name: "Sosialisasi",
    icon: "📣",
    desc: "Riwayat kegiatan sosialisasi",
    path: "sosialisasi",
    target: "3 kegiatan/minggu",
  },
  {
    name: "Orientasi Area",
    icon: "🗺️",
    desc: "Pengenalan area kerja",
    path: "orientasi-area",
    target: "2 kegiatan/minggu",
  },
  {
    name: "Hazard",
    icon: "⚠️",
    desc: "Identifikasi bahaya",
    path: "hazard",
    target: "2 kegiatan/minggu",
  },
  {
    name: "Teori",
    icon: "📚",
    desc: "Nilai pembelajaran",
    path: "teori",
    target: "Sesuai jadwal",
  },
  {
    name: "Praktik",
    icon: "📝",
    desc: "Nilai praktik mingguan",
    path: "praktik",
    target: "Sesuai jadwal",
  },
  {
    name: "SIMPER",
    icon: "🪪",
    desc: "Status dan validasi SIMPER",
    path: "simper",
    target: "Validasi tahapan",
  },
];

export default function MonitoringPage() {
  const router = useRouter();
  const params = useParams();

  const id = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [program, setProgram] = useState(null);
  const [role, setRole] = useState("");
  const [account, setAccount] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setProgram(null);
      setRole("");
      setAccount(null);

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth?.user) {
          router.replace("/login");
          return;
        }

        const userId = auth.user.id;

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("role,full_name")
            .eq("id", userId)
            .single();

        if (profileError) throw profileError;

        const currentRole = String(profile?.role || "")
          .trim()
          .toLowerCase();

        const isAdmin = currentRole === "admin";
        const isMentor = currentRole === "mentor";

        const isParticipant = [
          "participant",
          "peserta",
        ].includes(currentRole);

        if (!isAdmin && !isMentor && !isParticipant) {
          throw new Error(
            "Akun tidak memiliki akses monitoring."
          );
        }

        if (active) {
          setAccount(profile);
          setRole(currentRole);
        }

        // Konsep hak akses OJT MineTrack:
        //
        // Admin:
        // - Dapat mengakses seluruh program.
        // - Tetap memiliki akses saat maintenance ON.
        //
        // Mentor:
        // - Dapat mengakses seluruh program.
        // - Tidak dibatasi berdasarkan mentor_id.
        // - Diblokir oleh RLS saat maintenance ON.
        //
        // Peserta:
        // - Hanya dapat mengakses program sendiri.
        // - Diblokir oleh RLS saat maintenance ON.

        let query = supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            mentor_id,
            site,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", id);

        // Hanya Peserta yang dibatasi berdasarkan
        // participant_id. Admin dan Mentor mengikuti
        // akses seluruh program yang diizinkan RLS.

        if (isParticipant) {
          query = query.eq("participant_id", userId);
        }

        const { data, error: queryError } =
          await query.maybeSingle();

        if (queryError) throw queryError;

        if (!data) {
          throw new Error(
            "Program OJT tidak ditemukan atau Anda tidak memiliki akses."
          );
        }

        if (active) {
          setProgram(data);
        }
      } catch (err) {
        if (active) {
          setProgram(null);
          setError(
            err?.message || "Gagal memuat monitoring."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (id) {
      load();
    } else {
      setProgram(null);
      setAccount(null);
      setRole("");
      setError("ID program tidak ditemukan.");
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [id, router]);

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const isParticipant = [
    "participant",
    "peserta",
  ].includes(role);

  const roleLabel =
    role === "admin"
      ? "Administrator"
      : role === "mentor"
      ? "Mentor OJT"
      : isParticipant
      ? "Peserta OJT"
      : "";

  function openMenu(menu) {
    if (!id || !menu?.path || !program) {
      return;
    }

    const destination =
      `/monitoring/${encodeURIComponent(id)}/${menu.path}`;

    router.push(destination);
  }

  function goBack() {
    if (isParticipant) {
      router.push("/dashboard-peserta");
    } else {
      router.push(`/peserta/${id}`);
    }
  }

  return (
    <main className="mp-root">
      <style>{STYLES}</style>

      {/* HEADER */}

      <header className="mp-header">
        <div className="mp-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="mp-header-actions">
          {account && (
            <div className="mp-account">
              <small>{roleLabel}</small>
              <strong>
                {account.full_name || "Pengguna"}
              </strong>
            </div>
          )}

          <button
            type="button"
            className="mp-back"
            onClick={goBack}
          >
            ← Kembali
          </button>
        </div>
      </header>

      <div className="mp-container">
        {/* PAGE TITLE */}

        <div className="mp-heading">
          <span className="mp-eyebrow">
            PROGRAM OJT · MONITORING PESERTA
          </span>

          <h1 className="mp-title">
            Monitoring Penilaian OJT
          </h1>

          <p className="mp-subtitle">
            Pilih kategori untuk melihat pencapaian
            dan riwayat kegiatan peserta.
          </p>
        </div>

        {/* LOADING */}

        {loading ? (
          <section
            className="mp-state"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="mp-state-icon"
              aria-hidden="true"
            >
              📊
            </div>

            <h2>Memuat Monitoring</h2>
            <p>Memuat data peserta...</p>
          </section>
        ) : error ? (
          /* ERROR */

          <div className="mp-error" role="alert">
            <strong>Monitoring tidak dapat ditampilkan</strong>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* PARTICIPANT PROFILE */}

            <section
              className="mp-profile"
              aria-label="Informasi peserta"
            >
              <div className="mp-profile-person">
                <div
                  className="mp-profile-icon"
                  aria-hidden="true"
                >
                  👤
                </div>

                <div>
                  <small>Peserta OJT</small>

                  <strong>
                    {peserta?.full_name || "Peserta OJT"}
                  </strong>

                  <p>
                    Departemen:{" "}
                    {peserta?.department || "—"}
                  </p>
                </div>
              </div>

              <div className="mp-profile-site">
                <small>Site OJT</small>
                <strong>{program?.site || "—"}</strong>
              </div>
            </section>

            {/* MONITORING MENUS */}

            <div className="mp-menu-heading">
              <h2>Kategori Monitoring</h2>
              <span>{MENUS.length} menu</span>
            </div>

            <div className="mp-grid">
              {MENUS.map((menu) => (
                <button
                  type="button"
                  key={menu.path}
                  className="mp-card"
                  onClick={() => openMenu(menu)}
                >
                  <div className="mp-card-top">
                    <span
                      className="mp-icon"
                      aria-hidden="true"
                    >
                      {menu.icon}
                    </span>

                    <span
                      className="mp-arrow"
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  </div>

                  <div className="mp-name">
                    {menu.name}
                  </div>

                  <div className="mp-desc">
                    {menu.desc}
                  </div>

                  <div className="mp-target">
                    {menu.target}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <footer className="mp-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// CSS — GLOBAL LIGHT / DARK MODE
// Prefix mp- digunakan khusus halaman menu monitoring.
// =====================================================

const STYLES = `
  /* LIGHT MODE — DEFAULT */

  .mp-root {
    color-scheme: light;

    --mp-bg: #f0f5f4;
    --mp-surface: #ffffff;
    --mp-surface-hover: #f8fcfa;

    --mp-text: #163145;
    --mp-heading: #173249;
    --mp-muted: #586f7d;
    --mp-muted-soft: #647b87;

    --mp-border: #d8e4e7;
    --mp-accent: #0b7852;
    --mp-accent-border: #1d9467;
    --mp-focus: #237fc0;

    --mp-header-bg: #07313a;
    --mp-header-text: #ffffff;
    --mp-header-muted: #c3ded6;
    --mp-brand-accent: #3bc78e;

    --mp-back-bg: #e1f2e9;
    --mp-back-text: #0a694d;
    --mp-back-hover: #ccebdc;

    --mp-icon-bg: #e6f5ed;
    --mp-arrow: #647d89;

    --mp-target-bg: #e8f6ee;
    --mp-target-text: #0b7852;

    --mp-error-bg: #fff0f0;
    --mp-error-border: #f2b9b9;
    --mp-error-text: #a32635;

    --mp-shadow: 0 4px 16px rgba(15, 57, 43, .035);
    --mp-hover-shadow: 0 8px 22px rgba(15, 57, 43, .08);
  }

  /* DARK MODE — ROOTLAYOUT */

  html[data-theme="dark"] .mp-root {
    color-scheme: dark;

    --mp-bg: #0b171c;
    --mp-surface: #15272e;
    --mp-surface-hover: #1a3137;

    --mp-text: #e5f2ec;
    --mp-heading: #edf8f2;
    --mp-muted: #adc3b9;
    --mp-muted-soft: #9eb7ad;

    --mp-border: #30483f;
    --mp-accent: #7ae3b7;
    --mp-accent-border: #44c997;
    --mp-focus: #88caff;

    --mp-header-bg: #071e25;
    --mp-header-text: #eff9f4;
    --mp-header-muted: #b9d6c9;
    --mp-brand-accent: #5bdeb0;

    --mp-back-bg: #234638;
    --mp-back-text: #bcf5d8;
    --mp-back-hover: #2c5945;

    --mp-icon-bg: #234638;
    --mp-arrow: #a3c5b5;

    --mp-target-bg: #214333;
    --mp-target-text: #9aecc3;

    --mp-error-bg: #40242c;
    --mp-error-border: #7a424d;
    --mp-error-text: #ffc3cb;

    --mp-shadow: 0 4px 16px rgba(0, 0, 0, .14);
    --mp-hover-shadow: 0 8px 22px rgba(0, 0, 0, .22);
  }

  /* BASE */

  .mp-root,
  .mp-root * {
    box-sizing: border-box;
  }

  .mp-root {
    min-height: 100vh;
    background: var(--mp-bg);
    color: var(--mp-text);
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.5;
  }

  .mp-root button {
    font-family: inherit;
    touch-action: manipulation;
    cursor: pointer;
  }

  .mp-root button:focus-visible {
    outline: 3px solid var(--mp-focus);
    outline-offset: 4px;
  }

  /* HEADER */

  .mp-header {
    background: var(--mp-header-bg);
    color: var(--mp-header-text);
    padding: 18px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .mp-brand {
    font-size: 23px;
    font-weight: 900;
    white-space: nowrap;
  }

  .mp-brand span {
    color: var(--mp-brand-accent);
  }

  .mp-brand > small {
    margin-left: 6px;
    font-size: 10px;
    color: var(--mp-header-muted);
  }

  .mp-header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .mp-account {
    min-width: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .mp-account small,
  .mp-account strong {
    display: block;
  }

  .mp-account small {
    color: var(--mp-header-muted);
    font-size: 10px;
    margin-bottom: 4px;
  }

  .mp-account strong {
    color: var(--mp-header-text);
    font-size: 12px;
    line-height: 1.5;
  }

  .mp-back {
    flex-shrink: 0;
    background: var(--mp-back-bg);
    color: var(--mp-back-text);
    border: 1px solid transparent;
    border-radius: 9px;
    padding: 11px 14px;
    font-size: 12px;
    font-weight: 800;
  }

  /* CONTAINER / TITLE */

  .mp-container {
    width: 100%;
    max-width: 1100px;
    margin: auto;
    padding: 20px;
  }

  .mp-heading {
    margin-bottom: 18px;
  }

  .mp-eyebrow {
    display: block;
    margin-bottom: 8px;
    color: var(--mp-accent);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .8px;
  }

  .mp-title {
    color: var(--mp-heading);
    font-size: 25px;
    line-height: 1.3;
    margin: 0 0 8px;
  }

  .mp-subtitle {
    color: var(--mp-muted);
    font-size: 13px;
    line-height: 1.65;
    margin: 0;
  }

  /* PARTICIPANT PROFILE */

  .mp-profile {
    background: var(--mp-surface);
    border: 1px solid var(--mp-border);
    border-radius: 14px;
    padding: 18px;
    margin-bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    box-shadow: var(--mp-shadow);
  }

  .mp-profile-person {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1 1 260px;
  }

  .mp-profile-person > div:last-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .mp-profile-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 12px;
    background: var(--mp-icon-bg);
    font-size: 24px;
  }

  .mp-profile small {
    display: block;
    color: var(--mp-muted-soft);
    font-size: 10px;
    margin-bottom: 4px;
  }

  .mp-profile strong {
    display: block;
    color: var(--mp-heading);
    font-size: 18px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .mp-profile p {
    margin: 6px 0 0;
    color: var(--mp-muted);
    font-size: 12px;
  }

  .mp-profile-site {
    min-width: 100px;
    max-width: 100%;
    text-align: right;
  }

  /* MENU HEADING */

  .mp-menu-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .mp-menu-heading h2 {
    color: var(--mp-heading);
    font-size: 16px;
    margin: 0;
  }

  .mp-menu-heading > span {
    color: var(--mp-muted);
    font-size: 11px;
    white-space: nowrap;
  }

  /* MENU GRID */

  .mp-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 13px;
  }

  .mp-card {
    min-width: 0;
    text-align: left;
    background: var(--mp-surface);
    border: 1px solid var(--mp-border);
    border-radius: 15px;
    padding: 17px;
    color: var(--mp-heading);
    box-shadow: var(--mp-shadow);
    transition:
      transform .15s ease,
      border-color .15s ease,
      box-shadow .15s ease;
  }

  .mp-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 15px;
  }

  .mp-icon {
    background: var(--mp-icon-bg);
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-size: 25px;
  }

  .mp-arrow {
    font-size: 25px;
    color: var(--mp-arrow);
    line-height: 1;
  }

  .mp-name {
    color: var(--mp-heading);
    font-size: 16px;
    font-weight: 800;
    line-height: 1.4;
    margin-bottom: 7px;
    overflow-wrap: anywhere;
  }

  .mp-desc {
    color: var(--mp-muted);
    font-size: 12px;
    line-height: 1.5;
    min-height: 36px;
    overflow-wrap: anywhere;
  }

  .mp-target {
    display: inline-block;
    max-width: 100%;
    background: var(--mp-target-bg);
    color: var(--mp-target-text);
    border-radius: 7px;
    padding: 6px 9px;
    font-size: 11px;
    font-weight: 800;
    line-height: 1.5;
    margin-top: 12px;
    overflow-wrap: anywhere;
  }

  /* LOADING STATE */

  .mp-state {
    padding: 38px 20px;
    border: 1px solid var(--mp-border);
    border-radius: 14px;
    background: var(--mp-surface);
    color: var(--mp-text);
    text-align: center;
    box-shadow: var(--mp-shadow);
  }

  .mp-state-icon {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    margin: 0 auto 15px;
    border-radius: 15px;
    background: var(--mp-icon-bg);
    font-size: 27px;
  }

  .mp-state h2 {
    margin: 0 0 8px;
    color: var(--mp-heading);
    font-size: 19px;
  }

  .mp-state p {
    color: var(--mp-muted);
    font-size: 13px;
    margin: 0;
  }

  /* ERROR */

  .mp-error {
    background: var(--mp-error-bg);
    border: 1px solid var(--mp-error-border);
    border-radius: 10px;
    color: var(--mp-error-text);
    padding: 16px;
    overflow-wrap: anywhere;
  }

  .mp-error strong {
    display: block;
    color: var(--mp-error-text);
    font-size: 14px;
  }

  .mp-error p {
    color: var(--mp-error-text);
    margin: 7px 0 0;
    font-size: 12px;
    line-height: 1.7;
  }

  /* FOOTER */

  .mp-footer {
    padding: 24px 0 10px;
    color: var(--mp-muted-soft);
    text-align: center;
    font-size: 10px;
    line-height: 1.7;
  }

  /* HOVER */

  @media (hover: hover) {
    .mp-card:hover {
      transform: translateY(-2px);
      background: var(--mp-surface-hover);
      border-color: var(--mp-accent-border);
      box-shadow: var(--mp-hover-shadow);
    }

    .mp-card:hover .mp-arrow {
      color: var(--mp-accent);
    }

    .mp-back:hover {
      background: var(--mp-back-hover);
    }
  }

  /* TABLET / MOBILE */

  @media (max-width: 760px) {
    .mp-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mp-container {
      padding: 12px;
    }

    .mp-header {
      padding: 14px 12px;
    }

    .mp-header-actions {
      gap: 10px;
    }

    .mp-account {
      max-width: 160px;
    }

    .mp-card {
      padding: 12px;
    }

    .mp-icon {
      width: 42px;
      height: 42px;
      font-size: 23px;
    }

    .mp-name {
      font-size: 14px;
    }

    .mp-title {
      font-size: 21px;
    }

    .mp-brand {
      font-size: 19px;
    }

    .mp-back {
      padding: 10px 11px;
      font-size: 11px;
    }

    .mp-profile {
      padding: 15px;
    }

    .mp-profile strong {
      font-size: 16px;
    }
  }

  @media (max-width: 540px) {
    .mp-header {
      flex-wrap: wrap;
      gap: 12px;
    }

    .mp-header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .mp-account {
      max-width: calc(100% - 100px);
      text-align: left;
    }

    .mp-profile-person {
      flex-basis: 100%;
    }

    .mp-profile-site {
      width: 100%;
      padding-top: 12px;
      border-top: 1px solid var(--mp-border);
      text-align: left;
    }

    .mp-profile-site strong {
      font-size: 14px;
    }

    .mp-desc {
      font-size: 11px;
    }

    .mp-target {
      padding: 6px 7px;
      font-size: 10px;
    }
  }

  @media (max-width: 360px) {
    .mp-grid {
      grid-template-columns: 1fr;
    }

    .mp-desc {
      min-height: 0;
    }
  }

  /* REDUCED MOTION */

  @media (prefers-reduced-motion: reduce) {
    .mp-card {
      transition: none;
    }

    .mp-card:hover {
      transform: none;
    }
  }
`;

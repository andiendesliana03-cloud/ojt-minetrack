"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const BACKGROUND_IMAGE = "/background-erg.png.PNG";
const TOTAL_WEEKS = 25;

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function initials(name) {
  return String(name || "Peserta")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function statusLabel(value) {
  return (
    {
      active: "Aktif",
      approved: "Disetujui",
      pending: "Menunggu",
      rejected: "Ditolak",
      completed: "Selesai",
      cancelled: "Dibatalkan",
    }[String(value || "").toLowerCase()] ||
    value ||
    "—"
  );
}

function statusTone(value) {
  const key = String(value || "").toLowerCase();

  if (key === "active" || key === "approved") return "green";
  if (key === "pending") return "amber";
  if (key === "rejected" || key === "cancelled") return "rose";
  return "blue";
}

function Icon({ name, size = 18 }) {
  const paths = {
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19h16" />
        <path d="M7 15l3-3 3 2 4-6" />
        <path d="M17 8h0" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    file: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v12h14V9M9 21v-7h6v7" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="5" width="14" height="16" rx="2" />
        <rect x="9" y="3" width="6" height="5" rx="1" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.check}
    </svg>
  );
}

function SectionHeading({ icon, title, description }) {
  return (
    <div className="pp-section-title">
      <div className="pp-heading-icon">
        <Icon name={icon} size={21} />
      </div>

      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`pp-status ${statusTone(status)}`}>
      <Icon
        name={
          statusTone(status) === "green"
            ? "check"
            : statusTone(status) === "amber"
            ? "calendar"
            : "file"
        }
        size={13}
      />
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({ icon, label, value, tone }) {
  return (
    <div className={`pp-summary-card ${tone}`}>
      <div className="pp-summary-icon">
        <Icon name={icon} size={22} />
      </div>

      <div className="pp-summary-content">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function QuickCard({
  icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      className="pp-quick-card"
      onClick={onClick}
    >
      <div className="pp-quick-icon">
        <Icon name={icon} size={21} />
      </div>

      <div className="pp-quick-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </div>

      <Icon name="arrow" size={16} />
    </button>
  );
}

export default function DashboardPesertaPage() {
  const router = useRouter();

  const [mobileMenu, setMobileMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);

  const [error, setError] = useState("");

  async function loadDashboard() {
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,full_name,role,department")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profileData) {
      throw new Error("Profil peserta tidak ditemukan.");
    }

    if (profileData.role !== "participant") {
      throw new Error("Halaman ini hanya untuk peserta.");
    }

    const { data: programData, error: programError } =
      await supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          mentor_id,
          start_date,
          end_date,
          status,
          site,
          created_at
        `)
        .eq("participant_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (programError) throw programError;

    setProfile(profileData);
    setProgram(programData || null);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        if (!active) return;
        setLoading(true);
        await loadDashboard();
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memuat dashboard peserta."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [router]);

  async function refreshData() {
    if (loading || refreshing) return;

    try {
      setRefreshing(true);
      await loadDashboard();
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data peserta."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const programStatus = String(program?.status || "").toLowerCase();
  const isActive =
    programStatus === "active" || programStatus === "approved";

  const totalCategories = 6;
  const totalSimper = 3;
  const totalWeeks = 25;

  const stats = useMemo(() => {
    return {
      site: program?.site || "—",
      status: statusLabel(program?.status || "pending"),
      period: program?.start_date && program?.end_date
        ? `${formatDate(program.start_date)} – ${formatDate(program.end_date)}`
        : "Belum tersedia",
      weekProgress: program?.start_date && program?.end_date ? `${totalWeeks}` : "0",
      categories: `0/${totalCategories}`,
      simper: `0/${totalSimper}`,
    };
  }, [program]);

  return (
    <div className="pp-app">
      <style>{css}</style>

      <header className="pp-topbar">
        <button
          type="button"
          className="pp-brand"
          onClick={() => router.push("/")}
        >
          <span className="pp-brand-symbol">
            <Icon name="shield" size={22} />
          </span>

          <span className="pp-brand-copy">
            <strong>
              OJT <em>MineTrack</em>
              <small>v2.0</small>
            </strong>
            <span>ON THE JOB TRAINING MANAGEMENT SYSTEM</span>
          </span>
        </button>

        <nav className={"pp-nav " + (mobileMenu ? "open" : "")}>
          <button type="button" className="active">
            <Icon name="home" size={17} />
            Dashboard
          </button>

          <button
            type="button"
            onClick={() => router.push("/peserta/grafik-perkembangan")}
          >
            <Icon name="chart" size={17} />
            Grafik
          </button>

          <button
            type="button"
            onClick={() => router.push("/peserta/evaluasi-kesiapan")}
          >
            <Icon name="check" size={17} />
            Evaluasi
          </button>

          <button
            type="button"
            onClick={() => router.push("/peserta/laporan-ojt")}
          >
            <Icon name="file" size={17} />
            Laporan
          </button>
        </nav>

        <div className="pp-account">
          <div className="pp-account-avatar">
            {initials(profile?.full_name || "Peserta")}
          </div>

          <div className="pp-account-info">
            <strong>{profile?.full_name || "Peserta OJT"}</strong>
            <small>Peserta OJT</small>
          </div>
        </div>

        <button
          type="button"
          className="pp-mobile-toggle"
          onClick={() => setMobileMenu((value) => !value)}
          aria-label="Buka menu"
        >
          <Icon name="menu" size={22} />
        </button>
      </header>

      <main className="pp-container">
        <section
          className="pp-hero"
          style={{
            backgroundImage: `
              linear-gradient(
                100deg,
                rgba(4,22,43,.97) 0%,
                rgba(5,34,57,.86) 45%,
                rgba(5,35,54,.48) 100%
              ),
              url("${BACKGROUND_IMAGE}")
            `,
          }}
        >
          <div className="pp-hero-content">
            <div className="pp-kicker">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Dashboard <span>Peserta OJT</span>
            </h1>

            <p>
              Pantau status program, periode OJT, dan perkembangan pembelajaran
              Anda dalam satu dashboard yang selaras dengan sistem mentor.
            </p>

            <div className="pp-hero-tags">
              <span>
                <Icon name="user" size={15} />
                Akses Peserta
              </span>

              <span>
                <Icon name="calendar" size={15} />
                Monitoring Week 01–25
              </span>

              <span>
                <Icon name="check" size={15} />
                Progress OJT
              </span>
            </div>
          </div>

          <div className="pp-hero-summary">
            <span className="pp-hero-summary-icon">
              <Icon name="clipboard" size={25} />
            </span>

            <small>STATUS PROGRAM</small>
            <strong>{isActive ? "Aktif" : "Belum Aktif"}</strong>
            <span>
              {program?.site ? `Site ${program.site}` : "Menunggu data program"}
            </span>
          </div>
        </section>

        {error ? (
          <div className="pp-alert error">
            <Icon name="file" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <section className="pp-summary-grid">
          <SummaryCard
            icon="calendar"
            label="Periode OJT"
            value={
              program?.start_date && program?.end_date
                ? `${formatDate(program.start_date)}`
                : "Belum ada"
            }
            tone="amber"
          />

          <SummaryCard
            icon="shield"
            label="Status Program"
            value={statusLabel(program?.status || "pending")}
            tone="green"
          />

          <SummaryCard
            icon="user"
            label="Site Penempatan"
            value={program?.site || "Belum ada"}
            tone="blue"
          />

          <SummaryCard
            icon="chart"
            label="Progress Mingguan"
            value={`${0}/${TOTAL_WEEKS}`}
            tone="teal"
          />
        </section>

        <div className="pp-bottom-grid">
          <section className="pp-card">
            <SectionHeading
              icon="clipboard"
              title="Informasi Program OJT"
              description="Data program aktif peserta berdasarkan sistem."
            />

            {loading ? (
              <div className="pp-empty">
                <strong>Memuat data program...</strong>
              </div>
            ) : (
              <>
                <div className="pp-info-grid">
                  <div className="pp-info-box">
                    <span>Site</span>
                    <strong>{stats.site}</strong>
                  </div>

                  <div className="pp-info-box">
                    <span>Status</span>
                    <strong>{stats.status}</strong>
                  </div>
                </div>

                <div className="pp-period-box">
                  <span>Periode OJT</span>
                  <strong>{stats.period}</strong>
                </div>

                <div className="pp-status-row">
                  <span>Status Program</span>
                  <StatusBadge status={program?.status || "pending"} />
                </div>
              </>
            )}
          </section>

          <section className="pp-card">
            <SectionHeading
              icon="chart"
              title="Ringkasan Perkembangan OJT"
              description="Progress berdasarkan aktivitas dan target peserta."
            />

            <div className="pp-progress-group">
              <div className="pp-progress-head">
                <span>Progres Achievement</span>
                <strong>0%</strong>
              </div>
              <div className="pp-progress-bar">
                <div style={{ width: "0%" }} />
              </div>
              <small>0 dari {totalCategories} kategori mencapai target.</small>
            </div>

            <div className="pp-progress-group">
              <div className="pp-progress-head">
                <span>Aktivitas Mingguan</span>
                <strong>0%</strong>
              </div>
              <div className="pp-progress-bar">
                <div style={{ width: "0%" }} />
              </div>
              <small>0 dari {totalWeeks} minggu memiliki catatan aktivitas.</small>
            </div>

            <div className="pp-progress-group">
              <div className="pp-progress-head">
                <span>Progres SIMPER</span>
                <strong>0%</strong>
              </div>
              <div className="pp-progress-bar">
                <div style={{ width: "0%" }} />
              </div>
              <small>0 dari {totalSimper} persyaratan SIMPER terpenuhi.</small>
            </div>

            <div className="pp-simper-box">
              <strong>Status Penerbitan SIMPER:</strong> Belum Terbit
            </div>
          </section>
        </div>

        <section className="pp-card">
          <SectionHeading
            icon="file"
            title="Perkembangan OJT Saya"
            description="Pilih menu untuk melihat perkembangan dan evaluasi OJT."
          />

          <div className="pp-quick-grid">
            <QuickCard
              icon="chart"
              title="Grafik Perkembangan"
              description="Lihat grafik perkembangan OJT."
              onClick={() => router.push("/peserta/grafik-perkembangan")}
            />

            <QuickCard
              icon="check"
              title="Evaluasi Kesiapan"
              description="Buka evaluasi kesiapan OJT."
              onClick={() => router.push("/peserta/evaluasi-kesiapan")}
            />

            <QuickCard
              icon="file"
              title="Laporan OJT"
              description="Lihat laporan OJT Anda."
              onClick={() => router.push("/peserta/laporan-ojt")}
            />
          </div>
        </section>

        <div className="pp-action-stack">
          <button
            type="button"
            className="pp-primary-action"
            onClick={refreshData}
            disabled={loading || refreshing}
          >
            <Icon name="refresh" size={18} />
            {refreshing ? "Memperbarui..." : "Perbarui Status"}
          </button>

          <button
            type="button"
            className="pp-secondary-action"
            onClick={handleLogout}
          >
            <Icon name="logout" size={18} />
            Keluar dari Akun
          </button>
        </div>

        <footer className="pp-footer">
          <span>OJT MineTrack v2.0 · Emergency Response Group</span>
          <span>PT Berau Coal · Program 2026–2027</span>
        </footer>
      </main>
    </div>
  );
}

const css = `
.pp-app,
.pp-app * {
  box-sizing: border-box;
}

.pp-app {
  min-height: 100vh;
  background: #edf3f7;
  color: #173654;
  font-family: Arial, Helvetica, sans-serif;
}

.pp-app button,
.pp-app input,
.pp-app textarea {
  font: inherit;
}

.pp-app button {
  cursor: pointer;
}

.pp-app button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.pp-app button:focus-visible {
  outline: 3px solid #67d7bb;
  outline-offset: 2px;
}

.pp-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 76px;
  padding: 11px 28px;
  background: #081e35;
  color: white;
  border-bottom: 1px solid #ffffff2b;
  box-shadow: 0 5px 20px #0a294024;
}

.pp-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: white;
  text-align: left;
}

.pp-brand-symbol {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border: 1px solid #49cbb88a;
  border-radius: 11px;
  background: #0c78736e;
  color: #71e8c7;
}

.pp-brand-copy strong {
  display: block;
  white-space: nowrap;
  font-size: 21px;
  letter-spacing: -.5px;
}

.pp-brand-copy strong em {
  color: #5de1c1;
  font-style: normal;
}

.pp-brand-copy strong small {
  margin-left: 7px;
  padding: 4px 6px;
  border-radius: 5px;
  background: #5be2c2;
  color: #073647;
  font-size: 10px;
}

.pp-brand-copy > span {
  display: block;
  margin-top: 5px;
  color: #c4d8e4;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.pp-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
}

.pp-nav button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #c7dae5;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.pp-nav button:hover {
  background: #ffffff18;
}

.pp-nav button.active {
  background: #0c807b;
  color: white;
  box-shadow: inset 0 -2px #68ecd2;
}

.pp-account {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.pp-account-avatar {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #d8f6eb;
  color: #08795d;
  font-size: 12px;
  font-weight: 900;
}

.pp-account-info strong {
  display: block;
  max-width: 155px;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.pp-account-info small {
  display: block;
  margin-top: 4px;
  color: #b3cbd6;
  font-size: 10px;
}

.pp-mobile-toggle {
  display: none;
  padding: 7px;
  border: 0;
  background: transparent;
  color: white;
}

.pp-container {
  max-width: 1500px;
  margin: auto;
  padding: 23px;
}

.pp-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  min-height: 230px;
  padding: 30px 34px;
  overflow: hidden;
  border-radius: 16px;
  background-color: #0c2d47;
  background-position: center 44%;
  background-size: cover;
  color: white;
  box-shadow: 0 9px 27px #12385220;
}

.pp-hero-content {
  max-width: 760px;
}

.pp-kicker {
  color: #e6c17a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.pp-hero h1 {
  margin: 12px 0;
  font-size: clamp(29px,3.3vw,44px);
  line-height: 1.15;
  letter-spacing: -.8px;
}

.pp-hero h1 span {
  color: #5be3c2;
}

.pp-hero p {
  max-width: 650px;
  margin: 0;
  color: #e0ebef;
  font-size: 12px;
  line-height: 1.8;
}

.pp-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.pp-hero-tags span {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid #ffffff4c;
  border-radius: 20px;
  background: #092b42a8;
  color: #e4f4f0;
  font-size: 10px;
  font-weight: 750;
}

.pp-hero-summary {
  display: grid;
  justify-items: center;
  gap: 9px;
  flex-shrink: 0;
  min-width: 210px;
  padding: 20px 16px;
  border: 1px solid #ffffff5b;
  border-radius: 13px;
  background: #062641c7;
  text-align: center;
}

.pp-hero-summary-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 11px;
  background: #e2f5ed;
  color: #108868;
}

.pp-hero-summary small {
  color: #aacbd9;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .8px;
}

.pp-hero-summary > strong {
  font-size: 30px;
}

.pp-hero-summary > span:last-child {
  color: #d6e5ea;
  font-size: 10px;
}

.pp-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding: 13px 15px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
}

.pp-alert.error {
  color: #b12b2b;
  background: #fff1f1;
  border: 1px solid #f3c8c8;
}

.pp-summary-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 13px;
  margin: 16px 0;
}

.pp-summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 120px;
  padding: 17px;
  border: 1px solid #dce7ee;
  border-radius: 12px;
  background: white;
  text-align: left;
  box-shadow: 0 6px 20px #0d355015;
}

.pp-summary-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 45px;
  height: 45px;
  border-radius: 11px;
}

.pp-summary-card.amber .pp-summary-icon {
  background: #fff1d8;
  color: #c18a20;
}

.pp-summary-card.green .pp-summary-icon {
  background: #def8ed;
  color: #078c67;
}

.pp-summary-card.blue .pp-summary-icon {
  background: #e0effe;
  color: #1979bf;
}

.pp-summary-card.teal .pp-summary-icon {
  background: #ddf9f5;
  color: #0a9b91;
}

.pp-summary-content {
  display: grid;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.pp-summary-content > span {
  color: #73899b;
  font-size: 10px;
  font-weight: 800;
}

.pp-summary-content > strong {
  color: #123d6b;
  font-size: 22px;
  line-height: 1.3;
}

.pp-bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.pp-card {
  min-width: 0;
  padding: 21px;
  border: 1px solid #dce7ef;
  border-radius: 13px;
  background: white;
  box-shadow: 0 6px 20px #17384d0d;
}

.pp-section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.pp-heading-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 41px;
  height: 41px;
  border-radius: 9px;
  background: linear-gradient(135deg,#10487e,#188bcb);
  color: white;
}

.pp-section-title h2 {
  margin: 0;
  color: #123e70;
  font-size: 17px;
}

.pp-section-title p {
  margin: 5px 0 0;
  color: #7d91a2;
  font-size: 11px;
  line-height: 1.5;
}

.pp-empty {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 34px 15px;
  color: #8197a7;
  text-align: center;
  font-size: 11px;
}

.pp-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.pp-info-box {
  padding: 16px;
  border-radius: 10px;
  background: #f4f8fb;
  border: 1px solid #e2ebf1;
}

.pp-info-box span {
  display: block;
  color: #7e95a4;
  font-size: 10px;
  font-weight: 800;
}

.pp-info-box strong {
  display: block;
  margin-top: 8px;
  color: #1d4a72;
  font-size: 16px;
}

.pp-period-box {
  margin-top: 12px;
  padding: 17px;
  border-radius: 10px;
  border: 1px solid #dde8ef;
  background: white;
}

.pp-period-box span {
  display: block;
  color: #7e95a4;
  font-size: 10px;
  font-weight: 800;
}

.pp-period-box strong {
  display: block;
  margin-top: 8px;
  color: #183a57;
  font-size: 24px;
}

.pp-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 15px;
  padding: 13px;
  border-radius: 8px;
  background: #f3f8fa;
}

.pp-status-row > span {
  font-size: 11px;
  color: #668092;
}

.pp-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.pp-status.green {
  background: #dff6e9;
  color: #078257;
}

.pp-status.amber {
  background: #fff3d9;
  color: #ad7a23;
}

.pp-status.rose {
  background: #fff0f2;
  color: #c14d61;
}

.pp-status.blue {
  background: #edf2f5;
  color: #78909d;
}

.pp-progress-group + .pp-progress-group {
  margin-top: 22px;
}

.pp-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.pp-progress-head span {
  color: #244967;
  font-size: 12px;
  font-weight: 800;
}

.pp-progress-head strong {
  color: #087d73;
  font-size: 12px;
}

.pp-progress-bar {
  height: 11px;
  border-radius: 999px;
  background: #ebf1ee;
  overflow: hidden;
}

.pp-progress-bar > div {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg,#0b7f73,#5fd8ba);
}

.pp-progress-group small {
  display: block;
  margin-top: 10px;
  color: #6f8898;
  font-size: 11px;
  line-height: 1.6;
}

.pp-simper-box {
  margin-top: 22px;
  padding: 16px;
  border-radius: 10px;
  background: #f5f8f5;
  color: #1b4d44;
  font-size: 14px;
}

.pp-quick-grid {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 12px;
}

.pp-quick-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid #dce7ef;
  border-radius: 12px;
  background: white;
  text-align: left;
}

.pp-quick-card:hover {
  background: #fbfefd;
}

.pp-quick-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 11px;
  background: #fff2d9;
  color: #b98a28;
}

.pp-quick-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.pp-quick-copy strong {
  color: #214666;
  font-size: 12px;
}

.pp-quick-copy small {
  color: #778d9d;
  font-size: 10px;
  line-height: 1.5;
}

.pp-quick-card > svg:last-child {
  flex-shrink: 0;
  color: #90a3b2;
}

.pp-action-stack {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.pp-primary-action,
.pp-secondary-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 56px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 900;
}

.pp-primary-action {
  border: 0;
  background: #1d6b54;
  color: white;
}

.pp-secondary-action {
  border: 1px solid #d5e1e7;
  background: white;
  color: #20405a;
}

.pp-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 23px;
  padding: 15px 2px;
  border-top: 1px solid #d9e4ec;
  color: #8195a5;
  font-size: 10px;
}

@media (max-width: 1250px) {
  .pp-summary-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .pp-nav button {
    padding: 10px 8px;
    font-size: 10px;
  }
}

@media (max-width: 1000px) {
  .pp-nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    padding: 12px;
    background: #0b2943;
    border-bottom: 1px solid #ffffff2d;
  }

  .pp-nav.open {
    display: grid;
  }

  .pp-nav button {
    padding: 12px;
    font-size: 12px;
  }

  .pp-account {
    margin-left: auto;
  }

  .pp-mobile-toggle {
    display: grid;
    place-items: center;
  }

  .pp-bottom-grid {
    grid-template-columns: 1fr;
  }

  .pp-quick-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .pp-topbar {
    min-height: 65px;
    padding: 10px 12px;
  }

  .pp-brand-copy strong {
    font-size: 16px;
  }

  .pp-brand-copy > span {
    font-size: 6.5px;
  }

  .pp-brand-symbol {
    width: 35px;
    height: 35px;
  }

  .pp-account-info {
    display: none;
  }

  .pp-container {
    padding: 11px;
  }

  .pp-hero {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 23px 18px;
  }

  .pp-hero h1 {
    font-size: 29px;
  }

  .pp-hero-summary {
    width: 100%;
  }

  .pp-summary-grid {
    gap: 9px;
  }

  .pp-summary-card {
    min-height: 110px;
    padding: 12px;
    gap: 9px;
  }

  .pp-summary-icon {
    width: 34px;
    height: 34px;
  }

  .pp-summary-content > strong {
    font-size: 19px;
  }

  .pp-card {
    padding: 15px;
  }

  .pp-info-grid {
    grid-template-columns: 1fr;
  }

  .pp-period-box strong {
    font-size: 18px;
  }

  .pp-footer {
    flex-direction: column;
    text-align: center;
  }
}
`;

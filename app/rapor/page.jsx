
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO",
];

const CATEGORIES = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function Icon({ name, size = 20 }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6" />,
    report: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
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
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.report}
    </svg>
  );
}

function StatusBadge({ status }) {
  const isFinal = status === "final";
  const isDraft = status === "draft";

  return (
    <span
      className={
        "rp-status " +
        (isFinal ? "final" : isDraft ? "draft" : "empty")
      }
    >
      {isFinal
        ? "Final"
        : isDraft
        ? "Draft"
        : "Belum dibuat"}
    </span>
  );
}

export default function PusatRaporOJT() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [reports, setReports] = useState([]);

  const [reportType, setReportType] = useState("biweekly");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [site, setSite] = useState("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = normalize(profile?.role) === "admin";

  async function loadData() {
    const auth = await supabase.auth.getUser();

    if (auth.error || !auth.data?.user) {
      router.replace("/login");
      return null;
    }

    const userId = auth.data.user.id;

    const profileResult = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", userId)
      .single();

    if (profileResult.error) {
      throw profileResult.error;
    }

    const currentProfile = profileResult.data;
    const role = normalize(currentProfile?.role);

    if (role === "participant" || role === "peserta") {
      router.replace("/dashboard-peserta");
      return null;
    }

    if (role !== "admin" && role !== "mentor") {
      throw new Error(
        "Akses ditolak. Halaman rapor hanya untuk Admin dan Mentor."
      );
    }

    const [programRes, periodRes, reportRes] =
      await Promise.all([
        supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            mentor_id,
            start_date,
            end_date,
            status,
            site,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .order("start_date", { ascending: false }),

        supabase
          .from("ojt_report_periods")
          .select(`
            id,
            report_type,
            period_label,
            start_date,
            end_date
          `)
          .order("start_date", { ascending: false }),

        supabase
          .from("ojt_reports")
          .select(`
            id,
            period_id,
            program_id,
            status,
            mentor_notes,
            recommendation,
            finalized_at
          `),
      ]);

    if (programRes.error) {
      throw new Error(
        "Program OJT: " + programRes.error.message
      );
    }

    if (periodRes.error) {
      throw new Error(
        "Periode Rapor: " + periodRes.error.message
      );
    }

    if (reportRes.error) {
      throw new Error(
        "Data Rapor: " + reportRes.error.message
      );
    }

    return {
      profile: { ...currentProfile, role },
      programs: programRes.data || [],
      periods: periodRes.data || [],
      reports: reportRes.data || [],
    };
  }

  function applyData(next) {
    if (!next) return;

    setProfile(next.profile);
    setPrograms(next.programs);
    setPeriods(next.periods);
    setReports(next.reports);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const next = await loadData();

        if (active) applyData(next);
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memuat Pusat Rapor OJT."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [router]);

  async function refreshData() {
    if (loading || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const next = await loadData();
      applyData(next);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data rapor."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const typePeriods = useMemo(
    () =>
      periods.filter(
        (item) => item.report_type === reportType
      ),
    [periods, reportType]
  );

  const activePeriodId = useMemo(() => {
    if (
      selectedPeriod &&
      typePeriods.some((p) => p.id === selectedPeriod)
    ) {
      return selectedPeriod;
    }

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Makassar",
    });

    const current = typePeriods.find(
      (p) => p.start_date <= today && p.end_date >= today
    );

    return current?.id || typePeriods[0]?.id || "";
  }, [selectedPeriod, typePeriods]);

  const activePeriod = useMemo(
    () => typePeriods.find((p) => p.id === activePeriodId),
    [typePeriods, activePeriodId]
  );

  const filteredPrograms = useMemo(() => {
    const keyword = normalize(search);

    return programs.filter((program) => {
      const person = Array.isArray(program.peserta)
        ? program.peserta[0]
        : program.peserta;

      const matchSite =
        site === "ALL" || program.site === site;

      const matchSearch =
        !keyword ||
        normalize(person?.full_name).includes(keyword) ||
        normalize(person?.department).includes(keyword) ||
        normalize(program.site).includes(keyword);

      const matchPeriod =
        Boolean(activePeriod) &&
        Boolean(program.start_date) &&
        program.start_date <= activePeriod.end_date &&
        (!program.end_date ||
          program.end_date >= activePeriod.start_date);

      return matchSite && matchSearch && matchPeriod;
    });
  }, [programs, search, site, activePeriod]);

  const reportByProgram = useMemo(() => {
    const map = new Map();

    reports
      .filter((r) => r.period_id === activePeriodId)
      .forEach((r) => map.set(r.program_id, r));

    return map;
  }, [reports, activePeriodId]);

  const summary = useMemo(() => {
    let final = 0;
    let draft = 0;

    filteredPrograms.forEach((program) => {
      const status = reportByProgram.get(program.id)?.status;

      if (status === "final") final++;
      if (status === "draft") draft++;
    });

    return {
      total: filteredPrograms.length,
      final,
      draft,
      pending: filteredPrograms.length - final - draft,
    };
  }, [filteredPrograms, reportByProgram]);

  function openReport(program) {
    if (!activePeriod) return;

    const report = reportByProgram.get(program.id);

    if (report?.id) {
      router.push(
        `/rapor/${reportType}/${program.id}?period=${activePeriod.id}`
      );
      return;
    }

    router.push(
      `/rapor/${reportType}/${program.id}?period=${activePeriod.id}`
    );
  }

  return (
    <div className="rp-root">
      <style>{`
        * { box-sizing: border-box; }

        .rp-root {
          min-height: 100vh;
          background: #f2f6f8;
          color: #16332c;
          font-family: Arial, Helvetica, sans-serif;
        }

        .rp-topbar {
          background: linear-gradient(100deg,#07141c,#073c30);
          color: white;
          padding: 18px 25px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .rp-brand {
          font-size: 22px;
          font-weight: 900;
        }

        .rp-brand span { color: #2cca95; }

        .rp-top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rp-top-button {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 10px 13px;
          border: 1px solid #ffffff44;
          border-radius: 9px;
          background: #ffffff12;
          color: white;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .rp-content {
          max-width: 1350px;
          margin: auto;
          padding: 24px;
        }

        .rp-heading {
          margin-bottom: 22px;
        }

        .rp-heading h1 {
          margin: 0 0 8px;
          font-size: 30px;
          font-weight: 900;
          color: #102b30;
        }

        .rp-heading p {
          margin: 0;
          color: #73878c;
          font-size: 13px;
          line-height: 1.6;
        }

        .rp-type-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 14px;
          margin-bottom: 20px;
        }

        .rp-type-card {
          width: 100%;
          display: flex;
          align-items: flex-start;
          gap: 15px;
          text-align: left;
          padding: 21px;
          border: 2px solid #e3e9ed;
          border-radius: 16px;
          background: white;
          cursor: pointer;
          box-shadow: 0 5px 20px #17384708;
        }

        .rp-type-card.active {
          border-color: #10966a;
          background: #f0fbf6;
        }

        .rp-type-icon {
          width: 49px;
          height: 49px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #dff5eb;
          color: #0c9467;
        }

        .rp-type-title {
          font-size: 16px;
          font-weight: 900;
          color: #16332c;
        }

        .rp-type-description {
          margin-top: 7px;
          color: #6f8587;
          font-size: 12px;
          line-height: 1.6;
        }

        .rp-card {
          padding: 20px;
          margin-bottom: 17px;
          border: 1px solid #e2eaee;
          border-radius: 16px;
          background: white;
          box-shadow: 0 5px 20px #17384708;
        }

        .rp-card h2 {
          margin: 0 0 15px;
          font-size: 17px;
          font-weight: 900;
        }

        .rp-period-row {
          display: flex;
          align-items: end;
          flex-wrap: wrap;
          gap: 13px;
        }

        .rp-field {
          flex: 1;
          min-width: 190px;
        }

        .rp-field label {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 800;
        }

        .rp-input {
          width: 100%;
          border: 1px solid #d5e2e5;
          border-radius: 9px;
          background: white;
          color: #16332c;
          padding: 12px;
          font-size: 13px;
        }

        .rp-period-note {
          margin-top: 12px;
          color: #778b90;
          font-size: 12px;
        }

        .rp-stats {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .rp-stat {
          padding: 19px;
          background: white;
          border: 1px solid #e2eaee;
          border-radius: 14px;
        }

        .rp-stat-label {
          font-size: 12px;
          color: #74888b;
          font-weight: 700;
        }

        .rp-stat-value {
          display: block;
          margin-top: 10px;
          font-size: 29px;
          font-weight: 900;
          color: #10392d;
        }

        .rp-stat.final .rp-stat-value { color: #098458; }
        .rp-stat.draft .rp-stat-value { color: #a36a0c; }
        .rp-stat.pending .rp-stat-value { color: #6c7d88; }

        .rp-list-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 15px;
        }

        .rp-list-head h2 { margin: 0; }

        .rp-filters {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .rp-search {
          position: relative;
        }

        .rp-search input {
          padding-left: 35px;
          min-width: 230px;
        }

        .rp-search svg {
          position: absolute;
          left: 11px;
          top: 11px;
          color: #8a9b9d;
        }

        .rp-table-wrap { overflow-x: auto; }

        .rp-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
          text-align: left;
          font-size: 12px;
        }

        .rp-table th {
          padding: 13px;
          background: #f3f7f8;
          color: #718489;
          font-size: 11px;
        }

        .rp-table td {
          padding: 14px 13px;
          border-bottom: 1px solid #e9eff1;
        }

        .rp-person {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .rp-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #dff5eb;
          color: #087e58;
          font-weight: 900;
        }

        .rp-person-name {
          font-weight: 900;
          color: #17362e;
        }

        .rp-person-dept {
          margin-top: 4px;
          color: #84959a;
          font-size: 11px;
        }

        .rp-status {
          display: inline-block;
          border-radius: 20px;
          padding: 6px 11px;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .rp-status.final {
          background: #ddf6e9;
          color: #087e56;
        }

        .rp-status.draft {
          background: #fff2d9;
          color: #a66c09;
        }

        .rp-status.empty {
          background: #edf1f3;
          color: #6f7e87;
        }

        .rp-open {
          border: 0;
          border-radius: 9px;
          padding: 10px 13px;
          background: #087d58;
          color: white;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .rp-empty {
          padding: 24px;
          text-align: center;
          color: #81939a;
          font-size: 13px;
        }

        .rp-alert {
          padding: 14px;
          margin-bottom: 15px;
          background: #fff0f0;
          border: 1px solid #ffc7c7;
          border-radius: 10px;
          color: #b91c1c;
          overflow-wrap: anywhere;
        }

        .rp-footer {
          padding: 20px;
          color: #87989c;
          text-align: center;
          font-size: 11px;
        }

        @media (max-width:760px) {
          .rp-topbar { padding: 14px; }
          .rp-brand { font-size: 18px; }
          .rp-top-button { padding: 9px; font-size: 11px; }
          .rp-content { padding: 15px 11px; }
          .rp-heading h1 { font-size: 25px; }
          .rp-type-grid { grid-template-columns: 1fr; }
          .rp-type-card { padding: 16px; }
          .rp-card { padding: 15px 12px; }
          .rp-stats { grid-template-columns: repeat(2,1fr); }
          .rp-stat { padding: 14px; }
          .rp-stat-value { font-size: 25px; }
          .rp-filters { width: 100%; }
          .rp-search { flex: 1; min-width: 0; }
          .rp-search input { min-width: 0; }
          .rp-filters select { width: 115px; }
        }
      `}</style>

      <header className="rp-topbar">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="rp-top-actions">
          <button
            type="button"
            className="rp-top-button"
            onClick={refreshData}
            disabled={loading || refreshing}
          >
            <Icon name="refresh" size={16} />
            {refreshing ? "Memuat..." : "Refresh"}
          </button>

          <button
            type="button"
            className="rp-top-button"
            onClick={() => router.push("/")}
          >
            <Icon name="back" size={17} />
            Dashboard
          </button>
        </div>
      </header>

      <main className="rp-content">
        <div className="rp-heading">
          <h1>Pusat Rapor OJT</h1>
          <p>
            Monitoring dan evaluasi On Job Training
            berdasarkan periode kalender perusahaan.
          </p>
        </div>

        {error && (
          <div className="rp-alert" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <section className="rp-card">
            Memuat data rapor...
          </section>
        ) : !profile ? (
          <section className="rp-card">
            Data pengguna tidak tersedia.
          </section>
        ) : (
          <>
            <div className="rp-type-grid">
              <button
                type="button"
                className={
                  "rp-type-card " +
                  (reportType === "biweekly" ? "active" : "")
                }
                onClick={() => {
                  setReportType("biweekly");
                  setSelectedPeriod("");
                }}
              >
                <div className="rp-type-icon">
                  <Icon name="calendar" size={25} />
                </div>

                <div>
                  <div className="rp-type-title">
                    Rapor Pencapaian 2 Mingguan
                  </div>

                  <div className="rp-type-description">
                    Evaluasi enam kategori pencapaian:
                    Fisik, Training, Sosialisasi,
                    Coaching, Orientasi Area, dan Hazard.
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={
                  "rp-type-card " +
                  (reportType === "quarterly" ? "active" : "")
                }
                onClick={() => {
                  setReportType("quarterly");
                  setSelectedPeriod("");
                }}
              >
                <div className="rp-type-icon">
                  <Icon name="report" size={25} />
                </div>

                <div>
                  <div className="rp-type-title">
                    Rapor Evaluasi 3 Bulanan
                  </div>

                  <div className="rp-type-description">
                    Evaluasi praktik, post-test, Samapta,
                    SIMPER, konsistensi, dan penilaian Mentor.
                  </div>
                </div>
              </button>
            </div>

            <section className="rp-card">
              <h2>Periode Penilaian</h2>

              <div className="rp-period-row">
                <div className="rp-field">
                  <label htmlFor="rp-period">
                    Pilih Periode
                  </label>

                  <select
                    id="rp-period"
                    className="rp-input"
                    value={activePeriodId}
                    onChange={(event) =>
                      setSelectedPeriod(event.target.value)
                    }
                  >
                    {typePeriods.map((period) => (
                      <option
                        value={period.id}
                        key={period.id}
                      >
                        {period.period_label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rp-period-note">
                {activePeriod
                  ? `Tanggal ${formatDate(activePeriod.start_date)} sampai ${formatDate(activePeriod.end_date)}`
                  : "Belum tersedia periode penilaian."}
              </div>
            </section>

            <div className="rp-stats">
              {[
                {
                  label: "Peserta dalam Periode",
                  value: summary.total,
                  className: "",
                },
                {
                  label: "Rapor Final",
                  value: summary.final,
                  className: "final",
                },
                {
                  label: "Rapor Draft",
                  value: summary.draft,
                  className: "draft",
                },
                {
                  label: "Belum Dibuat",
                  value: summary.pending,
                  className: "pending",
                },
              ].map((item) => (
                <div
                  className={"rp-stat " + item.className}
                  key={item.label}
                >
                  <div className="rp-stat-label">
                    {item.label}
                  </div>

                  <strong className="rp-stat-value">
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>

            <section className="rp-card">
              <div className="rp-list-head">
                <h2>
                  Daftar Peserta OJT
                  {isAdmin ? " · Administrator" : ""}
                </h2>

                <div className="rp-filters">
                  <div className="rp-search">
                    <Icon name="search" size={17} />

                    <input
                      className="rp-input"
                      type="search"
                      placeholder="Cari peserta..."
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                    />
                  </div>

                  <select
                    className="rp-input"
                    value={site}
                    onChange={(event) =>
                      setSite(event.target.value)
                    }
                  >
                    <option value="ALL">
                      Semua Site
                    </option>

                    {SITES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Peserta OJT</th>
                      <th>Site</th>
                      <th>Periode OJT</th>
                      <th>Status Rapor</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPrograms.map((program, index) => {
                      const person = Array.isArray(program.peserta)
                        ? program.peserta[0]
                        : program.peserta;

                      const report = reportByProgram.get(program.id);

                      return (
                        <tr key={program.id}>
                          <td>{index + 1}</td>

                          <td>
                            <div className="rp-person">
                              <div className="rp-avatar">
                                {initials(person?.full_name)}
                              </div>

                              <div>
                                <div className="rp-person-name">
                                  {person?.full_name || "Peserta OJT"}
                                </div>

                                <div className="rp-person-dept">
                                  {person?.department || "—"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>{program.site || "—"}</td>

                          <td>
                            {formatDate(program.start_date)}
                            {" – "}
                            {formatDate(program.end_date)}
                          </td>

                          <td>
                            <StatusBadge status={report?.status} />
                          </td>

                          <td>
                            <button
                              type="button"
                              className="rp-open"
                              onClick={() => openReport(program)}
                            >
                              Buka Rapor
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {!filteredPrograms.length && (
                  <div className="rp-empty">
                    Tidak ada peserta OJT pada periode
                    dan filter yang dipilih.
                  </div>
                )}
              </div>
            </section>

            <section className="rp-card">
              <h2>Informasi Sistem Rapor</h2>

              <p className="rp-period-note">
                Periode penilaian berlaku sama untuk
                seluruh peserta. Data pencapaian dan
                evaluasi berasal dari sistem OJT MineTrack.
                Status Final hanya muncul setelah rapor
                disahkan melalui proses finalisasi.
              </p>

              <p className="rp-period-note">
                Tahap ini hanya menampilkan data.
                Penyimpanan evaluasi Mentor dan
                finalisasi rapor akan ditambahkan
                pada tahap berikutnya.
              </p>
            </section>
          </>
        )}

        <footer className="rp-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal
        </footer>
      </main>
    </div>
  );
}

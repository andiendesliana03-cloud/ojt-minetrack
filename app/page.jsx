
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO"
];

const ACHIEVEMENTS = [
  "Fisik", "Training", "Sosialisasi",
  "Coaching", "Orientasi Area", "Hazard"
];

const GREEN = "#116149";

function avg(rows) {
  const numbers = rows
    .filter(r => r.score !== null && r.score !== undefined && r.score !== "")
    .map(r => Number(r.score))
    .filter(Number.isFinite);

  return numbers.length
    ? numbers.reduce((a, b) => a + b, 0) / numbers.length
    : null;
}

function fmtScore(value) {
  return value === null ? "—" : value.toFixed(1);
}

function fmtDate(value) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function Icon({ name, size = 19 }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v12h14V9M9 21v-7h6v7" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="18" rx="2" />
        <path d="M9 4.5h6M9 11h6M9 15h4" />
      </>
    ),
    chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20V7" />,
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    )
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
      {paths[name] || paths.chart}
    </svg>
  );
}

function Metric({ label, value, sub, icon, tone = "green" }) {
  return (
    <div className="mt-metric">
      <div className={`mt-metric-icon ${tone}`}>
        <Icon name={icon} size={23} />
      </div>
      <div className="mt-metric-body">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function Progress({ value, shade = GREEN }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="mt-progress">
      <span style={{ width: `${safe}%`, background: shade }} />
    </div>
  );
}

export default function MentorDashboard() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [achievementTypes, setAchievementTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [siteFilter, setSiteFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    const [programRes, typeRes] = await Promise.all([
      supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          start_date,
          end_date,
          status,
          site,
          peserta:profiles!ojt_programs_participant_id_fkey(
            full_name,
            department
          )
        `)
        .eq("status", "active")
        .order("start_date", { ascending: false }),

      supabase
        .from("achievement_types")
        .select("code,name")
    ]);

    if (programRes.error) {
      throw new Error(programRes.error.message);
    }

    if (typeRes.error) {
      throw new Error(typeRes.error.message);
    }

    const list = programRes.data || [];
    const ids = list.map(p => p.id);

    if (!ids.length) {
      setPrograms([]);
      setAchievementTypes(typeRes.data || []);
      setAchievements([]);
      setPostTests([]);
      setPractices([]);
      setSamapta([]);
      setSimper([]);
      return;
    }

    const results = await Promise.all([
      supabase
        .from("achievement_records")
        .select("id,program_id,type_code,status")
        .in("program_id", ids),

      supabase
        .from("post_test_scores")
        .select("id,program_id,score,test_date")
        .in("program_id", ids),

      supabase
        .from("weekly_practice_scores")
        .select("id,program_id,score,practice_date")
        .in("program_id", ids),

      supabase
        .from("samapta_records")
        .select("id,program_id,score,outcome,test_date")
        .in("program_id", ids),

      supabase
        .from("simper_records")
        .select(`
          id,
          program_id,
          administration_status,
          training_status,
          theory_status,
          practice_status,
          status,
          graduation_date
        `)
        .in("program_id", ids)
    ]);

    const names = [
      "Pencapaian", "Post-Test", "Praktik",
      "Samapta", "SIMPER"
    ];

    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${names[index]}: ${result.error.message}`
        );
      }
    });

    setPrograms(list);
    setAchievementTypes(typeRes.data || []);
    setAchievements(results[0].data || []);
    setPostTests(results[1].data || []);
    setPractices(results[2].data || []);
    setSamapta(results[3].data || []);
    setSimper(results[4].data || []);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        if (!active) return;

        setMentor(profile);
        await loadData();

      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat dashboard.");
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

  async function refresh() {
    if (loading || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      await loadData();
    } catch (err) {
      setError(err.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function go(url) {
    setMenuOpen(false);
    router.push(url);
  }

  const dataByProgram = useMemo(() => {
    const codeMap = new Map(
      achievementTypes.map(t => [lower(t.name), t.code])
    );

    const grouped = {};

    function group(rows, key) {
      rows.forEach(row => {
        if (!grouped[row.program_id]) {
          grouped[row.program_id] = {
            a: [], pt: [], pr: [], sm: [], sp: []
          };
        }
        grouped[row.program_id][key].push(row);
      });
    }

    group(achievements, "a");
    group(postTests, "pt");
    group(practices, "pr");
    group(samapta, "sm");
    group(simper, "sp");

    const output = {};

    programs.forEach(program => {
      const d = grouped[program.id] || {
        a: [], pt: [], pr: [], sm: [], sp: []
      };

      const verified = new Set(
        d.a
          .filter(r => r.status === "verified")
          .map(r => r.type_code)
      );

      const done = ACHIEVEMENTS.filter(name => {
        const code = codeMap.get(lower(name));
        return code && verified.has(code);
      }).length;

      const simperRecord =
        d.sp.find(r => r.status === "passed") ||
        d.sp[0] ||
        null;

      const stages = simperRecord
        ? [
            simperRecord.administration_status,
            simperRecord.training_status,
            simperRecord.theory_status,
            simperRecord.practice_status
          ].filter(s => s === "passed").length
        : 0;

      output[program.id] = {
        ...d,
        done,
        progress: Math.round(
          (done / ACHIEVEMENTS.length) * 100
        ),
        postAverage: avg(d.pt),
        practiceAverage: avg(d.pr),
        samaptaPassed: d.sm.some(r => r.outcome === "pass"),
        simperPassed: simperRecord?.status === "passed",
        simperProgress:
          simperRecord?.status === "passed"
            ? 100
            : stages * 25
      };
    });

    return output;
  }, [
    programs,
    achievementTypes,
    achievements,
    postTests,
    practices,
    samapta,
    simper
  ]);

  const filtered = useMemo(() => {
    return programs.filter(program => {
      const matchSite =
        siteFilter === "ALL" ||
        program.site === siteFilter;

      const keyword = lower(search);

      const matchName =
        !keyword ||
        lower(program.peserta?.full_name).includes(keyword) ||
        lower(program.peserta?.department).includes(keyword);

      return matchSite && matchName;
    });
  }, [programs, siteFilter, search]);

  const metrics = useMemo(() => {
    const ids = new Set(filtered.map(p => p.id));

    const filteredPractices = practices.filter(
      r => ids.has(r.program_id)
    );

    const progressTotal = filtered.reduce(
      (sum, p) =>
        sum + (dataByProgram[p.id]?.progress || 0),
      0
    );

    return {
      active: filtered.length,
      averageProgress: filtered.length
        ? Math.round(progressTotal / filtered.length)
        : 0,
      averagePractice: avg(filteredPractices),
      done: filtered.filter(
        p => dataByProgram[p.id]?.done === 6
      ).length
    };
  }, [filtered, practices, dataByProgram]);

  const siteChart = useMemo(() => {
    const sites = [
      ...new Set(
        filtered.map(p => p.site || "Belum diisi")
      )
    ];

    return sites.map(site => {
      const entries = filtered.filter(
        p => (p.site || "Belum diisi") === site
      );

      const value = entries.length
        ? Math.round(
            entries.reduce(
              (sum, p) =>
                sum + (dataByProgram[p.id]?.progress || 0),
              0
            ) / entries.length
          )
        : 0;

      return {
        site,
        count: entries.length,
        value
      };
    })
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [filtered, dataByProgram]);

  const nav = [
    ["Dashboard", "home", "/"],
    ["Peserta OJT", "users", "/mentor/monitoring-peserta"],
    ["Pendaftaran Peserta", "clipboard", "/mentor/daftar-peserta"],
    ["Persetujuan", "check", "/mentor/persetujuan-peserta"]
  ];

  return (
    <div className="mt-shell">
      <style>{`
        * { box-sizing: border-box; }

        .mt-shell {
          min-height: 100vh;
          background: #f4f7f6;
          color: #18352b;
          font-family: Arial, Helvetica, sans-serif;
        }

        .mt-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 244px;
          background:
            linear-gradient(180deg,#06171c,#092a2c 75%,#063127);
          color: white;
          padding: 26px 14px;
          z-index: 30;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .mt-brand {
          padding: 6px 12px 27px;
        }

        .mt-brand strong {
          display: block;
          font-size: 24px;
          letter-spacing: -.7px;
        }

        .mt-brand em {
          color: #2acb91;
          font-style: normal;
        }

        .mt-brand small {
          display: block;
          font-size: 11px;
          line-height: 1.8;
          color: #b5c9c0;
          margin-top: 8px;
        }

        .mt-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 13px 14px;
          border: 0;
          background: transparent;
          color: #d3e1de;
          text-align: left;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 5px;
        }

        .mt-nav:hover,
        .mt-nav.active {
          color: white;
          background: linear-gradient(90deg,#087851,#165d49);
        }

        .mt-sidebar-bottom {
          margin-top: auto;
          border-top: 1px solid #ffffff25;
          padding-top: 18px;
        }

        .mt-main {
          margin-left: 244px;
          min-width: 0;
        }

        .mt-hero {
          min-height: 258px;
          padding: 58px 35px 52px;
          color: white;
          background:
            linear-gradient(
              90deg,
              rgba(4,20,23,.96),
              rgba(4,30,27,.86) 45%,
              rgba(4,30,27,.30)
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
          position: relative;
        }

        .mt-hero-kicker {
          color: #e5bd67;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: 800;
          margin-bottom: 14px;
        }

        .mt-hero h1 {
          font-size: clamp(30px,4vw,54px);
          margin: 0;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        .mt-hero h1 span {
          color: #25ba84;
        }

        .mt-hero p {
          margin: 9px 0;
          color: #e3f0ea;
          font-size: 15px;
        }

        .mt-hero-flags {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 22px;
          color: #e8d9ad;
          font-size: 12px;
        }

        .mt-topbar {
          position: absolute;
          right: 28px;
          top: 19px;
        }

        .mt-user {
          background: #071a1dcc;
          border: 1px solid #ffffff35;
          padding: 11px 17px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 13px;
        }

        .mt-user small {
          display: block;
          margin-top: 3px;
          color: #b7c9c2;
          font-weight: 400;
          font-size: 10px;
        }

        .mt-content {
          max-width: 1550px;
          padding: 23px 25px 35px;
          margin: auto;
        }

        .mt-stat-grid {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 13px;
          margin-bottom: 17px;
        }

        .mt-metric {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          background: white;
          border: 1px solid #e4ebe7;
          border-radius: 13px;
          min-height: 119px;
          padding: 18px 15px;
          box-shadow: 0 5px 20px #082e1d08;
        }

        .mt-metric-icon {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          border-radius: 11px;
          color: white;
          background: #138b61;
        }

        .mt-metric-icon.dark { background: #11292c; }
        .mt-metric-icon.gold { background: #c79830; }
        .mt-metric-icon.blue { background: #397abd; }

        .mt-metric-body {
          min-width: 0;
        }

        .mt-metric-body span {
          display: block;
          color: #586e65;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.4;
        }

        .mt-metric-body strong {
          display: block;
          font-size: 29px;
          color: #162c26;
          margin: 5px 0;
        }

        .mt-metric-body small {
          display: block;
          font-size: 10px;
          color: #809088;
          line-height: 1.5;
        }

        .mt-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          gap: 15px;
        }

        .mt-card {
          min-width: 0;
          padding: 22px;
          background: white;
          border: 1px solid #e5ebe8;
          border-radius: 13px;
          box-shadow: 0 4px 19px #082e1d08;
        }

        .mt-card h2 {
          font-size: 16px;
          margin: 0 0 15px;
          color: #172b24;
        }

        .mt-card-sub {
          color: #7a8a82;
          font-size: 11px;
          margin: -5px 0 20px;
          line-height: 1.5;
        }

        .mt-bars {
          display: grid;
          gap: 20px;
          padding: 9px 0;
        }

        .mt-bar-row {
          display: grid;
          grid-template-columns: 100px 1fr 44px;
          align-items: center;
          gap: 14px;
          font-size: 12px;
        }

        .mt-progress {
          height: 9px;
          border-radius: 30px;
          background: #e8f0eb;
          overflow: hidden;
          width: 100%;
          min-width: 40px;
        }

        .mt-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
        }

        .mt-summary-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          padding: 13px 0;
          border-bottom: 1px solid #edf1ef;
          font-size: 12px;
        }

        .mt-summary-row strong {
          color: #076c49;
          font-size: 15px;
        }

        .mt-actions {
          display: grid;
          gap: 9px;
        }

        .mt-action {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          background: #f8faf8;
          border: 1px solid #e2eae6;
          border-radius: 11px;
          padding: 14px;
          font-weight: 700;
          color: #173c31;
          cursor: pointer;
        }

        .mt-action:hover { background: #e8f5ec; }

        .mt-list-head {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 15px;
        }

        .mt-list-head h2 { margin: 0; }

        .mt-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .mt-field {
          height: 39px;
          border: 1px solid #dce5e0;
          background: white;
          border-radius: 9px;
          padding: 0 11px;
          color: #193630;
          font-size: 12px;
          min-width: 0;
        }

        .mt-table-wrap {
          overflow-x: auto;
        }

        .mt-table {
          width: 100%;
          min-width: 690px;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }

        .mt-table th {
          background: #f2f6f4;
          color: #677d73;
          padding: 13px 11px;
          font-size: 11px;
          white-space: nowrap;
        }

        .mt-table td {
          padding: 13px 11px;
          border-bottom: 1px solid #eef2f0;
          color: #364a43;
        }

        .mt-name {
          font-weight: 800;
          color: #162e27;
        }

        .mt-pill {
          font-size: 10px;
          background: #ddf5e7;
          color: #0c6a43;
          padding: 6px 10px;
          border-radius: 30px;
          font-weight: 800;
        }

        .mt-view {
          background: #ecf5ef;
          border: 0;
          color: #096044;
          padding: 9px 12px;
          border-radius: 8px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .mt-mobile-bar { display: none; }
        .mt-overlay { display: none; }

        .mt-footer {
          text-align: center;
          font-size: 11px;
          color: #90a09a;
          margin-top: 25px;
        }

        .mt-note {
          font-size: 11px;
          color: #6a8075;
          line-height: 1.6;
        }

        .mt-error {
          color: #a82222;
          background: #fff1f1;
          border: 1px solid #ffcdcd;
          padding: 13px;
          border-radius: 11px;
          margin-bottom: 16px;
        }

        @media (max-width: 1150px) {
          .mt-stat-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }
          .mt-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 760px) {
          .mt-sidebar {
            transform: translateX(-103%);
            transition: transform .2s;
            width: 255px;
          }

          .mt-sidebar.open {
            transform: translateX(0);
          }

          .mt-overlay.open {
            display: block;
            position: fixed;
            inset: 0;
            background: #00191080;
            z-index: 25;
          }

          .mt-main { margin-left: 0; }

          .mt-mobile-bar {
            height: 61px;
            background: #081e24;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 17px;
            color: white;
            position: sticky;
            top: 0;
            z-index: 20;
          }

          .mt-mobile-bar button {
            background: transparent;
            border: 0;
            color: white;
            padding: 8px;
          }

          .mt-hero {
            padding: 26px 18px 40px;
            min-height: 190px;
          }

          .mt-hero h1 { font-size: 30px; }

          .mt-hero-flags {
            font-size: 10px;
            gap: 9px;
            margin-top: 16px;
          }

          .mt-topbar { display: none; }

          .mt-content {
            padding: 15px 12px 30px;
          }

          .mt-stat-grid {
            gap: 9px;
          }

          .mt-metric {
            padding: 13px 10px;
            min-height: 104px;
            gap: 9px;
          }

          .mt-metric-icon {
            width: 33px;
            height: 33px;
          }

          .mt-metric-body strong { font-size: 23px; }
          .mt-metric-body span { font-size: 10px; }
          .mt-metric-body small { font-size: 9px; }

          .mt-card { padding: 15px; }

          .mt-bar-row {
            grid-template-columns: 73px 1fr 35px;
            gap: 8px;
            font-size: 11px;
          }

          .mt-filters { width: 100%; }

          .mt-field {
            flex: 1;
            min-width: 125px;
          }

          .mt-grid { gap: 12px; }
        }
      `}</style>

      <div
        className={`mt-overlay ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`mt-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="mt-brand">
          <strong>
            OJT <em>MineTrack</em>
          </strong>
          <small>
            Emergency Response Group
            <br />
            PT Berau Coal
          </small>
        </div>

        <nav aria-label="Navigasi Mentor">
          {nav.map(([label, icon, url]) => (
            <button
              key={label}
              type="button"
              className={`mt-nav ${url === "/" ? "active" : ""}`}
              onClick={() => go(url)}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-sidebar-bottom">
          <button
            className="mt-nav"
            type="button"
            onClick={refresh}
            disabled={refreshing}
          >
            <Icon name="refresh" />
            {refreshing ? "Memuat ulang..." : "Refresh Data"}
          </button>

          <button
            className="mt-nav"
            type="button"
            onClick={logout}
          >
            <Icon name="logout" />
            Keluar Akun
          </button>
        </div>
      </aside>

      <main className="mt-main">
        <div className="mt-mobile-bar">
          <strong>
            OJT <span style={{ color: "#e0b75e" }}>MineTrack</span>
          </strong>

          <button
            type="button"
            aria-label="Buka menu"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={25} />
          </button>
        </div>

        <header className="mt-hero">
          <div className="mt-topbar">
            <div className="mt-user">
              {mentor?.full_name || "Mentor OJT"}
              <small>Dashboard Mentor ERG</small>
            </div>
          </div>

          <div className="mt-hero-kicker">
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </div>

          <h1>
            OJT <span>MineTrack</span>
          </h1>

          <p>Monitoring dan Evaluasi On Job Training</p>

          <div className="mt-hero-flags">
            <span>◆ Safe People</span>
            <span>⚙ Safe Operation</span>
            <span>◆ Sustainable Mining</span>
          </div>
        </header>

        <div className="mt-content">
          {error && (
            <div className="mt-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <section className="mt-card">
              Memuat data monitoring...
            </section>
          ) : !mentor ? (
            <section className="mt-card">
              Akses Dashboard Mentor tidak tersedia.
            </section>
          ) : (
            <>
              <div className="mt-stat-grid">
                <Metric
                  label="Peserta OJT Aktif"
                  value={metrics.active}
                  sub="Berdasarkan filter saat ini"
                  icon="users"
                />

                <Metric
                  label="Rata-rata Progres OJT"
                  value={`${metrics.averageProgress}%`}
                  sub="Enam kategori pencapaian"
                  icon="chart"
                  tone="dark"
                />

                <Metric
                  label="Rata-rata Nilai Praktik"
                  value={fmtScore(metrics.averagePractice)}
                  sub="Dari penilaian yang tercatat"
                  icon="clipboard"
                  tone="gold"
                />

                <Metric
                  label="Pencapaian Lengkap"
                  value={metrics.done}
                  sub="Peserta dengan 6 kategori terverifikasi"
                  icon="check"
                  tone="blue"
                />
              </div>

              <div className="mt-grid">
                <section className="mt-card">
                  <h2>Progres OJT per Site</h2>

                  <p className="mt-card-sub">
                    Rata-rata enam pencapaian terverifikasi
                    pada masing-masing site
                  </p>

                  {siteChart.length ? (
                    <div className="mt-bars">
                      {siteChart.map(item => (
                        <div
                          className="mt-bar-row"
                          key={item.site}
                        >
                          <strong>{item.site}</strong>

                          <Progress value={item.value} />

                          <span>{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-note">
                      Belum ada peserta aktif.
                    </p>
                  )}
                </section>

                <section className="mt-card">
                  <h2>Ringkasan Monitoring</h2>

                  <div className="mt-summary-row">
                    <span>Program OJT aktif</span>
                    <strong>{metrics.active}</strong>
                  </div>

                  <div className="mt-summary-row">
                    <span>Pencapaian lengkap</span>
                    <strong>{metrics.done}</strong>
                  </div>

                  <div className="mt-summary-row">
                    <span>SIMPER lulus</span>
                    <strong>
                      {filtered.filter(
                        p => dataByProgram[p.id]?.simperPassed
                      ).length}
                    </strong>
                  </div>

                  <div className="mt-summary-row">
                    <span>Samapta pernah lulus</span>
                    <strong>
                      {filtered.filter(
                        p => dataByProgram[p.id]?.samaptaPassed
                      ).length}
                    </strong>
                  </div>

                  <div className="mt-summary-row">
                    <span>Rata-rata Post-Test</span>
                    <strong>
                      {fmtScore(
                        avg(
                          postTests.filter(r =>
                            filtered.some(p => p.id === r.program_id)
                          )
                        )
                      )}
                    </strong>
                  </div>
                </section>

                <section className="mt-card">
                  <h2>Aksi Cepat Mentor</h2>

                  <div className="mt-actions">
                    <button
                      className="mt-action"
                      type="button"
                      onClick={() =>
                        go("/mentor/monitoring-peserta")
                      }
                    >
                      Monitoring Peserta
                      <Icon name="arrow" size={17} />
                    </button>

                    <button
                      className="mt-action"
                      type="button"
                      onClick={() =>
                        go("/mentor/persetujuan-peserta")
                      }
                    >
                      Review Persetujuan
                      <Icon name="arrow" size={17} />
                    </button>

                    <button
                      className="mt-action"
                      type="button"
                      onClick={() =>
                        go("/mentor/daftar-peserta")
                      }
                    >
                      Pendaftaran Peserta
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </section>

                <section className="mt-card">
                  <h2>Status Penilaian</h2>

                  <p className="mt-card-sub">
                    Jumlah peserta yang memiliki catatan
                    pada setiap jenis penilaian
                  </p>

                  {[
                    {
                      label: "Post-Test",
                      count: filtered.filter(
                        p => dataByProgram[p.id]?.pt.length
                      ).length
                    },
                    {
                      label: "Praktik Mingguan",
                      count: filtered.filter(
                        p => dataByProgram[p.id]?.pr.length
                      ).length
                    },
                    {
                      label: "Samapta",
                      count: filtered.filter(
                        p => dataByProgram[p.id]?.sm.length
                      ).length
                    },
                    {
                      label: "SIMPER",
                      count: filtered.filter(
                        p => dataByProgram[p.id]?.sp.length
                      ).length
                    }
                  ].map(item => (
                    <div
                      className="mt-summary-row"
                      key={item.label}
                    >
                      <span>{item.label}</span>

                      <strong>
                        {item.count} / {metrics.active}
                      </strong>
                    </div>
                  ))}

                  <p className="mt-note">
                    Jumlah catatan tidak otomatis menunjukkan
                    kelulusan. Buka detail peserta untuk melihat
                    status dan nilai lengkap.
                  </p>
                </section>
              </div>

              <section
                className="mt-card"
                style={{ marginTop: 16 }}
              >
                <div className="mt-list-head">
                  <h2>Daftar Peserta OJT Aktif</h2>

                  <div className="mt-filters">
                    <input
                      className="mt-field"
                      type="search"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Cari nama / departemen"
                      aria-label="Cari nama peserta"
                    />

                    <select
                      className="mt-field"
                      value={siteFilter}
                      onChange={e => setSiteFilter(e.target.value)}
                      aria-label="Filter site"
                    >
                      <option value="ALL">Semua Site</option>
                      {SITES.map(site => (
                        <option key={site} value={site}>
                          {site}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-table-wrap">
                  <table className="mt-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama Peserta</th>
                        <th>Departemen</th>
                        <th>Site</th>
                        <th>Periode OJT</th>
                        <th>Progres</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((program, index) => (
                        <tr key={program.id}>
                          <td>{index + 1}</td>

                          <td>
                            <span className="mt-name">
                              {program.peserta?.full_name ||
                                "Peserta OJT"}
                            </span>
                          </td>

                          <td>
                            {program.peserta?.department || "—"}
                          </td>

                          <td>{program.site || "—"}</td>

                          <td>
                            {fmtDate(program.start_date)}
                            {" – "}
                            {fmtDate(program.end_date)}
                          </td>

                          <td>
                            <div
                              style={{
                                minWidth: 110,
                                display: "flex",
                                gap: 7,
                                alignItems: "center"
                              }}
                            >
                              <Progress
                                value={
                                  dataByProgram[program.id]?.progress || 0
                                }
                              />
                              <strong>
                                {dataByProgram[program.id]?.progress || 0}%
                              </strong>
                            </div>
                          </td>

                          <td>
                            <span className="mt-pill">
                              Aktif
                            </span>
                          </td>

                          <td>
                            <button
                              className="mt-view"
                              type="button"
                              onClick={() =>
                                go(`/peserta/${program.id}`)
                              }
                            >
                              Lihat Detail →
                            </button>
                          </td>
                        </tr>
                      ))}

                      {!filtered.length && (
                        <tr>
                          <td
                            colSpan="8"
                            style={{
                              textAlign: "center",
                              padding: 25
                            }}
                          >
                            Tidak ada peserta yang sesuai filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="mt-note">
                  Pilih Lihat Detail untuk mengakses
                  Post-Test, Praktik Mingguan, Samapta,
                  SIMPER, dan pencapaian peserta.
                </p>
              </section>
            </>
          )}

          <div className="mt-footer">
            OJT MineTrack v2.0 · Emergency Response Group ·
            PT Berau Coal
          </div>
        </div>
      </main>
    </div>
  );
}

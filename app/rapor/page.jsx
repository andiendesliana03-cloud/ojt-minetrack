
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// PUSAT RAPOR OJT TERINTEGRASI
// WEEK 01–25 | ADMIN & MENTOR
// TANPA BIWEEKLY / QUARTERLY
// =====================================================

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

const CATEGORIES = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

const TOTAL_WEEKS = 25;

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function buildGlobalWeeks() {
  const weeks = [];

  // Week 01 adalah minggu khusus.
  weeks.push({
    number: 1,
    label: "Week 01",
    start_date: "2026-09-12",
    end_date: "2026-09-18",
  });

  // 19 September tidak masuk minggu program.
  // Week 02 dimulai 20 September 2026.
  const weekTwo = new Date("2026-09-20T00:00:00Z");

  for (let number = 2; number <= TOTAL_WEEKS; number++) {
    const start = addDays(weekTwo, (number - 2) * 7);
    const end = addDays(start, 6);

    weeks.push({
      number,
      label: `Week ${String(number).padStart(2, "0")}`,
      start_date: toDateString(start),
      end_date: toDateString(end),
    });
  }

  return weeks;
}

const GLOBAL_WEEKS = buildGlobalWeeks();

function getCurrentWeek() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const current = GLOBAL_WEEKS.find(
    (week) =>
      today >= week.start_date &&
      today <= week.end_date
  );

  if (current) return current.number;

  if (today < GLOBAL_WEEKS[0].start_date) return 1;

  const previous = [...GLOBAL_WEEKS]
    .reverse()
    .find((week) => today >= week.end_date);

  return previous?.number || 1;
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

function Icon({ name, size = 19 }) {
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
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 4 5" />
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
    arrow: <path d="m5 12h14m-6-6 6 6-6 6" />,
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    book: (
      <>
        <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1" />
        <path d="M12 6c3-2 6-2 9-1v14c-3-1-6-1-9 1" />
        <path d="M12 6v14" />
      </>
    ),
    activity: (
      <path d="M2 12h5l3-8 4 16 3-8h5" />
    ),
    award: (
      <>
        <circle cx="12" cy="9" r="6" />
        <path d="m8 14-2 8 6-3 6 3-2-8" />
      </>
    ),
    filter: (
      <path d="M4 5h16l-6 7v6l-4 2v-8z" />
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
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
      {paths[name] || paths.report}
    </svg>
  );
}

function StatCard({ icon, label, value, description }) {
  return (
    <div className="rpt-stat">
      <span className="rpt-stat-icon">
        <Icon name={icon} size={23} />
      </span>

      <div>
        <span className="rpt-stat-label">{label}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}

function CategoryTag({ name, index }) {
  return (
    <span className={`rpt-category cat-${index}`}>
      {name}
    </span>
  );
}

export default function PusatRaporOJT() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [programs, setPrograms] = useState([]);

  const [startWeek, setStartWeek] = useState(1);
  const [endWeek, setEndWeek] = useState(null);

  const [site, setSite] = useState("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = normalize(profile?.role) === "admin";

  // ===================================================
  // PEMERIKSAAN AKSES + MEMBACA PROGRAM OJT
  // ===================================================

  const loadData = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return null;
    }

    const profileResult = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", user.id)
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
        "Akses ditolak. Pusat Rapor hanya untuk Admin dan Mentor."
      );
    }

    // Tidak lagi membaca ojt_report_periods.
    // Pusat rapor memakai Kalender Global Week 01–25.
    // Data program tetap mengikuti RLS Supabase.

    const programRes = await supabase
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
      .order("start_date", { ascending: false });

    if (programRes.error) {
      throw new Error(
        "Gagal membaca program OJT: " +
          programRes.error.message
      );
    }

    return {
      profile: {
        ...currentProfile,
        role,
      },
      programs: programRes.data || [],
    };
  }, [router]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const next = await loadData();

        if (!active || !next) return;

        setProfile(next.profile);
        setPrograms(next.programs);
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
  }, [loadData]);

  useEffect(() => {
    setEndWeek(getCurrentWeek());
  }, []);

  async function refreshData() {
    if (loading || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const next = await loadData();

      if (next) {
        setProfile(next.profile);
        setPrograms(next.programs);
      }
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data rapor."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ===================================================
  // PEMILIHAN RENTANG MINGGU
  // ===================================================

  const selectedEndWeek = endWeek ?? getCurrentWeek();

  const selectedStart = GLOBAL_WEEKS[startWeek - 1];
  const selectedEnd = GLOBAL_WEEKS[selectedEndWeek - 1];

  const selectedRange = useMemo(() => {
    if (!selectedStart || !selectedEnd) return null;

    return {
      start_date: selectedStart.start_date,
      end_date: selectedEnd.end_date,
      total_weeks: selectedEndWeek - startWeek + 1,
    };
  }, [selectedStart, selectedEnd, selectedEndWeek, startWeek]);

  function updateStartWeek(value) {
    const next = Number(value);

    if (!Number.isInteger(next)) return;

    setStartWeek(next);

    if (next > selectedEndWeek) {
      setEndWeek(next);
    }
  }

  function updateEndWeek(value) {
    const next = Number(value);

    if (!Number.isInteger(next)) return;

    setEndWeek(next);

    if (next < startWeek) {
      setStartWeek(next);
    }
  }

  function selectRange(from, to) {
    setStartWeek(from);
    setEndWeek(to);
  }

  // ===================================================
  // FILTER PROGRAM
  // ===================================================

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

      // Kalender global hanya untuk memilih rentang.
      // Tanggal program masing-masing peserta
      // tidak diubah.
      const matchPeriod =
        Boolean(selectedRange) &&
        Boolean(program.start_date) &&
        program.start_date <= selectedRange.end_date &&
        (!program.end_date ||
          program.end_date >= selectedRange.start_date);

      return matchSite && matchSearch && matchPeriod;
    });
  }, [programs, search, site, selectedRange]);

  const summary = useMemo(() => {
    return {
      participants: filteredPrograms.length,
      weeks: selectedRange?.total_weeks || 0,
      theoryTarget: (selectedRange?.total_weeks || 0) * 2,
      practiceTarget: selectedRange?.total_weeks || 0,
    };
  }, [filteredPrograms, selectedRange]);

  // ===================================================
  // MENUJU RAPOR TERINTEGRASI
  // ===================================================

  function openReport(program) {
    if (!program?.id || !selectedRange) return;

    const query = new URLSearchParams({
      weekFrom: String(startWeek),
      weekTo: String(selectedEndWeek),
    });

    router.push(
      `/laporan/${program.id}?${query.toString()}`
    );
  }

  return (
    <div className="rpt-root">
      <style>{css}</style>

      {/* HEADER */}

      <header className="rpt-topbar">
        <div className="rpt-brand">
          <span className="rpt-brand-mark">◆</span>

          <div>
            <strong>
              OJT <span>MineTrack</span>
            </strong>
            <small>EMERGENCY RESPONSE GROUP · PT BERAU COAL</small>
          </div>
        </div>

        <div className="rpt-top-actions">
          <button
            type="button"
            onClick={refreshData}
            disabled={loading || refreshing}
          >
            <Icon name="refresh" size={17} />
            <span>{refreshing ? "Memuat..." : "Refresh"}</span>
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
          >
            <Icon name="back" size={17} />
            <span>Dashboard</span>
          </button>
        </div>
      </header>

      <main className="rpt-content">

        {/* HERO */}

        <section className="rpt-hero">
          <div className="rpt-hero-text">
            <span className="rpt-eyebrow">
              OJT MINETRACK V2.0 · PROGRAM 2026–2027
            </span>

            <h1>
              Pusat <span>Rapor OJT</span>
            </h1>

            <p>
              Kelola laporan perkembangan peserta
              berdasarkan kalender global program OJT
              dengan pilihan rentang Week 01–25.
            </p>

            <div className="rpt-hero-tags">
              <span>
                <Icon name="shield" size={15} />
                {isAdmin ? "Administrator" : "Mentor OJT"}
              </span>

              <span>
                <Icon name="calendar" size={15} />
                25 Minggu Program
              </span>
            </div>
          </div>

          <div className="rpt-hero-right">
            <div className="rpt-hero-number">25</div>
            <strong>WEEK PROGRAM</strong>
            <small>12 Sep 2026 – 6 Mar 2027</small>
          </div>
        </section>

        {/* IDENTITAS */}

        <div className="rpt-breadcrumb">
          Dashboard / Monitoring OJT /{" "}
          <strong>Pusat Rapor</strong>
        </div>

        {error && (
          <div className="rpt-alert" role="alert">
            <Icon name="info" size={20} />
            {error}
          </div>
        )}

        {loading ? (
          <section className="rpt-card rpt-loading">
            Memuat data program dan peserta OJT...
          </section>
        ) : !profile ? (
          <section className="rpt-card">
            Data pengguna tidak tersedia.
          </section>
        ) : (
          <>
            {/* PEMILIHAN MINGGU */}

            <section className="rpt-card">
              <div className="rpt-section-heading">
                <span className="rpt-section-icon">
                  <Icon name="calendar" size={21} />
                </span>

                <div>
                  <h2>Periode Rapor OJT</h2>
                  <p>
                    Pilih minggu awal dan minggu akhir yang
                    akan digunakan pada laporan.
                  </p>
                </div>
              </div>

              <div className="rpt-range-grid">
                <div className="rpt-field">
                  <label htmlFor="rpt-from">
                    Dari Minggu
                  </label>

                  <select
                    id="rpt-from"
                    value={startWeek}
                    onChange={(event) =>
                      updateStartWeek(event.target.value)
                    }
                  >
                    {GLOBAL_WEEKS.map((week) => (
                      <option
                        key={week.number}
                        value={week.number}
                      >
                        {week.label} · {formatDate(week.start_date)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rpt-field">
                  <label htmlFor="rpt-to">
                    Sampai Minggu
                  </label>

                  <select
                    id="rpt-to"
                    value={selectedEndWeek}
                    onChange={(event) =>
                      updateEndWeek(event.target.value)
                    }
                  >
                    {GLOBAL_WEEKS.map((week) => (
                      <option
                        key={week.number}
                        value={week.number}
                      >
                        {week.label} · {formatDate(week.end_date)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rpt-presets">
                <span>Pilihan Cepat:</span>

                <button
                  type="button"
                  onClick={() => {
                    const current = getCurrentWeek();
                    selectRange(current, current);
                  }}
                >
                  Minggu Saat Ini
                </button>

                <button
                  type="button"
                  onClick={() => selectRange(1, 2)}
                >
                  2 Minggu
                </button>

                <button
                  type="button"
                  onClick={() => selectRange(1, 12)}
                >
                  12 Minggu
                </button>

                <button
                  type="button"
                  onClick={() => selectRange(1, 25)}
                >
                  25 Minggu
                </button>
              </div>

              {selectedRange && (
                <div className="rpt-range-info">
                  <Icon name="info" size={18} />

                  <span>
                    <strong>
                      Week {String(startWeek).padStart(2, "0")}
                      {" – "}
                      Week {String(selectedEndWeek).padStart(2, "0")}
                    </strong>
                    {" · "}
                    {formatDate(selectedRange.start_date)}
                    {" sampai "}
                    {formatDate(selectedRange.end_date)}
                  </span>
                </div>
              )}
            </section>

            {/* RINGKASAN */}

            <div className="rpt-stats">
              <StatCard
                icon="users"
                label="Peserta dalam Rentang"
                value={summary.participants}
                description="Sesuai filter dan periode"
              />

              <StatCard
                icon="calendar"
                label="Durasi Laporan"
                value={summary.weeks}
                description="Minggu terpilih"
              />

              <StatCard
                icon="book"
                label="Target Post-Test"
                value={summary.theoryTarget}
                description="2 sesi per minggu / peserta"
              />

              <StatCard
                icon="activity"
                label="Target Praktik"
                value={summary.practiceTarget}
                description="1 sesi per minggu / peserta"
              />
            </div>

            {/* KATEGORI */}

            <section className="rpt-card rpt-category-card">
              <div className="rpt-section-heading">
                <span className="rpt-section-icon">
                  <Icon name="award" size={21} />
                </span>

                <div>
                  <h2>Enam Kategori Achievement</h2>
                  <p>
                    Kategori kompetensi yang tetap digunakan
                    pada sistem monitoring peserta.
                  </p>
                </div>
              </div>

              <div className="rpt-category-list">
                {CATEGORIES.map((category, index) => (
                  <CategoryTag
                    key={category}
                    name={category}
                    index={index}
                  />
                ))}
              </div>
            </section>

            {/* DAFTAR PESERTA */}

            <section className="rpt-card">
              <div className="rpt-list-header">
                <div className="rpt-section-heading">
                  <span className="rpt-section-icon">
                    <Icon name="users" size={21} />
                  </span>

                  <div>
                    <h2>Daftar Peserta OJT</h2>
                    <p>
                      Pilih peserta untuk membuka rapor
                      sesuai rentang minggu terpilih.
                    </p>
                  </div>
                </div>

                <div className="rpt-filters">
                  <label className="rpt-search">
                    <Icon name="search" size={17} />

                    <input
                      type="search"
                      placeholder="Cari nama, departemen..."
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                    />
                  </label>

                  <label className="rpt-site">
                    <Icon name="filter" size={17} />

                    <select
                      value={site}
                      onChange={(event) =>
                        setSite(event.target.value)
                      }
                      aria-label="Filter Site"
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
                  </label>
                </div>
              </div>

              <p className="rpt-count">
                Menampilkan{" "}
                <strong>{filteredPrograms.length}</strong>
                {" "}peserta dalam rentang terpilih.
              </p>

              {filteredPrograms.length === 0 ? (
                <div className="rpt-empty">
                  <Icon name="report" size={35} />
                  <strong>Belum Ada Peserta</strong>
                  <p>
                    Tidak ditemukan program peserta OJT
                    yang sesuai dengan periode dan filter.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rpt-table-wrap">
                    <table className="rpt-table">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Nama Peserta</th>
                          <th>Departemen</th>
                          <th>Site</th>
                          <th>Periode Program</th>
                          <th>Status Program</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>

                      <tbody>
                        {filteredPrograms.map(
                          (program, index) => {
                            const person =
                              Array.isArray(program.peserta)
                                ? program.peserta[0]
                                : program.peserta;

                            return (
                              <tr key={program.id}>
                                <td>{index + 1}</td>

                                <td>
                                  <div className="rpt-person">
                                    <span className="rpt-avatar">
                                      {initials(person?.full_name)}
                                    </span>

                                    <strong>
                                      {person?.full_name ||
                                        "Peserta OJT"}
                                    </strong>
                                  </div>
                                </td>

                                <td>
                                  {person?.department || "—"}
                                </td>

                                <td>
                                  <span className="rpt-site-badge">
                                    {program.site || "—"}
                                  </span>
                                </td>

                                <td>
                                  {formatDate(program.start_date)}
                                  {" – "}
                                  {formatDate(program.end_date)}
                                </td>

                                <td>
                                  <span className="rpt-program-status">
                                    {program.status || "—"}
                                  </span>
                                </td>

                                <td>
                                  <button
                                    type="button"
                                    className="rpt-open"
                                    onClick={() =>
                                      openReport(program)
                                    }
                                  >
                                    Buka Rapor
                                    <Icon name="arrow" size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="rpt-mobile-list">
                    {filteredPrograms.map((program) => {
                      const person =
                        Array.isArray(program.peserta)
                          ? program.peserta[0]
                          : program.peserta;

                      return (
                        <div
                          className="rpt-mobile-item"
                          key={program.id}
                        >
                          <div className="rpt-person">
                            <span className="rpt-avatar">
                              {initials(person?.full_name)}
                            </span>

                            <div>
                              <strong>
                                {person?.full_name || "Peserta OJT"}
                              </strong>
                              <small>
                                {person?.department || "—"}
                              </small>
                            </div>
                          </div>

                          <div className="rpt-mobile-meta">
                            <span>Site</span>
                            <strong>
                              {program.site || "—"}
                            </strong>
                          </div>

                          <div className="rpt-mobile-meta">
                            <span>Periode OJT</span>
                            <strong>
                              {formatDate(program.start_date)}
                              {" – "}
                              {formatDate(program.end_date)}
                            </strong>
                          </div>

                          <div className="rpt-mobile-meta">
                            <span>Status Program</span>
                            <strong>
                              {program.status || "—"}
                            </strong>
                          </div>

                          <button
                            type="button"
                            className="rpt-open"
                            onClick={() => openReport(program)}
                          >
                            Buka Rapor
                            <Icon name="arrow" size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>

            {/* INFORMASI */}

            <section className="rpt-information">
              <Icon name="info" size={21} />

              <div>
                <strong>Informasi Rapor Terintegrasi</strong>

                <p>
                  Rapor menggunakan rentang Kalender Global
                  Week 01–25. Jadwal per minggu terdiri dari
                  dua Post-Test dan satu Praktik.
                </p>

                <p>
                  Jumlah penilaian di atas adalah target
                  jadwal, bukan nilai aktual. Nilai teori,
                  praktik, Achievement, Samapta, dan SIMPER
                  tetap mengikuti data yang tercatat
                  pada masing-masing modul.
                </p>

                <p>
                  Halaman ini tidak menghapus atau mengubah
                  data rapor periode lama di Supabase.
                </p>
              </div>
            </section>
          </>
        )}

        <footer className="rpt-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal · Program 2026–2027
        </footer>
      </main>
    </div>
  );
}

// =====================================================
// STYLE — CORPORATE MINING / RAPOR TERINTEGRASI
// =====================================================

const css = `
.rpt-root,
.rpt-root * {
  box-sizing: border-box;
}

.rpt-root {
  min-height: 100vh;
  color: #193b38;
  background: #f3f7f7;
  font-family: Arial, Helvetica, sans-serif;
}

.rpt-root button,
.rpt-root select,
.rpt-root input {
  font-family: inherit;
}

.rpt-root button {
  cursor: pointer;
}

.rpt-root button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.rpt-root button:focus-visible,
.rpt-root select:focus-visible,
.rpt-root input:focus-visible {
  outline: 3px solid #75cba8;
  outline-offset: 2px;
}

/* HEADER */

.rpt-topbar {
  min-height: 73px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 13px 28px;
  background: linear-gradient(
    105deg,
    #061e26,
    #06473e
  );
  color: white;
}

.rpt-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rpt-brand-mark {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 11px;
  background: #ffffff15;
  color: #59deb1;
  font-size: 27px;
}

.rpt-brand strong {
  display: block;
  font-size: 21px;
  font-weight: 900;
}

.rpt-brand strong span {
  color: #42d2a4;
}

.rpt-brand small {
  display: block;
  margin-top: 5px;
  color: #b1d3c9;
  font-size: 9px;
  letter-spacing: .8px;
}

.rpt-top-actions {
  display: flex;
  gap: 9px;
}

.rpt-top-actions button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  border: 1px solid #ffffff40;
  border-radius: 9px;
  background: #ffffff12;
  color: white;
  font-size: 12px;
  font-weight: 800;
}

/* MAIN */

.rpt-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 23px;
}

/* HERO */

.rpt-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 25px;
  min-height: 207px;
  padding: 30px;
  border-radius: 17px;
  background:
    linear-gradient(
      100deg,
      #071e2af7,
      #10463ff0 55%,
      #17473ebb
    ),
    url("/background-erg.png.PNG")
      center/cover;
  color: white;
}

.rpt-hero-text {
  max-width: 730px;
}

.rpt-eyebrow {
  color: #edca85;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.3px;
}

.rpt-hero h1 {
  margin: 14px 0 10px;
  font-size: clamp(28px,3.3vw,43px);
  letter-spacing: -.8px;
}

.rpt-hero h1 span {
  color: #50e1af;
}

.rpt-hero p {
  margin: 0;
  color: #d7ece6;
  font-size: 13px;
  line-height: 1.8;
}

.rpt-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 19px;
}

.rpt-hero-tags span {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid #ffffff2b;
  border-radius: 8px;
  background: #ffffff12;
  color: #e1f6ee;
  font-size: 11px;
}

.rpt-hero-tags svg {
  color: #e9c87f;
}

.rpt-hero-right {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-width: 180px;
  padding: 20px;
  border: 1px solid #ffffff40;
  border-radius: 13px;
  background: #082a2bb5;
  text-align: center;
}

.rpt-hero-number {
  font-size: 52px;
  font-weight: 900;
}

.rpt-hero-right strong {
  color: #e9c87f;
  font-size: 10px;
  letter-spacing: 1px;
}

.rpt-hero-right small {
  font-size: 11px;
  color: #c8e3db;
}

/* BREADCRUMB */

.rpt-breadcrumb {
  padding: 16px 3px;
  color: #92a5a6;
  font-size: 11px;
}

.rpt-breadcrumb strong {
  color: #0a805b;
}

/* CARD */

.rpt-card {
  padding: 21px;
  margin-bottom: 16px;
  border: 1px solid #e1eaea;
  border-radius: 14px;
  background: white;
  box-shadow: 0 5px 17px #0f323909;
}

.rpt-section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.rpt-section-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #e3f5eb;
  color: #0a8662;
}

.rpt-section-heading h2 {
  margin: 0;
  color: #153e37;
  font-size: 17px;
  font-weight: 900;
}

.rpt-section-heading p {
  margin: 6px 0 0;
  color: #819695;
  font-size: 11px;
  line-height: 1.5;
}

/* WEEK RANGE */

.rpt-range-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 15px;
}

.rpt-field label {
  display: block;
  margin-bottom: 8px;
  color: #48655f;
  font-size: 12px;
  font-weight: 800;
}

.rpt-field select {
  width: 100%;
  min-height: 44px;
  padding: 11px 13px;
  border: 1px solid #d8e6e3;
  border-radius: 9px;
  background: #fbfdfc;
  color: #1e403b;
  font-size: 12px;
}

.rpt-presets {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 17px;
}

.rpt-presets > span {
  margin-right: 4px;
  color: #768e89;
  font-size: 11px;
  font-weight: 700;
}

.rpt-presets button {
  padding: 9px 12px;
  border: 1px solid #d7e6e0;
  border-radius: 8px;
  background: #f5faf7;
  color: #168060;
  font-size: 11px;
  font-weight: 800;
}

.rpt-presets button:hover {
  background: #e2f5eb;
}

.rpt-range-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 17px;
  padding: 13px;
  border: 1px solid #d1e9da;
  border-radius: 9px;
  background: #eef9f2;
  color: #247451;
  font-size: 12px;
  line-height: 1.6;
}

.rpt-range-info svg {
  flex-shrink: 0;
}

/* STATS */

.rpt-stats {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.rpt-stat {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 105px;
  padding: 17px;
  border: 1px solid #e0eae8;
  border-radius: 13px;
  background: white;
}

.rpt-stat-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 11px;
  background: #e1f5e8;
  color: #0a8661;
}

.rpt-stat > div {
  display: grid;
  gap: 5px;
}

.rpt-stat-label {
  color: #70847f;
  font-size: 11px;
  font-weight: 800;
}

.rpt-stat strong {
  color: #173b34;
  font-size: 29px;
}

.rpt-stat small {
  color: #8a9c99;
  font-size: 10px;
  line-height: 1.5;
}

/* CATEGORIES */

.rpt-category-list {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.rpt-category {
  padding: 10px 13px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 900;
}

.rpt-category.cat-0 {
  color: #b74141;
  background: #fcebea;
}

.rpt-category.cat-1 {
  color: #a96b19;
  background: #fff1da;
}

.rpt-category.cat-2 {
  color: #9f7d00;
  background: #fff8d2;
}

.rpt-category.cat-3 {
  color: #147d54;
  background: #e3f5e8;
}

.rpt-category.cat-4 {
  color: #207ba4;
  background: #e2f3fb;
}

.rpt-category.cat-5 {
  color: #6d53b4;
  background: #eee9fc;
}

/* LIST */

.rpt-list-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
}

.rpt-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}

.rpt-search,
.rpt-site {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid #dbe6e4;
  border-radius: 9px;
  background: #fbfdfc;
  color: #829791;
}

.rpt-search input,
.rpt-site select {
  min-height: 39px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #24493f;
  font-size: 12px;
}

.rpt-search input {
  width: 210px;
}

.rpt-site select {
  max-width: 150px;
}

.rpt-count {
  margin: 0 0 15px;
  color: #839792;
  font-size: 11px;
}

.rpt-count strong {
  color: #087e59;
}

/* DESKTOP TABLE */

.rpt-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.rpt-table {
  width: 100%;
  min-width: 910px;
  border-collapse: collapse;
  text-align: left;
  font-size: 12px;
}

.rpt-table th {
  padding: 13px 12px;
  background: #edf4f1;
  color: #5b756c;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
}

.rpt-table td {
  padding: 15px 12px;
  border-bottom: 1px solid #ebf0ee;
  color: #426058;
}

.rpt-person {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rpt-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 39px;
  height: 39px;
  border-radius: 10px;
  background: #e0f4e9;
  color: #09835d;
  font-size: 12px;
  font-weight: 900;
}

.rpt-person strong {
  color: #1b4237;
  font-size: 12px;
}

.rpt-site-badge {
  display: inline-block;
  padding: 7px 9px;
  border-radius: 7px;
  background: #eef3f2;
  color: #526d65;
  font-size: 11px;
  font-weight: 800;
}

.rpt-program-status {
  display: inline-block;
  padding: 7px 10px;
  border-radius: 8px;
  background: #f1f4f1;
  color: #627c71;
  font-size: 11px;
  font-weight: 800;
  text-transform: capitalize;
}

.rpt-open {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 12px;
  border: 0;
  border-radius: 8px;
  background: #08875f;
  color: white;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
}

.rpt-open:hover {
  background: #076a4d;
}

.rpt-mobile-list {
  display: none;
}

.rpt-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 40px 15px;
  color: #899a94;
  text-align: center;
}

.rpt-empty strong {
  color: #4b675f;
  font-size: 13px;
}

.rpt-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
}

/* INFORMATION */

.rpt-information {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 17px;
  border: 1px solid #d8e8e1;
  border-radius: 12px;
  background: #edf8f1;
  color: #287452;
}

.rpt-information > svg {
  flex-shrink: 0;
}

.rpt-information strong {
  font-size: 13px;
}

.rpt-information p {
  margin: 8px 0 0;
  color: #597d6d;
  font-size: 11px;
  line-height: 1.7;
}

.rpt-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 14px;
  border: 1px solid #fac6c6;
  border-radius: 10px;
  background: #fff2f2;
  color: #b22323;
  font-size: 12px;
}

.rpt-loading {
  padding: 35px;
  text-align: center;
  color: #708d82;
}

.rpt-footer {
  padding: 25px 0 10px;
  color: #98a8a1;
  font-size: 10px;
  text-align: center;
}

/* RESPONSIVE */

@media(max-width:1100px) {
  .rpt-stats {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .rpt-list-header {
    flex-direction: column;
  }
}

@media(max-width:700px) {
  .rpt-topbar {
    min-height: 62px;
    padding: 11px 13px;
  }

  .rpt-brand strong {
    font-size: 17px;
  }

  .rpt-brand small {
    font-size: 8px;
  }

  .rpt-top-actions button {
    padding: 9px;
  }

  .rpt-top-actions button span {
    display: none;
  }

  .rpt-content {
    padding: 12px;
  }

  .rpt-hero {
    flex-direction: column;
    align-items: stretch;
    padding: 24px 18px;
  }

  .rpt-hero h1 {
    font-size: 30px;
  }

  .rpt-hero-right {
    min-width: 0;
    padding: 13px;
  }

  .rpt-hero-number {
    font-size: 35px;
  }

  .rpt-card {
    padding: 15px;
  }

  .rpt-range-grid {
    grid-template-columns: 1fr;
  }

  .rpt-section-heading h2 {
    font-size: 15px;
  }

  .rpt-stats {
    gap: 9px;
  }

  .rpt-stat {
    padding: 12px;
    min-height: 100px;
    gap: 9px;
  }

  .rpt-stat-icon {
    width: 35px;
    height: 35px;
  }

  .rpt-stat strong {
    font-size: 25px;
  }

  .rpt-stat-label {
    font-size: 10px;
  }

  .rpt-filters,
  .rpt-search {
    width: 100%;
  }

  .rpt-search input {
    width: 100%;
  }

  .rpt-site {
    flex: 1;
  }

  .rpt-site select {
    width: 100%;
    max-width: none;
  }

  .rpt-table-wrap {
    display: none;
  }

  .rpt-mobile-list {
    display: grid;
    gap: 10px;
  }

  .rpt-mobile-item {
    padding: 15px;
    border: 1px solid #e2eae6;
    border-radius: 10px;
  }

  .rpt-mobile-item .rpt-person {
    margin-bottom: 14px;
  }

  .rpt-mobile-item .rpt-person strong,
  .rpt-mobile-item .rpt-person small {
    display: block;
  }

  .rpt-mobile-item .rpt-person small {
    margin-top: 5px;
    color: #849b91;
    font-size: 11px;
  }

  .rpt-mobile-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid #edf2ee;
    font-size: 11px;
  }

  .rpt-mobile-meta span {
    color: #81968d;
  }

  .rpt-mobile-meta strong {
    color: #385b4d;
    text-align: right;
  }

  .rpt-mobile-item .rpt-open {
    width: 100%;
    margin-top: 13px;
  }
}
`;

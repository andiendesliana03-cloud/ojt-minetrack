
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// MONITORING ACHIEVEMENT
// DESAIN SERAGAM DENGAN DETAIL PESERTA
// GLOBAL CALENDAR WEEK 01–25
// ======================================================

const TOTAL_WEEKS = 25;

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "🎓" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "📍" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );

  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, index) => {
    const start =
      index === 0
        ? "2026-09-12"
        : addDays("2026-09-20", (index - 1) * 7);

    return {
      week: index + 1,
      start,
      end: addDays(start, 6),
    };
  }
);

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);

  if (!parseDate(date)) return null;

  return (
    GLOBAL_WEEKS.find(
      item => date >= item.start && date <= item.end
    )?.week ?? null
  );
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
    return false;
  }

  const start = String(program.start_date).slice(0, 10);

  const end = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  return (
    date >= start &&
    (!end || date <= end) &&
    globalWeekOf(date) !== null
  );
}

function programWeekRange(program, weekNumber) {
  const global = GLOBAL_WEEKS[weekNumber - 1];

  if (
    !global ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const begin = String(program.start_date).slice(0, 10);

  const finish = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > begin ? global.start : begin;

  const end =
    finish && finish < global.end
      ? finish
      : global.end;

  return start <= end ? { start, end } : null;
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = type =>
    parts.find(item => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function initialWeek(program, records) {
  const available = GLOBAL_WEEKS.filter(
    item => programWeekRange(program, item.week)
  );

  if (!available.length) return 1;

  const today = todayWITA();

  const current = available.find(item => {
    const range = programWeekRange(program, item.week);

    return (
      range &&
      today >= range.start &&
      today <= range.end
    );
  });

  if (current) return current.week;

  const recorded = records
    .filter(item =>
      insideProgram(item.activity_date, program)
    )
    .map(item => globalWeekOf(item.activity_date))
    .filter(number =>
      available.some(item => item.week === number)
    );

  if (recorded.length) {
    return Math.max(...recorded);
  }

  return (
    available.find(item => item.start > today)?.week ||
    available[available.length - 1].week
  );
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function num(value, digits = 2) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        maximumFractionDigits: digits,
      })
    : "—";
}

function kmText(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function clamp(value) {
  return Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] || "")
    .join("")
    .toUpperCase();
}

function categoryName(value) {
  const key = normalize(value);

  if (["fisik", "physical"].includes(key)) {
    return "Fisik";
  }

  if (
    ["training", "internaltraining", "pelatihan"]
      .includes(key)
  ) {
    return "Training";
  }

  if (
    ["sosialisasi", "socialization"].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (
    ["coaching", "pembinaan"].includes(key)
  ) {
    return "Coaching";
  }

  if (
    ["orientasi", "orientasiarea", "areaorientation"]
      .includes(key)
  ) {
    return "Orientasi Area";
  }

  if (
    ["hazard", "hazardidentification", "identifikasibahaya"]
      .includes(key)
  ) {
    return "Hazard";
  }

  return null;
}

function categoryFor(record, types) {
  const type = types.find(
    item =>
      normalize(item.code) === normalize(record.type_code)
  );

  const name =
    categoryName(record.type_code) ||
    categoryName(type?.name);

  return TARGETS.find(item => item.name === name) || null;
}

function achievedValue(records, category) {
  if (category.name !== "Fisik") {
    return records.length;
  }

  const totalMeters = records.reduce((sum, item) => {
    const distance = Number(item.distance_km);

    return sum + (
      Number.isFinite(distance) && distance > 0
        ? Math.round(distance * 1000)
        : 0
    );
  }, 0);

  return totalMeters / 1000;
}

function amountText(value, category) {
  return category.name === "Fisik"
    ? `${kmText(value)} km`
    : `${value} kegiatan`;
}

function ProgressBar({ value }) {
  const safe = clamp(value);

  return (
    <div
      className="ma-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function SummaryCard({
  icon,
  value,
  title,
  subtitle,
  tone = "green",
}) {
  return (
    <div className={`ma-summary-card ${tone}`}>
      <span className="ma-summary-icon">{icon}</span>

      <div>
        <strong>{value}</strong>
        <span>{title}</span>

        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function MonitoringAchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [account, setAccount] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [week, setWeek] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [error, setError] = useState("");

  const role = roleText(account?.role);

  const canManage =
    role === "admin" || role === "mentor";

  const isParticipant =
    role === "participant" || role === "peserta";

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const accountName =
    account?.full_name || "Pengguna";

  const roleName =
    role === "admin"
      ? "Administrator"
      : role === "mentor"
      ? "Mentor OJT"
      : "Peserta OJT";

  const selectedPeriod = GLOBAL_WEEKS[week - 1];

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter(item =>
        programWeekRange(program, item.week)
      ),
    [program]
  );

  const selectedProgramRange =
    programWeekRange(program, week);

  // ====================================================
  // SUPABASE & VALIDASI AKSES
  // ====================================================

  async function verifyAccess() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        "Sesi login tidak tersedia. Silakan login kembali."
      );
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error("Profil pengguna tidak ditemukan.");
    }

    const currentRole = roleText(profile.role);

    if (
      !["admin", "mentor", "participant", "peserta"]
        .includes(currentRole)
    ) {
      throw new Error(
        "Akun tidak memiliki akses Monitoring Achievement."
      );
    }

    let query = supabase
      .from("ojt_programs")
      .select(`
        id,
        participant_id,
        mentor_id,
        site,
        start_date,
        end_date,
        status,
        peserta:profiles!ojt_programs_participant_id_fkey(
          full_name,
          department
        )
      `)
      .eq("id", programId);

    if (currentRole === "mentor") {
      query = query.eq("mentor_id", user.id);
    }

    if (
      currentRole === "participant" ||
      currentRole === "peserta"
    ) {
      query = query
        .eq("participant_id", user.id)
        .eq("status", "active");
    }

    const { data: programData, error: programError } =
      await query.maybeSingle();

    if (programError) throw programError;

    if (!programData) {
      throw new Error(
        "Program OJT tidak ditemukan atau akses ditolak."
      );
    }

    if (!parseDate(programData.start_date)) {
      throw new Error(
        "Tanggal mulai program OJT tidak valid."
      );
    }

    return { user, profile, programData };
  }

  async function fetchRecords(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name")
        .order("name"),

      supabase
        .from("achievement_records")
        .select(
          "id,program_id,type_code,activity_date,distance_km,status"
        )
        .eq("program_id", id)
        .order("activity_date", { ascending: false }),
    ]);

    if (results[0].error) {
      throw results[0].error;
    }

    if (results[1].error) {
      throw results[1].error;
    }

    return {
      types: results[0].data || [],
      records: results[1].data || [],
    };
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program OJT tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const access = await verifyAccess();

        const data = await fetchRecords(
          access.programData.id
        );

        if (!active) return;

        setAccount(access.profile);
        setProgram(access.programData);
        setTypes(data.types);
        setRecords(data.records);

        setWeek(
          initialWeek(access.programData, data.records)
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
            "Gagal memuat Monitoring Achievement."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId]);

  async function refresh() {
    if (
      !program ||
      !account ||
      refreshing ||
      loading
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess();

      if (access.user.id !== account.id) {
        setAccount(null);
        setProgram(null);

        throw new Error(
          "Akun login berubah. Buka ulang halaman."
        );
      }

      const data = await fetchRecords(
        access.programData.id
      );

      setAccount(access.profile);
      setProgram(access.programData);
      setTypes(data.types);
      setRecords(data.records);
    } catch (err) {
      setError(
        err?.message ||
        "Gagal memperbarui monitoring."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ====================================================
  // DATA ACHIEVEMENT
  // ====================================================

  const validRecords = useMemo(
    () =>
      records.filter(item =>
        insideProgram(item.activity_date, program)
      ),
    [records, program]
  );

  const weeklyRecords = useMemo(
    () =>
      validRecords.filter(
        item =>
          globalWeekOf(item.activity_date) === week
      ),
    [validRecords, week]
  );

  const verified = useMemo(
    () =>
      weeklyRecords.filter(
        item => roleText(item.status) === "verified"
      ),
    [weeklyRecords]
  );

  const pending = useMemo(
    () =>
      weeklyRecords.filter(
        item => roleText(item.status) === "pending"
      ),
    [weeklyRecords]
  );

  const categories = useMemo(() => {
    return TARGETS.map(category => {
      const matched = weeklyRecords.filter(
        item =>
          categoryFor(item, types)?.name === category.name
      );

      const valid = matched.filter(
        item => roleText(item.status) === "verified"
      );

      const waiting = matched.filter(
        item => roleText(item.status) === "pending"
      );

      const actual = achievedValue(valid, category);

      const percent = clamp(
        (actual / category.target) * 100
      );

      return {
        ...category,
        actual,
        count: valid.length,
        verified: valid.length,
        pending: waiting.length,
        percent,
        achieved: actual >= category.target,
      };
    });
  }, [weeklyRecords, types]);

  const weeklyProgress =
    categories.reduce(
      (sum, item) => sum + item.percent,
      0
    ) / TARGETS.length;

  const completedCategories =
    categories.filter(item => item.achieved).length;

  const chart = useMemo(() => {
    return GLOBAL_WEEKS.map(item => {
      const matched = validRecords.filter(
        record =>
          globalWeekOf(record.activity_date) === item.week
      );

      return {
        ...item,
        total: matched.length,
        verified: matched.filter(
          record =>
            roleText(record.status) === "verified"
        ).length,
        pending: matched.filter(
          record =>
            roleText(record.status) === "pending"
        ).length,
        available: Boolean(
          programWeekRange(program, item.week)
        ),
      };
    });
  }, [validRecords, program]);

  const maxChart = Math.max(
    1,
    ...chart.map(item => item.verified)
  );

  const activeWeeks = chart.filter(
    item => item.available && item.total > 0
  ).length;

  const activeVerifiedWeeks = chart.filter(
    item => item.available && item.verified > 0
  ).length;

  function changeWeek(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return;

    setWeek(
      Math.max(
        1,
        Math.min(TOTAL_WEEKS, Math.round(number))
      )
    );
  }

  function goBack() {
    router.push(
      isParticipant
        ? "/dashboard-peserta"
        : `/peserta/${programId}`
    );
  }

  // ====================================================
  // LOADING / ERROR
  // ====================================================

  if (loading) {
    return (
      <main className="ma-loading">
        <h2>OJT MineTrack</h2>
        <p>Memuat Monitoring Achievement...</p>
      </main>
    );
  }

  if (!account || !program) {
    return (
      <main className="ma-loading">
        <h2>Monitoring Achievement Tidak Tersedia</h2>

        <p>
          {error || "Akses tidak tersedia."}
        </p>

        <button onClick={goBack}>
          Kembali
        </button>
      </main>
    );
  }

  // ====================================================
  // TAMPILAN BARU
  // ====================================================

  return (
    <div
      className={`ma-app ${
        presentation ? "ma-presentation" : ""
      }`}
    >
      <style>{css}</style>

      {/* HEADER */}

      <header className="ma-topbar">
        <button
          className="ma-brand"
          onClick={() => router.push("/")}
        >
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </button>

        <nav className="ma-nav">
          <button
            onClick={() => router.push("/")}
          >
            ⌂ Dashboard
          </button>

          {canManage && (
            <button
              onClick={() =>
                router.push("/mentor/monitoring-peserta")
              }
            >
              ♙ Peserta OJT
            </button>
          )}

          {canManage && (
            <button
              onClick={() =>
                router.push(`/achievement/${programId}`)
              }
            >
              ▤ Input Achievement
            </button>
          )}

          <button className="active">
            ▥ Monitoring
          </button>
        </nav>

        <div className="ma-account">
          <span className="ma-avatar-small">
            {initials(accountName)}
          </span>

          <div>
            <strong>{accountName}</strong>
            <small>{roleName}</small>
          </div>
        </div>
      </header>

      <main className="ma-content">

        {/* JUDUL */}

        <div className="ma-title-row">
          <div>
            <small>
              Monitoring Kompetensi dan Evaluasi OJT
            </small>

            <h1>
              Monitoring <span>Achievement OJT</span>
            </h1>

            <p>
              Pantau perkembangan peserta berdasarkan
              Kalender Global 25 minggu.
            </p>
          </div>

          <div className="ma-toolbar">
            <button
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh"}
            </button>

            <button
              onClick={() =>
                setPresentation(value => !value)
              }
            >
              {presentation
                ? "Tampilan Normal"
                : "Mode Presentasi"}
            </button>

            <button onClick={() => window.print()}>
              ⎙ Cetak
            </button>
          </div>
        </div>

        {error && (
          <div className="ma-alert" role="alert">
            {error}
          </div>
        )}

        {/* IDENTITAS PESERTA */}

        <section className="ma-profile">
          <div className="ma-profile-main">
            <div className="ma-profile-avatar">
              {initials(participantName)}
            </div>

            <div className="ma-profile-copy">
              <h2>{participantName}</h2>

              <p>
                {participant?.department || "—"}
                {"  |  "}
                {program.site || "—"}
              </p>

              <div className="ma-profile-facts">
                <div>
                  <span>📅</span>

                  <div>
                    <small>Periode OJT</small>
                    <strong>
                      {formatDate(program.start_date)}
                      {" – "}
                      {formatDate(program.end_date)}
                    </strong>
                  </div>
                </div>

                <div>
                  <span>📊</span>

                  <div>
                    <small>Kalender Global</small>
                    <strong>
                      Week 01–25
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ma-profile-side">
            <span className="ma-participant-badge">
              PESERTA OJT
            </span>

            <strong>
              Emergency Response Group
            </strong>

            <small>PT Berau Coal</small>
            <span className="ma-accent" />
          </div>
        </section>

        {/* SUMMARY MINGGUAN */}

        <section className="ma-card">
          <div className="ma-section-head">
            <div>
              <h2>Capaian Achievement Mingguan</h2>

              <p>
                Ringkasan kegiatan terverifikasi
                pada minggu yang dipilih.
              </p>
            </div>

            <div className="ma-week-control">
              <button
                disabled={week <= 1}
                onClick={() => changeWeek(week - 1)}
                aria-label="Minggu sebelumnya"
              >
                ‹
              </button>

              <select
                aria-label="Pilih minggu global"
                value={week}
                onChange={event =>
                  changeWeek(event.target.value)
                }
              >
                {GLOBAL_WEEKS.map(item => (
                  <option
                    key={item.week}
                    value={item.week}
                  >
                    {weekLabel(item.week)}
                    {" · "}
                    {formatDate(item.start)}
                    {" – "}
                    {formatDate(item.end)}
                    {!availableWeeks.some(
                      available =>
                        available.week === item.week
                    )
                      ? " · Di luar periode"
                      : ""}
                  </option>
                ))}
              </select>

              <button
                disabled={week >= TOTAL_WEEKS}
                onClick={() => changeWeek(week + 1)}
                aria-label="Minggu berikutnya"
              >
                ›
              </button>
            </div>
          </div>

          <div className="ma-week-overview">
            <div className="ma-week-heading">
              <span className="ma-week-icon">
                📊
              </span>

              <div>
                <small>Capaian Achievement</small>

                <h2>
                  Week {String(week).padStart(2, "0")}
                </h2>

                <p>
                  {formatDate(selectedPeriod.start)}
                  {" – "}
                  {formatDate(selectedPeriod.end)}
                </p>
              </div>
            </div>

            <div
              className="ma-donut"
              style={{
                "--progress": `${weeklyProgress}%`,
              }}
            >
              <div>
                <strong>
                  {num(weeklyProgress)}%
                </strong>

                <small>
                  Rata-rata
                  <br />
                  Pencapaian
                </small>
              </div>
            </div>

            <SummaryCard
              icon="✓"
              value={verified.length}
              title="Terverifikasi"
              subtitle="Verified"
              tone="green"
            />

            <SummaryCard
              icon="◷"
              value={pending.length}
              title="Menunggu"
              subtitle="Pending"
              tone="amber"
            />

            <SummaryCard
              icon="▦"
              value={`${completedCategories}/6`}
              title="Kategori"
              subtitle="Target tercapai"
              tone="blue"
            />
          </div>

          <div className="ma-range-note">
            <span>
              Total kegiatan:
              {" "}
              <strong>{weeklyRecords.length}</strong>
            </span>

            {selectedProgramRange ? (
              <span>
                Periode peserta pada minggu ini:
                {" "}
                <strong>
                  {formatDate(selectedProgramRange.start)}
                  {" – "}
                  {formatDate(selectedProgramRange.end)}
                </strong>
              </span>
            ) : (
              <span>
                Minggu ini di luar periode peserta.
              </span>
            )}
          </div>
        </section>

        {/* ENAM KATEGORI */}

        <section className="ma-card">
          <div className="ma-section-head">
            <div>
              <h2>Pencapaian 6 Kategori</h2>

              <p>
                Realisasi kegiatan Verified
                pada {weekLabel(week)}.
              </p>
            </div>

            <strong className="ma-section-score">
              {num(weeklyProgress)}%
            </strong>
          </div>

          <div className="ma-category-grid">
            {categories.map(item => (
              <article
                key={item.name}
                className="ma-category"
              >
                <div className="ma-category-title">
                  <span className="ma-category-icon">
                    {item.icon}
                  </span>

                  <strong>{item.name}</strong>
                </div>

                <div className="ma-category-percent">
                  {num(item.percent)}%
                </div>

                <ProgressBar value={item.percent} />

                <div className="ma-category-details">
                  <div>
                    <span>Realisasi</span>

                    <strong>
                      {amountText(item.actual, item)}
                    </strong>
                  </div>

                  <div>
                    <span>Target</span>

                    <strong>
                      {item.target} {item.unit}
                    </strong>
                  </div>

                  <div>
                    <span>Verified</span>

                    <strong>
                      {item.verified}
                    </strong>
                  </div>

                  <div>
                    <span>Pending</span>

                    <strong>
                      {item.pending}
                    </strong>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="ma-note">
            Hanya kegiatan Verified yang dihitung
            sebagai pencapaian. Realisasi tidak dibatasi,
            sedangkan persentase maksimal 100%.
          </p>
        </section>

        {/* GRAFIK DAN AKTIVITAS */}

        <div className="ma-lower-grid">
          <section className="ma-card">
            <div className="ma-section-head">
              <div>
                <h2>Grafik Achievement Mingguan</h2>

                <p>
                  Jumlah Achievement Verified
                  Week 01–25.
                </p>
              </div>

              <strong className="ma-section-score">
                {verified.length} Verified
              </strong>
            </div>

            <div className="ma-chart-scroll">
              <div className="ma-chart">
                {chart.map(item => {
                  const height = item.verified
                    ? Math.max(
                        6,
                        (item.verified / maxChart) * 100
                      )
                    : 0;

                  return (
                    <button
                      key={item.week}
                      className={[
                        "ma-chart-column",
                        item.week === week
                          ? "selected"
                          : "",
                        !item.available
                          ? "outside"
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        changeWeek(item.week)
                      }
                      title={
                        `${weekLabel(item.week)}: ` +
                        `${item.verified} Verified`
                      }
                    >
                      <strong>
                        {item.verified}
                      </strong>

                      <span className="ma-chart-track">
                        <i
                          style={{
                            height: `${height}%`,
                          }}
                        />
                      </span>

                      <small>
                        W{String(item.week).padStart(2, "0")}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="ma-note">
              Klik batang grafik untuk mengganti
              minggu monitoring.
            </p>
          </section>

          <section className="ma-card">
            <div className="ma-section-head">
              <div>
                <h2>Aktivitas 25 Minggu</h2>

                <p>
                  Sebaran minggu yang memiliki
                  catatan Achievement.
                </p>
              </div>

              <strong className="ma-section-score">
                {activeWeeks}/
                {availableWeeks.length}
              </strong>
            </div>

            <div className="ma-activity-stats">
              <div>
                <strong>{activeWeeks}</strong>
                <span>Minggu memiliki kegiatan</span>
              </div>

              <div>
                <strong>{activeVerifiedWeeks}</strong>
                <span>Minggu memiliki Verified</span>
              </div>
            </div>

            <div className="ma-week-grid">
              {chart.map(item => (
                <button
                  key={item.week}
                  className={[
                    "ma-week-box",
                    item.total > 0
                      ? "has-data"
                      : "",
                    !item.available
                      ? "outside"
                      : "",
                    item.week === week
                      ? "selected"
                      : "",
                  ].join(" ")}
                  onClick={() =>
                    changeWeek(item.week)
                  }
                  title={
                    `${weekLabel(item.week)} · ` +
                    `${formatDate(item.start)} – ` +
                    `${formatDate(item.end)}`
                  }
                >
                  W{String(item.week).padStart(2, "0")}
                </button>
              ))}
            </div>

            <div className="ma-legend">
              <span>🟢 Ada kegiatan</span>
              <span>⚪ Belum ada</span>
              <span>◻ Di luar periode</span>
            </div>
          </section>
        </div>

        {/* TOMBOL NAVIGASI */}

        <div className="ma-bottom-actions">
          <button onClick={goBack}>
            ← {isParticipant
              ? "Dashboard Peserta"
              : "Detail Peserta"}
          </button>

          {canManage && (
            <button
              className="primary"
              onClick={() =>
                router.push(`/achievement/${programId}`)
              }
            >
              ✍️ Input Achievement
            </button>
          )}
        </div>

        <footer className="ma-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </main>
    </div>
  );
}

// ======================================================
// CSS - CLEAN ENTERPRISE DESIGN
// ======================================================

const css = `
.ma-app,
.ma-app * {
  box-sizing: border-box;
}

.ma-app {
  min-height: 100vh;
  background: #f5f8fa;
  color: #142c41;
  font-family: Arial, Helvetica, sans-serif;
}

.ma-app button,
.ma-app select {
  font: inherit;
}

.ma-app button {
  cursor: pointer;
}

.ma-app button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.ma-loading {
  min-height: 100vh;
  padding: 40px;
  background: #f5f8fa;
  color: #142c41;
  font-family: Arial, sans-serif;
}

.ma-loading button {
  margin-top: 15px;
  border: none;
  padding: 12px 16px;
  background: #0b8b61;
  color: white;
  border-radius: 9px;
}

/* HEADER */

.ma-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 69px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 0 27px;
  background: #fff;
  border-bottom: 1px solid #e4ebef;
}

.ma-brand {
  display: flex;
  align-items: baseline;
  gap: 5px;
  border: 0;
  background: transparent;
  color: #142b40;
  font-size: 23px;
  font-weight: 900;
  white-space: nowrap;
}

.ma-brand span {
  color: #07865e;
}

.ma-brand small {
  margin-left: 4px;
  color: #8393a2;
  font-size: 10px;
}

.ma-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
}

.ma-nav button {
  border: 0;
  padding: 12px 15px;
  border-radius: 10px;
  background: transparent;
  color: #526579;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.ma-nav button:hover,
.ma-nav button.active {
  background: #e8f6ef;
  color: #087c58;
}

.ma-account {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ma-avatar-small {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #ddf4e9;
  color: #077d58;
  font-size: 12px;
  font-weight: 900;
}

.ma-account strong,
.ma-account small {
  display: block;
}

.ma-account strong {
  font-size: 11px;
}

.ma-account small {
  color: #8493a3;
  font-size: 10px;
  margin-top: 4px;
}

/* CONTENT */

.ma-content {
  max-width: 1510px;
  margin: 0 auto;
  padding: 25px;
}

.ma-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 19px;
}

.ma-title-row small {
  color: #788b9c;
  font-size: 12px;
}

.ma-title-row h1 {
  margin: 6px 0;
  font-size: clamp(25px, 3vw, 34px);
  letter-spacing: -.6px;
}

.ma-title-row h1 span {
  color: #07865e;
}

.ma-title-row p {
  margin: 0;
  font-size: 12px;
  color: #8090a1;
  line-height: 1.6;
}

.ma-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.ma-toolbar button,
.ma-bottom-actions button {
  padding: 11px 14px;
  border: 1px solid #dde7e9;
  border-radius: 9px;
  background: white;
  color: #29674f;
  font-size: 11px;
  font-weight: 800;
}

.ma-toolbar button:hover {
  background: #edf8f2;
}

.ma-alert {
  padding: 13px;
  margin-bottom: 15px;
  background: #fff0f0;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #b91c1c;
  font-size: 12px;
}

/* PROFILE */

.ma-profile {
  display: grid;
  grid-template-columns:
    minmax(0, 1.5fr)
    minmax(220px, .7fr);
  margin-bottom: 15px;
  background: white;
  border: 1px solid #e4ebf0;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 4px 15px #14304b08;
}

.ma-profile-main {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px;
  min-width: 0;
}

.ma-profile-avatar {
  width: 92px;
  height: 92px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: #ddf4e8;
  color: #087b58;
  border-radius: 14px;
  font-size: 35px;
  font-weight: 900;
}

.ma-profile-copy {
  min-width: 0;
}

.ma-profile-copy h2 {
  margin: 0 0 8px;
  font-size: 25px;
  overflow-wrap: anywhere;
}

.ma-profile-copy > p {
  margin: 0;
  color: #74879a;
  font-size: 12px;
  font-weight: 700;
}

.ma-profile-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-top: 18px;
}

.ma-profile-facts > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.ma-profile-facts > div > span {
  font-size: 19px;
}

.ma-profile-facts small,
.ma-profile-facts strong {
  display: block;
}

.ma-profile-facts small {
  color: #8798a7;
  font-size: 10px;
}

.ma-profile-facts strong {
  margin-top: 5px;
  font-size: 11px;
}

.ma-profile-side {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 22px;
  background:
    linear-gradient(
      90deg,
      #ffffff 0%,
      #ffffffe8 25%,
      #ffffff60 100%
    ),
    url("/background-erg.png.PNG") center/cover;
}

.ma-participant-badge {
  display: inline-block;
  margin-bottom: 13px;
  padding: 7px 11px;
  border-radius: 6px;
  background: #07835b;
  color: white;
  font-size: 10px;
  font-weight: 900;
}

.ma-profile-side strong {
  font-size: 12px;
}

.ma-profile-side small {
  margin-top: 5px;
  color: #526679;
  font-size: 11px;
}

.ma-accent {
  width: 43px;
  height: 4px;
  margin-top: 13px;
  border-radius: 10px;
  background: #087f58;
}

/* CARDS */

.ma-card {
  margin-bottom: 15px;
  padding: 18px;
  background: #fff;
  border: 1px solid #e4ebf0;
  border-radius: 15px;
  box-shadow: 0 4px 15px #14304b07;
  min-width: 0;
}

.ma-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 13px;
  margin-bottom: 16px;
}

.ma-section-head h2 {
  margin: 0;
  font-size: 17px;
}

.ma-section-head p {
  margin: 6px 0 0;
  color: #8594a4;
  font-size: 11px;
  line-height: 1.6;
}

.ma-section-score {
  color: #088c62;
  font-size: 21px;
}

/* WEEK CONTROL */

.ma-week-control {
  display: flex;
  align-items: center;
  gap: 5px;
}

.ma-week-control button,
.ma-week-control select {
  border: 1px solid #dfe8e7;
  background: #f8fbfa;
  border-radius: 8px;
  color: #12684c;
  padding: 10px;
  font-size: 11px;
  font-weight: 800;
}

.ma-week-control select {
  max-width: 315px;
}

/* WEEK OVERVIEW */

.ma-week-overview {
  display: grid;
  grid-template-columns:
    minmax(170px,1.5fr)
    135px
    repeat(3,minmax(90px,1fr));
  gap: 12px;
  align-items: center;
  padding: 15px;
  background: #f0faf5;
  border-radius: 12px;
}

.ma-week-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.ma-week-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 12px;
  background: #ddf3e6;
  font-size: 25px;
}

.ma-week-heading small {
  font-size: 11px;
  color: #078259;
  font-weight: 800;
}

.ma-week-heading h2 {
  margin: 6px 0;
  font-size: 22px;
}

.ma-week-heading p {
  margin: 0;
  color: #8290a0;
  font-size: 10px;
  line-height: 1.6;
}

.ma-donut {
  --progress: 0%;
  width: 115px;
  height: 115px;
  margin: auto;
  padding: 11px;
  border-radius: 50%;
  background: conic-gradient(
    #0ab67c var(--progress),
    #dcebe5 var(--progress)
  );
  display: grid;
  place-items: center;
}

.ma-donut > div {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ma-donut strong {
  font-size: 21px;
}

.ma-donut small {
  font-size: 9px;
  line-height: 1.5;
  text-align: center;
  color: #8492a0;
}

.ma-summary-card {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 105px;
  padding: 12px;
  border-radius: 11px;
}

.ma-summary-card.green {
  background: #e2f6ec;
  color: #087d58;
}

.ma-summary-card.amber {
  background: #fff4e5;
  color: #b77c12;
}

.ma-summary-card.blue {
  background: #e9f3ff;
  color: #2571bd;
}

.ma-summary-icon {
  font-size: 22px;
  font-weight: 900;
}

.ma-summary-card > div strong,
.ma-summary-card > div span,
.ma-summary-card > div small {
  display: block;
}

.ma-summary-card > div strong {
  font-size: 25px;
}

.ma-summary-card > div span {
  font-size: 11px;
  margin-top: 4px;
}

.ma-summary-card > div small {
  font-size: 9px;
  margin-top: 5px;
  opacity: .75;
}

.ma-range-note {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 24px;
  margin-top: 13px;
  color: #8294a3;
  font-size: 11px;
}

/* CATEGORIES */

.ma-category-grid {
  display: grid;
  grid-template-columns: repeat(6,minmax(0,1fr));
  gap: 10px;
}

.ma-category {
  min-width: 0;
  padding: 14px 12px;
  border: 1px solid #e3ebf0;
  border-radius: 11px;
  background: white;
}

.ma-category-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 35px;
}

.ma-category-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #edf8f2;
  font-size: 18px;
}

.ma-category-title strong {
  font-size: 11px;
  overflow-wrap: anywhere;
}

.ma-category-percent {
  margin: 13px 0 9px;
  font-size: 19px;
  font-weight: 900;
}

.ma-progress {
  width: 100%;
  height: 9px;
  overflow: hidden;
  background: #e2e9ec;
  border-radius: 20px;
}

.ma-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #12b680,
    #09855f
  );
}

.ma-category-details {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.ma-category-details > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
  font-size: 10px;
}

.ma-category-details span {
  color: #8392a2;
}

.ma-category-details strong {
  color: #293e50;
  text-align: right;
}

.ma-note {
  margin: 13px 0 0;
  color: #8696a4;
  line-height: 1.7;
  font-size: 11px;
}

/* LOWER GRID */

.ma-lower-grid {
  display: grid;
  grid-template-columns: 1.15fr .85fr;
  gap: 15px;
  align-items: start;
}

.ma-chart-scroll {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 9px;
}

.ma-chart {
  display: flex;
  align-items: stretch;
  gap: 7px;
  width: max-content;
  height: 205px;
  border-bottom: 1px solid #dce5e9;
}

.ma-chart-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  width: 29px;
  padding: 0;
  background: transparent;
  border: none;
  color: #8293a0;
}

.ma-chart-column strong,
.ma-chart-column small {
  font-size: 10px;
}

.ma-chart-track {
  display: flex;
  align-items: flex-end;
  width: 19px;
  height: 145px;
}

.ma-chart-track i {
  display: block;
  width: 100%;
  border-radius: 4px 4px 0 0;
  background: #49ca9f;
}

.ma-chart-column.selected .ma-chart-track i {
  background: #2487d7;
}

.ma-chart-column.selected {
  color: #1671bd;
  font-weight: 900;
}

.ma-chart-column.outside {
  opacity: .4;
}

.ma-chart-column.outside.selected {
  opacity: .85;
}

.ma-activity-stats {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 9px;
  margin-bottom: 15px;
}

.ma-activity-stats > div {
  padding: 12px;
  background: #f1faf5;
  border-radius: 10px;
}

.ma-activity-stats strong,
.ma-activity-stats span {
  display: block;
}

.ma-activity-stats strong {
  color: #08855d;
  font-size: 25px;
}

.ma-activity-stats span {
  margin-top: 6px;
  color: #8294a3;
  font-size: 10px;
}

.ma-week-grid {
  display: grid;
  grid-template-columns: repeat(5,minmax(0,1fr));
  gap: 6px;
}

.ma-week-box {
  border: 1px solid #dfe8eb;
  background: #f4f7f9;
  color: #687d8d;
  border-radius: 7px;
  padding: 10px 3px;
  font-size: 10px;
  font-weight: 800;
}

.ma-week-box.has-data {
  background: #dbf5e9;
  color: #087d58;
  border-color: #b8e7d1;
}

.ma-week-box.outside {
  opacity: .4;
}

.ma-week-box.selected {
  opacity: 1;
  background: #088c63;
  color: white;
  border-color: #088c63;
}

.ma-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 13px;
  color: #8293a2;
  font-size: 10px;
}

/* BOTTOM */

.ma-bottom-actions {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.ma-bottom-actions button.primary {
  color: white;
  background: #08885f;
  border-color: #08885f;
}

.ma-footer {
  padding: 25px 0;
  text-align: center;
  color: #98a5b0;
  font-size: 10px;
}

/* PRESENTATION */

.ma-presentation .ma-topbar {
  display: none;
}

.ma-presentation .ma-content {
  max-width: 1900px;
}

/* RESPONSIVE */

@media(max-width:1400px) {
  .ma-category-grid {
    grid-template-columns: repeat(3,minmax(0,1fr));
  }
}

@media(max-width:1150px) {
  .ma-topbar {
    flex-wrap: wrap;
    height: auto;
    padding: 13px;
  }

  .ma-nav {
    order: 3;
    width: 100%;
    justify-content: flex-start;
    overflow-x: auto;
  }

  .ma-week-overview {
    grid-template-columns: repeat(3,minmax(0,1fr));
  }

  .ma-week-heading {
    grid-column: span 2;
  }

  .ma-donut {
    grid-column: span 1;
  }

  .ma-lower-grid {
    grid-template-columns: 1fr;
  }
}

@media(max-width:850px) {
  .ma-profile {
    grid-template-columns: 1fr;
  }

  .ma-profile-side {
    min-height: 110px;
  }

  .ma-category-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
}

@media(max-width:650px) {
  .ma-content {
    padding: 13px;
  }

  .ma-title-row h1 {
    font-size: 26px;
  }

  .ma-profile-main {
    padding: 15px;
    gap: 12px;
  }

  .ma-profile-avatar {
    width: 66px;
    height: 66px;
    font-size: 25px;
  }

  .ma-profile-copy h2 {
    font-size: 19px;
  }

  .ma-profile-facts {
    gap: 12px;
  }

  .ma-card {
    padding: 13px;
  }

  .ma-week-overview {
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap: 8px;
    padding: 10px;
  }

  .ma-week-heading {
    grid-column: 1 / -1;
  }

  .ma-donut {
    grid-column: 1 / -1;
    margin: 8px auto;
  }

  .ma-summary-card {
    padding: 10px 5px;
    gap: 4px;
    min-height: 95px;
  }

  .ma-summary-icon {
    font-size: 16px;
  }

  .ma-summary-card > div strong {
    font-size: 22px;
  }

  .ma-summary-card > div span {
    font-size: 9px;
  }

  .ma-category-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 8px;
  }

  .ma-category {
    padding: 11px;
  }

  .ma-category-title {
    flex-wrap: wrap;
  }

  .ma-week-control {
    width: 100%;
  }

  .ma-week-control select {
    flex: 1;
    min-width: 0;
    max-width: none;
  }

  .ma-account {
    max-width: 150px;
  }

  .ma-account > div {
    overflow-wrap: anywhere;
  }
}

@media(max-width:390px) {
  .ma-category-grid {
    grid-template-columns: 1fr;
  }

  .ma-profile-main {
    flex-wrap: wrap;
  }
}

@media print {
  @page {
    size: A4 landscape;
    margin: 9mm;
  }

  .ma-topbar,
  .ma-toolbar,
  .ma-week-control,
  .ma-bottom-actions {
    display: none !important;
  }

  .ma-content {
    max-width: none;
    padding: 0;
  }

  .ma-card,
  .ma-profile {
    box-shadow: none;
    break-inside: avoid;
  }

  .ma-app {
    background: white;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;

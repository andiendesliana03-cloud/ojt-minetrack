
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// MONITORING ACHIEVEMENT — SIMPLIFIED
// Kalender Global Week 01–25
// Tanpa Progres Keseluruhan dan Riwayat Achievement
// =====================================================

const TOTAL_WEEKS = 25;

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "🎓" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
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
      (item) => date >= item.start && date <= item.end
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
  const week = GLOBAL_WEEKS[weekNumber - 1];

  if (
    !week ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const startProgram = String(program.start_date).slice(0, 10);

  const endProgram = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    week.start > startProgram
      ? week.start
      : startProgram;

  const end =
    endProgram && endProgram < week.end
      ? endProgram
      : week.end;

  return start <= end
    ? { start, end }
    : null;
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function initialWeek(program, records) {
  const available = GLOBAL_WEEKS.filter(
    (item) => programWeekRange(program, item.week)
  );

  if (!available.length) return 1;

  const today = todayWITA();

  const current = available.find((item) => {
    const range = programWeekRange(program, item.week);

    return (
      range &&
      today >= range.start &&
      today <= range.end
    );
  });

  if (current) return current.week;

  const recorded = records
    .filter((item) =>
      insideProgram(item.activity_date, program)
    )
    .map((item) => globalWeekOf(item.activity_date))
    .filter((week) =>
      available.some((item) => item.week === week)
    );

  if (recorded.length) {
    return Math.max(...recorded);
  }

  return available.find(
    (item) => item.start > today
  )?.week || available[available.length - 1].week;
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

function numberText(value, digits = 2) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "—";
}

function kmText(value) {
  return numberText(value, 3);
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
    .map((word) => word[0] || "")
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
    (item) =>
      normalize(item.code) === normalize(record.type_code)
  );

  const name =
    categoryName(record.type_code) ||
    categoryName(type?.name);

  return TARGETS.find(
    (item) => item.name === name
  ) || null;
}

function achievedValue(records, category) {
  if (category.name !== "Fisik") {
    return records.length;
  }

  const meters = records.reduce((sum, record) => {
    const km = Number(record.distance_km);

    return sum + (
      Number.isFinite(km) && km > 0
        ? Math.round(km * 1000)
        : 0
    );
  }, 0);

  return meters / 1000;
}

function amountText(value, category) {
  return category.name === "Fisik"
    ? `${kmText(value)} km`
    : `${value} kegiatan`;
}

function ProgressBar({ value }) {
  return (
    <div
      className="am-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamp(value)}
    >
      <span style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

// =====================================================
// HALAMAN UTAMA
// =====================================================

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

  const selectedPeriod = GLOBAL_WEEKS[week - 1];

  const availableWeeks = useMemo(() => {
    return GLOBAL_WEEKS.filter(
      (item) => programWeekRange(program, item.week)
    );
  }, [program]);

  const selectedParticipantRange = programWeekRange(
    program,
    week
  );

  // ===================================================
  // AKSES DAN SUPABASE
  // ===================================================

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

    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;

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
        if (!active) return;

        setError(
          err?.message ||
          "Gagal memuat Monitoring Achievement."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId]);

  async function refresh() {
    if (!program || !account || refreshing || loading) {
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

      setProgram(access.programData);
      setAccount(access.profile);
      setTypes(data.types);
      setRecords(data.records);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui monitoring."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ===================================================
  // DATA MINGGUAN
  // ===================================================

  const validRecords = useMemo(
    () =>
      records.filter(
        (record) =>
          insideProgram(record.activity_date, program)
      ),
    [records, program]
  );

  const weeklyRecords = useMemo(
    () =>
      validRecords.filter(
        (record) =>
          globalWeekOf(record.activity_date) === week
      ),
    [validRecords, week]
  );

  const verified = useMemo(
    () =>
      weeklyRecords.filter(
        (record) => roleText(record.status) === "verified"
      ),
    [weeklyRecords]
  );

  const pending = useMemo(
    () =>
      weeklyRecords.filter(
        (record) => roleText(record.status) === "pending"
      ),
    [weeklyRecords]
  );

  const verificationPercent = weeklyRecords.length
    ? (verified.length / weeklyRecords.length) * 100
    : 0;

  const categories = useMemo(() => {
    return TARGETS.map((category) => {
      const related = weeklyRecords.filter(
        (record) =>
          categoryFor(record, types)?.name === category.name
      );

      const valid = related.filter(
        (record) =>
          roleText(record.status) === "verified"
      );

      const waiting = related.filter(
        (record) =>
          roleText(record.status) === "pending"
      );

      const actual = achievedValue(valid, category);

      return {
        ...category,
        actual,
        total: related.length,
        verified: valid.length,
        pending: waiting.length,
        targetPercent: clamp(
          (actual / category.target) * 100
        ),
        completed: actual >= category.target,
      };
    });
  }, [weeklyRecords, types]);

  const overallWeek = categories.reduce(
    (sum, item) => sum + item.targetPercent,
    0
  ) / TARGETS.length;

  const achievedCategories = categories.filter(
    (item) => item.completed
  ).length;

  // ===================================================
  // GRAFIK & AKTIVITAS 25 MINGGU
  // ===================================================

  const chart = useMemo(() => {
    return GLOBAL_WEEKS.map((item) => {
      const matching = validRecords.filter(
        (record) =>
          globalWeekOf(record.activity_date) === item.week
      );

      return {
        ...item,
        total: matching.length,
        verified: matching.filter(
          (record) =>
            roleText(record.status) === "verified"
        ).length,
        pending: matching.filter(
          (record) =>
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
    ...chart.map((item) => item.verified)
  );

  const activeWeeks = chart.filter(
    (item) => item.available && item.total > 0
  ).length;

  const activeVerifiedWeeks = chart.filter(
    (item) => item.available && item.verified > 0
  ).length;

  function changeWeek(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return;

    const next = Math.max(
      1,
      Math.min(TOTAL_WEEKS, Math.round(number))
    );

    setWeek(next);
  }

  function goBack() {
    router.push(
      isParticipant
        ? "/dashboard-peserta"
        : `/peserta/${programId}`
    );
  }

  // ===================================================
  // LOADING / ERROR
  // ===================================================

  if (loading) {
    return (
      <main className="am-loading">
        Memuat Monitoring Achievement OJT...
      </main>
    );
  }

  if (!account || !program) {
    return (
      <main className="am-loading">
        <h2>Monitoring Achievement Tidak Tersedia</h2>

        <p>{error || "Akses tidak tersedia."}</p>

        <button onClick={goBack}>
          Kembali
        </button>
      </main>
    );
  }

  // ===================================================
  // UI MONITORING SIMPLIFIED
  // ===================================================

  return (
    <main
      className={
        `am-root ${presentation ? "am-presentation" : ""}`
      }
    >
      <style>{css}</style>

      <header className="am-header">
        <div className="am-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="am-account">
          <div>
            <small>
              {role === "admin"
                ? "Administrator"
                : role === "mentor"
                ? "Mentor OJT"
                : "Peserta OJT"}
            </small>

            <strong>
              {account.full_name || "Pengguna"}
            </strong>
          </div>

          <button onClick={goBack}>
            ← Kembali
          </button>
        </div>
      </header>

      <div className="am-container">
        <section className="am-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>

            <h1>
              Monitoring <span>Achievement OJT</span>
            </h1>

            <p>
              Pantau pencapaian, verifikasi, dan aktivitas
              berdasarkan Kalender Global 25 minggu.
            </p>
          </div>

          <div className="am-person">
            <span className="am-avatar">
              {initials(participant?.full_name)}
            </span>

            <div>
              <strong>
                {participant?.full_name || "Peserta OJT"}
              </strong>

              <span>
                {participant?.department || "—"}
                {" · "}
                {program.site || "Site belum diisi"}
              </span>

              <small>
                {formatDate(program.start_date)}
                {" – "}
                {formatDate(program.end_date)}
              </small>
            </div>
          </div>
        </section>

        <nav className="am-tabs">
          {canManage && (
            <button
              onClick={() =>
                router.push(`/achievement/${programId}`)
              }
            >
              ✍️ Input Achievement
            </button>
          )}

          <span className="active">
            📊 Monitoring Achievement
          </span>
        </nav>

        {error && (
          <div className="am-error" role="alert">
            {error}
          </div>
        )}

        <div className="am-toolbar">
          <div>
            <strong>Dashboard Monitoring Mingguan</strong>
            <small>
              Kalender Global OJT 2026–2027
            </small>
          </div>

          <div className="am-actions">
            <button
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh"}
            </button>

            <button
              className="primary"
              onClick={() =>
                setPresentation((value) => !value)
              }
            >
              {presentation
                ? "Tampilan Normal"
                : "▣ Mode Presentasi"}
            </button>

            <button onClick={() => window.print()}>
              🖨 Cetak
            </button>
          </div>
        </div>

        {/* ======================================
            MONITORING MINGGUAN
        ====================================== */}

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Monitoring Mingguan</h2>
              <p>
                Ringkasan kegiatan dan verifikasi
                berdasarkan minggu global.
              </p>
            </div>

            <div className="am-week-control">
              <button
                disabled={week <= 1}
                onClick={() => changeWeek(week - 1)}
                aria-label="Minggu sebelumnya"
              >
                ‹
              </button>

              <select
                value={week}
                onChange={(event) =>
                  changeWeek(event.target.value)
                }
                aria-label="Pilih minggu global"
              >
                {GLOBAL_WEEKS.map((item) => (
                  <option
                    key={item.week}
                    value={item.week}
                  >
                    {weekLabel(item.week)}
                    {!availableWeeks.some(
                      (available) =>
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

          <div className="am-period">
            <strong>{weekLabel(week)}</strong>

            <span>
              {formatDate(selectedPeriod.start)}
              {" – "}
              {formatDate(selectedPeriod.end)}
            </span>

            {!selectedParticipantRange && (
              <em>Di luar periode OJT peserta</em>
            )}
          </div>

          {selectedParticipantRange && (
            <p className="am-period-note">
              Periode peserta pada minggu ini:
              {" "}
              {formatDate(selectedParticipantRange.start)}
              {" – "}
              {formatDate(selectedParticipantRange.end)}
            </p>
          )}

          <div className="am-stats">
            <div className="am-stat">
              <span>Total Achievement</span>
              <strong>{weeklyRecords.length}</strong>
              <small>Kegiatan minggu terpilih</small>
            </div>

            <div className="am-stat green">
              <span>Terverifikasi</span>
              <strong>{verified.length}</strong>
              <small>Achievement Verified</small>
            </div>

            <div className="am-stat orange">
              <span>Menunggu</span>
              <strong>{pending.length}</strong>
              <small>Achievement Pending</small>
            </div>

            <div className="am-stat blue">
              <span>Persentase Verifikasi</span>
              <strong>
                {numberText(verificationPercent, 2)}%
              </strong>
              <small>Verified dari total catatan</small>
            </div>
          </div>
        </section>

        {/* ======================================
            ENAM KATEGORI MINGGUAN
        ====================================== */}

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Progres Enam Kategori</h2>

              <p>
                Pencapaian Verified terhadap target
                pada {weekLabel(week)}.
              </p>
            </div>

            <div className="am-week-overall">
              <span>Rata-rata Mingguan</span>
              <strong>
                {numberText(overallWeek, 2)}%
              </strong>
              <small>
                {achievedCategories}/6 kategori tercapai
              </small>
            </div>
          </div>

          <div className="am-category-grid">
            {categories.map((item) => (
              <article
                className="am-category"
                key={item.name}
              >
                <div className="am-category-head">
                  <span className="am-icon">
                    {item.icon}
                  </span>

                  <div>
                    <strong>{item.name}</strong>

                    <small>
                      Target {item.target} {item.unit}
                      {" / minggu"}
                    </small>
                  </div>

                  <strong className="am-category-percent">
                    {numberText(item.targetPercent, 0)}%
                  </strong>
                </div>

                <div className="am-category-actual">
                  <strong>
                    {amountText(item.actual, item)}
                  </strong>

                  <span>
                    dari {item.target} {item.unit}
                  </span>
                </div>

                <ProgressBar
                  value={item.targetPercent}
                />

                <div className="am-category-footer">
                  <span>
                    {item.verified} Verified
                  </span>

                  <span>
                    {item.pending} Pending
                  </span>

                  <span>
                    {item.completed
                      ? "✓ Target tercapai"
                      : "Belum mencapai target"}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <p className="am-note">
            Realisasi hanya menghitung Achievement Verified.
            Jarak Fisik dijumlahkan dalam kilometer,
            sedangkan lima kategori lainnya menggunakan
            jumlah kegiatan. Persentase dibatasi maksimal
            100%, tetapi nilai realisasi tetap ditampilkan
            sesuai data asli.
          </p>
        </section>

        {/* ======================================
            GRAFIK & AKTIVITAS GLOBAL
        ====================================== */}

        <div className="am-two-columns">
          <section className="am-card">
            <div className="am-section-head">
              <div>
                <h2>Grafik Achievement Mingguan</h2>

                <p>
                  Jumlah kegiatan Verified pada
                  Kalender Global Week 01–25.
                </p>
              </div>
            </div>

            <div className="am-chart-scroll">
              <div className="am-chart">
                {chart.map((item) => {
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
                        "am-chart-column",
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
                        `${item.verified} Verified` +
                        (
                          item.available
                            ? ""
                            : " · Di luar periode peserta"
                        )
                      }
                    >
                      <strong>
                        {item.verified}
                      </strong>

                      <span className="am-bar-track">
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

            <p className="am-note">
              Pilih batang grafik untuk melihat minggu
              tertentu. Grafik menunjukkan jumlah kegiatan
              Verified, bukan jumlah kilometer.
              Minggu di luar periode peserta ditampilkan
              lebih redup.
            </p>
          </section>

          <section className="am-card">
            <div className="am-section-head">
              <div>
                <h2>Aktivitas 25 Minggu</h2>

                <p>
                  Sebaran minggu dengan
                  Achievement yang tercatat.
                </p>
              </div>

              <strong className="am-highlight">
                {activeWeeks}/
                {availableWeeks.length}
              </strong>
            </div>

            <div className="am-activity-summary">
              <div>
                <strong>{activeWeeks}</strong>
                <span>Minggu dengan kegiatan</span>
              </div>

              <div>
                <strong>{activeVerifiedWeeks}</strong>
                <span>Minggu memiliki Verified</span>
              </div>
            </div>

            <div className="am-week-grid">
              {chart.map((item) => (
                <button
                  key={item.week}
                  className={[
                    "am-week",
                    item.total > 0
                      ? "has-data"
                      : "",
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
                    `${weekLabel(item.week)} · ` +
                    `${formatDate(item.start)} – ` +
                    `${formatDate(item.end)} · ` +
                    `${item.total} kegiatan`
                  }
                >
                  W{String(item.week).padStart(2, "0")}
                </button>
              ))}
            </div>

            <div className="am-legend">
              <span>
                <i className="dot has-data" />
                Ada kegiatan
              </span>

              <span>
                <i className="dot empty" />
                Belum ada
              </span>

              <span>
                <i className="dot outside" />
                Di luar periode
              </span>
            </div>

            <p className="am-note">
              Jumlah minggu aktif mengikuti rentang
              Kalender Global yang beririsan dengan
              periode OJT peserta.
            </p>
          </section>
        </div>

        {/* ======================================
            AKSES CEPAT
        ====================================== */}

        <section className="am-card am-access-card">
          <div>
            <h2>Detail dan Pengelolaan Achievement</h2>

            <p>
              Riwayat kegiatan, pencarian data,
              serta fungsi edit dan hapus tersedia
              di halaman Input Achievement.
            </p>
          </div>

          <div className="am-access-actions">
            {canManage && (
              <button
                className="primary"
                onClick={() =>
                  router.push(
                    `/achievement/${programId}`
                  )
                }
              >
                ✍️ Buka Input Achievement
              </button>
            )}

            <button onClick={goBack}>
              ← {isParticipant
                ? "Dashboard Peserta"
                : "Detail Peserta"}
            </button>
          </div>
        </section>

        <footer className="am-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// CSS — PROFESSIONAL MINIMAL
// =====================================================

const css = `
  * {
    box-sizing: border-box;
  }

  .am-root {
    min-height: 100vh;
    background: #f4f8f9;
    color: #183348;
    font-family: Arial, Helvetica, sans-serif;
  }

  .am-root button,
  .am-root select {
    font: inherit;
  }

  .am-root button {
    cursor: pointer;
  }

  .am-root button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .am-loading {
    min-height: 100vh;
    padding: 35px;
    background: #f4f8f9;
    color: #183348;
    font-family: Arial, sans-serif;
  }

  .am-loading button {
    border: none;
    border-radius: 9px;
    padding: 12px 16px;
    background: #0b8b61;
    color: #fff;
  }

  .am-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 15px 27px;
    color: white;
    background: #071e27;
  }

  .am-brand {
    font-size: 24px;
    font-weight: 900;
  }

  .am-brand span {
    color: #30c996;
  }

  .am-brand small {
    margin-left: 7px;
    color: #b8c9d1;
    font-size: 10px;
  }

  .am-account {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .am-account small,
  .am-account strong {
    display: block;
    text-align: right;
  }

  .am-account small {
    color: #afc9c1;
    font-size: 10px;
    margin-bottom: 5px;
  }

  .am-account strong {
    font-size: 12px;
  }

  .am-account button {
    border: 1px solid #ffffff40;
    background: #ffffff14;
    color: white;
    padding: 10px 13px;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-container {
    max-width: 1480px;
    margin: auto;
    padding: 20px;
  }

  .am-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    padding: 28px;
    border-radius: 16px;
    color: white;
    background:
      linear-gradient(
        100deg,
        rgba(5,25,34,.97),
        rgba(5,70,60,.80)
      ),
      url("/background-erg.png.PNG");
    background-position: center;
    background-size: cover;
  }

  .am-hero > div:first-child > small {
    color: #efcb7c;
    font-size: 10px;
    letter-spacing: 1px;
    font-weight: 900;
  }

  .am-hero h1 {
    font-size: clamp(27px,3vw,38px);
    line-height: 1.2;
    margin: 12px 0 9px;
  }

  .am-hero h1 span {
    color: #42d7a1;
  }

  .am-hero p {
    max-width: 510px;
    margin: 0;
    color: #d8ebe5;
    line-height: 1.7;
    font-size: 13px;
  }

  .am-person {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 13px;
    background: #082c30c9;
    border: 1px solid #ffffff35;
    border-radius: 12px;
  }

  .am-avatar {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 11px;
    color: #087656;
    background: #d9f4e7;
    font-size: 17px;
    font-weight: 900;
  }

  .am-person strong,
  .am-person span,
  .am-person small {
    display: block;
  }

  .am-person strong {
    font-size: 13px;
  }

  .am-person span,
  .am-person small {
    color: #c8e0d8;
    font-size: 10px;
    margin-top: 6px;
  }

  .am-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 15px 0;
  }

  .am-tabs button,
  .am-tabs span {
    border: 1px solid #dce8e3;
    background: white;
    color: #347057;
    border-radius: 10px;
    padding: 12px 15px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-tabs .active {
    background: #0b8d64;
    border-color: #0b8d64;
    color: white;
  }

  .am-error {
    padding: 14px;
    margin-bottom: 15px;
    background: #fff0f0;
    border: 1px solid #fecaca;
    border-radius: 10px;
    color: #b91c1c;
    font-size: 12px;
  }

  .am-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 14px;
  }

  .am-toolbar > div:first-child > strong,
  .am-toolbar > div:first-child > small {
    display: block;
  }

  .am-toolbar > div:first-child > strong {
    font-size: 15px;
  }

  .am-toolbar > div:first-child > small {
    margin-top: 6px;
    color: #8395a0;
    font-size: 11px;
  }

  .am-actions,
  .am-access-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .am-actions button,
  .am-access-actions button {
    padding: 11px 15px;
    border: 1px solid #d9e7df;
    border-radius: 9px;
    background: white;
    color: #175f49;
    font-size: 12px;
    font-weight: 800;
  }

  .am-actions .primary,
  .am-access-actions .primary {
    background: #0b8b61;
    border-color: #0b8b61;
    color: white;
  }

  .am-card {
    padding: 21px;
    margin-bottom: 15px;
    background: white;
    border: 1px solid #e2eaf0;
    border-radius: 15px;
    min-width: 0;
    box-shadow: 0 4px 16px #14304b08;
  }

  .am-section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 17px;
  }

  .am-section-head h2,
  .am-access-card h2 {
    margin: 0;
    font-size: 18px;
    color: #173047;
  }

  .am-section-head p,
  .am-access-card p {
    margin: 7px 0 0;
    color: #8192a2;
    font-size: 12px;
    line-height: 1.6;
  }

  .am-week-control {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .am-week-control button,
  .am-week-control select {
    border: 1px solid #dbe8e0;
    background: #f8fbf9;
    border-radius: 9px;
    padding: 10px;
    color: #11684e;
    font-size: 12px;
    font-weight: 800;
  }

  .am-week-control select {
    max-width: 205px;
  }

  .am-period {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 12px;
    border-radius: 10px;
    background: #eef8f2;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .am-period strong {
    color: #087d58;
  }

  .am-period span {
    color: #668176;
  }

  .am-period em {
    color: #b17b22;
    font-size: 11px;
    font-style: normal;
    font-weight: 800;
  }

  .am-period-note {
    margin: 9px 0 14px;
    color: #8295a0;
    font-size: 11px;
  }

  .am-stats {
    display: grid;
    grid-template-columns: repeat(4,minmax(0,1fr));
    gap: 11px;
    margin-top: 14px;
  }

  .am-stat {
    padding: 16px;
    background: #f5f8fa;
    border: 1px solid #e7eef1;
    border-radius: 11px;
    min-width: 0;
  }

  .am-stat.green {
    background: #e9f8f0;
  }

  .am-stat.orange {
    background: #fff6e8;
  }

  .am-stat.blue {
    background: #ecf5ff;
  }

  .am-stat span,
  .am-stat small {
    display: block;
    color: #748999;
    font-size: 11px;
  }

  .am-stat strong {
    display: block;
    margin: 9px 0;
    color: #173047;
    font-size: 28px;
  }

  .am-week-overall {
    text-align: right;
  }

  .am-week-overall span,
  .am-week-overall small {
    display: block;
    color: #8094a2;
    font-size: 11px;
  }

  .am-week-overall strong {
    display: block;
    margin: 5px 0;
    font-size: 26px;
    color: #0a986e;
  }

  .am-category-grid {
    display: grid;
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap: 12px;
  }

  .am-category {
    min-width: 0;
    border: 1px solid #e3ebef;
    border-radius: 12px;
    padding: 16px;
    background: #fbfdfc;
  }

  .am-category-head {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .am-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    background: #e5f6ed;
    border-radius: 10px;
    font-size: 20px;
  }

  .am-category-head > div {
    min-width: 0;
    flex: 1;
  }

  .am-category-head > div strong,
  .am-category-head > div small {
    display: block;
  }

  .am-category-head > div strong {
    font-size: 13px;
  }

  .am-category-head > div small {
    margin-top: 5px;
    font-size: 10px;
    color: #8697a3;
  }

  .am-category-percent {
    font-size: 15px;
    color: #07855d;
  }

  .am-category-actual {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 9px;
    margin: 17px 0 10px;
  }

  .am-category-actual strong {
    font-size: 21px;
    color: #087d5a;
  }

  .am-category-actual span {
    color: #8295a0;
    font-size: 11px;
  }

  .am-progress {
    width: 100%;
    height: 9px;
    background: #e2ece8;
    border-radius: 20px;
    overflow: hidden;
  }

  .am-progress span {
    display: block;
    height: 100%;
    background: linear-gradient(
      90deg,#2dc491,#0a9268
    );
    border-radius: inherit;
  }

  .am-category-footer {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 7px;
    margin-top: 13px;
    font-size: 10px;
    color: #788e9b;
  }

  .am-note {
    margin: 14px 0 0;
    color: #8295a0;
    font-size: 11px;
    line-height: 1.8;
  }

  .am-two-columns {
    display: grid;
    grid-template-columns: 1.15fr .85fr;
    gap: 15px;
    align-items: start;
  }

  .am-chart-scroll {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 9px;
  }

  .am-chart {
    display: flex;
    align-items: stretch;
    gap: 7px;
    min-width: max-content;
    height: 220px;
    border-bottom: 1px solid #dce6ea;
  }

  .am-chart-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    width: 29px;
    gap: 7px;
    padding: 0;
    border: none;
    background: transparent;
    color: #7e929d;
  }

  .am-chart-column strong,
  .am-chart-column small {
    font-size: 10px;
  }

  .am-bar-track {
    display: flex;
    align-items: flex-end;
    width: 19px;
    height: 155px;
  }

  .am-bar-track i {
    display: block;
    width: 100%;
    background: #45c99e;
    border-radius: 5px 5px 0 0;
  }

  .am-chart-column.selected .am-bar-track i {
    background: #2485dd;
  }

  .am-chart-column.selected {
    color: #126dbd;
    font-weight: 900;
  }

  .am-chart-column.outside {
    opacity: .36;
  }

  .am-chart-column.selected.outside {
    opacity: .8;
  }

  .am-highlight {
    font-size: 23px;
    color: #08875e;
  }

  .am-activity-summary {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 10px;
    margin-bottom: 16px;
  }

  .am-activity-summary > div {
    padding: 13px;
    border-radius: 10px;
    background: #f3faf6;
  }

  .am-activity-summary strong {
    display: block;
    font-size: 24px;
    color: #087f59;
  }

  .am-activity-summary span {
    display: block;
    margin-top: 6px;
    color: #82939e;
    font-size: 10px;
  }

  .am-week-grid {
    display: grid;
    grid-template-columns: repeat(5,minmax(0,1fr));
    gap: 7px;
  }

  .am-week {
    padding: 11px 3px;
    border: 1px solid #e1e9ed;
    background: #f4f7f9;
    color: #61798a;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
  }

  .am-week.has-data {
    background: #daf5e8;
    color: #087e59;
    border-color: #b6e7d0;
  }

  .am-week.outside {
    opacity: .38;
  }

  .am-week.selected {
    background: #0a8b62;
    border-color: #0a8b62;
    color: white;
    opacity: 1;
  }

  .am-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 13px;
    margin-top: 14px;
    color: #8193a0;
    font-size: 10px;
  }

  .am-legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .am-legend .dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    display: inline-block;
  }

  .am-legend .dot.has-data {
    background: #19a675;
  }

  .am-legend .dot.empty {
    background: #dce6e9;
  }

  .am-legend .dot.outside {
    background: #b3c0cb;
    opacity: .5;
  }

  .am-access-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 17px;
  }

  .am-access-card > div:first-child {
    max-width: 560px;
  }

  .am-footer {
    padding: 20px 0;
    color: #899ca6;
    text-align: center;
    font-size: 11px;
  }

  .am-presentation .am-header,
  .am-presentation .am-tabs {
    display: none;
  }

  .am-presentation .am-container {
    max-width: 1900px;
  }

  @media(max-width:1100px) {
    .am-two-columns {
      grid-template-columns: 1fr;
    }

    .am-category-grid {
      grid-template-columns: repeat(2,minmax(0,1fr));
    }
  }

  @media(max-width:700px) {
    .am-header {
      padding: 13px;
    }

    .am-brand {
      font-size: 19px;
    }

    .am-account {
      gap: 8px;
    }

    .am-account strong {
      font-size: 10px;
    }

    .am-account button {
      padding: 9px;
      font-size: 10px;
    }

    .am-container {
      padding: 12px;
    }

    .am-hero {
      padding: 19px;
    }

    .am-hero h1 {
      font-size: 25px;
    }

    .am-person {
      width: 100%;
    }

    .am-card {
      padding: 15px;
    }

    .am-stats {
      grid-template-columns: repeat(2,minmax(0,1fr));
      gap: 8px;
    }

    .am-stat {
      padding: 12px;
    }

    .am-stat strong {
      font-size: 23px;
    }

    .am-category-grid {
      grid-template-columns: 1fr;
    }

    .am-week-overall {
      text-align: left;
    }

    .am-section-head h2 {
      font-size: 16px;
    }

    .am-week-grid {
      gap: 5px;
    }

    .am-week {
      padding: 10px 2px;
      font-size: 10px;
    }

    .am-actions,
    .am-access-actions {
      width: 100%;
    }

    .am-actions button,
    .am-access-actions button {
      flex: 1;
    }
  }

  @media print {
    @page {
      size: A4 landscape;
      margin: 9mm;
    }

    .am-header,
    .am-tabs,
    .am-actions,
    .am-week-control,
    .am-access-card {
      display: none !important;
    }

    .am-root {
      background: white;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .am-container {
      max-width: none;
      padding: 0;
    }

    .am-card {
      box-shadow: none;
      break-inside: avoid;
    }

    .am-hero {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`;

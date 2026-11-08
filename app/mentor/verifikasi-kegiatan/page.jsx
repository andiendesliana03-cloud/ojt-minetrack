
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// VERIFIKASI & MONITORING MENTOR / ADMIN
// Database, status, target, kalender tetap.
// =====================================================

const BUCKET = "achievement-files";
const THEME_KEY = "ojt-minetrack-theme";

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📘" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const P2 = (n) => String(n).padStart(2, "0");

const norm = (s) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const dateKey = (d) => d.toISOString().slice(0, 10);

const addDays = (d, n) =>
  new Date(d.getTime() + n * 86400000);

// =====================================================
// KALENDER GLOBAL 25 MINGGU — TIDAK DIUBAH
// =====================================================

const WEEKS = Array.from({ length: 25 }, (_, i) => {
  const start =
    i === 0
      ? new Date(Date.UTC(2026, 8, 12))
      : addDays(
          new Date(Date.UTC(2026, 8, 20)),
          (i - 1) * 7
        );

  return {
    number: i + 1,
    start: dateKey(start),
    end: dateKey(addDays(start, 6)),
  };
});

function weekOf(value) {
  const d = String(value ?? "").slice(0, 10);

  return (
    WEEKS.find(
      (w) => d >= w.start && d <= w.end
    )?.number ?? null
  );
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((p) => p.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function showDate(value) {
  const d = String(value ?? "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "—";

  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

function displayNum(value, digits = 1) {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

// =====================================================
// PERBAIKAN DOKUMENTASI OJT_FILE_V1
// =====================================================

function parseActivity(raw) {
  let file = null;

  const cleaned = String(raw ?? "").replace(
    /\[\[OJT_FILE_V1:([\s\S]*?)\]\]/g,
    (_, encoded) => {
      try {
        const obj = JSON.parse(
          decodeURIComponent(encoded)
        );

        if (
          typeof obj?.path === "string" &&
          obj.path.trim()
        ) {
          file = {
            path: obj.path.trim(),
            name: String(
              obj.name || "Dokumentasi kegiatan"
            ),
          };
        }
      } catch {
        // Metadata rusak tidak ditampilkan sebagai teks.
      }

      return "";
    }
  );

  return {
    description: cleaned
      .split("[[OJT_FILE_V1:")[0]
      .trim(),
    file,
  };
}

function isImage(file) {
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(
    file?.name || file?.path || ""
  );
}

function categoryName(row, types) {
  const value =
    types[row.type_code] ||
    row.type_code ||
    "Lainnya";

  return (
    TARGETS.find(
      (t) => norm(t.name) === norm(value)
    )?.name || value
  );
}

function countAchievement(rows, category) {
  if (category === "Fisik") {
    return rows.reduce((total, r) => {
      const km = Number(r.distance_km);

      return (
        total +
        (Number.isFinite(km) && km > 0 ? km : 0)
      );
    }, 0);
  }

  return rows.length;
}

function computeProgress(
  rows,
  typeMap,
  week,
  programId
) {
  const verified = rows.filter(
    (r) =>
      r.program_id === programId &&
      r.status === "verified" &&
      weekOf(r.activity_date) === week
  );

  const categories = TARGETS.map((t) => {
    const match = verified.filter(
      (r) =>
        categoryName(r, typeMap) === t.name
    );

    const amount = countAchievement(
      match,
      t.name
    );

    return {
      ...t,
      amount,
      percent: Math.min(
        100,
        (amount / t.target) * 100
      ),
    };
  });

  return {
    categories,
    percent: Math.round(
      categories.reduce(
        (s, c) => s + c.percent,
        0
      ) / 6
    ),
  };
}

function initials(name) {
  return String(name || "OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((t) => t[0])
    .join("")
    .toUpperCase();
}

// =====================================================
// HALAMAN UTAMA
// =====================================================

export default function VerifikasiKegiatanPage() {
  const router = useRouter();

  const [account, setAccount] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [records, setRecords] = useState([]);
  const [types, setTypes] = useState({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dark, setDark] = useState(false);

  const [status, setStatus] = useState("pending");
  const [weekFilter, setWeekFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] =
    useState("all");
  const [search, setSearch] = useState("");

  const [monitorWeek, setMonitorWeek] = useState(1);
  const [monitorTab, setMonitorTab] =
    useState("category");

  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [links, setLinks] = useState({});

  const [revisionRow, setRevisionRow] =
    useState(null);
  const [revisionText, setRevisionText] =
    useState("");

  // ===================================================
  // TEMA GLOBAL
  // ===================================================

  useEffect(() => {
    setMonitorWeek(
      weekOf(todayWITA()) || 1
    );

    const sync = () => {
      const value =
        document.documentElement.getAttribute(
          "data-theme"
        ) ||
        localStorage.getItem(THEME_KEY) ||
        "light";

      setDark(value === "dark");
    };

    sync();

    const observer = new MutationObserver(sync);

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["data-theme"],
      }
    );

    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    const next = dark ? "light" : "dark";

    document.documentElement.setAttribute(
      "data-theme",
      next
    );

    document.documentElement.style.colorScheme =
      next;

    try {
      localStorage.setItem(
        THEME_KEY,
        next
      );
    } catch {}

    setDark(next === "dark");
  }

  // ===================================================
  // LOAD DATA SUPABASE
  // ===================================================

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const {
          data: auth,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !auth?.user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", auth.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const role = String(
          profile?.role || ""
        ).trim().toLowerCase();

        if (!["admin", "mentor"].includes(role)) {
          throw new Error(
            "Menu verifikasi hanya dapat diakses Mentor dan Admin."
          );
        }

        const {
          data: settings,
          error: settingsError,
        } = await supabase
          .from("app_settings")
          .select("maintenance_mode")
          .eq("id", 1)
          .maybeSingle();

        if (settingsError) throw settingsError;

        if (
          settings?.maintenance_mode &&
          role !== "admin"
        ) {
          throw new Error(
            "Maintenance Mode aktif. Akses Mentor sementara ditutup."
          );
        }

        const [programRes, typeRes] =
          await Promise.all([
            supabase
              .from("ojt_programs")
              .select(
                "id,participant_id,site,start_date,end_date,status"
              )
              .eq("status", "active")
              .order("start_date", {
                ascending: false,
              }),

            supabase
              .from("achievement_types")
              .select("code,name"),
          ]);

        if (programRes.error) {
          throw programRes.error;
        }

        if (typeRes.error) {
          throw typeRes.error;
        }

        const rawPrograms =
          programRes.data || [];

        const participantIds = [
          ...new Set(
            rawPrograms
              .map((p) => p.participant_id)
              .filter(Boolean)
          ),
        ];

        let profiles = [];

        if (participantIds.length) {
          const {
            data,
            error: e,
          } = await supabase
            .from("profiles")
            .select(
              "id,full_name,department,role"
            )
            .in("id", participantIds);

          if (e) throw e;

          profiles = data || [];
        }

        const profileMap = new Map(
          profiles.map((p) => [
            p.id,
            p,
          ])
        );

        const activePrograms = rawPrograms
          .map((p) => ({
            ...p,
            peserta:
              profileMap.get(p.participant_id) ||
              null,
          }))
          .filter((p) =>
            ["participant", "peserta"].includes(
              String(
                p.peserta?.role || ""
              ).trim().toLowerCase()
            )
          );

        const ids = activePrograms.map(
          (p) => p.id
        );

        const allRecords = [];

        // Pagination untuk data lebih dari 1000 baris.
        for (
          let i = 0;
          i < ids.length;
          i += 35
        ) {
          const chunk = ids.slice(i, i + 35);

          for (
            let offset = 0;
            ;
            offset += 500
          ) {
            const {
              data,
              error: e,
            } = await supabase
              .from("achievement_records")
              .select(
                "id,program_id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
              )
              .in("program_id", chunk)
              .order("created_at", {
                ascending: false,
              })
              .range(
                offset,
                offset + 499
              );

            if (e) throw e;

            const part = data || [];

            allRecords.push(...part);

            if (part.length < 500) break;
          }
        }

        if (!active) return;

        setAccount({
          ...profile,
          role,
        });

        setPrograms(activePrograms);

        setTypes(
          Object.fromEntries(
            (typeRes.data || []).map(
              (t) => [t.code, t.name]
            )
          )
        );

        setRecords(allRecords);
        setPicked([]);
      } catch (e) {
        if (active) {
          setError(
            e.message ||
              "Gagal memuat kegiatan OJT."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [refreshKey, router]);

  // ===================================================
  // DATA, FILTER, DAN PAGINATION
  // ===================================================

  const programMap = useMemo(
    () =>
      new Map(
        programs.map((p) => [
          p.id,
          p,
        ])
      ),
    [programs]
  );

  const sites = useMemo(
    () => [
      ...new Set(
        programs
          .map((p) => p.site)
          .filter(Boolean)
      ),
    ].sort(),
    [programs]
  );

  const selectedPrograms = useMemo(
    () =>
      programs.filter(
        (p) =>
          (siteFilter === "all" ||
            p.site === siteFilter) &&
          (programFilter === "all" ||
            p.id === programFilter)
      ),
    [
      programs,
      siteFilter,
      programFilter,
    ]
  );

  const selectedIds = useMemo(
    () =>
      new Set(
        selectedPrograms.map(
          (p) => p.id
        )
      ),
    [selectedPrograms]
  );

  const scoped = useMemo(
    () =>
      records.filter(
        (r) =>
          selectedIds.has(r.program_id)
      ),
    [records, selectedIds]
  );

  const enriched = useMemo(
    () =>
      scoped.map((r) => {
        const details = parseActivity(
          r.description
        );

        return {
          ...r,
          ...details,
          category: categoryName(
            r,
            types
          ),
          week: weekOf(
            r.activity_date
          ),
          program: programMap.get(
            r.program_id
          ),
        };
      }),
    [
      scoped,
      types,
      programMap,
    ]
  );

  const filtered = useMemo(() => {
    const q = search
      .trim()
      .toLowerCase();

    return enriched
      .filter(
        (r) =>
          (status === "all" ||
            r.status === status) &&
          (weekFilter === "all" ||
            r.week ===
              Number(weekFilter)) &&
          (categoryFilter === "all" ||
            r.category ===
              categoryFilter) &&
          (!q ||
            [
              r.program?.peserta
                ?.full_name,
              r.description,
              r.category,
              r.program?.site,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q))
      )
      .sort((a, b) =>
        String(
          b.activity_date || ""
        ).localeCompare(
          String(
            a.activity_date || ""
          )
        )
      );
  }, [
    enriched,
    status,
    weekFilter,
    categoryFilter,
    search,
  ]);

  useEffect(() => {
    setPage(1);
    setPicked([]);
    setExpanded(null);
  }, [
    status,
    weekFilter,
    siteFilter,
    programFilter,
    categoryFilter,
    search,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / 8)
  );

  const currentPage = Math.min(
    page,
    totalPages
  );

  const visible = useMemo(
    () =>
      filtered.slice(
        (currentPage - 1) * 8,
        currentPage * 8
      ),
    [filtered, currentPage]
  );

  const visibleWithFiles = useMemo(
    () =>
      visible.filter(
        (r) => r.file?.path
      ),
    [visible]
  );

  // ===================================================
  // FOTO / DOKUMENTASI SUPABASE STORAGE
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function preview() {
      const results = await Promise.all(
        visibleWithFiles.map(async (r) => {
          const {
            data,
            error: e,
          } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(
              r.file.path,
              600
            );

          return [
            r.id,
            e
              ? { error: e.message }
              : {
                  url:
                    data?.signedUrl ||
                    null,
                },
          ];
        })
      );

      if (!cancelled) {
        setLinks((before) => ({
          ...before,
          ...Object.fromEntries(
            results
          ),
        }));
      }
    }

    if (visibleWithFiles.length) {
      preview();
    }

    return () => {
      cancelled = true;
    };
  }, [
    visibleWithFiles,
    refreshKey,
  ]);

  async function openFile(r) {
    if (!r.file?.path) return;

    // Buka tab saat klik agar tidak diblokir
    // browser mobile.
    const tab = window.open(
      "about:blank",
      "_blank"
    );

    if (!tab) {
      setError(
        "Browser memblokir tab baru. Izinkan popup untuk membuka bukti."
      );
      return;
    }

    try {
      const {
        data,
        error: e,
      } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(
          r.file.path,
          600
        );

      if (e) throw e;

      if (!data?.signedUrl) {
        throw new Error(
          "URL dokumentasi tidak tersedia."
        );
      }

      tab.location.replace(
        data.signedUrl
      );
    } catch (e) {
      tab.close();

      setError(
        `Gagal membuka bukti: ${e.message}. Periksa akses Storage untuk Mentor/Admin.`
      );
    }
  }

  // ===================================================
  // KPI
  // ===================================================

  const pendingTotal = enriched.filter(
    (r) => r.status === "pending"
  ).length;

  const verifiedTotal = enriched.filter(
    (r) => r.status === "verified"
  ).length;

  const pagePending = visible.filter(
    (r) => r.status === "pending"
  );

  const selectedPending = filtered.filter(
    (r) =>
      r.status === "pending" &&
      picked.includes(r.id)
  );

  // ===================================================
  // VERIFIKASI — LOGIKA EXISTING
  // ===================================================

  async function verifyRows(items) {
    if (
      busy ||
      !account ||
      !items.length
    ) return;

    if (
      !window.confirm(
        `Verifikasi ${items.length} kegiatan yang sudah diperiksa?`
      )
    ) return;

    setBusy(true);
    setError("");
    setNotice("");

    const accepted = [];
    const failure = [];

    for (const r of items) {
      if (
        r.status !== "pending" ||
        !selectedIds.has(
          r.program_id
        )
      ) continue;

      if (
        r.category === "Fisik" &&
        !(Number(r.distance_km) > 0)
      ) {
        failure.push(
          `${r.program?.peserta?.full_name || "Peserta"}: jarak Fisik belum valid`
        );
        continue;
      }

      try {
        const {
          data,
          error: e,
        } = await supabase
          .from("achievement_records")
          .update({
            status: "verified",
            verified_by: account.id,
          })
          .eq("id", r.id)
          .eq(
            "program_id",
            r.program_id
          )
          .eq(
            "status",
            "pending"
          )
          .select("id");

        if (e) throw e;

        if (!data?.length) {
          throw new Error(
            "Tidak diizinkan atau status sudah berubah. Periksa RLS."
          );
        }

        accepted.push(r.id);
      } catch (e) {
        failure.push(
          `${r.program?.peserta?.full_name || "Peserta"}: ${e.message}`
        );
      }
    }

    if (accepted.length) {
      const ok = new Set(
        accepted
      );

      setRecords((prev) =>
        prev.map((r) =>
          ok.has(r.id)
            ? {
                ...r,
                status: "verified",
                verified_by:
                  account.id,
              }
            : r
        )
      );

      setPicked((prev) =>
        prev.filter(
          (id) => !ok.has(id)
        )
      );

      setNotice(
        `${accepted.length} kegiatan berhasil diverifikasi.`
      );
    }

    if (failure.length) {
      setError(
        `${failure.length} kegiatan gagal: ${failure[0]}`
      );
    }

    setBusy(false);
  }

  // ===================================================
  // CATATAN REVISI TANPA STATUS DATABASE BARU
  // ===================================================

  function startRevision(r) {
    setRevisionRow(r);

    setRevisionText(
      `Mohon perbaiki kegiatan ${r.category} tanggal ${showDate(r.activity_date)}: `
    );
  }

  async function copyRevision() {
    if (
      !revisionRow ||
      !revisionText.trim()
    ) return;

    try {
      await navigator.clipboard.writeText(
        `Untuk ${revisionRow.program?.peserta?.full_name || "Peserta OJT"}:\n${revisionText.trim()}`
      );

      setNotice(
        "Catatan perbaikan disalin. Sampaikan ke peserta melalui kanal komunikasi yang digunakan."
      );

      setRevisionRow(null);
    } catch {
      setError(
        "Gagal menyalin. Salin catatan secara manual dari kolom teks."
      );
    }
  }

  // ===================================================
  // MONITORING PER PESERTA & 25 MINGGU
  // ===================================================

  const monitorRows = useMemo(
    () =>
      selectedPrograms.map(
        (p) => ({
          ...p,
          result: computeProgress(
            scoped,
            types,
            monitorWeek,
            p.id
          ),
        })
      ),
    [
      selectedPrograms,
      scoped,
      types,
      monitorWeek,
    ]
  );

  const categoryProgress = useMemo(
    () =>
      TARGETS.map((cat, i) => {
        const amount =
          monitorRows.reduce(
            (s, p) =>
              s +
              p.result.categories[i]
                .amount,
            0
          );

        const count =
          monitorRows.length;

        const percentage = count
          ? Math.round(
              monitorRows.reduce(
                (s, p) =>
                  s +
                  p.result.categories[i]
                    .percent,
                0
              ) / count
            )
          : 0;

        return {
          ...cat,
          amount,
          totalTarget:
            cat.target * count,
          percentage,
        };
      }),
    [monitorRows]
  );

  const trend = useMemo(
    () =>
      WEEKS.map((w) => {
        if (!selectedPrograms.length) {
          return 0;
        }

        const sum =
          selectedPrograms.reduce(
            (s, p) =>
              s +
              computeProgress(
                scoped,
                types,
                w.number,
                p.id
              ).percent,
            0
          );

        return Math.round(
          sum /
            selectedPrograms.length
        );
      }),
    [
      scoped,
      types,
      selectedPrograms,
    ]
  );

  const trendPoints = trend
    .map(
      (v, i) =>
        `${44 + i * 17.8},${150 - v * 1.22}`
    )
    .join(" ");

  // ===================================================
  // TAMPILAN DASHBOARD
  // ===================================================

  return (
    <div
      className={`vm ${dark ? "dark" : ""}`}
    >
      <aside className="vm-side">
        <div className="vm-logo">
          ⛑ OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="vm-sidebrand">
          EMERGENCY RESPONSE GROUP
          <br />
          <small>PT BERAU COAL</small>
        </div>

        <nav
          className="vm-nav"
          aria-label="Menu Mentor"
        >
          <button
            onClick={() =>
              router.push("/")
            }
          >
            ⌂ <span>Dashboard</span>
          </button>

          <button
            onClick={() =>
              router.push(
                "/mentor/daftar-peserta"
              )
            }
          >
            ♙ <span>Peserta OJT</span>
          </button>

          <button className="active">
            ✓
            <span>
              Verifikasi & Monitoring
            </span>

            {pendingTotal > 0 && (
              <em>{pendingTotal}</em>
            )}
          </button>

          <button
            onClick={() =>
              router.push(
                "/mentor/monitoring-peserta"
              )
            }
          >
            ▥ <span>Monitoring Peserta</span>
          </button>

          <button
            onClick={() =>
              router.push("/")
            }
          >
            ▦ <span>Program OJT Mingguan</span>
          </button>
        </nav>

        <div className="vm-bottomside">
          PROGRAM OJT 2026–2027
          <br />
          Week 01–25 · Seluruh Site
        </div>
      </aside>

      <div className="vm-body">
        <header className="vm-top">
          <div className="vm-period">
            <b>
              ▦ Program OJT 2026–2027
            </b>

            <span>
              ▣ Week {P2(monitorWeek)}
              {" · "}
              {showDate(
                WEEKS[monitorWeek - 1].start
              )}
              {" – "}
              {showDate(
                WEEKS[monitorWeek - 1].end
              )}
            </span>
          </div>

          <div className="vm-account">
            <button
              className="vm-outline"
              onClick={toggleTheme}
            >
              {dark
                ? "☀ Terang"
                : "☾ Gelap"}
            </button>

            <div className="vm-avatar">
              {initials(
                account?.full_name
              )}
            </div>

            <div>
              <b>
                {account?.full_name ||
                  "Mentor / Admin"}
              </b>

              <small>
                {account?.role || "OJT"}
              </small>
            </div>
          </div>
        </header>

        <main className="vm-content">
          <div className="vm-pagehead">
            <div>
              <h1>
                ▤ Verifikasi & Monitoring Kegiatan
              </h1>

              <p>
                Periksa kegiatan mandiri peserta,
                buka bukti dokumentasi, dan pantau
                target mingguan.
              </p>
            </div>

            <button
              className="vm-outline"
              disabled={
                loading || busy
              }
              onClick={() =>
                setRefreshKey(
                  (n) => n + 1
                )
              }
            >
              ↻ Refresh
            </button>
          </div>

          {error && (
            <div
              className="vm-alert error"
              role="alert"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              className="vm-alert ok"
              role="status"
            >
              ✓ {notice}
            </div>
          )}

          {loading && (
            <div className="vm-loading">
              Memuat data OJT dari Supabase...
            </div>
          )}

          {!loading && account && (
            <>
              {/* KARTU STATISTIK */}
              <div className="vm-statgrid">
                <div className="vm-stat yellow">
                  <span>
                    ⌛ Menunggu Verifikasi
                  </span>
                  <b>{pendingTotal}</b>
                  <small>
                    Kegiatan perlu ditinjau
                  </small>
                </div>

                <div className="vm-stat green">
                  <span>
                    ✓ Terverifikasi
                  </span>
                  <b>{verifiedTotal}</b>
                  <small>
                    Kegiatan disetujui
                  </small>
                </div>

                <div className="vm-stat blue">
                  <span>
                    ♙ Peserta Aktif
                  </span>
                  <b>
                    {selectedPrograms.length}
                  </b>
                  <small>
                    Program OJT aktif
                  </small>
                </div>

                <div className="vm-stat violet">
                  <span>
                    ▤ Total Kegiatan
                  </span>
                  <b>{enriched.length}</b>
                  <small>
                    Semua status
                  </small>
                </div>
              </div>

              <div className="vm-columns">
                {/* DAFTAR VERIFIKASI */}
                <section className="vm-card vm-listpanel">
                  <div className="vm-cardhead">
                    <h2>
                      ▤ Daftar Kegiatan Peserta
                    </h2>
                    <small>
                      {filtered.length} kegiatan
                    </small>
                  </div>

                  <div className="vm-tabs">
                    {[
                      {
                        id: "pending",
                        label: `⌛ Menunggu (${pendingTotal})`,
                      },
                      {
                        id: "verified",
                        label: `✓ Terverifikasi (${verifiedTotal})`,
                      },
                      {
                        id: "all",
                        label: "☷ Semua",
                      },
                    ].map((s) => (
                      <button
                        key={s.id}
                        className={
                          status === s.id
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setStatus(s.id)
                        }
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* FILTER */}
                  <div className="vm-filters">
                    <input
                      value={search}
                      onChange={(e) =>
                        setSearch(
                          e.target.value
                        )
                      }
                      placeholder="⌕ Cari peserta atau kegiatan..."
                      aria-label="Cari kegiatan"
                    />

                    <select
                      value={weekFilter}
                      onChange={(e) =>
                        setWeekFilter(
                          e.target.value
                        )
                      }
                      aria-label="Filter minggu"
                    >
                      <option value="all">
                        Semua Minggu
                      </option>

                      {WEEKS.map((w) => (
                        <option
                          key={w.number}
                          value={w.number}
                        >
                          Week {P2(w.number)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={categoryFilter}
                      onChange={(e) =>
                        setCategoryFilter(
                          e.target.value
                        )
                      }
                      aria-label="Filter kategori"
                    >
                      <option value="all">
                        Semua Kategori
                      </option>

                      {TARGETS.map((c) => (
                        <option
                          key={c.name}
                          value={c.name}
                        >
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={siteFilter}
                      onChange={(e) => {
                        setSiteFilter(
                          e.target.value
                        );
                        setProgramFilter(
                          "all"
                        );
                      }}
                      aria-label="Filter site"
                    >
                      <option value="all">
                        Semua Site
                      </option>

                      {sites.map((s) => (
                        <option
                          key={s}
                          value={s}
                        >
                          {s}
                        </option>
                      ))}
                    </select>

                    <select
                      value={programFilter}
                      onChange={(e) =>
                        setProgramFilter(
                          e.target.value
                        )
                      }
                      aria-label="Filter peserta"
                    >
                      <option value="all">
                        Semua Peserta
                      </option>

                      {programs
                        .filter(
                          (p) =>
                            siteFilter ===
                              "all" ||
                            p.site ===
                              siteFilter
                        )
                        .map((p) => (
                          <option
                            value={p.id}
                            key={p.id}
                          >
                            {p.peserta
                              ?.full_name ||
                              "Peserta OJT"}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* TABEL KEGIATAN */}
                  <div className="vm-scroll">
                    <table className="vm-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              aria-label="Pilih pending halaman ini"
                              checked={
                                pagePending.length >
                                  0 &&
                                pagePending.every(
                                  (r) =>
                                    picked.includes(
                                      r.id
                                    )
                                )
                              }
                              onChange={(e) =>
                                setPicked(
                                  (previous) =>
                                    e.target.checked
                                      ? [
                                          ...new Set([
                                            ...previous,
                                            ...pagePending.map(
                                              (r) =>
                                                r.id
                                            ),
                                          ]),
                                        ]
                                      : previous.filter(
                                          (id) =>
                                            !pagePending.some(
                                              (r) =>
                                                r.id ===
                                                id
                                            )
                                        )
                                )
                              }
                            />
                          </th>
                          <th>Peserta</th>
                          <th>Kegiatan</th>
                          <th>Realisasi</th>
                          <th>Tanggal</th>
                          <th>Bukti</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>

                      <tbody>
                        {visible.map((r) => {
                          const signed =
                            links[r.id];

                          return (
                            <tr key={r.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  disabled={
                                    busy ||
                                    r.status !==
                                      "pending"
                                  }
                                  checked={picked.includes(
                                    r.id
                                  )}
                                  onChange={(e) =>
                                    setPicked(
                                      (a) =>
                                        e.target.checked
                                          ? [
                                              ...new Set([
                                                ...a,
                                                r.id,
                                              ]),
                                            ]
                                          : a.filter(
                                              (id) =>
                                                id !==
                                                r.id
                                            )
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <div className="vm-person">
                                  <span>
                                    {initials(
                                      r.program
                                        ?.peserta
                                        ?.full_name
                                    )}
                                  </span>

                                  <div>
                                    <strong>
                                      {r.program
                                        ?.peserta
                                        ?.full_name ||
                                        "Peserta OJT"}
                                    </strong>

                                    <small>
                                      {r.program
                                        ?.site ||
                                        "—"}
                                    </small>
                                  </div>
                                </div>
                              </td>

                              <td>
                                <div className="vm-activity">
                                  <span
                                    className={`vm-tag ${norm(
                                      r.category
                                    )}`}
                                  >
                                    {r.category}
                                  </span>

                                  <div className="vm-desc">
                                    {r.description ||
                                      "Tidak ada keterangan kegiatan."}
                                  </div>

                                  <button
                                    className="vm-textbutton"
                                    onClick={() =>
                                      setExpanded(
                                        expanded ===
                                          r.id
                                          ? null
                                          : r.id
                                      )
                                    }
                                  >
                                    {expanded ===
                                    r.id
                                      ? "Tutup detail"
                                      : "Lihat detail"}
                                  </button>

                                  {expanded ===
                                    r.id && (
                                    <div className="vm-expansion">
                                      <strong>
                                        Keterangan kegiatan
                                      </strong>

                                      <p>
                                        {r.description ||
                                          "Belum diisi peserta."}
                                      </p>

                                      <small>
                                        {r.file
                                          ? `Dokumentasi: ${r.file.name}`
                                          : "Belum ada lampiran pada catatan."}
                                      </small>

                                      <button
                                        className="vm-textbutton"
                                        onClick={() =>
                                          router.push(
                                            `/achievement/${encodeURIComponent(
                                              r.program_id
                                            )}`
                                          )
                                        }
                                      >
                                        Buka detail peserta ↗
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td>
                                <span className="vm-amount">
                                  {r.category ===
                                  "Fisik"
                                    ? `${displayNum(
                                        r.distance_km,
                                        3
                                      )} km`
                                    : "1 kegiatan"}
                                </span>
                              </td>

                              <td>
                                <span>
                                  {showDate(
                                    r.activity_date
                                  )}
                                </span>

                                <small>
                                  Week{" "}
                                  {r.week
                                    ? P2(r.week)
                                    : "—"}
                                </small>
                              </td>

                              {/* FOTO DOKUMENTASI */}
                              <td className="vm-proofcell">
                                {r.file ? (
                                  <div className="vm-proof">
                                    {signed?.url &&
                                    isImage(
                                      r.file
                                    ) ? (
                                      <button
                                        onClick={() =>
                                          openFile(
                                            r
                                          )
                                        }
                                        aria-label={`Buka bukti ${r.file.name}`}
                                      >
                                        <img
                                          src={
                                            signed.url
                                          }
                                          alt={`Bukti ${r.category} oleh ${
                                            r.program
                                              ?.peserta
                                              ?.full_name ||
                                            "Peserta"
                                          }`}
                                        />
                                      </button>
                                    ) : (
                                      <button
                                        className="vm-prooficon"
                                        onClick={() =>
                                          openFile(
                                            r
                                          )
                                        }
                                      >
                                        {signed?.error
                                          ? "⚠"
                                          : isImage(
                                                r.file
                                              )
                                            ? "▧"
                                            : "▤"}
                                      </button>
                                    )}

                                    <button
                                      className="vm-prooflink"
                                      onClick={() =>
                                        openFile(
                                          r
                                        )
                                      }
                                    >
                                      {signed?.error
                                        ? "Bukti tidak bisa dibuka"
                                        : "Lihat bukti ↗"}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="vm-nofile">
                                    Tidak ada
                                  </span>
                                )}
                              </td>

                              <td>
                                <div className="vm-actions">
                                  <span
                                    className={`vm-status ${
                                      r.status ===
                                      "verified"
                                        ? "verified"
                                        : r.status ===
                                            "pending"
                                          ? "pending"
                                          : "other"
                                    }`}
                                  >
                                    {r.status}
                                  </span>

                                  {r.status ===
                                    "pending" && (
                                    <button
                                      className="vm-approve"
                                      disabled={
                                        busy
                                      }
                                      onClick={() =>
                                        verifyRows(
                                          [r]
                                        )
                                      }
                                    >
                                      ✓ Verifikasi
                                    </button>
                                  )}

                                  {r.status ===
                                    "pending" && (
                                    <button
                                      className="vm-revise"
                                      disabled={
                                        busy
                                      }
                                      onClick={() =>
                                        startRevision(
                                          r
                                        )
                                      }
                                    >
                                      Perlu revisi
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {!visible.length && (
                    <div className="vm-empty">
                      Tidak ada kegiatan sesuai filter.
                    </div>
                  )}

                  {/* VERIFIKASI MASSAL */}
                  <div className="vm-pagination">
                    <span>
                      {picked.length} dipilih
                    </span>

                    <button
                      className="vm-approve"
                      disabled={
                        busy ||
                        !selectedPending.length
                      }
                      onClick={() =>
                        verifyRows(
                          selectedPending
                        )
                      }
                    >
                      ✓ Verifikasi Terpilih (
                      {selectedPending.length})
                    </button>

                    <div className="vm-grow" />

                    <button
                      className="vm-outline"
                      disabled={
                        currentPage <= 1
                      }
                      onClick={() =>
                        setPage(
                          (p) =>
                            Math.max(
                              1,
                              p - 1
                            )
                        )
                      }
                    >
                      ‹
                    </button>

                    <span>
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      className="vm-outline"
                      disabled={
                        currentPage >=
                        totalPages
                      }
                      onClick={() =>
                        setPage(
                          (p) =>
                            Math.min(
                              totalPages,
                              p + 1
                            )
                        )
                      }
                    >
                      ›
                    </button>
                  </div>
                </section>

                {/* PANEL MONITORING */}
                <aside className="vm-right">
                  <section className="vm-card">
                    <div className="vm-cardhead">
                      <h2>
                        ▥ Monitoring Pencapaian Peserta
                      </h2>

                      <select
                        value={monitorWeek}
                        onChange={(e) =>
                          setMonitorWeek(
                            Number(
                              e.target.value
                            )
                          )
                        }
                      >
                        {WEEKS.map(
                          (w) => (
                            <option
                              key={
                                w.number
                              }
                              value={
                                w.number
                              }
                            >
                              Week{" "}
                              {P2(
                                w.number
                              )}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div className="vm-switch">
                      <button
                        className={
                          monitorTab ===
                          "category"
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setMonitorTab(
                            "category"
                          )
                        }
                      >
                        Ringkasan Kategori
                      </button>

                      <button
                        className={
                          monitorTab ===
                          "participant"
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setMonitorTab(
                            "participant"
                          )
                        }
                      >
                        Per Peserta
                      </button>
                    </div>

                    {monitorTab ===
                    "category" ? (
                      <div className="vm-categorylist">
                        {categoryProgress.map(
                          (c) => (
                            <div
                              className="vm-cat"
                              key={
                                c.name
                              }
                            >
                              <div className="vm-catline">
                                <b>
                                  {c.icon}{" "}
                                  {c.name}
                                </b>

                                <span>
                                  {displayNum(
                                    c.amount,
                                    2
                                  )}{" "}
                                  /{" "}
                                  {displayNum(
                                    c.totalTarget
                                  )}{" "}
                                  {c.unit}
                                </span>
                              </div>

                              <div className="vm-barline">
                                <div className="vm-bar">
                                  <span
                                    style={{
                                      width: `${c.percentage}%`,
                                    }}
                                  />
                                </div>

                                <strong>
                                  {c.percentage}%
                                </strong>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="vm-people">
                        {monitorRows.map(
                          (p) => (
                            <button
                              key={
                                p.id
                              }
                              onClick={() => {
                                setProgramFilter(
                                  p.id
                                );
                                setMonitorTab(
                                  "category"
                                );
                              }}
                            >
                              <div className="vm-person">
                                <span>
                                  {initials(
                                    p.peserta
                                      ?.full_name
                                  )}
                                </span>

                                <div>
                                  <strong>
                                    {p.peserta
                                      ?.full_name}
                                  </strong>

                                  <small>
                                    {p.site}
                                  </small>
                                </div>
                              </div>

                              <b>
                                {
                                  p.result
                                    .percent
                                }
                                %
                              </b>
                            </button>
                          )
                        )}

                        {!monitorRows.length && (
                          <p>
                            Belum ada peserta aktif.
                          </p>
                        )}
                      </div>
                    )}

                    <p className="vm-hint">
                      Progres dihitung dari kegiatan
                      verified dan target mingguan
                      tiap peserta. Angka agregat
                      tidak menentukan kelulusan.
                    </p>
                  </section>

                  {/* GRAFIK 25 MINGGU */}
                  <section className="vm-card">
                    <div className="vm-cardhead">
                      <h2>
                        ⌁ Tren Pencapaian Verified
                        (25 Minggu)
                      </h2>
                    </div>

                    <p className="vm-chartdesc">
                      Rata-rata persentase target
                      mingguan dari peserta yang
                      dipilih.
                    </p>

                    <div className="vm-chartwrap">
                      <svg
                        viewBox="0 0 500 185"
                        role="img"
                        aria-label="Tren persentase verified sepanjang 25 minggu"
                      >
                        <defs>
                          <linearGradient
                            id="vm-green-fill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#21aa7a"
                              stopOpacity=".2"
                            />
                            <stop
                              offset="100%"
                              stopColor="#21aa7a"
                              stopOpacity="0"
                            />
                          </linearGradient>
                        </defs>

                        {[0, 25, 50, 75, 100].map(
                          (v) => {
                            const y =
                              150 -
                              v * 1.22;

                            return (
                              <g key={v}>
                                <line
                                  x1="44"
                                  x2="480"
                                  y1={y}
                                  y2={y}
                                  stroke="currentColor"
                                  opacity=".1"
                                />

                                <text
                                  x="5"
                                  y={
                                    y +
                                    4
                                  }
                                  fontSize="11"
                                  fill="currentColor"
                                >
                                  {v}%
                                </text>
                              </g>
                            );
                          }
                        )}

                        <polygon
                          points={`44,150 ${trendPoints} 471.2,150`}
                          fill="url(#vm-green-fill)"
                        />

                        <polyline
                          points={
                            trendPoints
                          }
                          fill="none"
                          stroke="#14a77d"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {trend.map(
                          (v, i) => (
                            <circle
                              key={i}
                              cx={
                                44 +
                                i *
                                  17.8
                              }
                              cy={
                                150 -
                                v *
                                  1.22
                              }
                              r={
                                monitorWeek ===
                                i + 1
                                  ? 5
                                  : 2.7
                              }
                              fill={
                                monitorWeek ===
                                i + 1
                                  ? "#ffd166"
                                  : "#14a77d"
                              }
                            >
                              <title>
                                Week{" "}
                                {P2(
                                  i +
                                    1
                                )}
                                : {v}%
                              </title>
                            </circle>
                          )
                        )}

                        <text
                          x="43"
                          y="176"
                          fontSize="11"
                          fill="currentColor"
                        >
                          W01
                        </text>

                        <text
                          x="244"
                          y="176"
                          fontSize="11"
                          fill="currentColor"
                        >
                          W13
                        </text>

                        <text
                          x="452"
                          y="176"
                          fontSize="11"
                          fill="currentColor"
                        >
                          W25
                        </text>
                      </svg>
                    </div>

                    <p className="vm-hint">
                      Gunakan filter peserta untuk
                      melihat progres individu.
                    </p>
                  </section>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {/* CATATAN PERLU REVISI */}
      {revisionRow && (
        <div
          className="vm-modalback"
          role="presentation"
        >
          <div
            className="vm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vm-revision-title"
          >
            <h2 id="vm-revision-title">
              Catatan Perlu Perbaikan
            </h2>

            <p>
              Kegiatan tetap berstatus{" "}
              <b>pending</b>. Catatan ini
              belum disimpan ke database
              dan harus disampaikan ke peserta.
            </p>

            <textarea
              rows={5}
              value={revisionText}
              onChange={(e) =>
                setRevisionText(
                  e.target.value
                )
              }
              aria-label="Catatan revisi"
            />

            <div className="vm-modalactions">
              <button
                className="vm-outline"
                onClick={() =>
                  setRevisionRow(null)
                }
              >
                Batal
              </button>

              <button
                className="vm-approve"
                onClick={copyRevision}
              >
                Salin catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================
          CSS HALAMAN — RESPONSIVE & LIGHT/DARK
      ================================================= */}

      <style jsx global>{`
        .vm {
          --bg: #f3f7f8;
          --paper: #fff;
          --text: #1a2d3e;
          --muted: #728391;
          --border: #dfe7eb;
          --hover: #f7fbf9;
          min-height: 100vh;
          background: var(--bg);
          color: var(--text);
          font: 14px/1.5 Arial, Helvetica, sans-serif;
          display: grid;
          grid-template-columns: 246px minmax(0, 1fr);
        }

        .vm.dark {
          --bg: #101c25;
          --paper: #1d2a34;
          --text: #e9f2f4;
          --muted: #a9bac4;
          --border: #394953;
          --hover: #263943;
        }

        .vm * {
          box-sizing: border-box;
        }

        .vm button,
        .vm input,
        .vm select,
        .vm textarea {
          font: inherit;
        }

        .vm button {
          cursor: pointer;
        }

        .vm button:disabled {
          opacity: 0.48;
          cursor: not-allowed;
        }

        .vm h1,
        .vm h2,
        .vm p {
          margin-top: 0;
        }

        .vm-side {
          background: linear-gradient(
            165deg,
            #0a2839,
            #142f41 62%,
            #066d57
          );
          color: #fff;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }

        .vm-logo {
          padding: 26px 18px;
          font-size: 22px;
          font-weight: 800;
          white-space: nowrap;
        }

        .vm-logo span {
          color: #43d48b;
        }

        .vm-logo small {
          font-size: 10px;
          color: #cbdfdf;
          margin-left: 5px;
        }

        .vm-sidebrand {
          padding: 20px 17px;
          background: linear-gradient(
            100deg,
            #1d5561,
            #0c7456
          );
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .vm-sidebrand small {
          font-size: 10px;
          font-weight: 500;
        }

        .vm-nav {
          display: grid;
          gap: 6px;
          padding: 20px 12px;
        }

        .vm-nav button {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 0;
          border-radius: 10px;
          text-align: left;
          background: none;
          color: #d8e9ea;
          font-size: 13px;
          font-weight: 700;
        }

        .vm-nav button.active {
          background: #0caa77;
          color: #fff;
        }

        .vm-nav em {
          margin-left: auto;
          background: #d9ffea;
          color: #0b7555;
          border-radius: 20px;
          padding: 2px 8px;
          font-size: 11px;
          font-style: normal;
        }

        .vm-bottomside {
          margin-top: auto;
          padding: 20px;
          color: #cbe8de;
          font-size: 11px;
        }

        .vm-body {
          min-width: 0;
        }

        .vm-top {
          background: var(--paper);
          border-bottom: 1px solid var(--border);
          padding: 16px 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }

        .vm-period,
        .vm-account {
          display: flex;
          align-items: center;
          gap: 13px;
          flex-wrap: wrap;
        }

        .vm-period b {
          font-size: 13px;
        }

        .vm-period > span {
          border-radius: 30px;
          background: #dcf5e8;
          color: #116e52;
          font-size: 11px;
          font-weight: 700;
          padding: 8px 12px;
        }

        .vm-account div:last-child b {
          display: block;
          font-size: 12px;
        }

        .vm-account div:last-child small {
          display: block;
          color: #1ea477;
          font-size: 11px;
          text-transform: capitalize;
        }

        .vm-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #d9f1ec;
          color: #136951;
          font-weight: 800;
        }

        .vm-content {
          max-width: 1700px;
          margin: 0 auto;
          padding: 22px;
        }

        .vm-pagehead {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .vm-pagehead h1 {
          font-size: 24px;
          margin-bottom: 5px;
        }

        .vm-pagehead p {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 0;
        }

        .vm-outline {
          background: var(--paper);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 9px;
          padding: 8px 12px;
          white-space: nowrap;
        }

        .vm-alert,
        .vm-loading {
          background: var(--paper);
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-bottom: 12px;
          padding: 13px;
        }

        .vm-alert.error {
          color: #b91c1c;
          background: #fff0f0;
          border-color: #fdcaca;
        }

        .vm-alert.ok {
          color: #076745;
          background: #e5f8ed;
          border-color: #b8e8ca;
        }

        .vm-statgrid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 10px;
          margin-bottom: 14px;
        }

        .vm-stat {
          border-radius: 13px;
          padding: 18px;
          min-width: 0;
        }

        .vm-stat.yellow {
          background: #fff7e3;
          color: #6f5018;
        }

        .vm-stat.green {
          background: #e4f9ec;
          color: #14653e;
        }

        .vm-stat.blue {
          background: #e4f2ff;
          color: #22597a;
        }

        .vm-stat.violet {
          background: #f1ecff;
          color: #55427e;
        }

        .vm-stat span,
        .vm-stat small {
          display: block;
          font-size: 11px;
        }

        .vm-stat span {
          font-weight: 800;
        }

        .vm-stat b {
          display: block;
          font-size: 30px;
          line-height: 1.2;
          margin: 8px 0;
        }

        .vm-columns {
          display: grid;
          grid-template-columns:
            minmax(0, 1.82fr)
            minmax(340px, 0.95fr);
          align-items: start;
          gap: 14px;
        }

        .vm-card {
          min-width: 0;
          border-radius: 15px;
          border: 1px solid var(--border);
          background: var(--paper);
          box-shadow: 0 3px 17px #1234230a;
          padding: 16px;
        }

        .vm-cardhead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 13px;
        }

        .vm-cardhead h2 {
          margin: 0;
          font-size: 16px;
        }

        .vm-cardhead small {
          color: var(--muted);
        }

        .vm-cardhead select,
        .vm-filters select,
        .vm-filters input {
          background: var(--paper);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 9px;
          padding: 10px;
          min-width: 0;
          font-size: 12px;
        }

        .vm-tabs,
        .vm-switch {
          background: var(--bg);
          border-radius: 10px;
          padding: 5px;
          display: flex;
          gap: 5px;
          margin-bottom: 12px;
        }

        .vm-tabs button,
        .vm-switch button {
          flex: 1;
          background: transparent;
          border: 0;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          padding: 10px 6px;
        }

        .vm-tabs button.active,
        .vm-switch button.active {
          color: #fff;
          background: #098962;
        }

        .vm-filters {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1.1fr;
          gap: 7px;
          margin-bottom: 13px;
        }

        .vm-scroll {
          overflow-x: auto;
        }

        .vm-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 845px;
          font-size: 12px;
        }

        .vm-table th {
          text-align: left;
          white-space: nowrap;
          background: var(--bg);
          font-size: 11px;
          padding: 12px 8px;
        }

        .vm-table td {
          vertical-align: middle;
          border-bottom: 1px solid var(--border);
          padding: 11px 8px;
        }

        .vm-table td:nth-child(3) {
          min-width: 190px;
        }

        .vm-person {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 120px;
        }

        .vm-person > span {
          flex: 0 0 28px;
          height: 28px;
          border-radius: 50%;
          background: #d9e8ed;
          color: #28516b;
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 800;
        }

        .vm-person strong {
          display: block;
          font-size: 12px;
        }

        .vm-person small,
        .vm-table td > small {
          display: block;
          color: var(--muted);
          font-size: 10px;
          margin-top: 3px;
        }

        .vm-tag {
          display: inline-block;
          background: #e4f6ed;
          color: #097851;
          font-weight: 800;
          border-radius: 6px;
          padding: 4px 7px;
          font-size: 10px;
        }

        .vm-tag.fisik {
          background: #fff0d7;
          color: #ad6b08;
        }

        .vm-tag.hazard {
          background: #ffeded;
          color: #c63535;
        }

        .vm-desc {
          margin-top: 5px;
          max-width: 225px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--muted);
          font-size: 11px;
        }

        .vm-textbutton {
          border: 0;
          background: none;
          color: #139f7c;
          padding: 5px 0 0;
          font-size: 11px;
          display: block;
          text-align: left;
        }

        .vm-expansion {
          background: var(--hover);
          border: 1px solid var(--border);
          border-radius: 9px;
          padding: 10px;
          margin-top: 8px;
          max-width: 255px;
          overflow-wrap: anywhere;
        }

        .vm-expansion p {
          font-size: 11px;
          white-space: pre-wrap;
          margin: 6px 0;
        }

        .vm-expansion small {
          display: block;
          color: var(--muted);
        }

        .vm-amount {
          white-space: nowrap;
        }

        .vm-status {
          display: inline-block;
          font-size: 10px;
          border-radius: 20px;
          padding: 5px 8px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .vm-status.verified {
          background: #dff9eb;
          color: #08774b;
        }

        .vm-status.pending {
          background: #fff1d5;
          color: #996218;
        }

        .vm-status.other {
          background: #eaf0f4;
          color: #506773;
        }

        .vm-actions {
          display: grid;
          gap: 5px;
          justify-items: start;
        }

        .vm-approve {
          background: #078a60;
          color: #fff;
          border: 1px solid #078a60;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .vm-revise {
          border: 1px solid #ef9898;
          color: #cf4141;
          background: transparent;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 11px;
          white-space: nowrap;
        }

        .vm-proofcell {
          min-width: 89px;
        }

        .vm-proof {
          display: grid;
          justify-items: center;
          gap: 4px;
        }

        .vm-proof > button:first-child {
          border: 0;
          background: transparent;
          padding: 0;
        }

        .vm-proof img {
          width: 68px;
          height: 52px;
          object-fit: cover;
          border-radius: 7px;
          border: 1px solid var(--border);
          display: block;
        }

        .vm-prooficon {
          height: 52px;
          width: 68px;
          border: 1px dashed var(--border) !important;
          border-radius: 7px;
          background: var(--bg) !important;
          font-size: 22px !important;
          color: var(--muted);
        }

        .vm-prooflink {
          border: 0;
          background: transparent;
          color: #109572;
          font-size: 10px;
          white-space: nowrap;
        }

        .vm-nofile {
          font-size: 10px;
          color: var(--muted);
        }

        .vm-pagination {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
          margin-top: 15px;
          font-size: 11px;
        }

        .vm-grow {
          flex: 1;
        }

        .vm-empty {
          text-align: center;
          padding: 30px;
          color: var(--muted);
        }

        .vm-right {
          display: grid;
          gap: 14px;
        }

        .vm-hint,
        .vm-chartdesc {
          font-size: 11px;
          color: var(--muted);
          line-height: 1.55;
          margin: 12px 0 0;
        }

        .vm-categorylist {
          display: grid;
          gap: 17px;
          margin-top: 20px;
        }

        .vm-catline,
        .vm-barline {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .vm-catline {
          font-size: 12px;
          margin-bottom: 8px;
        }

        .vm-catline span {
          font-size: 11px;
          color: var(--muted);
          white-space: nowrap;
        }

        .vm-barline strong {
          width: 39px;
          font-size: 11px;
          text-align: right;
        }

        .vm-bar {
          height: 9px;
          border-radius: 20px;
          background: var(--border);
          overflow: hidden;
          flex: 1;
        }

        .vm-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            #31c68c,
            #04885e
          );
        }

        .vm-people {
          display: grid;
          gap: 6px;
          max-height: 400px;
          overflow: auto;
        }

        .vm-people > button {
          border: 1px solid var(--border);
          background: var(--paper);
          color: var(--text);
          border-radius: 9px;
          padding: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          text-align: left;
        }

        .vm-people > button > b {
          color: #14a37a;
        }

        .vm-chartwrap svg {
          width: 100%;
          height: auto;
          display: block;
          margin-top: 12px;
        }

        .vm-modalback {
          position: fixed;
          inset: 0;
          z-index: 99;
          background: #071b25a8;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .vm-modal {
          background: var(--paper);
          color: var(--text);
          width: min(490px, 100%);
          border-radius: 16px;
          padding: 23px;
          box-shadow: 0 14px 50px #0003;
        }

        .vm-modal h2 {
          font-size: 19px;
        }

        .vm-modal p {
          color: var(--muted);
          font-size: 12px;
        }

        .vm-modal textarea {
          width: 100%;
          background: var(--paper);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 9px;
          padding: 12px;
          resize: vertical;
        }

        .vm-modalactions {
          display: flex;
          justify-content: end;
          gap: 8px;
          margin-top: 12px;
        }

        @media (max-width: 1280px) {
          .vm-columns {
            grid-template-columns: 1fr;
          }

          .vm-right {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 860px) {
          .vm {
            display: block;
          }

          .vm-side {
            min-height: 0;
          }

          .vm-logo {
            padding: 14px 16px;
          }

          .vm-sidebrand,
          .vm-bottomside {
            display: none;
          }

          .vm-nav {
            display: flex;
            gap: 5px;
            overflow-x: auto;
            padding: 8px;
          }

          .vm-nav button {
            white-space: nowrap;
            flex: 0 0 auto;
          }

          .vm-content {
            padding: 14px;
          }

          .vm-top {
            padding: 12px 14px;
          }

          .vm-statgrid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .vm-right {
            grid-template-columns: 1fr;
          }

          .vm-pagehead h1 {
            font-size: 20px;
          }
        }

        @media (max-width: 550px) {
          .vm-top {
            display: block;
          }

          .vm-period,
          .vm-account {
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .vm-pagehead h1 {
            font-size: 18px;
          }

          .vm-filters {
            grid-template-columns: 1fr 1fr;
          }

          .vm-filters > input {
            grid-column: 1 / -1;
          }

          .vm-tabs button {
            font-size: 10px;
            padding: 8px 3px;
          }

          .vm-card {
            padding: 12px;
          }

          .vm-stat {
            padding: 13px;
          }

          .vm-stat b {
            font-size: 25px;
          }
        }
      `}</style>
    </div>
  );
}

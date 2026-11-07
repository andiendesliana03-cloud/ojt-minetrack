
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// PERSETUJUAN PENDAFTARAN MENTOR
// ADMIN ONLY — LIGHT / DARK MODE
// =====================================================

function dateText(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

export default function PersetujuanMentorPage() {
  const router = useRouter();

  const [admin, setAdmin] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function verifyAdmin() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Silakan login terlebih dahulu.");
    }

    const { data, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (String(data?.role || "").toLowerCase() !== "admin") {
      throw new Error("Halaman ini khusus Administrator.");
    }

    return data;
  }

  async function fetchRequests() {
    const { data, error: fetchError } =
      await supabase
        .from("mentor_registration_requests")
        .select(
          "id,user_id,full_name,email,department," +
          "site,status,created_at,reviewed_at"
        )
        .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    return data || [];
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const profile = await verifyAdmin();
        const result = await fetchRequests();

        if (!active) return;

        setAdmin(profile);
        setRows(result);
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memuat pengajuan Mentor."
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
  }, []);

  async function refresh() {
    if (refreshing || busyId) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      await verifyAdmin();
      const result = await fetchRequests();
      setRows(result);
    } catch (err) {
      setError(err?.message || "Refresh gagal.");
    } finally {
      setRefreshing(false);
    }
  }

  async function review(item, decision) {
    if (busyId || !admin) return;

    const label =
      decision === "approved" ? "setujui" : "tolak";

    if (
      !window.confirm(
        `Yakin ingin ${label} pengajuan Mentor ` +
        `${item.full_name}?`
      )
    ) {
      return;
    }

    setBusyId(item.id);
    setError("");
    setMessage("");

    try {
      await verifyAdmin();

      const { error: reviewError } =
        await supabase.rpc(
          "review_mentor_application",
          {
            p_request_id: item.id,
            p_decision: decision,
          }
        );

      if (reviewError) throw reviewError;

      const result = await fetchRequests();
      setRows(result);

      setMessage(
        decision === "approved"
          ? `Akun ${item.full_name} disetujui sebagai Mentor.`
          : `Pengajuan ${item.full_name} ditolak.`
      );
    } catch (err) {
      setError(
        err?.message || "Gagal memproses pengajuan."
      );
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return rows.filter(item => {
      const matchesFilter =
        filter === "all" || item.status === filter;

      const matchesSearch = [
        item.full_name,
        item.email,
        item.department,
        item.site,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);

      return matchesFilter && matchesSearch;
    });
  }, [rows, search, filter]);

  const pending = rows.filter(
    item => item.status === "pending"
  ).length;

  const approved = rows.filter(
    item => item.status === "approved"
  ).length;

  const rejected = rows.filter(
    item => item.status === "rejected"
  ).length;

  return (
    <main className="amr-root">
      <style>{css}</style>

      <header className="amr-header">
        <strong>
          OJT <span>MineTrack</span>
        </strong>

        <button
          type="button"
          onClick={() => router.push("/")}
        >
          ← Dashboard Admin
        </button>
      </header>

      <div className="amr-container">
        <div className="amr-heading">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>
            <h1>Persetujuan Mentor OJT</h1>
            <p>
              Pengelolaan pengajuan akun Mentor baru.
            </p>
          </div>

          {admin && (
            <span className="amr-admin">
              {admin.full_name || "Administrator"}
            </span>
          )}
        </div>

        {error && (
          <div className="amr-error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="amr-success" role="status">
            ✓ {message}
          </div>
        )}

        {loading ? (
          <section className="amr-panel">
            Memuat data pengajuan Mentor...
          </section>
        ) : !admin ? (
          <section className="amr-panel">
            Akses Administrator diperlukan.
          </section>
        ) : (
          <>
            <div className="amr-stats">
              <div>
                <span>Menunggu Persetujuan</span>
                <strong>{pending}</strong>
              </div>

              <div>
                <span>Disetujui</span>
                <strong>{approved}</strong>
              </div>

              <div>
                <span>Ditolak</span>
                <strong>{rejected}</strong>
              </div>
            </div>

            <section className="amr-panel">
              <div className="amr-toolbar">
                <h2>Daftar Pengajuan Mentor</h2>

                <button
                  type="button"
                  onClick={refresh}
                  disabled={refreshing || Boolean(busyId)}
                >
                  {refreshing ? "Memuat..." : "↻ Refresh"}
                </button>
              </div>

              <div className="amr-filters">
                <input
                  type="search"
                  placeholder="Cari nama atau email..."
                  value={search}
                  onChange={event =>
                    setSearch(event.target.value)
                  }
                />

                <select
                  value={filter}
                  onChange={event =>
                    setFilter(event.target.value)
                  }
                >
                  <option value="pending">
                    Menunggu Persetujuan
                  </option>
                  <option value="approved">
                    Disetujui
                  </option>
                  <option value="rejected">
                    Ditolak
                  </option>
                  <option value="all">
                    Semua Pengajuan
                  </option>
                </select>
              </div>

              <div className="amr-list">
                {filtered.map(item => (
                  <article
                    className="amr-card"
                    key={item.id}
                  >
                    <div className="amr-card-heading">
                      <div>
                        <strong>{item.full_name}</strong>
                        <small>{item.email}</small>
                      </div>

                      <span
                        className={`amr-status ${item.status}`}
                      >
                        {item.status === "pending"
                          ? "Menunggu"
                          : item.status === "approved"
                          ? "Disetujui"
                          : "Ditolak"}
                      </span>
                    </div>

                    <div className="amr-detail">
                      <div>
                        <small>Departemen</small>
                        <strong>
                          {item.department || "—"}
                        </strong>
                      </div>

                      <div>
                        <small>Site</small>
                        <strong>{item.site || "—"}</strong>
                      </div>

                      <div>
                        <small>Tanggal Pengajuan</small>
                        <strong>
                          {dateText(item.created_at)}
                        </strong>
                      </div>
                    </div>

                    {item.status === "pending" && (
                      <div className="amr-actions">
                        <button
                          type="button"
                          className="approve"
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            review(item, "approved")
                          }
                        >
                          {busyId === item.id
                            ? "Memproses..."
                            : "✓ Setujui"}
                        </button>

                        <button
                          type="button"
                          className="reject"
                          disabled={Boolean(busyId)}
                          onClick={() =>
                            review(item, "rejected")
                          }
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                  </article>
                ))}

                {!filtered.length && (
                  <div className="amr-empty">
                    Belum ada pengajuan sesuai filter.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

const css = `
.amr-root {
  --amr-bg: #f1f6f5;
  --amr-card: #ffffff;
  --amr-text: #18362e;
  --amr-muted: #71877e;
  --amr-border: #dde9e3;
  --amr-soft: #f5faf7;
  min-height: 100vh;
  background: var(--amr-bg);
  color: var(--amr-text);
  font-family: Arial, Helvetica, sans-serif;
}

html[data-theme="dark"] .amr-root {
  color-scheme: dark;
  --amr-bg: #0d171b;
  --amr-card: #17272b;
  --amr-text: #e9f5ef;
  --amr-muted: #a5bbb8;
  --amr-border: #30484b;
  --amr-soft: #203438;
}

.amr-root * {
  box-sizing: border-box;
}

.amr-header {
  background: #081f1d;
  color: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 17px 25px;
  gap: 12px;
}

.amr-header strong {
  font-size: 22px;
}

.amr-header strong span {
  color: #51d5a0;
}

.amr-header button {
  background: #ffffff15;
  color: #ffffff;
  border: 1px solid #ffffff30;
  border-radius: 9px;
  padding: 10px;
  cursor: pointer;
}

.amr-container {
  max-width: 1200px;
  padding: 24px;
  margin: auto;
}

.amr-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.amr-heading small {
  color: #1ca578;
  font-size: 10px;
  font-weight: 800;
}

.amr-heading h1 {
  margin: 10px 0;
  font-size: 27px;
}

.amr-heading p {
  color: var(--amr-muted);
  font-size: 13px;
}

.amr-admin {
  font-size: 12px;
  padding: 11px;
  border-radius: 10px;
  background: var(--amr-soft);
}

.amr-stats {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.amr-stats > div {
  padding: 19px;
  background: var(--amr-card);
  border: 1px solid var(--amr-border);
  border-radius: 13px;
}

.amr-stats span,
.amr-stats strong {
  display: block;
}

.amr-stats span {
  color: var(--amr-muted);
  font-size: 11px;
}

.amr-stats strong {
  font-size: 29px;
  margin-top: 9px;
  color: #21ad80;
}

.amr-panel {
  padding: 21px;
  border-radius: 15px;
  background: var(--amr-card);
  border: 1px solid var(--amr-border);
}

.amr-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.amr-toolbar h2 {
  margin: 0;
  font-size: 18px;
}

.amr-toolbar button,
.amr-filters input,
.amr-filters select {
  border: 1px solid var(--amr-border);
  border-radius: 9px;
  padding: 11px;
  background: var(--amr-soft);
  color: var(--amr-text);
  font: inherit;
  font-size: 12px;
}

.amr-toolbar button {
  cursor: pointer;
}

.amr-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 18px;
}

.amr-filters input {
  flex: 1 1 220px;
  min-width: 0;
}

.amr-filters select {
  flex: 0 1 240px;
  min-width: 0;
}

.amr-list {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 12px;
}

.amr-card {
  min-width: 0;
  padding: 17px;
  border: 1px solid var(--amr-border);
  border-radius: 12px;
  background: var(--amr-soft);
}

.amr-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 18px;
}

.amr-card-heading strong,
.amr-card-heading small {
  display: block;
  overflow-wrap: anywhere;
}

.amr-card-heading strong {
  font-size: 14px;
}

.amr-card-heading small {
  font-size: 11px;
  color: var(--amr-muted);
  margin-top: 6px;
}

.amr-status {
  flex-shrink: 0;
  padding: 7px 9px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 800;
}

.amr-status.pending {
  background: #fff2d8;
  color: #956218;
}

.amr-status.approved {
  background: #dff8e9;
  color: #087d57;
}

.amr-status.rejected {
  background: #ffe4e6;
  color: #b91c1c;
}

.amr-detail {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.amr-detail small,
.amr-detail strong {
  display: block;
  overflow-wrap: anywhere;
}

.amr-detail small {
  color: var(--amr-muted);
  font-size: 10px;
  margin-bottom: 6px;
}

.amr-detail strong {
  font-size: 11px;
}

.amr-actions {
  display: flex;
  gap: 9px;
  border-top: 1px solid var(--amr-border);
  padding-top: 14px;
}

.amr-actions button {
  flex: 1;
  border: 0;
  padding: 12px;
  border-radius: 9px;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}

.amr-actions button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.amr-actions .approve {
  background: #078b61;
  color: #ffffff;
}

.amr-actions .reject {
  background: #dd4048;
  color: #ffffff;
}

.amr-empty {
  grid-column: 1 / -1;
  padding: 30px;
  text-align: center;
  color: var(--amr-muted);
  font-size: 12px;
}

.amr-error,
.amr-success {
  margin: 15px 0;
  padding: 13px;
  border-radius: 10px;
  font-size: 12px;
}

.amr-error {
  background: #ffe4e6;
  color: #b91c1c;
}

.amr-success {
  background: #dcfce7;
  color: #087d57;
}

@media(max-width:750px) {
  .amr-list {
    grid-template-columns: 1fr;
  }

  .amr-container {
    padding: 12px;
  }

  .amr-heading h1 {
    font-size: 22px;
  }

  .amr-stats {
    gap: 7px;
  }

  .amr-stats > div {
    padding: 12px;
  }

  .amr-stats strong {
    font-size: 24px;
  }

  .amr-detail {
    grid-template-columns: 1fr 1fr;
  }

  .amr-panel {
    padding: 14px;
  }
}
`;

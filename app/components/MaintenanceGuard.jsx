
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ====================================================
// OJT MineTrack v2.0
// MAINTENANCE GUARD
//
// Admin:
// - Akses penuh saat maintenance ON maupun OFF.
//
// Mentor dan Peserta:
// - Akses normal saat maintenance OFF.
// - Diblokir saat maintenance ON.
//
// Pengunjung belum login:
// - Dapat menuju halaman Login.
//
// Perbaikan:
// - Silent background checking.
// - Tidak menampilkan loading setiap 15 detik.
// - Mencegah hasil request lama menimpa request baru.
// - Tetap fail-closed ketika verifikasi gagal.
// ====================================================

export default function MaintenanceGuard({
  children,
}) {
  const pathname = usePathname();

  const [status, setStatus] =
    useState("checking");

  const [errorMessage, setErrorMessage] =
    useState("");

  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);

  // Menyimpan status terbaru agar pemeriksaan
  // berkala tidak perlu mengganti tampilan.
  const statusRef = useRef("checking");

  const isLoginPage =
    pathname === "/login" ||
    pathname?.startsWith("/login/");

  const updateStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;

    setStatus((previous) =>
      previous === nextStatus
        ? previous
        : nextStatus
    );
  }, []);

  const checkMaintenance = useCallback(
    async (showLoading = false) => {
      const requestId =
        ++requestIdRef.current;

      const isCurrent = () =>
        mountedRef.current &&
        requestId === requestIdRef.current;

      if (!mountedRef.current) return;

      // Hanya menampilkan loading ketika
      // pemeriksaan awal atau diminta ulang
      // dari kondisi yang belum valid.
      //
      // Saat akses sudah allowed, background
      // checking tidak mengganti tampilan.
      if (
        showLoading &&
        statusRef.current !== "allowed"
      ) {
        updateStatus("checking");
      }

      try {
        // 1. Periksa sesi lokal terlebih dahulu.
        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isCurrent()) return;

        if (sessionError) {
          throw new Error(
            `Gagal membaca sesi: ${sessionError.message}`
          );
        }

        const session =
          sessionData?.session;

        // 2. Pengunjung belum login.
        //
        // Halaman utama tetap bisa menjalankan
        // redirect ke /login.
        //
        // Ini bukan izin membaca data OJT.
        if (!session?.user) {
          updateStatus("allowed");
          setErrorMessage("");
          return;
        }

        // 3. Verifikasi user aktif.
        const {
          data: userData,
          error: authError,
        } = await supabase.auth.getUser();

        if (!isCurrent()) return;

        if (
          authError ||
          !userData?.user
        ) {
          throw new Error(
            authError?.message ||
              "Sesi pengguna tidak dapat diverifikasi."
          );
        }

        const user =
          userData.user;

        // 4. Ambil status Maintenance Mode.
        const {
          data: setting,
          error: settingError,
        } = await supabase
          .from("app_settings")
          .select("maintenance_mode")
          .eq("id", 1)
          .maybeSingle();

        if (!isCurrent()) return;

        if (settingError) {
          throw new Error(
            `Gagal membaca Maintenance Mode: ${settingError.message}`
          );
        }

        if (
          typeof setting?.maintenance_mode !==
          "boolean"
        ) {
          throw new Error(
            "Pengaturan Maintenance Mode tidak ditemukan atau tidak valid."
          );
        }

        const maintenanceOn =
          setting.maintenance_mode === true;

        // 5. Jika Maintenance OFF,
        // semua pengguna lanjut ke pemeriksaan
        // hak akses halaman masing-masing.
        if (!maintenanceOn) {
          updateStatus("allowed");
          setErrorMessage("");
          return;
        }

        // 6. Maintenance ON:
        // Periksa apakah pengguna Admin.
        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!isCurrent()) return;

        if (profileError) {
          throw new Error(
            `Gagal memverifikasi role: ${profileError.message}`
          );
        }

        const role = String(
          profile?.role || ""
        )
          .trim()
          .toLowerCase();

        if (role === "admin") {
          updateStatus("allowed");
        } else {
          updateStatus("maintenance");
        }

        setErrorMessage("");
      } catch (error) {
        if (!isCurrent()) return;

        console.error(
          "MaintenanceGuard error:",
          error
        );

        // Jika proses pengecekan gagal,
        // halaman data ditutup.
        //
        // Ini tetap berlaku meskipun
        // sebelumnya status allowed.
        setErrorMessage(
          error?.message ||
            "Status layanan tidak dapat diperiksa. Silakan coba lagi."
        );

        updateStatus("error");
      }
    },
    [updateStatus]
  );

  useEffect(() => {
    mountedRef.current = true;

    let active = true;
    const timers = new Set();

    function refreshAccess(showLoading = false) {
      if (!active) return;

      checkMaintenance(showLoading);
    }

    // Pemeriksaan pertama.
    refreshAccess(true);

    // Pemeriksaan berkala setiap 15 detik.
    //
    // Tidak mengubah status ke checking
    // selama Dashboard masih diizinkan.
    const interval = setInterval(() => {
      if (
        active &&
        document.visibilityState === "visible"
      ) {
        refreshAccess(false);
      }
    }, 15000);

    // Periksa saat pengguna kembali
    // membuka browser.
    function handleVisibilityChange() {
      if (
        active &&
        document.visibilityState === "visible"
      ) {
        refreshAccess(false);
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    // Periksa setelah login, logout,
    // atau pembaruan sesi.
    //
    // Hindari memanggil Supabase query
    // langsung dalam callback Auth.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event) => {
        if (!active) return;

        if (event === "INITIAL_SESSION") {
          return;
        }

        // Pada SIGNED_OUT segera hentikan
        // penampilan konten sampai status
        // akses diperiksa kembali.
        if (event === "SIGNED_OUT") {
          updateStatus("checking");
        }

        const timer = setTimeout(() => {
          timers.delete(timer);

          if (active) {
            refreshAccess(false);
          }
        }, 0);

        timers.add(timer);
      }
    );

    return () => {
      active = false;

      // Cegah hasil pemeriksaan lama
      // memperbarui state setelah cleanup.
      requestIdRef.current += 1;
      mountedRef.current = false;

      clearInterval(interval);

      timers.forEach((timer) => {
        clearTimeout(timer);
      });

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      subscription.unsubscribe();
    };
  }, [
    checkMaintenance,
    pathname,
    updateStatus,
  ]);

  // ====================================================
  // LOGIN
  //
  // Halaman Login selalu tersedia.
  // ====================================================

  if (isLoginPage) {
    return children;
  }

  // ====================================================
  // CHECKING
  //
  // Hanya muncul ketika pemeriksaan akses awal
  // atau perubahan sesi yang memerlukan verifikasi.
  // ====================================================

  if (status === "checking") {
    return (
      <main style={styles.center}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 31,
              fontWeight: 900,
              marginBottom: 14,
            }}
          >
            OJT{" "}
            <span
              style={{
                color: "#28c58b",
              }}
            >
              MineTrack
            </span>
          </div>

          <p
            style={{
              color: "#cbd5d1",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            Memeriksa akses OJT MineTrack...
          </p>
        </div>
      </main>
    );
  }

  // ====================================================
  // ERROR
  // ====================================================

  if (status === "error") {
    return (
      <main style={styles.center}>
        <div
          style={{
            textAlign: "center",
            maxWidth: 460,
            width: "100%",
          }}
        >
          <h2
            style={{
              fontSize: 27,
              lineHeight: 1.3,
            }}
          >
            Gagal Memeriksa Akses
          </h2>

          <p
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              color: "#d3e5dc",
              marginTop: 18,
              overflowWrap: "anywhere",
            }}
          >
            {errorMessage}
          </p>

          <p
            style={{
              color: "#9db4ae",
              fontSize: 12,
              lineHeight: 1.7,
              marginTop: 14,
            }}
          >
            Data OJT tidak ditampilkan sampai
            akses dapat diverifikasi.
          </p>

          <button
            type="button"
            onClick={() => checkMaintenance(true)}
            style={styles.button}
          >
            Coba Lagi
          </button>

          <div style={{ marginTop: 18 }}>
            <a
              href="/login"
              style={{
                color: "#d8b45a",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              Buka Halaman Login
            </a>
          </div>
        </div>
      </main>
    );
  }

  // ====================================================
  // MAINTENANCE
  //
  // Hanya Admin dapat mengakses
  // website ketika Maintenance ON.
  // ====================================================

  if (status === "maintenance") {
    return (
      <main style={styles.maintenancePage}>
        <div style={styles.card}>
          <div style={{ fontSize: 54 }}>
            🛠️
          </div>

          <p style={styles.brand}>
            OJT MINETRACK v2.0
          </p>

          <h1 style={styles.title}>
            Website Sedang Dalam Pemeliharaan
          </h1>

          <p style={styles.description}>
            Sistem Monitoring dan Evaluasi OJT
            sedang menjalani proses pemeliharaan
            dan peningkatan layanan.
          </p>

          <p style={styles.notice}>
            Silakan kembali beberapa saat lagi.
          </p>

          <button
            type="button"
            onClick={() => checkMaintenance(true)}
            style={styles.button}
          >
            Coba Lagi
          </button>

          <div style={{ marginTop: 18 }}>
            <a
              href="/login"
              style={{
                color: "#d8b45a",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "underline",
              }}
            >
              Buka Halaman Login
            </a>
          </div>

          <div style={styles.footer}>
            Emergency Response Group
            <br />
            PT Berau Coal
          </div>
        </div>
      </main>
    );
  }

  // ====================================================
  // ALLOWED
  //
  // Tidak ada perubahan tampilan pada
  // pemeriksaan otomatis yang berhasil.
  //
  // RLS Supabase tetap melindungi data.
  // ====================================================

  return children;
}

const styles = {
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#071b22",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },

  maintenancePage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
    background:
      "linear-gradient(145deg, #071b22, #124734)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: 480,
    padding: "40px 24px",
    borderRadius: 24,
    textAlign: "center",
    background: "rgba(255,255,255,0.08)",
    border:
      "1px solid rgba(255,255,255,0.15)",
  },

  brand: {
    color: "#d8b45a",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 2,
    marginTop: 20,
  },

  title: {
    fontSize: 28,
    lineHeight: 1.3,
    marginTop: 16,
  },

  description: {
    color: "#d3e5dc",
    fontSize: 14,
    lineHeight: 1.9,
    marginTop: 16,
  },

  notice: {
    color: "#d8b45a",
    fontWeight: 700,
    marginTop: 24,
  },

  footer: {
    borderTop:
      "1px solid rgba(255,255,255,0.15)",
    paddingTop: 20,
    marginTop: 35,
    fontSize: 11,
    lineHeight: 1.8,
    color: "#b8ccc1",
  },

  button: {
    padding: "12px 20px",
    background: "#d8b45a",
    color: "#071b22",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
  },
};

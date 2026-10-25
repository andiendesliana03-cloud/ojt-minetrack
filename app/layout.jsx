
import PresenceTracker from "./components/PresenceTracker";
import MaintenanceGuard from "./components/MaintenanceGuard";

export const metadata = {
  title: "OJT MineTrack v2.0",
  description:
    "Monitoring dan Evaluasi OJT - Emergency Response Group PT Berau Coal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          fontFamily: "Arial, sans-serif",
          background: "#f3f6fa",
        }}
      >
        <MaintenanceGuard>
          <PresenceTracker />
          {children}
        </MaintenanceGuard>
      </body>
    </html>
  );
}

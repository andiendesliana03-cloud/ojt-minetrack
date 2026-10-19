
export const metadata = {
  title: "OJT MineTrack v2.0",
  description: "Monitoring dan Evaluasi OJT",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body style={{
        margin: 0,
        fontFamily: "Arial, sans-serif",
        background: "#f3f6fa"
      }}>
        {children}
      </body>
    </html>
  );
}

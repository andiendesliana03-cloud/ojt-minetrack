
/* ==========================================
   RAPOR OJT - PRINT 1 PAGE A4 PORTRAIT
   ========================================== */

@page {
  size: A4 portrait;
  margin: 5mm;
}

@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
    overflow: visible !important;
  }

  .lo-topbar,
  .lo-mobile-actions {
    display: none !important;
  }

  .lo-root {
    min-height: 0 !important;
    background: white !important;
    overflow: visible !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .lo-container {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: visible !important;
  }

  /*
   * Rapor diperlebar secara internal,
   * lalu diperkecil khusus untuk cetak.
   * Nilai zoom dapat disesuaikan berdasarkan
   * pratinjau Safari.
   */

  .lo-sheet {
    width: 380mm !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 3mm !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    zoom: 0.52;
  }

  .lo-header {
    margin-bottom: 7px !important;
    border-radius: 5px !important;
  }

  .lo-header-top {
    display: grid !important;
    grid-template-columns: 170px 1fr 120px !important;
    padding: 9px 14px !important;
    gap: 8px !important;
    text-align: initial !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .lo-logo-box {
    justify-content: flex-start !important;
  }

  .lo-logo-mark {
    width: 40px !important;
    height: 40px !important;
    font-size: 21px !important;
  }

  .lo-logo-text strong {
    font-size: 14px !important;
  }

  .lo-logo-text span {
    font-size: 8px !important;
  }

  .lo-title h1 {
    font-size: 25px !important;
    margin: 0 !important;
  }

  .lo-title h2 {
    font-size: 13px !important;
    margin: 2px 0 !important;
  }

  .lo-title p {
    font-size: 10px !important;
    margin: 3px 0 !important;
  }

  .lo-badge-wrap {
    justify-content: flex-end !important;
  }

  .lo-badge {
    width: 60px !important;
    height: 60px !important;
    border-width: 4px !important;
    font-size: 10px !important;
  }

  .lo-grid-top {
    display: grid !important;
    grid-template-columns: 1.15fr 1fr !important;
    gap: 8px !important;
    margin-bottom: 7px !important;
  }

  .lo-box-title,
  .lo-section-bar {
    padding: 5px 9px !important;
    font-size: 11px !important;
    border-radius: 3px !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .lo-box-content {
    padding: 6px 9px !important;
  }

  .lo-data-table td {
    padding: 3px 0 !important;
    font-size: 10px !important;
  }

  .lo-box-content p {
    margin-bottom: 4px !important;
    font-size: 10px !important;
    line-height: 1.35 !important;
  }

  .lo-section {
    margin-bottom: 7px !important;
    break-inside: auto !important;
    page-break-inside: auto !important;
  }

  .lo-table-wrap {
    overflow: visible !important;
    margin-bottom: 3px !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .lo-table {
    min-width: 0 !important;
    width: 100% !important;
    table-layout: fixed !important;
  }

  .lo-table th,
  .lo-table td {
    padding: 4px 3px !important;
    font-size: 9px !important;
    line-height: 1.15 !important;
    overflow-wrap: anywhere !important;
  }

  .lo-week-name {
    font-size: 8px !important;
    line-height: 1.1 !important;
    margin-bottom: 2px !important;
  }

  .lo-week-score {
    font-size: 10px !important;
    line-height: 1.1 !important;
  }

  .lo-grid-bottom {
    display: grid !important;
    grid-template-columns: 1.2fr .95fr !important;
    gap: 8px !important;
    margin-bottom: 7px !important;
  }

  .lo-ket-table th,
  .lo-ket-table td {
    padding: 4px 3px !important;
    font-size: 8px !important;
  }

  .lo-notes {
    padding: 6px 9px !important;
  }

  .lo-notes li {
    font-size: 9px !important;
    line-height: 1.3 !important;
    margin-bottom: 3px !important;
  }

  .lo-summary {
    padding: 6px !important;
  }

  .lo-summary-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 4px !important;
    margin-bottom: 5px !important;
  }

  .lo-summary-card {
    padding: 5px !important;
    border-radius: 4px !important;
  }

  .lo-summary-card span {
    font-size: 8px !important;
    margin-bottom: 2px !important;
  }

  .lo-summary-card strong {
    font-size: 18px !important;
  }

  .lo-grade-box {
    display: grid !important;
    grid-template-columns: 90px 1fr !important;
    gap: 5px !important;
  }

  .lo-grade-left {
    padding: 6px !important;
  }

  .lo-grade-letter {
    font-size: 41px !important;
  }

  .lo-grade-label {
    font-size: 9px !important;
  }

  .lo-grade-right th,
  .lo-grade-right td {
    padding: 4px !important;
    font-size: 8px !important;
  }

  .lo-sign-row {
    display: grid !important;
    grid-template-columns: 1fr 220px !important;
    gap: 8px !important;
    margin-top: 6px !important;
  }

  .lo-sign-box {
    min-height: 0 !important;
    padding: 7px !important;
  }

  .lo-sign-box p,
  .lo-signature {
    font-size: 9px !important;
    line-height: 1.35 !important;
    margin-bottom: 3px !important;
  }

  .lo-signature .space {
    height: 23px !important;
  }

  .lo-signature strong {
    font-size: 9px !important;
  }

  .lo-footer {
    padding: 4px 0 0 !important;
    font-size: 8px !important;
  }

  .lo-grid-top,
  .lo-grid-bottom,
  .lo-sign-row {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
}

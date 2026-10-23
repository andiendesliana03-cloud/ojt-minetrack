
/**
 * OJT MineTrack v2.0
 * Pengaturan akses transaksi OJT.
 *
 * Modul khusus server.
 * Tidak boleh digunakan di komponen client.
 *
 * Default: semua transaksi nonaktif.
 */

function isEnabled(name) {
  return process.env[name] === "true";
}

function normalizeId(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    normalizeId(value)
  );
}

export function getOjtAccessConfig() {
  return {
    submissionEnabled: isEnabled(
      "OJT_SUBMISSION_ENABLED"
    ),

    approvalEnabled: isEnabled(
      "OJT_APPROVAL_ENABLED"
    ),

    rejectionEnabled: isEnabled(
      "OJT_REJECTION_ENABLED"
    ),

    testModeEnabled: isEnabled(
      "OJT_TEST_MODE_ENABLED"
    ),

    testParticipantId: normalizeId(
      process.env.OJT_TEST_PARTICIPANT_ID
    ),

    testMentorId: normalizeId(
      process.env.OJT_TEST_MENTOR_ID
    ),
  };
}

/**
 * Memeriksa izin pengajuan peserta.
 *
 * Mode umum:
 * - Semua peserta yang lolos validasi API.
 *
 * Mode pengujian:
 * - Hanya peserta pengujian tertentu.
 *
 * Kedua mode nonaktif:
 * - Seluruh transaksi nyata ditolak.
 */
export function canSubmitOjt(participantId) {
  const config = getOjtAccessConfig();

  if (!isValidUuid(participantId)) {
    return false;
  }

  // Jika mode pengujian aktif,
  // pembatasan akun berlaku terlebih dahulu.
  if (config.testModeEnabled) {
    return (
      isValidUuid(config.testParticipantId) &&
      normalizeId(participantId) ===
        config.testParticipantId
    );
  }

  // Penggunaan umum.
  return config.submissionEnabled;
}

/**
 * Memeriksa izin keputusan mentor.
 *
 * Mode umum:
 * - Seluruh mentor sesuai role yang telah
 *   diverifikasi oleh API.
 *
 * Mode pengujian:
 * - Hanya mentor dan peserta pengujian
 *   yang ditentukan.
 *
 * Kedua mode nonaktif:
 * - Seluruh keputusan nyata ditolak.
 */
export function canReviewOjt(
  mentorId,
  participantId,
  decision
) {
  const config = getOjtAccessConfig();

  if (
    !isValidUuid(mentorId) ||
    !isValidUuid(participantId)
  ) {
    return false;
  }

  if (
    decision !== "approved" &&
    decision !== "rejected"
  ) {
    return false;
  }

  // Mode pengujian harus membatasi
  // mentor dan peserta sekaligus.
  if (config.testModeEnabled) {
    return (
      isValidUuid(config.testMentorId) &&
      isValidUuid(config.testParticipantId) &&
      normalizeId(mentorId) ===
        config.testMentorId &&
      normalizeId(participantId) ===
        config.testParticipantId
    );
  }

  // Penggunaan umum.
  if (decision === "approved") {
    return config.approvalEnabled;
  }

  return config.rejectionEnabled;
}

/**
 * Menampilkan status aktivasi tanpa
 * mengungkap ID akun pengujian.
 */
export function getPublicOjtFeatures() {
  const config = getOjtAccessConfig();

  return {
    submission_enabled:
      !config.testModeEnabled &&
      config.submissionEnabled,

    approval_enabled:
      !config.testModeEnabled &&
      config.approvalEnabled,

    rejection_enabled:
      !config.testModeEnabled &&
      config.rejectionEnabled,
  };
}

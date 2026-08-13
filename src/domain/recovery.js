// ═══════════════════════════════════════════════════════
// RECOVERY MODE
// Auto-suggested (not forced) on: very low energy, or manual trigger.
// When active: only essentials remain, all at minimum level, no "catch up" framing.
// ═══════════════════════════════════════════════════════
const RECOVERY_ESSENTIAL_IDS = ['prayer', 'family', 'ielts', 'programming', 'quran', 'sleep'];

function shouldSuggestRecovery(log) {
  if (!log) return false;
  if (log.energyScore != null && log.energyScore <= 3) return true;
  if (log.energy === 'low' && log.recoveryReason) return true;
  return false;
}

function recoveryMissionSet(missions) {
  return missions.filter((m) => RECOVERY_ESSENTIAL_IDS.includes(m.id));
}

const RECOVERY_REASONS = [
  'Late wake-up', 'Very low energy', 'Unexpected family responsibility',
  'Travel', 'Illness / physical discomfort', 'Poor sleep',
  'Emotionally difficult day', 'Major interruption', 'Just need it today'
];

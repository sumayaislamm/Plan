// ═══════════════════════════════════════════════════════
// ENERGY → workload level per mission.
// LOW: minimum on everything except essentials stay standard.
// NORMAL: standard across the board.
// HIGH: stretch on primary + optional extras unlocked.
// ═══════════════════════════════════════════════════════
function levelForMission(mission, energy, recoveryActive) {
  if (recoveryActive) return 'minimum';
  if (energy === 'low') return 'minimum';
  if (energy === 'high') return mission.weight === 'primary' ? 'stretch' : 'standard';
  return 'standard'; // normal
}

function levelValue(mission, level) { return mission.levels[level]; }

function energyLabel(energy) {
  return { low: 'Low', normal: 'Normal', high: 'High' }[energy] || 'Normal';
}

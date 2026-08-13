// ═══════════════════════════════════════════════════════
// MISSIONS — the priority tree. weight:'primary' gets visual emphasis.
// levels are in MINUTES for time-based missions, or {value,unit} for count-based ones.
// priorityRank: lower number = higher priority when time is scarce (used by nextAction + scheduler)
// ═══════════════════════════════════════════════════════
const CATEGORY_ORDER = ['primary', 'career', 'foundation', 'body', 'life'];
const CATEGORY_LABELS = { primary: 'Primary Missions', career: 'Career', foundation: 'Foundations', body: 'Body', life: 'Life' };

function defaultMissions() {
  return [
    // PRIMARY
    { id: 'ielts', name: 'IELTS Band 8+', category: 'primary', weight: 'primary', priorityRank: 2, type: 'time',
      levels: { minimum: 20, standard: 60, stretch: 120 }, frequency: 'daily' },
    { id: 'programming', name: 'Programming / Career Dev', category: 'primary', weight: 'primary', priorityRank: 3, type: 'time',
      levels: { minimum: 30, standard: 120, stretch: 240 }, frequency: 'daily' },

    // CAREER
    { id: 'job-apps', name: 'Job Applications', category: 'career', weight: 'standard', priorityRank: 4, type: 'count',
      levels: { minimum: 0, standard: 1, stretch: 2 }, frequency: 'weekly', weeklyTarget: 5 },
    { id: 'portfolio', name: 'Portfolio / Projects', category: 'career', weight: 'standard', priorityRank: 5, type: 'time',
      levels: { minimum: 15, standard: 45, stretch: 90 }, frequency: '3x/week' },
    { id: 'career-prep', name: 'Career Preparation', category: 'career', weight: 'standard', priorityRank: 6, type: 'time',
      levels: { minimum: 10, standard: 30, stretch: 60 }, frequency: '3x/week' },

    // FOUNDATIONS
    { id: 'prayer', name: '5 Daily Prayers', category: 'foundation', weight: 'standard', priorityRank: 1, type: 'count',
      levels: { minimum: 3, standard: 5, stretch: 5 }, frequency: 'daily' },
    { id: 'quran', name: 'Quran', category: 'foundation', weight: 'standard', priorityRank: 1, type: 'time',
      levels: { minimum: 5, standard: 20, stretch: 45 }, frequency: 'daily' },
    { id: 'family', name: 'Family Responsibilities', category: 'foundation', weight: 'standard', priorityRank: 1, type: 'time',
      levels: { minimum: 15, standard: 45, stretch: 90 }, frequency: 'daily' },
    { id: 'sleep', name: 'Proper Sleep', category: 'foundation', weight: 'standard', priorityRank: 1, type: 'time',
      levels: { minimum: 360, standard: 450, stretch: 480 }, frequency: 'daily' },
    { id: 'food', name: 'Food / Hydration', category: 'foundation', weight: 'standard', priorityRank: 1, type: 'count',
      levels: { minimum: 2, standard: 3, stretch: 3 }, frequency: 'daily' },

    // BODY
    { id: 'exercise', name: 'Exercise', category: 'body', weight: 'standard', priorityRank: 7, type: 'time',
      levels: { minimum: 5, standard: 30, stretch: 60 }, frequency: '5x/week' },
    { id: 'walking', name: 'Walking', category: 'body', weight: 'standard', priorityRank: 7, type: 'time',
      levels: { minimum: 5, standard: 20, stretch: 40 }, frequency: 'daily' },
    { id: 'yoga', name: 'Yoga / Stretching', category: 'body', weight: 'standard', priorityRank: 7, type: 'time',
      levels: { minimum: 5, standard: 15, stretch: 30 }, frequency: '5x/week' },

    // LIFE
    { id: 'reading', name: 'Reading', category: 'life', weight: 'standard', priorityRank: 8, type: 'time',
      levels: { minimum: 5, standard: 20, stretch: 45 }, frequency: '5x/week' },
    { id: 'hobby', name: 'Hobbies', category: 'life', weight: 'standard', priorityRank: 8, type: 'time',
      levels: { minimum: 10, standard: 30, stretch: 60 }, frequency: '3x/week' },
    { id: 'social', name: 'Social / Family Time', category: 'life', weight: 'standard', priorityRank: 8, type: 'time',
      levels: { minimum: 15, standard: 45, stretch: 90 }, frequency: '5x/week' },
    { id: 'rest', name: 'Entertainment / Rest', category: 'life', weight: 'standard', priorityRank: 8, type: 'time',
      levels: { minimum: 15, standard: 45, stretch: 90 }, frequency: 'daily' },
  ];
}

// life-balance mapping: which missions feed which balance category
const BALANCE_CATEGORIES = {
  Deen: ['prayer', 'quran'],
  Career: ['job-apps', 'portfolio', 'career-prep', 'programming'],
  Study: ['ielts'],
  Body: ['exercise', 'walking', 'yoga'],
  Family: ['family', 'social'],
  Hobbies: ['hobby'],
  Rest: ['rest', 'sleep'],
};

async function loadMissions() {
  const m = await storeGet('missions', null);
  if (m) return m;
  const def = defaultMissions();
  await storeSet('missions', def);
  return def;
}
async function saveMissions(missions) { await storeSet('missions', missions); }
function missionById(missions, id) { return missions.find((m) => m.id === id); }
function missionsByCategory(missions, cat) { return missions.filter((m) => m.category === cat); }

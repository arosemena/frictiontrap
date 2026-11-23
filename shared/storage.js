/**
 * Storage helpers for FrictionTrap settings, stats, and per-tab unlock grants.
 */

export const DEFAULT_SETTINGS = {
  enabled: true,
  sites: ['x.com', 'twitter.com'],
  problemCount: 4,
  difficulty: 'medium', // 'easy' | 'medium' | 'hard'
  resetOnWrong: true,
  unlockDurationMinutes: 10, // 0 means "until tab closes"
};

export const DEFAULT_STATS = {
  turnedBackCount: 0,
  unlockedCount: 0,
};

const SETTINGS_KEY = 'frictiontrap_settings';
const STATS_KEY = 'frictiontrap_stats';
const GRANTS_KEY = 'frictiontrap_grants';

export async function getSettings() {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(result[SETTINGS_KEY] || {}),
  };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current, ...partial };
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getStats() {
  const result = await chrome.storage.local.get(STATS_KEY);
  return {
    ...DEFAULT_STATS,
    ...(result[STATS_KEY] || {}),
  };
}

export async function incrementStat(field) {
  const stats = await getStats();
  const next = {
    ...stats,
    [field]: (stats[field] || 0) + 1,
  };
  await chrome.storage.local.set({ [STATS_KEY]: next });
  return next;
}

export async function resetStats() {
  await chrome.storage.local.set({ [STATS_KEY]: { ...DEFAULT_STATS } });
  return { ...DEFAULT_STATS };
}

/**
 * Per-tab grants stored in chrome.storage.session so they persist across
 * MV3 service worker restarts and automatically clear on browser restart.
 *
 * Shape: { [tabId: string]: { rule: string, grantedAt: number, expiresAt: number | null } }
 */
export async function getAllGrants() {
  const result = await chrome.storage.session.get(GRANTS_KEY);
  return result[GRANTS_KEY] || {};
}

export async function getTabGrant(tabId) {
  const grants = await getAllGrants();
  return grants[String(tabId)] || null;
}

export async function setTabGrant(tabId, grant) {
  const grants = await getAllGrants();
  grants[String(tabId)] = grant;
  await chrome.storage.session.set({ [GRANTS_KEY]: grants });
}

export async function clearTabGrant(tabId) {
  const grants = await getAllGrants();
  if (String(tabId) in grants) {
    delete grants[String(tabId)];
    await chrome.storage.session.set({ [GRANTS_KEY]: grants });
  }
}

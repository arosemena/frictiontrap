import { findMatchingRule } from './shared/domains.js';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  incrementStat,
  getTabGrant,
  setTabGrant,
  clearTabGrant,
} from './shared/storage.js';

const ALARM_PREFIX = 'relock-';

// Short-lived in-memory guard to avoid double-redirecting when
// webNavigation.onBeforeNavigate and tabs.onUpdated fire back-to-back.
const redirectingTabs = new Map();

function alarmNameForTab(tabId) {
  return `${ALARM_PREFIX}${tabId}`;
}

function buildGateUrl(targetUrl, rule, reason = '') {
  const gateBase = chrome.runtime.getURL('gate.html');
  const params = new URLSearchParams({
    target: targetUrl,
    rule,
  });
  if (reason) {
    params.set('reason', reason);
  }
  return `${gateBase}?${params.toString()}`;
}

function isGrantValid(grant, rule) {
  if (!grant || grant.rule !== rule) return false;
  if (grant.expiresAt === null) return true;
  return Date.now() < grant.expiresAt;
}

async function redirectTabToGate(tabId, targetUrl, rule, reason = '') {
  const now = Date.now();
  const lastRedirect = redirectingTabs.get(tabId);
  if (lastRedirect && now - lastRedirect < 500) {
    return;
  }
  redirectingTabs.set(tabId, now);

  try {
    await chrome.tabs.update(tabId, {
      url: buildGateUrl(targetUrl, rule, reason),
    });
  } catch {
    // Tab may have been closed before update completed.
  } finally {
    setTimeout(() => {
      if (redirectingTabs.get(tabId) === now) {
        redirectingTabs.delete(tabId);
      }
    }, 600);
  }
}

async function evaluateNavigation(tabId, url) {
  if (tabId < 0 || !url) return;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return;

  const settings = await getSettings();
  if (!settings.enabled) return;

  const matchedRule = findMatchingRule(url, settings.sites);
  if (!matchedRule) return;

  const grant = await getTabGrant(tabId);
  if (isGrantValid(grant, matchedRule)) {
    return;
  }

  // Expired or mismatched grant: clean it up before redirecting.
  const wasExpired = Boolean(grant && grant.rule === matchedRule && grant.expiresAt !== null);
  if (grant) {
    await clearTabGrant(tabId);
    await chrome.alarms.clear(alarmNameForTab(tabId));
  }

  await redirectTabToGate(tabId, url, matchedRule, wasExpired ? 'expired' : '');
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get('frictiontrap_settings');
  if (!existing.frictiontrap_settings) {
    await saveSettings(DEFAULT_SETTINGS);
  }
});

// Intercept main-frame navigations before the site starts rendering.
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;
  evaluateNavigation(details.tabId, details.url);
});

// Safety net for SPA/history transitions or redirects missed by onBeforeNavigate.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    evaluateNavigation(tabId, changeInfo.url);
  }
});

// Clean up per-tab unlock state and alarms when a tab is closed.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  redirectingTabs.delete(tabId);
  await clearTabGrant(tabId);
  await chrome.alarms.clear(alarmNameForTab(tabId));
});

// Re-lock a tab when its optional session timer expires.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const tabId = Number.parseInt(alarm.name.slice(ALARM_PREFIX.length), 10);
  if (Number.isNaN(tabId)) return;

  const grant = await getTabGrant(tabId);
  await clearTabGrant(tabId);

  const settings = await getSettings();
  if (!settings.enabled) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url) return;
    const matchedRule = findMatchingRule(tab.url, settings.sites);
    if (matchedRule && (!grant || grant.rule === matchedRule)) {
      await redirectTabToGate(tabId, tab.url, matchedRule, 'expired');
    }
  } catch {
    // Tab no longer exists.
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handle = async () => {
    switch (message?.type) {
      case 'GRANT_ACCESS': {
        const tabId = sender.tab?.id ?? message.tabId;
        if (typeof tabId !== 'number') {
          return { ok: false, error: 'Missing tabId' };
        }
        const settings = await getSettings();
        const durationMinutes =
          typeof message.durationMinutes === 'number'
            ? message.durationMinutes
            : settings.unlockDurationMinutes;

        const grantedAt = Date.now();
        const expiresAt = durationMinutes > 0 ? grantedAt + durationMinutes * 60 * 1000 : null;

        await setTabGrant(tabId, {
          rule: message.rule,
          grantedAt,
          expiresAt,
        });

        await chrome.alarms.clear(alarmNameForTab(tabId));
        if (expiresAt !== null) {
          await chrome.alarms.create(alarmNameForTab(tabId), { when: expiresAt });
        }

        await incrementStat('unlockedCount');
        return { ok: true, expiresAt };
      }

      case 'BAIL_OUT': {
        const tabId = sender.tab?.id;
        await incrementStat('turnedBackCount');
        if (typeof tabId === 'number') {
          try {
            await chrome.tabs.remove(tabId);
          } catch {
            // Fallback if tab cannot be closed
            await chrome.tabs.update(tabId, { url: 'chrome://newtab' });
          }
        }
        return { ok: true };
      }

      case 'RELOCK_TAB': {
        const { tabId } = message;
        if (typeof tabId !== 'number') return { ok: false };
        await clearTabGrant(tabId);
        await chrome.alarms.clear(alarmNameForTab(tabId));
        const settings = await getSettings();
        try {
          const tab = await chrome.tabs.get(tabId);
          const matchedRule = tab?.url ? findMatchingRule(tab.url, settings.sites) : null;
          if (matchedRule) {
            await redirectTabToGate(tabId, tab.url, matchedRule, 'relocked');
          }
        } catch {
          // Tab closed
        }
        return { ok: true };
      }

      case 'GET_TAB_STATUS': {
        const { tabId, url } = message;
        const settings = await getSettings();
        const matchedRule = url ? findMatchingRule(url, settings.sites) : null;
        const grant = typeof tabId === 'number' ? await getTabGrant(tabId) : null;
        const activeGrant = matchedRule && isGrantValid(grant, matchedRule) ? grant : null;
        return {
          ok: true,
          matchedRule,
          grant: activeGrant,
        };
      }

      default:
        return { ok: false, error: 'Unknown message type' };
    }
  };

  handle()
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err) }));

  return true;
});

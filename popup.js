import { extractWebHostname, normalizeDomain } from './shared/domains.js';
import { getSettings, saveSettings, getStats } from './shared/storage.js';

const enabledToggle = document.getElementById('enabled-toggle');
const tabStatusCard = document.getElementById('tab-status-card');
const tabDomainEl = document.getElementById('tab-domain');
const tabStateEl = document.getElementById('tab-state');
const tabActionBtn = document.getElementById('tab-action-btn');
const siteCountEl = document.getElementById('site-count');
const addSiteForm = document.getElementById('add-site-form');
const siteInput = document.getElementById('site-input');
const formErrorEl = document.getElementById('form-error');
const siteListEl = document.getElementById('site-list');
const emptyStateEl = document.getElementById('empty-state');
const statResistedEl = document.getElementById('stat-resisted');
const statEnteredEl = document.getElementById('stat-entered');
const openOptionsBtn = document.getElementById('open-options-btn');

let settings = null;
let activeTab = null;

function showError(msg) {
  formErrorEl.textContent = msg;
  formErrorEl.classList.remove('hidden');
}

function clearError() {
  formErrorEl.textContent = '';
  formErrorEl.classList.add('hidden');
}

function formatRemaining(expiresAt) {
  const diffSec = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins > 0) return `${mins}m ${secs}s left`;
  return `${secs}s left`;
}

function renderSites() {
  siteListEl.innerHTML = '';
  const sites = settings.sites || [];
  siteCountEl.textContent = String(sites.length);
  emptyStateEl.classList.toggle('hidden', sites.length > 0);

  for (const domain of sites) {
    const li = document.createElement('li');
    li.className = 'site-item';

    const span = document.createElement('span');
    span.className = 'site-name';
    span.textContent = domain;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-remove';
    btn.title = `Remove ${domain}`;
    btn.setAttribute('aria-label', `Remove ${domain}`);
    btn.textContent = '×';
    btn.addEventListener('click', () => removeSite(domain));

    li.append(span, btn);
    siteListEl.appendChild(li);
  }
}

async function renderCurrentTabCard() {
  if (!activeTab?.url) {
    tabStatusCard.classList.add('hidden');
    return;
  }

  const host = extractWebHostname(activeTab.url);
  if (!host) {
    tabStatusCard.classList.add('hidden');
    return;
  }

  const normalized = normalizeDomain(host) || host;
  const status = await chrome.runtime.sendMessage({
    type: 'GET_TAB_STATUS',
    tabId: activeTab.id,
    url: activeTab.url,
  });

  tabStatusCard.classList.remove('hidden');
  tabDomainEl.textContent = normalized;

  if (status?.grant) {
    tabStateEl.className = 'tab-state unlocked';
    tabStateEl.textContent =
      status.grant.expiresAt !== null
        ? `Unlocked · ${formatRemaining(status.grant.expiresAt)}`
        : 'Unlocked until tab closes';
    tabActionBtn.className = 'btn-small accent';
    tabActionBtn.textContent = 'Re-lock now';
    tabActionBtn.onclick = async () => {
      await chrome.runtime.sendMessage({ type: 'RELOCK_TAB', tabId: activeTab.id });
      window.close();
    };
  } else if (status?.matchedRule) {
    tabStateEl.className = 'tab-state';
    tabStateEl.textContent = settings.enabled ? 'Protected by FrictionTrap' : 'Paused';
    tabActionBtn.className = 'btn-small';
    tabActionBtn.textContent = 'Remove';
    tabActionBtn.onclick = () => removeSite(status.matchedRule);
  } else {
    tabStateEl.className = 'tab-state';
    tabStateEl.textContent = 'Not on your list';
    tabActionBtn.className = 'btn-small accent';
    tabActionBtn.textContent = 'Add site';
    tabActionBtn.onclick = async () => {
      await addSite(normalized);
    };
  }
}

async function addSite(rawInput) {
  clearError();
  const domain = normalizeDomain(rawInput);
  if (!domain) {
    showError('Enter a valid domain like x.com or reddit.com');
    return false;
  }
  if (settings.sites.includes(domain)) {
    showError(`${domain} is already on your list.`);
    return false;
  }

  settings = await saveSettings({
    sites: [...settings.sites, domain],
  });
  renderSites();
  await renderCurrentTabCard();
  return true;
}

async function removeSite(domain) {
  clearError();
  settings = await saveSettings({
    sites: settings.sites.filter((s) => s !== domain),
  });
  renderSites();
  await renderCurrentTabCard();
}

enabledToggle.addEventListener('change', async () => {
  settings = await saveSettings({ enabled: enabledToggle.checked });
  await renderCurrentTabCard();
});

addSiteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const added = await addSite(siteInput.value);
  if (added) {
    siteInput.value = '';
  }
});

openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function init() {
  const [loadedSettings, stats, tabs] = await Promise.all([
    getSettings(),
    getStats(),
    chrome.tabs.query({ active: true, currentWindow: true }),
  ]);

  settings = loadedSettings;
  activeTab = tabs[0] || null;

  enabledToggle.checked = Boolean(settings.enabled);
  statResistedEl.textContent = String(stats.turnedBackCount || 0);
  statEnteredEl.textContent = String(stats.unlockedCount || 0);

  renderSites();
  await renderCurrentTabCard();
}

init();

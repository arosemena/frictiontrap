import { normalizeDomain } from './shared/domains.js';
import { generateMathProblem } from './shared/math.js';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  getStats,
  resetStats,
} from './shared/storage.js';

const saveToast = document.getElementById('save-toast');
const problemCountInput = document.getElementById('problem-count');
const problemCountVal = document.getElementById('problem-count-val');
const difficultySelect = document.getElementById('difficulty');
const sampleProblemEl = document.getElementById('sample-problem');
const refreshSampleBtn = document.getElementById('refresh-sample-btn');
const resetOnWrongInput = document.getElementById('reset-on-wrong');
const unlockDurationSelect = document.getElementById('unlock-duration');
const addSiteForm = document.getElementById('add-site-form');
const siteInput = document.getElementById('site-input');
const siteErrorEl = document.getElementById('site-error');
const siteListEl = document.getElementById('site-list');
const resetSitesBtn = document.getElementById('reset-sites-btn');
const resetStatsBtn = document.getElementById('reset-stats-btn');
const statResistedEl = document.getElementById('stat-resisted');
const statEnteredEl = document.getElementById('stat-entered');
const statRateEl = document.getElementById('stat-rate');

let settings = null;
let toastTimer = null;

function flashSaved() {
  saveToast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    saveToast.classList.remove('visible');
  }, 1500);
}

function updateSample() {
  const sample = generateMathProblem(difficultySelect.value);
  sampleProblemEl.textContent = `${sample.expression} = ${sample.answer}`;
}

function renderSites() {
  siteListEl.innerHTML = '';
  for (const domain of settings.sites) {
    const li = document.createElement('li');
    li.className = 'site-chip';

    const label = document.createElement('span');
    label.textContent = domain;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-remove';
    btn.title = `Remove ${domain}`;
    btn.setAttribute('aria-label', `Remove ${domain}`);
    btn.textContent = '×';
    btn.addEventListener('click', async () => {
      settings = await saveSettings({
        sites: settings.sites.filter((s) => s !== domain),
      });
      renderSites();
      flashSaved();
    });

    li.append(label, btn);
    siteListEl.appendChild(li);
  }
}

function renderStats(stats) {
  const resisted = stats.turnedBackCount || 0;
  const entered = stats.unlockedCount || 0;
  const total = resisted + entered;

  statResistedEl.textContent = String(resisted);
  statEnteredEl.textContent = String(entered);
  statRateEl.textContent = total > 0 ? `${Math.round((resisted / total) * 100)}%` : '—';
}

problemCountInput.addEventListener('input', () => {
  problemCountVal.textContent = problemCountInput.value;
});

problemCountInput.addEventListener('change', async () => {
  settings = await saveSettings({
    problemCount: Number.parseInt(problemCountInput.value, 10),
  });
  flashSaved();
});

difficultySelect.addEventListener('change', async () => {
  settings = await saveSettings({ difficulty: difficultySelect.value });
  updateSample();
  flashSaved();
});

refreshSampleBtn.addEventListener('click', updateSample);

resetOnWrongInput.addEventListener('change', async () => {
  settings = await saveSettings({ resetOnWrong: resetOnWrongInput.checked });
  flashSaved();
});

unlockDurationSelect.addEventListener('change', async () => {
  settings = await saveSettings({
    unlockDurationMinutes: Number.parseInt(unlockDurationSelect.value, 10),
  });
  flashSaved();
});

addSiteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  siteErrorEl.classList.add('hidden');
  const domain = normalizeDomain(siteInput.value);
  if (!domain) {
    siteErrorEl.textContent = 'Please enter a valid domain (e.g. x.com or reddit.com).';
    siteErrorEl.classList.remove('hidden');
    return;
  }
  if (settings.sites.includes(domain)) {
    siteErrorEl.textContent = `${domain} is already in your list.`;
    siteErrorEl.classList.remove('hidden');
    return;
  }

  settings = await saveSettings({
    sites: [...settings.sites, domain],
  });
  siteInput.value = '';
  renderSites();
  flashSaved();
});

resetSitesBtn.addEventListener('click', async () => {
  settings = await saveSettings({ sites: [...DEFAULT_SETTINGS.sites] });
  renderSites();
  flashSaved();
});

resetStatsBtn.addEventListener('click', async () => {
  const cleared = await resetStats();
  renderStats(cleared);
  flashSaved();
});

async function init() {
  const [loadedSettings, stats] = await Promise.all([getSettings(), getStats()]);
  settings = loadedSettings;

  problemCountInput.value = String(settings.problemCount);
  problemCountVal.textContent = String(settings.problemCount);
  difficultySelect.value = settings.difficulty;
  resetOnWrongInput.checked = Boolean(settings.resetOnWrong);
  unlockDurationSelect.value = String(settings.unlockDurationMinutes);

  updateSample();
  renderSites();
  renderStats(stats);
}

init();

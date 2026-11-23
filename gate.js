import { generateChallengeSet, isCorrectAnswer } from './shared/math.js';
import { getSettings, getStats } from './shared/storage.js';

const params = new URLSearchParams(window.location.search);
const targetUrl = params.get('target') || '';
const rule = params.get('rule') || '';
const reason = params.get('reason') || '';

const domainLabelEl = document.getElementById('domain-label');
const gateTitleEl = document.getElementById('gate-title');
const gateSubtitleEl = document.getElementById('gate-subtitle');
const bailBtn = document.getElementById('bail-btn');
const challengeCard = document.getElementById('challenge-card');
const progressLabelEl = document.getElementById('progress-label');
const difficultyBadgeEl = document.getElementById('difficulty-badge');
const progressFillEl = document.getElementById('progress-fill');
const equationTextEl = document.getElementById('equation-text');
const answerForm = document.getElementById('answer-form');
const answerInput = document.getElementById('answer-input');
const feedbackTextEl = document.getElementById('feedback-text');
const grantInfoEl = document.getElementById('grant-info');
const resetNoteEl = document.getElementById('reset-note');
const statsSummaryEl = document.getElementById('stats-summary');

let settings = null;
let problems = [];
let currentIndex = 0;
let isUnlocking = false;

function formatDisplayHost() {
  if (rule) return rule;
  try {
    return new URL(targetUrl).hostname;
  } catch {
    return 'this site';
  }
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function renderProblem() {
  const total = problems.length;
  const problem = problems[currentIndex];
  progressLabelEl.textContent = `Problem ${currentIndex + 1} of ${total}`;
  progressFillEl.style.width = `${(currentIndex / total) * 100}%`;
  equationTextEl.textContent = `${problem.expression} = ?`;
  answerInput.value = '';
  answerInput.focus();
}

function triggerShake() {
  challengeCard.classList.remove('shake');
  void challengeCard.offsetWidth;
  challengeCard.classList.add('shake');
}

function setFeedback(text, kind = '') {
  feedbackTextEl.textContent = text;
  feedbackTextEl.className = kind ? `feedback-text ${kind}` : 'feedback-text';
}

async function handleBailOut() {
  if (isUnlocking) return;
  bailBtn.disabled = true;
  await chrome.runtime.sendMessage({ type: 'BAIL_OUT' });
}

async function handleUnlock() {
  isUnlocking = true;
  progressFillEl.style.width = '100%';
  setFeedback('Unlocked. Redirecting…', 'success');
  answerInput.disabled = true;

  const response = await chrome.runtime.sendMessage({
    type: 'GRANT_ACCESS',
    rule: formatDisplayHost(),
    durationMinutes: settings.unlockDurationMinutes,
  });

  if (response?.ok && targetUrl) {
    window.location.replace(targetUrl);
  } else {
    isUnlocking = false;
    answerInput.disabled = false;
    setFeedback('Could not unlock this tab. Try reloading.', 'error');
  }
}

answerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (isUnlocking || !problems.length) return;

  const current = problems[currentIndex];
  const rawValue = answerInput.value;

  if (!rawValue.trim()) {
    answerInput.focus();
    return;
  }

  if (isCorrectAnswer(rawValue, current.answer)) {
    currentIndex += 1;
    if (currentIndex >= problems.length) {
      await handleUnlock();
      return;
    }
    setFeedback('Correct — keep going.', 'success');
    renderProblem();
  } else {
    triggerShake();
    if (settings.resetOnWrong && currentIndex > 0) {
      currentIndex = 0;
      problems = generateChallengeSet(settings.problemCount, settings.difficulty);
      setFeedback(`Wrong answer — streak reset to 1 of ${problems.length}.`, 'error');
      renderProblem();
    } else {
      setFeedback('Not quite — try again.', 'error');
      answerInput.select();
      answerInput.focus();
    }
  }
});

bailBtn.addEventListener('click', handleBailOut);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    handleBailOut();
  }
});

async function init() {
  const host = formatDisplayHost();
  document.title = `FrictionTrap — ${host}`;
  domainLabelEl.textContent = host;
  domainLabelEl.title = targetUrl || host;

  if (reason === 'expired') {
    gateTitleEl.textContent = `Time's up on ${host}`;
    gateSubtitleEl.textContent = 'Your session expired. Still worth going back in, or ready to close it?';
  } else if (reason === 'relocked') {
    gateTitleEl.textContent = `${host} is locked again`;
    gateSubtitleEl.textContent = 'Solve the challenge to re-enter, or head back to work.';
  } else {
    gateTitleEl.textContent = `Pause before opening ${host}`;
  }

  settings = await getSettings();
  const stats = await getStats();

  difficultyBadgeEl.textContent = capitalize(settings.difficulty);
  grantInfoEl.textContent =
    settings.unlockDurationMinutes > 0
      ? `Unlocks this tab for ${settings.unlockDurationMinutes} min`
      : 'Unlocks this tab until closed';
  resetNoteEl.textContent = settings.resetOnWrong
    ? 'Wrong answer resets streak'
    : 'Mistakes keep progress';

  const resisted = stats.turnedBackCount || 0;
  const entered = stats.unlockedCount || 0;
  statsSummaryEl.textContent = `Turned back ${resisted} ${resisted === 1 ? 'time' : 'times'} · Entered ${entered} ${entered === 1 ? 'time' : 'times'}`;

  problems = generateChallengeSet(settings.problemCount, settings.difficulty);
  currentIndex = 0;
  renderProblem();
}

init();

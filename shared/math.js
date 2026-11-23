/**
 * Arithmetic challenge generator for FrictionTrap.
 * Produces deterministic-answer integer math problems across three difficulties.
 */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(list) {
  return list[randInt(0, list.length - 1)];
}

/**
 * Generate a single addition/subtraction problem for the given difficulty.
 * @param {'easy' | 'medium' | 'hard'} difficulty
 * @returns {{ expression: string, answer: number }}
 */
export function generateMathProblem(difficulty = 'medium') {
  if (difficulty === 'easy') {
    const op = pick(['+', '-']);
    if (op === '+') {
      const a = randInt(12, 59);
      const b = randInt(11, 49);
      return { expression: `${a} + ${b}`, answer: a + b };
    }
    const a = randInt(35, 95);
    const b = randInt(12, a - 7);
    return { expression: `${a} − ${b}`, answer: a - b };
  }

  if (difficulty === 'hard') {
    const kind = pick(['add3', 'sub3', 'threeAddSub', 'threeSubAdd']);
    if (kind === 'add3') {
      const a = randInt(145, 589);
      const b = randInt(125, 489);
      return { expression: `${a} + ${b}`, answer: a + b };
    }
    if (kind === 'sub3') {
      const a = randInt(320, 895);
      const b = randInt(125, a - 45);
      return { expression: `${a} − ${b}`, answer: a - b };
    }
    if (kind === 'threeAddSub') {
      const a = randInt(115, 340);
      const b = randInt(85, 240);
      const c = randInt(45, Math.min(220, a + b - 20));
      return { expression: `${a} + ${b} − ${c}`, answer: a + b - c };
    }
    const a = randInt(240, 680);
    const b = randInt(110, Math.min(290, a - 30));
    const c = randInt(35, 145);
    return { expression: `${a} − ${b} + ${c}`, answer: a - b + c };
  }

  // Default: medium
  const kind = pick(['add', 'sub', 'three']);
  if (kind === 'add') {
    const a = randInt(48, 189);
    const b = randInt(37, 168);
    return { expression: `${a} + ${b}`, answer: a + b };
  }
  if (kind === 'sub') {
    const a = randInt(115, 265);
    const b = randInt(38, a - 19);
    return { expression: `${a} − ${b}`, answer: a - b };
  }
  const a = randInt(24, 78);
  const b = randInt(19, 64);
  const c = randInt(11, Math.min(45, a + b - 5));
  return { expression: `${a} + ${b} − ${c}`, answer: a + b - c };
}

/**
 * Generate a sequence of unique arithmetic problems.
 */
export function generateChallengeSet(count = 4, difficulty = 'medium') {
  const safeCount = Math.max(1, Math.min(10, Number(count) || 4));
  const seen = new Set();
  const problems = [];

  let attempts = 0;
  while (problems.length < safeCount && attempts < safeCount * 10) {
    attempts += 1;
    const problem = generateMathProblem(difficulty);
    if (!seen.has(problem.expression)) {
      seen.add(problem.expression);
      problems.push(problem);
    }
  }

  return problems;
}

/**
 * Parse and check a user's string answer against the expected integer.
 */
export function isCorrectAnswer(userInput, expectedAnswer) {
  if (typeof userInput !== 'string') return false;
  const trimmed = userInput.trim();
  if (!/^-?\d+$/.test(trimmed)) return false;
  return Number.parseInt(trimmed, 10) === expectedAnswer;
}

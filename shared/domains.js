/**
 * Domain normalization and matching utilities.
 * Pure ES module so it can be shared across extension pages and tested in Node.
 */

/**
 * Normalize user input (URL or hostname) into a clean lowercase domain.
 * Returns null if the input is invalid.
 *
 * Examples:
 *   "https://x.com/home"  -> "x.com"
 *   "www.twitter.com"     -> "twitter.com"
 *   "  Reddit.com/r/all " -> "reddit.com"
 */
export function normalizeDomain(input) {
  if (typeof input !== 'string') return null;
  let value = input.trim().toLowerCase();
  if (!value) return null;

  // Strip protocol if present, or prepend one to parse cleanly with URL
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let hostname;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }

  // Strip leading "www." so adding www.x.com matches x.com and all subdomains
  hostname = hostname.replace(/^www\./, '').replace(/\.+$/, '');

  // Basic hostname validation (must contain a dot or be localhost, valid label chars)
  if (!hostname || !hostname.includes('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(hostname)) return null;
  if (hostname.startsWith('.') || hostname.startsWith('-') || hostname.includes('..')) {
    return null;
  }

  return hostname;
}

/**
 * Extract the lowercase hostname from an http(s) URL, or null for non-web URLs.
 */
export function extractWebHostname(url) {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.hostname.toLowerCase().replace(/\.+$/, '');
  } catch {
    return null;
  }
}

/**
 * Check if a hostname matches a rule domain (exact match or subdomain).
 * Example: hostMatchesRule("mobile.x.com", "x.com") -> true
 *          hostMatchesRule("notx.com", "x.com")     -> false
 */
export function hostMatchesRule(hostname, rule) {
  if (!hostname || !rule) return false;
  const h = hostname.toLowerCase();
  const r = rule.toLowerCase();
  return h === r || h.endsWith(`.${r}`);
}

/**
 * Find the matching rule for a given URL from a list of normalized domain rules.
 * Returns the matched rule string, or null if not gated.
 */
export function findMatchingRule(url, rules) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const hostname = extractWebHostname(url);
  if (!hostname) return null;

  for (const rule of rules) {
    if (hostMatchesRule(hostname, rule)) {
      return rule;
    }
  }
  return null;
}

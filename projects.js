const API = "https://api.github.com";
const CACHE_KEY = "foresterre:blauwdruk:github-projects:v0";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1d

class RateLimited extends Error {
  constructor(resetAt) {
    super("GitHub Rate Limited");
    this.resetAt = resetAt;
  }
}

function nextPage(response) {
  const link = response.headers.get("link") ?? "";
  return link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (response.ok) {
    return { body: await response.json(), next: nextPage(response) };
  }
  if (response.status === 404) {
    return { body: null, next: null };
  }
  const limited = response.status === 429
    || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0");
  if (limited) {
    const reset = Number(response.headers.get("x-ratelimit-reset"));
    throw new RateLimited(Number.isFinite(reset) && reset > 0 ? new Date(reset * 1000) : null);
  }
  throw new Error(`GitHub HTTP ${response.status}`);
}

function summarize(repo) {
  return {
    stars: repo.stargazers_count,
    pushedAt: repo.pushed_at,
    language: repo.language,
    description: repo.description,
  };
}

async function fetchRepos(user, wanted) {
  const found = new Map();
  const missingFromUser = () => [...wanted].some((key) => key.startsWith(`${user}/`) && !found.has(key));

  let url = user ? `${API}/users/${encodeURIComponent(user)}/repos?per_page=100` : null;
  while (url && missingFromUser()) {
    const { body, next } = await getJson(url);
    for (const repo of body ?? []) {
      const key = repo.full_name.toLowerCase();
      if (wanted.has(key)) {
        found.set(key, summarize(repo));
      }
    }
    url = next;
  }

  const rest = [...wanted].filter((key) => !found.has(key));
  const fetched = await Promise.all(rest.map((key) => getJson(`${API}/repos/${key}`)));
  rest.forEach((key, i) => found.set(key, fetched[i].body ? summarize(fetched[i].body) : null));

  return found;
}

function readCache(wanted) {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
    if (fresh && [...wanted].every((key) => key in cached.repos)) {
      return { fetchedAt: new Date(cached.fetchedAt), repos: new Map(Object.entries(cached.repos)) };
    }
  } catch {
    console.warn("[blauwdruk] Unable to read cached content")
  }
  return null;
}

function writeCache(fetchedAt, repos) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: fetchedAt.getTime(), repos: Object.fromEntries(repos) }));
  } catch {
    console.warn("[blauwdruk] Unable to write cached content")
  }
}

const numberFormat = new Intl.NumberFormat("en");

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fill(card, repo) {
  card.querySelector('[data-field="stars"]').textContent = numberFormat.format(repo.stars);

  const updated = card.querySelector('[data-field="updated"]');
  if (repo.pushedAt) {
    updated.dateTime = repo.pushedAt;
    updated.textContent = repo.pushedAt.slice(0, 10);
  } else {
    updated.textContent = "Never";
  }

  card.querySelector('[data-field="language"]').textContent = repo.language ?? "None";

  const description = card.querySelector(".project-desc");
  if (!description.textContent.trim() && repo.description) {
    description.textContent = repo.description;
  }

  card.querySelector(".project-details").hidden = false;
}

function describeError(error) {
  if (error instanceof RateLimited) {
    const e = "Reached GitHub's rate limit. Wait";

    return error.resetAt
      ? `${e} until ${formatTime(error.resetAt)}.`
      : `${e} an hour or so.`;
  }

  return `Unable to load: ${error.message}.`;
}

async function main() {
  const page = document.querySelector(".projects-page");
  const cards = [...(page?.querySelectorAll(".project[data-repo]") ?? [])];
  if (cards.length === 0) {
    return;
  }

  const status = page.querySelector(".projects-status");
  const user = page.dataset.githubUser.toLowerCase();
  const keyOf = (card) => card.dataset.repo.toLowerCase();
  const wanted = new Set(cards.map(keyOf));

  let result = readCache(wanted);
  if (!result) {
    status.textContent = "Fetching repo details from GitHub...";
    try {
      result = { fetchedAt: new Date(), repos: await fetchRepos(user, wanted) };
      writeCache(result.fetchedAt, result.repos);
      status.textContent = "";
    } catch (error) {
      status.textContent = describeError(error);
      return;
    }
  }

  for (const card of cards) {
    const repo = result.repos.get(keyOf(card));
    if (repo) {
      fill(card, repo);
    }
  }
}

main();

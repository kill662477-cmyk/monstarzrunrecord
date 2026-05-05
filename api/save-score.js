const DEFAULT_PATH = 'data/scores.json';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function env() {
  return {
    token: process.env.GITHUB_TOKEN,
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    branch: process.env.GITHUB_BRANCH || 'main',
    path: process.env.SCORE_PATH || DEFAULT_PATH,
  };
}

function cleanName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[<>"'`]/g, '')
    .slice(0, 12);
}

function normalize(scores) {
  return (Array.isArray(scores) ? scores : [])
    .map((s) => ({
      name: cleanName(s.name) || '익명',
      score: Math.floor(Number(s.score) || 0),
      date: s.date || '',
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function mergeTop10(scores, entry) {
  const name = cleanName(entry.name);
  const score = Math.floor(Number(entry.score) || 0);
  if (!name || score <= 0) return { changed: false, scores: normalize(scores) };

  const current = normalize(scores);
  const existing = current.find((s) => s.name === name);

  if (existing && existing.score >= score) {
    return { changed: false, scores: current };
  }

  const withoutName = current.filter((s) => s.name !== name);
  const candidate = normalize([...withoutName, { name, score, date: new Date().toISOString() }]);

  const included = candidate.some((s) => s.name === name && s.score === score);
  return { changed: included, scores: candidate };
}

async function readGithubFile(cfg) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`;
  const gh = await fetch(url, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'monstarz-run-ranking',
    },
  });

  if (gh.status === 404) return { sha: null, scores: [] };
  if (!gh.ok) throw new Error(`GitHub read ${gh.status}`);

  const data = await gh.json();
  const text = Buffer.from(data.content || '', 'base64').toString('utf8');
  return { sha: data.sha, scores: JSON.parse(text || '[]') };
}

async function writeGithubFile(cfg, sha, scores) {
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  const body = {
    message: 'Update MONSTARZ RUN ranking',
    branch: cfg.branch,
    content: Buffer.from(JSON.stringify(scores, null, 2) + '\n', 'utf8').toString('base64'),
  };
  if (sha) body.sha = sha;

  const gh = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'monstarz-run-ranking',
    },
    body: JSON.stringify(body),
  });

  if (!gh.ok) throw new Error(`GitHub write ${gh.status}`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const cfg = env();
  if (!cfg.token || !cfg.owner || !cfg.repo) {
    return json(res, 500, { ok: false, error: 'Missing GitHub environment variables' });
  }

  let payload = req.body;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch { payload = {}; }
  }

  const entry = { name: payload?.name, score: payload?.score };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { sha, scores } = await readGithubFile(cfg);
      const merged = mergeTop10(scores, entry);
      if (!merged.changed) return json(res, 200, { ok: true, saved: false, scores: merged.scores });
      await writeGithubFile(cfg, sha, merged.scores);
      return json(res, 200, { ok: true, saved: true, scores: merged.scores });
    } catch (e) {
      if (attempt === 2) return json(res, 500, { ok: false, error: e.message || 'save failed' });
      await new Promise((r) => setTimeout(r, 250 + attempt * 250));
    }
  }
}

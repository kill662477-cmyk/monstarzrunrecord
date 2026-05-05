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

function normalize(scores) {
  return (Array.isArray(scores) ? scores : [])
    .map((s) => ({
      name: String(s.name || '익명').slice(0, 12),
      score: Math.floor(Number(s.score) || 0),
      date: s.date || '',
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const { token, owner, repo, branch, path } = env();
  if (!token || !owner || !repo) return json(res, 200, { ok: true, scores: [] });

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const gh = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'monstarz-run-ranking',
      },
    });

    if (gh.status === 404) return json(res, 200, { ok: true, scores: [] });
    if (!gh.ok) throw new Error(`GitHub ${gh.status}`);

    const data = await gh.json();
    const text = Buffer.from(data.content || '', 'base64').toString('utf8');
    const parsed = JSON.parse(text || '[]');
    return json(res, 200, { ok: true, scores: normalize(parsed) });
  } catch (e) {
    return json(res, 200, { ok: true, scores: [] });
  }
}

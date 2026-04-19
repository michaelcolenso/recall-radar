export function adminDashboard(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>RecallRadar Admin</title>
  <meta name="robots" content="noindex,nofollow"/>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">

<nav class="bg-slate-800 border-b border-slate-700 px-4 py-3">
  <div class="max-w-5xl mx-auto flex items-center justify-between">
    <div class="flex items-center gap-3">
      <a href="/" class="text-blue-400 hover:text-blue-300 text-sm">← Site</a>
      <span class="text-slate-500">/</span>
      <span class="font-semibold text-white">RecallRadar Admin</span>
    </div>
    <div class="flex items-center gap-2">
      <input
        id="token-input"
        type="password"
        placeholder="Admin token"
        class="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-blue-500"
      />
      <span id="token-status" class="text-xs text-slate-500"></span>
    </div>
  </div>
</nav>

<main class="max-w-5xl mx-auto px-4 py-8 space-y-8">

  <!-- Stats -->
  <section>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Database Stats</h2>
      <button id="refresh-btn" class="text-sm text-blue-400 hover:text-blue-300">Refresh</button>
    </div>
    <div id="stats-grid" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      ${['makes','models','vehicleYears','recalls','enrichment'].map(k => `
      <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <div id="stat-${k}" class="text-2xl font-bold text-white">—</div>
        <div class="text-xs text-slate-400 mt-1">${statLabel(k)}</div>
      </div>`).join('')}
    </div>
    <p id="stats-error" class="text-red-400 text-sm mt-2 hidden"></p>
  </section>

  <!-- Actions -->
  <section class="grid md:grid-cols-2 gap-6">

    <!-- Ingestion -->
    <div class="bg-slate-800 rounded-lg p-5 border border-slate-700">
      <h2 class="font-semibold mb-4">Trigger Ingestion</h2>
      <form id="ingest-form" class="space-y-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">Mode</label>
          <select name="mode" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
            <option value="backfill">backfill — full history 2015→present</option>
            <option value="delta">delta — only stale records</option>
            <option value="full">full — all popular makes (recent years)</option>
            <option value="single-make">single-make</option>
            <option value="makes-only">makes-only</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Target Make <span class="text-slate-500">(optional, for single-make)</span></label>
          <input name="targetMake" type="text" placeholder="e.g. Toyota" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">Year Start</label>
            <input name="yearStart" type="number" placeholder="2015" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">Year End</label>
            <input name="yearEnd" type="number" placeholder="2026" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
          </div>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Delta Threshold <span class="text-slate-500">(hours, for delta mode — default 144)</span></label>
          <input name="deltaThresholdHours" type="number" placeholder="144" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        </div>
        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white rounded px-4 py-2 text-sm font-medium transition-colors">
          Run Ingestion
        </button>
      </form>
      <div id="ingest-result" class="mt-3 hidden"></div>
    </div>

    <!-- Enrichment -->
    <div class="bg-slate-800 rounded-lg p-5 border border-slate-700">
      <h2 class="font-semibold mb-4">Trigger Enrichment</h2>
      <form id="enrich-form" class="space-y-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">Batch Size</label>
          <input name="batchSize" type="number" placeholder="50" value="50" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Target Make <span class="text-slate-500">(optional)</span></label>
          <input name="targetMake" type="text" placeholder="e.g. Ford" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Concurrency</label>
          <input name="concurrency" type="number" placeholder="3" value="3" class="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        </div>
        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded px-4 py-2 text-sm font-medium transition-colors">
          Run Enrichment
        </button>
      </form>
      <div id="enrich-result" class="mt-3 hidden"></div>
    </div>

  </section>

  <!-- Recent Runs -->
  <section>
    <h2 class="text-lg font-semibold mb-4">Recent Pipeline Runs</h2>
    <div class="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-700/50 text-slate-400 text-xs uppercase tracking-wide">
          <tr>
            <th class="px-4 py-3 text-left">Workflow ID</th>
            <th class="px-4 py-3 text-left">Type</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Started</th>
            <th class="px-4 py-3 text-left">Completed</th>
          </tr>
        </thead>
        <tbody id="runs-tbody">
          <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Loading…</td></tr>
        </tbody>
      </table>
    </div>
    <p id="runs-error" class="text-red-400 text-sm mt-2 hidden"></p>
  </section>

</main>

<script>
  const TOKEN_KEY = 'rr_admin_token';
  const tokenInput = document.getElementById('token-input');
  const tokenStatus = document.getElementById('token-status');

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function headers() {
    return { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' };
  }

  // Token persistence
  tokenInput.value = getToken();
  tokenInput.addEventListener('change', () => {
    localStorage.setItem(TOKEN_KEY, tokenInput.value.trim());
    tokenStatus.textContent = 'Saved';
    setTimeout(() => { tokenStatus.textContent = ''; }, 1500);
    loadAll();
  });

  // Stats
  async function loadStats() {
    const err = document.getElementById('stats-error');
    err.classList.add('hidden');
    try {
      const r = await fetch('/api/admin/stats', { headers: headers() });
      if (r.status === 401) { showStatsError('Unauthorized — check your token.'); return; }
      if (!r.ok) { showStatsError('Error ' + r.status); return; }
      const d = await r.json();
      document.getElementById('stat-makes').textContent = fmt(d.makes);
      document.getElementById('stat-models').textContent = fmt(d.models);
      document.getElementById('stat-vehicleYears').textContent = fmt(d.vehicleYears);
      document.getElementById('stat-recalls').textContent = fmt(d.recalls);
      document.getElementById('stat-enrichment').textContent = (d.enrichmentCoverage ?? 0) + '%';
    } catch (e) {
      showStatsError('Network error');
    }
  }

  function showStatsError(msg) {
    const err = document.getElementById('stats-error');
    err.textContent = msg;
    err.classList.remove('hidden');
  }

  // Recent runs
  async function loadRuns() {
    const tbody = document.getElementById('runs-tbody');
    const err = document.getElementById('runs-error');
    err.classList.add('hidden');
    try {
      const r = await fetch('/api/admin/status', { headers: headers() });
      if (r.status === 401) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-red-400">Unauthorized</td></tr>'; return; }
      if (!r.ok) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Error ' + r.status + '</td></tr>'; return; }
      const d = await r.json();
      const runs = d.recentRuns || [];
      if (!runs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">No runs yet</td></tr>';
        return;
      }
      tbody.innerHTML = runs.map(run => \`
        <tr class="border-t border-slate-700 hover:bg-slate-700/30">
          <td class="px-4 py-3 font-mono text-xs text-slate-300 truncate max-w-xs">\${escHtml(run.workflow_id || run.id || '—')}</td>
          <td class="px-4 py-3">\${typeBadge(run.type)}</td>
          <td class="px-4 py-3">\${statusBadge(run.status)}</td>
          <td class="px-4 py-3 text-slate-400 text-xs">\${fmtDate(run.started_at)}</td>
          <td class="px-4 py-3 text-slate-400 text-xs">\${run.completed_at ? fmtDate(run.completed_at) : '—'}</td>
        </tr>
      \`).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Network error</td></tr>';
    }
  }

  // Trigger ingestion
  document.getElementById('ingest-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { mode: fd.get('mode') };
    if (fd.get('targetMake')) body.targetMake = fd.get('targetMake');
    if (fd.get('yearStart')) body.yearStart = parseInt(fd.get('yearStart'));
    if (fd.get('yearEnd')) body.yearEnd = parseInt(fd.get('yearEnd'));
    if (fd.get('deltaThresholdHours')) body.deltaThresholdHours = parseInt(fd.get('deltaThresholdHours'));
    showResult('ingest', null, 'running');
    try {
      const r = await fetch('/api/admin/ingest', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      const d = await r.json();
      if (r.status === 401) { showResult('ingest', 'Unauthorized — check your token.', 'error'); return; }
      showResult('ingest', d, r.ok ? 'ok' : 'error');
      if (r.ok) loadRuns();
    } catch (e) {
      showResult('ingest', 'Network error', 'error');
    }
  });

  // Trigger enrichment
  document.getElementById('enrich-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    if (fd.get('batchSize')) body.batchSize = parseInt(fd.get('batchSize'));
    if (fd.get('targetMake')) body.targetMake = fd.get('targetMake');
    if (fd.get('concurrency')) body.concurrency = parseInt(fd.get('concurrency'));
    showResult('enrich', null, 'running');
    try {
      const r = await fetch('/api/admin/enrich', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      const d = await r.json();
      if (r.status === 401) { showResult('enrich', 'Unauthorized — check your token.', 'error'); return; }
      showResult('enrich', d, r.ok ? 'ok' : 'error');
      if (r.ok) loadRuns();
    } catch (e) {
      showResult('enrich', 'Network error', 'error');
    }
  });

  function showResult(prefix, data, state) {
    const el = document.getElementById(prefix + '-result');
    el.classList.remove('hidden');
    if (state === 'running') {
      el.innerHTML = '<p class="text-slate-400 text-sm">Starting…</p>';
    } else if (state === 'error') {
      const msg = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      el.innerHTML = '<p class="text-red-400 text-sm">' + escHtml(msg) + '</p>';
    } else {
      const wfId = data.workflowId || '';
      const type = prefix === 'ingest' ? 'ingest' : 'enrich';
      el.innerHTML = \`
        <div class="bg-slate-700/50 rounded p-3 text-xs space-y-1">
          <p class="text-emerald-400 font-medium">Workflow started</p>
          <p class="text-slate-300 font-mono break-all">\${escHtml(wfId)}</p>
          \${wfId ? \`<a href="/api/admin/\${type}/\${encodeURIComponent(wfId)}" target="_blank" class="text-blue-400 hover:text-blue-300 underline">Check status →</a>\` : ''}
        </div>
      \`;
    }
  }

  // Helpers
  function fmt(n) { return n == null ? '—' : Number(n).toLocaleString(); }
  function fmtDate(s) { if (!s) return '—'; try { return new Date(s).toLocaleString(); } catch { return s; } }
  function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function typeBadge(t) {
    const cls = t === 'ingestion' ? 'bg-blue-900 text-blue-300' : 'bg-emerald-900 text-emerald-300';
    return \`<span class="px-2 py-0.5 rounded text-xs font-medium \${cls}">\${escHtml(t || '—')}</span>\`;
  }

  function statusBadge(s) {
    const map = { started: 'bg-yellow-900 text-yellow-300', completed: 'bg-emerald-900 text-emerald-300', 'completed-with-errors': 'bg-orange-900 text-orange-300', failed: 'bg-red-900 text-red-300' };
    const cls = map[s] || 'bg-slate-700 text-slate-300';
    return \`<span class="px-2 py-0.5 rounded text-xs font-medium \${cls}">\${escHtml(s || '—')}</span>\`;
  }

  function statLabel(k) {
    return { makes:'Makes', models:'Models', vehicleYears:'Vehicle Years', recalls:'Recalls', enrichment:'Enriched' }[k] || k;
  }

  document.getElementById('refresh-btn').addEventListener('click', loadAll);

  function loadAll() { loadStats(); loadRuns(); }
  loadAll();
</script>
</body>
</html>`;
}

function statLabel(k: string): string {
  const labels: Record<string, string> = {
    makes: "Makes",
    models: "Models",
    vehicleYears: "Vehicle Years",
    recalls: "Recalls",
    enrichment: "Enriched",
  };
  return labels[k] ?? k;
}

// ══════════════════════════════════════════
// db.js — Supabase client + all DB operations
// Include in every page: <script src="db.js"></script>
// ══════════════════════════════════════════

const SUPA_URL = 'https://gsejqwqoreufotqeuzdf.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzZWpxd3FvcmV1Zm90cWV1emRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjkzOTcsImV4cCI6MjA5MTQwNTM5N30.HEUNqkCxdOIZDg04P4OZnOuw2QswajJPB4MDTpTjbwQ';

// ── HTTP helper ──
async function supa(method, path, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${method} ${path}: ${res.status} ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const DB = {

  // ── COMPETITIONS ──
  async getCompetitions() {
    return supa('GET', 'competitions?select=*&order=created_at.desc');
  },
  async createCompetition(data) {
    const rows = await supa('POST', 'competitions', data);
    return rows?.[0];
  },
  async updateCompetition(id, data) {
    return supa('PATCH', `competitions?id=eq.${id}`, data);
  },
  async deleteCompetition(id) {
    return supa('DELETE', `competitions?id=eq.${id}`);
  },

  // ── CATEGORIES ──
  async getCategories(competitionId) {
    return supa('GET', `categories?competition_id=eq.${competitionId}&select=*,competitors(*),matches(*)`);
  },
  async createCategory(data) {
    const rows = await supa('POST', 'categories', data);
    return rows?.[0];
  },
  async updateCategory(id, data) {
    return supa('PATCH', `categories?id=eq.${id}`, data);
  },
  async deleteCategory(id) {
    return supa('DELETE', `categories?id=eq.${id}`);
  },

  // ── COMPETITORS ──
  async getCompetitors(categoryId) {
    return supa('GET', `competitors?category_id=eq.${categoryId}&select=*&order=seed.asc`);
  },
  async upsertCompetitors(competitors) {
    // competitors = array of {category_id, name, club, seed}
    // Remove any fields not in schema
    const clean = competitors.map(c=>({
      category_id: c.category_id,
      name: c.name,
      club: c.club||'',
      seed: c.seed||null,
    }));
    return supa('POST', 'competitors', clean);
  },
  async updateCompetitor(id, data) {
    return supa('PATCH', `competitors?id=eq.${id}`, data);
  },
  async deleteCompetitor(id) {
    return supa('DELETE', `competitors?id=eq.${id}`);
  },

  // ── MATCHES ──
  async getMatches(categoryId) {
    return supa('GET', `matches?category_id=eq.${categoryId}&select=*&order=match_num.asc`);
  },
  async getMatchesByTatami(tatamiId) {
    return supa('GET', `matches?tatami_id=eq.${tatamiId}&status=in.(pending,suspended)&blue_id=not.is.null&white_id=not.is.null&select=*,blue:blue_id(*),white:white_id(*),category:category_id(name)&order=order_in_tatami.asc`);
  },
  async upsertMatches(matches) {
    // Use category_id+match_num as unique key for upsert
    return supa('POST', 'matches?on_conflict=category_id,match_num', matches);
  },
  async updateMatch(id, data) {
    return supa('PATCH', `matches?id=eq.${id}`, data);
  },
  async updateMatchesByCategory(categoryId, data) {
    return supa('PATCH', `matches?category_id=eq.${categoryId}`, data);
  },
  async saveBracket(categoryId, matches) {
    // Full bracket save: upsert all matches for a category
    const rows = matches.map(m => ({
      id: m.dbId || undefined,  // undefined = new, existing id = update
      category_id: categoryId,
      match_num: m.id,
      stage: m.stage,
      stage_type: m.type,
      tatami_id: m.tatamiId || null,
      blue_id: m.bC?.dbId || null,
      white_id: m.wC?.dbId || null,
      status: m.status,
      winner_id: m.winnerDbId || null,
      win_reason: m.winReason || null,
      score: m.sc,
      is_offline: false,
      order_in_tatami: m.orderInTatami || null,
      susp: m.susp || null,
    }));
    return supa('POST', 'matches?on_conflict=category_id,match_num', rows);
  },

  // ── REALTIME ──
  subscribeMatches(tatamiId, callback) {
    // WebSocket subscription via Supabase Realtime
    const ws = new WebSocket(`${SUPA_URL.replace('https','wss')}/realtime/v1/websocket?apikey=${SUPA_KEY}&vsn=1.0.0`);
    let joined = false;
    ws.onopen = () => {
      ws.send(JSON.stringify({
        topic: `realtime:public:matches:tatami_id=eq.${tatamiId}`,
        event: 'phx_join', payload: {}, ref: '1',
      }));
    };
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.event === 'phx_reply' && !joined) { joined = true; return; }
      if (msg.event === 'INSERT' || msg.event === 'UPDATE') {
        callback(msg.payload?.record);
      }
    };
    ws.onerror = err => console.warn('Realtime error:', err);
    return () => ws.close(); // returns unsubscribe fn
  },

  subscribeCompetitors(competitionId, callback) {
    const ws = new WebSocket(`${SUPA_URL.replace('https','wss')}/realtime/v1/websocket?apikey=${SUPA_KEY}&vsn=1.0.0`);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        topic: `realtime:public:competitors`,
        event: 'phx_join', payload: {}, ref: '1',
      }));
    };
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      if (msg.event === 'UPDATE' || msg.event === 'INSERT') callback(msg.payload?.record);
    };
    return () => ws.close();
  },
};

// ── Active competition helpers ──
// Pages set/get the active competition ID via localStorage
const DB_COMP_KEY = 'judo_active_comp';

function getActiveCompId() {
  return localStorage.getItem(DB_COMP_KEY);
}
function setActiveCompId(id) {
  localStorage.setItem(DB_COMP_KEY, id);
}

// ── Export ──
window.DB = DB;
window.getActiveCompId = getActiveCompId;
window.setActiveCompId = setActiveCompId;

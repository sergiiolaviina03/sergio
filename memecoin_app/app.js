/* MemeRadar — radar de memecoins en directo.
   Fuentes públicas (sin API key): DexScreener, GeckoTerminal, GoPlus Security, RugCheck.
   Nada de esto es asesoramiento financiero: las memecoins pueden ir a cero. */
'use strict';

// ───────────────────────── Config ─────────────────────────
const CHAINS = {
  solana:   { name: 'Solana',   short: 'SOL', color: '#9945ff', gt: 'solana',   gp: 'solana', fomo: 'solana',   buy: a => `https://jup.ag/swap/SOL-${a}` },
  ethereum: { name: 'Ethereum', short: 'ETH', color: '#8a9cff', gt: 'eth',      gp: '1',      fomo: 'ethereum', buy: a => `https://app.uniswap.org/swap?chain=mainnet&outputCurrency=${a}` },
  base:     { name: 'Base',     short: 'BASE',color: '#2f6bff', gt: 'base',     gp: '8453',   fomo: 'base',     buy: a => `https://app.uniswap.org/swap?chain=base&outputCurrency=${a}` },
  bsc:      { name: 'BNB',      short: 'BNB', color: '#f3ba2f', gt: 'bsc',      gp: '56',     fomo: 'bnb',      buy: a => `https://pancakeswap.finance/swap?outputCurrency=${a}` },
  arbitrum: { name: 'Arbitrum', short: 'ARB', color: '#28a0f0', gt: 'arbitrum', gp: '42161',  buy: a => `https://app.uniswap.org/swap?chain=arbitrum&outputCurrency=${a}` },
  sui:      { name: 'Sui',      short: 'SUI', color: '#4da2ff', gt: 'sui-network' },
  ton:      { name: 'TON',      short: 'TON', color: '#0098ea', gt: 'ton' },
  tron:     { name: 'Tron',     short: 'TRX', color: '#ff060a', gt: 'tron',     gp: 'tron' },
};
// Enlace directo a la memecoin en la app Fomo (formato fomo.family/tokens/{cadena}/{contrato})
const fomoUrl = p => { const s = CHAINS[p.chainId]?.fomo; return s ? `https://fomo.family/tokens/${s}/${encodeURIComponent(p.baseToken.address)}` : null; };
const GT2DS =Object.fromEntries(Object.entries(CHAINS).map(([k, v]) => [v.gt, k]));

// Palabras clave para descubrir memecoins en todas las cadenas (rotan en cada ciclo)
const KEYWORDS = ['pepe','doge','shib','inu','bonk','wif','cat','frog','elon','trump','moon','pump','meme','ai','dog',
  'baby','floki','wojak','chad','based','popcat','mog','brett','neiro','goat','pnut','fart','giga','sigma','toshi',
  'degen','apu','turbo','bome','michi','moodeng','hippo','penguin','monkey','ape','cope','bull','rocket','retard',
  'banana','kek','lol','gm','sol','sui','tron','based','grok','jeet','fwog','spx','mew','myro','ponke','wen','zerebro'];

const NOT_MEME = new Set(['USDC','USDT','DAI','WETH','ETH','SOL','WSOL','WBTC','BTC','CBBTC','WBNB','BNB','USDE','FDUSD',
  'PYUSD','USDS','TUSD','JITOSOL','MSOL','BSOL','STETH','WSTETH','JUP','RAY','ARB','OP','SUI','TON','TRX','USD1','EURC','LINK','UNI','AAVE']);
const GOOD_QUOTES = new Set(['SOL','WSOL','USDC','USDT','WETH','ETH','WBNB','BNB','SUI','TON','TRX','WTRX','USD1']);
const GOOD_DEX = new Set(['raydium','orca','meteora','pumpswap','pumpfun','uniswap','aerodrome','pancakeswap','sushiswap',
  'camelot','fluxbeam','cetus','turbos','stonfi','dedust','sunswap','launchlab','meteoradbc','bluefin','baseswap']);

const RISK = {
  conservador: { minLiq: 50000, minVol: 150000, minAgeH: 24, minMc: 500000, buyScore: 78, strong: 86, size: 0.02 },
  equilibrado: { minLiq: 20000, minVol: 50000,  minAgeH: 3,  minMc: 100000, buyScore: 70, strong: 82, size: 0.04 },
  degen:       { minLiq: 7000,  minVol: 15000,  minAgeH: 0.25, minMc: 25000, buyScore: 62, strong: 76, size: 0.07 },
};

// ───────────────────────── Estado ─────────────────────────
const LS = {
  get(k, d) { try { const v = localStorage.getItem('mr_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mr_' + k, JSON.stringify(v)); } catch {} },
};
const S = {
  tokens: new Map(),            // key "chain:addr" -> token
  deep: new Map(),              // key -> {status, checks, ms}
  tab: 'radar', chain: 'all', sort: 'score', query: '',
  settings: Object.assign({ risk: 'equilibrado', refresh: 20, notify: false, alertPct: 15, autopilot: false, autoUsd: 100, tp: 60, sl: 25 }, LS.get('settings', {})),
  watch: new Set(LS.get('watch', [])),
  wallet: LS.get('wallet', { cash: 10000, start: 10000, pos: [], hist: [] }),
  notified: new Set(), lastPrice: new Map(), log: LS.get('log', []),
  engineUs: 0, lastOk: 0, kwIdx: 0, gtIdx: 0, openKey: null,
};
const save = () => { LS.set('settings', S.settings); LS.set('watch', [...S.watch]); LS.set('wallet', S.wallet); LS.set('log', S.log.slice(0, 80)); };
const R = () => RISK[S.settings.risk];

// ───────────────────────── Utilidades ─────────────────────────
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = +v; return isFinite(n) ? n : 0; };
function fmtUsd(n, d) {
  n = num(n); const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(d ?? 0);
}
function fmtPrice(p) {
  p = num(p); if (!p) return '$0';
  if (p >= 1) return '$' + p.toLocaleString('en-US', { maximumFractionDigits: 4 });
  if (p >= 0.01) return '$' + p.toFixed(5);
  const s = p.toFixed(20); const m = s.match(/^0\.(0+)(\d{4})/);
  if (!m) return '$' + p.toPrecision(4);
  const z = m[1].length; const sub = String(z).split('').map(c => '₀₁₂₃₄₅₆₇₈₉'[c]).join('');
  return '$0.0' + sub + m[2];
}
const fmtPct = n => (n >= 0 ? '+' : '') + num(n).toFixed(Math.abs(n) >= 100 ? 0 : 1) + '%';
const cls = n => (num(n) >= 0 ? 'up' : 'down');
function age(ms) {
  if (!ms) return '?'; const m = (Date.now() - ms) / 60000;
  if (m < 60) return Math.max(1, m | 0) + 'm'; if (m < 1440) return (m / 60 | 0) + 'h';
  if (m < 43200) return (m / 1440 | 0) + 'd'; return (m / 43200 | 0) + 'mes';
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
function toast(msg) { const t = $('#toast'); t.innerHTML = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 3200); }
function logEvt(msg) { S.log.unshift(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + ' · ' + msg); S.log = S.log.slice(0, 80); }

// fetch con proxy de Netlify como respaldo (CORS) y timeout
async function getJSON(direct, proxy, ms = 9000) {
  const tries = [direct, proxy].filter(Boolean);
  let err;
  for (const u of tries) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    try {
      const r = await fetch(u, { signal: c.signal, headers: { accept: 'application/json' } });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('json')) throw new Error('no json');
      return await r.json();
    } catch (e) { clearTimeout(t); err = e; }
  }
  throw err;
}
const DS = p => getJSON('https://api.dexscreener.com/' + p, '/api/ds/' + p);
const GT = p => getJSON('https://api.geckoterminal.com/api/v2/' + p, '/api/gt/' + p);
const GP = p => getJSON('https://api.gopluslabs.io/api/v1/' + p, '/api/gp/' + p, 12000);
const RC = p => getJSON('https://api.rugcheck.xyz/v1/' + p, '/api/rc/' + p, 12000);

// limitador de concurrencia
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } }
  }));
  return out;
}

// ───────────────────────── Ingesta de datos ─────────────────────────
function ingestPair(p, src) {
  if (!p || !p.baseToken || !CHAINS[p.chainId]) return;
  const sym = String(p.baseToken.symbol || '').toUpperCase();
  if (NOT_MEME.has(sym)) return;
  if (!num(p.priceUsd)) return;
  const key = p.chainId + ':' + p.baseToken.address;
  const old = S.tokens.get(key);
  // nos quedamos con el par de mayor liquidez
  if (old && old.pair.pairAddress !== p.pairAddress && num(old.pair.liquidity?.usd) > num(p.liquidity?.usd)) {
    if (src) old.src.add(src); return;
  }
  const t = old || { key, src: new Set(), firstSeen: Date.now(), hist: [] };
  t.pair = p; if (src) t.src.add(src);
  const price = num(p.priceUsd);
  t.hist.push([Date.now(), price]); if (t.hist.length > 120) t.hist.shift();
  S.tokens.set(key, t);
}

async function fetchTokensBatch(chain, addrs) {
  for (let i = 0; i < addrs.length; i += 30) {
    const chunk = addrs.slice(i, i + 30);
    const pairs = await DS(`tokens/v1/${chain}/${chunk.join(',')}`).catch(() => null);
    if (Array.isArray(pairs)) pairs.forEach(p => ingestPair(p));
  }
}

async function addAddrList(list, src) {
  const byChain = {};
  for (const x of list) {
    if (!x || !CHAINS[x.chainId] || !x.tokenAddress) continue;
    (byChain[x.chainId] ||= new Set()).add(x.tokenAddress);
  }
  await Promise.all(Object.entries(byChain).map(([c, set]) => fetchTokensBatch(c, [...set]).then(() => {
    set.forEach(a => S.tokens.get(c + ':' + a)?.src.add(src));
  })));
}

async function discover() {
  const jobs = [];
  // 1) perfiles, boosts y community takeovers de DexScreener
  jobs.push(DS('token-profiles/latest/v1').then(l => addAddrList(l, 'nuevo')).catch(() => {}));
  jobs.push(DS('token-boosts/latest/v1').then(l => addAddrList(l, 'boost')).catch(() => {}));
  jobs.push(DS('token-boosts/top/v1').then(l => addAddrList(l, 'top')).catch(() => {}));
  jobs.push(DS('community-takeovers/latest/v1').then(l => addAddrList(l, 'cto')).catch(() => {}));
  // 2) búsqueda por palabras clave (rota 10 por ciclo)
  const kws = []; for (let i = 0; i < 10; i++) kws.push(KEYWORDS[(S.kwIdx + i) % KEYWORDS.length]); S.kwIdx += 10;
  jobs.push(pool(kws, 4, kw => DS('latest/dex/search?q=' + encodeURIComponent(kw)).then(r => (r.pairs || []).forEach(p => ingestPair(p, 'busqueda')))));
  // 3) pools en tendencia y nuevos de GeckoTerminal (rota cadenas para respetar límites)
  const nets = Object.values(CHAINS).map(c => c.gt);
  const gtJobs = [];
  for (let i = 0; i < 3; i++) {
    const net = nets[(S.gtIdx + i) % nets.length];
    gtJobs.push(['trending_pools', net], ['new_pools', net]);
  }
  S.gtIdx += 3;
  jobs.push(pool(gtJobs, 2, async ([kind, net]) => {
    const r = await GT(`networks/${net}/${kind}?page=1`);
    const list = (r.data || []).map(d => {
      const id = d.relationships?.base_token?.data?.id || ''; const addr = id.slice(id.indexOf('_') + 1);
      return { chainId: GT2DS[net], tokenAddress: addr };
    });
    await addAddrList(list, kind === 'new_pools' ? 'nuevo' : 'tendencia');
  }));
  await Promise.all(jobs);
}

// refresco de precios de lo que ya conocemos (prioriza favoritos, cartera y lo mejor puntuado)
async function refreshKnown() {
  const prio = new Set([...S.watch, ...S.wallet.pos.map(p => p.key)]);
  const all = [...S.tokens.values()].sort((a, b) => (prio.has(b.key) - prio.has(a.key)) || (num(b.a?.score) - num(a.a?.score)));
  const top = all.slice(0, 450);
  const byChain = {};
  top.forEach(t => (byChain[t.pair.chainId] ||= []).push(t.pair.baseToken.address));
  // tokens favoritos que aún no están cargados
  prio.forEach(k => { if (!S.tokens.has(k)) { const [c, a] = k.split(':'); (byChain[c] ||= []).push(a); } });
  await pool(Object.entries(byChain), 3, ([c, addrs]) => fetchTokensBatch(c, addrs));
}

// poda para mantener la app ágil
function prune() {
  if (S.tokens.size <= 1600) return;
  const keep = new Set([...S.watch, ...S.wallet.pos.map(p => p.key)]);
  const arr = [...S.tokens.values()].filter(t => !keep.has(t.key)).sort((a, b) => num(a.a?.score) - num(b.a?.score));
  arr.slice(0, S.tokens.size - 1400).forEach(t => S.tokens.delete(t.key));
}

// ───────────────────────── Motor: 22 pruebas en microsegundos ─────────────────────────
// Cada prueba: [id, nombre, peso, fn(p, ctx) -> {ok:true|false|null, v:'texto'}]
const CHECKS = [
  ['liq', 'Liquidez suficiente', 3, (p, c) => ({ ok: c.liq >= c.r.minLiq, v: fmtUsd(c.liq) })],
  ['liqmc', 'Liquidez/Market cap ≥ 3%', 3, (p, c) => ({ ok: c.mc ? c.liq / c.mc >= 0.03 : null, v: c.mc ? (c.liq / c.mc * 100).toFixed(1) + '%' : '—' })],
  ['fdv', 'Sin supply oculta (FDV≈MC)', 2, (p, c) => ({ ok: c.mc && c.fdv ? c.fdv / c.mc <= 1.5 : null, v: c.mc && c.fdv ? (c.fdv / c.mc).toFixed(2) + 'x' : '—' })],
  ['age', 'Edad del par mínima', 2, (p, c) => ({ ok: c.ageH >= c.r.minAgeH, v: age(p.pairCreatedAt) })],
  ['vol', 'Volumen 24h mínimo', 2, (p, c) => ({ ok: c.v24 >= c.r.minVol, v: fmtUsd(c.v24) })],
  ['wash', 'Sin wash-trading (Vol/Liq)', 3, (p, c) => { const x = c.liq ? c.v24 / c.liq : 0; return { ok: x > 0.2 && x < 40, v: x.toFixed(1) + 'x' }; }],
  ['bsr', 'Equilibrio compras/ventas 1h', 2, (p, c) => { const x = c.s1 ? c.b1 / c.s1 : (c.b1 ? 99 : 0); return { ok: x >= 0.6 && x <= 4, v: x.toFixed(2) }; }],
  ['sells', 'Se puede vender (hay ventas)', 5, (p, c) => ({ ok: c.b24 < 20 || c.s24 > c.b24 * 0.08, v: c.s24 + ' ventas' })],
  ['txn', 'Actividad real (txns 1h ≥ 40)', 2, (p, c) => ({ ok: c.b1 + c.s1 >= 40, v: (c.b1 + c.s1) + ' txns' })],
  ['whale', 'Sin dominio de ballenas', 2, (p, c) => { const n = c.b1 + c.s1; const avg = n ? c.v1 / n : 0; return { ok: n ? avg < Math.max(2500, c.liq * 0.01) : null, v: n ? fmtUsd(avg) + '/tx' : '—' }; }],
  ['crash', 'Sin desplome 24h (> −50%)', 3, (p, c) => ({ ok: c.c24 > -50, v: fmtPct(c.c24) })],
  ['para', 'No sobreextendido 1h (< +250%)', 2, (p, c) => ({ ok: c.c1 < 250, v: fmtPct(c.c1) })],
  ['dump5', 'Sin dump en curso (5m > −12%)', 3, (p, c) => ({ ok: c.c5 > -12, v: fmtPct(c.c5) })],
  ['soc', 'Redes sociales verificables', 2, (p, c) => ({ ok: c.socials > 0, v: c.socials + ' redes' })],
  ['web', 'Web oficial', 1, (p, c) => ({ ok: c.webs > 0, v: c.webs ? 'sí' : 'no' })],
  ['prof', 'Perfil e imagen en DexScreener', 1, (p, c) => ({ ok: !!p.info?.imageUrl, v: p.info?.imageUrl ? 'sí' : 'no' })],
  ['trend', 'Tendencia alineada (1h y 6h)', 2, (p, c) => ({ ok: c.c1 >= 0 && c.c6 >= 0, v: fmtPct(c.c1) + ' / ' + fmtPct(c.c6) })],
  ['quote', 'Emparejado con activo fuerte', 2, (p, c) => ({ ok: GOOD_QUOTES.has(String(p.quoteToken?.symbol).toUpperCase()), v: p.quoteToken?.symbol || '—' })],
  ['dex', 'DEX reconocido', 1, (p, c) => ({ ok: GOOD_DEX.has(String(p.dexId).toLowerCase()), v: p.dexId })],
  ['mc', 'Market cap mínimo', 2, (p, c) => ({ ok: c.mc >= c.r.minMc, v: fmtUsd(c.mc) })],
  ['accel', 'Volumen acelerando', 1, (p, c) => ({ ok: c.accel >= 1.2, v: c.accel.toFixed(1) + 'x' })],
  ['boost', 'Hype no solo pagado', 1, (p, c) => { const b = num(p.boosts?.active); return { ok: b < 500 || c.b1 + c.s1 > 150, v: b ? b + ' boosts' : 'orgánico' }; }],
];

function ctxOf(p) {
  const tx = p.txns || {}, vol = p.volume || {}, ch = p.priceChange || {};
  const v24 = num(vol.h24), v1 = num(vol.h1), v6 = num(vol.h6);
  return {
    r: R(), liq: num(p.liquidity?.usd), mc: num(p.marketCap || p.fdv), fdv: num(p.fdv),
    ageH: p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 3.6e6 : 0,
    v24, v1, v6, b1: num(tx.h1?.buys), s1: num(tx.h1?.sells), b24: num(tx.h24?.buys), s24: num(tx.h24?.sells),
    b5: num(tx.m5?.buys), s5: num(tx.m5?.sells),
    c5: num(ch.m5), c1: num(ch.h1), c6: num(ch.h6), c24: num(ch.h24),
    socials: (p.info?.socials || []).length, webs: (p.info?.websites || []).length,
    accel: v24 ? (v1 * 24) / v24 : 0,
  };
}

function analyze(t) {
  const p = t.pair, c = ctxOf(p);
  const checks = CHECKS.map(([id, name, w, fn]) => { const r = fn(p, c); return { id, name, w, ok: r.ok, v: r.v }; });
  const deep = S.deep.get(t.key);
  if (deep?.checks) checks.push(...deep.checks);
  let wOk = 0, wAll = 0, hard = false;
  for (const k of checks) { if (k.ok === null) continue; wAll += k.w; if (k.ok) wOk += k.w; else if (k.hard || k.id === 'sells' || (k.id === 'liq' && c.liq < 3000)) hard = true; }
  const safety = wAll ? (wOk / wAll) * 100 : 0;
  // momentum: presión compradora + aceleración + tendencia suave (penaliza extremos)
  const bp = (c.b1 + c.s1) ? c.b1 / (c.b1 + c.s1) : 0.5;
  const trendF = x => Math.max(-1, Math.min(1, x / 60));
  let mom = 50 + (bp - 0.5) * 70 + Math.min(20, (c.accel - 1) * 12) + trendF(c.c1) * 12 + trendF(c.c6) * 10 + trendF(c.c5 * 3) * 6;
  if (c.c1 > 150) mom -= 15;
  mom = Math.max(0, Math.min(100, mom));
  let score = Math.round(safety * 0.6 + mom * 0.4);
  if (hard) score = Math.min(score, 35);
  const r = c.r;
  const verdict = hard ? ['EVITAR', 'd'] : score >= r.strong ? ['COMPRA FUERTE', 'a'] : score >= r.buyScore ? ['COMPRA', 'b'] : score >= 50 ? ['VIGILAR', 'c'] : ['EVITAR', 'd'];
  const reasons = [];
  if (bp > 0.58) reasons.push(`Presión compradora ${(bp * 100) | 0}%`);
  if (c.accel >= 1.5) reasons.push(`Volumen acelerando ×${c.accel.toFixed(1)}`);
  if (c.mc && c.liq / c.mc > 0.08) reasons.push(`Liquidez sólida ${(c.liq / c.mc * 100).toFixed(0)}% del MC`);
  if (c.c1 > 5 && c.c6 > 0) reasons.push(`Tendencia alcista ${fmtPct(c.c1)} 1h`);
  if (deep?.status === 'ok' && deep.checks.every(k => k.ok !== false)) reasons.push('Contrato limpio on-chain');
  if (t.src.has('cto')) reasons.push('Community takeover');
  if (t.src.has('tendencia')) reasons.push('En tendencia');
  if (c.socials >= 2) reasons.push('Comunidad activa');
  const passed = checks.filter(k => k.ok === true).length, known = checks.filter(k => k.ok !== null).length;
  return { checks, safety, mom, score, verdict, reasons, passed, known, c };
}

function runEngine() {
  const t0 = performance.now(); let n = 0;
  for (const t of S.tokens.values()) { t.a = analyze(t); n++; }
  const dt = performance.now() - t0;
  S.engineUs = n ? (dt * 1000) / n : 0; S.engineN = n; S.engineMs = dt;
}

// ───────────────────────── Pruebas profundas on-chain ─────────────────────────
const yes = v => v === '1' || v === 1 || v === true;
async function deepScan(t) {
  const key = t.key; if (S.deep.has(key)) return S.deep.get(key);
  const p = t.pair, ch = CHAINS[p.chainId], addr = p.baseToken.address;
  const d = { status: 'loading', checks: [] }; S.deep.set(key, d);
  const t0 = performance.now();
  const add = (id, name, ok, v, w = 3, hard = false) => d.checks.push({ id, name, ok, v, w, hard: hard && ok === false, deep: true });
  try {
    if (p.chainId === 'solana') {
      const [gp, rc] = await Promise.all([
        GP(`solana/token_security?contract_addresses=${addr}`).catch(() => null),
        RC(`tokens/${addr}/report/summary`).catch(() => null),
      ]);
      const g = gp?.result?.[addr] || gp?.result?.[addr.toLowerCase()] || (gp?.result && Object.values(gp.result)[0]);
      if (g) {
        add('mint', 'Mint authority revocada', !yes(g.mintable?.status), yes(g.mintable?.status) ? 'puede imprimir' : 'revocada', 4, true);
        add('freeze', 'Sin freeze authority', !yes(g.freezable?.status), yes(g.freezable?.status) ? 'puede congelar' : 'no', 4, true);
        add('balmut', 'Saldos no modificables', !yes(g.balance_mutable_authority?.status), yes(g.balance_mutable_authority?.status) ? 'modificables' : 'ok', 4, true);
        add('close', 'Cuentas no cerrables por dev', !yes(g.closable?.status), yes(g.closable?.status) ? 'cerrable' : 'ok', 2);
        const fee = g.transfer_fee && Object.keys(g.transfer_fee).length ? num(g.transfer_fee.fee_rate) : 0;
        add('tfee', 'Sin comisión de transferencia', fee <= 0.05, fee ? fee + '%' : '0%', 3);
        const top10 = (g.holders || []).slice(0, 10).reduce((s, h) => s + num(h.percent), 0) * (num(g.holders?.[0]?.percent) <= 1 ? 100 : 1);
        if (g.holders?.length) add('top10', 'Top 10 holders < 35%', top10 < 35, top10.toFixed(1) + '%', 3);
      }
      if (rc) {
        const danger = (rc.risks || []).filter(r => r.level === 'danger');
        add('rc', 'RugCheck sin riesgos graves', danger.length === 0, danger.length ? danger.map(r => r.name).slice(0, 2).join(', ') : 'limpio', 4, danger.length > 1);
        if (rc.lpLockedPct != null) add('lp', 'Liquidez bloqueada/quemada ≥ 50%', num(rc.lpLockedPct) >= 50, num(rc.lpLockedPct).toFixed(0) + '%', 3);
      }
      if (!g && !rc) throw new Error('sin datos');
    } else if (ch?.gp) {
      const path = ch.gp === 'tron' ? `token_security/tron?contract_addresses=${addr}` : `token_security/${ch.gp}?contract_addresses=${addr}`;
      const gp = await GP(path);
      const g = gp?.result?.[addr.toLowerCase()] || gp?.result?.[addr] || (gp?.result && Object.values(gp.result)[0]);
      if (!g) throw new Error('sin datos');
      add('hp', 'No es honeypot', !yes(g.is_honeypot), yes(g.is_honeypot) ? 'HONEYPOT' : 'ok', 6, true);
      add('cansell', 'Se puede vender todo', !yes(g.cannot_sell_all), yes(g.cannot_sell_all) ? 'bloqueado' : 'ok', 4, true);
      const bt = num(g.buy_tax) * 100, st = num(g.sell_tax) * 100;
      add('tax', 'Impuestos ≤ 10%', bt <= 10 && st <= 10, `${bt.toFixed(0)}% / ${st.toFixed(0)}%`, 4, st > 30);
      add('open', 'Contrato verificado', yes(g.is_open_source), yes(g.is_open_source) ? 'sí' : 'no', 3, !yes(g.is_open_source));
      add('mintE', 'No se puede imprimir más', !yes(g.is_mintable), yes(g.is_mintable) ? 'mintable' : 'no', 3);
      add('proxy', 'Sin proxy actualizable', !yes(g.is_proxy), yes(g.is_proxy) ? 'proxy' : 'no', 2);
      add('own', 'Sin dueño oculto / recuperable', !yes(g.hidden_owner) && !yes(g.can_take_back_ownership), yes(g.hidden_owner) ? 'oculto' : yes(g.can_take_back_ownership) ? 'recuperable' : 'ok', 3);
      add('pause', 'Transferencias no pausables', !yes(g.transfer_pausable), yes(g.transfer_pausable) ? 'pausable' : 'no', 3);
      add('bl', 'Sin lista negra', !yes(g.is_blacklisted), yes(g.is_blacklisted) ? 'sí' : 'no', 2);
      add('slip', 'Impuestos no modificables', !yes(g.slippage_modifiable), yes(g.slippage_modifiable) ? 'modificables' : 'fijos', 3);
      const lpLocked = (g.lp_holders || []).filter(h => yes(h.is_locked) || /^0x0{30,}|dead$/i.test(h.address || '')).reduce((s, h) => s + num(h.percent), 0) * 100;
      if (g.lp_holders) add('lpE', 'Liquidez bloqueada/quemada ≥ 50%', lpLocked >= 50, lpLocked.toFixed(0) + '%', 3);
      const top10 = (g.holders || []).filter(h => !yes(h.is_contract) && !yes(h.is_locked)).slice(0, 10).reduce((s, h) => s + num(h.percent), 0) * 100;
      if (g.holders) add('top10', 'Top 10 holders < 35%', top10 < 35, top10.toFixed(1) + '%', 3);
      add('creator', 'Creador con < 5%', num(g.creator_percent) * 100 < 5, (num(g.creator_percent) * 100).toFixed(1) + '%', 2);
      if (g.holder_count) add('holders', 'Holders ≥ 300', num(g.holder_count) >= 300, num(g.holder_count).toLocaleString('es-ES'), 2);
    } else throw new Error('cadena sin escáner');
    d.status = 'ok';
  } catch (e) { d.status = d.checks.length ? 'ok' : 'na'; }
  d.ms = performance.now() - t0;
  t.a = analyze(t);
  return d;
}

// escaneo profundo automático de las mejores señales
let deepBusy = false;
async function autoDeep() {
  if (deepBusy) return; deepBusy = true;
  try {
    const cand = [...S.tokens.values()].filter(t => t.a && t.a.verdict[1] <= 'b' && !S.deep.has(t.key)).sort((a, b) => b.a.score - a.a.score).slice(0, 8);
    await pool(cand, 2, deepScan);
    if (cand.length) { runEngine(); render(); }
  } finally { deepBusy = false; }
}

// ───────────────────────── Alertas y piloto automático ─────────────────────────
function notify(title, body) {
  toast(`<b>${esc(title)}</b> ${esc(body)}`);
  if (S.settings.notify && 'Notification' in window && Notification.permission === 'granted') {
    try { navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon: 'icon.svg', badge: 'icon.svg' })).catch(() => new Notification(title, { body })); } catch {}
  }
}
function alerts() {
  const r = R();
  for (const t of S.tokens.values()) {
    if (!t.a) continue;
    const sym = t.pair.baseToken.symbol;
    if (t.a.score >= r.strong && t.a.verdict[1] === 'a' && !S.notified.has('s' + t.key) && S.deep.get(t.key)?.status === 'ok') {
      S.notified.add('s' + t.key); notify('⚡ Señal fuerte: $' + sym, `Score ${t.a.score} · ${t.a.reasons.slice(0, 2).join(' · ')}`);
      logEvt(`Señal fuerte $${sym} (score ${t.a.score})`);
    }
    if (S.watch.has(t.key)) {
      const p = num(t.pair.priceUsd), last = S.lastPrice.get(t.key);
      if (!last) S.lastPrice.set(t.key, p);
      else if (Math.abs(p / last - 1) * 100 >= S.settings.alertPct) {
        notify(`${p > last ? '🚀' : '🔻'} $${sym} ${fmtPct((p / last - 1) * 100)}`, `Precio ${fmtPrice(p)}`);
        S.lastPrice.set(t.key, p);
      }
    }
  }
}
function paperBuy(t, usd, auto) {
  const w = S.wallet; usd = Math.min(usd, w.cash);
  if (usd < 1) { toast('Saldo simulado insuficiente'); return; }
  const price = num(t.pair.priceUsd);
  w.cash -= usd;
  w.pos.push({ id: Date.now() + Math.random(), key: t.key, sym: t.pair.baseToken.symbol, img: t.pair.info?.imageUrl, entry: price, qty: usd / price, usd, ts: Date.now(), auto: !!auto, peak: price });
  logEvt(`${auto ? '🤖 ' : ''}Compra simulada $${t.pair.baseToken.symbol} ${fmtUsd(usd, 0)} a ${fmtPrice(price)}`);
  save(); if (!auto) toast(`Comprado (simulado) ${fmtUsd(usd)} de $${esc(t.pair.baseToken.symbol)}`);
}
function paperSell(id, why) {
  const w = S.wallet; const i = w.pos.findIndex(p => p.id === id); if (i < 0) return;
  const p = w.pos[i]; const t = S.tokens.get(p.key); const price = t ? num(t.pair.priceUsd) : p.entry;
  const val = p.qty * price; w.cash += val; w.pos.splice(i, 1);
  w.hist.unshift({ sym: p.sym, pnl: val - p.usd, pct: (price / p.entry - 1) * 100, ts: Date.now() }); w.hist = w.hist.slice(0, 50);
  logEvt(`${why ? '🤖 ' + why + ' · ' : ''}Venta $${p.sym} ${fmtPct((price / p.entry - 1) * 100)} (${fmtUsd(val - p.usd, 2)})`);
  save();
}
function autopilot() {
  if (!S.settings.autopilot) return;
  const w = S.wallet, st = S.settings;
  // gestionar posiciones automáticas: TP, SL y trailing stop
  for (const p of [...w.pos]) {
    if (!p.auto) continue; const t = S.tokens.get(p.key); if (!t) continue;
    const price = num(t.pair.priceUsd); p.peak = Math.max(p.peak || p.entry, price);
    const chg = (price / p.entry - 1) * 100, fromPeak = (price / p.peak - 1) * 100;
    if (chg >= st.tp) paperSell(p.id, 'Take profit');
    else if (chg <= -st.sl) paperSell(p.id, 'Stop loss');
    else if (chg > 20 && fromPeak < -15) paperSell(p.id, 'Trailing stop');
    else if (t.a?.verdict[1] === 'd') paperSell(p.id, 'Riesgo detectado');
  }
  // abrir nuevas: solo señales fuertes con escaneo profundo limpio
  const held = new Set(w.pos.map(p => p.key));
  const picks = [...S.tokens.values()].filter(t => t.a?.verdict[1] === 'a' && !held.has(t.key) && S.deep.get(t.key)?.status === 'ok')
    .sort((a, b) => b.a.score - a.a.score).slice(0, 2);
  for (const t of picks) if (w.pos.filter(p => p.auto).length < 10 && w.cash >= st.autoUsd) paperBuy(t, st.autoUsd, true);
}

// ───────────────────────── Render ─────────────────────────
function sparkSVG(t, w = 56, h = 26) {
  const p = t.pair, ch = p.priceChange || {}, now = num(p.priceUsd);
  const at = c => now / (1 + num(c) / 100);
  let pts = [at(ch.h24), at(ch.h6), at(ch.h1), at(ch.m5), now];
  const live = t.hist.filter(x => Date.now() - x[0] < 300000).map(x => x[1]);
  if (live.length > 2) pts = pts.slice(0, 3).concat(live);
  const mn = Math.min(...pts), mx = Math.max(...pts), rg = mx - mn || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1) * w).toFixed(1)},${(h - 2 - (v - mn) / rg * (h - 4)).toFixed(1)}`).join(' ');
  const col = now >= pts[0] ? 'var(--up)' : 'var(--down)';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}"><polyline points="${d}" fill="none" stroke="${col}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
function avatar(p) {
  const ch = CHAINS[p.chainId]; const sym = esc((p.baseToken.symbol || '?').slice(0, 3));
  const img = p.info?.imageUrl ? `<img loading="lazy" src="${esc(p.info.imageUrl)}" onerror="this.remove()" alt="">` : '';
  return `<div class="av">${sym}${img}<span class="ch" style="background:${ch.color}">${ch.short[0]}</span></div>`;
}
function rowHTML(t) {
  const p = t.pair, a = t.a, c24 = num(p.priceChange?.h24), c1 = num(p.priceChange?.h1);
  const isNew = p.pairCreatedAt && Date.now() - p.pairCreatedAt < 6 * 3.6e6;
  const prev = S.lastRow?.get(t.key), now = num(p.priceUsd);
  const fl = prev && prev !== now ? (now > prev ? ' flash-up' : ' flash-down') : '';
  return `<div class="row${fl}" data-k="${esc(t.key)}">${avatar(p)}
    <div class="meta"><div class="t"><em>${esc(p.baseToken.symbol)}</em>${isNew ? '<span class="new-badge">NEW</span>' : ''}${S.watch.has(t.key) ? '<span class="warn">★</span>' : ''}<span class="score s-${a.verdict[1]}">${a.score}</span></div>
    <div class="s"><span>${fmtUsd(p.marketCap || p.fdv)}</span><span>${age(p.pairCreatedAt)}</span><span>Vol ${fmtUsd(p.volume?.h24)}</span></div></div>
    ${sparkSVG(t)}
    <div class="right"><div class="p mono">${fmtPrice(p.priceUsd)}</div><span class="pill ${cls(c24)} ${cls(c24)}">${fmtPct(c24)}</span></div></div>`;
}
function filtered() {
  let arr = [...S.tokens.values()].filter(t => t.a);
  if (S.chain !== 'all') arr = arr.filter(t => t.pair.chainId === S.chain);
  return arr;
}
const SORTS = {
  score: ['Score', (a, b) => b.a.score - a.a.score],
  hot: ['🔥 Calientes', (a, b) => num(b.pair.volume?.h1) - num(a.pair.volume?.h1)],
  gain: ['Subidas 1h', (a, b) => num(b.pair.priceChange?.h1) - num(a.pair.priceChange?.h1)],
  gain24: ['Subidas 24h', (a, b) => num(b.pair.priceChange?.h24) - num(a.pair.priceChange?.h24)],
  new: ['Nuevas', (a, b) => num(b.pair.pairCreatedAt) - num(a.pair.pairCreatedAt)],
  mc: ['Market cap', (a, b) => num(b.pair.marketCap) - num(a.pair.marketCap)],
  safe: ['Más seguras', (a, b) => b.a.safety - a.a.safety],
};

function viewRadar() {
  const arr = filtered();
  if (!arr.length) return '<div class="sec"><h2>Radar</h2><small>escaneando…</small></div>' + '<div class="skel"></div>'.repeat(8);
  arr.sort(SORTS[S.sort][1]);
  const sig = arr.filter(t => t.a.verdict[1] <= 'b').length;
  const avgUs = S.engineUs < 1 ? S.engineUs.toFixed(2) : S.engineUs.toFixed(1);
  const sorts = Object.entries(SORTS).map(([k, [n]]) => `<button data-sort="${k}" class="${S.sort === k ? 'on' : ''}">${n}</button>`).join('');
  return `<div class="stats"><div class="stat"><b>${arr.length.toLocaleString('es-ES')}</b><span>memecoins</span></div>
    <div class="stat"><b class="up">${sig}</b><span>señales compra</span></div>
    <div class="stat"><b class="mono">${avgUs}µs</b><span>${CHECKS.length} pruebas</span></div></div>
    <div class="sec"><h2>Radar</h2><small>actualiza cada ${S.settings.refresh}s</small></div>
    <div class="sorts">${sorts}</div>
    <div class="list">${arr.slice(0, 150).map(rowHTML).join('')}</div>`;
}
function sigCard(t) {
  const p = t.pair, a = t.a, r = R(), d = S.deep.get(t.key);
  const pct = (r.size * (a.score / 100) * 100).toFixed(1);
  const price = num(p.priceUsd);
  const deepTxt = !d ? '<span class="mut">escaneo on-chain en cola</span>' : d.status === 'loading' ? '<span class="mut">escaneando contrato…</span>'
    : d.status === 'ok' ? `<span class="up">✓ ${d.checks.filter(k => k.ok).length}/${d.checks.length} on-chain</span>` : '<span class="mut">sin escáner on-chain</span>';
  return `<div class="sig" data-k="${esc(t.key)}"><div class="hd">${avatar(p)}
    <div class="meta"><div class="t"><em>$${esc(p.baseToken.symbol)}</em></div><div class="s"><span>${fmtUsd(p.marketCap || p.fdv)}</span><span class="${cls(p.priceChange?.h1)}">${fmtPct(num(p.priceChange?.h1))} 1h</span><span>${CHAINS[p.chainId].name}</span></div></div>
    <div class="verdict"><span class="score s-${a.verdict[1]}">${a.score}</span><b class="${a.verdict[1] === 'a' ? 'up' : ''}">${a.verdict[0]}</b></div></div>
    <div class="reasons">${a.reasons.slice(0, 5).map(x => `<span>${esc(x)}</span>`).join('')}<span>${a.passed}/${a.known} pruebas</span><span>${deepTxt}</span></div>
    <div class="plan"><div>Entrada<b class="mono">${fmtPrice(price)}</b></div><div>Tamaño<b>${pct}%</b></div><div>TP<b class="up">${fmtPrice(price * (1 + S.settings.tp / 100))}</b></div><div>SL<b class="down">${fmtPrice(price * (1 - S.settings.sl / 100))}</b></div></div>
    ${fomoUrl(p) ? `<a class="btn buy fomo-btn" data-ext="1" href="${esc(fomoUrl(p))}" target="_blank" rel="noopener">Comprar $${esc(p.baseToken.symbol)} en Fomo ↗</a>` : ''}</div>`;
}
function viewSignals() {
  const arr = filtered().filter(t => t.a.verdict[1] <= 'b').sort((a, b) => b.a.score - a.a.score);
  const watch = filtered().filter(t => t.a.verdict[1] === 'c').sort((a, b) => b.a.score - a.a.score).slice(0, 20);
  return `<div class="sec"><h2>Señales</h2><small>perfil ${S.settings.risk}</small></div>
    <div class="banner"><b>${arr.length} recomendaciones</b> ahora mismo. Cada token pasa ${CHECKS.length} pruebas locales en microsegundos y, las mejores, hasta 15 pruebas on-chain (GoPlus + RugCheck). Esto no garantiza nada: usa SL y no inviertas lo que no puedas perder.</div>
    ${arr.length ? arr.slice(0, 60).map(sigCard).join('') : '<div class="empty">Ninguna memecoin supera el filtro ahora mismo.<br>Prueba el perfil “degen” en ajustes o espera al siguiente escaneo.</div>'}
    ${watch.length ? `<div class="sec"><h2>En vigilancia</h2><small>cerca del umbral</small></div><div class="list">${watch.map(rowHTML).join('')}</div>` : ''}`;
}
function searchResults() {
  const q = S.query.trim().toLowerCase();
  if (!q) return '<div class="empty">Busca cualquier memecoin de cualquier cadena.<br>Pega un contrato para analizarlo al instante.</div>';
  const res = filtered().filter(t => t.pair.baseToken.symbol.toLowerCase().includes(q) || String(t.pair.baseToken.name).toLowerCase().includes(q) || t.pair.baseToken.address.toLowerCase() === q).sort((a, b) => b.a.score - a.a.score);
  return res.length ? res.slice(0, 100).map(rowHTML).join('') : '<div class="empty">Buscando en todas las DEX del mundo…</div>';
}
function viewSearch() {
  return `<div class="searchbar"><input id="q" placeholder="Símbolo, nombre o dirección del contrato" value="${esc(S.query)}" autocomplete="off" autocapitalize="off"></div>
    <div class="list" id="sres">${searchResults()}</div>`;
}
function viewWatch() {
  const arr = [...S.watch].map(k => S.tokens.get(k)).filter(t => t?.a);
  return `<div class="sec"><h2>Favoritos</h2><small>alerta ±${S.settings.alertPct}%</small></div>
    ${arr.length ? `<div class="list">${arr.map(rowHTML).join('')}</div>` : `<div class="empty">${S.watch.size ? 'Cargando favoritos…' : 'Pulsa ★ en cualquier token para seguirlo y recibir alertas de precio.'}</div>`}`;
}
function walletValue() {
  return S.wallet.pos.reduce((s, p) => { const t = S.tokens.get(p.key); return s + p.qty * (t ? num(t.pair.priceUsd) : p.entry); }, 0);
}
function viewWallet() {
  const w = S.wallet, st = S.settings, inv = walletValue(), tot = w.cash + inv, pnl = tot - w.start;
  const realized = w.hist.reduce((s, h) => s + h.pnl, 0), wins = w.hist.filter(h => h.pnl > 0).length;
  const pos = w.pos.map(p => {
    const t = S.tokens.get(p.key), price = t ? num(t.pair.priceUsd) : p.entry, chg = (price / p.entry - 1) * 100;
    return `<div class="row pos" data-k="${esc(p.key)}">${t ? avatar(t.pair) : '<div class="av">?</div>'}
      <div class="meta"><div class="t"><em>$${esc(p.sym)}</em>${p.auto ? '<span class="mut">🤖</span>' : ''}</div><div class="s"><span>${fmtUsd(p.usd)} → ${fmtUsd(p.qty * price, 2)}</span><span>${age(p.ts)}</span></div></div>
      <div class="right"><span class="pill ${cls(chg)} ${cls(chg)}">${fmtPct(chg)}</span></div>
      <button class="btn sell sm" data-sell="${p.id}">Vender</button></div>`;
  }).join('');
  return `<div class="bal"><span>Cartera simulada</span><b>$${tot.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b><span class="${cls(pnl)}">${fmtPct(pnl / w.start * 100)} (${fmtUsd(pnl, 2)})</span> · <span class="mut">efectivo ${fmtUsd(w.cash, 2)}</span></div>
    <div class="stats"><div class="stat"><b>${w.pos.length}</b><span>posiciones</span></div><div class="stat"><b class="${cls(realized)}">${fmtUsd(realized, 0)}</b><span>realizado</span></div><div class="stat"><b>${w.hist.length ? Math.round(wins / w.hist.length * 100) : 0}%</b><span>acierto</span></div></div>
    <div class="toggle"><div>🤖 Piloto automático<div class="mut" style="font-size:12px">Compra señales fuertes verificadas · TP ${st.tp}% · SL ${st.sl}% · trailing</div></div><button class="sw ${st.autopilot ? 'on' : ''}" data-set="autopilot"></button></div>
    <div class="sec"><h2>Posiciones</h2><small>practica sin arriesgar</small></div>
    ${pos ? `<div class="list">${pos}</div>` : '<div class="empty">Sin posiciones. Abre un token y pulsa “Simular”, o activa el piloto automático.</div>'}
    <div class="sec"><h2>Actividad</h2><button class="mut" data-reset="1" style="font-size:12px">reiniciar cartera</button></div>
    <div class="log">${S.log.length ? S.log.map(esc).join('<br>') : 'Sin actividad'}</div>`;
}
function viewSettings() {
  const st = S.settings;
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, n]) => `<button data-seg="${k}" data-v="${v}" class="${String(st[k]) === String(v) ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  return `<div class="sec"><h2>Ajustes</h2><button class="mut" data-tab-go="radar">cerrar</button></div>
    <div class="field"><label>Perfil de riesgo (cambia los umbrales de las pruebas)</label>${seg('risk', [['conservador', 'Conservador'], ['equilibrado', 'Equilibrado'], ['degen', 'Degen']])}</div>
    <div class="field"><label>Frecuencia de actualización</label>${seg('refresh', [[10, '10s'], [20, '20s'], [45, '45s'], [90, '90s']])}</div>
    <div class="field"><label>Alerta de favoritos al moverse</label>${seg('alertPct', [[5, '±5%'], [10, '±10%'], [15, '±15%'], [30, '±30%']])}</div>
    <div class="field"><label>Take profit / Stop loss sugeridos</label>${seg('tp', [[30, 'TP 30%'], [60, 'TP 60%'], [100, 'TP 100%'], [200, 'TP 200%']])}<div style="height:6px"></div>${seg('sl', [[10, 'SL 10%'], [20, 'SL 20%'], [25, 'SL 25%'], [40, 'SL 40%']])}</div>
    <div class="field"><label>Importe por operación del piloto (simulado)</label>${seg('autoUsd', [[50, '$50'], [100, '$100'], [250, '$250'], [500, '$500']])}</div>
    <div class="toggle"><div>🔔 Notificaciones push</div><button class="sw ${st.notify ? 'on' : ''}" data-set="notify"></button></div>
    <div class="disc">MemeRadar usa datos públicos en directo de DexScreener, GeckoTerminal, GoPlus Security y RugCheck. Las ${CHECKS.length} pruebas locales se ejecutan en tu móvil en microsegundos; las pruebas on-chain dependen de la red. Nada aquí es asesoramiento financiero. Las memecoins son extremadamente volátiles y la mayoría pierde casi todo su valor. La cartera y el piloto automático son simulados: las compras reales se hacen en el DEX enlazado con tu propia wallet.</div>`;
}

function render() {
  const v = $('#view'), y = window.scrollY;
  const q = document.activeElement?.id === 'q';
  if (S.tab === 'search' && q && $('#sres')) { // no destruir el input mientras se escribe
    $('#sres').innerHTML = searchResults();
  } else {
    v.innerHTML = ({ radar: viewRadar, signals: viewSignals, search: viewSearch, watch: viewWatch, wallet: viewWallet, settings: viewSettings })[S.tab]();
    window.scrollTo(0, y);
  }
  S.lastRow = new Map([...S.tokens.values()].map(t => [t.key, num(t.pair.priceUsd)]));
  renderChrome();
  if (S.openKey) renderSheet(false);
}
function renderChrome() {
  const chains = ['all', ...Object.keys(CHAINS)];
  const counts = {}; for (const t of S.tokens.values()) counts[t.pair.chainId] = (counts[t.pair.chainId] || 0) + 1;
  $('#chainChips').innerHTML = chains.filter(c => c === 'all' || counts[c]).map(c => `<button class="chip ${S.chain === c ? 'on' : ''}" data-chain="${c}">${c === 'all' ? 'Todas' : CHAINS[c].name} <span style="opacity:.6">${c === 'all' ? S.tokens.size : counts[c]}</span></button>`).join('');
  const sig = [...S.tokens.values()].filter(t => t.a?.verdict[1] === 'a').length;
  $('#tabbar').querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === S.tab);
    if (b.dataset.tab === 'signals') b.querySelector('i').innerHTML = '⚡' + (sig ? `<span class="badge">${sig}</span>` : '');
  });
  const top = [...S.tokens.values()].filter(t => t.a).sort((a, b) => num(b.pair.volume?.h1) - num(a.pair.volume?.h1)).slice(0, 25);
  const rail = top.map(t => `<span>$${esc(t.pair.baseToken.symbol)} <b class="${cls(t.pair.priceChange?.h1)}">${fmtPct(num(t.pair.priceChange?.h1))}</b></span>`).join('');
  const tk = $('#ticker'); if (rail && tk.dataset.n !== String(S.tokens.size)) { tk.innerHTML = `<div class="rail">${rail}</div>`; tk.dataset.n = S.tokens.size; }
}

// ───────────────────────── Ficha del token ─────────────────────────
function ring(score, k) {
  const col = { a: 'var(--up)', b: 'var(--up)', c: 'var(--warn)', d: 'var(--down)' }[k];
  const C = 2 * Math.PI * 36;
  return `<svg class="ring" viewBox="0 0 84 84"><circle cx="42" cy="42" r="36" stroke="#1d1d21" stroke-width="7" fill="none"/>
    <circle cx="42" cy="42" r="36" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - score / 100)}" transform="rotate(-90 42 42)"/>
    <text x="42" y="49" text-anchor="middle" fill="#fff" font-size="22" font-weight="800" font-family="Inter">${score}</text></svg>`;
}
function openToken(key) {
  const t = S.tokens.get(key); if (!t) return;
  S.openKey = key; t.a = analyze(t);
  renderSheet(true);
  $('#sheet').classList.add('on'); $('#sheetBg').classList.add('on'); document.body.style.overflow = 'hidden';
  const t0 = performance.now(); for (let i = 0; i < 500; i++) analyze(t); t._us = (performance.now() - t0) * 1000 / 500; // media de 500 ejecuciones
  deepScan(t).then(() => { if (S.openKey === key) renderSheet(false); });
  history.pushState({ sheet: 1 }, '');
}
function closeSheet() {
  S.openKey = null; $('#sheet').classList.remove('on'); $('#sheetBg').classList.remove('on'); document.body.style.overflow = '';
  const cta = document.querySelector('.cta'); cta && cta.remove();
}
function renderSheet(full) {
  const t = S.tokens.get(S.openKey); if (!t) return;
  const p = t.pair, a = t.a, ch = CHAINS[p.chainId], d = S.deep.get(t.key), c = a.c;
  const sh = $('#sheet');
  const ckRow = k => `<div class="ck"><i class="${k.ok === null ? 'na' : k.ok ? 'ok' : k.hard ? 'ko' : 'wa'}">${k.ok === null ? '–' : k.ok ? '✓' : '✕'}</i><span class="n">${esc(k.name)}</span><span class="v">${esc(k.v)}</span></div>`;
  const local = a.checks.filter(k => !k.deep), deep = a.checks.filter(k => k.deep);
  const links = [...(fomoUrl(p) ? [['Fomo', fomoUrl(p)]] : []), ...(p.info?.websites || []).map(w => [w.label || 'Web', w.url]), ...(p.info?.socials || []).map(s => [s.type, s.url]), ['DexScreener', p.url]];
  const buyUrl = ch.buy ? ch.buy(p.baseToken.address) : p.url;
  const usTxt = t._us ? (t._us < 1 ? t._us.toFixed(2) : t._us.toFixed(1)) + ' µs' : '';
  const partA = `
    <div class="sh-top">${avatar(p)}<div class="meta"><div class="t"><em>${esc(p.baseToken.name)}</em></div><div class="s"><span>$${esc(p.baseToken.symbol)}</span><span>${ch.name}</span><span>${esc(p.dexId)}</span><span>${age(p.pairCreatedAt)}</span></div></div>
      <button class="icon-btn" data-star="${esc(t.key)}">${S.watch.has(t.key) ? '★' : '☆'}</button><button class="icon-btn x" data-close="1">✕</button></div>
    <div class="bigp mono" id="shPrice">${fmtPrice(p.priceUsd)}</div>
    <div class="chgrow">${[['5m', 'm5'], ['1h', 'h1'], ['6h', 'h6'], ['24h', 'h24']].map(([n, k]) => `<span>${n} <b class="${cls(p.priceChange?.[k])}">${fmtPct(num(p.priceChange?.[k]))}</b></span>`).join('')}</div>
`;
  const partB = `
    <div class="kv"><div><span>Market cap</span><b>${fmtUsd(c.mc)}</b></div><div><span>Liquidez</span><b>${fmtUsd(c.liq)}</b></div><div><span>Vol 24h</span><b>${fmtUsd(c.v24)}</b></div>
      <div><span>Compras 1h</span><b class="up">${c.b1}</b></div><div><span>Ventas 1h</span><b class="down">${c.s1}</b></div><div><span>FDV</span><b>${fmtUsd(c.fdv)}</b></div></div>
    <div class="scorebox">${ring(a.score, a.verdict[1])}<div><h3 class="${a.verdict[1] <= 'b' ? 'up' : a.verdict[1] === 'c' ? 'warn' : 'down'}">${a.verdict[0]}</h3>
      <p>Seguridad ${a.safety.toFixed(0)} · Momentum ${a.mom.toFixed(0)} · ${a.passed}/${a.known} pruebas superadas</p><p>${esc(a.reasons.slice(0, 3).join(' · ') || 'Sin catalizadores claros')}</p></div></div>
    <div class="checks"><div class="hdr"><span>⚡ ${local.length} pruebas instantáneas</span><span class="mut mono">${usTxt}</span></div>${local.map(ckRow).join('')}</div>
    <div class="checks"><div class="hdr"><span>🛡 Pruebas on-chain</span><span class="mut">${!d || d.status === 'loading' ? 'escaneando…' : d.status === 'ok' ? (d.ms | 0) + ' ms · GoPlus' + (p.chainId === 'solana' ? ' + RugCheck' : '') : 'no disponible'}</span></div>
      ${deep.length ? deep.map(ckRow).join('') : `<div class="ck"><span class="n mut">${!d || d.status === 'loading' ? 'Analizando contrato, holders y liquidez…' : 'El escáner no tiene datos de este token/cadena.'}</span></div>`}</div>
    <div class="quick">${[25, 100, 250, 1000].map(v => `<button data-paper="${v}">Simular $${v}</button>`).join('')}</div>
    <div class="links">${links.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)} ↗</a>`).join('')}</div>
    <div class="addr mono" data-copy="${esc(p.baseToken.address)}">${esc(p.baseToken.address)} ⧉</div>
    <div class="disc">Puntuación orientativa generada automáticamente con datos públicos. No es asesoramiento financiero. Comprueba siempre el contrato y usa stop loss.</div>`;
  if (full) {
    sh.innerHTML = `<div class="grab"></div><div id="shA">${partA}</div><div class="chart" id="chart"></div><div id="shB">${partB}</div>`;
    $('#chart').innerHTML = `<iframe src="https://dexscreener.com/${p.chainId}/${p.pairAddress}?embed=1&theme=dark&trades=0&info=0&chartLeftToolbar=0&chartTheme=dark&interval=5" loading="lazy"></iframe>`;
    document.querySelector('.cta')?.remove();
    const dexName = ch.buy ? (p.chainId === 'solana' ? 'Jupiter' : p.chainId === 'bsc' ? 'PancakeSwap' : 'Uniswap') : 'DEX';
    const fu = fomoUrl(p);
    document.body.insertAdjacentHTML('beforeend', fu
      ? `<div class="cta"><a class="btn buy" href="${esc(fu)}" target="_blank" rel="noopener">Comprar en Fomo</a><a class="btn ghost sm2" href="${esc(buyUrl)}" target="_blank" rel="noopener" title="${dexName}">DEX</a><button class="btn ghost sm2" data-paper="100">Sim</button></div>`
      : `<div class="cta"><a class="btn buy" href="${esc(buyUrl)}" target="_blank" rel="noopener">Comprar en ${dexName}</a><button class="btn ghost" data-paper="100" style="flex:.55">Simular</button></div>`);
  } else {
    // actualización parcial: el gráfico (iframe) no se recarga
    $('#shA').innerHTML = partA; $('#shB').innerHTML = partB;
  }
}

// ───────────────────────── Búsqueda remota ─────────────────────────
let searchT;
function remoteSearch(q) {
  clearTimeout(searchT);
  searchT = setTimeout(async () => {
    if (q.length < 2) return;
    try {
      const r = await DS('latest/dex/search?q=' + encodeURIComponent(q));
      (r.pairs || []).forEach(p => ingestPair(p, 'busqueda'));
      runEngine(); if (S.tab === 'search') render();
    } catch {}
  }, 350);
}

// ───────────────────────── Eventos ─────────────────────────
document.addEventListener('click', e => {
  if (e.target.closest('[data-ext]')) return; // enlaces externos (Fomo) se abren sin abrir la ficha
  const el = e.target.closest('[data-tab],[data-chain],[data-sort],[data-k],[data-close],[data-star],[data-paper],[data-sell],[data-set],[data-seg],[data-copy],[data-tab-go],[data-reset]');
  if (!el) { if (e.target.id === 'btnSettings') { S.tab = 'settings'; render(); } return; }
  const ds = el.dataset;
  if (ds.sell) { e.stopPropagation(); paperSell(+ds.sell); render(); return; }
  if (ds.tab || ds.tabGo) { S.tab = ds.tab || ds.tabGo; window.scrollTo(0, 0); render(); if (S.tab === 'search') setTimeout(() => $('#q')?.focus(), 50); return; }
  if (ds.chain) { S.chain = ds.chain; render(); return; }
  if (ds.sort) { S.sort = ds.sort; render(); return; }
  if (ds.close) { history.back(); return; }
  if (ds.star) { S.watch.has(ds.star) ? S.watch.delete(ds.star) : S.watch.add(ds.star); save(); renderSheet(false); return; }
  if (ds.paper) { const t = S.tokens.get(S.openKey); if (t) { paperBuy(t, +ds.paper); } return; }
  if (ds.copy) { navigator.clipboard?.writeText(ds.copy).then(() => toast('Contrato copiado')); return; }
  if (ds.reset) { if (confirm('¿Reiniciar la cartera simulada a $10.000?')) { S.wallet = { cash: 10000, start: 10000, pos: [], hist: [] }; S.log = []; save(); render(); } return; }
  if (ds.set) {
    const k = ds.set; S.settings[k] = !S.settings[k];
    if (k === 'notify' && S.settings.notify && 'Notification' in window) Notification.requestPermission().then(p => { if (p !== 'granted') { S.settings.notify = false; save(); render(); toast('Permiso de notificaciones denegado'); } });
    if (k === 'autopilot' && S.settings.autopilot) toast('🤖 Piloto automático activado (simulado)');
    save(); render(); return;
  }
  if (ds.seg) { const v = ds.v; S.settings[ds.seg] = isNaN(+v) ? v : +v; save(); if (ds.seg === 'risk') runEngine(); if (ds.seg === 'refresh') schedule(); render(); return; }
  if (ds.k) openToken(ds.k);
});
document.addEventListener('input', e => { if (e.target.id === 'q') { S.query = e.target.value; render(); remoteSearch(S.query.trim()); } });
$('#sheetBg').addEventListener('click', () => history.back());
window.addEventListener('popstate', () => { if (S.openKey) closeSheet(); });
// deslizar hacia abajo para cerrar la ficha
(() => { let y0 = null; const sh = $('#sheet');
  sh.addEventListener('touchstart', e => { y0 = sh.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sh.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 110) history.back(); y0 = null; }, { passive: true });
})();

// ───────────────────────── Bucle en directo ─────────────────────────
let tickN = 0, timer;
function setLive(state, txt) { const l = $('#live'); l.className = 'live ' + state; $('#liveTxt').textContent = txt; }
async function tick() {
  try {
    if (tickN % 3 === 0) await discover(); else await refreshKnown();
    tickN++;
    prune(); runEngine(); alerts(); autopilot(); save();
    S.lastOk = Date.now();
    setLive(S.tokens.size ? 'on' : 'err', S.tokens.size ? `EN DIRECTO · ${S.tokens.size.toLocaleString('es-ES')}` : 'sin datos');
    render();
    autoDeep();
  } catch (e) { setLive('err', 'reconectando…'); }
}
function schedule() { clearInterval(timer); timer = setInterval(() => { if (!document.hidden) tick(); }, S.settings.refresh * 1000); }
document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - S.lastOk > S.settings.refresh * 1000) tick(); });

render();
(async () => {
  setLive('', 'escaneando el mundo…');
  // primera carga: descubrimiento doble para arrancar con cientos de tokens
  await discover(); runEngine(); render(); setLive(S.tokens.size ? 'on' : 'err', S.tokens.size ? `EN DIRECTO · ${S.tokens.size}` : 'sin conexión, reintentando…');
  await discover(); runEngine(); render();
  tickN = 1; S.lastOk = Date.now(); schedule(); autoDeep();
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});

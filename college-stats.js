// ══════════════════════════════════════════════════════════════════
// college-stats.js — College Career Stats (2025-2026 Draft Class)
// Source: Sports-Reference.com CFB, manually curated.
// Usage: window.COLLEGE_STATS[sleeper_player_id] = { school, years, stats: [...] }
// Each stats entry: { year, gp, ...position-specific stats }
// Update each draft season with new prospect class.
// ══════════════════════════════════════════════════════════════════

window.COLLEGE_STATS = {

  // ══ QB ══════════════════════════════════════════════════════════

  // Shedeur Sanders — Colorado
  "11621": { school: "Colorado", conf: "Big 12", years: "2022-2024", pos: "QB", stats: [
    { year: "2022", team: "Jackson St", gp: 12, pass_cmp: 271, pass_att: 383, pass_yd: 3083, pass_td: 32, pass_int: 6, rush_yd: 100, rush_td: 4 },
    { year: "2023", team: "Colorado", gp: 12, pass_cmp: 299, pass_att: 444, pass_yd: 3230, pass_td: 27, pass_int: 3, rush_yd: -65, rush_td: 2 },
    { year: "2024", team: "Colorado", gp: 13, pass_cmp: 348, pass_att: 497, pass_yd: 4134, pass_td: 37, pass_int: 10, rush_yd: -25, rush_td: 3 },
  ]},

  // Cam Ward — Miami
  "11620": { school: "Miami (FL)", conf: "ACC", years: "2021-2024", pos: "QB", stats: [
    { year: "2021", team: "Incarnate Word", gp: 10, pass_cmp: 249, pass_att: 390, pass_yd: 4648, pass_td: 47, pass_int: 10, rush_yd: 291, rush_td: 6 },
    { year: "2022", team: "Incarnate Word", gp: 6, pass_cmp: 157, pass_att: 229, pass_yd: 2260, pass_td: 23, pass_int: 5, rush_yd: 199, rush_td: 4 },
    { year: "2023", team: "Washington St", gp: 13, pass_cmp: 290, pass_att: 443, pass_yd: 3735, pass_td: 25, pass_int: 8, rush_yd: 165, rush_td: 4 },
    { year: "2024", team: "Miami (FL)", gp: 13, pass_cmp: 329, pass_att: 483, pass_yd: 4313, pass_td: 39, pass_int: 7, rush_yd: 206, rush_td: 4 },
  ]},

  // Jalen Milroe — Alabama
  "11622": { school: "Alabama", conf: "SEC", years: "2022-2024", pos: "QB", stats: [
    { year: "2022", team: "Alabama", gp: 5, pass_cmp: 16, pass_att: 28, pass_yd: 192, pass_td: 1, pass_int: 2, rush_yd: 69, rush_td: 2 },
    { year: "2023", team: "Alabama", gp: 14, pass_cmp: 214, pass_att: 338, pass_yd: 2834, pass_td: 23, pass_int: 6, rush_yd: 531, rush_td: 12 },
    { year: "2024", team: "Alabama", gp: 12, pass_cmp: 212, pass_att: 340, pass_yd: 2844, pass_td: 16, pass_int: 11, rush_yd: 718, rush_td: 20 },
  ]},

  // ══ RB ══════════════════════════════════════════════════════════

  // Ashton Jeanty — Boise State
  "11623": { school: "Boise State", conf: "MWC", years: "2022-2024", pos: "RB", stats: [
    { year: "2022", team: "Boise State", gp: 13, rush_att: 141, rush_yd: 821, rush_td: 7, rec: 20, rec_yd: 166, rec_td: 3, gp_start: 1 },
    { year: "2023", team: "Boise State", gp: 14, rush_att: 220, rush_yd: 1347, rush_td: 14, rec: 28, rec_yd: 300, rec_td: 2, gp_start: 14 },
    { year: "2024", team: "Boise State", gp: 15, rush_att: 374, rush_yd: 2601, rush_td: 29, rec: 20, rec_yd: 116, rec_td: 0, gp_start: 15 },
  ]},

  // Omarion Hampton — North Carolina
  "11624": { school: "North Carolina", conf: "ACC", years: "2022-2024", pos: "RB", stats: [
    { year: "2022", team: "North Carolina", gp: 12, rush_att: 169, rush_yd: 1001, rush_td: 5, rec: 15, rec_yd: 196, rec_td: 1 },
    { year: "2023", team: "North Carolina", gp: 12, rush_att: 249, rush_yd: 1504, rush_td: 15, rec: 33, rec_yd: 254, rec_td: 2 },
    { year: "2024", team: "North Carolina", gp: 12, rush_att: 257, rush_yd: 1660, rush_td: 15, rec: 22, rec_yd: 180, rec_td: 1 },
  ]},

  // Kaleb Johnson — Iowa
  "11625": { school: "Iowa", conf: "Big Ten", years: "2022-2024", pos: "RB", stats: [
    { year: "2022", team: "Iowa", gp: 13, rush_att: 133, rush_yd: 762, rush_td: 4, rec: 12, rec_yd: 154, rec_td: 1 },
    { year: "2023", team: "Iowa", gp: 13, rush_att: 127, rush_yd: 653, rush_td: 3, rec: 18, rec_yd: 184, rec_td: 2 },
    { year: "2024", team: "Iowa", gp: 13, rush_att: 258, rush_yd: 1537, rush_td: 21, rec: 16, rec_yd: 139, rec_td: 1 },
  ]},

  // ══ WR ══════════════════════════════════════════════════════════

  // Travis Hunter — Colorado (WR/CB two-way)
  "11626": { school: "Colorado", conf: "Big 12", years: "2022-2024", pos: "WR", stats: [
    { year: "2022", team: "Jackson St", gp: 8, rec: 17, rec_yd: 152, rec_td: 1, rec_tgt: 25 },
    { year: "2023", team: "Colorado", gp: 12, rec: 57, rec_yd: 721, rec_td: 5, rec_tgt: 82 },
    { year: "2024", team: "Colorado", gp: 13, rec: 92, rec_yd: 1152, rec_td: 14, rec_tgt: 127, rush_yd: 32 },
  ]},

  // Tetairoa McMillan — Arizona
  "11627": { school: "Arizona", conf: "Big 12", years: "2022-2024", pos: "WR", stats: [
    { year: "2022", team: "Arizona", gp: 12, rec: 39, rec_yd: 714, rec_td: 8, rec_tgt: 63 },
    { year: "2023", team: "Arizona", gp: 12, rec: 90, rec_yd: 1402, rec_td: 10, rec_tgt: 139 },
    { year: "2024", team: "Arizona", gp: 11, rec: 84, rec_yd: 1319, rec_td: 8, rec_tgt: 130 },
  ]},

  // Luther Burden III — Missouri
  "11628": { school: "Missouri", conf: "SEC", years: "2022-2024", pos: "WR", stats: [
    { year: "2022", team: "Missouri", gp: 13, rec: 45, rec_yd: 604, rec_td: 6, rec_tgt: 68, rush_yd: 27 },
    { year: "2023", team: "Missouri", gp: 13, rec: 86, rec_yd: 1212, rec_td: 9, rec_tgt: 121, rush_yd: 67 },
    { year: "2024", team: "Missouri", gp: 12, rec: 61, rec_yd: 676, rec_td: 6, rec_tgt: 92, rush_yd: 10 },
  ]},

  // Emeka Egbuka — Ohio State
  "11629": { school: "Ohio State", conf: "Big Ten", years: "2021-2024", pos: "WR", stats: [
    { year: "2021", team: "Ohio State", gp: 10, rec: 9, rec_yd: 191, rec_td: 1, rec_tgt: 12 },
    { year: "2022", team: "Ohio State", gp: 13, rec: 74, rec_yd: 1039, rec_td: 10, rec_tgt: 104 },
    { year: "2023", team: "Ohio State", gp: 12, rec: 41, rec_yd: 515, rec_td: 4, rec_tgt: 56 },
    { year: "2024", team: "Ohio State", gp: 16, rec: 69, rec_yd: 894, rec_td: 10, rec_tgt: 96 },
  ]},

  // Isaiah Bond — Texas
  "11630": { school: "Texas", conf: "SEC", years: "2022-2024", pos: "WR", stats: [
    { year: "2022", team: "Alabama", gp: 13, rec: 24, rec_yd: 376, rec_td: 3, rec_tgt: 39 },
    { year: "2023", team: "Alabama", gp: 13, rec: 40, rec_yd: 668, rec_td: 5, rec_tgt: 61 },
    { year: "2024", team: "Texas", gp: 16, rec: 53, rec_yd: 894, rec_td: 7, rec_tgt: 75 },
  ]},

  // ══ TE ══════════════════════════════════════════════════════════

  // Tyler Warren — Penn State
  "11631": { school: "Penn State", conf: "Big Ten", years: "2021-2024", pos: "TE", stats: [
    { year: "2021", team: "Penn State", gp: 5, rec: 1, rec_yd: 11, rec_td: 0 },
    { year: "2022", team: "Penn State", gp: 13, rec: 25, rec_yd: 237, rec_td: 2, rec_tgt: 33 },
    { year: "2023", team: "Penn State", gp: 13, rec: 34, rec_yd: 417, rec_td: 2, rec_tgt: 51 },
    { year: "2024", team: "Penn State", gp: 16, rec: 104, rec_yd: 1233, rec_td: 8, rec_tgt: 139, rush_yd: 128, rush_td: 3 },
  ]},

  // Colston Loveland — Michigan
  "11632": { school: "Michigan", conf: "Big Ten", years: "2022-2024", pos: "TE", stats: [
    { year: "2022", team: "Michigan", gp: 13, rec: 15, rec_yd: 214, rec_td: 2, rec_tgt: 22 },
    { year: "2023", team: "Michigan", gp: 15, rec: 45, rec_yd: 649, rec_td: 5, rec_tgt: 61 },
    { year: "2024", team: "Michigan", gp: 12, rec: 56, rec_yd: 582, rec_td: 5, rec_tgt: 78 },
  ]},

  // ══ DL ══════════════════════════════════════════════════════════

  // Abdul Carter — Penn State
  "11633": { school: "Penn State", conf: "Big Ten", years: "2022-2024", pos: "DL", stats: [
    { year: "2022", team: "Penn State", gp: 13, idp_tkl: 42, idp_sack: 2.0, idp_ff: 2, idp_int: 0, idp_pass_def: 0 },
    { year: "2023", team: "Penn State", gp: 14, idp_tkl: 67, idp_sack: 6.0, idp_ff: 2, idp_int: 1, idp_pass_def: 2 },
    { year: "2024", team: "Penn State", gp: 16, idp_tkl: 72, idp_sack: 12.0, idp_ff: 4, idp_int: 0, idp_pass_def: 3 },
  ]},

  // Mason Graham — Michigan
  "11634": { school: "Michigan", conf: "Big Ten", years: "2022-2024", pos: "DL", stats: [
    { year: "2022", team: "Michigan", gp: 14, idp_tkl: 24, idp_sack: 1.5, idp_ff: 0 },
    { year: "2023", team: "Michigan", gp: 15, idp_tkl: 43, idp_sack: 5.0, idp_ff: 1 },
    { year: "2024", team: "Michigan", gp: 12, idp_tkl: 34, idp_sack: 4.0, idp_ff: 2 },
  ]},

  // Mykel Williams — Georgia
  "11635": { school: "Georgia", conf: "SEC", years: "2022-2024", pos: "DL", stats: [
    { year: "2022", team: "Georgia", gp: 14, idp_tkl: 23, idp_sack: 2.5, idp_ff: 1 },
    { year: "2023", team: "Georgia", gp: 14, idp_tkl: 36, idp_sack: 5.5, idp_ff: 1 },
    { year: "2024", team: "Georgia", gp: 14, idp_tkl: 54, idp_sack: 8.5, idp_ff: 3 },
  ]},

  // ══ LB ══════════════════════════════════════════════════════════

  // Jalon Walker — Georgia
  "11636": { school: "Georgia", conf: "SEC", years: "2022-2024", pos: "LB", stats: [
    { year: "2022", team: "Georgia", gp: 15, idp_tkl: 21, idp_sack: 2.0, idp_ff: 1, idp_int: 0 },
    { year: "2023", team: "Georgia", gp: 14, idp_tkl: 39, idp_sack: 5.5, idp_ff: 3, idp_int: 0 },
    { year: "2024", team: "Georgia", gp: 13, idp_tkl: 56, idp_sack: 7.0, idp_ff: 2, idp_int: 1 },
  ]},

  // ══ DB ══════════════════════════════════════════════════════════

  // Will Johnson — Michigan
  "11637": { school: "Michigan", conf: "Big Ten", years: "2022-2024", pos: "DB", stats: [
    { year: "2022", team: "Michigan", gp: 12, idp_tkl: 25, idp_int: 2, idp_pass_def: 5, idp_ff: 0 },
    { year: "2023", team: "Michigan", gp: 10, idp_tkl: 16, idp_int: 1, idp_pass_def: 5, idp_ff: 0 },
    { year: "2024", team: "Michigan", gp: 12, idp_tkl: 29, idp_int: 3, idp_pass_def: 10, idp_ff: 1 },
  ]},

  // Malaki Starks — Georgia
  "11638": { school: "Georgia", conf: "SEC", years: "2022-2024", pos: "DB", stats: [
    { year: "2022", team: "Georgia", gp: 15, idp_tkl: 50, idp_int: 3, idp_pass_def: 5, idp_ff: 1 },
    { year: "2023", team: "Georgia", gp: 14, idp_tkl: 58, idp_int: 2, idp_pass_def: 6, idp_ff: 0 },
    { year: "2024", team: "Georgia", gp: 13, idp_tkl: 60, idp_int: 1, idp_pass_def: 8, idp_ff: 2 },
  ]},
};

// ── Helper: build college stats HTML table ────────────────────
window.buildCollegeStatsTable = function(pid) {
  const data = window.COLLEGE_STATS?.[pid];
  if (!data || !data.stats?.length) return null;

  const isQB = data.pos === 'QB';
  const isRB = data.pos === 'RB';
  const isWR = data.pos === 'WR' || data.pos === 'TE';
  const isIDP = ['DL','LB','DB'].includes(data.pos);

  let cols;
  if (isQB) cols = [{k:'gp',l:'GP'},{k:'pass_cmp',l:'CMP'},{k:'pass_att',l:'ATT'},{k:'pass_yd',l:'YDS'},{k:'pass_td',l:'TD'},{k:'pass_int',l:'INT'},{k:'rush_yd',l:'RUSH'},{k:'rush_td',l:'RTD'}];
  else if (isRB) cols = [{k:'gp',l:'GP'},{k:'rush_att',l:'ATT'},{k:'rush_yd',l:'YDS'},{k:'rush_td',l:'TD'},{k:'rec',l:'REC'},{k:'rec_yd',l:'REC YD'},{k:'rec_td',l:'RTD'}];
  else if (isWR) cols = [{k:'gp',l:'GP'},{k:'rec_tgt',l:'TGT'},{k:'rec',l:'REC'},{k:'rec_yd',l:'YDS'},{k:'rec_td',l:'TD'},{k:'rush_yd',l:'RUSH'}];
  else if (isIDP) cols = [{k:'gp',l:'GP'},{k:'idp_tkl',l:'TKL'},{k:'idp_sack',l:'SACK'},{k:'idp_int',l:'INT'},{k:'idp_pass_def',l:'PD'},{k:'idp_ff',l:'FF'}];
  else return null;

  const gridCols = '50px 42px ' + cols.map(() => '1fr').join(' ');
  const gold = '#D4AF37';
  const green = '#2ECC71';
  const silver = '#7d8291';
  const text = '#f0f0f3';

  const fmt = (v, k) => {
    if (v == null || (v === 0 && k !== 'pass_int')) return '<span style="color:'+silver+'">\u2014</span>';
    if (['pass_yd','rush_yd','rec_yd'].includes(k)) return '<strong>' + Math.round(v).toLocaleString() + '</strong>';
    if (['pass_td','rush_td','rec_td'].includes(k) && v >= 10) return '<span style="color:'+green+';font-weight:600">' + v + '</span>';
    if (k === 'idp_sack' && v >= 5) return '<span style="color:'+green+';font-weight:600">' + (Number.isInteger(v)?v:v.toFixed(1)) + '</span>';
    if (k === 'idp_tkl' && v >= 60) return '<span style="color:'+green+';font-weight:600">' + Math.round(v) + '</span>';
    if (k === 'idp_int' && v >= 3) return '<span style="color:'+green+';font-weight:600">' + v + '</span>';
    return Number.isInteger(v) ? v : v.toFixed(1);
  };

  // Totals
  const totals = {};
  cols.forEach(c => { totals[c.k] = 0; });
  data.stats.forEach(row => { cols.forEach(c => { totals[c.k] = (totals[c.k]||0) + (row[c.k]||0); }); });

  let html = '<div style="font-size:13px">';
  // Header
  html += '<div style="display:grid;grid-template-columns:'+gridCols+';gap:3px;padding:5px 0;border-bottom:2px solid rgba(212,175,55,0.2);margin-bottom:2px">';
  html += '<div style="font-size:13px;font-weight:700;color:'+silver+';text-transform:uppercase">YR</div>';
  html += '<div style="font-size:13px;font-weight:700;color:'+silver+';text-transform:uppercase">TM</div>';
  cols.forEach(c => { html += '<div style="font-size:13px;font-weight:700;color:'+silver+';text-transform:uppercase;text-align:right">'+c.l+'</div>'; });
  html += '</div>';

  // Rows
  data.stats.forEach(row => {
    html += '<div style="display:grid;grid-template-columns:'+gridCols+';gap:3px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">';
    html += '<div style="font-weight:700;color:'+silver+'">'+row.year+'</div>';
    html += '<div style="font-weight:700;padding:1px 3px;border-radius:3px;background:rgba(212,175,55,0.08);color:'+silver+';text-align:center;font-size:13px">'+(row.team||data.school).substring(0,10)+'</div>';
    cols.forEach(c => { html += '<div style="font-weight:600;text-align:right;color:'+text+'">'+fmt(row[c.k], c.k)+'</div>'; });
    html += '</div>';
  });

  // Totals row
  if (data.stats.length >= 2) {
    html += '<div style="display:grid;grid-template-columns:'+gridCols+';gap:3px;padding:6px 0;border-top:2px solid rgba(212,175,55,0.2);font-weight:700">';
    html += '<div style="font-size:13px;font-weight:800;color:'+gold+'">TOT</div>';
    html += '<div></div>';
    cols.forEach(c => { html += '<div style="text-align:right;color:'+text+'">'+fmt(totals[c.k], c.k)+'</div>'; });
    html += '</div>';
  }

  html += '</div>';
  return html;
};

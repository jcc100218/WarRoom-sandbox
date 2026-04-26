// ══════════════════════════════════════════════════════════════════
// js/draft/scouting.js — Prospect CSV pipeline for War Room main app
//
// Loads draft-war-room/player.csv (ranks + source columns) and
// draft-war-room/player-enrichment.csv (school, photo, summary,
// size/weight/speed) from the local filesystem, merges them, computes
// tier/grade/draftScore per csv-loader.js, and exposes:
//
//   window.getProspects()                 -> Array<Prospect>
//   window.findProspect(name)             -> Prospect | null
//   window.DraftCC.scouting.ready         -> Promise<Array<Prospect>>
//   window.DraftCC.scouting.isLoaded      -> boolean
//
// Draft-room.js has defensive `typeof window.findProspect === 'function'`
// checks at :76 and :86 that until now have always been false, because
// csv-loader.js only runs inside the standalone draft-war-room/index.html
// page. Loading this module immediately unlocks rich prospect data in the
// main app.
//
// Depends on: (none — uses fetch + globals, safe to load early)
// ══════════════════════════════════════════════════════════════════

(function() {
    const CSV_BASE = 'draft-war-room/';
    const PLAYER_CSV     = CSV_BASE + 'player.csv';
    const ENRICHMENT_CSV = CSV_BASE + 'player-enrichment.csv';

    // ── CSV parser (handles quoted fields containing commas) ─────────
    function parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map((line, idx) => {
            const vals = [];
            let cur = '';
            let quoted = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') { quoted = !quoted; }
                else if (ch === ',' && !quoted) { vals.push(cur); cur = ''; }
                else { cur += ch; }
            }
            vals.push(cur);
            const obj = { _rowIndex: idx + 1 };
            headers.forEach((h, i) => { obj[h] = vals[i] ? vals[i].trim() : ''; });
            return obj;
        });
    }

    // ── Scoring (ported from draft-war-room/csv-loader.js) ────────────
    function calculateTier(rank) {
        if (rank <= 10)  return 1;
        if (rank <= 32)  return 2;
        if (rank <= 64)  return 3;
        if (rank <= 100) return 4;
        if (rank <= 150) return 5;
        if (rank <= 224) return 6;
        return 7;
    }

    function calculateGrade(rank) {
        if (rank <= 5)   return 9.0 + (6 - rank) * 0.2;
        if (rank <= 10)  return 8.5 + (11 - rank) * 0.1;
        if (rank <= 32)  return 7.0 + (33 - rank) * 0.07;
        if (rank <= 64)  return 6.0 + (65 - rank) * 0.03;
        if (rank <= 100) return 5.0 + (101 - rank) * 0.03;
        if (rank <= 224) return 3.0 + (225 - rank) * 0.016;
        return Math.max(1.0, 3.0 - (rank - 224) * 0.01);
    }

    const POSITION_VALUES = {
        // Phase 7: 'ED' is a valid CSV abbreviation for edge rushers alongside 'EDGE' / 'DE'.
        // Previously only 'EDGE' / 'DE' were keyed — CSVs using 'ED' (e.g., draft-war-room/player.csv)
        // fell through to the default 1.0, producing under-weighted draftScores
        // (Rueben Bain Jr., rank 7, pos 'ED': (250-7)/25 * 1.0 = 9.72 instead of × 1.3).
        'QB': 1.5, 'EDGE': 1.3, 'DE': 1.3, 'ED': 1.3, 'OT': 1.25, 'T': 1.25,
        'WR': 1.2, 'CB': 1.15, 'DT': 1.1, 'DL': 1.1, 'IDL': 1.1,
        'LB': 1.05, 'ILB': 1.05, 'OLB': 1.05, 'S': 1.0, 'TE': 0.95,
        'IOL': 0.9, 'OG': 0.9, 'G': 0.9, 'C': 0.9, 'RB': 0.85,
        'K': 0.5, 'P': 0.5,
    };

    const FANTASY_POS_MULT = {
        'QB': 2.0, 'RB': 1.90, 'WR': 1.75, 'TE': 1.5, 'K': 0.5,
        'DE': 0.35, 'EDGE': 0.35, 'ED': 0.35, 'OLB': 0.35,
        'LB': 0.30, 'ILB': 0.30,
        'DB': 0.25, 'S': 0.25, 'CB': 0.25,
        'DL': 0.2, 'DT': 0.2, 'IDL': 0.2,
        'OT': 0.15, 'T': 0.15, 'IOL': 0.15, 'OG': 0.15, 'G': 0.15, 'C': 0.15, 'OL': 0.15,
        'P': 0.2,
    };

    function calculateDraftScore(rank, pos) {
        const posValue = POSITION_VALUES[pos] || 1.0;
        const baseScore = Math.max(0, (250 - rank) / 25);
        return Math.round(baseScore * posValue * 100) / 100;
    }

    // Tier-aware base score that drops sharply with rank — replaces the old
    // linear (250-rank)/25 curve which was too flat (rank 95 = 62% of rank 1).
    // New shape: top-of-tier scores well-separated, late-round prospects collapse to near-zero.
    function rankToTierBase(rank) {
        if (!rank || rank > 250) return 0.5;
        if (rank <= 5)   return 95 - (rank - 1) * 4;            // 95-79
        if (rank <= 10)  return 75 - (rank - 6) * 4;            // 75-59
        if (rank <= 20)  return 55 - (rank - 11) * 2.5;         // 55-32.5
        if (rank <= 32)  return 30 - (rank - 21) * 1.5;         // 30-13.5
        if (rank <= 50)  return 12 - (rank - 33) * 0.4;         // 12-5.2
        if (rank <= 100) return 5 - (rank - 51) * 0.07;         // 5-1.5
        if (rank <= 150) return 1.5 - (rank - 101) * 0.02;      // 1.5-0.5
        if (rank <= 224) return Math.max(0.1, 0.5 - (rank - 151) * 0.005);
        return 0.1;
    }

    // Pick-to-base score — overall draft pick → 0-100 value.
    // Top-of-draft picks hold most of their value, R7 tail collapses.
    function pickToBase(pick, isUDFA, hasTeam) {
        if (pick) {
            if (pick <= 5)   return 100;
            if (pick <= 15)  return 80 - (pick - 6) * 1.5;     // 80-66.5
            if (pick <= 32)  return 60 - (pick - 16) * 2;      // 60-28
            if (pick <= 64)  return 28 - (pick - 33) * 0.5;    // 28-12.5
            if (pick <= 100) return 12 - (pick - 65) * 0.15;   // 12-6.6
            if (pick <= 140) return 6 - (pick - 101) * 0.07;   // 6-3.2
            if (pick <= 180) return 3 - (pick - 141) * 0.04;   // 3-1.4
            if (pick <= 220) return 1.3 - (pick - 181) * 0.02; // 1.3-0.5
            return 0.4;  // R7 tail
        }
        if (isUDFA && hasTeam) return 0.6;
        return 0.1;  // undrafted, no team
    }

    // Draft-capital multiplier — flatter curve (1.45 top → 0.30 undrafted).
    // Applied as a 60/40 blend with pre-draft consensus value:
    //   blended = preDraft * (0.6 + 0.4 * draftCapMult)
    // R1.01 pick boosts ~18%, R4 fall costs ~6%, UDFA costs ~22%.
    function draftCapitalMult(round, pick, isUDFA, hasTeam) {
        if (round && pick) {
            if (pick <= 5)   return 1.45;
            if (pick <= 15)  return 1.35;
            if (pick <= 32)  return 1.20;
            if (pick <= 64)  return 1.05;
            if (pick <= 100) return 0.95;
            if (pick <= 140) return 0.85;
            if (pick <= 180) return 0.75;
            if (pick <= 220) return 0.65;
            return 0.55;  // R7
        }
        if (isUDFA && hasTeam) return 0.45;
        return 0.30;  // undrafted, no team
    }

    // Map raw CSV pos to Sleeper-canonical positions (WR/RB/QB/TE/DL/LB/DB/EDGE)
    function mapCSVPos(pos) {
        if (!pos) return '';
        const upper = pos.toUpperCase();
        // Phase 7 fix: include 'ED' (CSV variant for edge rusher) so it maps to DL alongside DE/EDGE.
        if (['DE','DT','ED','EDGE','IDL','NT'].includes(upper)) return 'DL';
        if (['ILB','OLB','MLB'].includes(upper)) return 'LB';
        if (['CB','S','FS','SS'].includes(upper)) return 'DB';
        return upper;
    }

    // ── Loader (runs once on module init, returns a Promise) ─────────
    let _ready = null;
    let _prospects = [];
    let _nameIndex = {};

    function loadProspects() {
        if (_ready) return _ready;
        _ready = (async function() {
            let playersRaw = [];
            let enrichmentMap = {};

            // Fetch player.csv
            try {
                const resp = await fetch(PLAYER_CSV);
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                const text = await resp.text();
                playersRaw = parseCSV(text);
            } catch (e) {
                if (window.wrLog) window.wrLog('scouting.loadPlayers', e);
                return [];
            }

            // Fetch enrichment (optional — missing file is OK)
            try {
                const resp = await fetch(ENRICHMENT_CSV);
                if (resp.ok) {
                    const text = await resp.text();
                    const rows = parseCSV(text);
                    rows.forEach(r => {
                        const key = (r.name || '').toLowerCase().trim();
                        if (!key) return;
                        const dRoundRaw = (r.draft_round || '').trim();
                        const dPickN = parseInt(r.draft_pick, 10);
                        enrichmentMap[key] = {
                            displayName: r.name || '',
                            previousRank: parseInt(r.Rank, 10) || null,
                            school: r.school || '',
                            espnId: r.espn_id || '',
                            photoUrl: r.photo_url || '',
                            summary: r.summary || '',
                            year: r.year || '',
                            size: r.size || '',
                            weight: r.weight || '',
                            speed: r.speed || '',
                            fantasyMultiplier: parseFloat(r.fantasyMultiplier) || 1.0,
                            nflTeam: (r.nfl_team || '').trim(),
                            draftRound: dRoundRaw && dRoundRaw.toUpperCase() !== 'UDFA'
                                ? (Number.isFinite(parseInt(dRoundRaw, 10)) ? parseInt(dRoundRaw, 10) : null)
                                : null,
                            draftPick: Number.isFinite(dPickN) && dPickN > 0 ? dPickN : null,
                            isUDFA: dRoundRaw.toUpperCase() === 'UDFA',
                            pos: (r.pos || '').trim(),
                        };
                    });
                }
            } catch (e) {
                if (window.wrLog) window.wrLog('scouting.loadEnrichment', e);
            }

            // Detect source columns (any column not in standard set)
            const STANDARD = new Set([
                'rank','player name','player','name','pos','position',
                'college','school','player_id','id','_rowindex','exp','avg',
            ]);
            const allCols = playersRaw.length ? Object.keys(playersRaw[0]) : [];
            const sourceCols = allCols.filter(c => !STANDARD.has(c.toLowerCase()));

            // Build prospects
            const prospects = playersRaw.map((row, idx) => {
                const rank = parseInt(row.Rank || row.rank || (idx + 1), 10);
                const name = (row.Name || row.name || row.Player || '').trim();
                const rawPos = (row.Pos || row.pos || row.Position || '').trim();
                const pos = rawPos.toUpperCase();
                const mappedPos = mapCSVPos(rawPos);
                const key = name.toLowerCase().trim();
                const enrich = enrichmentMap[key] || {};

                const tier = calculateTier(rank);
                const grade = Math.round(calculateGrade(rank) * 10) / 10;
                const draftScore = calculateDraftScore(rank, pos);
                const fantasyMultiplier = enrich.fantasyMultiplier || FANTASY_POS_MULT[pos] || 0.3;
                // Component 1: rank-based value (our consensus tier curve)
                const rankValue = Math.min(10000, Math.round(rankToTierBase(rank) * fantasyMultiplier * 60));
                // Component 2: draft-capital-based value (where the NFL took them)
                const draftCapitalValue = Math.min(10000, Math.round(pickToBase(enrich.draftPick, enrich.isUDFA, !!enrich.nflTeam) * fantasyMultiplier * 60));
                // Legacy combined value (60/40 rank+capital) — used as fallback when FC has no data.
                const dynastyValue = Math.min(10000, Math.round(rankValue * 0.6 + draftCapitalValue * 0.4));

                // Source ranks (for "consensus baseline" comparison later)
                const sourceRanks = {};
                sourceCols.forEach(col => {
                    const v = row[col];
                    if (v && v !== '-' && v !== 'N/A') {
                        const parsed = parseFloat(v);
                        if (!isNaN(parsed)) sourceRanks[col] = parsed;
                    }
                });

                // Consensus rank: prefer "Avg" column if present, else mean of sourceRanks
                let consensusRank = rank;
                if (row.Avg && !isNaN(parseFloat(row.Avg))) {
                    consensusRank = parseFloat(row.Avg);
                } else if (Object.keys(sourceRanks).length) {
                    const vals = Object.values(sourceRanks);
                    consensusRank = vals.reduce((a, b) => a + b, 0) / vals.length;
                }

                return {
                    // Identity
                    pid: 'csv_' + key.replace(/[^a-z0-9]/g, '_'),
                    name,
                    pos: mappedPos || pos,
                    rawPos: pos,
                    mappedPos,
                    // Rank + scoring
                    rank,
                    previousRank: enrich.previousRank,
                    consensusRank: Math.round(consensusRank * 10) / 10,
                    tier,
                    grade,
                    draftScore,
                    dynastyValue,
                    rankValue,
                    draftCapitalValue,
                    fantasyMultiplier,
                    // Enrichment
                    college: enrich.school || '',
                    school: enrich.school || '',
                    photoUrl: enrich.photoUrl || '',
                    espnId: enrich.espnId || '',
                    summary: enrich.summary || '',
                    year: enrich.year || '',
                    size: enrich.size || '',
                    weight: enrich.weight || '',
                    speed: enrich.speed || '',
                    nflTeam: enrich.nflTeam || '',
                    draftRound: enrich.draftRound || null,
                    draftPick: enrich.draftPick || null,
                    isUDFA: !!enrich.isUDFA,
                    experience: row.Exp || '',
                    // Source ranks for analytics later
                    sourceRanks,
                };
            }).filter(p => p.name);

            // Merge drafted/UDFA players from enrichment that aren't in player.csv —
            // ensures every drafted rookie is on the board, not just consensus-ranked ones.
            const seenNames = new Set(prospects.map(p => p.name.toLowerCase().trim()));
            // Also build a (surname, school) → existing prospect index so we don't
            // double-create when an enrichment row is just a nickname variant of a
            // ranked prospect (e.g., "Kc Concepcion" + "Kevin Concepcion" @ Texas A&M).
            // When a synth would collide, copy its draft data into the existing row.
            const surnameSchoolIndex = {};
            prospects.forEach(p => {
                const parts = p.name.toLowerCase().split(' ');
                const surname = parts[parts.length - 1] || '';
                const school = (p.school || p.college || '').toLowerCase();
                if (surname && school) {
                    surnameSchoolIndex[surname + '|' + school] = p;
                }
            });
            let synthCount = 0;
            let mergedCount = 0;
            Object.entries(enrichmentMap).forEach(([key, e]) => {
                if (seenNames.has(key)) return;
                if (!e.nflTeam && !e.draftRound && !e.isUDFA) return; // only add if drafted/UDFA-signed
                // Check for nickname-variant collision before synthesizing
                const eParts = key.split(' ');
                const eSurname = eParts[eParts.length - 1] || '';
                const eSchool = (e.school || '').toLowerCase();
                const collision = surnameSchoolIndex[eSurname + '|' + eSchool];
                if (collision) {
                    // Same surname + school = same player. Merge draft data into the ranked row.
                    if (!collision.nflTeam) collision.nflTeam = e.nflTeam || '';
                    if (!collision.draftRound) collision.draftRound = e.draftRound || null;
                    if (!collision.draftPick) collision.draftPick = e.draftPick || null;
                    if (!collision.isUDFA) collision.isUDFA = !!e.isUDFA;
                    mergedCount++;
                    return;
                }
                const displayName = e.displayName || key.replace(/\b\w/g, c => c.toUpperCase());
                const rawPos = (e.pos || '').toUpperCase();
                const mappedPos = rawPos ? mapCSVPos(rawPos) : '';
                const rank = 999;
                const draftScore = e.draftRound ? Math.max(0.1, (10 - e.draftRound)) : 0.1;
                synthCount++;
                // For synth prospects (no pre-draft consensus rank), lean entirely
                // on draft capital — there's no consensus value to blend with.
                const synthFmult = FANTASY_POS_MULT[rawPos] || 0.3;
                const synthRankValue = 0;  // no consensus rank
                const synthDraftCapitalValue = Math.min(10000, Math.round(pickToBase(e.draftPick, e.isUDFA, !!e.nflTeam) * synthFmult * 60));
                const synthDynastyValue = synthDraftCapitalValue;
                prospects.push({
                    pid: 'csv_' + key.replace(/[^a-z0-9]/g, '_'),
                    name: displayName,
                    pos: mappedPos || rawPos || '',
                    rawPos,
                    mappedPos,
                    rank,
                    previousRank: e.previousRank,
                    consensusRank: rank,
                    tier: 7,
                    grade: 1.0,
                    draftScore,
                    dynastyValue: synthDynastyValue,
                    rankValue: synthRankValue,
                    draftCapitalValue: synthDraftCapitalValue,
                    fantasyMultiplier: synthFmult,
                    college: e.school || '',
                    school: e.school || '',
                    photoUrl: e.photoUrl || '',
                    espnId: e.espnId || '',
                    summary: e.summary || '',
                    year: e.year || '',
                    size: e.size || '',
                    weight: e.weight || '',
                    speed: e.speed || '',
                    nflTeam: e.nflTeam || '',
                    draftRound: e.draftRound || null,
                    draftPick: e.draftPick || null,
                    isUDFA: !!e.isUDFA,
                    experience: '',
                    sourceRanks: {},
                    isCSVOnly: true,
                });
            });
            if ((synthCount || mergedCount) && window.wrLog) window.wrLog('scouting.synthesized', { synth: synthCount, merged: mergedCount });

            prospects.sort((a, b) => a.rank - b.rank);
            _prospects = prospects;
            _nameIndex = {};
            const stripSuffix = s => s.replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim();
            const stripPunct  = s => s.replace(/[^a-z0-9 ]/gi, ' ').replace(/\s+/g, ' ').trim();
            // When two prospect rows map to the same key (e.g., "Kevin Concepcion"
            // + "Kc Concepcion" both → "concepcion" surname-key), prefer the row
            // with the lowest rank (= most comprehensive data, ranked in player.csv).
            const setBest = (key, p) => {
                const existing = _nameIndex[key];
                if (!existing || p.rank < existing.rank) _nameIndex[key] = p;
            };
            prospects.forEach(p => {
                const lc = p.name.toLowerCase().trim();
                setBest(lc, p);
                const noSuffix = stripSuffix(lc);
                if (noSuffix !== lc) setBest(noSuffix, p);
                const punctless = stripPunct(noSuffix);
                if (punctless !== noSuffix) setBest(punctless, p);
                const parts = noSuffix.split(' ');
                if (parts.length >= 2) {
                    setBest((parts[0] + ' ' + parts[parts.length - 1]).trim(), p);
                    // Also index by surname + first-initial so "kc concepcion" finds "kevin concepcion"
                    setBest(parts[0][0] + ' ' + parts[parts.length - 1], p);
                }
            });

            window.DraftCC.scouting.isLoaded = true;
            if (window.wrLog) window.wrLog('scouting.loaded', { count: prospects.length });
            return prospects;
        })();
        return _ready;
    }

    // ── Public API ────────────────────────────────────────────────────
    function getProspects() {
        return _prospects.slice();
    }

    function findProspect(name) {
        if (!name) return null;
        const key = String(name).toLowerCase().trim();
        if (_nameIndex[key]) return _nameIndex[key];
        const noSuffix = key.replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim();
        if (noSuffix !== key && _nameIndex[noSuffix]) return _nameIndex[noSuffix];
        const stripped = noSuffix.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        if (_nameIndex[stripped]) return _nameIndex[stripped];
        const parts = stripped.split(' ');
        if (parts.length >= 2) {
            const firstLast = parts[0] + ' ' + parts[parts.length - 1];
            if (_nameIndex[firstLast]) return _nameIndex[firstLast];
            // Last resort: surname + first-initial (handles nicknames: KC ↔ Kevin)
            const initialKey = parts[0][0] + ' ' + parts[parts.length - 1];
            if (_nameIndex[initialKey]) return _nameIndex[initialKey];
        }
        return null;
    }

    // Expose
    window.DraftCC = window.DraftCC || {};
    window.DraftCC.scouting = {
        ready: loadProspects(),
        isLoaded: false,
        getProspects,
        findProspect,
    };
    window.getProspects = getProspects;
    window.findProspect = findProspect;
})();

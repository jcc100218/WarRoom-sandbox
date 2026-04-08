// ══════════════════════════════════════════════════════════════════
// js/utils/player-value.js — Shared player valuation constants and functions
// Single source of truth for: aging curves, pick values, roster construction
// targets, and the projectPlayerValue projection engine.
//
// Consumed by: league-detail.js, trade-calc.js
// Exposed as: window.App.PlayerValue
// ══════════════════════════════════════════════════════════════════

window.App.PlayerValue = (function () {

    // ── Roster construction targets ──────────────────────────────────
    const IDEAL_ROSTER = { QB:3, RB:7, WR:7, TE:4, K:2, DL:7, LB:6, DB:6 };
    const DRAFT_ROUNDS  = 7;
    const PICK_HORIZON  = 3;
    const PICK_IDEAL    = DRAFT_ROUNDS * PICK_HORIZON;

    const LINEUP_STARTERS    = { QB:1, RB:2, WR:3, TE:1, K:1, DL:3, LB:2, DB:3 };
    const MIN_STARTER_QUALITY = { QB:2, RB:3, WR:3, TE:2, K:1, DL:4, LB:5, DB:4 };
    const NFL_STARTER_POOL    = { QB:32, RB:40, WR:64, TE:32, K:32, DL:64, LB:64, DB:64 };
    const POS_PT_TARGETS      = { QB:20, RB:36, WR:36, TE:10, K:9, DL:24, LB:16, DB:24 };
    const POS_WEIGHTS         = { QB:14, RB:14, WR:14, TE:8, K:3, DL:13, LB:10, DB:12 };
    const TOTAL_WEIGHT        = Object.values(POS_WEIGHTS).reduce((a,b)=>a+b,0); // 88

    // ── Draft pick values (DHQ equivalent, used as fallback when DHQ engine absent) ──
    const PICK_VALUES = { 1:6250, 2:3150, 3:1650, 4:850, 5:450, 6:225, 7:125 };
    const PICK_COLORS = { 1:'#D4AF37', 2:'#5DADE2', 3:'#2ECC71', 4:'#BB8FCE', 5:'#95A5A6', 6:'#7F8C8D', 7:'#6C7A7D' };

    // Slot-specific values (16-team × 7-round = 112 picks). Top picks carry premium.
    const PICK_VALUES_BY_SLOT = {
        1:8500, 2:8000, 3:7500, 4:7100, 5:6700, 6:6400, 7:6200, 8:6000,
        9:5800, 10:5600, 11:5400, 12:5200, 13:5000, 14:4800, 15:4600, 16:4400,
        17:4200, 18:4000, 19:3800, 20:3600, 21:3400, 22:3200, 23:3050, 24:2900,
        25:2750, 26:2600, 27:2450, 28:2300, 29:2150, 30:2000, 31:1900, 32:1800,
        33:1700, 34:1600, 35:1500, 36:1400, 37:1300, 38:1200, 39:1100, 40:1050,
        41:1000, 42:950, 43:900, 44:850, 45:800, 46:750, 47:700, 48:650,
        49:600, 50:560, 51:520, 52:480, 53:450, 54:420, 55:400, 56:380,
        57:360, 58:340, 59:320, 60:300, 61:280, 62:260, 63:240, 64:220,
        65:210, 66:200, 67:190, 68:180, 69:170, 70:160, 71:150, 72:140,
        73:130, 74:125, 75:120, 76:115, 77:110, 78:105, 79:100, 80:95,
        81:90, 82:85, 83:80, 84:75, 85:70, 86:68, 87:65, 88:62,
        89:60, 90:58, 91:55, 92:52, 93:50, 94:48, 95:45, 96:42,
        97:40, 98:38, 99:35, 100:32, 101:30, 102:28, 103:25, 104:22,
        105:20, 106:18, 107:16, 108:14, 109:12, 110:10, 111:8, 112:6,
    };

    // Compute overall draft slot from slot_to_roster_id maps
    // draftSlotMaps = { year: { rosterId: slotInRound } }
    function getPickOverallSlot(year, round, fromRosterId, allRosters, draftSlotMaps) {
        if (!fromRosterId || !allRosters?.length) return null;
        const numTeams = allRosters.length;
        // Primary: Sleeper's authoritative slot_to_roster_id
        const yearMap = draftSlotMaps?.[Number(year)];
        if (yearMap) {
            const slotInRound = yearMap[String(fromRosterId)];
            if (slotInRound >= 1) return (round - 1) * numTeams + slotInRound;
        }
        // Fallback: waiver_position (set by Sleeper post-season as draft-order proxy)
        const roster = allRosters.find(r => String(r.roster_id) === String(fromRosterId));
        if (!roster) return null;
        const slotInRound = roster.settings?.waiver_position;
        if (slotInRound >= 1 && slotInRound <= numTeams) return (round - 1) * numTeams + slotInRound;
        return null;
    }

    // Resolve pick value — uses slot-specific when available, round-average fallback
    function resolvePickValue(year, round, fromRosterId, allRosters, draftSlotMaps) {
        const slot = getPickOverallSlot(year, round, fromRosterId, allRosters, draftSlotMaps);
        if (slot && PICK_VALUES_BY_SLOT[slot]) return { value: PICK_VALUES_BY_SLOT[slot], slot };
        return { value: PICK_VALUES[round] || 100, slot: null };
    }

    // ── Aging curves ─────────────────────────────────────────────────
    // Max achievable DHQ per position (caps projection ceiling)
    const POS_CEILINGS = { QB:12000, RB:9000, WR:10500, TE:8500, DL:7000, LB:7000, DB:7000 };

    // Decay rates are owned by reconai/shared/constants.js (CDN source of truth).
    // Provide a fallback with CDN-matching values in case constants.js hasn't loaded.
    window.App.decayRates = window.App.decayRates || { QB:0.06, RB:0.25, WR:0.14, TE:0.12, DL:0.15, LB:0.15, DB:0.14 };

    // ── getPickValue ─────────────────────────────────────────────────
    // Returns DHQ-equivalent value for a draft pick. Delegates to DHQ engine when available.
    function getPickValue(season, round, totalTeams) {
        if (window.App?.LI?.dhqPickValueFn) {
            const val = window.App.LI.dhqPickValueFn(season, round, Math.ceil((totalTeams || 12) / 2));
            if (val > 0) return val;
        }
        return PICK_VALUES[round] || 100;
    }

    // ── Usage signal helpers ─────────────────────────────────────────
    // Reads from window.S.playerStats[pid].prevRawStats (Sleeper season totals).
    // Returns a multiplier on the base decay rate.  > 1 = faster decline, < 1 = slower.
    function computeUsageDecayMultiplier(pid, nPos) {
        const raw = window.S?.playerStats?.[pid]?.prevRawStats;
        if (!raw) return 1.0;
        const gp = raw.gp || 0;
        if (gp < 4) return 1.0; // too few games for a reliable signal

        if (nPos === 'RB') {
            const cpg = (raw.rush_att || 0) / gp;
            if (cpg >= 20) return 1.10;  // workhorse — tread wears faster
            if (cpg < 12)  return 0.90;  // pass-catching back — lighter load
            return 1.0;
        }
        if (nPos === 'WR' || nPos === 'TE') {
            const tpg = (raw.rec_tgt || raw.rec_att || 0) / gp;
            const hiThreshold = nPos === 'TE' ? 7 : 8;
            if (tpg >= hiThreshold) return 0.93; // featured target — established role, more stable
            return 1.0;
        }
        if (nPos === 'QB') {
            const rapg = (raw.rush_att || 0) / gp;
            if (rapg >= 7) return 1.05; // mobile QB — physical wear from running
            return 1.0;
        }
        return 1.0;
    }

    // Returns a one-time additive DHQ adjustment for WR/TE based on target share trend.
    // Positive trend (rising share) → positive bonus; negative → penalty.
    // Applied only in year 1 of the projection; dampened to avoid over-weighting one signal.
    function computeUsageTrendBonus(nPos, baseDhq, trend) {
        if (nPos !== 'WR' && nPos !== 'TE') return 0;
        if (Math.abs(trend) < 0.10) return 0;  // below noise threshold
        // Cap trend influence at ±50%; scale to ±5% of base DHQ
        const capped = Math.min(Math.max(trend, -0.50), 0.50);
        return Math.round(baseDhq * capped * 0.10);
    }

    // ── projectPlayerValue ───────────────────────────────────────────
    // Projects (or retro-jects) a player's DHQ value `delta` seasons away.
    // Uses position-specific peak windows, usage-adjusted decay rates, and
    // a confidence half-life to produce calibrated multi-year projections.
    //
    // Parameters:
    //   pid      — player id (used for isElitePlayer lookup + usage stat read)
    //   baseDhq  — current DHQ score
    //   baseAge  — player's current age
    //   pos      — position string (may be variant like 'DE', 'CB', 'OLB')
    //   delta    — years offset; positive = future, negative = past
    //   meta     — optional { trend: Number } where trend ≈ YoY PPG change fraction
    //
    // Usage signals (read from window.S.playerStats[pid].prevRawStats):
    //   RB carries/game  ≥20 → decay ×1.10 (workhorse ages faster)
    //   RB carries/game  <12 → decay ×0.90 (pass-catcher ages slower)
    //   WR/TE targets/game ≥8/7 → decay ×0.93 (featured role, more stable)
    //   QB rush att/game  ≥7  → decay ×1.05 (mobile QB wear)
    //   WR/TE rising target share (meta.trend >10%) → year-1 value bonus
    //   WR/TE declining target share (meta.trend <-10%) → year-1 value penalty
    function projectPlayerValue(pid, baseDhq, baseAge, pos, delta, meta) {
        if (!baseDhq || baseDhq <= 0 || delta === 0) return baseDhq;
        const peakWindows = window.App.peakWindows;
        const decayRates  = window.App.decayRates;
        const nPos = pos === 'DE' || pos === 'DT'   ? 'DL'
                   : pos === 'CB' || pos === 'S'    ? 'DB'
                   : pos === 'OLB' || pos === 'ILB' ? 'LB'
                   : pos;
        const [pLo, pHi] = peakWindows[nPos] || [24, 29];
        const decay = decayRates[nPos] || 0.12;
        const ceiling = POS_CEILINGS[nPos] || 10000;

        if (!baseAge || baseAge <= 0) return baseDhq;

        const trend = meta?.trend || 0;        // e.g. +0.15 = trending up 15%
        const trendBoost = 1 + (trend * 0.5);  // dampen raw trend for projection

        // Offseason projections decay slower (less in-season noise)
        const month = new Date().getMonth(); // 0-indexed
        const inSeason = month >= 8 || month <= 1; // Sep–Feb
        const halfLife = inSeason ? 1.5 : 3.0;

        const isElite  = typeof window.App?.isElitePlayer === 'function'
                         ? window.App.isElitePlayer(pid) : baseDhq >= 7000;
        const isProven = baseDhq >= 4000;
        const peakMid  = Math.floor((pLo + pHi) / 2);

        // ── Usage-adjusted decay rate ──────────────────────────────
        const usageMult    = computeUsageDecayMultiplier(pid, nPos);
        const effectiveDecay = decay * usageMult;

        // ── Target share trend bonus (WR/TE only, year 1) ──────────
        const trendBonus = computeUsageTrendBonus(nPos, baseDhq, trend);

        let val = baseDhq;

        if (delta > 0) {
            // ── Future projection ─────────────────────────────────────
            for (let yr = 1; yr <= delta; yr++) {
                const ageAtYr   = baseAge + yr;
                const confidence = Math.pow(0.5, yr / halfLife);
                if (ageAtYr <= pLo) {
                    // Pre-peak: larger growth window
                    const growthRate = isElite ? 0.18 : isProven ? 0.14 : 0.08;
                    const projected  = val * (1 + growthRate * trendBoost);
                    val = projected * confidence + val * (1 - confidence);
                } else if (ageAtYr <= peakMid) {
                    // Early-peak: still appreciating
                    const rate = isElite ? 0.06 : isProven ? 0.03 : 0.0;
                    val *= (1 + rate * trendBoost);
                } else if (ageAtYr <= pHi) {
                    // Late-peak: holding or starting to decline
                    val *= isElite ? 1.0 : isProven ? (1 - effectiveDecay * 0.1) : (1 - effectiveDecay * 0.25);
                } else {
                    // Post-peak: steeper decline, 0.25 acceleration per year past peak
                    const yearsPast = ageAtYr - pHi;
                    const accel = 1 + yearsPast * 0.25;
                    val *= (1 - effectiveDecay * accel);
                }
                // Apply target share trend pressure in year 1 only (signal fades quickly)
                if (yr === 1 && trendBonus !== 0) val += trendBonus;
                // SOS adjustment: year 1 only, current season projections (not dynasty multi-year)
                // Easy schedule (rank 25-32) → small positive; Hard (rank 1-8) → small negative
                // Range: ±5% max; uses last completed season's average opponent defense rank
                if (yr === 1 && window.App?.SOS?.ready) {
                    const pd = window.App?.SOS?.defenseRankings; // existence check only
                    if (pd) {
                        const playerTeam = window.App?._playersCache?.[pid]?.team;
                        const sos = playerTeam
                            ? window.App.SOS.getPlayerSOS(pid, nPos, playerTeam)
                            : null;
                        if (sos?.avgRank != null) {
                            // rank 16.5 = league average; ±16.5 range → ±5% adjustment
                            const sosAdj = (sos.avgRank - 16.5) / 16.5 * 0.05;
                            val = val * (1 + sosAdj);
                        }
                    }
                }
                val = Math.min(val, ceiling);
            }
        } else {
            // ── Historical retrojection ───────────────────────────────
            for (let yr = 1; yr <= Math.abs(delta); yr++) {
                const ageAtYr = (baseAge || 25) - yr;
                if (ageAtYr < pLo - 2) {
                    val *= (1 - 0.15);                // worth less when very young
                } else if (ageAtYr <= pHi) {
                    val *= (1 + effectiveDecay * 0.1); // in window, similar value
                } else {
                    val *= (1 + effectiveDecay * 0.5); // worth more when younger past peak
                }
            }
        }

        return Math.max(0, Math.round(val));
    }

    return {
        IDEAL_ROSTER,
        DRAFT_ROUNDS,
        PICK_HORIZON,
        PICK_IDEAL,
        LINEUP_STARTERS,
        MIN_STARTER_QUALITY,
        NFL_STARTER_POOL,
        POS_PT_TARGETS,
        POS_WEIGHTS,
        TOTAL_WEIGHT,
        PICK_VALUES,
        PICK_VALUES_BY_SLOT,
        PICK_COLORS,
        POS_CEILINGS,
        getPickValue,
        getPickOverallSlot,
        resolvePickValue,
        projectPlayerValue,
    };
})();

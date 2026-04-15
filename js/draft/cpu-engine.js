// ══════════════════════════════════════════════════════════════════
// js/draft/cpu-engine.js — Persona-aware rule-based CPU picker
//
// Tier 1 of the Draft Command Center AI. Runs on every CPU pick (cheap,
// synchronous, deterministic enough to fairness-grade). Tier 2 (Sonnet
// narrative via alexPickReaction) comes in Phase 4.
//
// Ports Scout's _mockDNAInformedPick (reconai/js/draft-ui.js:639) and
// extends it with:
//   - Trade-DNA multipliers (FLEECER / DOMINATOR / STALWART / ACCEPTOR / DESPERATE)
//   - Posture multipliers (LOCKED / DESPERATE / BUYER / SELLER / NEUTRAL)
//   - Window alignment (CONTENDER / CROSSROADS / REBUILDING)
//   - BPA floor (40% of top-5 DHQ)
//   - Per-round position priors (early-round offensive bias)
//
// Depends on: persona.js (reads Persona shape)
// Exposes:    window.DraftCC.cpuEngine.personaPick(persona, available, round, pickNumber)
// ══════════════════════════════════════════════════════════════════

(function() {
    // Early-round position priors: in R1–2, offensive skill positions dominate real drafts.
    // IDP/K rarely go in R1 unless history says otherwise.
    const EARLY_OFFENSE_PRIOR = { QB: 1.0, RB: 1.0, WR: 1.0, TE: 0.95, K: 0.3, DL: 0.5, LB: 0.5, DB: 0.4 };

    // Trade DNA nudges. Each multiplier describes "score factor" applied to a player based on persona.tradeDna.key.
    // Returns a function (player, round) -> multiplier
    function tradeDnaMultiplier(persona, player, round) {
        const key = persona.tradeDna?.key || 'NONE';
        const pos = player.pos;
        if (key === 'FLEECER') {
            // Hunt asymmetric value — prefer high-DHQ, value-per-pick
            return 1.12;
        }
        if (key === 'DOMINATOR') {
            // Status picks — QB/RB in R1-2 get a nudge
            if (round <= 2 && (pos === 'QB' || pos === 'RB')) return 1.15;
            return 1.0;
        }
        if (key === 'STALWART') {
            // By the board — no reach
            return 1.0;
        }
        if (key === 'ACCEPTOR') {
            // Young / rookie bias (all CSV prospects are "young" by nature)
            return 1.08;
        }
        if (key === 'DESPERATE') {
            // Heavy need premium handled downstream — neutral here
            return 1.0;
        }
        return 1.0;
    }

    // Posture nudges
    function postureMultiplier(persona, player, round, needIdx) {
        const key = persona.posture?.key || 'NEUTRAL';
        const pos = player.pos;
        if (key === 'LOCKED') {
            // Tight variance, no reaches
            return 1.0;
        }
        if (key === 'DESPERATE' && needIdx === 0) {
            // Strong need premium
            return 1.25;
        }
        if (key === 'BUYER') {
            // Win-now positions get a nudge
            if (round <= 3 && (pos === 'RB' || pos === 'WR')) return 1.10;
            return 1.0;
        }
        if (key === 'SELLER') {
            // Reverse the strength penalty — they'll happily draft more of a position they have
            return 1.05;
        }
        return 1.0;
    }

    // Window alignment — contenders bias toward immediate impact; rebuilders toward upside
    function windowMultiplier(persona, player, round) {
        const win = persona.assessment?.window || persona.assessment?.tier || 'CROSSROADS';
        if (win === 'CONTENDER' || win === 'ELITE') {
            // Contenders like veterans / sure things (higher DHQ fine, no penalty)
            return 1.0;
        }
        if (win === 'REBUILDING') {
            // Rebuilders care less about need, more about raw upside
            return 1.02;
        }
        return 1.0;
    }

    // Variance bound based on tradeDna — Stalwart is tight, others ±5%
    function variancePct(persona) {
        const key = persona.tradeDna?.key;
        if (key === 'STALWART' || persona.posture?.key === 'LOCKED') return 0.03;
        return 0.05;
    }

    /**
     * personaPick — pick a player for a CPU team using the rule tier.
     *
     * @param {Persona} persona — from composePersona
     * @param {Array<Player>} available — pool of draftable players, each with { pid, name, pos, dhq, val, ... }
     * @param {number} round — 1-indexed round
     * @param {number} pickNumber — overall pick number (1-indexed)
     * @param {Object} ctx — { teamRoster: Array<string> } — positions already taken by this team
     * @returns {Object} { player, confidence, reasoning } or null if pool empty
     */
    function personaPick(persona, available, round, pickNumber, ctx = {}) {
        if (!available || !available.length) return null;

        const teamRoster = ctx.teamRoster || [];
        const dna = persona?.draftDna || {};
        const posPct = dna.posPct || {};
        const r1Positions = dna.r1Positions || [];
        const label = dna.label || 'Balanced';

        const assess = persona?.assessment || {};
        const needs = assess.needs || [];
        const strengths = assess.strengths || [];
        const healthScore = assess.healthScore || 70;

        const needPositions = needs.map(n => typeof n === 'string' ? n : (n?.pos || ''));
        const strengthPositions = strengths.map(s => typeof s === 'string' ? s : (s?.pos || ''));

        // BPA floor: 40% of top-5 DHQ — never pick someone drastically worse unless pool is thin
        const topDHQ = Math.max(...available.slice(0, 5).map(p => p.dhq || p.val || 0), 1);
        const bpaFloor = topDHQ * 0.40;

        const earlyPrior = round <= 2 ? EARLY_OFFENSE_PRIOR : null;
        const variance = variancePct(persona);

        let best = null;
        let bestScore = -Infinity;
        let bestReasoning = null;

        for (const p of available) {
            const val = p.dhq || p.val || 0;
            if (val < bpaFloor && available.length > 5) continue;

            // Base score = raw DHQ
            let score = val;
            const reasoning = {
                primary: 'DHQ',
                baseVal: val,
                nudges: [],
                reach: false,
                bpaFloorTriggered: false,
            };

            // 1. Early-round position prior
            if (earlyPrior && earlyPrior[p.pos] != null) {
                const pr = earlyPrior[p.pos];
                if (pr !== 1.0) {
                    score *= pr;
                    reasoning.nudges.push({ name: 'EarlyRoundPrior', pct: Math.round((pr - 1) * 100), pos: p.pos });
                }
            }

            // 2. Roster need signals
            const needIdx = needPositions.indexOf(p.pos);
            if (needIdx === 0) {
                score *= 1.25;
                reasoning.nudges.push({ name: 'PrimaryNeed', pct: 25, pos: p.pos });
                reasoning.primary = 'Primary need';
            } else if (needIdx > 0) {
                score *= 1.10;
                reasoning.nudges.push({ name: 'SecondaryNeed', pct: 10, pos: p.pos });
            }
            if (healthScore < 55 && needIdx >= 0) {
                score *= 1.15;
                reasoning.nudges.push({ name: 'DesperateHealth', pct: 15 });
            }
            if (strengthPositions.includes(p.pos) && persona.posture?.key !== 'SELLER') {
                score *= 0.85;
                reasoning.nudges.push({ name: 'StrengthPenalty', pct: -15, pos: p.pos });
            }

            // 3. Draft History DNA — pos pref
            const prefPct = posPct[p.pos] || 0;
            if (prefPct > 0) {
                const mult = 1 + (prefPct / 200);
                score *= mult;
                if (prefPct >= 20) reasoning.nudges.push({ name: 'DraftHistoryPref', pct: Math.round((mult - 1) * 100), pos: p.pos });
            }

            // 4. R1 tendency
            if (round <= 2 && r1Positions.includes(p.pos)) {
                const r1Count = r1Positions.filter(x => x === p.pos).length;
                const mult = 1 + (r1Count * 0.08);
                score *= mult;
                reasoning.nudges.push({ name: 'R1Tendency', pct: Math.round((mult - 1) * 100), pos: p.pos });
            }

            // 5. Label nudges (same as Scout)
            if (label === 'DEF-Early' && round <= 3 && ['DL','LB','DB'].includes(p.pos)) {
                score *= 1.12;
                reasoning.nudges.push({ name: 'DEF-Early label', pct: 12 });
            }
            if (label === 'QB-Hunter' && p.pos === 'QB' && round <= 2) {
                score *= 1.15;
                reasoning.nudges.push({ name: 'QB-Hunter label', pct: 15 });
            }
            if (label === 'QB-Avoider' && p.pos === 'QB' && round <= 3) {
                score *= 0.80;
                reasoning.nudges.push({ name: 'QB-Avoider label', pct: -20 });
            }
            if (label === 'TE-Premium' && p.pos === 'TE' && round <= 3) {
                score *= 1.10;
                reasoning.nudges.push({ name: 'TE-Premium label', pct: 10 });
            }

            // 6. Trade DNA nudge
            const tradeMult = tradeDnaMultiplier(persona, p, round);
            if (tradeMult !== 1.0) {
                score *= tradeMult;
                reasoning.nudges.push({ name: 'TradeDNA:' + persona.tradeDna?.key, pct: Math.round((tradeMult - 1) * 100) });
            }

            // 7. Posture nudge
            const postureMult = postureMultiplier(persona, p, round, needIdx);
            if (postureMult !== 1.0) {
                score *= postureMult;
                reasoning.nudges.push({ name: 'Posture:' + persona.posture?.key, pct: Math.round((postureMult - 1) * 100) });
            }

            // 8. Window alignment
            const winMult = windowMultiplier(persona, p, round);
            if (winMult !== 1.0) {
                score *= winMult;
                reasoning.nudges.push({ name: 'Window:' + (persona.assessment?.window || ''), pct: Math.round((winMult - 1) * 100) });
            }

            // 9. Team already rostered same position — progressive penalty
            const sameCount = teamRoster.filter(x => x === p.pos).length;
            if (sameCount >= 2) {
                score *= 0.80;
                reasoning.nudges.push({ name: 'RosterSaturation', pct: -20, pos: p.pos });
            } else if (sameCount === 1) {
                score *= 0.95;
            }

            // 10. Variance — small random perturbation so picks aren't perfectly deterministic
            const jitter = (1 - variance) + Math.random() * (variance * 2);
            score *= jitter;

            if (score > bestScore) {
                bestScore = score;
                best = p;
                bestReasoning = reasoning;
            }
        }

        if (!best) {
            // Pool thin — pick the best available regardless of floor
            best = available[0];
            bestReasoning = { primary: 'BPA fallback', baseVal: best.dhq || best.val || 0, nudges: [], bpaFloorTriggered: true };
        }

        // Confidence: score spread vs. second best (higher spread = more confident)
        let confidence = 0.5;
        if (available.length > 1) {
            const sortedScores = [];
            for (const p of available.slice(0, 10)) {
                const v = p.dhq || p.val || 0;
                sortedScores.push(v);
            }
            const s0 = sortedScores[0] || 1;
            const s1 = sortedScores[1] || 0;
            confidence = Math.max(0.4, Math.min(0.95, (s0 - s1) / s0 + 0.5));
        }

        return {
            player: best,
            confidence: Math.round(confidence * 100) / 100,
            reasoning: bestReasoning,
        };
    }

    /**
     * computePredictions — for a given persona and the current pool, determine
     * what positions they are likely to REACH for (beat BPA by DNA-driven nudges)
     * vs. PASS ON (strength penalty or DNA demotion). Also returns the single
     * most likely pick (top persona score).
     *
     * Runs personaPick-style scoring over a top-N slice of the pool (default 20)
     * and classifies each position into willReach / willPassOn / neutral.
     *
     * @param {Persona} persona
     * @param {Array<Player>} pool — sorted by DHQ desc
     * @param {number} round
     * @param {number} pickNumber
     * @returns {{ willReach: [], willPassOn: [], likelyPick: Object|null }}
     */
    function computePredictions(persona, pool, round, pickNumber) {
        if (!persona || !pool || !pool.length) {
            return { willReach: [], willPassOn: [], likelyPick: null };
        }

        const top = pool.slice(0, 20);

        // Baseline: "best DHQ" scoring with zero nudges (pure BPA order)
        const baselineScores = {};
        top.forEach(p => { baselineScores[p.pid] = p.dhq || p.val || 0; });

        // Persona-adjusted: full personaPick over same slice
        const result = personaPick(persona, top, round, pickNumber, { teamRoster: [] });
        const likelyPick = result?.player || null;

        // Per-position aggregation: mean baseline vs. mean persona score
        const posStats = {};
        const topBaseline = Math.max(...Object.values(baselineScores), 1);

        // Run personaPick internals for EACH top player (so we can diff vs baseline)
        // For efficiency we re-score here with the same logic as personaPick but
        // without the jitter, so predictions are deterministic per round.
        for (const p of top) {
            const baseline = p.dhq || p.val || 0;
            // Call personaPick with a single-player pool to get its nudge-adjusted score
            const singleResult = personaPick(persona, [p], round, pickNumber, { teamRoster: [] });
            // Deterministic approximation: sum up the nudge percentages from reasoning.nudges
            const nudges = singleResult?.reasoning?.nudges || [];
            const totalMult = nudges.reduce((m, n) => m * (1 + (n.pct || 0) / 100), 1);
            const adjusted = baseline * totalMult;

            if (!posStats[p.pos]) posStats[p.pos] = { baseline: 0, adjusted: 0, count: 0 };
            posStats[p.pos].baseline += baseline;
            posStats[p.pos].adjusted += adjusted;
            posStats[p.pos].count += 1;
        }

        // Classify positions
        const willReach = [];
        const willPassOn = [];
        Object.entries(posStats).forEach(([pos, s]) => {
            if (s.count === 0) return;
            const delta = (s.adjusted - s.baseline) / Math.max(s.baseline, 1);
            if (delta > 0.10) {
                willReach.push({ pos, delta: Math.round(delta * 100) / 100, reasoning: 'DNA/need/posture inflation' });
            } else if (delta < -0.10) {
                willPassOn.push({ pos, delta: Math.round(delta * 100) / 100, reasoning: 'strength penalty or DNA demotion' });
            }
        });

        // Sort reach/pass by magnitude
        willReach.sort((a, b) => b.delta - a.delta);
        willPassOn.sort((a, b) => a.delta - b.delta);

        return {
            willReach: willReach.slice(0, 3),
            willPassOn: willPassOn.slice(0, 3),
            likelyPick: likelyPick ? {
                pid: likelyPick.pid,
                name: likelyPick.name,
                pos: likelyPick.pos,
                dhq: likelyPick.dhq,
                confidence: result.confidence,
            } : null,
        };
    }

    window.DraftCC = window.DraftCC || {};
    window.DraftCC.cpuEngine = {
        personaPick,
        computePredictions,
    };
})();

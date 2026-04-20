// ══════════════════════════════════════════════════════════════════
// js/widgets/market-radar.js — Market Radar widget (v2)
//
// Forward-looking: trade opportunities, waiver targets, FAAB budget.
// Replaces the old backward-looking trading + waivers modules.
//
// sm: "N DEALS" hero + pulse. md: top partner + FAAB. lg: radar + waivers.
//
// Depends on: theme.js, core.js (assessTeamFromGlobal, assessAllTeamsFromGlobal)
// Exposes:    window.MarketRadarWidget
// ══════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    function MarketRadarWidget({ size, myRoster, rankedTeams, sleeperUserId, currentLeague, playersData, setActiveTab }) {
        const theme = window.WrTheme?.get?.() || {};
        const colors = theme.colors || {};
        const fonts = theme.fonts || {};
        const cardStyle = window.WrTheme?.cardStyle?.() || {};
        const fs = (rem) => window.WrTheme?.fontSize?.(rem) || (rem + 'rem');

        // ── Data ────────────────────────────────────────────────
        const myAssess = React.useMemo(() => {
            if (typeof window.assessTeamFromGlobal === 'function' && myRoster?.roster_id) {
                return window.assessTeamFromGlobal(myRoster.roster_id);
            }
            return null;
        }, [myRoster?.roster_id]);

        const allAssess = React.useMemo(() => {
            if (typeof window.assessAllTeamsFromGlobal === 'function') return window.assessAllTeamsFromGlobal() || [];
            return [];
        }, []);

        // Compute trade compatibility (simplified complementarity)
        const tradeTargets = React.useMemo(() => {
            if (!myAssess || !allAssess.length) return [];
            const myNeeds = (myAssess.needs || []).map(n => typeof n === 'string' ? n : n?.pos).filter(Boolean);
            const myStrengths = (myAssess.strengths || []).map(s => typeof s === 'string' ? s : s?.pos).filter(Boolean);
            return allAssess
                .filter(a => a.rosterId !== myRoster?.roster_id)
                .map(a => {
                    const theirNeeds = (a.needs || []).map(n => typeof n === 'string' ? n : n?.pos).filter(Boolean);
                    const theirStrengths = (a.strengths || []).map(s => typeof s === 'string' ? s : s?.pos).filter(Boolean);
                    // Complementarity: their strengths fill my needs AND my strengths fill theirs
                    const theyFillMe = theirStrengths.filter(s => myNeeds.includes(s)).length;
                    const iFillThem = myStrengths.filter(s => theirNeeds.includes(s)).length;
                    const compat = (theyFillMe + iFillThem) * 20;
                    const roster = (currentLeague?.rosters || []).find(r => r.roster_id === a.rosterId);
                    const user = roster ? (currentLeague?.users || window.S?.leagueUsers || []).find(u => u.user_id === roster.owner_id) : null;
                    const name = user?.metadata?.team_name || user?.display_name || ('Team ' + a.rosterId);
                    return { ...a, compat, name, theyFillMe, iFillThem, theirNeeds: theirNeeds.slice(0, 3), myOffers: myStrengths.filter(s => theirNeeds.includes(s)) };
                })
                .filter(a => a.compat > 0)
                .sort((a, b) => b.compat - a.compat)
                .slice(0, 5);
        }, [myAssess, allAssess, myRoster?.roster_id]);

        // FAAB
        const faab = React.useMemo(() => {
            const budget = currentLeague?.settings?.waiver_budget || 100;
            const used = myRoster?.settings?.waiver_budget_used || 0;
            const remaining = budget - used;
            const pct = (remaining / Math.max(budget, 1)) * 100;
            return { remaining, budget, pct };
        }, [currentLeague, myRoster]);

        // Waiver wire targets (un-rostered players with highest DHQ)
        const waiverTargets = React.useMemo(() => {
            const scores = window.App?.LI?.playerScores || {};
            const rostered = new Set();
            (currentLeague?.rosters || []).forEach(r => (r.players || []).forEach(pid => rostered.add(pid)));
            const available = Object.entries(scores)
                .filter(([pid]) => !rostered.has(pid) && scores[pid] > 1500)
                .map(([pid, dhq]) => {
                    const p = playersData?.[pid] || {};
                    return { pid, name: p.full_name || pid, pos: (window.App?.normPos?.(p.position) || p.position || '?'), dhq, team: p.team || 'FA' };
                })
                .sort((a, b) => b.dhq - a.dhq)
                .slice(0, 5);
            return available;
        }, [currentLeague, playersData]);

        const dealCount = tradeTargets.length;
        const dealCol = dealCount >= 3 ? colors.positive : dealCount >= 1 ? colors.accent : colors.textMuted;

        const isClickable = size === 'sm' || size === 'md';
        const onClick = () => { if (isClickable && setActiveTab) setActiveTab('trades'); };

        // ── SM: "N DEALS" hero ──
        if (size === 'sm') {
            return (
                <div onClick={onClick} style={{
                    ...cardStyle, padding: 'var(--card-pad, 14px 16px)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: fonts.mono, fontSize: fs(2.2), fontWeight: 700,
                        color: dealCol, lineHeight: 1,
                    }} className="wr-data-value">{dealCount}</div>
                    <div style={{ fontSize: fs(0.85), color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px', fontFamily: fonts.ui }}>
                        TRADE TARGETS
                    </div>
                    {dealCount > 0 && (
                        <div style={{
                            marginTop: '6px', width: 8, height: 8, borderRadius: '50%',
                            background: colors.positive, animation: 'pulse 1.4s infinite',
                        }} />
                    )}
                </div>
            );
        }

        // ── MD: top partner + FAAB ──
        if (size === 'md') {
            const top = tradeTargets[0];
            return (
                <div onClick={onClick} style={{ ...cardStyle, padding: 'var(--card-pad, 14px 16px)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1rem' }}>📡</span>
                        <span style={{ fontFamily: fonts.display, fontSize: fs(0.92), fontWeight: 700, color: colors.purple, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Market Radar</span>
                    </div>
                    {top ? (
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: fs(0.85), fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>{top.name}</div>
                            <div style={{ fontSize: fs(0.85), color: colors.textMuted, marginTop: '2px', fontFamily: fonts.ui }}>
                                wants {top.theirNeeds.join(', ') || '—'} · you have {top.myOffers.join(', ') || '—'}
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: fs(0.8), color: colors.textFaint, fontStyle: 'italic', marginBottom: '8px', fontFamily: fonts.ui }}>
                            No strong matches found
                        </div>
                    )}
                    {/* FAAB bar */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fs(0.64), color: colors.textMuted, marginBottom: '3px', fontFamily: fonts.ui }}>
                            <span>FAAB</span>
                            <span>${faab.remaining} / ${faab.budget}</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: theme.card?.radius === '0px' ? '0' : '3px', overflow: 'hidden' }}>
                            <div style={{ width: faab.pct + '%', height: '100%', background: faab.pct > 50 ? colors.positive : faab.pct > 25 ? colors.warn : colors.negative, transition: '0.3s' }} />
                        </div>
                    </div>
                </div>
            );
        }

        // ── LG / TALL: trade radar + waiver targets (enriched) ──

        // Compute best swap suggestion per partner: find a specific player from your surplus that fills their need
        const myStrengthPositions = (myAssess?.strengths || []).map(s => typeof s === 'string' ? s : s?.pos).filter(Boolean);

        // Find best swap candidates: your surplus players at positions they need
        const swapSuggestions = React.useMemo(() => {
            const scores = window.App?.LI?.playerScores || {};
            const myPlayers = (myRoster?.players || []);
            const suggestions = {};
            tradeTargets.slice(0, 4).forEach(t => {
                const theirNeeds = t.theirNeeds || [];
                // Find my best player at a position they need that I have surplus in
                const candidates = myPlayers
                    .filter(pid => {
                        const p = playersData?.[pid];
                        if (!p) return false;
                        const pos = window.App?.normPos?.(p.position) || p.position || '';
                        return theirNeeds.includes(pos) && myStrengthPositions.includes(pos);
                    })
                    .map(pid => ({ pid, name: (playersData[pid]?.full_name || '').split(' ').pop(), pos: window.App?.normPos?.(playersData[pid]?.position) || '', dhq: scores[pid] || 0 }))
                    .sort((a, b) => b.dhq - a.dhq);
                if (candidates.length) suggestions[t.rosterId || t.name] = candidates[0];
            });
            return suggestions;
        }, [tradeTargets, myRoster, playersData, myStrengthPositions]);

        // Which needs do waiver targets fill?
        const myNeedPositions = (myAssess?.needs || []).map(n => typeof n === 'string' ? n : n?.pos).filter(Boolean);

        return (
            <div style={{ ...cardStyle, padding: 'var(--card-pad, 14px 16px)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.1rem' }}>📡</span>
                    <span style={{ fontFamily: fonts.display, fontSize: fs(1.0), fontWeight: 700, color: colors.purple, letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Market Radar</span>
                    <span style={{ fontSize: fs(0.68), color: colors.textMuted }}>{dealCount} targets</span>
                </div>

                {/* Trade partners — with complementarity bar and swap suggestion */}
                <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontFamily: fonts.ui }}>Trade Partners</div>
                    {tradeTargets.slice(0, size === 'tall' ? 5 : 3).map((t, i) => {
                        const compatCol = t.compat >= 60 ? colors.positive : t.compat >= 30 ? colors.accent : colors.warn;
                        const swap = swapSuggestions[t.rosterId || t.name];
                        return (
                            <div key={i} style={{
                                padding: '6px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: fs(0.78), fontWeight: 700, color: colors.text, fontFamily: fonts.ui }}>{t.name}</div>
                                        <div style={{ fontSize: fs(0.64), color: colors.textMuted, fontFamily: fonts.ui, marginTop: '1px' }}>
                                            wants {t.theirNeeds.join(', ') || '—'} · you have {t.myOffers.join(', ') || '—'}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: fs(0.68), fontWeight: 700, color: compatCol, fontFamily: fonts.mono }}>{t.compat}%</span>
                                </div>
                                {/* Complementarity bar */}
                                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', margin: '4px 0 2px' }}>
                                    <div style={{ width: t.compat + '%', height: '100%', background: compatCol, transition: '0.3s' }} />
                                </div>
                                {/* Best swap suggestion */}
                                {swap && (
                                    <div style={{ fontSize: fs(0.64), color: colors.purple, fontFamily: fonts.ui, marginTop: '2px' }}>
                                        Swap idea: send {swap.name} ({swap.pos}) for their {t.theirNeeds[0] || '?'} depth
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {tradeTargets.length === 0 && (
                        <div style={{ fontSize: fs(0.72), color: colors.textFaint, fontStyle: 'italic', padding: '8px 0', fontFamily: fonts.ui }}>No strong complementarity matches</div>
                    )}
                </div>

                {/* Waiver wire — with need-filling context */}
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontFamily: fonts.ui }}>Waiver Wire</div>
                    {waiverTargets.slice(0, size === 'tall' ? 8 : 5).map((p, i) => {
                        const fillsNeed = myNeedPositions.includes(p.pos);
                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: fs(0.72) }}>
                                <span style={{ fontWeight: 700, color: colors.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: fonts.ui }}>{p.name}</span>
                                <span style={{ ...window.WrTheme?.badgeStyle?.(window.App?.POS_COLORS?.[p.pos] || colors.accent) || {}, fontSize: fs(0.72) }}>{p.pos}</span>
                                {fillsNeed && <span style={{ fontSize: fs(0.58), fontWeight: 700, color: colors.positive, fontFamily: fonts.ui }}>NEED</span>}
                                <span style={{ fontSize: fs(0.64), color: p.team !== 'FA' ? colors.textMuted : colors.textFaint, fontFamily: fonts.ui, minWidth: 24 }}>{p.team}</span>
                                <span style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.textMuted, fontFamily: fonts.mono }}>{p.dhq >= 1000 ? (p.dhq / 1000).toFixed(1) + 'k' : p.dhq}</span>
                            </div>
                        );
                    })}
                    {waiverTargets.length === 0 && (
                        <div style={{ fontSize: fs(0.72), color: colors.textFaint, fontStyle: 'italic', fontFamily: fonts.ui }}>Wire is clean</div>
                    )}
                </div>

                {/* FAAB */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: fs(0.64), color: colors.textMuted, marginBottom: '3px', fontFamily: fonts.ui }}>
                        <span>FAAB BUDGET</span>
                        <span>${faab.remaining} / ${faab.budget} ({Math.round(faab.pct)}%)</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: theme.card?.radius === '0px' ? '0' : '3px', overflow: 'hidden' }}>
                        <div style={{ width: faab.pct + '%', height: '100%', background: faab.pct > 50 ? colors.positive : faab.pct > 25 ? colors.warn : colors.negative, transition: '0.3s' }} />
                    </div>
                </div>
            </div>
        );
    }

    window.MarketRadarWidget = MarketRadarWidget;
})();

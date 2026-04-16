// ══════════════════════════════════════════════════════════════════
// js/widgets/draft-capital.js — Draft Capital widget (v2)
//
// Forward-looking: pick inventory, values, draft countdown.
// sm: total pick value hero. md: pick pills + countdown. lg: + value chart.
//
// Depends on: theme.js, core.js (PlayerValue, S.tradedPicks)
// Exposes:    window.DraftCapitalWidget
// ══════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    function DraftCapitalWidget({ size, myRoster, currentLeague, playersData, briefDraftInfo, setActiveTab }) {
        const theme = window.WrTheme?.get?.() || {};
        const colors = theme.colors || {};
        const fonts = theme.fonts || {};
        const cardStyle = window.WrTheme?.cardStyle?.() || {};
        const fs = (rem) => window.WrTheme?.fontSize?.(rem) || (rem + 'rem');

        const myRid = myRoster?.roster_id;
        const season = String(currentLeague?.season || new Date().getFullYear());
        const draftRounds = currentLeague?.settings?.draft_rounds || 5;
        const totalTeams = currentLeague?.rosters?.length || 12;
        const tradedPicks = window.S?.tradedPicks || [];

        // ── Pick inventory ──────────────────────────────────────
        const picks = React.useMemo(() => {
            const inv = [];
            const pvFn = window.App?.PlayerValue?.getPickValue;
            for (let yr = parseInt(season); yr <= parseInt(season) + 2; yr++) {
                for (let rd = 1; rd <= draftRounds; rd++) {
                    // Check if we traded this pick away
                    const tradedAway = tradedPicks.find(p =>
                        parseInt(p.season) === yr && p.round === rd &&
                        p.roster_id === myRid && p.owner_id !== myRid
                    );
                    if (tradedAway) continue;

                    // Check if we acquired picks at this round from others
                    const acquired = tradedPicks.filter(p =>
                        parseInt(p.season) === yr && p.round === rd &&
                        p.owner_id === myRid && p.roster_id !== myRid
                    );

                    // Own pick (not traded away)
                    if (!tradedAway) {
                        const val = pvFn ? pvFn(yr, rd, totalTeams, Math.ceil(totalTeams / 2)) : Math.max(500, 10000 - rd * 2000);
                        inv.push({ year: yr, round: rd, own: true, value: val, label: yr === parseInt(season) ? 'R' + rd : "'" + String(yr).slice(-2) + ' R' + rd });
                    }

                    // Acquired picks
                    acquired.forEach(a => {
                        const fromRoster = (currentLeague?.rosters || []).find(r => r.roster_id === a.roster_id);
                        const fromUser = fromRoster ? (window.S?.leagueUsers || []).find(u => u.user_id === fromRoster.owner_id) : null;
                        const fromName = fromUser?.display_name || ('T' + a.roster_id);
                        const val = pvFn ? pvFn(yr, rd, totalTeams, Math.ceil(totalTeams / 2)) : Math.max(500, 10000 - rd * 2000);
                        inv.push({ year: yr, round: rd, own: false, from: fromName, value: val, label: (yr === parseInt(season) ? '' : "'" + String(yr).slice(-2) + ' ') + 'R' + rd + ' (' + fromName.slice(0, 6) + ')' });
                    });
                }
            }
            return inv;
        }, [myRid, season, draftRounds, totalTeams, tradedPicks]);

        const totalValue = picks.reduce((s, p) => s + (p.value || 0), 0);
        const pickCount = picks.length;
        const maxRoundVal = Math.max(...picks.map(p => p.value || 0), 1);

        // Draft countdown
        const countdown = React.useMemo(() => {
            if (!briefDraftInfo?.start_time || briefDraftInfo.status !== 'pre_draft') return null;
            const diff = briefDraftInfo.start_time - Date.now();
            if (diff <= 0) return { text: 'DRAFT IS LIVE', live: true };
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            return { text: days > 0 ? days + 'd ' + hours + 'h' : hours + 'h', live: false };
        }, [briefDraftInfo]);

        const valCol = totalValue >= 20000 ? colors.positive : totalValue >= 10000 ? colors.accent : colors.negative;
        const isClickable = size === 'sm' || size === 'md';
        const onClick = () => { if (isClickable && setActiveTab) setActiveTab('draft'); };

        // ── SM: total value hero ──
        if (size === 'sm') {
            return (
                <div onClick={onClick} style={{
                    ...cardStyle, padding: '14px 12px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: fonts.mono, fontSize: fs(1.6), fontWeight: 700,
                        color: valCol, lineHeight: 1,
                    }} className="wr-data-value">
                        {totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + 'k' : totalValue}
                    </div>
                    <div style={{ fontSize: fs(0.85), color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '4px', fontFamily: fonts.ui }}>
                        {pickCount} PICKS
                    </div>
                    {countdown && (
                        <div style={{
                            marginTop: '6px', fontSize: fs(0.64),
                            color: countdown.live ? colors.positive : colors.accent,
                            fontWeight: 700, fontFamily: fonts.ui,
                        }}>{countdown.text}</div>
                    )}
                </div>
            );
        }

        // ── MD: pick pills + countdown ──
        if (size === 'md') {
            return (
                <div onClick={onClick} style={{ ...cardStyle, padding: '14px 16px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1rem' }}>🎯</span>
                        <span style={{ fontFamily: fonts.display, fontSize: fs(0.92), fontWeight: 700, color: colors.warn, letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Draft Capital</span>
                        {countdown && <span style={{ fontSize: fs(0.68), color: countdown.live ? colors.positive : colors.accent, fontWeight: 700, fontFamily: fonts.ui }}>{countdown.text}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {picks.slice(0, 10).map((p, i) => {
                            const pct = (p.value / maxRoundVal) * 100;
                            return (
                                <div key={i} style={{
                                    position: 'relative', overflow: 'hidden',
                                    padding: '3px 8px', fontSize: fs(0.68), fontWeight: 700,
                                    borderRadius: theme.card?.radius === '0px' ? '0' : '4px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid ' + (p.own ? 'rgba(255,255,255,0.08)' : colors.accent + '44'),
                                    color: p.own ? colors.text : colors.accent,
                                    fontFamily: fonts.ui,
                                }}>
                                    {/* Value bar behind text */}
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: colors.accent + '12', transition: '0.3s' }} />
                                    <span style={{ position: 'relative', zIndex: 1 }}>{p.label}</span>
                                </div>
                            );
                        })}
                        {picks.length > 10 && <span style={{ fontSize: fs(0.64), color: colors.textFaint, alignSelf: 'center' }}>+{picks.length - 10}</span>}
                    </div>
                    <div style={{ fontSize: fs(0.85), color: colors.textMuted, fontFamily: fonts.mono }}>
                        Total: {totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + 'k' : totalValue} DHQ value · {pickCount} picks
                    </div>
                </div>
            );
        }

        // ── LG / TALL: full inventory with league rank, year groups, equivalents ──

        // League capital rank — sum each team's pick value
        const leagueCapitalRank = React.useMemo(() => {
            const allRosters = currentLeague?.rosters || [];
            const leagueSeason = parseInt(currentLeague?.season) || new Date().getFullYear();
            const allTeamCap = allRosters.map(r => {
                let cap = 0;
                for (let yr = leagueSeason; yr <= leagueSeason + 2; yr++) {
                    for (let rd = 1; rd <= draftRounds; rd++) {
                        const pv = typeof window.getIndustryPickValue === 'function'
                            ? window.getIndustryPickValue((rd - 1) * totalTeams + Math.ceil(totalTeams / 2), totalTeams, draftRounds)
                            : window.App?.PlayerValue?.getPickValue?.(yr, rd, totalTeams) || 0;
                        const tradedAway = (tradedPicks || []).find(p => parseInt(p.season) === yr && p.round === rd && p.roster_id === r.roster_id && p.owner_id !== r.roster_id);
                        if (!tradedAway) cap += pv;
                        const acquired = (tradedPicks || []).filter(p => parseInt(p.season) === yr && p.round === rd && p.owner_id === r.roster_id && p.roster_id !== r.roster_id);
                        acquired.forEach(() => { cap += pv; });
                    }
                }
                return { rid: r.roster_id, cap };
            }).sort((a, b) => b.cap - a.cap);
            const rank = allTeamCap.findIndex(t => t.rid === myRid) + 1;
            return { rank: rank || '—', total: allTeamCap.length };
        }, [currentLeague, draftRounds, totalTeams, tradedPicks, myRid]);

        // Group picks by year
        const picksByYear = React.useMemo(() => {
            const groups = {};
            picks.forEach(p => {
                const yr = p.year || p.season || 'Unknown';
                if (!groups[yr]) groups[yr] = [];
                groups[yr].push(p);
            });
            return Object.entries(groups).sort((a, b) => a[0] - b[0]);
        }, [picks]);

        // Pick value equivalent label
        const pickEquiv = (val) => {
            if (val >= 7000) return 'QB1 / RB1';
            if (val >= 5000) return 'WR1 / RB1';
            if (val >= 3000) return 'starter';
            if (val >= 1500) return 'flex';
            if (val >= 500) return 'depth';
            return '';
        };

        return (
            <div style={{ ...cardStyle, padding: '14px 16px', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🎯</span>
                    <span style={{ fontFamily: fonts.display, fontSize: fs(1.0), fontWeight: 700, color: colors.warn, letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Draft Capital</span>
                    {countdown && (
                        <span style={{
                            fontSize: fs(0.72), fontWeight: 700,
                            color: countdown.live ? colors.positive : colors.accent,
                            fontFamily: fonts.ui,
                        }}>{countdown.live ? '🔴 ' : ''}{countdown.text}</span>
                    )}
                </div>

                {/* League capital rank badge */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    marginBottom: '10px', padding: '6px 10px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid ' + (colors.border || 'rgba(255,255,255,0.06)'),
                    borderRadius: theme.card?.radius === '0px' ? '0' : '6px',
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: fonts.mono, fontSize: fs(1.2), fontWeight: 700, color: valCol, lineHeight: 1 }} className="wr-data-value">
                            {totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + 'k' : totalValue}
                        </div>
                        <div style={{ fontSize: fs(0.58), color: colors.textMuted, fontFamily: fonts.ui }}>TOTAL DHQ</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: fonts.mono, fontSize: fs(1.2), fontWeight: 700, color: colors.accent, lineHeight: 1 }}>#{leagueCapitalRank.rank}</div>
                        <div style={{ fontSize: fs(0.58), color: colors.textMuted, fontFamily: fonts.ui }}>OF {leagueCapitalRank.total}</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: fonts.mono, fontSize: fs(1.2), fontWeight: 700, color: colors.text, lineHeight: 1 }}>{pickCount}</div>
                        <div style={{ fontSize: fs(0.58), color: colors.textMuted, fontFamily: fonts.ui }}>PICKS</div>
                    </div>
                </div>

                {/* Pick inventory grouped by year */}
                <div style={{ marginBottom: '8px', flex: 1 }}>
                    {picksByYear.map(([year, yearPicks], yi) => {
                        const yearTotal = yearPicks.reduce((s, p) => s + (p.value || 0), 0);
                        return (
                            <div key={year} style={{ marginBottom: yi < picksByYear.length - 1 ? '8px' : 0 }}>
                                {/* Year header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: fs(0.68), fontWeight: 700, color: colors.accent, fontFamily: fonts.ui }}>{year}</span>
                                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                                    <span style={{ fontSize: fs(0.58), color: colors.textMuted, fontFamily: fonts.mono }}>
                                        {yearTotal >= 1000 ? (yearTotal / 1000).toFixed(1) + 'k' : yearTotal}
                                    </span>
                                </div>
                                {yearPicks.map((p, i) => {
                                    const equiv = pickEquiv(p.value);
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0',
                                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                                        }}>
                                            <span style={{ fontSize: fs(0.72), fontWeight: 700, color: p.own ? colors.text : colors.accent, minWidth: 70, fontFamily: fonts.ui }}>
                                                {p.label}
                                            </span>
                                            {!p.own && <span style={{ fontSize: fs(0.54), fontWeight: 700, color: colors.purple, fontFamily: fonts.ui, padding: '0 4px', background: colors.purple + '18', borderRadius: 3 }}>TRADE</span>}
                                            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ width: ((p.value / maxRoundVal) * 100) + '%', height: '100%', background: p.round <= 2 ? colors.accent : colors.textMuted + '66', transition: '0.3s' }} />
                                            </div>
                                            <span style={{ fontSize: fs(0.62), fontWeight: 700, color: colors.textMuted, minWidth: 32, textAlign: 'right', fontFamily: fonts.mono }}>
                                                {p.value >= 1000 ? (p.value / 1000).toFixed(1) + 'k' : p.value}
                                            </span>
                                            {equiv && <span style={{ fontSize: fs(0.54), color: colors.textFaint, fontFamily: fonts.ui, minWidth: 44 }}>{equiv}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    window.DraftCapitalWidget = DraftCapitalWidget;
})();

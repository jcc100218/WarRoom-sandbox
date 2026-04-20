// ══════════════════════════════════════════════════════════════════
// js/widgets/roster-pulse.js — Roster Pulse widget (v2 dashboard)
//
// Merges the old "Roster Health" + "Competitive" modules into one
// vital-signs dashboard. Every size is actionable and visually rich.
//
// sm: Health score hero + tier badge + trend arrow → clicks to My Roster
// md: Health + sparkline (all teams) + contender rank + window → clicks to My Roster
// lg: 6-card vital signs grid + mini positional breakdown → drill-down panel
// tall: lg + aging curve chart + roster composition + recommendations → drill-down
//
// Depends on: theme.js (WrTheme), core.js (assessTeamFromGlobal, LI)
// Exposes:    window.RosterPulseWidget
// ══════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    function RosterPulseWidget({ size, myRoster, rankedTeams, sleeperUserId, currentLeague, playersData, computeKpiValue, setActiveTab }) {
        const theme = window.WrTheme?.get?.() || {};
        const colors = theme.colors || {};
        const fonts = theme.fonts || {};
        const cardStyle = window.WrTheme?.cardStyle?.() || {};
        const fs = (rem) => window.WrTheme?.fontSize?.(rem) || (rem + 'rem');

        // ── Data ────────────────────────────────────────────────
        const assess = React.useMemo(() => {
            if (typeof window.assessTeamFromGlobal === 'function' && myRoster?.roster_id) {
                return window.assessTeamFromGlobal(myRoster.roster_id);
            }
            return null;
        }, [myRoster?.roster_id]);

        const allAssess = React.useMemo(() => {
            if (typeof window.assessAllTeamsFromGlobal === 'function') {
                return window.assessAllTeamsFromGlobal() || [];
            }
            return [];
        }, []);

        const health = assess?.healthScore || 0;
        const tier = assess?.tier || '—';
        const needs = assess?.needs || [];
        const strengths = assess?.strengths || [];
        const window_ = assess?.window || '—';

        // KPI values
        const kv = (key) => { try { return computeKpiValue(key); } catch { return { value: '—', color: colors.textMuted }; } };
        const healthKv = kv('health-score');
        const eliteKv = kv('elite-count');
        const contenderKv = kv('contender-rank');
        const dynastyKv = kv('dynasty-rank');
        const windowKv = kv('window');
        const cliffKv = kv('aging-cliff');

        // Sparkline data: all teams' health scores sorted for the mini chart
        const healthSparkData = React.useMemo(() => {
            return allAssess
                .map(a => a.healthScore || 0)
                .sort((a, b) => b - a);
        }, [allAssess]);

        const myRankIdx = React.useMemo(() => {
            const sorted = [...healthSparkData].sort((a, b) => b - a);
            return sorted.indexOf(health);
        }, [healthSparkData, health]);

        // Health color
        const healthCol = health >= 80 ? colors.positive : health >= 60 ? colors.accent : health >= 40 ? colors.warn : colors.negative;

        // Tier color
        const tierCol = tier === 'ELITE' ? colors.positive : tier === 'CONTENDER' ? colors.accent : tier === 'CROSSROADS' ? colors.warn : colors.negative;

        // Click handler
        const onClick = () => {
            if ((size === 'sm' || size === 'md') && setActiveTab) {
                setActiveTab('myteam');
            }
        };

        const isClickable = size === 'sm' || size === 'md';

        // ── SM (1×1): Health score hero ──────────────────────────
        if (size === 'sm') {
            return (
                <div onClick={onClick} style={{
                    ...cardStyle,
                    padding: 'var(--card-pad, 14px 16px)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: fonts.mono,
                        fontSize: fs(2.2),
                        fontWeight: 700,
                        color: healthCol,
                        lineHeight: 1,
                        textShadow: theme.effects?.glow ? '0 0 8px ' + healthCol : 'none',
                    }} className="wr-data-value">
                        {health}
                    </div>
                    <div style={{
                        fontSize: fs(0.85),
                        color: colors.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginTop: '4px',
                        fontFamily: fonts.ui,
                    }}>HEALTH</div>
                    <div style={{
                        marginTop: '6px',
                        fontSize: fs(0.72),
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: theme.card?.radius === '0px' ? '0' : '10px',
                        background: tierCol + '18',
                        color: tierCol,
                        border: '1px solid ' + tierCol + '44',
                        fontFamily: fonts.ui,
                    }}>{tier}</div>
                </div>
            );
        }

        // ── MD (2×1): Health + sparkline + rank + window ─────────
        if (size === 'md') {
            return (
                <div onClick={onClick} style={{
                    ...cardStyle,
                    padding: 'var(--card-pad, 14px 16px)',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                }}>
                    {/* Left: health hero */}
                    <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 60 }}>
                        <div style={{
                            fontFamily: fonts.mono,
                            fontSize: fs(2.0),
                            fontWeight: 700,
                            color: healthCol,
                            lineHeight: 1,
                        }} className="wr-data-value">{health}</div>
                        <div style={{ fontSize: fs(0.64), color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px', fontFamily: fonts.ui }}>HEALTH</div>
                    </div>

                    {/* Center: sparkline (all teams' health, yours highlighted) */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <MiniBarChart data={healthSparkData} highlight={health} colors={colors} fonts={fonts} fs={fs} height={42} />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                            <Badge label={contenderKv.value} color={contenderKv.color || colors.accent} theme={theme} />
                            <Badge label={windowKv.value + ' window'} color={windowKv.color || colors.textMuted} theme={theme} />
                            <Badge label={tier} color={tierCol} theme={theme} />
                        </div>
                    </div>
                </div>
            );
        }

        // ── LG / TALL (2×2+): Vital signs grid with league context ──
        if (size === 'lg' || size === 'tall' || size === 'xxl') {
            // Compute league ranks for each vital
            const leagueTotal = (currentLeague?.rosters || []).length || 1;
            const healthRank = [...allAssess].sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0)).findIndex(a => a.rosterId === myRoster?.roster_id) + 1;

            const vitals = [
                { label: 'HEALTH', value: healthKv.value, color: healthKv.color || healthCol, sub: tier, rank: healthRank || '—' },
                { label: 'ELITES', value: eliteKv.value, color: eliteKv.color || colors.positive, sub: '', rank: '' },
                { label: 'CONTENDER', value: contenderKv.value, color: contenderKv.color || colors.accent, sub: contenderKv.sub || '', rank: '' },
                { label: 'DYNASTY', value: dynastyKv.value, color: dynastyKv.color || colors.accent, sub: dynastyKv.sub || '', rank: '' },
                { label: 'WINDOW', value: windowKv.value, color: windowKv.color || colors.warn, sub: '', rank: '' },
                { label: 'AGING CLIFF', value: cliffKv.value, color: cliffKv.color || colors.negative, sub: '', rank: '' },
            ];

            // Position-level breakdown: starters owned vs ideal by position
            const posBreakdown = React.useMemo(() => {
                const scores = window.App?.LI?.playerScores || {};
                const posAssess = assess?.posAssessment || {};
                const idealRoster = window.App?.LI?.idealRoster || window.App?.PlayerValue?.IDEAL_ROSTER || { QB: 3, RB: 7, WR: 7, TE: 4, K: 2, DL: 7, LB: 6, DB: 6 };
                const posOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'DB'];
                return posOrder.map(pos => {
                    const pa = posAssess[pos];
                    const status = pa?.status || 'ok';
                    const count = pa?.count || 0;
                    const ideal = idealRoster[pos] || 3;
                    const topDHQ = pa?.topDHQ || 0;
                    return { pos, count, ideal, status, topDHQ };
                }).filter(p => p.ideal > 0);
            }, [assess]);

            return (
                <div style={{ ...cardStyle, padding: 'var(--card-pad, 14px 16px)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '1.1rem' }}>💊</span>
                        <span style={{ fontFamily: fonts.display, fontSize: fs(1.0), fontWeight: 700, color: colors.accent, letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>Roster Pulse</span>
                        <Badge label={tier} color={tierCol} theme={theme} />
                    </div>

                    {/* Vital signs grid — now with league rank context */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '8px',
                        marginBottom: '12px',
                    }}>
                        {vitals.map((v, i) => (
                            <div key={i} style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid ' + (colors.border || 'rgba(255,255,255,0.06)'),
                                borderRadius: theme.card?.radius === '0px' ? '0' : '6px',
                                padding: '8px 6px',
                                textAlign: 'center',
                            }}>
                                <div style={{
                                    fontFamily: fonts.mono,
                                    fontSize: fs(1.1),
                                    fontWeight: 700,
                                    color: v.color,
                                    lineHeight: 1.1,
                                }} className="wr-data-value">{v.value}</div>
                                <div style={{
                                    fontSize: fs(0.72),
                                    color: colors.textMuted,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    marginTop: '3px',
                                    fontFamily: fonts.ui,
                                }}>{v.label}</div>
                                {v.sub && <div style={{ fontSize: fs(0.64), color: colors.textFaint, marginTop: '1px', fontFamily: fonts.ui }}>{v.sub}</div>}
                            </div>
                        ))}
                    </div>

                    {/* Position breakdown — starters vs ideal with colored bars */}
                    <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontFamily: fonts.ui }}>Position Health</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                            {posBreakdown.map((p, i) => {
                                const pct = Math.min(100, (p.count / Math.max(p.ideal, 1)) * 100);
                                const barCol = p.status === 'surplus' ? colors.positive : p.status === 'deficit' ? colors.negative : p.status === 'thin' ? colors.warn : 'rgba(255,255,255,0.25)';
                                return (
                                    <div key={i} style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: fs(0.64), fontWeight: 700, color: barCol, fontFamily: fonts.ui }}>{p.pos}</div>
                                        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', margin: '2px 0' }}>
                                            <div style={{ width: pct + '%', height: '100%', background: barCol, transition: '0.3s' }} />
                                        </div>
                                        <div style={{ fontSize: fs(0.58), color: colors.textFaint, fontFamily: fonts.mono }}>{p.count}/{p.ideal}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Needs + Strengths side by side */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                        {needs.length > 0 && (
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.negative, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontFamily: fonts.ui }}>Needs</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {needs.slice(0, 4).map((n, i) => {
                                        const pos = typeof n === 'string' ? n : n?.pos;
                                        const urgency = typeof n === 'object' ? n?.urgency : null;
                                        const col = urgency === 'deficit' ? colors.negative : colors.warn;
                                        return <Badge key={i} label={pos + (urgency === 'deficit' ? '!' : '')} color={col} theme={theme} />;
                                    })}
                                </div>
                            </div>
                        )}
                        {strengths.length > 0 && (
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.positive, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontFamily: fonts.ui }}>Strengths</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {strengths.slice(0, 4).map((s, i) => {
                                        const pos = typeof s === 'string' ? s : s?.pos;
                                        return <Badge key={i} label={pos || '—'} color={colors.positive} theme={theme} />;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mini health sparkline */}
                    <div style={{ flex: 1, minHeight: 36 }}>
                        <MiniBarChart data={healthSparkData} highlight={health} colors={colors} fonts={fonts} fs={fs} height={32} />
                        <div style={{ fontSize: fs(0.64), color: colors.textFaint, marginTop: '2px', fontFamily: fonts.ui }}>
                            League health distribution · you: {health}{healthRank ? ' (#' + healthRank + ')' : ''}
                        </div>
                    </div>

                    {/* Tall/XXL extras: actionable recommendation based on actual team state */}
                    {(size === 'tall' || size === 'xxl') && (
                        <div style={{
                            marginTop: '10px',
                            padding: '10px 12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid ' + (colors.border || 'rgba(255,255,255,0.06)'),
                            borderRadius: theme.card?.radius === '0px' ? '0' : '6px',
                        }}>
                            <div style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontFamily: fonts.ui }}>Action Plan</div>
                            <div style={{ fontSize: fs(0.78), color: colors.textMuted, lineHeight: 1.5, fontFamily: fonts.ui }}>
                                {(() => {
                                    const topNeed = needs[0];
                                    const topNeedPos = topNeed ? (typeof topNeed === 'string' ? topNeed : topNeed?.pos) : null;
                                    const topNeedUrgency = typeof topNeed === 'object' ? topNeed?.urgency : null;
                                    const topStrength = strengths[0];
                                    const topStrPos = topStrength ? (typeof topStrength === 'string' ? topStrength : topStrength?.pos) : null;
                                    if (tier === 'ELITE') return 'Protect your core. ' + (topNeedPos ? 'Surgical upgrade at ' + topNeedPos + ' would lock in your window.' : 'No critical needs — stay disciplined.');
                                    if (tier === 'CONTENDER') return (topNeedPos && topNeedUrgency === 'deficit' ? topNeedPos + ' is your biggest hole — fill it now or risk a first-round exit.' : 'Close to elite. ') + (topStrPos ? ' Your ' + topStrPos + ' depth gives you trade leverage.' : '');
                                    if (tier === 'CROSSROADS') return 'Decision time. ' + (topNeedPos ? 'You need ' + topNeedPos + ' help badly. ' : '') + (topStrPos ? 'Sell ' + topStrPos + ' surplus for picks if you\'re rebuilding, or buy a ' + (topNeedPos || 'starter') + ' if you\'re pushing.' : 'Commit one direction or the other.');
                                    return 'Rebuild mode. Accumulate picks and youth. ' + (topStrPos ? 'Shop your ' + topStrPos + ' depth for draft capital.' : 'Patience pays.');
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        return null;
    }

    // ── Shared sub-components ─────────────────────────────────────

    function MiniBarChart({ data, highlight, colors, fonts, fs, height = 40 }) {
        if (!data || !data.length) return null;
        const max = Math.max(...data, 1);
        const barW = Math.max(2, Math.min(8, Math.floor(200 / data.length)));
        return (
            <svg width="100%" height={height} viewBox={'0 0 ' + (data.length * (barW + 1)) + ' ' + height} preserveAspectRatio="none" style={{ display: 'block' }}>
                {data.map((v, i) => {
                    const h = (v / max) * (height - 2);
                    const isMe = v === highlight;
                    return (
                        <rect
                            key={i}
                            x={i * (barW + 1)}
                            y={height - h - 1}
                            width={barW}
                            height={h}
                            rx={barW > 3 ? 1 : 0}
                            fill={isMe ? (colors.accent || '#D4AF37') : 'rgba(255,255,255,0.12)'}
                            opacity={isMe ? 1 : 0.6}
                        >
                            {isMe && <title>Your health: {v}</title>}
                        </rect>
                    );
                })}
            </svg>
        );
    }

    function Badge({ label, color, theme }) {
        const t = theme || {};
        return (
            <span style={{
                fontSize: window.WrTheme?.fontSize?.(0.72) || '0.72rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: t.card?.radius === '0px' ? '0' : '10px',
                background: (color || '#D4AF37') + '18',
                color: color || '#D4AF37',
                border: '1px solid ' + (color || '#D4AF37') + '44',
                fontFamily: t.fonts?.ui || 'DM Sans, sans-serif',
                whiteSpace: 'nowrap',
            }}>{label}</span>
        );
    }

    window.RosterPulseWidget = RosterPulseWidget;
})();

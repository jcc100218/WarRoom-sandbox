// ══════════════════════════════════════════════════════════════════
// js/widgets/league-landscape.js — League Landscape widget (v2)
//
// Merges standings + transaction ticker + competitive context.
// md: compact power rankings. lg: standings + activity. tall: + movers.
//
// Depends on: theme.js, core.js (assessAllTeamsFromGlobal)
// Exposes:    window.LeagueLandscapeWidget
// ══════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    function LeagueLandscapeWidget({ size, standings, transactions, rankedTeams, sleeperUserId, currentLeague, playersData, setActiveTab, getOwnerName, getPlayerName, timeAgo }) {
        const theme = window.WrTheme?.get?.() || {};
        const colors = theme.colors || {};
        const fonts = theme.fonts || {};
        const cardStyle = window.WrTheme?.cardStyle?.() || {};
        const fs = (rem) => window.WrTheme?.fontSize?.(rem) || (rem + 'rem');

        const allAssess = React.useMemo(() => {
            if (typeof window.assessAllTeamsFromGlobal === 'function') return window.assessAllTeamsFromGlobal() || [];
            return [];
        }, []);

        // Power rankings: sort by healthScore desc
        const powerRanked = React.useMemo(() => {
            return [...allAssess].sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0));
        }, [allAssess]);

        // Recent transactions
        const recentTx = React.useMemo(() => {
            if (!Array.isArray(transactions)) return [];
            return transactions.slice(0, size === 'md' ? 0 : size === 'lg' ? 3 : 5);
        }, [transactions, size]);

        const isClickable = size === 'sm' || size === 'md';
        const onClick = () => { if (isClickable && setActiveTab) setActiveTab('league'); };

        // Tier color
        const tierCol = (tier) => tier === 'ELITE' ? colors.positive : tier === 'CONTENDER' ? colors.accent : tier === 'CROSSROADS' ? colors.warn : colors.negative;

        // ── SM: league rank hero ──
        if (size === 'sm') {
            const myRank = powerRanked.findIndex(a => a.rosterId && (currentLeague?.rosters || []).find(r => r.roster_id === a.rosterId)?.owner_id === sleeperUserId) + 1;
            const total = powerRanked.length || 1;
            const rankCol = myRank <= 3 ? colors.positive : myRank <= Math.ceil(total / 2) ? colors.accent : colors.negative;
            return (
                <div onClick={onClick} style={{
                    ...cardStyle, padding: 'var(--card-pad, 14px 16px)', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center',
                }}>
                    <div style={{
                        fontFamily: fonts.mono, fontSize: fs(1.8), fontWeight: 700,
                        color: rankCol, lineHeight: 1,
                    }} className="wr-data-value">
                        #{myRank || '—'}
                    </div>
                    <div style={{ fontSize: fs(0.68), color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px', fontFamily: fonts.ui }}>
                        of {total}
                    </div>
                    <div style={{ fontSize: fs(0.64), color: colors.textFaint, marginTop: '4px', fontFamily: fonts.ui }}>
                        {transactions ? transactions.length + ' moves' : ''}
                    </div>
                </div>
            );
        }

        // ── MD: compact power rankings ──
        if (size === 'md') {
            const top5 = powerRanked.slice(0, 5);
            const maxH = Math.max(...top5.map(a => a.healthScore || 0), 1);
            return (
                <div onClick={onClick} style={{ ...cardStyle, padding: 'var(--card-pad, 14px 16px)', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '1rem' }}>🌐</span>
                        <span style={{ fontFamily: fonts.display, fontSize: fs(0.92), fontWeight: 700, color: colors.accent, letterSpacing: '0.07em', textTransform: 'uppercase' }}>League Landscape</span>
                    </div>
                    {top5.map((a, i) => {
                        const isMe = a.rosterId && (currentLeague?.rosters || []).find(r => r.roster_id === a.rosterId)?.owner_id === sleeperUserId;
                        const name = getOwnerName ? getOwnerName(a.rosterId) : ('Team ' + (i + 1));
                        const pct = ((a.healthScore || 0) / maxH) * 100;
                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{ fontSize: fs(0.85), color: i < 3 ? colors.accent : colors.textMuted, fontWeight: 700, width: 14, textAlign: 'right', fontFamily: fonts.mono }}>{i + 1}</span>
                                <div style={{ flex: 1, minWidth: 0, position: 'relative', height: 16, borderRadius: theme.card?.radius === '0px' ? '0' : '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                                    <div style={{ width: pct + '%', height: '100%', background: isMe ? colors.accent : 'rgba(255,255,255,0.15)', borderRadius: 'inherit', transition: '0.3s' }} />
                                    <span style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', fontSize: fs(0.64), fontWeight: isMe ? 800 : 500, color: isMe ? colors.text : colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%', fontFamily: fonts.ui }}>{isMe ? '★ ' : ''}{(name || '').slice(0, 14)}</span>
                                </div>
                                <span style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.textMuted, minWidth: 20, textAlign: 'right', fontFamily: fonts.mono }}>{a.healthScore || 0}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }

        // ── LG / TALL / XL / XXL: standings + tier summary + activity ──
        const showTx = size !== 'md';
        const showMore = size === 'tall' || size === 'xl' || size === 'xxl';
        const top = (size === 'xl' || size === 'xxl') ? powerRanked : powerRanked.slice(0, showMore ? 12 : 8);

        // Tier distribution summary
        const tierDist = React.useMemo(() => {
            const dist = { ELITE: 0, CONTENDER: 0, CROSSROADS: 0, REBUILDING: 0 };
            powerRanked.forEach(a => { if (dist[a.tier] !== undefined) dist[a.tier]++; else dist.CROSSROADS++; });
            return dist;
        }, [powerRanked]);

        // My rank + gap to rank above
        const myRankData = React.useMemo(() => {
            const scores = window.App?.LI?.playerScores || {};
            const allDHQ = powerRanked.map((a, i) => {
                const roster = (currentLeague?.rosters || []).find(r => r.roster_id === a.rosterId);
                const dhq = (roster?.players || []).reduce((s, pid) => s + (scores[pid] || 0), 0);
                const isMe = roster?.owner_id === sleeperUserId;
                return { rank: i + 1, dhq, isMe, name: getOwnerName ? getOwnerName(a.rosterId) : 'Team ' + (i + 1) };
            });
            const me = allDHQ.find(t => t.isMe);
            if (!me) return { rank: '—', gap: 0, aheadName: '' };
            const ahead = allDHQ.find(t => t.rank === me.rank - 1);
            return { rank: me.rank, dhq: me.dhq, gap: ahead ? ahead.dhq - me.dhq : 0, aheadName: ahead?.name || '' };
        }, [powerRanked, currentLeague, sleeperUserId, getOwnerName]);

        return (
            <div style={{ ...cardStyle, padding: 'var(--card-pad, 14px 16px)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🌐</span>
                    <span style={{ fontFamily: fonts.display, fontSize: fs(1.0), fontWeight: 700, color: colors.accent, letterSpacing: '0.07em', textTransform: 'uppercase', flex: 1 }}>League Landscape</span>
                    {transactions && <span style={{ fontSize: fs(0.68), color: colors.textMuted, fontFamily: fonts.ui }}>{transactions.length} moves</span>}
                </div>

                {/* Tier distribution summary */}
                <div style={{
                    display: 'flex', gap: '8px', marginBottom: '10px', padding: '6px 8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid ' + (colors.border || 'rgba(255,255,255,0.06)'),
                    borderRadius: theme.card?.radius === '0px' ? '0' : '6px',
                    flexWrap: 'wrap',
                }}>
                    {Object.entries(tierDist).filter(([, n]) => n > 0).map(([t, n]) => (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: 6, height: 6, borderRadius: 3, background: tierCol(t) }} />
                            <span style={{ fontSize: fs(0.62), fontWeight: 700, color: tierCol(t), fontFamily: fonts.ui }}>{n}</span>
                            <span style={{ fontSize: fs(0.58), color: colors.textFaint, fontFamily: fonts.ui }}>{t.slice(0, 5)}</span>
                        </div>
                    ))}
                    {myRankData.gap > 0 && (
                        <div style={{ marginLeft: 'auto', fontSize: fs(0.62), color: colors.textMuted, fontFamily: fonts.ui }}>
                            {(myRankData.gap / 1000).toFixed(1)}k behind #{myRankData.rank - 1}
                        </div>
                    )}
                </div>

                {/* Standings table — with roster DHQ column */}
                <div style={{ marginBottom: showTx ? '10px' : 0 }}>
                    {/* Column headers */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ width: 16 }} />
                        <span style={{ flex: 1, fontSize: fs(0.58), color: colors.textFaint, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: fonts.ui }}>Owner</span>
                        <span style={{ fontSize: fs(0.58), color: colors.textFaint, textTransform: 'uppercase', fontFamily: fonts.ui, minWidth: 36, textAlign: 'right' }}>Tier</span>
                        <span style={{ fontSize: fs(0.58), color: colors.textFaint, textTransform: 'uppercase', fontFamily: fonts.ui, minWidth: 32, textAlign: 'right' }}>DHQ</span>
                        <span style={{ fontSize: fs(0.58), color: colors.textFaint, textTransform: 'uppercase', fontFamily: fonts.ui, minWidth: 22, textAlign: 'right' }}>HP</span>
                    </div>
                    {top.map((a, i) => {
                        const isMe = a.rosterId && (currentLeague?.rosters || []).find(r => r.roster_id === a.rosterId)?.owner_id === sleeperUserId;
                        const name = getOwnerName ? getOwnerName(a.rosterId) : ('Team ' + (i + 1));
                        const tc = tierCol(a.tier);
                        const scores = window.App?.LI?.playerScores || {};
                        const roster = (currentLeague?.rosters || []).find(r => r.roster_id === a.rosterId);
                        const rosterDHQ = roster ? (roster.players || []).reduce((s, pid) => s + (scores[pid] || 0), 0) : 0;
                        return (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0',
                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                background: isMe ? 'rgba(212,175,55,0.04)' : 'transparent',
                            }}>
                                <span style={{ fontSize: fs(0.68), color: i < 3 ? colors.accent : colors.textMuted, fontWeight: 700, width: 16, textAlign: 'right', fontFamily: fonts.mono }}>{i + 1}</span>
                                <span style={{ flex: 1, fontSize: fs(0.72), fontWeight: isMe ? 700 : 500, color: isMe ? colors.accent : colors.text, fontFamily: fonts.ui, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {isMe ? '★ ' : ''}{(name || '').slice(0, 16)}
                                </span>
                                <span style={{ ...window.WrTheme?.badgeStyle?.(tc) || {}, fontSize: fs(0.64), minWidth: 36 }}>{(a.tier || '—').slice(0, 4)}</span>
                                <span style={{ fontSize: fs(0.62), color: colors.textMuted, minWidth: 32, textAlign: 'right', fontFamily: fonts.mono }}>{rosterDHQ >= 1000 ? Math.round(rosterDHQ / 1000) + 'k' : rosterDHQ}</span>
                                <span style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.textMuted, minWidth: 22, textAlign: 'right', fontFamily: fonts.mono }}>{a.healthScore || 0}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Recent activity feed */}
                {showTx && recentTx.length > 0 && (
                    <div>
                        <div style={{ fontSize: fs(0.64), fontWeight: 700, color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontFamily: fonts.ui }}>Recent Activity</div>
                        {recentTx.map((tx, i) => {
                            const type = tx.type || 'move';
                            const typeCol = type === 'trade' ? (colors.purple || '#7C6BF8') : type === 'waiver' ? (colors.info || '#00c8b4') : colors.positive;
                            // Try to resolve player names
                            let desc = tx.description || tx.type || '—';
                            if (tx.adds || tx.drops) {
                                const addNames = Object.keys(tx.adds || {}).map(pid => playersData?.[pid]?.full_name || pid).slice(0, 2);
                                const dropNames = Object.keys(tx.drops || {}).map(pid => playersData?.[pid]?.full_name || pid).slice(0, 2);
                                if (addNames.length && dropNames.length) desc = addNames.join(', ') + ' for ' + dropNames.join(', ');
                                else if (addNames.length) desc = 'Added ' + addNames.join(', ');
                                else if (dropNames.length) desc = 'Dropped ' + dropNames.join(', ');
                            }
                            return (
                                <div key={i} style={{ display: 'flex', gap: '6px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: fs(0.72), fontFamily: fonts.ui }}>
                                    <span style={{ ...window.WrTheme?.badgeStyle?.(typeCol) || {}, fontSize: fs(0.62) }}>{type.toUpperCase()}</span>
                                    <span style={{ flex: 1, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {desc}
                                    </span>
                                    {tx.created && <span style={{ fontSize: fs(0.62), color: colors.textFaint }}>{timeAgo ? timeAgo(tx.created) : ''}</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    window.LeagueLandscapeWidget = LeagueLandscapeWidget;
})();

// ══════════════════════════════════════════════════════════════════
// js/tabs/global-view.js — Pro Tier: Empire Dashboard
// "Europa Universalis for Dynasty" — you are the kingdom, leagues are provinces.
// Aggregates roster, trades, waivers, health, projections across ALL leagues.
// Requires Pro tier ($12.99/mo) or higher.
// ══════════════════════════════════════════════════════════════════

function EmpireDashboard({ allLeagues, playersData, sleeperUserId, onEnterLeague, onBack }) {
    const { useState, useMemo, useEffect } = React;
    const normPos = window.App?.normPos || (p => p);
    const scores = window.App?.LI?.playerScores || {};

    // Alex persona
    const alexStyle = localStorage.getItem('wr_alex_style') || 'default';
    const alexAvatar = (() => {
        const key = localStorage.getItem('wr_alex_avatar') || 'brain';
        const map = { brain:'\u{1F9E0}', target:'\u{1F3AF}', chart:'\u{1F4CA}', football:'\u{1F3C8}', bolt:'\u26A1', fire:'\u{1F525}', medal:'\u{1F396}\uFE0F', trophy:'\u{1F3C6}' };
        return map[key] || '\u{1F9E0}';
    })();
    const userName = window.S?.user?.display_name || window.S?.user?.username || 'Commander';

    // ── Compute province data for each league ──
    const provinces = useMemo(() => {
        if (!allLeagues?.length) return [];
        return allLeagues.map(league => {
            const rosters = league.rosters || [];
            const myRoster = rosters.find(r => r.owner_id === sleeperUserId || r.owner_id === league.myUserId);
            if (!myRoster) return null;

            const players = myRoster.players || [];
            const totalDHQ = players.reduce((s, pid) => s + (scores[pid] || 0), 0);
            const wins = myRoster.settings?.wins || 0;
            const losses = myRoster.settings?.losses || 0;
            const budget = league.settings?.waiver_budget || 0;
            const spent = myRoster.settings?.waiver_budget_used || 0;
            const faab = Math.max(0, budget - spent);

            // Health + tier assessment
            let healthScore = 0, tier = 'UNKNOWN', needs = [], strengths = [];
            if (typeof window.assessTeamFromGlobal === 'function') {
                const assess = window.assessTeamFromGlobal(myRoster.roster_id);
                if (assess) {
                    healthScore = assess.healthScore || 0;
                    tier = assess.tier || 'UNKNOWN';
                    needs = (assess.needs || []).slice(0, 3).map(n => typeof n === 'string' ? n : n.pos);
                    strengths = (assess.strengths || []).slice(0, 3);
                }
            }

            // Power rank
            const ranked = [...rosters].sort((a, b) => {
                const da = (a.players || []).reduce((s, pid) => s + (scores[pid] || 0), 0);
                const db = (b.players || []).reduce((s, pid) => s + (scores[pid] || 0), 0);
                return db - da;
            });
            const powerRank = ranked.findIndex(r => r.roster_id === myRoster.roster_id) + 1;

            // Trade history
            const ownerProfile = window.App?.LI?.ownerProfiles?.[myRoster.roster_id] || {};
            const tradeWon = ownerProfile.tradesWon || 0;
            const tradeLost = ownerProfile.tradesLost || 0;
            const tradeFair = ownerProfile.tradesFair || 0;

            // Competitive window
            const window_ = tier === 'ELITE' || tier === 'CONTENDER' ? 'Competing' : tier === 'CROSSROADS' ? 'Crossroads' : 'Rebuilding';

            // Tier colors
            const tierColor = tier === 'ELITE' ? '#2ECC71' : tier === 'CONTENDER' ? '#3498DB' : tier === 'CROSSROADS' ? '#F0A500' : '#E74C3C';

            return {
                id: league.id || league.league_id,
                name: league.name || 'League',
                teams: rosters.length,
                platform: league.platform || 'sleeper',
                isDynasty: league.settings?.type === 2,
                roster: myRoster,
                players,
                totalDHQ,
                wins, losses,
                healthScore, tier, tierColor,
                needs, strengths,
                powerRank,
                faab, faabTotal: budget,
                tradeWon, tradeLost, tradeFair,
                window: window_,
                league,
            };
        }).filter(Boolean);
    }, [allLeagues, sleeperUserId]);

    // ── Empire aggregates ──
    const empire = useMemo(() => {
        const totalDHQ = provinces.reduce((s, p) => s + p.totalDHQ, 0);
        const avgHealth = provinces.length > 0 ? Math.round(provinces.reduce((s, p) => s + p.healthScore, 0) / provinces.length) : 0;
        const totalTitles = 0; // TODO: aggregate from championship data

        // Player exposure
        const ownership = {};
        provinces.forEach(prov => {
            prov.players.forEach(pid => {
                if (!ownership[pid]) ownership[pid] = [];
                ownership[pid].push({ name: prov.name, id: prov.id, dhq: scores[pid] || 0 });
            });
        });
        const exposure = Object.entries(ownership)
            .filter(([, leagues]) => leagues.length > 1)
            .map(([pid, leagues]) => ({
                pid,
                name: playersData?.[pid]?.full_name || pid,
                pos: normPos(playersData?.[pid]?.position) || '?',
                leagues,
                count: leagues.length,
                totalDHQ: leagues.reduce((s, l) => s + l.dhq, 0),
            }))
            .sort((a, b) => b.count - a.count || b.totalDHQ - a.totalDHQ);

        // Alerts across all leagues
        const alerts = [];
        provinces.forEach(prov => {
            if (prov.needs.length > 0) {
                const urgency = prov.tier === 'REBUILDING' ? 'red' : prov.needs.length >= 2 ? 'yellow' : 'green';
                alerts.push({ league: prov.name, leagueId: prov.id, text: 'Needs: ' + prov.needs.join(', '), urgency, icon: urgency === 'red' ? '\u{1F534}' : urgency === 'yellow' ? '\u{1F7E1}' : '\u{1F7E2}' });
            }
            if (prov.faabTotal > 0 && prov.faab < prov.faabTotal * 0.25) {
                alerts.push({ league: prov.name, leagueId: prov.id, text: 'FAAB running low ($' + prov.faab + ' left)', urgency: 'yellow', icon: '\u{1F7E1}' });
            }
        });
        alerts.sort((a, b) => { const o = { red: 0, yellow: 1, green: 2 }; return (o[a.urgency] || 9) - (o[b.urgency] || 9); });

        return { totalDHQ, avgHealth, totalTitles, exposure, alerts };
    }, [provinces]);

    // ── Style tokens ──
    const G = '#D4AF37', W = '#f0f0f3', S = 'rgba(255,255,255,0.5)', BK = '#0a0a0a';
    const font = "'DM Sans', Inter, sans-serif";
    const rajFont = 'Rajdhani, sans-serif';
    const monoFont = 'JetBrains Mono, monospace';

    const statBox = (label, value, sub, color) => (
        <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center', flex: 1 }}>
            <div style={{ fontFamily: monoFont, fontSize: '1.6rem', fontWeight: 700, color: color || W, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.65rem', color: G, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
            {sub && <div style={{ fontSize: '0.6rem', color: S, marginTop: '2px' }}>{sub}</div>}
        </div>
    );

    if (!provinces.length) {
        return (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: S, fontFamily: font }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{'\u{1F30D}'}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: W, marginBottom: '8px' }}>No Provinces Yet</div>
                <div style={{ fontSize: '0.85rem', maxWidth: '360px', margin: '0 auto', lineHeight: 1.6 }}>Connect your leagues to build your dynasty empire. Each league becomes a province in your command center.</div>
                <button onClick={onBack} style={{ marginTop: '24px', padding: '12px 32px', background: G, color: BK, border: 'none', borderRadius: '10px', fontFamily: rajFont, fontSize: '1rem', fontWeight: 700, cursor: 'pointer' }}>Connect Leagues</button>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: BK, fontFamily: font }}>
            {/* ═══ HEADER BAR ═══ */}
            <div style={{ padding: '16px 32px', borderBottom: '2px solid rgba(212,175,55,0.25)', display: 'flex', alignItems: 'center', gap: '16px', background: 'linear-gradient(135deg, rgba(212,175,55,0.08), transparent)' }}>
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S, fontSize: '0.85rem', fontFamily: font, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {'\u2190'} Hub
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    {typeof window.ProTierIcon === 'function' ? <div style={{ width: 28, height: 28 }}>{React.createElement(window.ProTierIcon, { size: 28 })}</div> : null}
                    <div>
                        <div style={{ fontFamily: rajFont, fontSize: '1.1rem', color: G, letterSpacing: '0.08em', lineHeight: 1 }}>WAR ROOM PRO</div>
                        <div style={{ fontSize: '0.62rem', color: S, letterSpacing: '0.06em' }}>EMPIRE DASHBOARD</div>
                    </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: S }}>{alexAvatar} {userName}</div>
            </div>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 32px' }}>

                {/* ═══ EMPIRE OVERVIEW ═══ */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {statBox('Provinces', provinces.length, 'leagues')}
                    {statBox('Portfolio', Math.round(empire.totalDHQ / 1000) + 'k', 'total DHQ', empire.totalDHQ > 100000 ? '#2ECC71' : W)}
                    {statBox('Health', empire.avgHealth, 'avg score', empire.avgHealth >= 70 ? '#2ECC71' : empire.avgHealth >= 50 ? G : '#E74C3C')}
                    {statBox('Titles', empire.totalTitles || '\u2014', 'all-time')}
                    {statBox('Exposure', empire.exposure.length, 'multi-league')}
                </div>

                {/* ═══ PROVINCE CARDS ═══ */}
                <div style={{ fontFamily: rajFont, fontSize: '0.72rem', color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px' }}>YOUR PROVINCES</div>
                <div style={{ display: 'grid', gridTemplateColumns: provinces.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(420px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                    {provinces.map(prov => (
                        <div key={prov.id} style={{ background: BK, border: '2px solid rgba(212,175,55,0.3)', borderRadius: '14px', borderLeft: '4px solid ' + prov.tierColor, overflow: 'hidden' }}>
                            {/* Province header */}
                            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <div style={{ fontFamily: rajFont, fontSize: '1.1rem', fontWeight: 700, color: W, flex: 1, letterSpacing: '0.02em' }}>{prov.name}</div>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: S }}>{prov.platform.toUpperCase()}</span>
                                    {prov.isDynasty && <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(212,175,55,0.1)', color: G }}>DYNASTY</span>}
                                    <span style={{ fontSize: '0.6rem', color: S }}>{prov.teams}T</span>
                                </div>
                                {/* Status bar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: prov.tierColor, padding: '2px 8px', borderRadius: '4px', border: '1px solid ' + prov.tierColor + '40', background: prov.tierColor + '15' }}>{prov.tier}</span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: W, fontFamily: monoFont }}>{prov.wins}-{prov.losses}</span>
                                    <span style={{ fontSize: '0.72rem', color: prov.healthScore >= 70 ? '#2ECC71' : prov.healthScore >= 50 ? G : '#E74C3C', fontWeight: 700 }}>HP:{prov.healthScore}</span>
                                    <span style={{ fontSize: '0.72rem', color: prov.powerRank <= 3 ? G : S }}>#{prov.powerRank}/{prov.teams}</span>
                                </div>
                            </div>

                            {/* Province body — data grid */}
                            <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.75rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.6rem', color: G, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', fontWeight: 700 }}>Roster</div>
                                    <div style={{ fontFamily: monoFont, fontWeight: 700, color: W }}>{Math.round(prov.totalDHQ / 1000)}k <span style={{ color: S, fontWeight: 400 }}>DHQ</span></div>
                                    {prov.strengths.length > 0 && <div style={{ color: '#2ECC71', fontSize: '0.68rem' }}>Strong: {prov.strengths.join(', ')}</div>}
                                    {prov.needs.length > 0 && <div style={{ color: '#E74C3C', fontSize: '0.68rem' }}>Needs: {prov.needs.join(', ')}</div>}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', color: G, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', fontWeight: 700 }}>Window</div>
                                    <div style={{ color: prov.window === 'Competing' ? '#2ECC71' : prov.window === 'Crossroads' ? G : '#E74C3C', fontWeight: 600 }}>{prov.window}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', color: G, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', fontWeight: 700 }}>Trades</div>
                                    <div><span style={{ color: '#2ECC71' }}>{prov.tradeWon}W</span> <span style={{ color: '#E74C3C' }}>{prov.tradeLost}L</span> <span style={{ color: S }}>{prov.tradeFair}F</span></div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.6rem', color: G, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px', fontWeight: 700 }}>Waivers</div>
                                    <div style={{ color: prov.faab < prov.faabTotal * 0.25 ? '#E74C3C' : S }}>{prov.faabTotal > 0 ? '$' + prov.faab + '/$' + prov.faabTotal : 'N/A'}</div>
                                </div>
                            </div>

                            {/* Alex insight */}
                            <div style={{ padding: '0 18px 12px' }}>
                                <div style={{ background: 'rgba(212,175,55,0.04)', borderLeft: '3px solid rgba(212,175,55,0.4)', borderRadius: '0 6px 6px 0', padding: '8px 12px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '0.7rem' }}>{alexAvatar}</span>
                                    <div style={{ fontSize: '0.72rem', color: S, lineHeight: 1.5 }}>
                                        {prov.tier === 'ELITE' ? 'Dominant position. Protect assets and target championships.'
                                            : prov.tier === 'CONTENDER' ? 'In the mix. One upgrade at ' + (prov.needs[0] || 'depth') + ' could push you over.'
                                            : prov.tier === 'CROSSROADS' ? 'Decision time. Commit to competing or pivot to accumulation.'
                                            : 'Rebuild mode. Acquire young talent and draft capital.'}
                                    </div>
                                </div>
                            </div>

                            {/* Enter button */}
                            <div style={{ padding: '0 18px 16px' }}>
                                <button onClick={() => onEnterLeague(prov.league)}
                                    style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))', border: '1.5px solid rgba(212,175,55,0.3)', borderRadius: '8px', color: G, fontFamily: rajFont, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.2)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; }}>
                                    Enter War Room {'\u2192'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ═══ CROSS-EMPIRE INTEL ═══ */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {/* Player Exposure */}
                    <div style={{ background: BK, border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', padding: '16px 18px' }}>
                        <div style={{ fontFamily: rajFont, fontSize: '0.72rem', color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>PLAYER EXPOSURE</div>
                        {empire.exposure.length === 0
                            ? <div style={{ color: S, fontSize: '0.78rem', padding: '12px 0' }}>No players owned in multiple leagues.</div>
                            : empire.exposure.slice(0, 10).map(p => (
                                <div key={p.pid} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                                    onClick={() => { if (typeof window.openPlayerModal === 'function') window.openPlayerModal(p.pid); }}>
                                    <img src={'https://sleepercdn.com/content/nfl/players/thumb/' + p.pid + '.jpg'} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} onError={e => e.target.style.display='none'} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: W }}>{p.name}</div>
                                        <div style={{ fontSize: '0.62rem', color: S }}>{p.leagues.map(l => l.name).join(' \u00B7 ')}</div>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: G, padding: '2px 8px', background: 'rgba(212,175,55,0.12)', borderRadius: '10px' }}>{p.count}x</span>
                                    <span style={{ fontSize: '0.68rem', color: S, fontFamily: monoFont }}>{Math.round(p.totalDHQ / 1000)}k</span>
                                </div>
                            ))
                        }
                        {empire.exposure.length > 3 && (
                            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.15)', borderRadius: '6px', fontSize: '0.7rem', color: '#E74C3C' }}>
                                {'\u26A0'} Concentration risk: {empire.exposure.filter(p => p.count >= 3).length > 0
                                    ? empire.exposure.filter(p => p.count >= 3).length + ' players owned in 3+ leagues'
                                    : empire.exposure.length + ' players across multiple leagues'}
                            </div>
                        )}
                    </div>

                    {/* Alerts & Recommendations */}
                    <div style={{ background: BK, border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', padding: '16px 18px' }}>
                        <div style={{ fontFamily: rajFont, fontSize: '0.72rem', color: G, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '12px' }}>ALERTS & RECOMMENDATIONS</div>
                        {empire.alerts.length === 0
                            ? <div style={{ color: S, fontSize: '0.78rem', padding: '12px 0' }}>All provinces running smoothly.</div>
                            : empire.alerts.slice(0, 8).map((a, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <span style={{ fontSize: '0.7rem', flexShrink: 0 }}>{a.icon}</span>
                                    <div>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: G }}>{a.league}: </span>
                                        <span style={{ fontSize: '0.72rem', color: S }}>{a.text}</span>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

// Expose globally for app.js reference
window.EmpireDashboard = EmpireDashboard;

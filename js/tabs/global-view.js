// ══════════════════════════════════════════════════════════════════
// js/tabs/global-view.js — Pro Tier: Global Multi-League Dashboard
// Shows all leagues, player exposure, cross-league recommendations.
// Requires Pro tier ($12.99/mo) or higher.
// ══════════════════════════════════════════════════════════════════

function GlobalDashboard({ allLeagues, playersData, onSelectLeague }) {
    const { useState, useMemo } = React;
    const [activeSection, setActiveSection] = useState('overview');

    // ── Aggregate data across all leagues ──
    const portfolio = useMemo(() => {
        if (!allLeagues?.length) return null;

        const playerOwnership = {}; // pid -> [{ leagueName, leagueId, dhq }]
        let totalDHQ = 0;
        let totalChampionships = 0;
        const leagueStats = [];

        allLeagues.forEach(league => {
            const rosters = league.rosters || [];
            const myRoster = rosters.find(r => r.owner_id === league.myUserId) || rosters.find(r => r.players?.length);
            if (!myRoster) return;

            const leagueName = league.name || league.id;
            const players = myRoster.players || [];
            let leagueDHQ = 0;

            players.forEach(pid => {
                const dhq = window.App?.LI?.playerScores?.[pid] || 0;
                leagueDHQ += dhq;
                if (!playerOwnership[pid]) playerOwnership[pid] = [];
                playerOwnership[pid].push({ leagueName, leagueId: league.id, dhq });
            });

            totalDHQ += leagueDHQ;

            // Championship count from LI
            const champs = window.App?.LI?.championships || {};
            const myChamps = Object.values(champs).filter(c => c.champion === myRoster.roster_id).length;
            totalChampionships += myChamps;

            leagueStats.push({
                id: league.id,
                name: leagueName,
                teams: rosters.length,
                record: (myRoster.settings?.wins || 0) + '-' + (myRoster.settings?.losses || 0),
                dhq: leagueDHQ,
                championships: myChamps,
                platform: league.platform || 'sleeper',
            });
        });

        // Find multi-league players (exposure)
        const exposure = Object.entries(playerOwnership)
            .filter(([, leagues]) => leagues.length > 1)
            .map(([pid, leagues]) => ({
                pid,
                name: playersData?.[pid]?.full_name || pid,
                pos: playersData?.[pid]?.position || '?',
                leagues,
                count: leagues.length,
                totalDHQ: leagues.reduce((s, l) => s + l.dhq, 0),
            }))
            .sort((a, b) => b.count - a.count || b.totalDHQ - a.totalDHQ);

        return { playerOwnership, exposure, totalDHQ, totalChampionships, leagueStats };
    }, [allLeagues, playersData]);

    // ── Styles ──
    const cardStyle = { background: 'var(--black)', border: '2px solid rgba(212,175,55,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '12px' };
    const headerStyle = { fontFamily: 'Rajdhani, sans-serif', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.06em', marginBottom: '10px' };
    const statBox = (label, value, sub) => React.createElement('div', { style: { padding: '12px', background: 'rgba(212,175,55,0.06)', borderRadius: '8px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '1.3rem', fontWeight: 700, color: 'var(--white)', fontFamily: 'JetBrains Mono, monospace' } }, value),
        React.createElement('div', { style: { fontSize: '0.65rem', color: 'var(--gold)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' } }, label),
        sub && React.createElement('div', { style: { fontSize: '0.6rem', color: 'var(--silver)', marginTop: '2px' } }, sub),
    );

    if (!portfolio) {
        return React.createElement('div', { style: { padding: '40px 20px', textAlign: 'center', color: 'var(--silver)' } },
            React.createElement('div', { style: { fontSize: '2rem', marginBottom: '10px' } }, '\uD83C\uDF10'),
            React.createElement('div', { style: { fontSize: '0.85rem' } }, 'Connect multiple leagues to see your global dashboard.'),
        );
    }

    return React.createElement('div', { style: { maxWidth: '900px', margin: '0 auto' } },
        // Section tabs
        React.createElement('div', { style: { display: 'flex', gap: '6px', marginBottom: '14px' } },
            ['overview', 'exposure', 'leagues'].map(s =>
                React.createElement('button', { key: s, onClick: () => setActiveSection(s), style: { padding: '6px 14px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '6px', border: '1px solid ' + (activeSection === s ? 'var(--gold)' : 'rgba(255,255,255,0.1)'), background: activeSection === s ? 'var(--gold)' : 'transparent', color: activeSection === s ? 'var(--black)' : 'var(--silver)', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' } }, s)
            ),
        ),

        // ── OVERVIEW ──
        activeSection === 'overview' && React.createElement('div', null,
            // Summary stats
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' } },
                statBox('Leagues', portfolio.leagueStats.length),
                statBox('Total DHQ', Math.round(portfolio.totalDHQ / 1000) + 'k'),
                statBox('Titles', portfolio.totalChampionships),
                statBox('Exposure', portfolio.exposure.length, 'multi-league'),
            ),
            // League cards
            React.createElement('div', { style: cardStyle },
                React.createElement('div', { style: headerStyle }, 'YOUR LEAGUES'),
                portfolio.leagueStats.map(l =>
                    React.createElement('div', { key: l.id, onClick: () => onSelectLeague && onSelectLeague(l.id), style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }, onMouseEnter: e => e.currentTarget.style.background = 'rgba(212,175,55,0.06)', onMouseLeave: e => e.currentTarget.style.background = 'transparent' },
                        React.createElement('div', { style: { flex: 1 } },
                            React.createElement('div', { style: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--white)' } }, l.name),
                            React.createElement('div', { style: { fontSize: '0.72rem', color: 'var(--silver)' } }, l.teams + ' teams \u00B7 ' + l.record),
                        ),
                        React.createElement('div', { style: { textAlign: 'right' } },
                            React.createElement('div', { style: { fontSize: '0.85rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'JetBrains Mono, monospace' } }, Math.round(l.dhq / 1000) + 'k'),
                            React.createElement('div', { style: { fontSize: '0.6rem', color: 'var(--silver)' } }, 'DHQ'),
                        ),
                        l.championships > 0 && React.createElement('span', { style: { fontSize: '1rem' } }, '\uD83C\uDFC6'),
                    )
                ),
            ),
        ),

        // ── EXPOSURE ──
        activeSection === 'exposure' && React.createElement('div', null,
            React.createElement('div', { style: cardStyle },
                React.createElement('div', { style: headerStyle }, 'PLAYER EXPOSURE \u2014 Multi-League Holdings'),
                portfolio.exposure.length === 0
                    ? React.createElement('div', { style: { color: 'var(--silver)', fontSize: '0.78rem', padding: '10px 0' } }, 'No players owned in multiple leagues.')
                    : portfolio.exposure.slice(0, 30).map(p =>
                        React.createElement('div', { key: p.pid, style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }, onClick: () => { if (typeof window.openPlayerModal === 'function') window.openPlayerModal(p.pid); } },
                            React.createElement('img', { src: 'https://sleepercdn.com/content/nfl/players/' + p.pid + '.jpg', style: { width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }, onError: e => e.target.style.display = 'none' }),
                            React.createElement('div', { style: { flex: 1 } },
                                React.createElement('div', { style: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--white)' } }, p.name),
                                React.createElement('div', { style: { fontSize: '0.68rem', color: 'var(--silver)' } }, p.leagues.map(l => l.leagueName).join(' \u00B7 ')),
                            ),
                            React.createElement('span', { style: { fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold)', padding: '2px 8px', background: 'rgba(212,175,55,0.15)', borderRadius: '10px' } }, p.count + 'x'),
                            React.createElement('span', { style: { fontSize: '0.72rem', color: 'var(--silver)', fontFamily: 'JetBrains Mono, monospace' } }, Math.round(p.totalDHQ / 1000) + 'k'),
                        )
                    ),
            ),
        ),

        // ── LEAGUES (detailed) ──
        activeSection === 'leagues' && React.createElement('div', null,
            portfolio.leagueStats.map(l =>
                React.createElement('div', { key: l.id, style: cardStyle },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
                        React.createElement('div', { style: { flex: 1 } },
                            React.createElement('div', { style: { fontSize: '0.92rem', fontWeight: 700, color: 'var(--white)' } }, l.name),
                            React.createElement('div', { style: { fontSize: '0.72rem', color: 'var(--silver)' } }, l.teams + ' teams \u00B7 ' + l.platform),
                        ),
                        React.createElement('button', { onClick: () => onSelectLeague && onSelectLeague(l.id), style: { background: 'var(--gold)', color: 'var(--black)', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } }, 'Open'),
                    ),
                    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' } },
                        statBox('Record', l.record),
                        statBox('DHQ', Math.round(l.dhq / 1000) + 'k'),
                        statBox('Titles', l.championships),
                    ),
                )
            ),
        ),
    );
}

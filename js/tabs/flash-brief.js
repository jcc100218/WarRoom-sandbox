// ══════════════════════════════════════════════════════════════════
// js/tabs/flash-brief.js — FlashBriefPanel: Two-box layout
// Left: Alex Ingram's intelligence briefing with action buttons
// Right: Field Notes from Scout (placeholder — next week)
// ══════════════════════════════════════════════════════════════════

function FlashBriefPanel({
  myRoster,
  rankedTeams,
  sleeperUserId,
  currentLeague,
  activeYear,
  setActiveTab,
  briefDraftInfo,
  playersData,
  statsData,
  setReconPanelOpen,
  sendReconMessage,
}) {
    const myAssess = typeof window.assessTeamFromGlobal === 'function' ? window.assessTeamFromGlobal(myRoster?.roster_id) : null;
    const tier = (myAssess?.tier || 'UNKNOWN').toUpperCase();
    const hs = myAssess?.healthScore || 0;
    const needs = myAssess?.needs || [];
    const strengths = myAssess?.strengths || [];
    const elites = typeof window.App?.countElitePlayers === 'function' ? window.App.countElitePlayers(myRoster?.players || []) : 0;
    const myRank = rankedTeams.findIndex(t => t.userId === sleeperUserId) + 1;
    const scores = window.App?.LI?.playerScores || {};
    const ownerProfiles = window.App?.LI?.ownerProfiles || {};

    // FAAB
    const budget = currentLeague?.settings?.waiver_budget || 0;
    const spent = myRoster?.settings?.waiver_budget_used || 0;
    const faabRemaining = Math.max(0, budget - spent);

    // Best waiver target
    const waiverTarget = useMemo(() => {
        if (!needs.length) return null;
        const normPos = window.App?.normPos || (p => p);
        const rostered = new Set();
        (currentLeague?.rosters || []).forEach(r => (r.players || []).concat(r.taxi || [], r.reserve || []).forEach(pid => rostered.add(String(pid))));
        const needPos = typeof needs[0] === 'string' ? needs[0] : needs[0]?.pos;
        if (!needPos) return null;
        return Object.entries(playersData || {})
            .filter(([pid, p]) => !rostered.has(pid) && normPos(p.position) === needPos && p.team && p.active !== false)
            .map(([pid, p]) => ({ pid, name: p.full_name || '', dhq: scores[pid] || 0, pos: needPos, team: p.team }))
            .sort((a, b) => b.dhq - a.dhq)[0] || null;
    }, [needs, playersData, scores, currentLeague]);

    // Key drops (high-value players dropped in last 3 weeks)
    const keyDrops = useMemo(() => {
        const drops = [];
        const transactions = window.S?.transactions || {};
        const curWeek = window.S?.currentWeek || 1;
        for (let w = curWeek; w >= Math.max(1, curWeek - 2); w--) {
            ((transactions['w' + w]) || []).forEach(t => {
                if (t.type !== 'free_agent' && t.type !== 'waiver') return;
                Object.keys(t.drops || {}).forEach(pid => {
                    const dhq = scores[pid] || 0;
                    if (dhq >= 1500) drops.push({ pid, name: playersData?.[pid]?.full_name || '?', dhq, pos: playersData?.[pid]?.position || '?' });
                });
            });
        }
        return drops.sort((a, b) => b.dhq - a.dhq).slice(0, 3);
    }, [scores, playersData]);

    // Draft countdown
    const draftCountdown = useMemo(() => {
        if (!briefDraftInfo?.start_time || briefDraftInfo.status !== 'pre_draft') return null;
        const diff = briefDraftInfo.start_time - Date.now();
        if (diff <= 0) return null;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        return { days, hours, date: new Date(briefDraftInfo.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
    }, [briefDraftInfo]);

    // Active traders in league
    const activeTrades = useMemo(() => {
        const txns = window.S?.transactions || {};
        const flat = Array.isArray(txns) ? txns : Object.values(txns).flat();
        return flat.filter(t => t.type === 'trade').length;
    }, []);

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const userName = window.S?.user?.display_name || window.S?.user?.username || 'Commander';

    // Build Alex's briefing message
    const briefSections = [];

    // League situation
    const situationParts = [];
    situationParts.push(`You're ranked #${myRank} of ${rankedTeams.length}. Health score: ${hs}. Tier: ${tier}.`);
    if (elites > 0) situationParts.push(`${elites} elite player${elites > 1 ? 's' : ''} on your roster.`);
    if (needs.length) situationParts.push(`Biggest gap: ${typeof needs[0] === 'string' ? needs[0] : needs[0]?.pos}.`);
    if (activeTrades > 0) situationParts.push(`${activeTrades} trade${activeTrades > 1 ? 's' : ''} completed in the league recently.`);
    briefSections.push(situationParts.join(' '));

    // FAAB
    if (budget > 0) briefSections.push(`FAAB: $${faabRemaining} of $${budget} remaining.`);

    const cardStyle = { background: 'var(--black)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '12px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' };
    const btnStyle = { padding: '8px 14px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '8px', color: 'var(--gold)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', fontWeight: 600, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' };

    return React.createElement('div', {
        style: { padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', height: 'calc(100vh - 120px)', alignContent: 'start' },
        className: 'wr-fade-in'
    },
        // ═══ LEFT: ALEX'S BRIEFING ═══
        React.createElement('div', { style: cardStyle },
            // Header
            React.createElement('div', { style: { padding: '20px 20px 0', borderBottom: '1px solid rgba(212,175,55,0.1)', paddingBottom: '12px' } },
                React.createElement('div', { style: { fontFamily: 'Rajdhani, sans-serif', fontSize: '0.72rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' } }, 'INTELLIGENCE BRIEFING'),
                React.createElement('div', { style: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--white)' } }, `${greeting}, ${userName}.`),
            ),
            // Body
            React.createElement('div', { style: { padding: '16px 20px', flex: 1, overflowY: 'auto' } },
                // Situation report
                React.createElement('div', { style: { fontSize: '0.82rem', color: 'var(--silver)', lineHeight: 1.7, marginBottom: '16px' } },
                    briefSections.join(' ')
                ),
                // Action buttons
                React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    // Waiver target
                    waiverTarget && React.createElement('button', {
                        onClick: () => setActiveTab('fa'), style: btnStyle,
                        onMouseEnter: e => e.currentTarget.style.background = 'rgba(212,175,55,0.15)',
                        onMouseLeave: e => e.currentTarget.style.background = 'rgba(212,175,55,0.08)',
                    },
                        React.createElement('span', { style: { fontSize: '1rem' } }, '🎯'),
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontWeight: 700, color: 'var(--white)', fontSize: '0.82rem' } }, `Target: ${waiverTarget.name}`),
                            React.createElement('div', { style: { fontSize: '0.72rem', color: 'var(--silver)' } }, `${waiverTarget.pos} · DHQ ${waiverTarget.dhq.toLocaleString()} · Fills your ${waiverTarget.pos} gap`),
                        ),
                    ),
                    // Key drops
                    keyDrops.length > 0 && React.createElement('button', {
                        onClick: () => setActiveTab('fa'), style: btnStyle,
                        onMouseEnter: e => e.currentTarget.style.background = 'rgba(212,175,55,0.15)',
                        onMouseLeave: e => e.currentTarget.style.background = 'rgba(212,175,55,0.08)',
                    },
                        React.createElement('span', { style: { fontSize: '1rem' } }, '⚠️'),
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontWeight: 700, color: 'var(--white)', fontSize: '0.82rem' } }, `${keyDrops.length} high-value drop${keyDrops.length > 1 ? 's' : ''}`),
                            React.createElement('div', { style: { fontSize: '0.72rem', color: 'var(--silver)' } }, keyDrops.map(d => `${d.name} (${d.pos}, ${d.dhq.toLocaleString()})`).join(', ')),
                        ),
                    ),
                    // Trade block
                    React.createElement('button', {
                        onClick: () => setActiveTab('trades'), style: btnStyle,
                        onMouseEnter: e => e.currentTarget.style.background = 'rgba(212,175,55,0.15)',
                        onMouseLeave: e => e.currentTarget.style.background = 'rgba(212,175,55,0.08)',
                    },
                        React.createElement('span', { style: { fontSize: '1rem' } }, '🔄'),
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontWeight: 700, color: 'var(--white)', fontSize: '0.82rem' } }, 'Explore trade opportunities'),
                            React.createElement('div', { style: { fontSize: '0.72rem', color: 'var(--silver)' } }, `${Object.keys(ownerProfiles).length} owner profiles loaded · Find your best trade partner`),
                        ),
                    ),
                    // Draft countdown
                    draftCountdown && React.createElement('button', {
                        onClick: () => setActiveTab('draft'), style: btnStyle,
                        onMouseEnter: e => e.currentTarget.style.background = 'rgba(212,175,55,0.15)',
                        onMouseLeave: e => e.currentTarget.style.background = 'rgba(212,175,55,0.08)',
                    },
                        React.createElement('span', { style: { fontSize: '1rem' } }, '📋'),
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontWeight: 700, color: 'var(--white)', fontSize: '0.82rem' } }, `Draft in ${draftCountdown.days}D ${draftCountdown.hours}H`),
                            React.createElement('div', { style: { fontSize: '0.72rem', color: 'var(--silver)' } }, `${draftCountdown.date} · Prepare your board`),
                        ),
                    ),
                    // Power ranking
                    React.createElement('button', {
                        onClick: () => setActiveTab('league'), style: btnStyle,
                        onMouseEnter: e => e.currentTarget.style.background = 'rgba(212,175,55,0.15)',
                        onMouseLeave: e => e.currentTarget.style.background = 'rgba(212,175,55,0.08)',
                    },
                        React.createElement('span', { style: { fontSize: '1rem' } }, '🏆'),
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontWeight: 700, color: 'var(--white)', fontSize: '0.82rem' } }, `Power Rank: #${myRank} of ${rankedTeams.length}`),
                            React.createElement('div', { style: { fontSize: '0.72rem', color: 'var(--silver)' } }, `${tier} · View league standings`),
                        ),
                    ),
                ),
            ),
        ),

        // ═══ RIGHT: FIELD NOTES ═══
        React.createElement('div', { style: cardStyle },
            React.createElement('div', { style: { padding: '20px 20px 0', borderBottom: '1px solid rgba(212,175,55,0.1)', paddingBottom: '12px' } },
                React.createElement('div', { style: { fontFamily: "'Courier Prime', 'Courier New', monospace", fontSize: '0.72rem', color: 'var(--gold)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' } }, 'FIELD NOTES'),
                React.createElement('div', { style: { fontSize: '0.82rem', color: 'var(--silver)', fontFamily: "'Courier Prime', 'Courier New', monospace" } }, 'Intel logged from Scout sessions'),
            ),
            React.createElement('div', { style: { padding: '16px 20px', flex: 1, overflowY: 'auto' } },
                // Load field log entries
                (() => {
                    const entries = [];
                    try {
                        const raw = localStorage.getItem('scout_field_log_v1');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (Array.isArray(parsed)) entries.push(...parsed.slice(0, 15));
                        }
                    } catch {}

                    if (!entries.length) {
                        return React.createElement('div', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--silver)', opacity: 0.5 } },
                            React.createElement('div', { style: { fontSize: '2rem', marginBottom: '8px' } }, '📋'),
                            React.createElement('div', { style: { fontSize: '0.82rem', fontFamily: "'Courier Prime', 'Courier New', monospace" } }, 'No field notes yet.'),
                            React.createElement('div', { style: { fontSize: '0.72rem', marginTop: '4px' } }, 'Actions in War Room Scout will appear here.'),
                        );
                    }

                    return entries.map((entry, i) => React.createElement('div', {
                        key: entry.id || i,
                        style: { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: "'Courier Prime', 'Courier New', monospace" }
                    },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' } },
                            React.createElement('span', { style: { fontSize: '0.82rem' } }, entry.icon || '📋'),
                            React.createElement('span', { style: { fontSize: '0.72rem', color: 'var(--gold)', fontWeight: 600 } },
                                new Date(entry.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
                                new Date(entry.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                            ),
                        ),
                        React.createElement('div', { style: { fontSize: '0.78rem', color: 'var(--silver)', lineHeight: 1.4 } }, entry.text || ''),
                    ));
                })()
            ),
        ),
    );
}

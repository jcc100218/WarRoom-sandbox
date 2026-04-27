// ══════════════════════════════════════════════════════════════════
// js/tabs/analytics.js — AnalyticsPanel: League analytics terminal
// with 5 sub-tabs: Roster, Draft, Waiver/Trades, Playoffs, Timeline
// Extracted from league-detail.js. Props: all required state from LeagueDetail.
// ══════════════════════════════════════════════════════════════════

// Phase 8 deferred: small wrapper that holds the local state needed to mount
// LeagueMapTab in embed mode. Keeping it separate prevents AnalyticsPanel from
// re-initialising the sort/filter/search state on every render of other sub-tabs.
window.AnalyticsLeagueEmbed = function AnalyticsLeagueEmbed(props) {
    const { analyticsTab, standings, currentLeague, playersData, statsData, sleeperUserId,
        myRoster, activeYear, timeRecomputeTs, setActiveTab, getAcquisitionInfo, getOwnerName } = props;
    const [lpSort, setLpSort] = React.useState({ key: 'dhq', dir: -1 });
    const [lpFilter, setLpFilter] = React.useState('');
    const [lpSearch, setLpSearch] = React.useState('');
    const [leagueSelectedTeam, setLeagueSelectedTeam] = React.useState(null);
    const [leagueSort, setLeagueSort] = React.useState('health');
    const [leagueViewMode, setLeagueViewMode] = React.useState('cards');
    if (typeof window.LeagueMapTab !== 'function') {
        return React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: 'var(--silver)' } }, 'League Map module not loaded.');
    }
    return React.createElement(window.LeagueMapTab, {
        embedSubView: analyticsTab,
        analyticsEmbedMode: true,
        leagueViewTab: 'analyst', setLeagueViewTab: () => {},
        leagueSelectedTeam, setLeagueSelectedTeam,
        leagueSort, setLeagueSort,
        leagueSubView: analyticsTab, setLeagueSubView: () => {},
        leagueViewMode, setLeagueViewMode,
        lpSort, setLpSort,
        lpFilter, setLpFilter,
        lpSearch, setLpSearch,
        standings, currentLeague, playersData, statsData, sleeperUserId, myRoster,
        activeYear, timeRecomputeTs, setActiveTab,
        getAcquisitionInfo: getAcquisitionInfo || (() => ({ method: 'Unknown', date: '', cost: '' })),
        getOwnerName,
    });
};

function AnalyticsPanel({
  analyticsData,
  analyticsTab,
  setAnalyticsTab,
  myRoster,
  currentLeague,
  standings,
  playersData,
  statsData,
  stats2025Data,
  sleeperUserId,
  timeRecomputeTs,
  setTimeRecomputeTs,
  activeYear,
  setActiveTab,
  viewingOwnerId,
  setViewingOwnerId,
  timeDelta,
  timeYear,
  setTradeSubTab,
  getOwnerName,
  // Phase 8: needed when embedding LeagueMapTab (All Players / Draft Picks / Custom Reports).
  getAcquisitionInfo,
}) {
    const _seasonCtx = React.useContext(window.App.SeasonContext) || {};
    const [timelineFilter, setTimelineFilter] = React.useState('all');
    // _SS mirrors the window.S shape consumed throughout this component
    const _SS = {
        rosters: _seasonCtx.rosters?.length ? _seasonCtx.rosters : (window.S?.rosters || currentLeague?.rosters || []),
        myRosterId: _seasonCtx.myRosterId ?? window.S?.myRosterId,
        tradedPicks: _seasonCtx.tradedPicks !== undefined ? _seasonCtx.tradedPicks : (window.S?.tradedPicks || []),
        playerStats: _seasonCtx.playerStats || window.S?.playerStats || {},
    };

    // Token-driven card style so padding/radius/border track index.html's spacing scale.
    const aCardStyle = { background: 'var(--black)', border: 'var(--card-border, 1px solid rgba(212,175,55,0.2))', borderRadius: 'var(--card-radius, 10px)', padding: 'var(--card-pad, 14px 16px)', marginBottom: 'var(--card-gap, 12px)' };
    const aHeaderStyle = { fontFamily: 'Rajdhani, sans-serif', color: 'var(--gold)', fontSize: '1.125rem', fontWeight: 600, letterSpacing: '0.06em', marginBottom: '12px', borderBottom: '1px solid rgba(212,175,55,0.2)', paddingBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
    const aValStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.95rem', fontWeight: 500 };
    const goodColor = '#2ECC71';
    const warnColor = '#F0A500';
    const badColor = '#E74C3C';
    const sevIcon = (sev) => sev === 'high' || sev === 'critical' ? '\uD83D\uDD34' : sev === 'medium' ? '\u26A0\uFE0F' : '\u2705';
    const sevColor = (sev) => sev === 'high' || sev === 'critical' ? badColor : sev === 'medium' ? warnColor : goodColor;
    const pctFmt = (v) => Math.round((v || 0) * 100) + '%';
    const numFmt = (v) => v != null ? (typeof v === 'number' ? v.toLocaleString() : v) : '\u2014';
    // showAlerts block removed — alerts now on Brief tab

    // ── ANALYST VIEW: full analytics terminal ──
    // Phase 8: Absorbed ex-League Map sub-views (All Players, Draft Picks, Custom Reports)
    // since League Map was removed from the nav. They render LeagueMapTab in embed mode.
    const subTabs = [
        { key: 'roster', label: 'Roster' },
        { key: 'draft', label: 'Draft' },
        { key: 'trades', label: 'Market Moves' },
        { key: 'playoffs', label: 'Playoffs' },
        { key: 'timeline', label: 'Timeline' },
        { key: 'players', label: 'All Players' },
        { key: 'picks', label: 'Draft Picks' },
        { key: 'reports', label: 'Custom Reports' },
    ];
    const subTabBtnStyle = (active) => ({
        padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', letterSpacing: '0.06em', transition: 'all 0.2s',
        border: active ? '2px solid var(--gold)' : '2px solid rgba(212,175,55,0.3)',
        background: active ? 'var(--gold)' : 'transparent',
        color: active ? 'var(--black)' : 'var(--gold)',
    });
    const tableRowStyle = (i) => ({ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', ...(i === 0 ? { fontWeight: 700, color: 'var(--gold)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' } : { color: 'var(--silver)' }) });
    const d = analyticsData;
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const leagueRosters = currentLeague?.rosters || _SS.rosters || [];
    const leagueUsers = currentLeague?.users || window.S?.leagueUsers || [];
    const rosterByAnyId = (id) => leagueRosters.find(r => sameId(r.roster_id, id) || sameId(r.owner_id, id));
    const ownerNameSafe = (id, fallback) => {
        if (id == null || id === '') return fallback || 'Unknown';
        try {
            const direct = typeof getOwnerName === 'function' ? getOwnerName(id) : '';
            if (direct && direct !== 'Unknown' && !String(direct).startsWith('Team ')) return direct;
        } catch (_) {}
        const roster = rosterByAnyId(id);
        const user = leagueUsers.find(u => sameId(u.user_id, roster?.owner_id) || sameId(u.user_id, id));
        return user?.metadata?.team_name || user?.display_name || user?.username || fallback || 'Unknown';
    };
    const isResolvedOwner = (id) => {
        const name = ownerNameSafe(id, '');
        return !!name && name !== 'Unknown';
    };
    const completedChampionshipEntries = (championships) => Object.entries(championships || {})
        .filter(([, data]) => data?.champion && data?.runnerUp && isResolvedOwner(data.champion) && isResolvedOwner(data.runnerUp))
        .sort(([a], [b]) => String(b).localeCompare(String(a)));
    const tabMeta = {
        roster: { eyebrow: 'Roster Construction', desc: 'Compare your roster build against the teams that actually win this league.' },
        draft: { eyebrow: 'Draft Intelligence', desc: 'Hit rates, pick behavior, and current capital translated into draft-day strategy.' },
        trades: { eyebrow: 'Market Moves', desc: 'Trade efficiency, waiver/FAAB leverage, and how active winners create value.' },
        playoffs: { eyebrow: 'Playoff DNA', desc: 'Titles, finals, roadblocks, and bracket history without incomplete seasons muddying the read.' },
        timeline: { eyebrow: 'League Timeline', desc: 'Championship eras, major trades, and your team highlights across the league history.' },
        players: { eyebrow: 'All Players', desc: 'Full-player market explorer with analytics context and custom views.' },
        picks: { eyebrow: 'Draft Picks', desc: 'Future pick ownership, capital concentration, and your pick path by year.' },
        reports: { eyebrow: 'Report Lab', desc: 'Build reusable scouting and league reports from the same analytics source.' },
    };
    const activeMeta = tabMeta[analyticsTab] || tabMeta.roster;
    const actionBtnStyle = (primary) => ({
        padding: '6px 12px',
        background: primary ? 'var(--gold)' : 'rgba(212,175,55,0.1)',
        color: primary ? 'var(--black)' : 'var(--gold)',
        border: '1px solid ' + (primary ? 'var(--gold)' : 'rgba(212,175,55,0.28)'),
        borderRadius: '6px',
        fontFamily: 'Inter, sans-serif',
        fontSize: '0.72rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
    });
    const AnalyticsReadout = ({ title, children, detail }) => (
        <details className="analytics-readout" open>
            <summary>
                <span>{title}</span>
                {detail && <em>{detail}</em>}
            </summary>
            <div className="analytics-readout-body">{children}</div>
        </details>
    );
    const AnalyticsKpi = ({ label, value, sub, color }) => (
        <div className="analytics-kpi">
            <span>{label}</span>
            <strong style={{ color: color || 'var(--white)' }}>{value}</strong>
            {sub && <em>{sub}</em>}
        </div>
    );
    const AnalyticsSection = ({ title, meta, children }) => (
        <div className="analytics-panel">
            <div className="analytics-panel-head">
                <span>{title}</span>
                {meta && <em>{meta}</em>}
            </div>
            {children}
        </div>
    );

    return (
    <div className="analytics-shell" style={{ padding: '16px' }}>
        <div className="analytics-page-head">
            <div>
                <div className="analytics-kicker">{activeMeta.eyebrow}</div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.06em' }}>LEAGUE ANALYTICS</div>
                <p>{activeMeta.desc}</p>
            </div>
            <div className="analytics-head-meta">
                <span>Source</span>
                <strong>{d?.computedAt ? 'Updated' : 'Loading'}</strong>
                <em>{d?.computedAt ? new Date(d.computedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'League Intelligence'}</em>
            </div>
        </div>

        <div className="analytics-definition">Elite Tier Teams = playoff champions, runner-ups, and semi-finalists when available. If history is missing, Analytics falls back to current top performers by record and points.</div>

        {/* Sub-tab navigation */}
        <div className="analytics-subtabs" style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {subTabs.map(t => (
                <div key={t.key} style={subTabBtnStyle(analyticsTab === t.key)} onClick={() => setAnalyticsTab(t.key)}>{t.label}</div>
            ))}
        </div>

        {!d ? (
            <div style={{ ...aCardStyle, color: 'var(--silver)', textAlign: 'center', padding: '40px' }}>
                {window.App?.LI_LOADED ? 'Computing analytics...' : 'League Intelligence is still loading. Please wait...'}
            </div>
        ) : (
        <React.Fragment>

        {/* ═══ ROSTER CONSTRUCTION ═══ */}
        {analyticsTab === 'roster' && (() => {
            const r = d.roster;
            if (!r) return <div style={{ color: 'var(--silver)' }}>No roster data available.</div>;
            const w = r.winnerProfile;
            const l = r.leagueProfile;
            const m = r.myProfile;
            // Elite = top 5 at position
            const playerScores = window.App?.LI?.playerScores || {};
            const SS = _SS;
            const allRosters = SS?.rosters || [];
            const winnerIds = new Set(d.winners || []);
            const hasEliteFn = typeof window.App?.countElitePlayers === 'function';
            function countElite(rosterList) {
                if (!rosterList.length) return 0;
                let total = 0;
                rosterList.forEach(ros => {
                    total += hasEliteFn ? window.App.countElitePlayers(ros.players || []) : (ros.players || []).filter(pid => (playerScores[pid] || 0) >= 7000).length;
                });
                return +(total / rosterList.length).toFixed(1);
            }
            const wElite = countElite(allRosters.filter(ros => winnerIds.has(ros.roster_id)));
            const lElite = countElite(allRosters);
            const myRid = SS?.myRosterId;
            const mElite = countElite(allRosters.filter(ros => ros.roster_id === myRid));

            // Health score
            let healthScore = 0;
            let tier = 'UNKNOWN';
            let needs = [];
            let assessment = null;
            try {
                if (window.assessTeamFromGlobal) {
                    assessment = window.assessTeamFromGlobal(myRid);
                    if (assessment) {
                        healthScore = assessment.healthScore || 0;
                        tier = (assessment.tier || 'UNKNOWN').toUpperCase();
                        needs = assessment.needs || [];
                    }
                }
            } catch(e) { window.wrLog('analytics.assessTeam', e); }
            // Winner avg health
            let winnerHealthTotal = 0, winnerHealthCount = 0;
            try {
                winnerIds.forEach(wid => {
                    if (window.assessTeamFromGlobal) {
                        const wa = window.assessTeamFromGlobal(wid);
                        if (wa) { winnerHealthTotal += wa.healthScore || 0; winnerHealthCount++; }
                    }
                });
            } catch(e) { window.wrLog('analytics.winnerHealth', e); }
            const winnerHealthAvg = winnerHealthCount > 0 ? Math.round(winnerHealthTotal / winnerHealthCount) : 0;
            const healthDelta = healthScore - winnerHealthAvg;

            // Compete window
            const compWindow = d.window || {};
            const compYears = compWindow.years || 0;
            // Avg compete window — dead code removed

            // KPI sparkline data: build from projection years
            const projData = (d.projection || []).map(p => p.projectedDHQ);
            const healthData = (d.projection || []).map(p => p.projectedHealth || healthScore);

            // ── KPI Card style ──
            const kpiCardStyle = {
                background: 'linear-gradient(135deg, rgba(26,26,26,0.95), rgba(10,10,10,0.98))',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: '10px',
                padding: '10px 12px 8px',
                flex: '1 1 0',
                minWidth: '140px',
                position: 'relative',
                overflow: 'hidden',
            };
            const kpiNumberStyle = {
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: '1.8rem',
                lineHeight: 1,
                color: 'var(--white)',
                marginBottom: '2px',
            };
            const kpiLabelStyle = {
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.68rem',
                color: 'var(--silver)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                opacity: 0.7,
            };
            const kpiDeltaStyle = (positive) => ({
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: positive ? goodColor : badColor,
                marginTop: '4px',
            });

            // ── Position data for BarChart ──
            const posOrder = ['QB','RB','TE','WR','K','DL','LB','DB'];
            const allPos = [...new Set([...Object.keys(w.posInvestment || {}), ...Object.keys(m.posInvestment || {})])].filter(p => p !== 'UNK').sort((a,b) => { const ia = posOrder.indexOf(a); const ib = posOrder.indexOf(b); return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib); });
            const posBarItems = allPos.map(pos => ({
                label: pos,
                value: Math.round((m.posInvestment[pos] || 0) * 100),
                color: '#4ECDC4',
            }));
            const posBarWinnerItems = allPos.map(pos => ({
                label: pos,
                value: Math.round((w.posInvestment[pos] || 0) * 100),
                color: CHART_COLORS?.gold || '#D4AF37',
            }));

            // ── Radar data ──
            const radarValues = {};
            allPos.forEach(pos => {
                const wPct = (w.posInvestment[pos] || 0) * 100;
                const mPct = (m.posInvestment[pos] || 0) * 100;
                radarValues[pos] = Math.min(100, Math.round(mPct / Math.max(wPct, 1) * 100));
            });

            // ── Rankings: all teams sorted by health ──
            const teamRankings = [];
            allRosters.forEach(ros => {
                let hs = 0, tier = '';
                try {
                    if (window.assessTeamFromGlobal) {
                        const a = window.assessTeamFromGlobal(ros.roster_id);
                        if (a) { hs = a.healthScore || 0; tier = a.tier || ''; }
                    }
                } catch(e) { window.wrLog('rankings.assessTeam', e); }
                const totalDhq = (ros.players || []).reduce((s, pid) => s + (playerScores[pid] || 0), 0);
                const s = ros.settings || {};
                const rUser = currentLeague.users?.find(u => u.user_id === ros.owner_id);
                teamRankings.push({
                    rosterId: ros.roster_id,
                    name: ownerNameSafe(ros.roster_id),
                    teamName: rUser?.metadata?.team_name || '',
                    avatar: rUser?.avatar || null,
                    wins: s.wins || 0,
                    losses: s.losses || 0,
                    healthScore: hs,
                    totalDhq,
                    tier,
                    isMe: ros.roster_id === myRid,
                });
            });
            teamRankings.sort((a, b) => b.healthScore - a.healthScore);

            // ── Insight cards ──
            const insights = [];
            const projMyAgeInsight = m.avgAge + (timeDelta || 0);
            const ageDiff = projMyAgeInsight - w.avgAge;
            if (Math.abs(ageDiff) > 0.3) {
                insights.push({
                    color: ageDiff > 0 ? badColor : goodColor,
                    title: ageDiff > 0 ? 'Roster Running Older' : 'Youth Advantage',
                    text: 'Your roster is ' + Math.abs(ageDiff).toFixed(1) + ' years ' + (ageDiff > 0 ? 'older' : 'younger') + ' than champion average (' + w.avgAge.toFixed(1) + ' yrs).' + (timeDelta ? ' (projected for ' + timeYear + ')' : ''),
                });
            }
            if (m.avgBenchQuality < w.avgBenchQuality * 0.75) {
                insights.push({
                    color: warnColor,
                    title: 'Bench Depth Concern',
                    text: 'Bench quality (' + numFmt(m.avgBenchQuality) + ') is significantly below elite tier benchmark (' + numFmt(w.avgBenchQuality) + ').',
                });
            }
            if (m.avgTotalDHQ < w.avgTotalDHQ * 0.85) {
                insights.push({
                    color: badColor,
                    title: 'Total Value Gap',
                    text: 'Your total DHQ (' + numFmt(m.avgTotalDHQ) + ') trails elite tier average (' + numFmt(w.avgTotalDHQ) + ') by ' + Math.round((1 - m.avgTotalDHQ / w.avgTotalDHQ) * 100) + '%.',
                });
            }
            if (compYears >= 3) {
                insights.push({
                    color: goodColor,
                    title: 'Strong Compete Window',
                    text: compYears + ' years remaining in your competitive window. Maximize with targeted upgrades.',
                });
            }

            const rosterNeedGaps = (needs || []).map(n => {
                const data = assessment?.posAssessment?.[n.pos] || {};
                const required = data.minQuality || data.startingReq || data.ideal || 1;
                const have = data.nflStarters ?? data.actual ?? 0;
                const priority = n.urgency === 'deficit' ? 'critical' : 'high';
                return {
                    priority,
                    pos: n.pos,
                    action: (n.urgency === 'deficit' ? 'Add ' : 'Build ') + n.pos + (n.urgency === 'deficit' ? ' starter coverage' : ' depth'),
                    detail: n.pos + ' is a current roster ' + n.urgency + ': ' + have + '/' + required + ' starter-quality players by league settings.',
                    source: 'roster-assessment',
                };
            });
            const needsSet = new Set(rosterNeedGaps.map(g => g.pos));
            const templateGaps = (d.gaps || r.gaps || [])
                .filter(g => !g.pos || !needsSet.has(g.pos))
                .map(g => ({
                    ...g,
                    action: g.action || (g.area ? 'Template gap: ' + g.area : 'Champion-template gap'),
                    source: 'champion-template',
                }));
            const gapsList = [...rosterNeedGaps, ...templateGaps];

            // ── Roster Diagnosis Summary ──
            const projMyAge = m.avgAge + (timeDelta || 0);
            const projWAge = w.avgAge; // champion profile is historical, no projection needed
            const ageDiffDiag = projMyAge - projWAge;
            const eliteDiffDiag = mElite - wElite;
            const dhqGap = m.avgTotalDHQ - w.avgTotalDHQ;
            const benchGap = m.avgBenchQuality - w.avgBenchQuality;
            const rosterStrategy = ageDiffDiag > 1.5 && dhqGap < 0 ? 'sell aging veterans and acquire young elites'
                : eliteDiffDiag < -1 ? 'buy young elite players to close the talent gap'
                : dhqGap >= 0 && ageDiffDiag <= 0.5 ? 'hold course — your roster matches the elite tier template'
                : 'target strategic upgrades at your weakest positions';

            return (
            <React.Fragment>
                {/* ── ROSTER DIAGNOSIS — Alex Ingram Slack-style ── */}
                <AnalyticsReadout title="Roster Diagnosis" detail="What your roster needs next">
                        {(() => {
                            const parts = [];
                            // Tier intro
                            if (tier === 'ELITE') parts.push('You\'re built to win right now.');
                            else if (tier === 'CONTENDER') parts.push('You\'re in the mix — a move or two away from a title push.');
                            else if (tier === 'CROSSROADS') parts.push('You\'re at a crossroads. Not bad enough to blow it up, not good enough to compete for the title.');
                            else parts.push('Rebuilding mode. The goal right now is accumulating assets, not winning weekly matchups.');
                            // Age comparison
                            if (Math.abs(ageDiffDiag) >= 1) {
                                parts.push(ageDiffDiag > 0 ? 'Your roster skews older than typical elite tier teams — keep an eye on your window.' : 'You\'re younger than most contenders, which gives you a longer runway.');
                            }
                            // Needs
                            if (needs.length >= 2) parts.push('Your biggest gaps are at ' + needs.slice(0, 2).map(n => typeof n === 'string' ? n : n.pos).join(' and ') + '.');
                            else if (needs.length === 1) parts.push('Your main weakness is ' + (typeof needs[0] === 'string' ? needs[0] : needs[0].pos) + '.');
                            // Strategy
                            if (tier === 'ELITE' || tier === 'CONTENDER') parts.push('Protect your core and make surgical upgrades at weak spots.');
                            else if (tier === 'CROSSROADS') parts.push('Either commit to competing by filling gaps, or pivot to a rebuild and sell aging assets for picks.');
                            else parts.push('Target young players and draft capital. Sell veterans who won\'t be around for your next competitive window.');
                            return parts.join(' ');
                        })()}
                        {React.createElement('div', { className: 'analytics-action-row' },
                            React.createElement('button', { onClick: () => setActiveTab('trades'), style: actionBtnStyle(true) }, 'Find Trade Targets'),
                            React.createElement('button', { onClick: () => setActiveTab('fa'), style: actionBtnStyle(false) }, 'View Free Agents')
                        )}
                </AnalyticsReadout>

                {/* ── TOP KPI CARDS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    {/* Total DHQ */}
                    <div style={kpiCardStyle}>
                        <div style={kpiLabelStyle}>Total DHQ</div>
                        <div style={kpiNumberStyle}>{(m.avgTotalDHQ || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                        <div style={kpiDeltaStyle(m.avgTotalDHQ >= w.avgTotalDHQ)}>
                            {m.avgTotalDHQ >= w.avgTotalDHQ ? '\u25B2' : '\u25BC'} {Math.abs(Math.round((m.avgTotalDHQ - l.avgTotalDHQ) / Math.max(l.avgTotalDHQ, 1) * 100))}% vs lg avg
                        </div>
                        <div style={{ marginTop: '8px' }}>
                            {typeof Sparkline !== 'undefined' && projData.length >= 2 && React.createElement(Sparkline, { data: projData, width: 120, height: 28, color: m.avgTotalDHQ >= w.avgTotalDHQ ? goodColor : badColor })}
                        </div>
                    </div>
                    {/* Health Score */}
                    <div style={kpiCardStyle}>
                        <div style={kpiLabelStyle}>Health Score</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={kpiNumberStyle}>{healthScore}</div>
                            <div style={{ marginTop: '4px' }}>
                                {typeof MiniDonut !== 'undefined' && React.createElement(MiniDonut, { value: healthScore, size: 48, thickness: 5 })}
                            </div>
                        </div>
                        <div style={kpiDeltaStyle(healthDelta >= 0)}>
                            {healthDelta >= 0 ? '\u25B2' : '\u25BC'}{Math.abs(healthDelta)} vs elite tier
                        </div>
                    </div>
                    {/* Elite Count */}
                    <div style={kpiCardStyle}>
                        <div style={kpiLabelStyle}>Elite Players</div>
                        <div style={kpiNumberStyle}>{mElite}</div>
                        <div style={kpiDeltaStyle(mElite >= wElite)}>
                            {mElite >= Math.ceil(wElite) ? '= ' : '\u25BC '}{mElite >= Math.ceil(wElite) ? 'above' : Math.abs(mElite - Math.ceil(wElite)) + ' below'} elite tier ({Math.ceil(wElite)})
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--silver)', opacity: 0.5, marginTop: '4px' }}>Top 5 at position</div>
                    </div>
                    {/* Compete Window */}
                    <div style={kpiCardStyle}>
                        <div style={kpiLabelStyle}>Compete Window</div>
                        <div style={kpiNumberStyle}>{compYears}<span style={{ fontSize: '1rem', color: 'var(--silver)', marginLeft: '4px' }}>yr</span></div>
                        <div style={kpiDeltaStyle(compYears >= 3)}>
                            {compYears >= 3 ? '\u25B2 Strong' : compYears >= 1 ? '\u25AC Narrowing' : '\u25BC Rebuild mode'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.6, marginTop: '4px' }}>{compWindow.label || ''}</div>
                    </div>
                </div>

                <div className="analytics-action-grid">
                    <AnalyticsSection title="ACTION BOARD" meta="Highest leverage next moves">
                        <div className="analytics-signal-list">
                            {(gapsList.length ? gapsList.slice(0, 4) : [{ action: 'Hold the build', detail: 'No major roster-construction gap is showing against the elite tier template.', priority: 'low' }]).map((g, i) => {
                                const sev = g.priority || g.severity || 'low';
                                return (
                                    <div key={i} className={'analytics-signal analytics-signal-' + sev}>
                                        <strong>{g.action || g.area || 'Roster signal'}</strong>
                                        <span>{g.detail || 'Use Trade Center and Free Agency to close this roster gap.'}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </AnalyticsSection>
                    <AnalyticsSection title="ROOM SNAPSHOT" meta="Coverage and surplus">
                        <div className="analytics-chip-grid">
                            {['QB','RB','WR','TE','K','DL','LB','DB'].map(pos => {
                                const assessPos = assessment?.posAssessment?.[pos] || {};
                                const have = assessPos.nflStarters ?? assessPos.actual ?? 0;
                                const need = assessPos.minQuality || assessPos.startingReq || assessPos.ideal || 0;
                                const weak = (needs || []).some(n => (typeof n === 'string' ? n : n.pos) === pos);
                                const tone = weak ? 'bad' : have > need && need > 0 ? 'good' : 'neutral';
                                return (
                                    <div key={pos} className={'analytics-room-chip is-' + tone}>
                                        <strong>{pos}</strong>
                                        <span>{need ? have + '/' + need : have}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </AnalyticsSection>
                </div>

                {/* ── TWO-COLUMN CHART GRID ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '12px' }}>
                    {/* Left: Position Investment BarChart */}
                    <div style={aCardStyle}>
                        <div style={aHeaderStyle}><span>POSITION INVESTMENT</span></div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--silver)', opacity: 0.6, marginBottom: '10px', lineHeight: 1.5 }}>Position investment shows what % of your total roster DHQ is allocated to each position. For example, "QB: 18%" means 18% of your total dynasty value is in QBs.</div>
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--gold)', fontFamily: 'Inter, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Elite Tier Teams</div>
                            {typeof BarChart !== 'undefined' && React.createElement(BarChart, { items: posBarWinnerItems, width: Math.min(380, 360), height: 18, gap: 4 })}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: '#4ECDC4', fontFamily: 'Inter, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>You</div>
                            {typeof BarChart !== 'undefined' && React.createElement(BarChart, { items: posBarItems, width: Math.min(380, 360), height: 18, gap: 4 })}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.72rem' }}>
                            <span style={{ color: 'var(--gold)' }}>{'\u25A0'} Elite Tier %</span>
                            <span style={{ color: '#4ECDC4' }}>{'\u25A0'} Your %</span>
                        </div>
                    </div>

                    {/* Right: Gap Analysis Visual Cards */}
                    <div style={aCardStyle}>
                        <div style={aHeaderStyle}><span>GAP ANALYSIS</span></div>
                        {gapsList.length === 0 && <div style={{ color: goodColor, fontSize: '0.9rem', padding: '12px 0' }}>Your roster matches the elite tier template closely.</div>}
                        {gapsList.slice().sort((a,b) => { const sevOrder = {critical:0,high:1,medium:2,low:3}; return (sevOrder[a.priority||a.severity]||9) - (sevOrder[b.priority||b.severity]||9); }).slice(0, 6).map((g, i) => {
                            const sev = g.priority || g.severity || 'low';
                            const sevBg = sev === 'high' || sev === 'critical' ? 'rgba(231,76,60,0.08)' : sev === 'medium' ? 'rgba(240,165,0,0.08)' : 'rgba(46,204,113,0.06)';
                            const gapDhq = (typeof g.winners === 'number' && typeof g.yours === 'number' && g.unit !== '%') ? Math.max(0, g.winners - g.yours) : 0;
                            // Parse position from gap title/name/area/action if g.pos is missing
                            const gapPos = g.pos || (g.title || g.name || g.area || g.action || '').match(/\b(QB|RB|WR|TE|K|DL|LB|DB)\b/)?.[1] || null;
                            const avgPlayerVal = gapPos ? ({QB:8000,RB:5500,WR:5500,TE:5000,K:2000,DL:3500,LB:3500,DB:3500}[gapPos] || 4000) : 4000;
                            const neededPlayers = gapDhq > 0 ? Math.max(1, Math.round(gapDhq / avgPlayerVal)) : 0;
                            return (
                            <div key={i} style={{
                                padding: '10px 14px', marginBottom: '8px',
                                background: sevBg,
                                borderLeft: '3px solid ' + sevColor(sev),
                                borderRadius: '0 8px 8px 0',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: sevColor(sev), fontWeight: 700, fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                                        {g.action || g.area}
                                    </span>
                                    <span style={{
                                        fontSize: '0.65rem', fontFamily: 'Inter, sans-serif', padding: '2px 8px',
                                        borderRadius: '10px', background: sevColor(sev), color: 'var(--black)', fontWeight: 700,
                                    }}>
                                        {(sev).toUpperCase()}
                                    </span>
                                </div>
                                {g.source && <div style={{ color: 'var(--silver)', fontSize: '0.66rem', opacity: 0.55, marginTop: '3px', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {g.source === 'roster-assessment' ? 'Current roster need' : 'Champion template'}
                                </div>}
                                <div style={{ color: 'var(--silver)', fontSize: '0.78rem', marginTop: '4px' }}>
                                    {g.detail || (neededPlayers > 0 && gapPos
                                        ? 'Need ~' + neededPlayers + ' more ' + gapPos + (neededPlayers > 1 ? 's' : '') + ' to match elite tier'
                                        : (g.yours != null && g.winners != null
                                            ? (g.unit === '%' ? pctFmt(g.yours) + ' (elite tier: ' + pctFmt(g.winners) + ')' : numFmt(g.yours) + ' ' + (g.unit || 'DHQ') + ' (elite tier: ' + numFmt(g.winners) + ')')
                                            : ''))}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── INSIGHT CARDS ── */}
                {insights.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                    {insights.map((ins, i) => (
                        <div key={i} style={{
                            background: 'rgba(26,26,26,0.8)', borderRadius: '10px', padding: '14px 16px',
                            borderLeft: '4px solid ' + ins.color,
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: ins.color, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {ins.title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--silver)', lineHeight: 1.5 }}>{ins.text}</div>
                        </div>
                    ))}
                </div>
                )}

                {/* ── 5-YEAR OUTLOOK (moved from Projections) ── */}
                {(() => {
                    const proj = d.projection;
                    const win = d.window;
                    if (!proj || !proj.length) return null;
                    const maxDHQ = Math.max(...proj.map(p => p.projectedDHQ), 1);
                    const tierColor = (tier) => tier === 'Contender' ? goodColor : tier === 'Playoff Team' ? warnColor : badColor;
                    return (
                        <div style={{ ...aCardStyle, marginTop: '12px' }}>
                            <div style={aHeaderStyle}><span>YOUR 5-YEAR OUTLOOK</span></div>
                            {proj.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                    <span style={{ color: 'var(--silver)', fontFamily: 'Inter, sans-serif', minWidth: '40px', fontSize: '0.9rem' }}>{p.year}</span>
                                    <div style={{ flex: 1, position: 'relative', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: (p.projectedDHQ / maxDHQ * 100) + '%', background: tierColor(p.tier), borderRadius: '6px', opacity: 0.6, transition: 'width 0.5s ease' }} />
                                        <div style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', color: 'var(--white)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {p.projectedDHQ.toLocaleString()} DHQ
                                        </div>
                                    </div>
                                    <span style={{ color: tierColor(p.tier), fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', minWidth: '90px', textAlign: 'right' }}>
                                        {p.tier} {p.tier === 'Rebuilding' || p.tier === 'Deep Rebuild' ? '\uD83D\uDD34' : p.tier === 'Playoff Team' ? '\u26A0\uFE0F' : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    );
                })()}

                {/* ── AGING CLIFF ALERT (moved from Projections) ── */}
                {(() => {
                    const S2 = _SS;
                    const LI2 = window.App?.LI || {};
                    const ps2 = LI2.playerScores || {};
                    const pm2 = LI2.playerMeta || {};
                    const pw2 = window.App?.peakWindows || {};
                    const myRid2 = S2?.myRosterId;
                    const myRos2 = (S2?.rosters || []).find(r => r.roster_id === myRid2);
                    const myPl2 = myRos2?.players || [];
                    let tDHQ2 = 0, arDHQ2 = 0;
                    const arPlayers2 = [];
                    myPl2.forEach(pid => {
                        const dq = ps2[pid] || 0;
                        const mt = pm2[pid] || {};
                        tDHQ2 += dq;
                        if (!mt.age || !mt.pos) return;
	                        const valueEnd = typeof window.App?.getValueWindowEnd === 'function'
	                            ? window.App.getValueWindowEnd(mt.pos)
	                            : ((window.App.peakWindows || {})[mt.pos] || [23, 29])[1];
	                        if (mt.age + 2 > valueEnd && dq >= 2000) {
                            arDHQ2 += dq;
                            arPlayers2.push({ name: playersData[pid]?.full_name || S2?.players?.[pid]?.full_name || mt.name || ('Player ' + pid), age: mt.age, dhq: dq });
                        }
                    });
                    const arPct2 = tDHQ2 > 0 ? Math.round(arDHQ2 / tDHQ2 * 100) : 0;
                    arPlayers2.sort((a, b) => b.dhq - a.dhq);
                    if (!arPlayers2.length && arPct2 === 0) return null;
                    return (
                        <div style={{ ...aCardStyle, marginTop: '12px' }}>
                            <div style={aHeaderStyle}><span>AGING CLIFF ALERT</span></div>
	                            <div style={{ fontSize: '0.74rem', color: 'var(--silver)', opacity: 0.6, marginBottom: '10px', lineHeight: 1.5 }}>Players within 2 years of their position's value-window end with 2000+ DHQ value. These are your highest-risk assets for dynasty value decline.</div>
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', color: arPct2 > 30 ? badColor : arPct2 > 15 ? warnColor : goodColor }}>{arPct2}%</div>
	                                    <div style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>Your DHQ near value cliff by {(parseInt(S2?.season) || 2026) + 2}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    {(() => {
                                        let lgT = 0, lgA = 0;
                                        (S2?.rosters || []).forEach(r => {
                                            (r.players || []).forEach(pid => {
                                                const dv = ps2[pid] || 0;
                                                const mv = pm2[pid] || {};
                                                lgT += dv;
                                                if (mv.age && mv.pos) {
                                                    const pe = ((window.App?.peakWindows || {})[mv.pos] || [23,29])[1];
                                                    if (mv.age + 2 > pe && dv >= 2000) lgA += dv;
                                                }
                                            });
                                        });
                                        const lgP = lgT > 0 ? Math.round(lgA / lgT * 100) : 0;
                                        return <>
                                            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', color: 'var(--gold)' }}>{lgP}%</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>League avg</div>
                                        </>;
                                    })()}
                                </div>
                            </div>
                            {arPlayers2.length > 0 && (
                                <div>
                                    <div style={{ color: 'var(--silver)', fontSize: '0.8rem', marginBottom: '6px', fontWeight: 700 }}>Players at risk:</div>
                                    {arPlayers2.slice(0, 5).map((p, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
                                            <span style={{ color: 'var(--silver)' }}>{p.name} ({p.age})</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: badColor }}>{p.dhq.toLocaleString()} DHQ</span>
                                                <span style={{ padding: '2px 8px', background: 'rgba(231,76,60,0.15)', color: badColor, borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>TRADE NOW</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </React.Fragment>
            );
        })()}

        {/* ═══ DRAFT INTELLIGENCE ═══ */}
        {analyticsTab === 'draft' && (() => {
            const dr = d.draft;
            if (!dr) return <div style={{ color: 'var(--silver)' }}>No draft data available.</div>;
            const rounds = Object.keys(dr.winnerDraftProfile || {}).map(Number).sort((a, b) => a - b);
            const S = _SS;
            const myRid = S?.myRosterId;
            const draftOutcomes = (window.App?.LI || {}).draftOutcomes || [];
            const myDraftProfile = {};
            rounds.forEach(rd => {
                const myPicks = draftOutcomes.filter(dp => dp.round === rd && dp.roster_id === myRid);
                if (!myPicks.length) return;
                const posCounts = {};
                myPicks.forEach(dp => { const pos = dp.pos || 'UNK'; posCounts[pos] = (posCounts[pos] || 0) + 1; });
                myDraftProfile[rd] = {};
                Object.entries(posCounts).forEach(([pos, cnt]) => { myDraftProfile[rd][pos] = +(cnt / myPicks.length).toFixed(2); });
            });
            let totalHitDiff = 0;
            let hitRounds = 0;
            let winnerHitAvg = 0, leagueHitAvg = 0;
            rounds.forEach(rd => {
                const hr = dr.winnerHitRate[rd];
                if (!hr) return;
                totalHitDiff += (hr.winners - hr.league);
                winnerHitAvg += hr.winners;
                leagueHitAvg += hr.league;
                hitRounds++;
            });
            const avgHitAdv = hitRounds > 0 ? totalHitDiff / hitRounds : 0;
            winnerHitAvg = hitRounds > 0 ? winnerHitAvg / hitRounds : 0;
            leagueHitAvg = hitRounds > 0 ? leagueHitAvg / hitRounds : 0;
            const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'];
            const gradeIdx = Math.min(grades.length - 1, Math.max(0, Math.round(4 - avgHitAdv * 20)));
            const totalMyPicks = draftOutcomes.filter(dp => dp.roster_id === myRid).length;
            // Compute top draft position for winners
            const winnerTopPos = {};
            rounds.forEach(rd => {
                Object.entries(dr.winnerDraftProfile[rd] || {}).forEach(([pos, pct]) => {
                    winnerTopPos[pos] = (winnerTopPos[pos] || 0) + pct;
                });
            });
            const topDraftTarget = Object.entries(winnerTopPos).sort((a,b) => b[1] - a[1])[0];

            // KPI card style
            const dKpiCardStyle = {
                background: 'linear-gradient(135deg, rgba(26,26,26,0.95), rgba(10,10,10,0.98))',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: '14px',
                padding: '20px 18px 14px',
                flex: '1 1 0',
                minWidth: '140px',
            };
            const dKpiNum = { fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', lineHeight: 1, color: 'var(--white)', marginBottom: '2px' };
            const dKpiLabel = { fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 };

            // Build bar chart items for hit rate by round
            const hitRateBarItems = rounds.filter(rd => dr.winnerHitRate[rd]).map(rd => ({
                label: 'R' + rd,
                value: Math.round((dr.winnerHitRate[rd].winners || 0) * 100),
                color: goodColor,
            }));
            const hitRateLeagueItems = rounds.filter(rd => dr.winnerHitRate[rd]).map(rd => ({
                label: 'R' + rd,
                value: Math.round((dr.winnerHitRate[rd].league || 0) * 100),
                color: 'rgba(192,192,192,0.6)',
            }));

            // ── Draft Strategy Summary ──
            const myHitRates = {};
            rounds.forEach(rd => {
                const myPicks = draftOutcomes.filter(dp => dp.round === rd && dp.roster_id === myRid);
                if (!myPicks.length) return;
                const hits = myPicks.filter(dp => dp.isHit).length;
                myHitRates[rd] = myPicks.length > 0 ? hits / myPicks.length : 0;
            });
            const myR1Hit = myHitRates[1] || 0;
            const winnerR1Hit = (dr.winnerHitRate[1] || {}).winners || 0;
            const topDraftPos = topDraftTarget ? topDraftTarget[0] : 'RB/WR';
            const draftGradeLetter = grades[gradeIdx];
            const leagueSeason = parseInt(currentLeague?.season || activeYear, 10) || new Date().getFullYear();
            const draftRounds = Number(currentLeague?.settings?.draft_rounds || 5);
            const totalTeams = leagueRosters.length || 12;
            const tradedPicks = _SS.tradedPicks || [];
            const pickValue = (yr, rd) => window.App?.PlayerValue?.getPickValue?.(yr, rd, totalTeams) || Math.max(100, 9000 - rd * 1600);
            const currentPicks = [];
            for (let yr = leagueSeason; yr <= leagueSeason + 2; yr++) {
                for (let rd = 1; rd <= draftRounds; rd++) {
                    const ownMoved = tradedPicks.find(p => sameId(p.season, yr) && Number(p.round) === rd && sameId(p.roster_id, myRid) && !sameId(p.owner_id, myRid));
                    if (!ownMoved) currentPicks.push({ year: yr, round: rd, own: true, label: (yr === leagueSeason ? 'R' : String(yr).slice(-2) + ' R') + rd, value: pickValue(yr, rd) });
                    tradedPicks
                        .filter(p => sameId(p.season, yr) && Number(p.round) === rd && sameId(p.owner_id, myRid) && !sameId(p.roster_id, myRid))
                        .forEach(p => currentPicks.push({ year: yr, round: rd, own: false, from: ownerNameSafe(p.roster_id), label: (yr === leagueSeason ? 'R' : String(yr).slice(-2) + ' R') + rd + ' via ' + ownerNameSafe(p.roster_id), value: pickValue(yr, rd) }));
                }
            }
            const currentPickValue = currentPicks.reduce((s, p) => s + (p.value || 0), 0);
            const earlyPicks = currentPicks.filter(p => p.round <= 2).length;
            const topCurrentPicks = [...currentPicks].sort((a, b) => b.value - a.value || a.year - b.year || a.round - b.round).slice(0, 5);

            return (
            <React.Fragment>
                {/* ── DRAFT STRATEGY SUMMARY ── */}
                <AnalyticsReadout title="Draft Intelligence" detail="Hit-rate read plus current capital">
                        {!dr.winnerHitRate || Object.keys(dr.winnerHitRate).length === 0
                            ? 'Your upcoming draft picks and league draft intelligence. Target exciting prospects that fit your roster needs.'
                            : totalMyPicks === 0
                            ? 'No draft picks recorded for your team yet. Elite tier teams hit ' + Math.round(winnerR1Hit * 100) + '% on R1 picks in this league \u2014 prioritize ' + topDraftPos + ' in early rounds based on the elite tier template.'
                            : 'Your draft grade: ' + draftGradeLetter + ' \u2014 ' + (gradeIdx <= 2 ? 'elite drafter, a real advantage' : gradeIdx <= 5 ? 'average, not a competitive edge' : 'below average, costing you roster value') + '. Elite tier teams hit ' + Math.round(winnerR1Hit * 100) + '% in R1 vs your ' + Math.round(myR1Hit * 100) + '%. Recommendation: prioritize ' + topDraftPos + ' in R1-R2 based on the elite tier template. ' + (totalMyPicks < 10 ? 'You have limited draft history \u2014 accumulate picks to build through the draft.' : 'Focus on hit rate over volume.')}
                        {React.createElement('div', { className: 'analytics-action-row' },
                            React.createElement('button', { onClick: () => setActiveTab('draft'), style: actionBtnStyle(true) }, 'Open Draft Board')
                        )}
                </AnalyticsReadout>

                {/* ── TOP KPI CARDS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <div style={dKpiCardStyle}>
                        <div style={dKpiLabel}>Draft Grade</div>
                        <div style={{ ...dKpiNum, fontSize: '2rem', color: gradeIdx <= 2 ? goodColor : gradeIdx <= 5 ? warnColor : badColor }}>{grades[gradeIdx]}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.6 }}>Based on hit rate advantage</div>
                    </div>
                    <div style={dKpiCardStyle}>
                        <div style={dKpiLabel}>Avg Hit Rate</div>
                        <div style={dKpiNum}>{pctFmt(winnerHitAvg)}</div>
                        <div style={{ fontSize: '0.72rem', color: goodColor, fontFamily: 'Inter, sans-serif' }}>
                            +{Math.round(avgHitAdv * 100)}% vs league ({pctFmt(leagueHitAvg)})
                        </div>
                    </div>
                    <div style={dKpiCardStyle}>
                        <div style={dKpiLabel}>Round 1 Hit Rate</div>
                        <div style={dKpiNum}>{pctFmt(winnerR1Hit)}</div>
                        <div style={{ fontSize: '0.72rem', color: myR1Hit >= winnerR1Hit ? goodColor : warnColor, fontFamily: 'Inter, sans-serif' }}>
                            You: {pctFmt(myR1Hit)}
                        </div>
                    </div>
                    <div style={dKpiCardStyle}>
                        <div style={dKpiLabel}>Your Draft Picks</div>
                        <div style={dKpiNum}>{currentPicks.length || '\u2014'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.6 }}>{earlyPicks} in R1-R2</div>
                    </div>
                    <div style={dKpiCardStyle}>
                        <div style={dKpiLabel}>Champions Draft</div>
                        <div style={dKpiNum}>{topDraftTarget ? topDraftTarget[0] : '\u2014'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gold)', opacity: 0.7 }}>Most picked position by championship teams</div>
                    </div>
                </div>

                <div className="analytics-action-grid">
                    <AnalyticsSection title="CURRENT PICK STRATEGY" meta={(currentPickValue || 0).toLocaleString() + ' pick DHQ'}>
                        <div className="analytics-pick-strip">
                            {topCurrentPicks.length ? topCurrentPicks.map((p, i) => (
                                <span key={i} className={p.own ? '' : 'is-acquired'}>{p.label} <em>{(p.value || 0).toLocaleString()}</em></span>
                            )) : <span>No current pick capital loaded</span>}
                        </div>
                    </AnalyticsSection>
                    <AnalyticsSection title="DRAFT EDGE" meta="How to use the formula">
                        <div className="analytics-signal-list">
                            <div className="analytics-signal analytics-signal-low"><strong>Early rounds</strong><span>Prioritize {topDraftPos} unless value clearly falls at another need.</span></div>
                            <div className="analytics-signal analytics-signal-medium"><strong>Trade line</strong><span>{earlyPicks >= 3 ? 'You have enough early capital to consolidate for proven points.' : 'Limited early capital means pick swaps should protect upside.'}</span></div>
                        </div>
                    </AnalyticsSection>
                </div>

                {/* ── TWO-COLUMN: Hit Rates + Draft Formula ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '12px' }}>
                    {/* Hit Rates as BarChart */}
                    <div style={aCardStyle}>
                        <div style={aHeaderStyle}><span>HIT RATES BY ROUND</span></div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--silver)', opacity: 0.6, marginBottom: '10px', lineHeight: 1.5 }}>Hit rate = % of picks at each round that became starter-quality players (top of their position group). Higher hit rate = better draft scouting.</div>
                        <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '0.7rem', color: goodColor, fontFamily: 'Inter, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Elite Tier Teams</div>
                            {typeof BarChart !== 'undefined' && React.createElement(BarChart, { items: hitRateBarItems, width: 340, height: 18, gap: 4 })}
                        </div>
                        <div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--silver)', fontFamily: 'Inter, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>League Avg</div>
                            {typeof BarChart !== 'undefined' && React.createElement(BarChart, { items: hitRateLeagueItems, width: 340, height: 18, gap: 4 })}
                        </div>
                    </div>

                    {/* Draft Formula */}
                    <div style={aCardStyle}>
                        <div style={aHeaderStyle}>WINNING DRAFT FORMULA</div>
                        {rounds.map(rd => {
                            const wProf = dr.winnerDraftProfile[rd] || {};
                            const myProf = myDraftProfile[rd] || {};
                            const sorted = Object.entries(wProf).sort((a, b) => b[1] - a[1]);
                            return (
                            <div key={rd} style={{ marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1rem', color: 'var(--gold)', minWidth: '65px' }}>Round {rd}</span>
                                    <div style={{ flex: 1, display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {sorted.map(([pos, pct]) => (
                                            <span key={pos} style={{
                                                fontSize: '0.72rem', fontFamily: 'Inter, sans-serif', padding: '2px 8px',
                                                borderRadius: '10px', background: 'rgba(212,175,55,0.12)', color: 'var(--gold)',
                                                border: '1px solid rgba(212,175,55,0.25)',
                                            }}>{pos} {pctFmt(pct)}</span>
                                        ))}
                                    </div>
                                </div>
                                {Object.keys(myProf).length > 0 && (
                                    <div style={{ marginLeft: '65px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {Object.entries(myProf).sort((a, b) => b[1] - a[1]).map(([pos, pct]) => (
                                            <span key={pos} style={{
                                                fontSize: '0.68rem', fontFamily: 'Inter, sans-serif', padding: '1px 6px',
                                                borderRadius: '8px', background: 'rgba(78,205,196,0.1)', color: '#4ECDC4',
                                                border: '1px solid rgba(78,205,196,0.2)',
                                            }}>{pos} {pctFmt(pct)}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            );
                        })}
                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.7rem' }}>
                            <span style={{ color: 'var(--gold)' }}>{'\u25A0'} Elite Tier</span>
                            <span style={{ color: '#4ECDC4' }}>{'\u25A0'} You</span>
                        </div>
                    </div>
                </div>
            </React.Fragment>
            );
        })()}

        {/* ═══ MARKET MOVES INTELLIGENCE ═══ */}
        {analyticsTab === 'trades' && (() => {
            const tr = d.trades;
            if (!tr) return <div style={{ color: 'var(--silver)' }}>No trade data available.</div>;
            const wa = d.waivers || {};
            const wp = tr.winnerTradeProfile;
            const lp = tr.leagueTradeProfile;
            const mp = tr.myTradeProfile;
            const cleanPreference = (v) => (!v || v === 'Unknown') ? 'No pattern' : v;
            const waiverBudget = Number(currentLeague?.settings?.waiver_budget || 0);
            const waiverUsed = Number(myRoster?.settings?.waiver_budget_used || 0);
            const faabRemaining = waiverBudget > 0 ? Math.max(0, waiverBudget - waiverUsed) : null;
            const faabEfficiency = wa.faabEfficiency || {};
            const topFaabPos = Object.entries(wa.leagueFaabProfile || {})
                .sort((a, b) => (b[1].avg || 0) - (a[1].avg || 0))[0];
            const topEffPos = Object.entries(wa.faabEffByPos || {})
                .sort((a, b) => (b[1].dhqPerDollar || 0) - (a[1].dhqPerDollar || 0))[0];
            const topPosBought = (prof) => {
                const entries = Object.entries(prof.positionsBought || {}).sort((a, b) => b[1] - a[1]);
                return entries.slice(0, 3).map(([p]) => p).join(', ') || '\u2014';
            };
            const alerts = [];
            if (mp.avgTradesPerSeason < lp.avgTradesPerSeason) alerts.push({ sev: 'medium', title: 'Low Trade Volume', msg: 'You trade below league average (' + mp.avgTradesPerSeason + ' vs ' + lp.avgTradesPerSeason + ' per season). Elite tier teams average ' + wp.avgTradesPerSeason + '.' });
            if (mp.avgValueGained < 0) alerts.push({ sev: 'high', title: 'Losing Value', msg: 'You\'re losing ' + Math.abs(mp.avgValueGained) + ' DHQ per trade on average. Elite tier teams gain +' + wp.avgValueGained + '.' });
            if (wp.partnerPreference && wp.partnerPreference !== 'Unknown' && wp.partnerPreference !== mp.partnerPreference) alerts.push({ sev: 'low', title: 'Trade Partner Strategy', msg: 'Elite tier teams target ' + cleanPreference(wp.partnerPreference) + ' teams. You trade with ' + cleanPreference(mp.partnerPreference) + ' teams.' });

            // Build position bought bar chart items
            const allBoughtPos = [...new Set([...Object.keys(wp.positionsBought || {}), ...Object.keys(mp.positionsBought || {})])].filter(p => p !== 'UNK').sort();
            const boughtBarWinner = allBoughtPos.map(pos => ({ label: pos, value: (wp.positionsBought || {})[pos] || 0, color: CHART_COLORS?.gold || '#D4AF37' }));
            const boughtBarYou = allBoughtPos.map(pos => ({ label: pos, value: (mp.positionsBought || {})[pos] || 0, color: '#4ECDC4' }));

            // KPI card style
            const tKpiCardStyle = {
                background: 'linear-gradient(135deg, rgba(26,26,26,0.95), rgba(10,10,10,0.98))',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: '14px',
                padding: '20px 18px 14px',
                flex: '1 1 0',
                minWidth: '140px',
            };
            const tKpiNum = { fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', lineHeight: 1, color: 'var(--white)', marginBottom: '2px' };
            const tKpiLabel = { fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 };

            const valueDeltaColor = mp.avgValueGained >= 0 ? goodColor : badColor;

            // ── Trade Strategy Summary ──
            const tradeVolDiff = mp.avgTradesPerSeason - wp.avgTradesPerSeason;
            const hasTraded = mp.avgTradesPerSeason > 0;
            const tradeEfficiency = !hasTraded ? '' : mp.avgValueGained >= 0 ? 'trading efficiently' : 'over-paying in trades';
            const tradeActivity = !hasTraded ? '' : tradeVolDiff < -1 ? 'under-trading' : tradeVolDiff > 1 ? 'over-trading' : 'trading at the right frequency';

            const tradeSummaryText = !hasTraded
                ? 'You haven\u2019t made any trades yet. Active trading is a key trait of winning teams \u2014 elite tier teams average ' + wp.avgTradesPerSeason + ' trades/season and gain +' + wp.avgValueGained + ' DHQ per trade. Consider using the trade finder to identify value opportunities.'
                : 'You average ' + mp.avgTradesPerSeason + ' trades/season vs elite tier teams\' ' + wp.avgTradesPerSeason + '. You ' + (mp.avgValueGained >= 0 ? 'gain +' : 'lose ') + Math.abs(mp.avgValueGained) + ' DHQ per trade (elite tier: +' + wp.avgValueGained + '). You are ' + tradeActivity + ' and ' + tradeEfficiency + '. ' + (mp.avgValueGained < 0 ? 'Focus on extracting value \u2014 target aging stars from contenders or sell depreciating assets.' : 'Keep leveraging your trade edge to consolidate elite talent.');
            const assetListText = (items) => {
                const clean = (items || []).filter(x => x && x !== 'Unknown');
                return clean.length ? clean.join(', ') : 'Picks/assets';
            };

            return (
            <React.Fragment>
                {/* ── MARKET STRATEGY SUMMARY ── */}
                <AnalyticsReadout title="Market Moves" detail="Trades plus waiver and FAAB leverage">
                        {tradeSummaryText}
                        {topFaabPos ? ' Waiver market prices are highest at ' + topFaabPos[0] + ' (avg $' + Math.round(topFaabPos[1].avg || 0) + ').' : ' Waiver bid history is still thin, so FAAB reads are directional.'}
                        {React.createElement('div', { className: 'analytics-action-row' },
                            React.createElement('button', { onClick: () => { setTradeSubTab('finder'); setActiveTab('trades'); }, style: actionBtnStyle(true) }, 'Open Trade Finder'),
                            React.createElement('button', { onClick: () => setActiveTab('fa'), style: actionBtnStyle(false) }, 'Open Free Agency')
                        )}
                </AnalyticsReadout>

                {/* ── TOP KPI CARDS ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', marginBottom: '12px' }}>
                    <div style={tKpiCardStyle}>
                        <div style={tKpiLabel}>Your Trades/Season</div>
                        <div style={tKpiNum}>{mp.avgTradesPerSeason}</div>
                        <div style={{ fontSize: '0.72rem', color: mp.avgTradesPerSeason >= lp.avgTradesPerSeason ? goodColor : warnColor, fontFamily: 'Inter, sans-serif' }}>
                            {mp.avgTradesPerSeason >= lp.avgTradesPerSeason ? '\u25B2' : '\u25BC'} League avg: {lp.avgTradesPerSeason}
                        </div>
                    </div>
                    <div style={tKpiCardStyle}>
                        <div style={tKpiLabel}>Avg DHQ Gained</div>
                        <div style={{ ...tKpiNum, color: valueDeltaColor }}>{(mp.avgValueGained >= 0 ? '+' : '') + mp.avgValueGained}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gold)', fontFamily: 'Inter, sans-serif' }}>
                            Elite Tier: +{wp.avgValueGained}
                        </div>
                    </div>
                    <div style={tKpiCardStyle}>
                        <div style={tKpiLabel}>Elite Tier Volume</div>
                        <div style={tKpiNum}>{wp.avgTradesPerSeason}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.6 }}>trades per season</div>
                    </div>
                    <div style={tKpiCardStyle}>
                        <div style={tKpiLabel}>Top Positions Bought</div>
                        <div style={{ ...tKpiNum, fontSize: '1.3rem' }}>{topPosBought(wp)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gold)', opacity: 0.7 }}>Positions champions acquire most via trade</div>
                    </div>
                    <div style={tKpiCardStyle}>
                        <div style={tKpiLabel}>FAAB Remaining</div>
                        <div style={{ ...tKpiNum, color: faabRemaining == null ? 'var(--silver)' : faabRemaining >= waiverBudget * 0.5 ? goodColor : warnColor }}>{faabRemaining == null ? '\u2014' : '$' + faabRemaining.toLocaleString()}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.6 }}>{waiverBudget ? '$' + waiverBudget.toLocaleString() + ' budget' : 'No FAAB budget'}</div>
                    </div>
                    <div style={tKpiCardStyle}>
                        <div style={tKpiLabel}>FAAB Efficiency</div>
                        <div style={{ ...tKpiNum, color: (faabEfficiency.winners || 0) >= (faabEfficiency.league || 0) ? goodColor : 'var(--gold)' }}>{faabEfficiency.winners || '\u2014'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.6 }}>winner DHQ per $ · league {faabEfficiency.league || '\u2014'}</div>
                    </div>
                </div>

                <div className="analytics-action-grid">
                    <AnalyticsSection title="WAIVER PRICE MAP" meta={topEffPos ? 'Best yield: ' + topEffPos[0] : 'Bid history'}>
                        <div className="analytics-mini-table">
                            {Object.entries(wa.leagueFaabProfile || {}).sort((a, b) => (b[1].avg || 0) - (a[1].avg || 0)).slice(0, 6).map(([pos, info]) => (
                                <div key={pos}><strong>{pos}</strong><span>${Math.round(info.avg || 0)} avg</span><em>{info.count || 0} bids</em></div>
                            ))}
                            {!Object.keys(wa.leagueFaabProfile || {}).length && <div><strong>No FAAB history</strong><span>Use Free Agency recommendations until transactions load.</span></div>}
                        </div>
                    </AnalyticsSection>
                    <AnalyticsSection title="MARKET TIMING" meta="When winners act">
                        <div className="analytics-mini-table">
                            {[
                                ['Early', wa.winnerTiming?.early, wa.leagueTiming?.early],
                                ['Mid', wa.winnerTiming?.mid, wa.leagueTiming?.mid],
                                ['Late', wa.winnerTiming?.late, wa.leagueTiming?.late],
                            ].map(([label, winners, league]) => (
                                <div key={label}><strong>{label}</strong><span>{pctFmt(winners || 0)} winners</span><em>{pctFmt(league || 0)} league</em></div>
                            ))}
                        </div>
                    </AnalyticsSection>
                </div>

                {/* ── TWO-COLUMN: Position Bought + Trade Profile Table ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '12px' }}>
                    {/* Positions Bought BarChart */}
                    <div style={aCardStyle}>
                        <div style={aHeaderStyle}>POSITIONS ACQUIRED VIA TRADE</div>
                        {allBoughtPos.length > 0 ? (
                        <React.Fragment>
                            <div style={{ marginBottom: '10px' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--gold)', fontFamily: 'Inter, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Elite Tier Teams</div>
                                {typeof BarChart !== 'undefined' && React.createElement(BarChart, { items: boughtBarWinner, width: 340, height: 18, gap: 4 })}
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: '#4ECDC4', fontFamily: 'Inter, sans-serif', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>You</div>
                                {typeof BarChart !== 'undefined' && React.createElement(BarChart, { items: boughtBarYou, width: 340, height: 18, gap: 4 })}
                            </div>
                            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.7rem' }}>
                                <span style={{ color: 'var(--gold)' }}>{'\u25A0'} Elite Tier</span>
                                <span style={{ color: '#4ECDC4' }}>{'\u25A0'} You</span>
                            </div>
                        </React.Fragment>
                        ) : <div style={{ color: 'var(--silver)', fontSize: '0.85rem', opacity: 0.6 }}>No position data available</div>}
                    </div>

                    {/* Trade Comparison Table */}
                    <div style={aCardStyle}>
                        <div style={aHeaderStyle}>TRADE COMPARISON</div>
                        {/* Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '8px', padding: '8px 0', fontWeight: 700, color: 'var(--gold)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid rgba(212,175,55,0.2)', fontFamily: 'Inter, sans-serif' }}>
                            <div>Metric</div><div>Elite Tier</div><div>League</div><div>You</div>
                        </div>
                        {[
                            ['Trades/Season', wp.avgTradesPerSeason, lp.avgTradesPerSeason, mp.avgTradesPerSeason],
                            ['Avg DHQ Gained', (wp.avgValueGained >= 0 ? '+' : '') + wp.avgValueGained, (lp.avgValueGained >= 0 ? '+' : '') + lp.avgValueGained, (mp.avgValueGained >= 0 ? '+' : '') + mp.avgValueGained],
                            ['Top Bought', topPosBought(wp), topPosBought(lp), topPosBought(mp)],
                            ['Partner Pref.', cleanPreference(wp.partnerPreference), cleanPreference(lp.partnerPreference), cleanPreference(mp.partnerPreference)],
                        ].map(([label, wVal, lVal, mVal], i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '8px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
                                <div style={{ color: 'var(--silver)' }}>{label}</div>
                                <div style={{ color: 'var(--gold)' }}>{wVal}</div>
                                <div style={{ color: 'var(--silver)', opacity: 0.7 }}>{lVal}</div>
                                <div style={{ color: 'var(--white)' }}>{mVal}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── YOUR LAST 5 TRADES ── */}
                {tr.myLast5 && tr.myLast5.length > 0 && (
                <AnalyticsReadout title="Your Recent Trade Performance" detail="Last five completed deals">
                        {tr.myLast5.map((trade, i) => {
                            const netDhq = trade.netDhq || 0;
                            const result = netDhq > 200 ? 'Won' : netDhq < -200 ? 'Lost' : 'Fair';
                            const resultColor = result === 'Won' ? goodColor : result === 'Lost' ? badColor : warnColor;
                            return (
                                <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--gold)', fontFamily: 'Inter, sans-serif' }}>S{trade.season || '?'} W{trade.week || '?'}</span>
                                        <span style={{ fontSize: '0.68rem', fontFamily: 'Inter, sans-serif', padding: '2px 8px', borderRadius: '10px', background: resultColor + '22', color: resultColor, border: '1px solid ' + resultColor + '44', fontWeight: 700 }}>{result}</span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--silver)', fontFamily: 'Inter, sans-serif' }}>
                                        {assetListText(trade.gave)} <span style={{ color: 'var(--gold)', margin: '0 4px' }}>{'\u2192'}</span> {assetListText(trade.got)}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', color: netDhq >= 0 ? goodColor : badColor, fontWeight: 700 }}>
                                        {netDhq >= 0 ? '+' : ''}{netDhq.toLocaleString()} DHQ
                                    </div>
                                </div>
                            );
                        })}
                </AnalyticsReadout>
                )}

                {/* ── INSIGHT CARDS ROW ── */}
                {alerts.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    {alerts.map((a, i) => (
                        <div key={i} style={{
                            background: 'rgba(26,26,26,0.8)', borderRadius: '10px', padding: '14px 16px',
                            borderLeft: '4px solid ' + sevColor(a.sev),
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: 700, color: sevColor(a.sev), marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {a.title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--silver)', lineHeight: 1.5 }}>{a.msg}</div>
                        </div>
                    ))}
                </div>
                )}
            </React.Fragment>
            );
        })()}

        {/* ═══ PLAYOFF HISTORY ═══ */}
        {analyticsTab === 'playoffs' && (() => { try {
            const championships = window.App?.LI?.championships || {};
            const seasons = completedChampionshipEntries(championships);
            if (!seasons.length) return <div style={{ ...aCardStyle, color: 'var(--silver)', textAlign: 'center', padding: '40px' }}>No championship history available yet.</div>;

            // ── Playoff Profile Summary ──
            const myRidP = myRoster?.roster_id;
            let myChampionships = 0, myRunnerUps = 0, mySemiFinals = 0;
            seasons.forEach(([season, data]) => {
                if (sameId(data.champion, myRidP)) myChampionships++;
                if (sameId(data.runnerUp, myRidP)) myRunnerUps++;
                if ((data.semiFinals || data.semiFinalists || []).some(rid => sameId(rid, myRidP))) mySemiFinals++;
            });
            const myPlayoffAppearances = myChampionships + myRunnerUps;
            const bracketDataP = window.App?.LI?.bracketData || {};
            let playoffWins = 0, playoffLosses = 0;
            Object.values(bracketDataP).forEach(sData => {
                (sData?.winners || []).forEach(m => {
                    if (sameId(m.w, myRidP)) playoffWins++;
                    if (sameId(m.l, myRidP)) playoffLosses++;
                });
            });
            const playoffDiag = myChampionships > 0
                ? 'You have ' + myChampionships + ' championship' + (myChampionships > 1 ? 's' : '') + ' in ' + seasons.length + ' seasons.'
                : myRunnerUps > 0
                ? 'You have reached ' + myRunnerUps + ' final' + (myRunnerUps > 1 ? 's' : '') + ' but no championships in ' + seasons.length + ' seasons.'
                : 'You haven\'t reached the finals recently.';
            const playoffInsight = myRunnerUps > myChampionships && myRunnerUps > 0
                ? ' You struggle to close out championship matchups — consider roster upgrades at key playoff positions.'
                : myPlayoffAppearances === 0
                ? ' Focus on building a contender before worrying about playoff optimization.'
                : ' Your playoff track record is solid. Maintain your competitive edge.';

            return (
            <React.Fragment>
                {/* ── PLAYOFF PROFILE SUMMARY ── */}
                <AnalyticsReadout title="Playoff Profile" detail="Completed seasons only">
                        {playoffDiag + playoffInsight}
                </AnalyticsReadout>

                <div className="analytics-kpi-grid">
                    <AnalyticsKpi label="Titles" value={myChampionships} sub={seasons.length + ' completed seasons'} color={myChampionships ? 'var(--gold)' : 'var(--silver)'} />
                    <AnalyticsKpi label="Finals" value={myChampionships + myRunnerUps} sub={myRunnerUps + ' runner-up'} color={(myChampionships + myRunnerUps) ? 'var(--gold)' : 'var(--silver)'} />
                    <AnalyticsKpi label="Semis" value={mySemiFinals} sub="documented semifinal berths" color={mySemiFinals ? '#4ECDC4' : 'var(--silver)'} />
                    <AnalyticsKpi label="Playoff Record" value={playoffWins + '-' + playoffLosses} sub="winners bracket games" color={playoffWins >= playoffLosses ? goodColor : badColor} />
                </div>

                {(() => {
                    const detectRivalries = window.App?.detectRivalries;
                    const rivals = detectRivalries && myRoster ? detectRivalries(myRoster.roster_id) : [];
                    return (
                        <div className="analytics-action-grid">
                            <AnalyticsSection title="ROADBLOCKS" meta="Most frequent playoff opponents">
                                <div className="analytics-signal-list">
                                    {rivals && rivals.length ? rivals.slice(0, 3).map((r, i) => (
                                        <div key={i} className={'analytics-signal ' + (r.wins >= r.losses ? 'analytics-signal-low' : 'analytics-signal-high')}>
                                            <strong>{ownerNameSafe(r.rosterId)}</strong>
                                            <span>{r.wins}-{r.losses} across {r.total} playoff meetings</span>
                                        </div>
                                    )) : <div className="analytics-signal"><strong>No repeat roadblock</strong><span>No opponent has met you multiple times in the available bracket data.</span></div>}
                                </div>
                            </AnalyticsSection>
                            <AnalyticsSection title="RECENT FINISHES" meta="Champion / runner-up">
                                <div className="analytics-mini-table">
                                    {seasons.slice(0, 4).map(([season, data]) => (
                                        <div key={season}><strong>{season}</strong><span>{ownerNameSafe(data.champion)}</span><em>over {ownerNameSafe(data.runnerUp)}</em></div>
                                    ))}
                                </div>
                            </AnalyticsSection>
                        </div>
                    );
                })()}

                <div style={aCardStyle}>
                    <div style={aHeaderStyle}>PLAYOFF HISTORY</div>
                    {seasons.map(([season, data]) => {
                        const champName = ownerNameSafe(data.champion);
                        const runnerName = ownerNameSafe(data.runnerUp);
                        const isMyChamp = sameId(data.champion, myRoster?.roster_id);
                        const isMyRunner = sameId(data.runnerUp, myRoster?.roster_id);
                        const champRoster = rosterByAnyId(data.champion);
                        const champUser = currentLeague.users?.find(u => u.user_id === champRoster?.owner_id);
                        const runnerRoster = rosterByAnyId(data.runnerUp);
                        const runnerUser = currentLeague.users?.find(u => u.user_id === runnerRoster?.owner_id);
                        return (
                            <div key={season} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.1rem', color: 'var(--gold)', minWidth: '40px' }}>{season}</span>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: isMyChamp ? 'var(--gold)' : 'var(--white)', fontWeight: isMyChamp ? 700 : 400 }}>
                                        {champUser?.avatar && <img src={'https://sleepercdn.com/avatars/thumbs/' + champUser.avatar} style={{ width:'20px', height:'20px', borderRadius:'50%' }} onError={e => e.target.style.display='none'} />}
                                        Champion: {champName}{champUser?.metadata?.team_name ? ' (' + champUser.metadata.team_name + ')' : ''}{isMyChamp ? ' (You!)' : ''}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--silver)' }}>
                                        {runnerUser?.avatar && <img src={'https://sleepercdn.com/avatars/thumbs/' + runnerUser.avatar} style={{ width:'20px', height:'20px', borderRadius:'50%' }} onError={e => e.target.style.display='none'} />}
                                        Runner-up: {runnerName}{isMyRunner ? ' (You)' : ''}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── FULL BRACKET DISPLAY ── */}
                {(() => {
                    const bracketData = window.App?.LI?.bracketData;
                    if (!bracketData || !Object.keys(bracketData).length) return null;
                    const completedSeasonSet = new Set(seasons.map(([season]) => String(season)));
                    const bracketSeasons = Object.entries(bracketData)
                        .filter(([season]) => completedSeasonSet.has(String(season)))
                        .sort(([a],[b]) => String(b).localeCompare(String(a)));
                    if (!bracketSeasons.length) return null;
                    return (
                        <div style={aCardStyle}>
                            <div style={aHeaderStyle}>PLAYOFF BRACKETS</div>
                            {bracketSeasons.map(([season, sData]) => {
                                const brackets = [
                                    { key: 'winners', label: 'Winners Bracket', data: sData.winners || sData.w || [] },
                                    { key: 'losers', label: 'Losers Bracket', data: sData.losers || sData.l || [] },
                                ];
                                return (
                                    <div key={season} style={{ marginBottom: '12px' }}>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '8px' }}>{season} Playoffs</div>
                                        {brackets.map(b => {
                                            if (!b.data || !b.data.length) return null;
                                            return (
                                                <div key={b.key} style={{ marginBottom: '12px' }}>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--silver)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{b.label}</div>
                                                    {b.data.map((matchup, mi) => {
                                                        const t1 = matchup.t1 || matchup.team1;
                                                        const t2 = matchup.t2 || matchup.team2;
                                                        const w = matchup.w || matchup.winner;
                                                        if (!isResolvedOwner(t1) || !isResolvedOwner(t2)) return null;
                                                        // Robust round label: handle 0-indexed rounds and missing values
                                                        let _mr = Math.max(...(b.data || []).map(m => m.r || m.round || 0), 0);
                                                        let _rd = matchup.r || matchup.round || 0;
                                                        // If all rounds are 0, try 1-indexing from matchup index
                                                        if (_mr <= 0) {
                                                            const uniqueRounds = [...new Set((b.data || []).map(m => m.r || m.round || 0))];
                                                            _mr = uniqueRounds.length || 1;
                                                            _rd = mi + 1; // fallback: use matchup index as round proxy
                                                        }
                                                        // If rounds appear 0-indexed (max round is 0-based), shift up by 1
                                                        if (_mr >= 1 && _rd === 0) { _rd = 1; }
                                                        // Debug log removed — was flooding console with every bracket matchup
                                                        const roundLabel = _rd === _mr ? 'Championship' : _rd === _mr - 1 ? 'Semi-finals' : _rd === _mr - 2 ? 'Quarter-finals' : 'Round ' + _rd;
                                                        const isMyGame = sameId(t1, myRidP) || sameId(t2, myRidP);
                                                        return (
                                                            <div key={mi} style={{
                                                                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', marginBottom: '4px',
                                                                background: isMyGame ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.02)',
                                                                borderLeft: isMyGame ? '3px solid var(--gold)' : '3px solid transparent',
                                                                borderRadius: '4px', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif',
                                                            }}>
                                                                <span style={{ fontSize: '0.68rem', color: 'var(--silver)', opacity: 0.6, minWidth: '80px' }}>{roundLabel}</span>
                                                                <span style={{ color: sameId(w, t1) ? 'var(--gold)' : 'var(--silver)', fontWeight: sameId(w, t1) ? 700 : 400 }}>{ownerNameSafe(t1)}</span>
                                                                <span style={{ color: 'var(--silver)', opacity: 0.4, fontSize: '0.7rem' }}>vs</span>
                                                                <span style={{ color: sameId(w, t2) ? 'var(--gold)' : 'var(--silver)', fontWeight: sameId(w, t2) ? 700 : 400 }}>{ownerNameSafe(t2)}</span>
                                                                {w && <span style={{ color: 'var(--gold)', fontSize: '0.7rem', marginLeft: 'auto' }}>{'\u2192'} {ownerNameSafe(w)}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Rivalry Detection */}
                {(() => {
                    const detectRivalries = window.App?.detectRivalries;
                    if (!detectRivalries || !myRoster) return null;
                    const rivals = detectRivalries(myRoster.roster_id);
                    if (!rivals || !rivals.length) return null;
                    return (
                        <div style={aCardStyle}>
                            <div style={aHeaderStyle}>YOUR PLAYOFF RIVALRIES</div>
                            {rivals.map((r, i) => {
                                const rivalName = ownerNameSafe(r.rosterId);
                                return (
                                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: 'var(--white)', fontWeight: 600, flex: 1 }}>{rivalName}</span>
                                            <span style={{ fontSize: '0.78rem', color: r.wins > r.losses ? goodColor : r.wins < r.losses ? badColor : warnColor, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>{r.wins}-{r.losses}</span>
                                            <span style={{ fontSize: '0.74rem', color: 'var(--silver)' }}>{r.total} meetings</span>
                                        </div>
                                        {r.meetings && r.meetings.length > 0 && (
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                                                {r.meetings.map((mtg, mi) => (
                                                    <span key={mi} style={{ fontSize: '0.68rem', fontFamily: 'Inter, sans-serif', padding: '1px 6px', borderRadius: '8px', background: mtg.won ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)', color: mtg.won ? goodColor : badColor, border: '1px solid ' + (mtg.won ? goodColor : badColor) + '33' }}>
                                                        Met in {mtg.bracket || 'Winners'} R{mtg.round || '?'} ({mtg.season || '?'})
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {(!r.meetings || !r.meetings.length) && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.65, marginTop: '2px' }}>{r.seasons.join(', ')}</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </React.Fragment>
            );
        } catch(e) { console.warn('[WarRoom] Playoffs render error:', e); return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--silver)' }}>Playoff data could not be rendered. Check console for details.</div>; } })()}

        {/* ═══ TIMELINE ═══ */}
        {analyticsTab === 'timeline' && (() => {
            const championships = window.App?.LI?.championships || {};
            const championshipEntries = completedChampionshipEntries(championships);
            const completedChampionships = Object.fromEntries(championshipEntries);
            const tradeHistory = window.App?.LI?.tradeHistory || [];
            // Uses shared getOwnerName() passed as prop
            const events = [];

            championshipEntries.forEach(([season, data]) => {
                if (data.champion) events.push({ year: season, type: 'champ', title: ownerNameSafe(data.champion) + ' wins the championship', color: 'var(--gold)', ts: parseInt(season)*100+99 });
                if (data.runnerUp) events.push({ year: season, type: 'finals', title: ownerNameSafe(data.runnerUp) + ' finishes runner-up', color: 'var(--silver)', ts: parseInt(season)*100+98 });
            });

            // Collect all trades with DHQ, then keep top 5 by total value
            const _tradeEvents = [];
            tradeHistory.forEach(trade => {
                const rids = trade.roster_ids || [];
                const names = rids.map(r => ownerNameSafe(r)).join(' and ');
                const pids = Object.keys(trade.sides || {}).flatMap(rid => (trade.sides[rid]?.players || []));
                const playerNames = pids.slice(0, 3).map(pid => playersData[pid]?.full_name || pid).join(', ');
                const totalVal = pids.reduce((s, pid) => s + Math.abs(window.App?.LI?.playerScores?.[pid] || 0), 0);
                if (totalVal < 5000) return;
                _tradeEvents.push({
                    year: trade.season || '?', type: 'trade',
                    title: names + ' swap assets' + (playerNames ? ': ' + playerNames : ''),
                    sub: totalVal > 0 ? totalVal.toLocaleString() + ' DHQ moved' : '',
                    color: '#F0A500', ts: parseInt(trade.season||0)*100 + (trade.week||50),
                    _totalVal: totalVal
                });
            });
            _tradeEvents.sort((a, b) => b._totalVal - a._totalVal);
            _tradeEvents.slice(0, 5).forEach(te => events.push(te));

            // Personal highlights per year
            const myRidTLx = myRoster?.roster_id;
            const playerScoresTL = window.App?.LI?.playerScores || {};
            const draftOutcomesTL = (window.App?.LI || {}).draftOutcomes || [];
            const allYears = [...new Set([...Object.keys(completedChampionships), ...events.map(e => String(e.year))])].sort((a,b) => b - a);
            allYears.forEach(yr => {
                // Your team's finish
                const cData = completedChampionships[yr];
                if (cData) {
                    if (sameId(cData.champion, myRidTLx)) events.push({ year: yr, type: 'personal', title: 'You won the championship!', color: 'var(--gold)', ts: parseInt(yr)*100+97 });
                    else if (sameId(cData.runnerUp, myRidTLx)) events.push({ year: yr, type: 'personal', title: 'You finished as runner-up', color: 'var(--silver)', ts: parseInt(yr)*100+96 });
                    else if ((cData.semiFinalists || cData.semiFinals || []).some(rid => sameId(rid, myRidTLx))) events.push({ year: yr, type: 'personal', title: 'You reached the semi-finals', color: '#4ECDC4', ts: parseInt(yr)*100+95 });
                }
                // Your best draft pick that year
                const myDraftPicks = draftOutcomesTL.filter(dp => dp.roster_id === myRidTLx && String(dp.season || dp.year) === String(yr));
                if (myDraftPicks.length > 0) {
                    const bestPick = myDraftPicks.reduce((best, dp) => (playerScoresTL[dp.player_id] || 0) > (playerScoresTL[best.player_id] || 0) ? dp : best, myDraftPicks[0]);
                    const bestDhq = playerScoresTL[bestPick.player_id] || 0;
                    if (bestDhq > 2000) {
                        const pName = playersData[bestPick.player_id]?.full_name || bestPick.player_id;
                        events.push({ year: yr, type: 'personal', title: 'Best draft pick: ' + pName + ' (R' + (bestPick.round || '?') + ', ' + bestDhq.toLocaleString() + ' DHQ)', color: '#4ECDC4', ts: parseInt(yr)*100+94 });
                    }
                }
            });

            events.sort((a, b) => b.ts - a.ts);
            const years = [...new Set(events.map(e => e.year))].sort((a, b) => b - a);

            if (!events.length) return <div style={{ color:'var(--silver)', textAlign:'center', padding:'40px' }}>No timeline events. DHQ engine needs to load trade history and championship data.</div>;

            // ── League Narrative Summary ──
            const champCounts = {};
            Object.values(completedChampionships).forEach(data => {
                if (data.champion) champCounts[data.champion] = (champCounts[data.champion] || 0) + 1;
            });
            const champEntries = Object.entries(champCounts).sort((a, b) => b[1] - a[1]);
            const dominantTeam = champEntries.length > 0 ? ownerNameSafe(champEntries[0][0]) : 'N/A';
            const dominantTitles = champEntries.length > 0 ? champEntries[0][1] : 0;
            const repeatWinners = champEntries.filter(([, cnt]) => cnt > 1).map(([rid]) => ownerNameSafe(rid)).filter(n => n && n !== 'Unknown');
            const myRidTL = myRoster?.roster_id;
            const myChampsTL = champCounts[myRidTL] || 0;
            // Trajectory from projection data
            const projTL = d.projection || [];
            const tlTrend = projTL.length >= 2 ? projTL[projTL.length - 1].projectedDHQ - projTL[0].projectedDHQ : 0;
            const myTrajectory = tlTrend > 500 ? 'rising' : tlTrend < -500 ? 'declining' : 'stable';
            // Next champion candidates: teams with highest health scores
            const allRostersTL = _SS.rosters || [];
            const teamHealthList = [];
            allRostersTL.forEach(ros => {
                try {
                    if (window.assessTeamFromGlobal) {
                        const a = window.assessTeamFromGlobal(ros.roster_id);
                        if (a) teamHealthList.push({ rid: ros.roster_id, name: ownerNameSafe(ros.roster_id), health: a.healthScore || 0 });
                    }
                } catch(e) { window.wrLog('timeline.assessTeam', e); }
            });
            teamHealthList.sort((a, b) => b.health - a.health);
            const nextChampCandidates = teamHealthList.slice(0, 3).map(t => t.name).join(', ') || 'insufficient data';

            return (
                <React.Fragment>
                {/* ── LEAGUE NARRATIVE SUMMARY ── */}
                <AnalyticsReadout title="League Narrative" detail="Completed history plus current roster power">
                    {(dominantTitles > 0 ? 'League dominated by ' + dominantTeam + ' with ' + dominantTitles + ' title' + (dominantTitles > 1 ? 's' : '') + '.' : 'No completed championship history is resolved yet.') + (repeatWinners.length > 0 ? ' Repeat elite tier: ' + repeatWinners.join(', ') + '.' : ' No repeat champions yet \u2014 wide-open league.') + ' Your trajectory: ' + myTrajectory + (myChampsTL > 0 ? ' (' + myChampsTL + ' title' + (myChampsTL > 1 ? 's' : '') + ')' : '') + '. Next likely champion candidates: ' + nextChampCandidates + '.'}
                </AnalyticsReadout>

                <div className="analytics-filter-row">
                    {[
                        ['all', 'All Events'],
                        ['champ', 'Championships'],
                        ['trade', 'Major Trades'],
                        ['personal', 'My Highlights'],
                    ].map(([key, label]) => (
                        <button key={key} onClick={() => setTimelineFilter(key)} className={timelineFilter === key ? 'is-active' : ''}>{label}</button>
                    ))}
                </div>

                <div style={{ background:'var(--black)', border:'2px solid rgba(212,175,55,0.3)', borderRadius:'12px', padding:'24px' }}>
                    <div style={{ fontFamily:'Rajdhani, sans-serif', fontSize:'1.3rem', color:'var(--gold)', letterSpacing:'0.08em', marginBottom:'12px' }}>LEAGUE TIMELINE</div>
                    {(() => {
                        const visibleEvents = timelineFilter === 'all'
                            ? events
                            : timelineFilter === 'champ'
                            ? events.filter(e => e.type === 'champ' || e.type === 'finals')
                            : events.filter(e => e.type === timelineFilter);
                        const visibleYears = [...new Set(visibleEvents.map(e => e.year))].sort((a, b) => b - a);
                        return visibleYears.map(year => {
                        const yearEvents = visibleEvents.filter(e => e.year === year);
                        return (
                            <div key={year} style={{ marginBottom:'24px' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                                    <div style={{ width:'14px', height:'14px', background:'var(--gold)', borderRadius:'50%', border:'3px solid var(--black)', flexShrink:0 }} />
                                    <span style={{ fontFamily:'Rajdhani, sans-serif', fontSize:'1.2rem', color:'var(--gold)' }}>{year}</span>
                                </div>
                                <div style={{ paddingLeft:'20px', borderLeft:'2px solid rgba(212,175,55,0.2)', marginLeft:'6px' }}>
                                    {yearEvents.map((ev, i) => (
                                        <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(212,175,55,0.12)', borderLeft:'3px solid '+ev.color, borderRadius:'6px', padding:'10px 14px', marginBottom:'8px', position:'relative' }}>
                                            <div style={{ position:'absolute', left:'-14px', top:'12px', width:'8px', height:'8px', background:ev.color, borderRadius:'50%', border:'2px solid var(--black)' }} />
                                            <div style={{ fontSize:'0.78rem', color:ev.color, textTransform:'uppercase', fontFamily:'Inter, sans-serif', letterSpacing:'0.06em', marginBottom:'3px' }}>{ev.type === 'champ' ? 'Championship' : ev.type === 'finals' ? 'Runner-Up' : ev.type === 'personal' ? 'Your Highlight' : 'Trade'}</div>
                                            <div style={{ fontSize:'0.78rem', color:'var(--white)', fontWeight:600 }}>{ev.title}</div>
                                            {ev.sub && <div style={{ fontSize:'0.74rem', color:'var(--silver)', opacity:0.6, marginTop:'2px' }}>{ev.sub}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    });
                    })()}
                </div>
                </React.Fragment>
            );
        })()}

        {/* Phase 8: All Players / Draft Picks / Custom Reports — ex-League Map sub-views
            rendered inline via LeagueMapTab's embed mode. Local state lives in AnalyticsPanel
            so sort/filter/search persist as the user moves between sub-tabs. */}
        {(analyticsTab === 'players' || analyticsTab === 'picks' || analyticsTab === 'reports') && React.createElement(window.AnalyticsLeagueEmbed || (() => null), {
            analyticsTab, standings, currentLeague, playersData, statsData, sleeperUserId,
            myRoster, activeYear, timeRecomputeTs, setActiveTab, getAcquisitionInfo, getOwnerName,
        })}

        </React.Fragment>
        )}
    </div>
    );
}

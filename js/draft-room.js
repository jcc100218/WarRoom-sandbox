// ══════════════════════════════════════════════════════════════════
// draft-room.js — DraftTab component (Flash Brief, Big Board)
// ══════════════════════════════════════════════════════════════════
    const WR_KEYS  = window.App.WR_KEYS;
    const WrStorage = window.App.WrStorage;
    // ══════════════════════════════════════════════════════════════════════════
    // END FREE AGENCY TAB
    // ══════════════════════════════════════════════════════════════════════════

    // ══════════════════════════════════════════════════════════════════════════
    // DRAFT TAB — migrated from draft-warroom.html
    // ══════════════════════════════════════════════════════════════════════════
    function DraftTab({ playersData, statsData, myRoster, currentLeague, sleeperUserId, setReconPanelOpen, sendReconMessage, timeRecomputeTs, viewMode }) {
        const leagueSeason = parseInt(currentLeague.season || new Date().getFullYear());
        const draftRounds = currentLeague.settings?.draft_rounds || 5;
        const tradedPicks = window.S?.tradedPicks || [];
        const [draftSort, setDraftSort] = useState({ key: 'dhq', dir: -1 });
        const [draftView, setDraftView] = useState('command'); // 'command' | 'board' | 'mock' | 'live'
        const [draftInfo, setDraftInfo] = useState(null);
        const [boardData, setBoardData] = useState(() => WrStorage.get(WR_KEYS.BIGBOARD(currentLeague.id || ''), null));
        const [draftedPids, setDraftedPids] = useState(new Set());
        const [boardNotes, setBoardNotes] = useState({});
        const [boardTags, setBoardTags] = useState({}); // pid -> 'target'|'avoid'|'sleeper'|'must'
        const [boardMode, setBoardMode] = useState('dhq'); // 'dhq' | 'my'
        const [myBoardOrder, setMyBoardOrder] = useState([]); // custom ordered pid array
        const [boardPosFilter, setBoardPosFilter] = useState(''); // '' | 'QB' | 'RB' | 'WR' | 'TE' | 'DL' | 'LB' | 'DB'
        const [boardTeamFilter, setBoardTeamFilter] = useState(''); // '' | NFL team abbr
        const [boardRoundFilter, setBoardRoundFilter] = useState(''); // '' | '1'..'7' | 'UDFA' | 'undrafted'
        const [boardSort, setBoardSort] = useState({ key: 'dhq', dir: -1 }); // sortable columns
        const [expandedDraftPid, setExpandedDraftPid] = useState(null);
        const [dragPid, setDragPid] = useState(null); // currently dragging pid
        const [editingRank, setEditingRank] = useState(null); // pid being rank-edited
        const [rankInput, setRankInput] = useState('');
        const [countdownNow, setCountdownNow] = useState(Date.now());
        const [draftStrategyEditing, setDraftStrategyEditing] = useState(false);
        const draftStrategyKey = 'wr_draft_strategy_' + (currentLeague?.league_id || currentLeague?.id || '');
        const [customDraftStrategy, setCustomDraftStrategy] = useState(() => {
            try { return localStorage.getItem(draftStrategyKey) || ''; } catch(e) { return ''; }
        });

        const normPos = window.App.normPos;
        const [rookieMarket, setRookieMarket] = useState({ rows: {}, ladders: {}, scaleFactor: 1 });

        useEffect(() => {
            let cancelled = false;
            const scoring = currentLeague?.scoring_settings || {};
            const rosterPositions = currentLeague?.roster_positions || [];
            const isSF = rosterPositions.some(slot => ['SUPER_FLEX', 'QB_FLEX', 'OP'].includes(String(slot).toUpperCase()));
            const pprVal = scoring.rec != null && scoring.rec >= 0.9 ? 1 : scoring.rec != null && scoring.rec >= 0.4 ? 0.5 : 0;
            const totalTeams = currentLeague?.rosters?.length || window.S?.rosters?.length || 12;
            const url = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${isSF ? 2 : 1}&numTeams=${totalTeams}&ppr=${pprVal}`;
            fetch(url)
                .then(r => r.ok ? r.json() : [])
                .then(data => {
                    if (cancelled || !Array.isArray(data) || !data.length) return;
                    const scores = window.App?.LI?.playerScores || {};
                    const matched = data
                        .filter(d => {
                            const sid = d.player?.sleeperId;
                            return sid && d.player?.position !== 'PICK' && d.value > 0 && scores[sid] > 0 && playersData?.[sid]?.years_exp !== 0;
                        })
                        .map(d => ({ sid: d.player.sleeperId, fcVal: d.value, dhqVal: scores[d.player.sleeperId] }))
                        .sort((a, b) => b.fcVal - a.fcVal);
                    let scaleFactor = 1;
                    if (matched.length >= 10) {
                        const ratios = matched.slice(0, 20).map(m => m.dhqVal / m.fcVal).sort((a, b) => a - b);
                        scaleFactor = ratios[Math.floor(ratios.length / 2)] || 1;
                    }
                    const rows = {};
                    data.forEach(d => {
                        const sid = d.player?.sleeperId;
                        if (!sid || d.player?.position === 'PICK' || !d.value) return;
                        rows[sid] = {
                            value: d.value,
                            scaled: Math.round(d.value * scaleFactor),
                            overallRank: d.overallRank || 999,
                            positionRank: d.positionRank || 999,
                        };
                    });
                    const meta = window.App?.LI?.playerMeta || {};
                    const ladders = {};
                    ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
                        ladders[pos] = Object.entries(scores)
                            .filter(([sid, score]) => {
                                if (!score || score <= 0) return false;
                                if (playersData?.[sid]?.years_exp === 0) return false;
                                const playerPos = normPos(meta[sid]?.pos || playersData?.[sid]?.position || '');
                                return playerPos === pos;
                            })
                            .sort((a, b) => b[1] - a[1])
                            .map(([, score]) => score);
                    });
                    window.App._rookieMarketRows = rows;
                    setRookieMarket({ rows, ladders, scaleFactor });
                })
                .catch(e => { if (window.wrLog) window.wrLog('draft.rookieMarket', e); });
            return () => { cancelled = true; };
        }, [currentLeague?.league_id, currentLeague?.id, currentLeague?.season, playersData, timeRecomputeTs]);

        const rookiePeerMultiplier = (pos, positionRank) => {
            if (pos === 'RB') {
                if (positionRank <= 5) return 1.08;
                if (positionRank <= 12) return 1.00;
                if (positionRank <= 24) return 0.94;
                return 0.86;
            }
            if (pos === 'WR') {
                if (positionRank <= 12) return 1.02;
                if (positionRank <= 24) return 0.96;
                if (positionRank <= 36) return 0.90;
                return 0.82;
            }
            if (pos === 'QB') {
                if (positionRank <= 12) return 0.96;
                if (positionRank <= 24) return 0.90;
                return 0.80;
            }
            if (pos === 'TE') {
                if (positionRank <= 6) return 0.96;
                if (positionRank <= 18) return 0.88;
                return 0.80;
            }
            return 0.90;
        };

        const calibratedRookieDHQ = (pid, player, engineDHQ) => {
            const row = rookieMarket.rows?.[pid];
            const pos = normPos(player?.position);
            if (!row || !['QB', 'RB', 'WR', 'TE'].includes(pos)) return engineDHQ || 0;
            const marketDHQ = row.scaled || row.value || 0;
            if (!marketDHQ) return engineDHQ || 0;
            const ladder = rookieMarket.ladders?.[pos] || [];
            const peerDHQ = ladder[Math.max(0, row.positionRank - 1)] || 0;
            const peerTarget = peerDHQ ? Math.round(peerDHQ * rookiePeerMultiplier(pos, row.positionRank)) : 0;
            const base = peerTarget || marketDHQ;
            const marketGuard = row.value ? Math.round(row.value * (pos === 'RB' ? 0.85 : pos === 'WR' ? 0.82 : 0.72)) : 0;
            const calibrated = Math.round(base * 0.80 + marketDHQ * 0.20);
            return Math.min(10000, Math.max(marketGuard, calibrated));
        };

        // Build my picks
        const myPicks = useMemo(() => {
            const picks = [];
            for (let yr = leagueSeason; yr <= leagueSeason + 2; yr++) {
                for (let rd = 1; rd <= draftRounds; rd++) {
                    const tradedAway = tradedPicks.find(p => parseInt(p.season) === yr && p.round === rd && p.roster_id === myRoster?.roster_id && p.owner_id !== myRoster?.roster_id);
                    if (!tradedAway) picks.push({ year: yr, round: rd, own: true });
                    const acquired = tradedPicks.filter(p => parseInt(p.season) === yr && p.round === rd && p.owner_id === myRoster?.roster_id && p.roster_id !== myRoster?.roster_id);
                    acquired.forEach(a => picks.push({ year: yr, round: rd, own: false, from: a.roster_id }));
                }
            }
            return picks;
        }, [tradedPicks, myRoster]);

        // Find rookies — Sleeper + CSV enrichment from The Beast
        const rookies = useMemo(() => {
            const rp = currentLeague?.roster_positions || [];
            const leagueHasIDP = rp.some(s => ['DL','DE','DT','LB','DB','CB','S','IDP_FLEX'].includes(s));

            // Step 1: Sleeper rookies
            const sleeperRookies = Object.entries(playersData)
                .filter(([pid, p]) => {
                    if (p.years_exp !== 0) return false;
                    const name = p.full_name || '';
                    if (!name || /Duplicate|Invalid|DUP/i.test(name)) return false;
                    if (!p.position || ['HC','OC','DC','GM'].includes(p.position)) return false;
                    if (p.status === 'Inactive') return false;
                    const hasValue = (window.App?.LI?.playerScores?.[pid] || 0) > 0;
                    const isIDP = ['DL','DE','DT','NT','IDL','EDGE','LB','OLB','ILB','MLB','DB','CB','S','SS','FS'].includes(p.position);
                    if (isIDP && !leagueHasIDP) return false;
                    // OL is never a fantasy scoring position — exclude offensive linemen
                    const isOL = ['OL','OT','OG','G','C','T','IOL'].includes(p.position);
                    if (isOL) return false;
                    return hasValue || p.team;
                })
                .map(([pid, p]) => {
                    const csv = typeof window.findProspect === 'function' ? window.findProspect((p.first_name || '') + ' ' + (p.last_name || '')) : null;
                    // The DHQ engine is the canonical value. Consensus rank and NFL
                    // capital are context on the card, not a second scoring pass.
                    const fcVal = window.App?.LI?.playerScores?.[pid] || 0;
                    let dhq;
                    if (fcVal > 0) {
                        dhq = calibratedRookieDHQ(pid, p, fcVal);
                    } else if (csv) {
                        // No engine/market score yet: fall back to the scouting model.
                        dhq = csv.dynastyValue || 0;
                    } else {
                        dhq = 0;
                    }
                    dhq = Math.min(10000, Math.max(0, dhq));
                    return { pid, p, dhq, csv };
                });

            // Step 2: CSV-only prospects (from enrichment but not in Sleeper)
            // Normalize names: lowercase, strip apostrophes/dots/suffixes so "De'Zhaun" === "Dezhaun".
            const normName = s => (s || '').toLowerCase().replace(/[''`.]/g, '').replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/, '').replace(/\s+/g, ' ').trim();
            const sleeperNames = new Set(sleeperRookies.map(r => normName(r.p.full_name)));
            // Also collect the CSV-prospect identities Sleeper rookies link to via
            // findProspect — handles nickname mismatches (e.g., Sleeper "KC Concepcion"
            // → CSV "Kevin Concepcion" — both should be one row, not two).
            const linkedCsvPids = new Set(sleeperRookies.map(r => r.csv?.pid).filter(Boolean));
            const csvOnly = [];
            if (typeof window.getProspects === 'function') {
                const allCsv = window.getProspects();
                if (allCsv && allCsv.length) {
                    allCsv.forEach(csv => {
                        if (sleeperNames.has(normName(csv.name))) return;
                        if (linkedCsvPids.has(csv.pid)) return;
                        const pos = normPos(csv.mappedPos || csv.pos) || csv.pos;
                        const isIDP = ['DL','LB','DB','EDGE'].includes(pos);
                        if (isIDP && !leagueHasIDP) return;
                        // OL is never a fantasy scoring position — exclude offensive linemen
                        if (['OL','OT','OG','G','C','T','IOL'].includes(pos)) return;
                        // Build synthetic player object
                        const nameParts = (csv.name || '').split(' ');
                        csvOnly.push({
                            pid: 'csv_' + (csv.name || '').toLowerCase().replace(/[^a-z]/g, '_'),
                            p: {
                                full_name: csv.name,
                                first_name: nameParts[0] || '',
                                last_name: nameParts.slice(1).join(' ') || '',
                                position: csv.pos || '?',
                                college: csv.college,
                                years_exp: 0,
                                age: csv.age ? parseFloat(csv.age) : null,
                                team: null,
                                height: csv.size ? parseInt(csv.size.replace("'", "").split('"')[0]) * 12 + parseInt((csv.size.match(/'(\d+)/)?.[1]) || 0) : null,
                                weight: csv.weight ? parseInt(csv.weight) : null,
                            },
                            dhq: csv.draftScore || 0,
                            csv,
                            isCSVOnly: true,
                        });
                    });
                }
            }

            return [...sleeperRookies, ...csvOnly].sort((a, b) => {
                // Sort by CSV rank first (if available), then DHQ
                const aRank = a.csv?.rank || 9999;
                const bRank = b.csv?.rank || 9999;
                if (aRank !== bRank) return aRank - bRank;
                return b.dhq - a.dhq;
            });
        }, [playersData, timeRecomputeTs, rookieMarket]);

        const posColors = window.App.POS_COLORS;

        function draftSortIndicator(key) { return draftSort.key === key ? (draftSort.dir === -1 ? ' \u25BC' : ' \u25B2') : ''; }
        function handleDraftSort(key) { setDraftSort(prev => prev.key === key ? { ...prev, dir: prev.dir * -1 } : { key, dir: -1 }); }

        const sortedRookies = useMemo(() => {
            let filtered = rookies.slice();
            if (boardPosFilter) filtered = filtered.filter(r => normPos(r.p.position) === boardPosFilter);
            return filtered.sort((a, b) => {
                const dir = draftSort.dir;
                const k = draftSort.key;
                if (k === 'name') {
                    const na = (a.p.full_name || ((a.p.first_name || '') + ' ' + (a.p.last_name || '')).trim()).toLowerCase();
                    const nb = (b.p.full_name || ((b.p.first_name || '') + ' ' + (b.p.last_name || '')).trim()).toLowerCase();
                    return dir * na.localeCompare(nb);
                }
                if (k === 'pos') return dir * ((normPos(a.p.position) || '').localeCompare(normPos(b.p.position) || ''));
                if (k === 'age') return dir * ((a.p.age || 0) - (b.p.age || 0));
                if (k === 'dhq') return dir * (a.dhq - b.dhq);
                if (k === 'college') return dir * ((a.p.college || a.p.metadata?.college || '').localeCompare(b.p.college || b.p.metadata?.college || ''));
                return 0;
            }).slice(0, 50);
        }, [rookies, draftSort, boardPosFilter]);

        // Team assessment for fit scoring
        const assess = useMemo(() => typeof window.assessTeamFromGlobal === 'function' ? window.assessTeamFromGlobal(myRoster?.roster_id) : null, [myRoster, timeRecomputeTs]);

        // Compute fit scores for rookies based on roster needs
        const computeFitScore = useCallback((rookie) => {
            if (!assess || !assess.needs || !assess.needs.length) return { score: 50, label: 'N/A' };
            const pos = normPos(rookie.p.position);
            const needEntry = assess.needs.find(n => n.pos === pos);
            if (!needEntry) return { score: 10, label: 'Low' };
            const urgencyBonus = needEntry.urgency === 'deficit' ? 40 : 20;
            const needIdx = assess.needs.findIndex(n => n.pos === pos);
            const priorityBonus = Math.max(0, 20 - needIdx * 5);
            const raw = Math.min(99, 10 + urgencyBonus + priorityBonus);
            const label = raw >= 80 ? 'Elite' : raw >= 60 ? 'Strong' : raw >= 40 ? 'Moderate' : 'Low';
            return { score: raw, label };
        }, [assess]);

        // Determine active view: global viewMode overrides to 'command' when set
        const activeView = viewMode === 'command' ? 'command' : draftView;

        // Auto-save board data to localStorage on changes
        useEffect(() => {
            WrStorage.set(WR_KEYS.BIGBOARD(currentLeague.id || ''),
                { tags: boardTags, notes: boardNotes, drafted: Array.from(draftedPids), myOrder: myBoardOrder });
        }, [boardTags, boardNotes, draftedPids, myBoardOrder, currentLeague.id]);

        // Restore board data from localStorage on mount
        useEffect(() => {
            if (boardData) {
                if (boardData.tags) setBoardTags(boardData.tags);
                if (boardData.notes) setBoardNotes(boardData.notes);
                if (boardData.drafted) setDraftedPids(new Set(boardData.drafted));
                if (boardData.myOrder) setMyBoardOrder(boardData.myOrder);
            }
        }, []);

        // Fetch draft countdown info from Sleeper
        useEffect(() => {
            if (!currentLeague?.id) return;
            fetch('https://api.sleeper.app/v1/league/' + (currentLeague.league_id || currentLeague.id) + '/drafts')
                .then(r => r.ok ? r.json() : [])
                .then(drafts => {
                    const upcoming = drafts.find(d => d.status === 'pre_draft') || drafts[0];
                    if (upcoming) setDraftInfo(upcoming);
                })
                .catch(err => window.wrLog('draft.draftFetch', err));
        }, [currentLeague]);

        // Tick countdown clock every minute while a pre-draft is active
        useEffect(() => {
            if (!draftInfo?.start_time || draftInfo.status !== 'pre_draft') return;
            const id = setInterval(() => setCountdownNow(Date.now()), 60000);
            return () => clearInterval(id);
        }, [draftInfo]);

        // Helper: get player display name
        const pName = (p) => p.full_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || 'Unknown';

        // Next pick info
        const nextPick = myPicks.find(pk => pk.year === leagueSeason);

        // Top prospects with fit
        const topProspects = useMemo(() => {
            return rookies.slice(0, 20).map(r => ({ ...r, fit: computeFitScore(r) }));
        }, [rookies, computeFitScore]);

        // Strategy recommendation — must be declared before recommendations (which depends on it)
        const strategyRec = useMemo(() => {
            if (!assess || !assess.needs || !assess.needs.length) return { type: 'bpa', label: 'Go BPA', reason: 'No clear positional needs detected.' };
            const critical = assess.needs.filter(n => n.urgency === 'deficit');
            if (critical.length > 0) {
                return { type: 'target', label: 'Target ' + critical[0].pos, reason: critical[0].pos + ' is a critical need (' + critical.length + ' deficit position' + (critical.length > 1 ? 's' : '') + ').' };
            }
            return { type: 'bpa', label: 'Go BPA', reason: 'Needs are thin but not critical. Take the best player available.' };
        }, [assess]);

        // Best recommendations for next pick
        const recommendations = useMemo(() => {
            const targetPos = (strategyRec?.type === 'target' && strategyRec?.label) ? strategyRec.label.replace('Target ', '') : null;
            const totalTeams = currentLeague?.rosters?.length || 16;

            // Estimate pick position: for your first pick, how many picks come before you?
            const firstPick = myPicks.find(pk => pk.year === leagueSeason);
            // In a linear draft, your position is roughly your roster_id. Estimate picks before yours.
            // Use standings or roster order as a proxy for draft order
            const myDraftPos = myRoster?.roster_id || Math.ceil(totalTeams / 2);
            const picksBeforeMe = firstPick ? ((firstPick.round - 1) * totalTeams) + myDraftPos - 1 : 0;

            // Rookies ranked by pure DHQ — estimate top N will be drafted before your pick
            const byDhq = [...topProspects].sort((a, b) => b.dhq - a.dhq);
            const likelyGone = new Set(byDhq.slice(0, Math.max(0, picksBeforeMe)).map(r => r.pid));

            return topProspects
                .filter(r => !draftedPids.has(r.pid) && !likelyGone.has(r.pid))
                .sort((a, b) => {
                    const aComposite = a.dhq * 0.6 + a.fit.score * 80 + (targetPos && a.pos === targetPos ? 2000 : 0);
                    const bComposite = b.dhq * 0.6 + b.fit.score * 80 + (targetPos && b.pos === targetPos ? 2000 : 0);
                    return bComposite - aComposite;
                })
                .slice(0, 5);
        }, [topProspects, draftedPids, strategyRec, myPicks, myRoster]);

        // Fit color helper
        const fitColor = (score) => score >= 80 ? '#2ECC71' : score >= 60 ? '#D4AF37' : score >= 40 ? '#3498DB' : 'var(--silver)';

        // Tag button helper
        const tagDefs = { target: { icon: '\u2605', color: '#2ECC71', label: 'Target' }, avoid: { icon: '\u2717', color: '#E74C3C', label: 'Avoid' }, sleeper: { icon: '\u26A1', color: '#3498DB', label: 'Sleeper' }, must: { icon: '\u2B50', color: '#D4AF37', label: 'Must' } };

        // Sub-nav button style
        const navBtn = (view) => ({
            padding: '6px 16px', fontSize: '0.76rem', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase',
            letterSpacing: '0.06em', cursor: 'pointer', border: 'none', borderRadius: '4px',
            background: activeView === view ? 'rgba(212,175,55,0.2)' : 'transparent',
            color: activeView === view ? 'var(--gold)' : 'var(--silver)',
            borderBottom: activeView === view ? '2px solid var(--gold)' : '2px solid transparent',
            transition: 'all 0.15s'
        });

        return (
            <div style={{ padding: 'var(--card-pad, 14px 16px)' }}>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.06em', marginBottom: '12px' }}>DRAFT ROOM</div>

                {/* Sub-view navigation */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px', flexWrap: 'wrap' }}>
                    <button style={navBtn('command')} onClick={() => setDraftView('command')}>Flash Brief</button>
                    <button style={navBtn('board')} onClick={() => setDraftView('board')}>Big Board</button>
                    <button style={{...navBtn('mock'), background: activeView === 'mock' ? 'var(--gold)' : 'transparent', color: activeView === 'mock' ? 'var(--black)' : 'var(--gold)', border: activeView === 'mock' ? '2px solid var(--gold)' : '2px solid rgba(212,175,55,0.3)'}} onClick={() => setDraftView('mock')}>Mock Draft Center</button>
                    <button style={{...navBtn('live'), background: activeView === 'live' ? 'rgba(124,107,248,0.2)' : 'transparent', color: activeView === 'live' ? 'rgba(155,138,251,1)' : 'rgba(155,138,251,0.85)', border: activeView === 'live' ? '2px solid rgba(124,107,248,0.6)' : '2px solid rgba(124,107,248,0.25)'}} onClick={() => setDraftView('live')}>📡 Follow Live Draft</button>
                </div>

                {/* ═══════════════════ VIEW 1: FLASH BRIEF ═══════════════════ */}
                {activeView === 'command' && (
                    <div>
                        {/* Draft Countdown + Class Preview side by side */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>

                        {/* Draft Countdown Clock */}
                        {draftInfo?.start_time && draftInfo.status === 'pre_draft' ? (() => {
                            const now = countdownNow;
                            const start = draftInfo.start_time;
                            const diff = start - now;
                            if (diff <= 0) return <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: '8px', padding: 'var(--card-pad, 14px 16px)', textAlign: 'center', fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', color: '#2ECC71', letterSpacing: '0.04em' }}>DRAFT IS LIVE</div>;
                            const days = Math.floor(diff / 86400000);
                            const hours = Math.floor((diff % 86400000) / 3600000);
                            const mins = Math.floor((diff % 3600000) / 60000);
                            return <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', padding: 'var(--card-pad, 14px 16px)', textAlign: 'center' }}>
                                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Draft Countdown</div>
                                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2rem', color: 'var(--white)', letterSpacing: '0.04em' }}>
                                    {days > 0 ? days + 'd ' : ''}{hours}h {mins}m
                                </div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--silver)', marginTop: '4px' }}>
                                    {new Date(start).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at {new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--silver)', opacity: 0.5, marginTop: '4px' }}>
                                    {draftInfo.type === 'linear' ? 'Linear' : draftInfo.type === 'snake' ? 'Snake' : draftInfo.type} · {draftInfo.settings?.rounds || 5} rounds · {draftInfo.settings?.teams || 16} teams
                                </div>
                            </div>;
                        })() : <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', padding: 'var(--card-pad, 14px 16px)', textAlign: 'center' }}>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Draft Status</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--silver)' }}>No draft scheduled yet</div>
                        </div>}

                        {/* Draft Class Scouting Report */}
                        <div style={{ background: 'var(--black)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', padding: '12px 16px' }}>
                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Scouting Report</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--silver)', lineHeight: 1.6, marginBottom: '8px' }}>
                                Full {leagueSeason} rookie class analysis — positions to target, specific prospects, pick strategy, and traps to avoid.
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button onClick={() => {
                                    if (typeof setReconPanelOpen !== 'function') return;
                                    setReconPanelOpen(true);
                                    const needs = assess?.needs?.slice(0, 4).map(n => (typeof n === 'string' ? n : n.pos) + (n.urgency === 'deficit' ? ' (CRITICAL)' : '')).join(', ') || 'balanced';
                                    const picks = myPicks.filter(p => p.year === leagueSeason).map(p => 'R' + p.round + '.' + (p.pick || '??')).join(', ') || 'unknown';
                                    sendReconMessage(
                                        `SEARCH THE WEB for current ${leagueSeason} NFL draft prospect rankings. Generate a FULL scouting report for my ${currentLeague?.rosters?.length || 12}-team dynasty league.\n\n` +
                                        `MY NEEDS: ${needs}\nMY PICKS: ${picks}\n\n` +
                                        `Format as:\n1. TOP 3 POSITIONS TO TARGET — why each, citing roster gaps and class depth\n` +
                                        `2. DRAFT BOARD — 6 specific rookies with name, pos, NFL team, which of MY picks, and why\n` +
                                        `3. PICK STRATEGY — trade up/down advice based on value\n` +
                                        `4. AVOID — positions or rounds with poor returns\n\nBe specific with real prospect names.`
                                    );
                                }} style={{ padding: '6px 14px', fontSize: '0.72rem', fontFamily: 'Inter, sans-serif', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '6px', color: 'var(--gold)', cursor: 'pointer', fontWeight: 600 }}>
                                    Generate Full Report
                                </button>
                                <button onClick={() => { if (typeof setReconPanelOpen === 'function') { setReconPanelOpen(true); sendReconMessage('What are the strongest position groups in the ' + leagueSeason + ' rookie draft class? Who are the top 3 prospects at each position?'); } }}
                                    style={{ padding: '6px 14px', fontSize: '0.72rem', fontFamily: 'Inter, sans-serif', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--silver)', cursor: 'pointer' }}>
                                    Class Overview
                                </button>
                            </div>
                        </div>

                        </div>{/* end countdown + class preview grid */}

                        {/* Phase 7: Consolidated Picks + On the Clock header with 2.01 slot format */}
                        {(() => {
                            // Compute slot (1..N) for a roster by ascending wins → worst team picks first
                            const _slotMap = (() => {
                                const rosters = currentLeague?.rosters || [];
                                const sorted = [...rosters].sort((a, b) => {
                                    const aW = a.settings?.wins || 0, bW = b.settings?.wins || 0;
                                    if (aW !== bW) return aW - bW;
                                    const aP = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
                                    const bP = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
                                    return aP - bP;
                                });
                                const m = {}; sorted.forEach((r, i) => { m[String(r.roster_id)] = i + 1; });
                                return m;
                            })();
                            const slotFor = (pk) => {
                                const src = pk.own ? myRoster?.roster_id : pk.from;
                                return src != null ? _slotMap[String(src)] : null;
                            };
                            const fmtPick = (pk) => {
                                const s = slotFor(pk);
                                return pk.year + ' ' + pk.round + '.' + (s ? String(s).padStart(2, '0') : '??');
                            };
                            const nextSlot = nextPick ? slotFor(nextPick) : null;
                            return <div style={{ background: 'var(--black)', border: '2px solid rgba(212,175,55,0.3)', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px' }}>
                                {/* Hero: current slot + "on the clock" indicator */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ECC71', animation: 'pulse 2s infinite', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.8 }}>On The Clock — Your Next Pick</div>
                                        {nextPick ? (
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '2px' }}>
                                                <span style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.04em' }}>{fmtPick(nextPick)}</span>
                                                {!nextPick.own && <span style={{ fontSize: '0.7rem', color: '#9b8afb', background: 'rgba(124,107,248,0.12)', padding: '2px 8px', borderRadius: '3px', fontWeight: 700, letterSpacing: '0.04em' }}>ACQUIRED</span>}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '0.88rem', color: 'var(--silver)', marginTop: '4px' }}>No picks available for {leagueSeason}</div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--silver)', opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>
                                        <div>Total picks</div>
                                        <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.6rem', color: 'var(--gold)', fontWeight: 700, marginTop: '2px' }}>{myPicks.length}</div>
                                    </div>
                                </div>

                                {/* All picks by year — compact chip grid */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                                    {[leagueSeason, leagueSeason + 1, leagueSeason + 2].flatMap(yr => {
                                        const yearPicks = myPicks.filter(pk => pk.year === yr);
                                        if (!yearPicks.length) return [];
                                        return yearPicks.map((pk, i) => {
                                            const isNext = pk === nextPick;
                                            return <span key={yr + '-' + pk.round + '-' + i} style={{
                                                padding: '3px 9px', borderRadius: '4px',
                                                background: isNext ? 'rgba(212,175,55,0.2)' : (pk.own ? 'rgba(212,175,55,0.05)' : 'rgba(124,107,248,0.08)'),
                                                border: '1px solid ' + (isNext ? 'var(--gold)' : pk.own ? 'rgba(212,175,55,0.2)' : 'rgba(124,107,248,0.2)'),
                                                fontSize: '0.74rem', fontFamily: 'JetBrains Mono, monospace',
                                                color: isNext ? 'var(--gold)' : pk.own ? 'var(--silver)' : '#9b8afb',
                                                fontWeight: isNext ? 700 : 500,
                                            }} title={pk.own ? 'Your pick' : ('Acquired from roster ' + pk.from)}>
                                                {fmtPick(pk)}
                                            </span>;
                                        });
                                    })}
                                </div>

                                {/* Likely-available recommendations for current pick */}
                                {nextPick && recommendations.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.64rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', opacity: 0.7 }}>Likely Available at Your Pick</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {recommendations.slice(0, 5).map((r, i) => {
                                                const pos = normPos(r.p.position) || r.p.position;
                                                const composite = Math.round(r.dhq * 0.7 + r.fit.score * 30);
                                                const confidence = Math.min(99, Math.round((composite / (rookies[0]?.dhq * 0.7 + 99 * 30 || 1)) * 100));
                                                const needMatch = assess?.needs?.find(n => n.pos === pos);
                                                const reason = needMatch ? (needMatch.urgency === 'deficit' ? 'Fills critical ' + pos + ' need' : 'Addresses ' + pos + ' depth') : 'BPA at ' + pos;
                                                return (
                                                    <div key={r.pid} onClick={() => { if (window.WR?.openPlayerCard) window.WR.openPlayerCard(r.pid); else if (window._wrSelectPlayer) window._wrSelectPlayer(r.pid); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '6px', background: i === 0 ? 'rgba(212,175,55,0.08)' : 'transparent', border: '1px solid ' + (i === 0 ? 'rgba(212,175,55,0.2)' : 'transparent'), cursor: 'pointer' }}>
                                                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', color: 'var(--gold)', width: '16px' }}>{i + 1}</span>
                                                        <img src={'https://sleepercdn.com/content/nfl/players/thumb/' + r.pid + '.jpg'} alt="" onError={e => e.target.style.display='none'} style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }} />
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pName(r.p)}</div>
                                                            <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.5)' }}>{reason}</div>
                                                        </div>
                                                        <span style={{ fontSize: '0.66rem', fontWeight: 700, color: posColors[pos] || 'var(--silver)', padding: '1px 5px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px' }}>{pos}</span>
                                                        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.76rem', color: fitColor(r.fit.score), minWidth: '32px', textAlign: 'right' }}>{confidence}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>;
                        })()}

                        {/* Phase 7: Alex Ingram card removed per user feedback (2026-04-18).
                            Strategy advice now lives in the persistent GM Mode badge + GM Strategy tab.
                            Draft-strategy notes are still persistable via the Alex chat panel.
                            The in-draft AI stream (AlexStream in CommandCenter) is unaffected. */}

                        {/* Phase 7: Tier 1 Prospects card removed per user feedback (2026-04-18) */}
                    </div>
                )}

                {/* ═══════════════════ VIEW 2: BIG BOARD ═══════════════════ */}
                {activeView === 'board' && (() => {
                    // Initialize My Board order if empty
                    const initMyBoard = () => { if (myBoardOrder.length === 0) setMyBoardOrder(rookies.map(r => r.pid)); };

                    // Helpers: parse size like "6'4" → inches, draft sort key (drafted first)
                    const parseSizeIn = s => { const m = String(s||'').match(/(\d+)'?\s*(\d+)?/); return m ? parseInt(m[1])*12 + (parseInt(m[2])||0) : 0; };
                    const draftSortKey = r => {
                        const cs = r.csv || {};
                        if (cs.draftRound && cs.draftPick) return cs.draftRound * 1000 + cs.draftPick; // 1001..7256
                        if (cs.isUDFA) return 9000;
                        return 9999;
                    };

                    // Apply filters: position, team, round
                    let dhqBoardPlayers = [...rookies];
                    if (boardPosFilter) dhqBoardPlayers = dhqBoardPlayers.filter(r => normPos(r.p.position) === boardPosFilter);
                    if (boardTeamFilter) dhqBoardPlayers = dhqBoardPlayers.filter(r => (r.csv?.nflTeam || r.p?.team || '') === boardTeamFilter);
                    if (boardRoundFilter) dhqBoardPlayers = dhqBoardPlayers.filter(r => {
                        const cs = r.csv || {};
                        if (boardRoundFilter === 'UDFA') return cs.isUDFA;
                        if (boardRoundFilter === 'undrafted') return !cs.draftRound && !cs.isUDFA;
                        return String(cs.draftRound) === boardRoundFilter;
                    });
                    if (boardSort.key) {
                        dhqBoardPlayers.sort((a, b) => {
                            let va, vb;
                            const k = boardSort.key;
                            if (k === 'dhq') { va = a.dhq; vb = b.dhq; }
                            else if (k === 'name') { va = (a.p.full_name || '').toLowerCase(); vb = (b.p.full_name || '').toLowerCase(); }
                            else if (k === 'pos') { va = normPos(a.p.position) || ''; vb = normPos(b.p.position) || ''; }
                            else if (k === 'age') { va = a.p.age || (a.p.birth_date ? Math.floor((Date.now() - new Date(a.p.birth_date).getTime()) / 31557600000) : 99); vb = b.p.age || (b.p.birth_date ? Math.floor((Date.now() - new Date(b.p.birth_date).getTime()) / 31557600000) : 99); }
                            else if (k === 'fit') { va = computeFitScore(a).score; vb = computeFitScore(b).score; }
                            else if (k === 'school') { va = (a.csv?.college || a.p.college || '').toLowerCase(); vb = (b.csv?.college || b.p.college || '').toLowerCase(); }
                            else if (k === 'team')   { va = (a.csv?.nflTeam || a.p?.team || '').toLowerCase(); vb = (b.csv?.nflTeam || b.p?.team || '').toLowerCase(); }
                            else if (k === 'draft')  { va = draftSortKey(a); vb = draftSortKey(b); }
                            else if (k === 'rank')   { va = a.csv?.consensusRank ?? a.csv?.rank ?? 9999; vb = b.csv?.consensusRank ?? b.csv?.rank ?? 9999; }
                            else if (k === 'tier')   { va = a.csv?.tier ?? 99; vb = b.csv?.tier ?? 99; }
                            else if (k === 'size')   { va = parseSizeIn(a.csv?.size) || (a.p?.height || 0); vb = parseSizeIn(b.csv?.size) || (b.p?.height || 0); }
                            else if (k === 'weight') { va = parseFloat(a.csv?.weight) || parseFloat(a.p?.weight) || 0; vb = parseFloat(b.csv?.weight) || parseFloat(b.p?.weight) || 0; }
                            else if (k === 'speed')  { va = parseFloat(a.csv?.speed) || 99; vb = parseFloat(b.csv?.speed) || 99; }
                            else { va = 0; vb = 0; }
                            if (typeof va === 'string') return va < vb ? -boardSort.dir : va > vb ? boardSort.dir : 0;
                            return ((va || 0) - (vb || 0)) * boardSort.dir;
                        });
                    }

                    // Drag handlers
                    const handleDragStart = (pid) => setDragPid(pid);
                    const handleDragOver = (e) => e.preventDefault();
                    const handleDrop = (targetPid) => {
                        if (!dragPid || dragPid === targetPid) return;
                        setMyBoardOrder(prev => {
                            const order = prev.length ? [...prev] : rookies.map(r => r.pid);
                            const fromIdx = order.indexOf(dragPid);
                            const toIdx = order.indexOf(targetPid);
                            if (fromIdx === -1 || toIdx === -1) return order;
                            order.splice(fromIdx, 1);
                            order.splice(toIdx, 0, dragPid);
                            return order;
                        });
                        setDragPid(null);
                        if (boardMode !== 'my') setBoardMode('my');
                    };
                    const handleRankSubmit = (pid) => {
                        const newRank = parseInt(rankInput);
                        if (!newRank || newRank < 1) { setEditingRank(null); return; }
                        setMyBoardOrder(prev => {
                            const order = prev.length ? [...prev] : rookies.map(r => r.pid);
                            const fromIdx = order.indexOf(pid);
                            if (fromIdx === -1) return order;
                            order.splice(fromIdx, 1);
                            order.splice(Math.min(newRank - 1, order.length), 0, pid);
                            return order;
                        });
                        setEditingRank(null);
                        setRankInput('');
                        if (boardMode !== 'my') setBoardMode('my');
                    };

                    // Build My Board players list
                    initMyBoard();
                    const myOrder = myBoardOrder.length ? myBoardOrder : rookies.map(r => r.pid);
                    let myBoardPlayers = myOrder.map(pid => rookies.find(r => r.pid === pid)).filter(Boolean);
                    const inOrder = new Set(myOrder);
                    rookies.forEach(r => { if (!inOrder.has(r.pid)) myBoardPlayers.push(r); });
                    if (boardPosFilter) myBoardPlayers = myBoardPlayers.filter(r => normPos(r.p.position) === boardPosFilter);
                    if (boardTeamFilter) myBoardPlayers = myBoardPlayers.filter(r => (r.csv?.nflTeam || r.p?.team || '') === boardTeamFilter);
                    if (boardRoundFilter) myBoardPlayers = myBoardPlayers.filter(r => {
                        const cs = r.csv || {};
                        if (boardRoundFilter === 'UDFA') return cs.isUDFA;
                        if (boardRoundFilter === 'undrafted') return !cs.draftRound && !cs.isUDFA;
                        return String(cs.draftRound) === boardRoundFilter;
                    });

                    // Compact board renderer (used for both sides)
                    const sortArrow = (key) => boardSort.key === key ? (boardSort.dir === -1 ? ' \u25BC' : ' \u25B2') : '';
                    const toggleSort = (key) => setBoardSort(prev => prev.key === key ? { ...prev, dir: prev.dir * -1 } : { key, dir: ['name','school','team','rank','tier','draft','speed','age'].includes(key) ? 1 : -1 });
                    const sortHdr = { cursor: 'pointer', userSelect: 'none' };
                    const renderCompactBoard = (players, isDhq) => (
                        <div style={{ background: 'var(--black)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', maxHeight: 'none', overflowX: 'auto', overflowY: 'visible' }}>
                          <div style={{ minWidth: '780px' }}>
                            {/* Header — clickable to sort */}
                            <div style={{ display: 'flex', height: '32px', background: 'rgba(212,175,55,0.08)', borderBottom: '2px solid rgba(212,175,55,0.2)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
                                <div style={{ width: '24px', flexShrink: 0, textAlign: 'center' }}>#</div>
                                <div onClick={() => toggleSort('name')} style={{ ...sortHdr, flex: 1, padding: '0 4px', minWidth: '120px' }}>Player{sortArrow('name')}</div>
                                <div onClick={() => toggleSort('pos')} style={{ ...sortHdr, width: '30px', flexShrink: 0, textAlign: 'center' }}>Pos{sortArrow('pos')}</div>
                                <div onClick={() => toggleSort('team')} style={{ ...sortHdr, width: '36px', flexShrink: 0, textAlign: 'center' }}>Team{sortArrow('team')}</div>
                                <div onClick={() => toggleSort('draft')} style={{ ...sortHdr, width: '54px', flexShrink: 0, textAlign: 'center' }}>Draft{sortArrow('draft')}</div>
                                <div onClick={() => toggleSort('rank')} style={{ ...sortHdr, width: '36px', flexShrink: 0, textAlign: 'right' }}>Rk{sortArrow('rank')}</div>
                                <div onClick={() => toggleSort('tier')} style={{ ...sortHdr, width: '28px', flexShrink: 0, textAlign: 'center' }}>Tr{sortArrow('tier')}</div>
                                <div onClick={() => toggleSort('dhq')} style={{ ...sortHdr, width: '46px', flexShrink: 0, textAlign: 'right' }}>DHQ{sortArrow('dhq')}</div>
                                <div onClick={() => toggleSort('fit')} style={{ ...sortHdr, width: '32px', flexShrink: 0, textAlign: 'center' }}>Fit{sortArrow('fit')}</div>
                                <div onClick={() => toggleSort('age')} style={{ ...sortHdr, width: '28px', flexShrink: 0, textAlign: 'center' }}>Age{sortArrow('age')}</div>
                                <div onClick={() => toggleSort('size')} style={{ ...sortHdr, width: '38px', flexShrink: 0, textAlign: 'center' }}>Size{sortArrow('size')}</div>
                                <div onClick={() => toggleSort('weight')} style={{ ...sortHdr, width: '36px', flexShrink: 0, textAlign: 'right' }}>WT{sortArrow('weight')}</div>
                                <div onClick={() => toggleSort('speed')} style={{ ...sortHdr, width: '40px', flexShrink: 0, textAlign: 'right' }}>40{sortArrow('speed')}</div>
                                <div onClick={() => toggleSort('school')} style={{ ...sortHdr, width: '70px', flexShrink: 0, padding: '0 4px', overflow: 'hidden' }}>School{sortArrow('school')}</div>
                                <div style={{ width: '20px', flexShrink: 0 }}></div>
                                {!isDhq && <div style={{ width: '28px', flexShrink: 0 }}></div>}
                            </div>
                            {players.map((r, idx) => {
                                const pos = normPos(r.p.position) || r.p.position;
                                const dhqC = r.dhq >= 7000 ? '#2ECC71' : r.dhq >= 4000 ? '#3498DB' : r.dhq >= 2000 ? 'var(--silver)' : 'rgba(255,255,255,0.3)';
                                const isDrafted = draftedPids.has(r.pid);
                                const tag = boardTags[r.pid];
                                const isExp = expandedDraftPid === r.pid;
                                const age = r.p.age || (r.csv?.age ? parseFloat(r.csv.age) : null) || (r.p.birth_date ? Math.floor((Date.now() - new Date(r.p.birth_date).getTime()) / 31557600000) : (r.p.years_exp === 0 ? 21 : null));
                                const college = r.csv?.college || r.p.college || r.p.metadata?.college || '';
                                const cs = r.csv || {};
                                const team = cs.nflTeam || r.p?.team || '';
                                const fitObj = computeFitScore(r);
                                const fitChar = fitObj.score >= 70 ? 'F' : fitObj.score >= 50 ? 'V' : '\u2014';
                                const fitCol = fitObj.score >= 70 ? '#2ECC71' : fitObj.score >= 50 ? 'var(--gold)' : 'var(--silver)';
                                const sizeStr = cs.size || (r.p?.height ? Math.floor(r.p.height/12)+"'"+(r.p.height%12) : '');
                                const wtStr = cs.weight || r.p?.weight || '';
                                const speedStr = cs.speed || '';
                                const draftStr = cs.draftRound && cs.draftPick
                                    ? 'R' + cs.draftRound + '.' + String(cs.draftPick).padStart(2,'0')
                                    : cs.isUDFA ? 'UDFA' : '';
                                const draftCol = cs.draftRound === 1 ? '#2ECC71' : cs.draftRound && cs.draftRound <= 3 ? 'var(--gold)' : cs.isUDFA ? 'var(--silver)' : 'rgba(255,255,255,0.3)';
                                return (
                                    <React.Fragment key={r.pid}>
                                    <div
                                        draggable={!isDhq}
                                        onDragStart={!isDhq ? () => handleDragStart(r.pid) : undefined}
                                        onDragOver={!isDhq ? handleDragOver : undefined}
                                        onDrop={!isDhq ? () => handleDrop(r.pid) : undefined}
                                        onClick={() => setExpandedDraftPid(prev => {
                                            const next = prev === r.pid ? null : r.pid;
                                            if (next) window.OD?.trackDraftPlayerExpanded?.(r.pid, {
                                                platform: 'warroom',
                                                module: 'draft',
                                                leagueId: window.S?.currentLeagueId || null,
                                                metadata: { boardMode, source: 'draft_board' },
                                            });
                                            return next;
                                        })}
                                        style={{ display: 'flex', alignItems: 'center', height: '34px', opacity: isDrafted ? 0.3 : 1, borderBottom: isExp ? 'none' : '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: isExp ? 'rgba(212,175,55,0.06)' : idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent', transition: 'background 0.1s', position: 'relative' }}
                                        onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = 'rgba(212,175,55,0.04)'; }}
                                        onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = isExp ? 'rgba(212,175,55,0.06)' : idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent'; }}>
                                        <div style={{ width: '24px', flexShrink: 0, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: idx < 3 ? 'var(--gold)' : 'var(--silver)' }}>{idx + 1}</div>
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', minWidth: '120px' }}>
                                            <div style={{ width: '20px', height: '20px', flexShrink: 0 }}>
                                                <img src={'https://sleepercdn.com/content/nfl/players/thumb/' + r.pid + '.jpg'} alt="" onError={e => e.target.style.display='none'} style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ fontWeight: 600, fontSize: '0.74rem', color: 'var(--white)', textDecoration: isDrafted ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pName(r.p)}</div>
                                        </div>
                                        <div style={{ width: '30px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: posColors[pos] || 'var(--silver)', padding: '1px 4px', background: (posColors[pos] || '#666') + '22', borderRadius: '3px' }}>{pos}</span>
                                        </div>
                                        <div style={{ width: '36px', flexShrink: 0, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', fontWeight: 700, color: team ? '#2ECC71' : 'var(--silver)' }}>{team || '\u2014'}</div>
                                        <div style={{ width: '54px', flexShrink: 0, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', fontWeight: 700, color: draftCol }}>{draftStr || '\u2014'}</div>
                                        <div style={{ width: '36px', flexShrink: 0, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.66rem', color: 'var(--silver)', paddingRight: '4px' }}>{(cs.consensusRank || cs.rank) ? '#' + Math.round(cs.consensusRank || cs.rank) : '\u2014'}</div>
                                        <div style={{ width: '28px', flexShrink: 0, textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: '0.66rem', fontWeight: 700, color: cs.tier === 1 ? '#2ECC71' : cs.tier === 2 ? '#3498DB' : 'var(--silver)' }}>{cs.tier || '\u2014'}</div>
                                        <div style={{ width: '46px', flexShrink: 0, textAlign: 'right', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.7rem', color: dhqC }}>{r.dhq > 0 ? r.dhq.toLocaleString() : '\u2014'}</div>
                                        <div style={{ width: '32px', flexShrink: 0, textAlign: 'center', fontSize: '0.66rem', fontWeight: 700, color: fitCol }}>{fitChar}</div>
                                        <div style={{ width: '28px', flexShrink: 0, textAlign: 'center', fontSize: '0.7rem', color: 'var(--silver)' }}>{age || '\u2014'}</div>
                                        <div style={{ width: '38px', flexShrink: 0, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--silver)' }}>{sizeStr || '\u2014'}</div>
                                        <div style={{ width: '36px', flexShrink: 0, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'var(--silver)', paddingRight: '4px' }}>{wtStr || '\u2014'}</div>
                                        <div style={{ width: '40px', flexShrink: 0, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: speedStr && parseFloat(speedStr) <= 4.45 ? '#2ECC71' : 'var(--silver)', paddingRight: '4px' }}>{speedStr || '\u2014'}</div>
                                        <div style={{ width: '70px', flexShrink: 0, padding: '0 4px', overflow: 'hidden' }}>
                                            <div title={college} style={{ fontSize: '0.62rem', color: 'var(--silver)', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{college || '\u2014'}</div>
                                        </div>
                                        <div style={{ width: '20px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                                            {tag ? <span style={{ fontSize: '0.7rem', color: tagDefs[tag].color }} title={tagDefs[tag].label}>{tagDefs[tag].icon}</span> : null}
                                        </div>
                                        {!isDhq && (
                                            <div style={{ width: '28px', flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                                                <button onClick={e => { e.stopPropagation(); setDraftedPids(prev => { const n = new Set(prev); if (n.has(r.pid)) n.delete(r.pid); else n.add(r.pid); return n; }); }}
                                                    style={{ fontSize: '0.56rem', padding: '1px 4px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer', background: isDrafted ? 'rgba(231,76,60,0.15)' : 'rgba(255,255,255,0.04)', color: isDrafted ? '#E74C3C' : 'var(--silver)', fontFamily: 'Inter, sans-serif' }}>
                                                    {isDrafted ? '\u21A9' : 'X'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    </React.Fragment>
                                );
                            })}
                            {players.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: 'var(--silver)', opacity: 0.5, fontSize: '0.76rem' }}>No players match filter</div>}
                          </div>
                        </div>
                    );

                    // Build NFL team list from rookies that have a team set (drafted/UDFA-signed)
                    const teamSet = new Set();
                    rookies.forEach(r => { const t = r.csv?.nflTeam || r.p?.team; if (t) teamSet.add(t); });
                    const availableTeams = Array.from(teamSet).sort();

                    return (
                    <div>
                        {/* Position filters */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={() => setBoardPosFilter('')} style={{ padding: '4px 10px', fontSize: '0.72rem', fontFamily: 'Inter, sans-serif', borderRadius: '14px', cursor: 'pointer', border: '1px solid ' + (!boardPosFilter ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'), background: !boardPosFilter ? 'rgba(212,175,55,0.12)' : 'transparent', color: !boardPosFilter ? 'var(--gold)' : 'var(--silver)' }}>Master</button>
                            {(typeof getLeaguePositions === 'function' ? getLeaguePositions() : ['QB','RB','WR','TE','DL','LB','DB']).map(pos => (
                                <button key={pos} onClick={() => setBoardPosFilter(boardPosFilter === pos ? '' : pos)} style={{ padding: '4px 10px', fontSize: '0.72rem', fontFamily: 'Inter, sans-serif', borderRadius: '14px', cursor: 'pointer', border: '1px solid ' + (boardPosFilter === pos ? (posColors[pos] || '#666') + '55' : 'rgba(255,255,255,0.08)'), background: boardPosFilter === pos ? (posColors[pos] || '#666') + '18' : 'transparent', color: boardPosFilter === pos ? posColors[pos] : 'var(--silver)' }}>{pos}</button>
                            ))}
                            <span style={{ marginLeft: 'auto', fontSize: '0.64rem', color: 'var(--silver)', opacity: 0.4 }}>Click row to expand {'\u00B7'} Drag to reorder My Board</span>
                        </div>

                        {/* Team & Round filters */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.64rem', color: 'var(--silver)', opacity: 0.6, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team</span>
                                <select value={boardTeamFilter} onChange={e => setBoardTeamFilter(e.target.value)} style={{ padding: '3px 6px', fontSize: '0.7rem', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,255,255,0.04)', color: boardTeamFilter ? 'var(--gold)' : 'var(--silver)', border: '1px solid ' + (boardTeamFilter ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.1)'), borderRadius: '6px', cursor: 'pointer', outline: 'none' }}>
                                    <option value="">All teams</option>
                                    {availableTeams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.64rem', color: 'var(--silver)', opacity: 0.6, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '2px' }}>Round</span>
                                {[
                                    { k: '', label: 'All' },
                                    { k: '1', label: 'R1' },
                                    { k: '2', label: 'R2' },
                                    { k: '3', label: 'R3' },
                                    { k: '4', label: 'R4' },
                                    { k: '5', label: 'R5' },
                                    { k: '6', label: 'R6' },
                                    { k: '7', label: 'R7' },
                                    { k: 'UDFA', label: 'UDFA' },
                                    { k: 'undrafted', label: 'Undrafted' },
                                ].map(opt => (
                                    <button key={opt.k} onClick={() => setBoardRoundFilter(boardRoundFilter === opt.k ? '' : opt.k)} style={{ padding: '3px 8px', fontSize: '0.66rem', fontFamily: 'Inter, sans-serif', borderRadius: '10px', cursor: 'pointer', border: '1px solid ' + (boardRoundFilter === opt.k ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'), background: boardRoundFilter === opt.k ? 'rgba(212,175,55,0.14)' : 'transparent', color: boardRoundFilter === opt.k ? 'var(--gold)' : 'var(--silver)' }}>{opt.label}</button>
                                ))}
                            </div>
                            {(boardTeamFilter || boardRoundFilter) && (
                                <button onClick={() => { setBoardTeamFilter(''); setBoardRoundFilter(''); }} style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: '0.64rem', fontFamily: 'Inter, sans-serif', background: 'transparent', color: 'var(--silver)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer' }}>Clear</button>
                            )}
                        </div>

                        {/* Expanded player card — full width ABOVE boards */}
                        {expandedDraftPid && (() => {
                            const r = rookies.find(rk => rk.pid === expandedDraftPid);
                            if (!r) return null;
                            const pos = normPos(r.p.position) || r.p.position;
                            const dhqColVal = r.dhq >= 7000 ? '#2ECC71' : r.dhq >= 4000 ? '#3498DB' : r.dhq >= 2000 ? 'var(--silver)' : 'rgba(255,255,255,0.3)';
                            const fit = computeFitScore(r);
                            const note = boardNotes[r.pid] || '';
                            const tag = boardTags[r.pid];
                            const csv = r.csv;
                            const age = r.p.age || (csv?.age ? parseFloat(csv.age) : null) || (r.p.birth_date ? Math.floor((Date.now() - new Date(r.p.birth_date).getTime()) / 31557600000) : r.p.years_exp === 0 ? 21 : '\u2014');
                            const college = csv?.college || r.p.college || r.p.metadata?.college || '';
                            const size = csv?.size || (r.p.height ? Math.floor(r.p.height/12)+"'"+r.p.height%12+'"' : '');
                            const weight = csv?.weight || r.p.weight || '';
                            const speed = csv?.speed || '';
                            const photoSrc = r.isCSVOnly && csv?.espnId ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${csv.espnId}.png&w=96&h=70` : `https://sleepercdn.com/content/nfl/players/${r.pid}.jpg`;
                            return (
                                <div style={{ border: '2px solid rgba(212,175,55,0.25)', borderRadius: '10px', background: 'var(--black)', padding: '16px 20px', marginBottom: '14px', animation: 'wrFadeIn 0.2s ease' }}>
                                  <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                                    <div style={{ flexShrink: 0, position: 'relative' }}>
                                      <img src={photoSrc} alt="" onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}} style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover', objectPosition: 'top', border: '2px solid rgba(212,175,55,0.3)' }} />
                                      <div style={{ display: 'none', width: '80px', height: '80px', borderRadius: '10px', background: 'var(--charcoal)', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: 'var(--silver)', border: '2px solid rgba(212,175,55,0.2)' }}>{(r.p.first_name||'?')[0]}{(r.p.last_name||'?')[0]}</div>
                                      <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: '8px', background: (posColors[pos]||'#666')+'25', color: posColors[pos]||'var(--silver)', whiteSpace: 'nowrap' }}>{pos}</div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.3rem', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.1 }}>{r.p.full_name || pName(r.p)}{r.isCSVOnly && <span style={{ fontSize: '0.6rem', marginLeft: '8px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(124,107,248,0.15)', color: '#9b8afb', fontFamily: 'Inter, sans-serif', verticalAlign: 'middle' }}>PROSPECT</span>}</div>
                                      <div style={{ fontSize: '0.78rem', color: 'var(--silver)', marginTop: '2px' }}>
                                        {pos} {'\u00B7'} {csv?.nflTeam || r.p.team || 'TBD'} {'\u00B7'} Age {age} {'\u00B7'} {college || 'Unknown'}
                                        {size ? ' \u00B7 ' + size : ''}
                                        {weight ? ' \u00B7 ' + weight + 'lbs' : ''}
                                        {speed ? ' \u00B7 ' + speed + 's' : ''}
                                      </div>
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', padding: '2px 10px', borderRadius: '10px', background: dhqColVal + '20', color: dhqColVal }}>{r.dhq > 0 ? r.dhq.toLocaleString() + ' DHQ' : 'No DHQ'}</span>
                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', background: fitColor(fit.score) + '15', color: fitColor(fit.score) }}>{fit.label} Fit</span>
                                        {tag && <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', background: tagDefs[tag].color + '20', color: tagDefs[tag].color }}>{tagDefs[tag].icon} {tagDefs[tag].label}</span>}
                                      </div>
                                      {/* Quick tag buttons */}
                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        {Object.entries(tagDefs).map(([tKey, tDef]) => (
                                          <button key={tKey} onClick={(e) => { e.stopPropagation(); const wasActive = boardTags[r.pid] === tKey; setBoardTags(prev => ({ ...prev, [r.pid]: prev[r.pid] === tKey ? undefined : tKey })); if (!wasActive) { window.wrLogAction?.('\uD83C\uDFAF', 'Tagged ' + pName(r.p) + ' on draft board', 'draft', { players: [{ name: pName(r.p) }], actionType: 'board-tag' }); } }} style={{ padding: '3px 10px', fontSize: '0.68rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, borderRadius: '12px', cursor: 'pointer', border: '1px solid ' + (tag === tKey ? tDef.color : 'rgba(255,255,255,0.12)'), background: tag === tKey ? tDef.color + '25' : 'rgba(255,255,255,0.03)', color: tag === tKey ? tDef.color : 'var(--silver)', transition: 'all 0.15s' }}>{tDef.icon} {tDef.label}</button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px', marginBottom: '14px' }}>
                                    {[
                                      { label: 'DHQ', val: r.dhq > 0 ? r.dhq.toLocaleString() : '\u2014', col: dhqColVal, gauge: true },
                                      { label: 'FIT', val: fit.label, col: fitColor(fit.score) },
                                      csv?.rank ? { label: 'RANK', val: '#' + csv.rank, col: csv.rank <= 10 ? '#2ECC71' : csv.rank <= 32 ? '#D4AF37' : 'var(--silver)' } : null,
                                      csv?.tier ? { label: 'TIER', val: csv.tier, col: csv.tier === 'ELITE' ? '#2ECC71' : csv.tier === 'BLUE_CHIP' ? '#3498DB' : 'var(--gold)' } : null,
                                      { label: 'AGE', val: age, col: typeof age === 'number' && age <= 22 ? '#2ECC71' : 'var(--silver)' },
                                      size ? { label: 'SIZE', val: size, col: 'var(--silver)' } : null,
                                      weight ? { label: 'WT', val: weight + 'lbs', col: 'var(--silver)' } : null,
                                      speed ? { label: '40 YD', val: speed + 's', col: parseFloat(speed) <= 4.45 ? '#2ECC71' : 'var(--silver)' } : null,
                                      { label: 'TEAM', val: csv?.nflTeam || r.p.team || 'TBD', col: (csv?.nflTeam || r.p.team) ? '#2ECC71' : 'var(--silver)' },
                                      csv?.draftRound && csv?.draftPick
                                        ? { label: 'DRAFTED', val: 'R' + csv.draftRound + '.' + String(csv.draftPick).padStart(2,'0'), col: csv.draftRound === 1 ? '#2ECC71' : csv.draftRound <= 3 ? '#D4AF37' : 'var(--silver)' }
                                        : csv?.isUDFA
                                          ? { label: 'DRAFTED', val: 'UDFA', col: 'var(--silver)' }
                                          : null,
                                    ].filter(Boolean).map((s, i) => {
                                      const dhqFilled = s.gauge ? Math.round(Math.min(10, r.dhq / 1000)) : 0;
                                      const dhqGaugeCol = r.dhq >= 7000 ? 'filled-green' : r.dhq >= 4000 ? 'filled' : 'filled-red';
                                      return (
                                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 600, color: s.col, letterSpacing: '-0.02em' }}>{s.val}</div>
                                        {s.gauge && <div className="wr-gauge" style={{ marginTop: '3px' }}>{Array.from({length: 10}, (_, gi) => <div key={gi} className={'wr-gauge-seg' + (gi < dhqFilled ? ' ' + dhqGaugeCol : '')}></div>)}</div>}
                                        <div style={{ fontSize: '0.64rem', color: 'var(--silver)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{s.label}</div>
                                      </div>
                                    ); })}
                                  </div>

                                  <InlineCareerStats pid={r.pid} pos={pos} player={r.p} scoringSettings={currentLeague?.scoring_settings} statsData={statsData} />

                                  {csv?.summary && (
                                  <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Scouting Report</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--silver)', lineHeight: 1.7 }}>{csv.summary}</div>
                                  </div>
                                  )}

                                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Scouting Notes</div>
                                    <textarea value={note} onChange={e => setBoardNotes(prev => ({...prev, [r.pid]: e.target.value}))} placeholder={'Add your scouting notes on ' + pName(r.p) + '...'} style={{ width: '100%', minHeight: '70px', padding: '8px 10px', fontSize: '0.78rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'var(--silver)', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, outline: 'none' }} />
                                  </div>

                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <a href={'https://www.sports-reference.com/cfb/search/search.fcgi?search=' + encodeURIComponent(pName(r.p))} target="_blank" rel="noopener" style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(52,152,219,0.12)', color: '#3498DB', border: '1px solid rgba(52,152,219,0.3)', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>{'\uD83C\uDFC8'} COLLEGE STATS</a>
                                    <a href={'https://www.youtube.com/results?search_query=' + encodeURIComponent(pName(r.p) + ' highlights ' + leagueSeason)} target="_blank" rel="noopener" style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(231,76,60,0.12)', color: '#E74C3C', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>{'\u25B6'} HIGHLIGHTS</a>
                                    <a href={'https://www.fantasypros.com/nfl/players/' + encodeURIComponent(((r.p.first_name || '') + '-' + (r.p.last_name || '')).toLowerCase().replace(/[^a-z-]/g, '')) + '.php'} target="_blank" rel="noopener" style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(52,152,219,0.15)', color: '#3498DB', border: '1px solid rgba(52,152,219,0.3)', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>{'\uD83D\uDCF0'} NEWS</a>
                                    {(r.p.years_exp === 0) && <a href={'https://www.nfl.com/prospects/' + encodeURIComponent(((r.p.first_name || '') + '-' + (r.p.last_name || '')).toLowerCase().replace(/\s+/g, '-')) + '/'} target="_blank" rel="noopener" style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(46,204,113,0.15)', color: '#2ECC71', border: '1px solid rgba(46,204,113,0.3)', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>{'\uD83C\uDFC8'} NFL PROFILE</a>}
                                    <button onClick={() => {
                                        // Phase 7 deferred: emit scouting event so the CommandCenter's AlexStream
                                        // picks it up inline instead of hijacking the separate chat panel.
                                        const name = pName(r.p);
                                        const summary = r.csv?.summary || '';
                                        const csv = r.csv || {};
                                        // Compose a multi-section fullText from available CSV fields
                                        const sections = [];
                                        if (csv.summary) sections.push(csv.summary);
                                        if (csv.strengths) sections.push('Strengths: ' + csv.strengths);
                                        if (csv.weaknesses) sections.push('Weaknesses: ' + csv.weaknesses);
                                        if (csv.nflComp || csv.comp) sections.push('NFL Comp: ' + (csv.nflComp || csv.comp));
                                        if (csv.notes) sections.push(csv.notes);
                                        const fullText = sections.join('\n\n') || summary;
                                        window.dispatchEvent(new CustomEvent('wr:scouting-generate', { detail: { pid: r.pid, playerName: name, pos, college, summary, fullText } }));
                                        // Also fall back to chat when AlexStream isn't mounted (user is on Draft tab, not in mock draft)
                                        if (typeof sendReconMessage === 'function') { setReconPanelOpen(true); sendReconMessage('Give me a full scouting report on ' + name + ' (' + pos + ', ' + college + '). Include strengths, weaknesses, NFL comparison, and where I should draft them.'); }
                                    }} style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(124,107,248,0.15)', color: '#9b8afb', border: '1px solid rgba(124,107,248,0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>ASK ALEX</button>
                                    <button onClick={() => setExpandedDraftPid(null)} style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'transparent', color: 'var(--silver)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }}>COLLAPSE</button>
                                  </div>
                                </div>
                            );
                        })()}

                        {/* Phase 7 deferred: Full-screen single board with DHQ ↔ My Board toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            {[
                                { k: 'dhq', label: 'DHQ Board', sub: 'engine rankings' },
                                { k: 'my', label: 'My Board', sub: 'your rankings (drag to reorder)' },
                            ].map(t => (
                                <button key={t.k} onClick={() => setBoardMode(t.k)} style={{
                                    padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif',
                                    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700,
                                    background: boardMode === t.k ? 'var(--gold)' : 'rgba(255,255,255,0.04)',
                                    color: boardMode === t.k ? 'var(--black)' : 'var(--silver)',
                                    border: '1px solid ' + (boardMode === t.k ? 'var(--gold)' : 'rgba(255,255,255,0.08)'),
                                    borderRadius: '6px', cursor: 'pointer'
                                }}>{t.label}</button>
                            ))}
                            <span style={{ fontSize: '0.7rem', color: 'var(--silver)', opacity: 0.55, marginLeft: '6px' }}>
                                {boardMode === 'dhq' ? 'Auto-sorted by DHQ engine' : 'Drag any row to reorder · click # to edit rank'}
                            </span>
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                            {boardMode === 'dhq' ? renderCompactBoard(dhqBoardPlayers, true) : renderCompactBoard(myBoardPlayers, false)}
                        </div>

                        {/* Expanded card moved above boards — old location */}

                        {/* OLD BOARD — REPLACED BY SIDE-BY-SIDE ABOVE */}
                        {false && <div style={{ background: 'var(--black)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', overflow: 'hidden' }}>
                            {/* Header */}
                            <div style={{ display: 'flex', height: '36px', background: 'rgba(212,175,55,0.08)', borderBottom: '2px solid rgba(212,175,55,0.2)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gold)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', alignItems: 'center' }}>
                                <div style={{ width: '260px', flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 10px', gap: '4px', borderRight: '2px solid rgba(212,175,55,0.15)' }}>
                                    <span style={{ width: '30px', textAlign: 'center' }}>#</span>
                                    <span style={{ flex: 1 }} onClick={() => boardMode === 'dhq' && setBoardSort(prev => prev.key === 'name' ? {...prev, dir: prev.dir * -1} : {key: 'name', dir: 1})} style={{ flex: 1, cursor: boardMode === 'dhq' ? 'pointer' : 'default' }}>Player{boardSort.key === 'name' && boardMode === 'dhq' ? (boardSort.dir === -1 ? ' \u25BC' : ' \u25B2') : ''}</span>
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                    {[{k:'pos',l:'Pos',w:'48px'},{k:'age',l:'Age',w:'42px'},{k:'dhq',l:'DHQ',w:'64px'},{k:'fit',l:'Fit',w:'70px'},{k:'school',l:'School',w:'1fr'}].map(col => (
                                        <div key={col.k} onClick={() => boardMode === 'dhq' && setBoardSort(prev => prev.key === col.k ? {...prev, dir: prev.dir * -1} : {key: col.k, dir: -1})}
                                            style={{ width: col.w === '1fr' ? undefined : col.w, flex: col.w === '1fr' ? 1 : undefined, minWidth: col.w === '1fr' ? '60px' : col.w, flexShrink: 0, textAlign: 'center', cursor: boardMode === 'dhq' ? 'pointer' : 'default', userSelect: 'none', padding: '0 4px' }}>
                                            {col.l}{boardSort.key === col.k && boardMode === 'dhq' ? (boardSort.dir === -1 ? ' \u25BC' : ' \u25B2') : ''}
                                        </div>
                                    ))}
                                    <div style={{ width: '100px', flexShrink: 0, textAlign: 'center' }}>Tags</div>
                                    <div style={{ width: '62px', flexShrink: 0 }}></div>
                                </div>
                            </div>
                            {boardPlayers.map((r, idx) => {
                                const pos = normPos(r.p.position) || r.p.position;
                                const dhqColVal = r.dhq >= 7000 ? '#2ECC71' : r.dhq >= 4000 ? '#3498DB' : r.dhq >= 2000 ? 'var(--silver)' : 'rgba(255,255,255,0.3)';
                                const fit = computeFitScore(r);
                                const isDrafted = draftedPids.has(r.pid);
                                const tag = boardTags[r.pid];
                                const note = boardNotes[r.pid] || '';
                                const age = r.p.age || (r.p.birth_date ? Math.floor((Date.now() - new Date(r.p.birth_date).getTime()) / 31557600000) : r.p.years_exp === 0 ? 21 : '\u2014');
                                const college = r.p.college || r.p.metadata?.college || '';
                                const isEditing = editingRank === r.pid;
                                const isExp = expandedDraftPid === r.pid;
                                const contract = window.NFL_CONTRACTS?.[r.pid];
                                return (
                                    <React.Fragment key={r.pid}>
                                    <div
                                        draggable={boardMode === 'my'}
                                        onDragStart={() => handleDragStart(r.pid)}
                                        onDragOver={handleDragOver}
                                        onDrop={() => handleDrop(r.pid)}
                                        onClick={() => setExpandedDraftPid(prev => {
                                            const next = prev === r.pid ? null : r.pid;
                                            if (next) window.OD?.trackDraftPlayerExpanded?.(r.pid, {
                                                platform: 'warroom',
                                                module: 'draft',
                                                leagueId: window.S?.currentLeagueId || null,
                                                metadata: { boardMode, source: 'my_board' },
                                            });
                                            return next;
                                        })}
                                        style={{ display: 'flex', opacity: isDrafted ? 0.35 : dragPid === r.pid ? 0.5 : 1, borderBottom: isExp ? 'none' : '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: isExp ? 'rgba(212,175,55,0.06)' : idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent', transition: 'background 0.1s' }}
                                        onMouseEnter={e => { if (!isExp) e.currentTarget.style.background = 'rgba(212,175,55,0.04)'; }}
                                        onMouseLeave={e => { if (!isExp) e.currentTarget.style.background = isExp ? 'rgba(212,175,55,0.06)' : idx % 2 === 1 ? 'rgba(255,255,255,0.015)' : 'transparent'; }}>
                                        {/* Frozen left: rank + photo + name */}
                                        <div style={{ width: '260px', flexShrink: 0, height: '42px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', borderRight: '2px solid rgba(212,175,55,0.15)' }}>
                                            {isEditing ? (
                                                <input autoFocus type="number" min="1" value={rankInput} onChange={e => setRankInput(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleRankSubmit(r.pid); if (e.key === 'Escape') setEditingRank(null); }}
                                                    onBlur={() => handleRankSubmit(r.pid)}
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ width: '28px', padding: '1px 2px', fontSize: '0.72rem', background: 'rgba(212,175,55,0.15)', border: '1px solid var(--gold)', borderRadius: '3px', color: 'var(--gold)', textAlign: 'center', outline: 'none', flexShrink: 0 }} />
                                            ) : (
                                                <span onClick={e => { e.stopPropagation(); setEditingRank(r.pid); setRankInput(String(idx + 1)); }}
                                                    style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.76rem', color: idx < 3 ? 'var(--gold)' : 'var(--silver)', cursor: 'pointer', textAlign: 'center', width: '24px', flexShrink: 0 }} title="Click to change rank">{idx + 1}</span>
                                            )}
                                            <div style={{ width: '26px', height: '26px', flexShrink: 0 }}>
                                                <img src={'https://sleepercdn.com/content/nfl/players/thumb/' + r.pid + '.jpg'} alt="" onError={e => e.target.style.display='none'} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
                                            </div>
                                            <div style={{ overflow: 'hidden', flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--white)', textDecoration: isDrafted ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pName(r.p)}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--silver)', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p.team || 'TBD'}{college ? ' \u00B7 ' + college : ''}{note ? ' \u00B7 ' + note : ''}</div>
                                            </div>
                                            <span style={{ fontSize: '0.68rem', color: 'var(--gold)', opacity: 0.4 }}>{isExp ? '\u25B2' : '\u25BC'}</span>
                                        </div>
                                        {/* Data columns */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: '42px' }}>
                                            <div style={{ width: '48px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: posColors[pos] || 'var(--silver)', padding: '2px 8px', background: (posColors[pos] || '#666') + '22', borderRadius: '4px' }}>{pos}</span>
                                            </div>
                                            <div style={{ width: '42px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', color: 'var(--silver)' }}>{age}</div>
                                            <div style={{ width: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.78rem', color: dhqColVal }}>{r.dhq > 0 ? r.dhq.toLocaleString() : '\u2014'}</div>
                                            <div style={{ width: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span title={fit.score + '/99'} style={{ fontSize: '0.68rem', fontWeight: 700, color: fitColor(fit.score), padding: '1px 8px', background: fitColor(fit.score) + '15', borderRadius: '8px' }}>{fit.label}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: '60px', display: 'flex', alignItems: 'center', fontSize: '0.72rem', color: 'var(--silver)', opacity: 0.6, overflow: 'hidden', padding: '0 4px' }}>
                                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{college || '\u2014'}</span>
                                            </div>
                                            <div style={{ width: '100px', flexShrink: 0, display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                                                {Object.entries(tagDefs).map(([tKey, tDef]) => (
                                                    <button key={tKey} onClick={e => { e.stopPropagation(); const wasActive = boardTags[r.pid] === tKey; setBoardTags(prev => ({ ...prev, [r.pid]: prev[r.pid] === tKey ? undefined : tKey })); if (!wasActive) { window.wrLogAction?.('\uD83C\uDFAF', 'Tagged ' + pName(r.p) + ' on draft board', 'draft', { players: [{ name: pName(r.p) }], actionType: 'board-tag' }); } }}
                                                        title={tDef.label}
                                                        style={{ width: '18px', height: '18px', fontSize: '0.6rem', border: 'none', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            background: tag === tKey ? tDef.color + '33' : 'rgba(255,255,255,0.04)', color: tag === tKey ? tDef.color : 'rgba(255,255,255,0.2)' }}>
                                                        {tDef.icon}
                                                    </button>
                                                ))}
                                                <a href={'https://www.youtube.com/results?search_query=' + encodeURIComponent(pName(r.p) + ' highlights ' + leagueSeason)} target="_blank" rel="noopener"
                                                    title="Watch highlights" onClick={e => e.stopPropagation()}
                                                    style={{ width: '18px', height: '18px', fontSize: '0.6rem', border: 'none', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(231,76,60,0.08)', color: '#E74C3C', textDecoration: 'none' }}>
                                                    &#9654;
                                                </a>
                                            </div>
                                            <div style={{ width: '62px', flexShrink: 0, display: 'flex', gap: '3px', alignItems: 'center', justifyContent: 'center' }}>
                                                <button onClick={e => { e.stopPropagation(); setDraftedPids(prev => { const n = new Set(prev); if (n.has(r.pid)) n.delete(r.pid); else n.add(r.pid); return n; }); }}
                                                    style={{ fontSize: '0.6rem', padding: '2px 5px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', cursor: 'pointer', background: isDrafted ? 'rgba(231,76,60,0.15)' : 'rgba(255,255,255,0.04)', color: isDrafted ? '#E74C3C' : 'var(--silver)', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                                                    {isDrafted ? 'Undo' : 'Off'}
                                                </button>
                                                <button onClick={e => { e.stopPropagation(); const n = prompt('Note for ' + pName(r.p) + ':', note); if (n !== null) setBoardNotes(prev => ({...prev, [r.pid]: n})); }}
                                                    title="Add note" style={{ fontSize: '0.6rem', padding: '2px 5px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px', cursor: 'pointer', background: note ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)', color: note ? 'var(--gold)' : 'var(--silver)', fontFamily: 'Inter, sans-serif' }}>
                                                    {note ? '\u270E' : '+'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline expand card */}
                                    {isExp && (
                                        <div style={{ borderBottom: '2px solid rgba(212,175,55,0.25)', background: 'var(--black)', padding: '16px 20px', animation: 'wrFadeIn 0.2s ease' }}>
                                          {/* Header */}
                                          <div style={{ display: 'flex', gap: '16px', marginBottom: '14px' }}>
                                            <div style={{ flexShrink: 0, position: 'relative' }}>
                                              <img src={'https://sleepercdn.com/content/nfl/players/'+r.pid+'.jpg'} alt="" onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}} style={{ width: '80px', height: '80px', borderRadius: '10px', objectFit: 'cover', objectPosition: 'top', border: '2px solid rgba(212,175,55,0.3)' }} />
                                              <div style={{ display: 'none', width: '80px', height: '80px', borderRadius: '10px', background: 'var(--charcoal)', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, color: 'var(--silver)', border: '2px solid rgba(212,175,55,0.2)' }}>{(r.p.first_name||'?')[0]}{(r.p.last_name||'?')[0]}</div>
                                              <div style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px', borderRadius: '8px', background: (posColors[pos]||'#666')+'25', color: posColors[pos]||'var(--silver)', whiteSpace: 'nowrap' }}>{pos}</div>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                              <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.3rem', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.1 }}>{r.p.full_name || pName(r.p)}</div>
                                              <div style={{ fontSize: '0.78rem', color: 'var(--silver)', marginTop: '2px' }}>
                                                {pos} {'\u00B7'} {r.csv?.nflTeam || r.p.team || 'TBD'} {'\u00B7'} Age {age} {'\u00B7'} {college || 'Unknown'}
                                                {r.p.height ? ' \u00B7 ' + Math.floor(r.p.height/12)+"'"+r.p.height%12+'"' : ''}
                                                {r.p.weight ? ' \u00B7 ' + r.p.weight + 'lbs' : ''}
                                              </div>
                                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'Inter, sans-serif', padding: '2px 10px', borderRadius: '10px', background: dhqColVal + '20', color: dhqColVal }}>{r.dhq > 0 ? r.dhq.toLocaleString() + ' DHQ' : 'No DHQ'}</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', background: fitColor(fit.score) + '15', color: fitColor(fit.score) }}>{fit.label} Fit</span>
                                                {r.p.draft_round && <span style={{ fontSize: '0.72rem', padding: '2px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: 'var(--silver)' }}>NFL Rd {r.p.draft_round}{r.p.draft_pick ? '.' + r.p.draft_pick : ''}</span>}
                                                {tag && <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: '10px', background: tagDefs[tag].color + '20', color: tagDefs[tag].color }}>{tagDefs[tag].icon} {tagDefs[tag].label}</span>}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Stat boxes */}
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px', marginBottom: '14px' }}>
                                            {[
                                              { label: 'DHQ', val: r.dhq > 0 ? r.dhq.toLocaleString() : '\u2014', col: dhqColVal },
                                              { label: 'FIT', val: fit.label, col: fitColor(fit.score) },
                                              { label: 'AGE', val: age, col: typeof age === 'number' && age <= 22 ? '#2ECC71' : 'var(--silver)' },
                                              { label: 'EXP', val: (r.p.years_exp || 0) + 'yr', col: 'var(--silver)' },
                                              { label: 'TEAM', val: r.p.team || 'TBD', col: r.p.team ? '#2ECC71' : 'var(--silver)' },
                                              { label: 'DEPTH', val: r.p.depth_chart_order != null ? '#' + (r.p.depth_chart_order + 1) : '\u2014', col: r.p.depth_chart_order <= 1 ? '#2ECC71' : 'var(--silver)' },
                                            ].map((s, i) => (
                                              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 6px', textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '1.1rem', fontWeight: 600, color: s.col, letterSpacing: '-0.02em' }}>{s.val}</div>
                                                <div style={{ fontSize: '0.64rem', color: 'var(--silver)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>{s.label}</div>
                                              </div>
                                            ))}
                                          </div>

                                          {/* Physical Profile */}
                                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Physical Profile</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px', fontSize: '0.78rem' }}>
                                              <div><span style={{ color: 'var(--silver)', opacity: 0.6 }}>Ht </span><span style={{ color: 'var(--white)' }}>{r.p.height ? Math.floor(r.p.height/12)+"'"+r.p.height%12+'"' : '\u2014'}</span></div>
                                              <div><span style={{ color: 'var(--silver)', opacity: 0.6 }}>Wt </span><span style={{ color: 'var(--white)' }}>{r.p.weight ? r.p.weight+'lbs' : '\u2014'}</span></div>
                                              <div><span style={{ color: 'var(--silver)', opacity: 0.6 }}>College </span><span style={{ color: 'var(--white)' }}>{college || '\u2014'}</span></div>
                                              <div><span style={{ color: 'var(--silver)', opacity: 0.6 }}>Exp </span><span style={{ color: 'var(--white)' }}>{r.p.years_exp || 0}yr</span></div>
                                              {r.p.depth_chart_order != null && <div><span style={{ color: 'var(--silver)', opacity: 0.6 }}>Depth </span><span style={{ color: r.p.depth_chart_order <= 1 ? '#2ECC71' : 'var(--white)' }}>#{r.p.depth_chart_order + 1} {r.p.depth_chart_position || ''}</span></div>}
                                            </div>
                                          </div>

                                          {/* College / Career Stats */}
                                          <InlineCareerStats pid={r.pid} pos={pos} player={r.p} scoringSettings={currentLeague?.scoring_settings} statsData={statsData} />

                                          {/* Scouting Notes */}
                                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
                                            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Scouting Notes</div>
                                            <textarea
                                              value={note}
                                              onChange={e => setBoardNotes(prev => ({...prev, [r.pid]: e.target.value}))}
                                              onClick={e => e.stopPropagation()}
                                              placeholder={'Add your scouting notes on ' + pName(r.p) + '...'}
                                              style={{ width: '100%', minHeight: '70px', padding: '8px 10px', fontSize: '0.78rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'var(--silver)', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, outline: 'none' }}
                                            />
                                          </div>

                                          {/* Action buttons */}
                                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            <a href={'https://www.sports-reference.com/cfb/search/search.fcgi?search=' + encodeURIComponent(pName(r.p))} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                                              style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(52,152,219,0.12)', color: '#3498DB', border: '1px solid rgba(52,152,219,0.3)', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>{'\uD83C\uDFC8'} COLLEGE STATS</a>
                                            <a href={'https://www.youtube.com/results?search_query=' + encodeURIComponent(pName(r.p) + ' highlights ' + leagueSeason)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()}
                                              style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(231,76,60,0.12)', color: '#E74C3C', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }}>{'\u25B6'} HIGHLIGHTS</a>
                                            <button onClick={e => { e.stopPropagation(); setReconPanelOpen(true); sendReconMessage('SEARCH FOR CURRENT INFO. Full dynasty scouting report on ' + pName(r.p) + ' (' + pos + ', ' + (college || 'Unknown') + ', ' + (r.p.height ? Math.floor(r.p.height/12)+"'"+r.p.height%12+'" ' : '') + (r.p.weight ? r.p.weight+'lbs' : '') + '). Format as:\n\nPROFILE: Physical build assessment, athletic traits, measurables analysis\n\nCOLLEGE PRODUCTION: Key stats from last 2 seasons, snap count, efficiency metrics\n\nPOSITION GRADES (1-10): ' + (pos==='RB'?'Vision/Patience, Power/Balance, Agility/Accel, Passing Game, Competitiveness':(pos==='WR'?'Route Running, Separation, Hands/Catch, YAC Ability, Contested Catch':(pos==='QB'?'Arm Strength, Accuracy, Pocket Presence, Mobility, Decision Making':(pos==='TE'?'Blocking, Route Running, Hands, YAC, Versatility':'Tackling, Pass Rush, Coverage, Football IQ, Athleticism')))) + '\n\nNFL COMPARISON: One specific NFL player comp with reasoning\n\nDYNASTY TAKEAWAY: Buy/sell/hold recommendation, ideal draft range, ceiling vs floor, fit for our roster (DHQ: ' + (r.dhq>0?r.dhq:'unranked') + '). Be specific and opinionated.'); }}
                                              style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'rgba(124,107,248,0.15)', color: '#9b8afb', border: '1px solid rgba(124,107,248,0.3)', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>{'\uD83D\uDD0D'} SCOUT REPORT</button>
                                            <button onClick={e => { e.stopPropagation(); setExpandedDraftPid(null); }} style={{ padding: '7px 16px', fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', background: 'transparent', color: 'var(--silver)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }}>COLLAPSE</button>
                                          </div>
                                        </div>
                                    )}
                                    </React.Fragment>
                                );
                            })}
                            {boardPlayers.length === 0 && <div style={{ padding: 'var(--card-pad, 14px 16px)', textAlign: 'center', color: 'var(--silver)', opacity: 0.5 }}>No players match this filter</div>}
                        </div>}
                    </div>
                    );
                })()}

                {/* ═══════════════════ VIEW 3: MOCK DRAFT CENTER ═══════════════════ */}
                {activeView === 'mock' && (() => {
                    const DraftCC = window.DraftCommandCenter;
                    if (typeof DraftCC === 'function') {
                        return (
                            <DraftCC
                                playersData={playersData}
                                myRoster={myRoster}
                                currentLeague={currentLeague}
                                draftRounds={draftRounds}
                            />
                        );
                    }
                    return (
                        <div style={{ padding: '20px', color: '#E74C3C', textAlign: 'center', fontSize: '0.9rem' }}>
                            Mock Draft Center failed to load. Check console for errors.
                        </div>
                    );
                })()}

                {/* ═══════════════════ VIEW 4: FOLLOW LIVE DRAFT ═══════════════════ */}
                {activeView === 'live' && (() => {
                    const DraftCC = window.DraftCommandCenter;
                    if (typeof DraftCC === 'function') {
                        return (
                            <DraftCC
                                playersData={playersData}
                                myRoster={myRoster}
                                currentLeague={currentLeague}
                                draftRounds={draftRounds}
                                forcedMode="live-sync"
                            />
                        );
                    }
                    return (
                        <div style={{ padding: '20px', color: '#E74C3C', textAlign: 'center', fontSize: '0.9rem' }}>
                            Live Draft Follower failed to load. Check console for errors.
                        </div>
                    );
                })()}

            </div>
        );
    }

// ══════════════════════════════════════════════════════════════════
// app.js — OwnerDashboard (root component) + ReactDOM.render
// Must load LAST — depends on all other modules.
// ══════════════════════════════════════════════════════════════════
    // Main Dashboard
    function OwnerDashboard() {
        const [showSettings, setShowSettings] = useState(false);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [sleeperUser, setSleeperUser] = useState(null);
        const [selectedYear, setSelectedYear] = useState('2026');
        const [sleeperLeagues, setSleeperLeagues] = useState([]);
        const [activeLeagueId, setActiveLeagueId] = useState(null);
        const [selectedLeague, setSelectedLeague] = useState(null);
        const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('wr_onboarded_v1'));
        // Display name state
        const [customDisplayName, setCustomDisplayName] = useState(() => {
            return localStorage.getItem('od_display_name') || '';
        });

        // Cloud sync — load from Supabase on mount
        useEffect(() => {
            if (window.OD?.loadDisplayName) {
                window.OD.loadDisplayName().then(name => {
                    if (name) { setCustomDisplayName(name); localStorage.setItem('od_display_name', name); }
                }).catch(() => {});
            }
        }, []);
        const leagueMates = React.useMemo(() => {
            const seen = new Set();
            // seed with current user's id so we exclude ourselves
            if (sleeperUser?.user_id) seen.add(sleeperUser.user_id);
            const mates = [];
            sleeperLeagues.forEach(league => {
                (league.users || []).forEach(u => {
                    const uid = u.user_id;
                    if (uid && !seen.has(uid)) {
                        seen.add(uid);
                        mates.push(u);
                    }
                });
            });
            return mates.sort((a, b) => (a.display_name || a.username || '').localeCompare(b.display_name || b.username || ''));
        }, [sleeperLeagues, sleeperUser]);

        const AVAILABLE_YEARS = ['2023', '2024', '2025', '2026'];

        useEffect(() => {
            if (sleeperUsername) loadSleeperData();
        }, [selectedYear]);

        async function loadSleeperData() {
            setLoading(true);
            setError(null);

            try {
                const user = await fetchSleeperUser(sleeperUsername);
                setSleeperUser(user);

                const leagues = await fetchUserLeagues(user.user_id, selectedYear);

                const leaguesWithDetails = await Promise.all(
                    leagues.map(async (league) => {
                        try {
                            const [rosters, users] = await Promise.all([
                                fetchLeagueRosters(league.league_id),
                                fetchLeagueUsers(league.league_id)
                            ]);

                            const myRoster = rosters.find(r => r.owner_id === user.user_id);
                            
                            return {
                                id: league.league_id,
                                name: league.name,
                                wins: myRoster?.settings?.wins || 0,
                                losses: myRoster?.settings?.losses || 0,
                                ties: myRoster?.settings?.ties || 0,
                                season: selectedYear,
                                scoring_settings: league.scoring_settings || {},
                                roster_positions: league.roster_positions || [],
                                settings: league.settings || {},
                                rosters,
                                users
                            };
                        } catch (e) {
                            console.error(`Failed to load league ${league.name}:`, e);
                            return null;
                        }
                    })
                );

                const validLeagues = leaguesWithDetails.filter(l => l !== null);
                setSleeperLeagues(validLeagues);
                setLoading(false);
            } catch (err) {
                console.error('Failed to load Sleeper data:', err);
                setError('Failed to load Sleeper data. Please refresh.');
                setLoading(false);
            }
        }

        // Show league detail if selected
        if (selectedLeague) {
            return <>
                <LeagueDetail
                    league={selectedLeague}
                    onBack={() => setSelectedLeague(null)}
                    sleeperUserId={sleeperUser?.user_id}
                    onOpenSettings={() => setShowSettings(true)}
                />
                {showSettings && (
                    <SettingsModal
                        onClose={() => setShowSettings(false)}
                        initDisplayName={customDisplayName}
                        onDisplayNameSave={(name) => {
                            setCustomDisplayName(name);
                            window.OD.saveDisplayName(name);
                        }}
                        leagueMates={leagueMates}
                    />
                )}
            </>;
        }

        // ── Shared league selector helper ──
        const lastLeagueId = localStorage.getItem('wr_last_league_id');
        const lastLeagueName = localStorage.getItem('wr_last_league_name');
        const displayName = sleeperUser
            ? (customDisplayName || sleeperUser.display_name || sleeperUser.username || sleeperUsername).toUpperCase()
            : (customDisplayName || 'COMMANDER').toUpperCase();

        function LeagueSelector({ onSelect, accent }) {
            const selectCls = 'hub-league-select' + (accent === 'purple' ? ' purple' : '');
            if (!sleeperUsername) return null;
            if (loading) return <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--silver)', fontSize: '0.82rem' }}>Loading leagues...</div>;
            if (error) return <div style={{ padding: '0.75rem', textAlign: 'center', color: '#E74C3C', fontSize: '0.82rem' }}>{error}</div>;
            if (sleeperLeagues.length === 0) return <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--silver)', fontSize: '0.82rem' }}>No leagues found for {selectedYear}</div>;
            return (
                <div className="hub-league-selector">
                    <label>Select League</label>
                    <select className={selectCls} defaultValue="" onChange={e => {
                        const league = sleeperLeagues.find(l => l.id === e.target.value);
                        if (league) onSelect(league);
                    }}>
                        <option value="" disabled>Choose a league...</option>
                        {sleeperLeagues.map(l => (
                            <option key={l.id} value={l.id}>{l.name} ({l.wins}-{l.losses}{l.ties > 0 ? '-'+l.ties : ''} · {l.rosters?.length || '?'}T)</option>
                        ))}
                    </select>
                </div>
            );
        }

        function handleSelectLeague(league) {
            setActiveLeagueId(league.id);
            setSelectedLeague(league);
            localStorage.setItem('wr_last_league_id', league.id);
            localStorage.setItem('wr_last_league_name', league.name);
        }

        const resumeLeague = sleeperLeagues.find(l => l.id === lastLeagueId);

        return (
            <div className="app-container">
                {/* Onboarding overlay */}
                {showOnboarding && (
                    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', overflowY:'auto' }}>
                        <div style={{ background:'linear-gradient(135deg, var(--off-black), var(--charcoal))', border:'2px solid var(--gold)', borderRadius:'16px', padding:'32px', maxWidth:'540px', width:'100%' }}>
                            <div style={{ textAlign:'center', marginBottom:'20px' }}>
                                <div style={{ fontFamily:'Bebas Neue', fontSize:'2rem', color:'var(--gold)', letterSpacing:'0.08em', marginBottom:'4px' }}>WELCOME TO YOUR WAR ROOM</div>
                                <div style={{ fontSize:'0.88rem', color:'var(--silver)', lineHeight:1.6 }}>Two ways to dominate your dynasty league.</div>
                            </div>
                            <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexDirection: window.innerWidth < 500 ? 'column' : 'row' }}>
                                <div style={{ flex:1, background:'rgba(212,175,55,0.06)', border:'1px solid rgba(212,175,55,0.25)', borderRadius:'10px', padding:'16px', textAlign:'center' }}>
                                    <div style={{ fontFamily:'Bebas Neue', fontSize:'1.1rem', color:'var(--gold)', marginBottom:'4px' }}>SLEEPER LEAGUES</div>
                                    <div style={{ fontSize:'0.76rem', color:'var(--silver)', lineHeight:1.5 }}>Draft room, roster control, standings, and league-wide intelligence</div>
                                </div>
                                <div style={{ flex:1, background:'rgba(124,107,248,0.06)', border:'1px solid rgba(124,107,248,0.25)', borderRadius:'10px', padding:'16px', textAlign:'center' }}>
                                    <div style={{ fontFamily:'Bebas Neue', fontSize:'1.1rem', color:'#7c6bf8', marginBottom:'4px' }}>RECONAI</div>
                                    <div style={{ fontSize:'0.76rem', color:'var(--silver)', lineHeight:1.5 }}>AI-powered trade analysis, waivers, and roster strategy</div>
                                </div>
                            </div>
                            <button onClick={() => { setShowOnboarding(false); localStorage.setItem('wr_onboarded_v1', '1'); }} style={{ width:'100%', padding:'12px', background:'var(--gold)', color:'var(--black)', border:'none', borderRadius:'8px', fontFamily:'Bebas Neue', fontSize:'1.2rem', letterSpacing:'0.06em', cursor:'pointer', marginBottom:'8px' }}>
                                ENTER WAR ROOM
                            </button>
                            <div style={{ textAlign:'center', fontSize:'0.76rem', color:'var(--silver)', opacity:0.4 }}>Choose a product below to get started</div>
                        </div>
                    </div>
                )}

                {/* ── Header ── */}
                <header className="header">
                    <div className="header-brand">
                        <img src="icon-192.png" alt="Logo" className="owner-logo-small" />
                        <div className="header-text">
                            <h1 className="owner-name">{displayName} FOOTBALL CLUB</h1>
                            <div className="header-subtitle">"If you're not first, you're last" — Ricky Bobby</div>
                        </div>
                    </div>
                    <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" onClick={() => setShowSettings(true)} style={{ cursor: 'pointer' }}>
                        <circle cx="12" cy="12" r="3" stroke="var(--gold)"/>
                        <path d="M12 1v6m0 6v6m-5.2-7.8l-4.3-4.2m12.9 0l4.3 4.2M1 12h6m6 0h6m-7.8 5.2l-4.2 4.3m0-12.9l4.2 4.3" stroke="var(--gold)"/>
                    </svg>
                </header>

                {/* ── Session Strip ── */}
                {resumeLeague && !loading && (
                    <div className="session-strip">
                        <span className="session-strip-label">Last Session:</span>
                        <span className="session-strip-league">{lastLeagueName}</span>
                        <button className="session-strip-btn primary" onClick={() => handleSelectLeague(resumeLeague)}>Resume</button>
                        <button className="session-strip-btn secondary" onClick={() => handleSelectLeague(resumeLeague)}>View Alerts</button>
                        <button className="session-strip-btn secondary" onClick={() => handleSelectLeague(resumeLeague)}>Open Draft Room</button>
                    </div>
                )}

                {/* ── Two Equal Product Cards ── */}
                <div className="hub-layout">

                    {/* ──── Card 1: Sleeper Leagues ──── */}
                    <div className="product-card">
                        <div className="product-card-header">
                            <div className="product-card-icon gold">
                                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--black)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                    <path d="M2 17l10 5 10-5"/>
                                    <path d="M2 12l10 5 10-5"/>
                                </svg>
                            </div>
                            <div>
                                <div className="product-card-title">SLEEPER LEAGUES</div>
                                <div className="product-card-subtitle">Manage your league universe</div>
                            </div>
                        </div>
                        <div className="product-card-body">
                            <div style={{ fontSize: '0.78rem', color: 'var(--silver)', marginBottom: '1rem', lineHeight: 1.6 }}>
                                Draft room, roster control, standings, trade center, and league-wide intelligence — all powered by your Sleeper data.
                            </div>

                            {!sleeperUsername ? (
                                <div className="hub-connect-card">
                                    <input id="wr-sleeper-input" placeholder="Enter your Sleeper username" onKeyDown={e => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) { localStorage.setItem('od_auth_v1', JSON.stringify({sleeperUsername:v})); window.location.reload(); } } }} />
                                    <button className="hub-cta gold" onClick={() => { const v = document.getElementById('wr-sleeper-input')?.value?.trim(); if (v) { localStorage.setItem('od_auth_v1', JSON.stringify({sleeperUsername:v})); window.location.reload(); } }}>CONNECT SLEEPER ACCOUNT</button>
                                    <div style={{ marginTop: '8px' }}>
                                        <button className="hub-cta ghost" onClick={() => { localStorage.setItem('od_auth_v1', JSON.stringify({sleeperUsername:'jcc100218'})); localStorage.setItem('wr_demo_mode', '1'); window.location.reload(); }}>Explore Demo League</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="hub-year-row">
                                        <span className="hub-year-label">Season:</span>
                                        <select className="hub-year-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                                            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <LeagueSelector onSelect={handleSelectLeague} accent="gold" />
                                    {resumeLeague && (
                                        <button className="hub-cta gold" onClick={() => handleSelectLeague(resumeLeague)}>RESUME {lastLeagueName?.toUpperCase()}</button>
                                    )}
                                    {!resumeLeague && sleeperLeagues.length > 0 && (
                                        <button className="hub-cta gold" onClick={() => handleSelectLeague(sleeperLeagues[0])}>ENTER {sleeperLeagues[0].name?.toUpperCase()}</button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* ──── Card 2: ReconAI ──── */}
                    <div className="product-card accent-purple">
                        <div className="product-card-header">
                            <div className="product-card-icon purple">
                                <svg viewBox="0 0 32 32" width="22" height="22" fill="none">
                                    <circle cx="16" cy="16" r="8" stroke="#e0d4ff" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6"/>
                                    <circle cx="16" cy="16" r="4" stroke="#e0d4ff" strokeWidth="1.5"/>
                                    <circle cx="16" cy="16" r="1.5" fill="#e0d4ff"/>
                                </svg>
                            </div>
                            <div>
                                <div className="product-card-title">RECON<span style={{ color: '#7c6bf8' }}>AI</span></div>
                                <div className="product-card-subtitle">Your AI front office</div>
                            </div>
                        </div>
                        <div className="product-card-body">
                            <div style={{ fontSize: '0.78rem', color: 'var(--silver)', marginBottom: '1rem', lineHeight: 1.6 }}>
                                War room intelligence for trades, waivers, and roster strategy. AI-powered analysis tuned to your exact league and scoring.
                            </div>

                            {!sleeperUsername ? (
                                <div style={{ padding: '1rem 0', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--silver)', marginBottom: '12px' }}>Connect your Sleeper account to unlock ReconAI</div>
                                    <a href="https://jcc100218.github.io/ReconAI/" target="_blank" rel="noopener noreferrer" className="hub-cta ghost-purple" style={{ textDecoration: 'none' }}>Open ReconAI Directly</a>
                                </div>
                            ) : (
                                <>
                                    <div className="hub-year-row">
                                        <span className="hub-year-label">Season:</span>
                                        <select className="hub-year-select" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                                            {AVAILABLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <LeagueSelector onSelect={(league) => {
                                        localStorage.setItem('wr_last_league_id', league.id);
                                        localStorage.setItem('wr_last_league_name', league.name);
                                        window.open('https://jcc100218.github.io/ReconAI/', '_blank');
                                    }} accent="purple" />
                                    <a href="https://jcc100218.github.io/ReconAI/" target="_blank" rel="noopener noreferrer" className="hub-cta purple" style={{ textDecoration: 'none' }}>ENTER RECONAI</a>
                                    {resumeLeague && (
                                        <div className="hub-cta-row">
                                            <a href="https://jcc100218.github.io/ReconAI/" target="_blank" rel="noopener noreferrer" className="hub-cta ghost-purple" style={{ textDecoration: 'none' }}>Open {lastLeagueName}</a>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                </div>

                {showSettings && (
                    <SettingsModal
                        onClose={() => setShowSettings(false)}
                        initDisplayName={customDisplayName}
                        onDisplayNameSave={(name) => {
                            setCustomDisplayName(name);
                            window.OD.saveDisplayName(name);
                        }}
                        leagueMates={leagueMates}
                    />
                )}

            </div>
        );
    }

    ReactDOM.render(<OwnerDashboard />, document.getElementById('root'));

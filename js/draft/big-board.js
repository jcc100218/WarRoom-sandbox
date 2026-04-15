// ══════════════════════════════════════════════════════════════════
// js/draft/big-board.js — Big Board panel for Draft Command Center
//
// Left panel of the 6-panel desktop layout. Shows available players
// sorted by DHQ, with position filter chips, search box, tier coloring,
// and DRAFT buttons that fire when it's the user's turn.
//
// Reads from DraftContext: draftState.pool, draftState.pickOrder[currentIdx],
// userSlot, phase. Dispatches MAKE_PICK on user draft.
//
// Depends on: styles.js, state.js, scouting.js (for CSV enrichment)
// Exposes:    window.DraftCC.BigBoardPanel (React component)
// ══════════════════════════════════════════════════════════════════

(function() {
    const { DRAFT_CC_LAYOUT, FONT_UI, FONT_DISPL, FONT_MONO, panelCard, dhqColor, tierColor } = window.DraftCC.styles;

    function BigBoardPanel({ state, dispatch, isUserTurn }) {
        const [posFilter, setPosFilter] = React.useState('');
        const [search, setSearch] = React.useState('');

        const posColors = window.App?.POS_COLORS || {
            QB: '#FF6B6B', RB: '#4ECDC4', WR: '#45B7D1', TE: '#F7DC6F',
            DL: '#E67E22', LB: '#F0A500', DB: '#5DADE2', K: '#BB8FCE',
        };

        const available = React.useMemo(() => {
            if (!state.pool || !state.pool.length) return [];
            return state.pool.filter(p => {
                if (posFilter && p.pos !== posFilter) return false;
                if (search) {
                    const q = search.toLowerCase();
                    if (!(p.name || '').toLowerCase().includes(q)) return false;
                }
                return true;
            }).slice(0, 80);
        }, [state.pool, posFilter, search]);

        const onDraft = (player) => {
            // Allow picks when it's the user's turn OR when override mode is on (user picking for CPU)
            const canPick = isUserTurn || state.overrideMode;
            if (!canPick) return;
            dispatch({
                type: 'MAKE_PICK',
                player,
                isUser: isUserTurn, // true only when it's genuinely the user's slot
                reasoning: state.overrideMode
                    ? { primary: 'User override', baseVal: player.dhq, nudges: [] }
                    : { primary: 'User selection', baseVal: player.dhq, nudges: [] },
                confidence: 1.0,
            });
        };

        const onOpenModal = (player) => {
            // ReconAI shared player-modal exposes window.openPlayerModal; fall back silently
            if (typeof window.openPlayerModal === 'function' && !player.isCSV) {
                try { window.openPlayerModal(player.pid); return; } catch (e) {}
            }
        };

        const availablePositions = React.useMemo(() => {
            const set = new Set();
            state.pool.slice(0, 60).forEach(p => set.add(p.pos));
            const arr = Array.from(set);
            // Order: QB, RB, WR, TE, then others
            const priority = { QB: 1, RB: 2, WR: 3, TE: 4, DL: 5, LB: 6, DB: 7 };
            return arr.sort((a, b) => (priority[a] || 99) - (priority[b] || 99));
        }, [state.pool]);

        const containerCss = panelCard({
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 12px',
        });

        return (
            <div style={containerCss}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ fontFamily: FONT_DISPL, fontSize: '0.86rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
                        Big Board
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--silver)', opacity: 0.6, fontFamily: FONT_UI }}>
                        {state.pool.length} avail
                    </div>
                </div>

                {/* Search */}
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search players…"
                    style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '6px 8px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                        color: 'var(--white)',
                        fontSize: '0.72rem',
                        fontFamily: FONT_UI,
                        outline: 'none',
                        marginBottom: '6px',
                    }}
                />

                {/* Position filter chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '8px' }}>
                    <button onClick={() => setPosFilter('')} style={{
                        padding: '2px 8px',
                        fontSize: '0.62rem',
                        borderRadius: '10px',
                        border: '1px solid ' + (posFilter === '' ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.08)'),
                        background: posFilter === '' ? 'rgba(212,175,55,0.15)' : 'transparent',
                        color: posFilter === '' ? 'var(--gold)' : 'var(--silver)',
                        cursor: 'pointer',
                        fontFamily: FONT_UI,
                    }}>ALL</button>
                    {availablePositions.map(pos => (
                        <button key={pos} onClick={() => setPosFilter(posFilter === pos ? '' : pos)} style={{
                            padding: '2px 8px',
                            fontSize: '0.62rem',
                            borderRadius: '10px',
                            border: '1px solid ' + (posFilter === pos ? (posColors[pos] || '#666') + '66' : 'rgba(255,255,255,0.08)'),
                            background: posFilter === pos ? (posColors[pos] || '#666') + '22' : 'transparent',
                            color: posFilter === pos ? (posColors[pos] || 'var(--silver)') : 'var(--silver)',
                            cursor: 'pointer',
                            fontFamily: FONT_UI,
                            fontWeight: 600,
                        }}>{pos}</button>
                    ))}
                </div>

                {/* Available list */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', marginRight: '-4px', paddingRight: '4px' }}>
                    {available.length === 0 && (
                        <div style={{ padding: '12px', textAlign: 'center', color: 'var(--silver)', opacity: 0.4, fontSize: '0.72rem' }}>
                            No players match filter
                        </div>
                    )}
                    {available.map((p, idx) => {
                        const col = dhqColor(p.dhq);
                        const tCol = tierColor(p.tier);
                        return (
                            <div
                                key={p.pid}
                                onClick={() => onOpenModal(p)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 4px 5px 0',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    borderLeft: p.tier ? '2px solid ' + tCol : '2px solid transparent',
                                    paddingLeft: '5px',
                                    cursor: 'pointer',
                                    background: idx === 0 ? 'rgba(212,175,55,0.04)' : 'transparent',
                                    transition: 'background 0.1s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.06)'}
                                onMouseLeave={e => e.currentTarget.style.background = idx === 0 ? 'rgba(212,175,55,0.04)' : 'transparent'}
                            >
                                <span style={{
                                    fontSize: '0.6rem',
                                    color: idx < 3 ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
                                    width: '16px',
                                    textAlign: 'right',
                                    flexShrink: 0,
                                    fontFamily: FONT_MONO,
                                }}>{idx + 1}</span>
                                {p.photoUrl && (
                                    <img
                                        src={p.photoUrl}
                                        onError={e => e.target.style.display = 'none'}
                                        style={{
                                            width: 22,
                                            height: 22,
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            objectPosition: 'top',
                                            flexShrink: 0,
                                            background: 'rgba(255,255,255,0.04)',
                                        }}
                                        alt=""
                                    />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        color: 'var(--white)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}>{p.name}</div>
                                    {(p.college || p.team) && (
                                        <div style={{
                                            fontSize: '0.58rem',
                                            color: 'var(--silver)',
                                            opacity: 0.5,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>{p.college || p.team}</div>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: '0.56rem',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                    background: (posColors[p.pos] || '#666') + '22',
                                    color: posColors[p.pos] || 'var(--silver)',
                                    flexShrink: 0,
                                    fontFamily: FONT_UI,
                                }}>{p.pos}</span>
                                <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    fontFamily: FONT_MONO,
                                    color: col,
                                    minWidth: '36px',
                                    textAlign: 'right',
                                    flexShrink: 0,
                                }}>
                                    {p.dhq > 0 ? (p.dhq >= 1000 ? (p.dhq / 1000).toFixed(1) + 'k' : p.dhq) : '—'}
                                </span>
                                {(isUserTurn || state.overrideMode) && (
                                    <button
                                        onClick={e => { e.stopPropagation(); onDraft(p); }}
                                        title={state.overrideMode ? 'Pick for the CPU team on the clock' : 'Make your pick'}
                                        style={{
                                            padding: '3px 8px',
                                            fontSize: '0.6rem',
                                            fontFamily: FONT_UI,
                                            fontWeight: 700,
                                            // Override mode uses a purple tint so it's visually distinct from a normal user pick
                                            background: state.overrideMode ? '#9b8afb' : 'var(--gold)',
                                            color: state.overrideMode ? '#fff' : 'var(--black)',
                                            border: 'none',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                    >{state.overrideMode ? 'FORCE' : 'DRAFT'}</button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    window.DraftCC = window.DraftCC || {};
    window.DraftCC.BigBoardPanel = BigBoardPanel;
})();

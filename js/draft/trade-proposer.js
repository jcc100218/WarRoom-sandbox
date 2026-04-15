// ══════════════════════════════════════════════════════════════════
// js/draft/trade-proposer.js — User-→-CPU trade proposer drawer
//
// Side drawer (slides in from right). Opened from Opponent Intel's
// "Propose Trade" button. User selects picks from their side + the
// target CPU's side; the drawer shows live DHQ totals, live psych
// taxes, and live acceptance likelihood. "Send" runs a 1.5s thinking
// animation then dispatches COMPLETE_PROPOSAL with the CPU's verdict.
//
// Depends on: styles.js, state.js, trade-simulator.js (evaluateUserProposal)
// Exposes:    window.DraftCC.TradeProposer
// ══════════════════════════════════════════════════════════════════

(function() {
    const { FONT_UI, FONT_DISPL, FONT_MONO } = window.DraftCC.styles;

    function TradeProposer({ state, dispatch }) {
        const drawer = state.proposerDrawer;
        if (!drawer) return null;

        const targetId = drawer.targetRosterId;
        const targetPersona = state.personas?.[targetId];
        const myPersona = state.personas?.[state.userRosterId];
        if (!targetPersona) return null;

        // Remaining picks (not yet made)
        const remaining = state.pickOrder.slice(state.currentIdx);
        const myRemainingPicks = remaining.filter(p => p.rosterId === state.userRosterId);
        const theirRemainingPicks = remaining.filter(p => p.rosterId === targetId);

        // Currently selected on each side
        const myGiveIds = new Set((drawer.myGive || []).map(p => p.round + '-' + p.teamIdx));
        const theirGiveIds = new Set((drawer.theirGive || []).map(p => p.round + '-' + p.teamIdx));

        const togglePick = (pick, side) => {
            if (drawer.status === 'sending' || drawer.status === 'accepted') return;
            const key = pick.round + '-' + pick.teamIdx;
            const arr = side === 'my' ? (drawer.myGive || []) : (drawer.theirGive || []);
            const exists = arr.some(p => (p.round + '-' + p.teamIdx) === key);
            const next = exists
                ? arr.filter(p => (p.round + '-' + p.teamIdx) !== key)
                : [...arr, pick];
            dispatch({
                type: 'UPDATE_PROPOSER',
                payload: side === 'my' ? { myGive: next, status: 'building' } : { theirGive: next, status: 'building' },
            });
        };

        // Live evaluation (computed on every render)
        const simulator = window.DraftCC.tradeSimulator;
        const evaluation = React.useMemo(() => {
            if (!simulator) return { likelihood: 0, grade: null, taxes: [], myGiveDHQ: 0, theirGiveDHQ: 0 };
            // Peek-only evaluation — no randomness wobble, deterministic display
            const helpers = window.DraftCC.tradeHelpers;
            const myGiveDHQ = simulator.sumPickValue(state, drawer.myGive);
            const theirGiveDHQ = simulator.sumPickValue(state, drawer.theirGive);
            const taxes = helpers.calcPsychTaxes(
                myPersona?.assessment,
                targetPersona.assessment,
                targetPersona.tradeDna?.key,
                targetPersona.posture
            );
            const likelihood = helpers.calcAcceptanceLikelihood(
                myGiveDHQ,
                theirGiveDHQ,
                targetPersona.tradeDna?.key,
                taxes,
                targetPersona.assessment,
                myPersona?.assessment
            );
            const grade = helpers.fairnessGrade(myGiveDHQ, theirGiveDHQ);
            return { likelihood, grade, taxes, myGiveDHQ, theirGiveDHQ };
        }, [drawer.myGive, drawer.theirGive, state.pickOrder, state.currentIdx, targetPersona, myPersona]);

        const onClose = () => dispatch({ type: 'CLOSE_PROPOSER' });

        const onSend = () => {
            if (!drawer.myGive?.length || !drawer.theirGive?.length) return;
            dispatch({ type: 'UPDATE_PROPOSER', payload: { status: 'sending' } });
            // CPU "thinks" for 1.5s, then evaluates with randomness
            setTimeout(() => {
                const result = simulator.evaluateUserProposal(state, {
                    targetRosterId: targetId,
                    myGive: drawer.myGive,
                    theirGive: drawer.theirGive,
                });
                if (result.accepted) {
                    const offer = {
                        fromRosterId: targetId,
                        fromName: targetPersona.teamName,
                        toRosterId: state.userRosterId,
                        theirGive: drawer.theirGive,
                        myGive: drawer.myGive,
                        myGainDHQ: result.theirGiveDHQ,
                        myGiveDHQ: result.myGiveDHQ,
                        theirGainDHQ: result.myGiveDHQ,
                        theirGiveDHQ: result.theirGiveDHQ,
                        likelihood: result.likelihood,
                        grade: result.grade,
                        taxes: result.taxes,
                        reason: 'Accepted user proposal',
                        dnaLabel: targetPersona.draftDna?.label || 'Balanced',
                    };
                    dispatch({ type: 'COMPLETE_PROPOSAL', accepted: true, offer });
                } else {
                    dispatch({ type: 'COMPLETE_PROPOSAL', accepted: false });
                }
            }, 1500);
        };

        const gradeCol = evaluation.grade?.col || 'var(--gold)';
        const likelihoodCol = evaluation.likelihood >= 60 ? '#2ECC71'
            : evaluation.likelihood >= 40 ? '#F0A500'
            : '#E74C3C';

        const isSending = drawer.status === 'sending';
        const isAccepted = drawer.status === 'accepted';
        const isDeclined = drawer.status === 'declined';

        return (
            <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: 'min(420px, 90vw)',
                background: 'var(--black)',
                borderLeft: '2px solid var(--gold)',
                boxShadow: '-12px 0 40px rgba(0,0,0,0.6)',
                zIndex: 600,
                display: 'flex',
                flexDirection: 'column',
                fontFamily: FONT_UI,
                animation: 'wrFadeIn 0.25s ease',
            }}>
                {/* Header */}
                <div style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(212,175,55,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    flexShrink: 0,
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Propose Trade</div>
                        <div style={{
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: 'var(--white)',
                            fontFamily: FONT_DISPL,
                            letterSpacing: '0.02em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>{targetPersona.teamName}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--silver)', opacity: 0.7 }}>
                            {targetPersona.tradeDna?.label || '—'} · {targetPersona.posture?.label || '—'}
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'none',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--silver)',
                        fontSize: '0.9rem',
                        width: 30,
                        height: 30,
                        borderRadius: '4px',
                        cursor: 'pointer',
                    }}>×</button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {/* Status banner */}
                    {isSending && (
                        <div style={{
                            padding: '10px',
                            background: 'rgba(212,175,55,0.08)',
                            border: '1px solid rgba(212,175,55,0.3)',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            color: 'var(--gold)',
                            textAlign: 'center',
                            marginBottom: '12px',
                        }}>
                            ⏳ {targetPersona.teamName} is thinking…
                        </div>
                    )}
                    {isAccepted && (
                        <div style={{
                            padding: '10px',
                            background: 'rgba(46,204,113,0.08)',
                            border: '1px solid rgba(46,204,113,0.3)',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            color: '#2ECC71',
                            textAlign: 'center',
                            marginBottom: '12px',
                            fontWeight: 700,
                        }}>
                            ✓ ACCEPTED — picks swapped
                        </div>
                    )}
                    {isDeclined && (
                        <div style={{
                            padding: '10px',
                            background: 'rgba(231,76,60,0.08)',
                            border: '1px solid rgba(231,76,60,0.3)',
                            borderRadius: '5px',
                            fontSize: '0.72rem',
                            color: '#E74C3C',
                            textAlign: 'center',
                            marginBottom: '12px',
                        }}>
                            ✗ DECLINED — adjust the offer
                        </div>
                    )}

                    {/* Live fairness / likelihood */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        marginBottom: '14px',
                    }}>
                        <div style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '5px',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: gradeCol, fontFamily: FONT_DISPL }}>
                                {evaluation.grade?.grade || '—'}
                            </div>
                            <div style={{ fontSize: '0.54rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
                                {evaluation.grade?.label || 'Empty'}
                            </div>
                        </div>
                        <div style={{
                            padding: '8px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '5px',
                            textAlign: 'center',
                        }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: likelihoodCol, fontFamily: FONT_DISPL }}>
                                {evaluation.likelihood}%
                            </div>
                            <div style={{ fontSize: '0.54rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>
                                Acceptance
                            </div>
                        </div>
                    </div>

                    {/* Pick swap summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                        <PickSide
                            label="You give"
                            color="#E74C3C"
                            picks={drawer.myGive}
                            dhq={evaluation.myGiveDHQ}
                            empty="No picks selected"
                        />
                        <PickSide
                            label="You get"
                            color="#2ECC71"
                            picks={drawer.theirGive}
                            dhq={evaluation.theirGiveDHQ}
                            empty="No picks selected"
                        />
                    </div>

                    {/* Pick selectors */}
                    <PickList
                        title="Your picks"
                        picks={myRemainingPicks}
                        selected={myGiveIds}
                        onToggle={pick => togglePick(pick, 'my')}
                        state={state}
                        disabled={isSending || isAccepted}
                    />
                    <PickList
                        title={targetPersona.teamName + "'s picks"}
                        picks={theirRemainingPicks}
                        selected={theirGiveIds}
                        onToggle={pick => togglePick(pick, 'their')}
                        state={state}
                        disabled={isSending || isAccepted}
                    />

                    {/* Psych taxes */}
                    {evaluation.taxes && evaluation.taxes.length > 0 && (
                        <div style={{ marginTop: '12px' }}>
                            <div style={{
                                fontSize: '0.56rem',
                                fontWeight: 700,
                                color: 'var(--gold)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                marginBottom: '5px',
                            }}>Psych Taxes</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {evaluation.taxes.map((t, i) => {
                                    const isTax = (t.impact || 0) < 0;
                                    const col = isTax ? '#E74C3C' : '#2ECC71';
                                    return (
                                        <div key={i} title={t.desc || ''} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '0.62rem',
                                            padding: '3px 6px',
                                            borderLeft: '2px solid ' + col,
                                            paddingLeft: '8px',
                                        }}>
                                            <span style={{
                                                color: 'var(--silver)',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                flex: 1,
                                                opacity: 0.85,
                                            }}>{t.name}</span>
                                            <span style={{ color: col, fontWeight: 700, marginLeft: '6px' }}>
                                                {(t.impact || 0) > 0 ? '+' : ''}{t.impact}{typeof t.impact === 'number' ? '%' : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid rgba(212,175,55,0.2)',
                    display: 'flex',
                    gap: '8px',
                    flexShrink: 0,
                }}>
                    {isAccepted ? (
                        <button onClick={onClose} style={primaryBtn}>DONE</button>
                    ) : (
                        <>
                            <button
                                onClick={onSend}
                                disabled={isSending || !(drawer.myGive?.length && drawer.theirGive?.length)}
                                style={{
                                    ...primaryBtn,
                                    opacity: (isSending || !(drawer.myGive?.length && drawer.theirGive?.length)) ? 0.5 : 1,
                                    cursor: (isSending || !(drawer.myGive?.length && drawer.theirGive?.length)) ? 'not-allowed' : 'pointer',
                                }}
                            >{isSending ? 'SENDING…' : 'SEND OFFER'}</button>
                            <button onClick={onClose} style={secondaryBtn}>CANCEL</button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    function PickSide({ label, color, picks, dhq, empty }) {
        return (
            <div style={{
                padding: '10px',
                background: color + '08',
                border: '1px solid ' + color + '25',
                borderRadius: '6px',
                minHeight: 66,
            }}>
                <div style={{ fontSize: '0.52rem', color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{label}</div>
                {picks && picks.length > 0 ? (
                    <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '4px' }}>
                            {picks.map((p, i) => (
                                <span key={i} style={{
                                    fontSize: '0.58rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    background: 'rgba(255,255,255,0.06)',
                                    color: 'var(--white)',
                                }}>R{p.round}.{String(p.slot || 0).padStart(2, '0')}</span>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--silver)', fontFamily: FONT_MONO, opacity: 0.7 }}>
                            ≈ {(dhq || 0).toLocaleString()} DHQ
                        </div>
                    </>
                ) : (
                    <div style={{ fontSize: '0.6rem', color: 'var(--silver)', opacity: 0.5, fontStyle: 'italic' }}>{empty}</div>
                )}
            </div>
        );
    }

    function PickList({ title, picks, selected, onToggle, state, disabled }) {
        const simulator = window.DraftCC.tradeSimulator;
        return (
            <div style={{ marginBottom: '10px' }}>
                <div style={{
                    fontSize: '0.54rem',
                    fontWeight: 700,
                    color: 'var(--gold)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '4px',
                }}>{title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {picks.slice(0, 12).map((p, i) => {
                        const key = p.round + '-' + p.teamIdx;
                        const isSel = selected.has(key);
                        const val = simulator ? simulator.pickValueFor(state, p) : 0;
                        return (
                            <button
                                key={i}
                                disabled={disabled}
                                onClick={() => onToggle(p)}
                                title={'Round ' + p.round + ' pick · ~' + val.toLocaleString() + ' DHQ'}
                                style={{
                                    padding: '4px 8px',
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    background: isSel ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.03)',
                                    border: '1px solid ' + (isSel ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.08)'),
                                    borderRadius: '4px',
                                    color: isSel ? 'var(--gold)' : 'var(--silver)',
                                    cursor: disabled ? 'not-allowed' : 'pointer',
                                    fontFamily: FONT_UI,
                                    opacity: disabled ? 0.5 : 1,
                                }}
                            >
                                R{p.round}.{String(p.slot || 0).padStart(2, '0')}
                            </button>
                        );
                    })}
                    {picks.length === 0 && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--silver)', opacity: 0.4, fontStyle: 'italic' }}>
                            no remaining picks
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const primaryBtn = {
        flex: 1,
        padding: '10px',
        background: 'var(--gold)',
        color: 'var(--black)',
        border: 'none',
        borderRadius: '5px',
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: FONT_UI,
        letterSpacing: '0.04em',
    };

    const secondaryBtn = {
        padding: '10px 16px',
        background: 'transparent',
        color: 'var(--silver)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '5px',
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: FONT_UI,
    };

    window.DraftCC = window.DraftCC || {};
    window.DraftCC.TradeProposer = TradeProposer;
})();

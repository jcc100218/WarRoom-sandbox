// ══════════════════════════════════════════════════════════════════
// js/theme.js — War Room Theme Engine
//
// Centralized theme system that replaces inline color/font literals
// throughout the dashboard. All widget components read from WrTheme
// instead of hardcoded values.
//
// Loads BEFORE any widget or dashboard script. Persists to localStorage.
// Coexists with themes.js (NFL team accent colors) — that system
// continues to set --gold/--silver CSS vars independently.
//
// Depends on: nothing (self-contained, runs first)
// Exposes:    window.WrTheme
// ══════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    const LS_KEY = 'wr_dashboard_theme';
    const DYNAMIC_STYLE_ID = 'wr-theme-dynamic';

    // ── Theme definitions ─────────────────────────────────────────
    const THEMES = {
        default: {
            id: 'default',
            name: 'War Room',
            preview: '🏴',
            fonts: {
                display: 'Rajdhani, sans-serif',
                ui: "'DM Sans', Inter, sans-serif",
                mono: "'JetBrains Mono', monospace",
                sizeScale: 1.0,
            },
            colors: {
                bg:         '#0A0A0A',
                card:       '#0A0A0A',
                cardHover:  'rgba(212,175,55,0.04)',
                accent:     'var(--gold, #D4AF37)',
                accentDark: 'var(--dark-gold, #B8941E)',
                text:       '#FFFFFF',
                textMuted:  '#D0D0D0',
                textFaint:  'rgba(255,255,255,0.4)',
                positive:   '#2ECC71',
                negative:   '#E74C3C',
                info:       '#3498DB',
                warn:       '#F0A500',
                purple:     '#7C6BF8',
                border:     'rgba(212,175,55,0.2)',
                borderHover:'rgba(212,175,55,0.4)',
            },
            card: {
                background: '#0A0A0A',
                border:     '1px solid rgba(212,175,55,0.2)',
                borderHover:'1px solid rgba(212,175,55,0.4)',
                radius:     '10px',
                shadow:     'none',
                shadowHover:'0 4px 16px rgba(0,0,0,0.3)',
            },
            badge: {
                radius:     '10px',
                fontWeight:  700,
            },
            effects: {
                scanlines:   false,
                glow:        false,
                pixelate:    false,
                hoverScale:  1.0,
                transition:  '0.15s ease',
            },
        },

        tecmo: {
            id: 'tecmo',
            name: 'Tecmo Bowl',
            preview: '🎮',
            fonts: {
                display: '"Press Start 2P", monospace',
                ui: '"Press Start 2P", monospace',
                mono: '"Press Start 2P", monospace',
                sizeScale: 0.7, // pixel fonts are wider, need smaller sizes
            },
            colors: {
                bg:         '#0a0a2e',
                card:       '#0a0a2e',
                cardHover:  'rgba(0,255,65,0.06)',
                accent:     '#00ff41',
                accentDark: '#00cc33',
                text:       '#ffffff',
                textMuted:  '#88aacc',
                textFaint:  'rgba(136,170,204,0.4)',
                positive:   '#00ff41',
                negative:   '#ff0000',
                info:       '#00ccff',
                warn:       '#ffcc00',
                purple:     '#cc00ff',
                border:     'rgba(0,255,65,0.5)',
                borderHover:'rgba(0,255,65,0.8)',
            },
            card: {
                background: '#0a0a2e',
                border:     '2px solid rgba(0,255,65,0.5)',
                borderHover:'2px solid rgba(0,255,65,0.8)',
                radius:     '0px',
                shadow:     '0 0 8px rgba(0,255,65,0.15)',
                shadowHover:'0 0 16px rgba(0,255,65,0.3)',
            },
            badge: {
                radius:     '0px',
                fontWeight:  700,
            },
            effects: {
                scanlines:   true,
                glow:        true,
                pixelate:    false,
                hoverScale:  1.0,
                transition:  '0.1s linear',
            },
        },
    };

    // ── Dynamic CSS injection ────────────────────────────────────
    function injectDynamicCSS(themeId) {
        let styleEl = document.getElementById(DYNAMIC_STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = DYNAMIC_STYLE_ID;
            document.head.appendChild(styleEl);
        }

        const t = THEMES[themeId] || THEMES.default;

        // Base: scanline overlay + glow effects, keyed by data attribute
        let css = '';

        if (t.effects.scanlines) {
            css += `
[data-wr-theme="${themeId}"] .wr-widget {
    position: relative;
}
[data-wr-theme="${themeId}"] .wr-widget::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
        0deg,
        transparent 0px, transparent 2px,
        rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px
    );
    pointer-events: none;
    z-index: 10;
    border-radius: ${t.card.radius};
}
`;
        }

        if (t.effects.glow) {
            css += `
[data-wr-theme="${themeId}"] .wr-data-value {
    text-shadow: 0 0 6px currentColor;
}
[data-wr-theme="${themeId}"] .wr-widget {
    box-shadow: ${t.card.shadow};
}
`;
        }

        // Override dashboard background
        css += `
[data-wr-theme="${themeId}"] .wr-dashboard-grid {
    background: ${t.colors.bg} !important;
}
`;

        styleEl.textContent = css;
    }

    // ── Public API ───────────────────────────────────────────────
    const WrTheme = {
        /** All registered themes */
        themes: THEMES,

        /** Current theme ID */
        current: 'default',

        /** Get the active theme object */
        get: function() {
            return THEMES[this.current] || THEMES.default;
        },

        /** Switch theme by ID, persist, apply CSS */
        set: function(id) {
            if (!THEMES[id]) return;
            this.current = id;
            try { localStorage.setItem(LS_KEY, id); } catch (e) {}
            document.documentElement.setAttribute('data-wr-theme', id);
            injectDynamicCSS(id);
            // Dispatch event so React components can re-render
            window.dispatchEvent(new CustomEvent('wr_theme_changed', { detail: { theme: id } }));
        },

        /** List available theme IDs */
        list: function() {
            return Object.keys(THEMES);
        },

        // ── Convenience accessors ────────────────────────────────
        color: function(key) { return this.get().colors[key]; },
        font:  function(key) { return this.get().fonts[key]; },

        /** Returns a full card style object for React inline styles */
        cardStyle: function(extra) {
            const t = this.get();
            return Object.assign({
                background: t.card.background,
                border: t.card.border,
                borderRadius: t.card.radius,
                boxShadow: t.card.shadow,
                overflow: 'hidden',
                height: '100%',
                transition: t.effects.transition,
            }, extra || {});
        },

        /** Returns a hover card style delta */
        cardHoverStyle: function() {
            const t = this.get();
            return {
                border: t.card.borderHover,
                boxShadow: t.card.shadowHover,
                background: t.colors.cardHover,
            };
        },

        /** Scale a font size by the theme's size multiplier */
        fontSize: function(baseRem) {
            return (baseRem * this.get().fonts.sizeScale) + 'rem';
        },

        /** Badge style (pills, chips) */
        badgeStyle: function(color, bg) {
            const t = this.get();
            return {
                fontSize: this.fontSize(0.6),
                fontWeight: t.badge.fontWeight,
                padding: '1px 6px',
                borderRadius: t.badge.radius,
                background: bg || (color + '18'),
                color: color || t.colors.accent,
                border: '1px solid ' + (color || t.colors.accent) + '44',
            };
        },
    };

    // ── Initialize from localStorage ─────────────────────────────
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved && THEMES[saved]) {
            WrTheme.current = saved;
        }
    } catch (e) {}

    // Apply initial theme
    document.documentElement.setAttribute('data-wr-theme', WrTheme.current);
    injectDynamicCSS(WrTheme.current);

    window.WrTheme = WrTheme;
})();

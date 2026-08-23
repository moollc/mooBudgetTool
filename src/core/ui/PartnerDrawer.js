/*
 * Component: Partner drawer (funding rail)
 * Lifecycle: init [YES] | open [YES] | close [YES] | toggle [YES]
 * Description: LEFT full-height column of stacked affiliate tiles.
 *   WaveSpeed first. Shell chrome only. Not a right-side chip.
 */

(function (window) {
    'use strict';

    var SESSION_KEY = 'mBT_partnerDrawerClosed';
    var DONATE_KEY = 'mBT_partnerDonateUnlocked';
    var DESKTOP_MIN = 768;

    /* Closed: point out of the left edge. Open: point into the column. */
    var CHEVRON_OUT = '2 2 6 8 2 14';
    var CHEVRON_IN = '6 2 2 8 6 14';

    var PARTNERS = [
        {
            id: 'wavespeed',
            name: 'WaveSpeed',
            href: 'https://wavespeed.ai/?ref=jayson',
            blurb: 'AI image and video. Using this link funds mBT.',
            logo: './assets/partners/wavespeed.svg'
        }
    ];

    var inited = false;
    var railEl = null;
    var chevronEl = null;

    function esc(str) {
        if (window.mBT && window.mBT.ui && window.mBT.ui.render && typeof window.mBT.ui.render.esc === 'function') {
            return window.mBT.ui.render.esc(str);
        }
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isDonateUnlocked() {
        try {
            var v = window.localStorage.getItem(DONATE_KEY);
            return v != null && v !== '' && v !== 'false' && v !== '0';
        } catch (e) {
            return false;
        }
    }

    function isDesktop() {
        return window.innerWidth >= DESKTOP_MIN;
    }

    function isSessionClosed() {
        try {
            var v = window.sessionStorage.getItem(SESSION_KEY);
            return v != null && v !== '' && v !== 'false' && v !== '0';
        } catch (e) {
            return false;
        }
    }

    function shouldAutoOpen() {
        if (isDonateUnlocked()) return false;
        if (isSessionClosed()) return false;
        if (!isDesktop()) return false;
        return true;
    }

    function isOpen() {
        return !!(railEl && !railEl.classList.contains('mbt-partner-hidden'));
    }

    function setSessionClosed(closed) {
        try {
            if (closed) window.sessionStorage.setItem(SESSION_KEY, 'true');
            else window.sessionStorage.removeItem(SESSION_KEY);
        } catch (e) { /* private mode */ }
    }

    function setChevronDirection(open) {
        var poly;
        if (!chevronEl) return;
        poly = chevronEl.querySelector('polyline');
        if (poly) poly.setAttribute('points', open ? CHEVRON_IN : CHEVRON_OUT);
        chevronEl.setAttribute('aria-expanded', open ? 'true' : 'false');
        chevronEl.setAttribute('aria-label', open ? 'Close partner drawer' : 'Show partners');
    }

    function applyPush(open) {
        var body = document.body;
        if (!body) return;
        if (open) body.classList.add('mbt-partner-open');
        else body.classList.remove('mbt-partner-open');
        if (isDonateUnlocked()) body.classList.add('mbt-partner-gone');
        else body.classList.remove('mbt-partner-gone');
    }

    function applyState(open, writeSession) {
        if (isDonateUnlocked()) open = false;
        if (railEl) {
            if (open) railEl.classList.remove('mbt-partner-hidden');
            else railEl.classList.add('mbt-partner-hidden');
        }
        applyPush(open);
        setChevronDirection(open);
        if (writeSession) setSessionClosed(!open);
    }

    function renderLogo(p) {
        return '<img class="mbt-partner-logo" src="' + esc(p.logo) + '" alt="' + esc(p.name) + '">';
    }

    function renderTiles() {
        var html = '';
        var i;
        var p;
        for (i = 0; i < PARTNERS.length; i++) {
            p = PARTNERS[i];
            html += '<a class="mbt-partner-tile" href="' + esc(p.href) + '" target="_blank" rel="noopener" data-partner="' + esc(p.id) + '">' +
                renderLogo(p) +
                '<p class="mbt-partner-blurb">' + esc(p.blurb) + '</p>' +
                '<p class="mbt-partner-disclosure">Affiliate link. We may earn a commission.</p>' +
                '</a>';
        }
        return html;
    }

    function onRailClick(e) {
        var closeBtn;
        var tile;
        var href;
        closeBtn = e.target.closest ? e.target.closest('#mbt-partner-close') : null;
        if (closeBtn) {
            e.preventDefault();
            api.close();
            return;
        }
        if (e.target.closest && e.target.closest('#mbt-partner-donate-note')) {
            e.preventDefault();
            if (window.mBTRouter && typeof window.mBTRouter.showCoffeeWidget === 'function') {
                window.mBTRouter.showCoffeeWidget();
            } else if (window.mBT && mBT.core && mBT.core.actions && typeof mBT.core.actions['support-modal'] === 'function') {
                mBT.core.actions['support-modal']();
            }
            return;
        }
        tile = e.target.closest ? e.target.closest('.mbt-partner-tile') : null;
        if (!tile) return;
        e.preventDefault();
        href = tile.getAttribute('href');
        if (href) window.open(href, '_blank', 'noopener');
    }

    function mount() {
        if (document.getElementById('mbt-partner-rail')) {
            railEl = document.getElementById('mbt-partner-rail');
            chevronEl = document.getElementById('mbt-partner-chevron');
            return;
        }

        railEl = document.createElement('aside');
        railEl.id = 'mbt-partner-rail';
        railEl.setAttribute('role', 'complementary');
        railEl.setAttribute('aria-label', 'Partners');
        railEl.innerHTML =
            '<div class="mbt-partner-header">' +
            '<button type="button" id="mbt-partner-close" aria-label="Close partner drawer">Close</button>' +
            '</div>' +
            renderTiles() +
            '<button type="button" class="mbt-partner-donate-note" id="mbt-partner-donate-note">Donate via Fuel the Code. This bar hides for supporters with a token on this device, or a signed-in account that already has one.</button>';
        railEl.addEventListener('click', onRailClick);

        chevronEl = document.createElement('button');
        chevronEl.id = 'mbt-partner-chevron';
        chevronEl.type = 'button';
        chevronEl.setAttribute('aria-label', 'Show partners');
        chevronEl.setAttribute('aria-controls', 'mbt-partner-rail');
        chevronEl.setAttribute('aria-expanded', 'false');
        chevronEl.innerHTML = '<svg viewBox="0 0 8 16" width="8" height="16" aria-hidden="true"><polyline points="' + CHEVRON_OUT + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        chevronEl.addEventListener('click', function () {
            api.toggle();
        });

        document.body.appendChild(railEl);
        document.body.appendChild(chevronEl);
    }

    var api = {
        init: function () {
            if (inited) return;
            mount();
            inited = true;
            if (shouldAutoOpen()) applyState(true, false);
            else applyState(false, false);
        },

        onToolOpen: function () {
            if (!inited) {
                api.init();
                return;
            }
            if (shouldAutoOpen()) applyState(true, false);
        },

        /* Retired honor-system hide. The rail hides only for a supporter token
           already on this device or already on the signed-in account. A click
           must not mint mBT_partnerDonateUnlocked, so this writes nothing and
           pushes nothing. Kept as a no-op so any leftover onclick is harmless. */
        lockAfterDonate: function () {
            return false;
        },

        /* Called from pullPreferences. Hide only. Do not push. */
        hideAfterDonateSync: function () {
            if (!inited) {
                mount();
                inited = true;
            }
            applyState(false, false);
        },

        open: function () {
            if (isDonateUnlocked()) return;
            if (!inited) api.init();
            applyState(true, true);
        },

        close: function () {
            if (!inited) {
                mount();
                inited = true;
            }
            applyState(false, true);
        },

        toggle: function () {
            if (!inited) api.init();
            if (isOpen()) api.close();
            else api.open();
        }
    };

    window.mBTPartnerDrawer = api;

})(window);

/* 
 * Component: Footer Navigation
 * Lifecycle: render [YES] | update [NO] | bindEvents [NO] | init [NO]
 * Description: fixed bottom navigation pill for the Budget Editor.
 */

(function (window) {
    'use strict';
    window.mBT = window.mBT || {};
    window.mBT.ui = window.mBT.ui || {};

    /* --- mBT.ui.footer: Budget Editor bottom navigation pill --- */
    window.mBT.ui.footer = {

        /* Injects the nav pill HTML into #footer-hud.
           Must be called before injectFooterIcons() in the init chain. */
        render: function () {
            var el = document.getElementById('footer-hud');
            if (!el) return;
            el.innerHTML = [
                /* The pill collapses horizontally into the center button when auto-hide is active */
                '<div id="footer-nav"',
                '    class="mx-auto bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[28px] p-1.5 px-4 flex justify-center items-center pointer-events-auto ring-1 ring-black/20 w-fit"',
                '    style="transition:width 0.35s cubic-bezier(0.4,0,0.2,1),padding 0.35s ease,border-radius 0.35s ease;">',

                /* Left button group — clips as pill shrinks left */
                '<div id="nav-left" class="flex items-center overflow-hidden"',
                '    style="transition:max-width 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;max-width:400px;opacity:1;">',

                '<button id="stagesFooterBtn" data-pill-order="1" data-pill-side="left" aria-label="Stages View"',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-emerald-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
                '            <polygon points="12 2 2 7 12 12 22 7 12 2" />',
                '            <polyline points="2 17 12 22 22 17" />',
                '            <polyline points="2 12 12 17 22 12" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-emerald-400 whitespace-nowrap hidden md:block">Stages</span>',
                '</button>',

                '<button id="docsFooterBtn" data-pill-order="2" data-pill-side="left" aria-label="mBTDB Document Builder"',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-blue-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6" id="icon-docs"></div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-blue-400 whitespace-nowrap hidden md:block">Docs</span>',
                '</button>',

                '<button id="contactsFooterBtn" data-pill-order="3" data-pill-side="left" aria-label="Crew Contacts"',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-teal-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
                '            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />',
                '            <circle cx="9" cy="7" r="4" />',
                '            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />',
                '            <path d="M16 3.13a4 4 0 0 1 0 7.75" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-teal-400 whitespace-nowrap hidden md:block">Crew</span>',
                '</button>',

                /* Phase 65: Undo Chevron */
                '<button id="undoBtn" data-action="undo" aria-label="Undo" disabled',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0"',
                '    style="opacity:0.35;">',
                '    <div class="text-slate-400 group-hover:text-white [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6 transition-colors">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
                '            <polyline points="9 14 4 9 9 4" />',
                '            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white whitespace-nowrap transition-colors hidden md:block">Undo</span>',
                '</button>',

                '</div>', /* end nav-left */

                /* Center anchor — Settings keystone, always visible, sets the collapsed pill size */
                '<button id="mainActionBtn" data-action="settings-modal" aria-label="Settings"',
                '    class="flex-shrink-0 bg-blue-600 rounded-[18px] shadow-xl shadow-blue-500/20 flex flex-col items-center justify-center gap-0.5 text-white border-2 border-white/20 transition-all hover:bg-blue-500 active:scale-90 px-3 py-2 min-w-[48px]">',
                '    <div id="icon-main-action" class="[&>svg]:w-6 [&>svg]:h-6"></div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-blue-200 whitespace-nowrap hidden md:block">Settings</span>',
                '</button>',

                /* Right button group — clips as pill shrinks right */
                '<div id="nav-right" class="flex items-center overflow-hidden"',
                '    style="transition:max-width 0.35s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease;max-width:400px;opacity:1;">',

                /* Phase 65: Redo Chevron */
                '<button id="redoBtn" data-action="redo" aria-label="Redo" disabled',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0"',
                '    style="opacity:0.35;">',
                '    <div class="text-slate-400 group-hover:text-white [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6 transition-colors">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
                '            <polyline points="15 14 20 9 15 4" />',
                '            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-white whitespace-nowrap transition-colors hidden md:block">Redo</span>',
                '</button>',

                /* Phase 77: Actuals mode toggle — hidden by default, togglable via Settings → Manage HUD */
                '<button id="actualsToggleBtn" data-pill-order="4" data-pill-side="right" aria-label="Actuals Mode"',
                '    class="hidden flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-amber-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6 transition-colors" id="icon-actuals-toggle">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
                '            <rect x="2" y="3" width="20" height="14" rx="2" />',
                '            <line x1="8" y1="21" x2="16" y2="21" />',
                '            <line x1="12" y1="17" x2="12" y2="21" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-400 whitespace-nowrap transition-colors hidden md:block">Actuals</span>',
                '</button>',

                /* Phase 66: Search — hidden by default, togglable via Settings → Manage HUD */
                '<button id="searchFooterBtn" data-pill-order="5" data-pill-side="right" data-action="command-palette" aria-label="Search"',
                '    class="hidden flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-sky-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
                '            <circle cx="11" cy="11" r="8" />',
                '            <line x1="21" y1="21" x2="16.65" y2="16.65" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-sky-400 whitespace-nowrap hidden md:block">Search</span>',
                '</button>',

                /* Phase 73: Tools Drawer — hidden by default, togglable via Settings → Manage HUD */
                '<button id="toolsDrawerBtn" data-pill-order="6" data-pill-side="right" aria-label="Tools"',
                '    class="hidden flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-teal-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
                '            <rect x="3" y="3" width="7" height="7" />',
                '            <rect x="14" y="3" width="7" height="7" />',
                '            <rect x="14" y="14" width="7" height="7" />',
                '            <rect x="3" y="14" width="7" height="7" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-teal-400 whitespace-nowrap hidden md:block">Tools</span>',
                '</button>',

                '<button id="calendarFooterBtn" data-pill-order="7" data-pill-side="right" aria-label="Production Calendar"',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-violet-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
                '            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />',
                '            <line x1="16" y1="2" x2="16" y2="6" />',
                '            <line x1="8" y1="2" x2="8" y2="6" />',
                '            <line x1="3" y1="10" x2="21" y2="10" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-violet-400 whitespace-nowrap hidden md:block">Cal</span>',
                '</button>',

                '<button id="secondaryActionBtn" data-pill-order="8" data-pill-side="right" aria-label="Publish Menu"',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-indigo-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6" id="icon-secondary-action"></div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 whitespace-nowrap hidden md:block">Publish</span>',
                '</button>',

                '<button id="footerCoffeeBtn" data-pill-order="9" data-pill-side="right" aria-label="Support"',
                '    class="flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-amber-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6" id="icon-coffee"></div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-400 whitespace-nowrap hidden md:block">Support</span>',
                '</button>',

                /* Phase 87C: Help Button — hidden by default, togglable via Settings → Manage HUD */
                '<button id="footerHelpBtn" data-pill-order="10" data-pill-side="right" data-action="help-overlay" aria-label="Help"',
                '    class="hidden flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-sky-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
                '            <circle cx="12" cy="12" r="10" />',
                '            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />',
                '            <line x1="12" y1="17" x2="12.01" y2="17" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-sky-400 whitespace-nowrap hidden md:block">Help</span>',
                '</button>',

                /* Phase 92.1: Activity Feed — hidden by default, togglable via Settings → Manage HUD */
                '<button id="activityFeedBtn" data-pill-order="11" data-pill-side="right" data-action="activity-feed" aria-label="Activity Feed"',
                '    class="relative hidden flex flex-col items-center gap-0.5 group transition-all active:scale-90 justify-center px-1.5 py-1 flex-shrink-0">',
                '    <div class="text-slate-400 group-hover:text-amber-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">',
                '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">',
                '            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />',
                '            <path d="M13.73 21a2 2 0 0 1-3.46 0" />',
                '        </svg>',
                '    </div>',
                '    <span class="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-400 whitespace-nowrap hidden md:block">Activity</span>',
                '    <span id="activityFeedBadge" data-count="0"',
                '        style="display:none;position:absolute;top:2px;right:2px;min-width:14px;height:14px;background:#ef4444;border-radius:9999px;border:1px solid rgba(255,255,255,0.2);align-items:center;justify-content:center;font-size:8px;font-weight:900;color:white;padding:0 2px;line-height:1;"></span>',
                '</button>',

                '</div>', /* end nav-right */
                '</div>'  /* end footer-nav */
            ].join('');
        }
    };

})(window);

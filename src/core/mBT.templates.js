/* mBT Phase 47: Extracted Static Presets & Templates */
/* Phase 87C: Help Overlay Template added */

/**
 * Phase 87C: Glassmorphic Keyboard Shortcut Cheat Sheet
 * Returns HTML string for the help overlay modal.
 * Context-aware: shows global shortcuts + active tool shortcuts.
 */
function helpOverlayTemplate(activeTool) {
    var globalShortcuts = [
        { keys: 'Ctrl + K', desc: 'Command Palette (Search)' },
        { keys: 'Ctrl + Z', desc: 'Undo' },
        { keys: 'Ctrl + Shift + Z', desc: 'Redo' },
        { keys: '?', desc: 'This Help Overlay' },
        { keys: 'Esc', desc: 'Close Topmost Modal' }
    ];

    var toolShortcuts = {
        'stages': [
            { keys: 'Drag', desc: 'Reorder items within stage' },
            { keys: 'Click Cost', desc: 'Edit item rate/days' }
        ],
        'calendar': [
            { keys: 'Click Event', desc: 'Edit event details' },
            { keys: 'Drag', desc: 'Move event date' }
        ],
        'contacts': [
            { keys: 'Click Card', desc: 'Expand wallet panel' },
            { keys: 'Search', desc: 'Filter by name/dept' }
        ],
        'po': [
            { keys: 'Click PO', desc: 'Edit purchase order' },
            { keys: 'Status Dropdown', desc: 'Change PO lifecycle' }
        ],
        'publisher': [
            { keys: 'Click Template', desc: 'Open document editor' },
            { keys: 'Preview', desc: 'Generate PDF snapshot' }
        ],
        'fringes': [
            { keys: 'Toggle', desc: 'Enable/disable fringe' },
            { keys: 'Rate Input', desc: 'Edit percentage' }
        ]
    };

    var activeToolShortcuts = (activeTool && toolShortcuts[activeTool]) ? toolShortcuts[activeTool] : [];

    function renderRow(s) {
        return '<div class="flex items-center justify-between py-2 border-b border-white/10 last:border-0">' +
            '<span class="text-[10px] font-mono font-bold text-white/80 bg-white/10 px-2 py-0.5 rounded">' + s.keys + '</span>' +
            '<span class="text-[10px] text-white/60 font-medium">' + s.desc + '</span>' +
        '</div>';
    }

    var html = '<div class="p-6 space-y-5">' +
        /* Global Shortcuts */
        '<div>' +
            '<h4 class="text-[9px] font-black uppercase tracking-widest text-white/40 mb-3">Global Shortcuts</h4>' +
            '<div class="space-y-0">' +
                globalShortcuts.map(renderRow).join('') +
            '</div>' +
        '</div>';

    /* Tool-specific shortcuts (if active) */
    if (activeToolShortcuts.length > 0) {
        html += '<div>' +
            '<h4 class="text-[9px] font-black uppercase tracking-widest text-white/40 mb-3">' + activeTool.toUpperCase() + ' Shortcuts</h4>' +
            '<div class="space-y-0">' +
                activeToolShortcuts.map(renderRow).join('') +
            '</div>' +
        '</div>';
    }

    html += '<div class="pt-2 text-center">' +
        '<p class="text-[8px] text-white/30 font-bold uppercase tracking-widest">Press Esc to close</p>' +
    '</div>' +
    '</div>';

    return html;
}

/* Expose on window for mBT/index.html access */
window.helpOverlayTemplate = helpOverlayTemplate;

/* --- 5. Production Presets (industry standard stage ratios) --- */
/* Keys match BUDGET_TEMPLATES labels where possible (TVC keeps short key). */
/* Ratios are % of total timeline; each row sums to 100. */
/* Event Coverage / Live: prep and promo share pre; event day is prod; recap is post. */
/* Streaming / Broadcast: one season/cycle; prod is the recurring air window. */
var STAGE_PRESETS = {
    'TVC': { 'dev': 10, 'pre': 25, 'prod': 15, 'post': 35, 'dist': 15 },
    'Music Video': { 'dev': 10, 'pre': 20, 'prod': 15, 'post': 40, 'dist': 15 },
    'Documentary': { 'dev': 20, 'pre': 15, 'prod': 35, 'post': 20, 'dist': 10 },
    'Feature Film': { 'dev': 25, 'pre': 20, 'prod': 20, 'post': 25, 'dist': 10 },
    'Short Film': { 'dev': 10, 'pre': 25, 'prod': 10, 'post': 40, 'dist': 15 },
    'Corporate / Brand Film': { 'dev': 15, 'pre': 25, 'prod': 10, 'post': 40, 'dist': 10 },
    'Event Coverage / Live': { 'dev': 5, 'pre': 35, 'prod': 25, 'post': 25, 'dist': 10 },
    'Scripted Web Series': { 'dev': 15, 'pre': 20, 'prod': 30, 'post': 25, 'dist': 10 },
    'Streaming / Broadcast': { 'dev': 10, 'pre': 25, 'prod': 50, 'post': 10, 'dist': 5 }
};

/* --- 5.1. Payment Methods (Foundations Phase 3) --- */
var PAYMENT_SERVICES = [
    { id: 'cash', label: 'Cash / Petty Cash', icon: mBTAssets.money },
    { id: 'transfer', label: 'Bank Transfer (JMD)', icon: mBTAssets.bank },
    { id: 'wire', label: 'Intl Wire (USD)', icon: mBTAssets.globe },
    { id: 'cheque', label: 'Cheque', icon: mBTAssets.receipt },
    { id: 'paypal', label: 'PayPal', icon: mBTAssets.creditCard },
    { id: 'wise', label: 'Wise', icon: mBTAssets.wallet },
    { id: 'payoneer', label: 'Payoneer', icon: mBTAssets.creditCard }
];

/* --- 6. Budget Templates (Industry Standard Structures) --- */
/* Phase 194.2: Expanded from 4 to 8 types. All role names match mBTOG master index keys exactly. */
var BUDGET_TEMPLATES = {
    'commercial': {
        icon: 'film',
        label: 'Commercial (TVC)',
        desc: 'High-end structure for brand campaigns. Deep talent/crew and heavy markup.',
        structure: [
            { id: 'atl', name: 'Above The Line (Creative)', items: ['Director', 'Producer', 'Cast - Lead', 'Screenwriter'] },
            { id: 'btl_pre', name: 'BTL: Pre-Production', items: ['Line Producer', '1st Assistant Director (1st AD)', 'Location Scout', 'Casting Director', 'Storyboard Artist'] },
            { id: 'btl_prod', name: 'BTL: Production Crew', items: ['Director of Photography (DP)', 'Camera Operator', '1st Assistant Camera (Focus)', 'Gaffer', 'Key Grip', 'Sound Mixer', 'Makeup Artist (Key)', 'Production Designer', 'Set PA', 'Cast - Supporting'] },
            { id: 'btl_post', name: 'BTL: Post-Production', items: ['Editor', 'Colorist', 'VFX Supervisor', 'Sound Designer', 'Music Supervisor'] },
            { id: 'logistics', name: 'Logistics & Fees', items: ['Catering (Per Head)', 'Location Manager', 'Security Guard'] }
        ]
    },
    'music_video': {
        icon: 'music',
        label: 'Music Video',
        desc: 'Visual-first production. Heavy art direction, performance staging, and grading.',
        structure: [
            { id: 'atl', name: 'Creative & Direction', items: ['Director', 'Producer', 'Art Director', 'Cast - Lead'] },
            { id: 'btl_prod', name: 'Production', items: ['Director of Photography (DP)', 'Gaffer', 'Key Grip', 'Steadicam Operator', 'Makeup Artist (Key)', 'Wardrobe Stylist', 'Set PA'] },
            { id: 'btl_post', name: 'Post-Production', items: ['Editor', 'Colorist', 'VFX Artist', 'Music Editor'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)', 'Location Manager', 'Cast - Supporting'] }
        ]
    },
    'documentary': {
        icon: 'camera',
        label: 'Documentary',
        desc: 'Run-and-gun optimized. Story ownership and funding up top; field logistics and archival scale below.',
        structure: [
            { id: 'atl', name: 'Story Ownership & Creative', items: ['Director', 'Producer', 'Executive Producer', 'Story Researcher', 'Screenwriter', 'Host', 'Narrator', 'Cast - Lead'] },
            { id: 'rights', name: 'Rights & Acquisition', items: ['Legal - Rights & Clearances', 'Life Rights / IP Purchase'] },
            { id: 'btl_prod', name: 'Field Production', items: ['Director of Photography (DP)', 'Sound Mixer', 'Drone Operator', 'Researcher', 'Set PA'] },
            { id: 'btl_post', name: 'Post & Archive', items: ['Editor', 'Archival Researcher', 'Colorist', 'Sound Designer'] },
            { id: 'travel', name: 'Travel & Logistics', items: ['Fixer/Local Producer', 'Security Guard', 'Catering (Per Head)'] }
        ]
    },
    'feature_film': {
        icon: 'video',
        label: 'Feature Film',
        desc: 'Comprehensive studio/indie structure for long-form narrative projects.',
        structure: [
            { id: 'atl', name: 'ATL: Creative & Talent', items: ['Director', 'Producer', 'Executive Producer', 'Cast - Lead', 'Screenwriter'] },
            { id: 'btl_pre', name: 'BTL: Pre-Pro & Legal', items: ['Line Producer', 'Unit Production Manager (UPM)', '1st Assistant Director (1st AD)', 'Production Accountant', 'Legal - Rights & Clearances'] },
            { id: 'btl_prod', name: 'BTL: Principal Photography', items: ['Director of Photography (DP)', '1st Assistant Camera (Focus)', 'Gaffer', 'Key Grip', 'Sound Mixer', 'Production Designer', 'Script Supervisor', 'Still Photographer'] },
            { id: 'btl_post', name: 'BTL: Post-Production', items: ['Post-Production Supervisor', 'Editor', 'Colorist', 'Composer', 'VFX Supervisor'] },
            { id: 'other', name: 'Logistics', items: ['Location Manager', 'Catering (Per Head)', 'Medic / Set Nurse', 'Security Guard'] }
        ]
    },
    'short_film': {
        icon: 'scissors',
        label: 'Short Film',
        desc: 'Lean narrative structure. Prioritizes key creative roles and festival finishing. Director-written is the default (Screenwriter is not seeded); add it manually under Direction & Talent if the project has a separate paid writer.',
        structure: [
            { id: 'atl', name: 'Direction & Talent', items: ['Director', 'Producer', 'Cast - Lead'] },
            { id: 'btl_prod', name: 'Production Crew', items: ['Director of Photography (DP)', 'Sound Mixer', 'Gaffer', 'Key Grip', 'Set PA', 'Cast - Supporting'] },
            { id: 'btl_post', name: 'Post & Finishing', items: ['Editor', 'Colorist', 'Sound Designer'] },
            { id: 'other', name: 'Logistics', items: ['Location Manager', 'Catering (Per Head)'] }
        ]
    },
    'corporate_video': {
        icon: 'briefcase',
        label: 'Corporate / Brand Film',
        desc: 'Clean, professional structure for internal or B2B communications.',
        structure: [
            { id: 'atl', name: 'Project Management', items: ['Producer', 'Director', 'Copywriter (Pitch/Treatment)', 'Host'] },
            { id: 'btl_prod', name: 'Production', items: ['Director of Photography (DP)', 'Sound Mixer', 'Set PA'] },
            { id: 'btl_post', name: 'Post-Production', items: ['Editor', 'Colorist', 'Music Editor'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)'] }
        ]
    },
    'event_coverage': {
        icon: 'zap',
        label: 'Event Coverage / Live',
        desc: 'Multi-cam live coverage. Pre-event promo, technical advance, event window, post-event recap, and release.',
        structure: [
            /* Ordered top-to-bottom as the real live-event stretch (promo and advance can overlap on the calendar).
               Show / Client Leadership stays deliberately thin -- job ownership and client delivery for shops
               selling a full promo+coverage+recap package, not a film-style ATL block. Executive Producer is
               usually the agency/client on this production type (see Documentary's EP note) and is intentionally
               left out here; add manually if the production company itself fields one. */
            { id: 'leadership', name: 'Show / Client Leadership', items: ['Producer'] },
            { id: 'promo', name: 'Pre-Event Promo Content', items: ['Graphics Artist'] },
            { id: 'advance', name: 'Technical Advance & Connectivity', items: ['Switcher/Encoder', 'Dedicated Internet Line'] },
            { id: 'event', name: 'Event Day Crew', items: ['Technical Director', 'Camera Operator', 'Sound Mixer', 'Digital Imaging Tech (DIT)'] },
            { id: 'post', name: 'Post-Event Recap & Delivery', items: ['Editor', 'Colorist'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)'] }
        ]
    },
    'web_series': {
        icon: 'layout',
        label: 'Scripted Web Series',
        desc: 'Optimized for episodic content. Balanced for volume and digital distribution. Executive Producer is assumed to also be the Showrunner (dual-hat, standard on indie/digital series) unless the project splits the two roles.',
        structure: [
            { id: 'atl', name: 'Showrunner / Executive Producer & Talent', items: ['Executive Producer', 'Director', 'Cast - Lead', 'Cast - Supporting', 'Screenwriter'] },
            { id: 'btl_prod', name: 'Production', items: ['Director of Photography (DP)', '1st Assistant Camera (Focus)', 'Sound Mixer', 'Gaffer', 'Set PA'] },
            { id: 'btl_post', name: 'Post-Production', items: ['Editor', 'Colorist', 'VFX Artist', 'Music Editor'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)', 'Location Manager'] }
        ]
    },
    'streaming_broadcast': {
        icon: 'globe',
        label: 'Streaming / Broadcast',
        desc: 'Ongoing studio or streaming show. Build infrastructure once, air on a recurring cadence.',
        structure: [
            { id: 'atl', name: 'Show Leadership & Talent', items: ['Executive Producer', 'Producer', 'Director', 'Cast - Lead'] },
            { id: 'tech', name: 'Control Room & Floor', items: ['Technical Director', 'Broadcast Engineer', 'Camera Operator', 'Sound Mixer', 'Graphics Artist'] },
            { id: 'infra', name: 'Studio Infrastructure', items: ['Switcher/Encoder', 'Dedicated Internet Line'] },
            { id: 'post', name: 'Highlights & Package', items: ['Editor', 'Colorist'] },
            { id: 'other', name: 'Logistics & Ops', items: ['Catering (Per Head)', 'Publicist'] }
        ]
    }
};

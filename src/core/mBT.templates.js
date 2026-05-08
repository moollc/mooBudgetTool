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

/* --- 5. Production Presets (Industry standard stage ratios) --- */
var STAGE_PRESETS = {
    'TVC': { 'dev': 10, 'pre': 25, 'prod': 15, 'post': 35, 'dist': 15 },
    'Music Video': { 'dev': 10, 'pre': 20, 'prod': 15, 'post': 40, 'dist': 15 },
    'Documentary': { 'dev': 20, 'pre': 15, 'prod': 35, 'post': 20, 'dist': 10 },
    'Feature Film': { 'dev': 25, 'pre': 20, 'prod': 20, 'post': 25, 'dist': 10 }
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
            { id: 'atl', name: 'Above The Line (Creative)', items: ['Director', 'Producer', 'Director of Photography (DP)', 'Screenwriter'] },
            { id: 'btl_pre', name: 'BTL: Pre-Production', items: ['Line Producer', '1st Assistant Director (1st AD)', 'Location Scout', 'Casting Director', 'Storyboard Artist'] },
            { id: 'btl_prod', name: 'BTL: Production Crew', items: ['Camera Operator', '1st Assistant Camera (Focus)', 'Gaffer', 'Key Grip', 'Sound Mixer', 'Makeup Artist (Key)', 'Production Designer', 'Set PA'] },
            { id: 'btl_post', name: 'BTL: Post-Production', items: ['Editor', 'Colorist', 'VFX Supervisor', 'Sound Designer', 'Music Supervisor'] },
            { id: 'logistics', name: 'Logistics & Fees', items: ['Catering (Per Head)', 'Location Manager', 'Security Guard'] }
        ]
    },
    'music_video': {
        icon: 'music',
        label: 'Music Video',
        desc: 'Visual-first production. Heavy art direction, performance staging, and grading.',
        structure: [
            { id: 'atl', name: 'Creative & Direction', items: ['Director', 'Producer', 'Director of Photography (DP)', 'Art Director'] },
            { id: 'btl_prod', name: 'Production', items: ['Gaffer', 'Key Grip', 'Steadicam Operator', 'Makeup Artist (Key)', 'Wardrobe Stylist', 'Set PA'] },
            { id: 'btl_post', name: 'Post-Production', items: ['Editor', 'Colorist', 'VFX Artist', 'Music Editor'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)', 'Location Manager', 'Cast - Supporting'] }
        ]
    },
    'documentary': {
        icon: 'camera',
        label: 'Documentary',
        desc: 'Run-and-gun optimized. Focus on research, field logistics, and archival.',
        structure: [
            { id: 'atl', name: 'Creative & Research', items: ['Director', 'Producer', 'Researcher', 'Screenwriter'] },
            { id: 'btl_prod', name: 'Field Production', items: ['Director of Photography (DP)', 'Sound Mixer', 'Drone Operator', 'Set PA'] },
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
        desc: 'Lean narrative structure. Prioritizes key creative roles and festival finishing.',
        structure: [
            { id: 'atl', name: 'Direction & Talent', items: ['Director', 'Producer', 'Cast - Lead'] },
            { id: 'btl_prod', name: 'Production Crew', items: ['Director of Photography (DP)', 'Sound Mixer', 'Gaffer', 'Key Grip', 'Set PA'] },
            { id: 'btl_post', name: 'Post & Finishing', items: ['Editor', 'Colorist', 'Sound Designer'] },
            { id: 'other', name: 'Logistics', items: ['Location Manager', 'Catering (Per Head)'] }
        ]
    },
    'corporate_video': {
        icon: 'briefcase',
        label: 'Corporate / Brand Film',
        desc: 'Clean, professional structure for internal or B2B communications.',
        structure: [
            { id: 'atl', name: 'Project Management', items: ['Producer', 'Director', 'Copywriter (Pitch/Treatment)'] },
            { id: 'btl_prod', name: 'Production', items: ['Director of Photography (DP)', 'Sound Mixer', 'Set PA'] },
            { id: 'btl_post', name: 'Post-Production', items: ['Editor', 'Colorist', 'Music Editor'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)'] }
        ]
    },
    'event_coverage': {
        icon: 'zap',
        label: 'Event Coverage / Live',
        desc: 'Multi-cam setup. Focus on switching, connectivity, and rapid turnaround.',
        structure: [
            { id: 'tech', name: 'Technical Crew', items: ['Technical Director', 'Camera Operator', 'Sound Mixer', 'Digital Imaging Tech (DIT)'] },
            { id: 'gear', name: 'Hardware & Connectivity', items: ['Switcher/Encoder', 'Dedicated Internet Line'] },
            { id: 'post', name: 'Quick Turnaround', items: ['Editor', 'Colorist'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)'] }
        ]
    },
    'web_series': {
        icon: 'layout',
        label: 'Scripted Web Series',
        desc: 'Optimized for episodic content. Balanced for volume and digital distribution.',
        structure: [
            { id: 'atl', name: 'Showrunners & Talent', items: ['Executive Producer', 'Director', 'Cast - Lead', 'Screenwriter'] },
            { id: 'btl_prod', name: 'Production', items: ['Director of Photography (DP)', '1st Assistant Camera (Focus)', 'Sound Mixer', 'Gaffer', 'Set PA'] },
            { id: 'btl_post', name: 'Post-Production', items: ['Editor', 'Colorist', 'VFX Artist', 'Music Editor'] },
            { id: 'other', name: 'Logistics', items: ['Catering (Per Head)', 'Location Manager'] }
        ]
    }
};

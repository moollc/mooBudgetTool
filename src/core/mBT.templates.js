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
var BUDGET_TEMPLATES = {
    'Commercial': {
        icon: 'film',
        label: 'TV Commercial',
        desc: 'Standard TVC structure. High-end crew, talent fees, and heavy post-production.',
        structure: [
            { id: 'atl', name: 'Above The Line', items: ['Director', 'Producer', 'Copywriter (Pitch/Treatment)', 'Casting Director'] },
            { id: 'prod', name: 'Production', items: ['Director of Photography (DP)', 'Camera Operator', 'Gaffer', 'Key Grip', 'Sound Mixer', 'Makeup Artist (Key)', 'Production Designer', 'Wardrobe Stylist'] },
            { id: 'post', name: 'Post-Production', items: ['Editor', 'Colorist', 'VFX Artist', 'Sound Designer', 'Music Supervisor'] },
            { id: 'other', name: 'Logistics & Talent', items: ['Cast - Lead', 'Location Manager', 'Catering (Per Head)', 'Equipment Rental', 'Insurance'] }
        ]
    },
    'Documentary': {
        icon: 'camera',
        label: 'Documentary',
        desc: 'Run-and-gun optimized. Prioritizes travel, field logistics, research, and archival licensing.',
        structure: [
            { id: 'atl', name: 'Creative & Research', items: ['Director', 'Producer', 'Researcher', 'Subject Consultant'] },
            { id: 'prod', name: 'Field Production', items: ['Director of Photography (DP)', 'Sound Mixer', 'Fixer/Local Producer', 'Drone Operator'] },
            { id: 'travel', name: 'Travel & Logistics', items: ['Flights', 'Accommodation', 'Per Diems', 'Vehicle Rental', 'Carnets/Visas'] },
            { id: 'post', name: 'Post & Archive', items: ['Editor', 'Transcription', 'Archival Researcher', 'Archival Licensing', 'Colorist'] }
        ]
    },
    'Live Stream': {
        icon: 'zap',
        label: 'Live Broadcast',
        desc: 'Multi-cam setup. Focus on bandwidth redundancy, switching hardware, and technical operators.',
        structure: [
            { id: 'tech', name: 'Technical Crew', items: ['Technical Director', 'Stream Technician', 'Camera Operator', 'Camera Operator', 'Sound Mixer', 'Graphics Op'] },
            { id: 'gear', name: 'Hardware & Rigging', items: ['Switcher/Encoder', 'Cameras (3-Cam Kit)', 'Comms System', 'Bonded Cellular', 'Lighting Package'] },
            { id: 'conn', name: 'Connectivity', items: ['Dedicated Internet Line', '4G/5G Backup Data', 'IT Support'] },
            { id: 'other', name: 'Venue & Logistics', items: ['Venue Power Fee', 'Rigging', 'Crew Meals', 'Transport'] }
        ]
    },
    'Music Video': {
        icon: 'music',
        label: 'Music Video',
        desc: 'Visual-first production. Heavy art direction, performance staging, and cinematic color grading.',
        structure: [
            { id: 'atl', name: 'Creative & Direction', items: ['Director', 'Producer', 'Cinematographer', 'Art Director', 'Choreographer'] },
            { id: 'prod', name: 'Production', items: ['Camera Operator', 'Gaffer', 'Key Grip', 'Dolly Grip', 'Steadicam Op', 'Makeup Artist', 'Stylist'] },
            { id: 'post', name: 'Post-Production', items: ['Editor', 'Colorist', 'VFX Artist', 'Title/Motion Graphics'] },
            { id: 'other', name: 'Location & Logistics', items: ['Location Manager', 'Set Design', 'Props', 'Catering', 'Transport'] }
        ]
    }
};

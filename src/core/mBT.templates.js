/* mBT Phase 47: Extracted Static Presets & Templates */

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
    }
};

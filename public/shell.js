// mBT Monolith - Shell Entry Point (Local file:// compatible)
// This file provides basic initialization when running from file:// protocol
// Full app loads via Vite when using npm run dev or npm run build

document.addEventListener('DOMContentLoaded', function () {
  // Check if we're running from file:// protocol (local portability)
  var isFileProtocol = window.location.protocol === 'file:';
  var isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Initialize minimal shell for file:// access
  if (isFileProtocol) {
    console.log('[mBT] Running in file:// mode (offline/local)');
    
    // Initialize basic UI state
    window.mBT = window.mBT || {};
    window.mBT.core = window.mBT.core || {};
    
    // Set default currency
    window.mBT.core.displayCurrency = 'JMD';
    
    // Initialize OpenGate with default rates for offline use
    window.mBT.opengate = window.mBT.opengate || {};
    window.mBT.opengate.rates = [
      { description: 'Director', unit: 'Day', rate: 85000 },
      { description: 'Producer', unit: 'Day', rate: 75000 },
      { description: 'DP', unit: 'Day', rate: 90000 },
      { description: 'Editor', unit: 'Day', rate: 50000 },
      { description: 'Camera', unit: 'Day', rate: 60000 }
    ];
    
    console.log('[mBT] Offline mode active with default rates');
  } else if (!isDev) {
    console.log('[mBT] PWA mode - check service worker registration');
  }
  
  // Log build info
  console.log('[mBT] Monolith PWA - mooBudgetTool');
});

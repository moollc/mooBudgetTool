/**
 * mBT Icons Module - SVG Asset Library
 * Injected as window.mBT.icons global object
 */

(function() {
  const namespace = window.mBT || {};
  namespace.icons = namespace.icons || {};

  /**
   * SVG Icon Library - Extracted from mBT-Old.html
   * Each icon is a closure that returns an SVG string
   */

  // 📊 Database / Bar Chart
  namespace.icons.barChart = (function() {
    const d = "M6.3 3.3L18 15M3 21h18";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="${d}"></polyline></svg>`;
  })();

  // 🎭 Stages / Mask/Theater
  namespace.icons.stages = (function() {
    const d = "M18 15V6a2 2 0 00-2-2H7a2 2 0 00-2 2v9m16 0V19a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m16 0a2 2 0 01-2 2h-2m-8-2h2m0 0v2m0-2h2m-8-2h2m0 0v2m-4-2h2m0 0v2m10-6h2m-11 0h2m-3 0h2M21 15V21";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 📄 Publisher / Document
  namespace.icons.docs = (function() {
    const d = "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 🔓 OpenGate / Unlock
  namespace.icons.unlock = (function() {
    const d = "M19 15v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3m18-2V3a2 2 0 00-2-2H5a2 2 0 00-2 2v3m2-3v5h2";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="${d}"></path></svg>`;
  })();

  // 👥 Contacts / Users
  namespace.icons.users = (function() {
    const d = "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm-4 10v-2a4 4 0 100-8 4 4 0 000 8zm12-10a4 4 0 100-8 4 4 0 000 8z";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 🛡️ Security / Shield
  namespace.icons.shield = (function() {
    const d = "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // ⚙️ Settings / Gear
  namespace.icons.settings = (function() {
    const d = "M12 20a8 8 0 100-16 8 8 0 000 16zM19.4 15a1.35 1.35 0 00.345-.955 2 2 0 00-.586-1.392l-.866-1.06A1.01 1.01 0 0120 9.592v.018l.945.045a2 2 0 001.758-1.364 2 2 0 00-.586-1.757l-.867-1.062a1 1 0 01.345-1.392L22 5h-.009a8 8 0 10-11.718 0H12l-.009-.003a1 1 0 01-.345 1.392l-.867 1.062a2 2 0 00-1.757 1.364 2 2 0 00-.586 1.757l.945.045v-.018a1 1 0 01-.315.874l-.866 1.06a2 2 0 00-.586 1.392 2 2 0 00.345.955L10 19.03l-.945.045A2 2 0 008.295 20.4a2 2 0 001.758 1.364l.866 1.062a1 1 0 01-.345 1.392L10 24h.009a8 8 0 1011.718 0H22l-.009.003a1 1 0 01-.345-1.392l.866-1.062a2 2 0 00.586-1.392 2 2 0 00-.345-.955L14 19.03l.945-.045a2 2 0 001.758-1.364 2 2 0 00-.586-1.757l-.867-1.062a1 1 0 01.345-1.392L20 15h.009z");
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // ✕ Close / X
  namespace.icons.close = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  })();

  // 🎬 Movie Clapper / Stage Designer
  namespace.icons.movieClapper = (function() {
    const d = "M4 15s1-1 4-1 5 2 5 2 4-1 4-1M4 15v-1a3 3 0 013-3h10a3 3 0 013 3v1m-12 0a4 4 0 014-4h0a4 4 0 014 4m-8 1v1a3 3 0 003 3h10a3 3 0 003-3v-1";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 📐 Presets / Ruler
  namespace.icons.ruler = (function() {
    const d = "M2 12h20M2 12l5-5m-5 5l5 5M12 2v20M12 2l5 5m-5-5l-5 5";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 📋 Call Sheet / Clipboard
  namespace.icons.clipboard = (function() {
    const d = "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 📕 Book / PDF
  namespace.icons.book = (function() {
    const d = "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 17a2.5 2.5 0 015 0h11.5A2.5 2.5 0 0020 14.5v-1A2.5 2.5 0 0017.5 11h-2.5a2.5 2.5 0 00-5 0v1H6.5a2.5 2.5 0 01-2.5-2.5v-1.8a2.5 2.5 0 012.5-2.5h15.5a2.5 2.5 0 002.5-2.5v-1A2.5 2.5 0 0020 2.5H6.5a2.5 2.5 0 00-2.5 2.5V11h-2.5A2.5 2.5 0 004 13.5v1.8z";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 🔽 Down Chevron
  namespace.icons.chevronDown = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  })();

  // 🗑️ Trash / Delete
  namespace.icons.trash = (function() {
    const d = "M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // ✉ Email
  namespace.icons.email = (function() {
    const d = "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 📞 Phone
  namespace.icons.phone = (function() {
    const d = "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.17-1.18a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // ➕ Add / Plus
  namespace.icons.plus = (function() {
    const d = "M12 5v14M5 12h14";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="${d}"></polyline></svg>`;
  })();

  // 📊 Dashboard / Layout
  namespace.icons.dashboard = (function() {
    const d = "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`;
  })();

  // 🔍 Search / Magnifying Glass
  namespace.icons.search = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
  })();

  // ✓ Checkmark
  namespace.icons.check = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  })();

  // ≡ Menu / List
  namespace.icons.menu = (function() {
    const d = "M3 12h18M3 6h18M3 18h18";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="${d}"></polyline></svg>`;
  })();

  // 🔄 Refresh / Reload
  namespace.icons.refresh = (function() {
    const d = "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15M23 20v-6h-6";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="${d}"></polyline></svg>`;
  })();

  // ⚡ Lightning / Performance
  namespace.icons.lightning = (function() {
    const d = "M13 2L3 14h9l-1 8 10-12h-9l1-8z";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // ❌ Error / Alert
  namespace.icons.alert = (function() {
    const d = "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01";
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
  })();

  // 🖨️ Printer
  namespace.icons.printer = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;
  })();

  // 📁 Folder
  namespace.icons.folder = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"></path></svg>`;
  })();

  // 🌐 Globe
  namespace.icons.globe = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></path></svg>`;
  })();

  // ☁️⬇ Cloud Download
  namespace.icons.cloudDownload = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 17 12 21 16 17"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"></path></svg>`;
  })();

  // 💾 Save / Floppy
  namespace.icons.save = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
  })();

  // 🎨 Palette
  namespace.icons.palette = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1"></circle><circle cx="17.5" cy="10.5" r="1"></circle><circle cx="8.5" cy="7.5" r="1"></circle><circle cx="6.5" cy="12.5" r="1"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>`;
  })();

  // 🤖 CPU / AI
  namespace.icons.cpu = (function() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`;
  })();

})();
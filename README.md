# mooBugetTool

/* ==========================================================================
   mBT STUDIO MAINTENANCE GUIDE
==========================================================================

  STRICT INTEGRITY RULE: 
   This is an open-ended codebase often processed in partial snippets. 
   NEVER remove, prune, or "optimize out" functions, variables, or logic 
   paths simply because they are not currently invoked in a specific view. 
   An uncalled function is a vital component for an interconnected module.
   Failure to respect this results in "Zombie Logic" and system crashes.

   WHAT ARE ENGINES?
   Engines are the power plants of the application. They are central hubs 
   that perform heavy processing. Other parts of the code send raw data 
   to an Engine, and the Engine returns a processed result.

   CORE APPLICATION ENGINES:
   - mBTLE: The Logic Engine. Handles math, currency, and reconciliation.
   - mBTOG: Open Gate. The industry-standard rate and contact database.
   - mBTPublisher: The Document Engine. Interprets data into PDF/XLSX.
   - mBTME: Modal Engine. Orchestrates every window and overlay.
   - mBTStorage: The Memory Engine. Handles LocalForage and persistence.

   DEPENDENCY HIERARCHY (The Smart Home Analogy)
   Logic must be placed in the correct layer to ensure "Fuel" and "Power"
   are available before a feature tries to use them.

   TIER 1: THE FOUNDATION (Environment Configuration)
   - Core constants, currency definitions, and SVG libraries.
   - Establishes the "physics" of the application.

   TIER 2: THE FUEL TANK (State & Storage)
   - mBTStorage hydration and the state proxy governor.
   - Provides the raw material (data) for the application.

   TIER 3: THE CIRCUIT BREAKER (Core Logic Engines)
   - mBTLE and mBTOG. The "Brains" that decide how data is processed.
   - Must be ready before any UI elements are generated.

   TIER 4: THE INTERIOR (Atomic Render Pipeline)
   - RenderEngine generators for rows, buttons, and components.
   - Small HTML fragments built directly from engine outputs.

   TIER 5: THE SMART FEATURES (Module Controllers & Switchboard)
   - mBTDB (Studio), mBTPublisher (Forms), and the AI Suite.
   - Includes the Switchboard (the wiring) connecting buttons to engines.

   TIER 6: THE IGNITION (Async Boot)
   - The final initialization. This turns the power on for the system.
   - Must always remain at the absolute bottom of the file.

==========================================================================
   DEVELOPER CONSTRAINTS & OPERATIONAL PROTOCOL
==========================================================================

UI/UX VOCABULARY PROTOCOL:
   - Single-Word Priority: Prefer distinct, single-word labels for UI elements whenever possible
     (e.g., 'Profile' > 'Digital Profile', 'Import' > 'Native Import').
   - Efficiency Over Flourish: Avoid "tryhard" adjectives. Do not decorate nouns unless strictly 
     required for disambiguation (e.g., distinguishing 'Export PDF' from 'Export CSV').
   - Direct Action: Labels must describe the core object or action immediately.
 
  NOTE STYLES:
   - Engines: /* =========  v[original#] Name: Description v[latest#] ========= */
   - Features: /* --- [Feat#]. Title (Details) --- */
   - Sub-features: // --- Detail - description ---

   FORBIDDEN NOTES VOCABULARY:
   No words like: Update, Fix, Reversed, Changed, Cleaned or quirky ai sounding phrases.
   Comments must strictly provide real descriptions of function and logic.
   No use of brackets.
   Keep original notes and titles for  adding expanded notes to note/title end.

   SECURITY PROTOCOL:
   - XSS Prevention: Every user-generated string must pass through 
     sanitization logic before rendering to the DOM.
   - Credentials: No API keys are to be hardcoded. Keys must be 
     retrieved from browser localStorage.

==========================================================================
   mBT MANIFEST
==========================================================================
   - TIER 1: CONFIGURATION AND ASSETS
   - TIER 2: STATE PROXY AND LOCALFORAGE STORAGE
   - TIER 3: mBTLE MATH ENGINE AND INDUSTRY DATABASE
   - TIER 4: ATOMIC RENDER PIPELINE
   - TIER 5: MODULE CONTROLLERS AND SWITCHBOARD BRIDGE
   - TIER 6: SYSTEM IGNITION
========================================================================== 
*/

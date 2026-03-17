/* ========= v1.0 AI Suite Configuration v2.0 ========= */
(function () {
    'use strict';

    window.mBTAIConfig = {
        PROVIDER: {
            ENABLED: true,
            /* --- API key retrieved from localStorage per security protocol --- */
            get LLM_API_URL() { return localStorage.getItem('mbt_ai_endpoint') || 'http://localhost:1234/v1/chat/completions'; },
            get LLM_API_KEY() { return localStorage.getItem('mbt_ai_api_key') || ''; },
            MODEL: 'local-model',
            MAX_TOKENS: 4096,
            TEMPERATURE: 0.7
        },
        CONTEXT: {
            ANALYZE_BUDGETS: true,
            SUGGEST_CATEGORIES: true,
            PATTERN_RECOGNITION: true,
            RISK_ASSESSMENT: true,
            AUTO_ANALYZE_THRESHOLD: 5
        },
        ASSISTANT: {
            NAME: 'mBT Assistant',
            GREETING: "Ready. Commands: budget, forecast, risk, suggest, patterns, executive",
            COMMANDS: {
                budget:    'Analyze current budget allocation',
                forecast:  'Generate budget forecast',
                risk:      'Assess budget risks',
                suggest:   'Suggest cost-saving opportunities',
                patterns:  'Detect spending patterns',
                executive: 'Generate executive summary',
                help:      'Show available commands'
            }
        }
    };

    console.log('[mBT] AI config initialized ✓');
})();

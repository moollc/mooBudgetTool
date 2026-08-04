/**
 * OpenGate Public API Wrapper
 * Foundation for external integration and rate voting.
 */
var mBTOGAPI = (function() {
    return {
        getRates: function(query) {
            if (typeof mBTOG === 'undefined') return Promise.reject("OpenGate Engine not loaded");
            // Integration bridge to core OpenGate search
            return Promise.resolve(mBTOG.search ? mBTOG.search(query) : []);
        },
        
        submitVote: function(rateId, typeStr) {
            if (typeof mBTOG === 'undefined' || !mBTOG.upsertVote) return Promise.reject("OpenGate Engine not loaded");
            
            if (typeof rateId === 'string' && isNaN(parseInt(rateId, 10))) {
                if (typeof mBTME !== 'undefined' && mBTME.alert) mBTME.alert("OpenGate", "Cannot vote on local or legacy rate. Ensure community rates are synced.");
                return Promise.resolve({ success: false, message: "Invalid ID for voting." });
            }

            var voteVal = typeStr === 'approve' ? 1 : -1;

            return mBTOG.upsertVote(parseInt(rateId, 10), voteVal).then(function(success) {
                if(success) {
                    if (typeof mBTME !== 'undefined' && mBTME.alert) mBTME.alert("OpenGate", "Vote recorded. Thank you for calibrating the database.");
                    return { success: true, message: "Vote registered." };
                } else {
                    if (typeof mBTME !== 'undefined' && mBTME.alert) mBTME.alert("OpenGate", "Vote failed. Please ensure you are signed in via the Cloud tab.");
                    return { success: false, message: "Sign-in required or network error." };
                }
            });
        },
        
        validateRate: function(rateData) {
            // Placeholder for rate validation logic
            return true;
        }
    };
})();

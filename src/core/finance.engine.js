/**
 * © 2026 Jayson Moo-Young <jayson.m.y@gmail.com>
 * Part of the mBT (Moo Budget Tool) Ecosystem.
 * License: MIT
 */

/* mBT Phase 80: Finance Engine — Wallet Bridge
   Payment entry point moved to Contacts microservice (Wallet tab).
   Direct item.actual writes removed — Phase 77 actuals engine owns that field.
   Both methods below are stubs that redirect to the correct flow. */

window.mBT_Finance_Engine = {

    /* Payments are initiated from the Contacts tool Wallet view, not from line items. */
    openModal: function(itemId) {
        mBTME.alert('Use Wallet', 'Payments are now processed via the Contacts tool. Open the Contacts tool, find your vendor, and use the Wallet panel to issue payment against an open PO.');
    },

    /* Stub — payment processing handled inside Contacts iframe via update-ledgers postMessage. */
    processPayment: function(poId) {
        mBTME.alert('Use Wallet', 'Payments are now processed via the Contacts tool Wallet panel.');
    }

};

/* mBT Phase 47: Extracted Finance Engine */
window.mBT_Finance_Engine = {
        openModal: function(itemId) {
            // 1. Locate Context
            let item = null;
            let sectionName = null;
            
            // Scan budget to find the specific line item
            Object.entries(budget.sections).forEach(([secName, sec]) => {
                const found = sec.items.find(i => i.id === itemId);
                if (found) { item = found; sectionName = secName; }
            });

            if (!item) return mBTME.alert("Error", "Line item not found.");

            // 2. Calculate Balance
            const est = parseFloat(item.total) || 0;
            const act = parseFloat(item.actual) || 0;
            const balance = est - act;
            const contactName = item.crew?.name || item.description;

            // 3. Render
            // Uses Tier 4 Render Engine template we added in Phase 3
            const content = mBT.ui.render.paymentModal(itemId, contactName, balance, displayCurrency);
            mBTME.open('payment', 'Issue Payment', content, 'max-w-sm', { hideHeader: true, noPadding: true });
            
            // 4. Focus Input
            setTimeout(() => {
                const input = document.getElementById('payAmount');
                if(input) input.focus();
            }, 50);
        },

        processPayment: function(itemId) {
            // 1. Capture Inputs
            const amountEl = document.getElementById('payAmount');
            const serviceEl = document.getElementById('payService');
            const dateEl = document.getElementById('payDate');
            
            const amount = parseFloat(amountEl.value);
            const serviceId = serviceEl.value;
            const date = dateEl.value;

            if (!amount || amount <= 0) return mBTME.alert("Error", "Valid amount required.");

            // 2. Update Budget (Local)
            let item = null;
            Object.values(budget.sections).forEach(sec => {
                if(!item) item = sec.items.find(i => i.id === itemId);
            });

            if (item) {
                const currentActual = parseFloat(item.actual) || 0;
                item.actual = currentActual + amount;
                
                // 3. Update Global History (Persistence)
                // We link via Name/Role because IDs might be transient across projects, 
                // but if we have a linked global ID, we use that.
                if (item.crew && item.crew.name) {
                    const globalContact = mBTOG.contacts.find(c => 
                        c.name.toLowerCase() === item.crew.name.toLowerCase()
                    );
                    
                    if (globalContact) {
                        if (!globalContact.payments) globalContact.payments = [];
                        globalContact.payments.push({
                            projectId: budget.projectName,
                            date: date,
                            amount: amount,
                            currency: displayCurrency,
                            service: serviceId,
                            description: item.description
                        });
                        mBTOG.saveContacts(); // Persist to Global DB
                    }
                }

                // 4. Save & Feedback
                mBTLE.reconcile(); // Recalculate Totals
                saveBudget();      // Persist Project
                mBT.ui.paint();    // Update UI Row
                
                mBTME.close('paymentModal');
                mBTME.alert("Success", `Payment of ${mBTLE.format.currency(amount)} logged.`);
            } else {
                mBTME.alert("Error", "Item reference lost.");
            }
        }
    };
};

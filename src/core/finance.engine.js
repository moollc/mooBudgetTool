/* mBT Phase 47: Extracted Finance Engine */
window.mBT_Finance_Engine = {
        openModal: function(itemId) {
            // 1. Locate Context
            var item = null;
            var sectionName = null;
            
            // Scan budget to find the specific line item
            Object.entries(budget.sections).forEach(function(entry) {
                var found = entry[1].items.find(function(i) { return i.id === itemId; });
                if (found) { item = found; sectionName = entry[0]; }
            });

            if (!item) return mBTME.alert("Error", "Line item not found.");

            // 2. Calculate Balance
            var est = parseFloat(item.total) || 0;
            var act = parseFloat(item.actual) || 0;
            var balance = est - act;
            var contactName = (item.crew && item.crew.name) ? item.crew.name : item.description;

            // 3. Render
            var content = mBT.ui.render.paymentModal(itemId, contactName, balance, displayCurrency);
            mBTME.open('payment', 'Issue Payment', content, 'max-w-sm', { hideHeader: true, noPadding: true });
            
            // 4. Focus Input
            setTimeout(function() {
                var input = document.getElementById('payAmount');
                if(input) input.focus();
            }, 50);
        },

        processPayment: function(itemId) {
            // 1. Capture Inputs
            var amountEl = document.getElementById('payAmount');
            var serviceEl = document.getElementById('payService');
            var dateEl = document.getElementById('payDate');
            
            var amount = parseFloat(amountEl.value);
            var serviceId = serviceEl.value;
            var date = dateEl.value;

            if (!amount || amount <= 0) return mBTME.alert("Error", "Valid amount required.");

            // 2. Update Budget (Local)
            var item = null;
            Object.values(budget.sections).forEach(function(sec) {
                if(!item) item = sec.items.find(function(i) { return i.id === itemId; });
            });

            if (item) {
                var currentActual = parseFloat(item.actual) || 0;
                item.actual = currentActual + amount;
                
                // 3. Update Global History (Persistence)
                if (item.crew && item.crew.name) {
                    var globalContact = mBTOG.contacts.find(function(c) { 
                        return c.name.toLowerCase() === item.crew.name.toLowerCase();
                    });
                    
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
                        mBTOG.saveContacts();
                    }
                }

                // 4. Save & Feedback
                mBTLE.reconcile();
                saveBudget();
                mBT.ui.paint();
                
                mBTME.close('paymentModal');
                mBTME.alert("Success", "Payment of " + mBTLE.format.currency(amount) + " logged.");
            } else {
                mBTME.alert("Error", "Item reference lost.");
            }
        }
    };

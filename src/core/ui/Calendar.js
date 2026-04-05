/*
 * Component: Calendar (Temporal Projections)
 * Lifecycle: render [NO] | update [YES] | bindEvents [NO] | init [NO]
 * Description: Reads timeline/risk from mBTStagesEngine; updates date-range
 *              DOM elements and delivery date border color.
 */
(function (window) {
    'use strict';
    window.mBT = window.mBT || {};
    window.mBT.ui = window.mBT.ui || {};

    window.mBT.ui.calendar = {
        update: function () {
            if (!window.budget || !window.mBTStagesEngine) return;

            var timeline = window.mBTStagesEngine.calculateTimeline();
            var metrics = window.mBTStagesEngine.getMetrics();
            var risk = window.mBTStagesEngine.analyzeRisk(metrics, timeline);

            // 1. Delivery date input border coloring (timeline status drives color)
            var deliveryInput = document.querySelector('input[onchange*="budget.deliveryDate"]');
            if (deliveryInput) {
                var timeStatus = (timeline._analysis) ? timeline._analysis.status : null;
                deliveryInput.classList.remove('border-slate-700', 'border-rose-500', 'border-amber-500', 'border-emerald-500');
                if (timeStatus === 'OVERDUE' || (risk && risk.status === 'CRITICAL')) {
                    deliveryInput.classList.add('border-rose-500');
                } else if (timeStatus === 'Tight' || (risk && risk.status === 'WARNING')) {
                    deliveryInput.classList.add('border-amber-500');
                } else {
                    deliveryInput.classList.add('border-slate-700');
                }
            }

            // 2. Stage date-range label updates
            var keys = ['dev', 'pre', 'prod', 'post', 'dist'];
            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                var el = document.getElementById('date-range-' + k);
                var validation = window.mBTStagesEngine.validateTimeline(k);
                if (el) {
                    if (validation.isBankrupt) {
                        el.innerText = 'TIME BANKRUPTCY';
                        el.className = 'text-[9px] font-black text-red-600 animate-pulse bg-red-50 px-2 rounded mt-0.5 tracking-tight';
                    } else {
                        el.innerText = timeline[k] ? timeline[k].label : '';
                        el.className = 'text-[8px] font-bold text-slate-400 mt-0.5 tracking-tight';
                    }
                }
            }
        }
    };
})(window);

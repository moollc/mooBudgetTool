                const analysis = mBT.features.cortex.logic.analyze();
                const fmt = mBTLE.format.currency;
                
                // --- Widget 1: Burn Rate KPI (Compact) ---
                // Visual logic: Green if <80%, Yellow <100%, Red >100%
                const burnRate = analysis.financials.burnRate;
                let burnColor = 'text-slate-800';
                if(burnRate > 100) burnColor = 'text-rose-600';
                else if(burnRate > 80) burnColor = 'text-amber-500';

                const burnWidget = `
                    <div class="col-span-1 md:col-span-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full flex flex-col justify-center items-center text-center">
                        <div class="text-[9px] font-black uppercase text-slate-300 mb-2 tracking-widest">Burn Rate</div>
                        <span class="text-3xl font-black ${burnColor} tracking-tighter">${burnRate.toFixed(1)}%</span>
                        <span class="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-wider">of budget</span>
                    </div>`;

                // --- Widget 2: Cost Drivers (List) ---
                const renderBar = (label, val, max, colorClass, subText) => {
                    const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
                    return `
                    <div class="mb-3">
                        <div class="flex justify-between text-[9px] font-black uppercase text-slate-500 mb-1">
                            <span class="truncate pr-2" title="${RenderEngine.esc(label)}">${RenderEngine.esc(label)}</span>
                            <span>${fmt(val)}</span>
                        </div>
                        <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full ${colorClass}" style="width: ${pct}%"></div>
                        </div>
                        ${subText ? `<div class="text-[8px] text-slate-400 font-mono mt-0.5 text-right">${subText}</div>` : ''}
                    </div>`;
                };

                const maxCost = analysis.financials.topCosts.length ? analysis.financials.topCosts[0].est : 1;
                const financialsWidget = `
                    <div class="col-span-1 md:col-span-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm h-full overflow-y-auto no-scrollbar">
                        <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-2">Cost Drivers</h4>
                        
                        <div class="mb-6">
                            ${analysis.financials.topCosts.length ? analysis.financials.topCosts.map(i => renderBar(i.description, i.est, maxCost, 'bg-blue-600')).join('') : '<div class="text-[9px] text-slate-300 italic">No data</div>'}
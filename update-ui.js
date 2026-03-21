const fs = require('fs');
let html = fs.readFileSync('./index.html', 'utf8');

const startStr = '<!-- Primary Metrics Group (Est, Actual, Subtotal) -->';
const endStr = '<!-- Funding Tracker (Phase 44.3) -->';

const start = html.indexOf(startStr);
const end = html.indexOf(endStr, start);

if (start !== -1 && end !== -1) {
    const newContent = `<!-- Primary Metrics Group (Est, Actual) -->
            <div class="flex flex-wrap gap-2 items-stretch">
                <div class="flex-[10_1_240px] bg-blue-600 text-white px-5 py-2.5 rounded-2xl shadow-xl flex flex-col justify-center relative overflow-hidden group min-h-[60px]">
                    <div class="absolute -right-4 -top-4 opacity-10 transition-transform group-hover:scale-110 duration-700">\${mBTAssets.money}</div>
                    <p class="text-[11px] font-black uppercase tracking-widest text-blue-200 mb-0.5">Estimated Grand Total</p>
                    <p id="summaryGrandTotal" class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter truncate w-full">--</p>
                </div>
                <div class="flex-[10_1_240px] bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-xl flex flex-col justify-center relative overflow-hidden group min-h-[60px]">
                    <p class="text-[11px] font-black uppercase tracking-widest text-emerald-200 mb-0.5">Actual Expenditure</p>
                    <p id="summaryActualTotal" class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter truncate w-full">--</p>
                </div>
            </div>

            <!-- Adjustments Group (Subtotal, Discount, Contingency, Tax) -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 items-stretch">
                <div class="px-4 py-1 border border-slate-900 bg-slate-900 rounded-2xl shadow-md flex flex-col justify-center min-h-[52px]">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Project Subtotal</p>
                    <p id="summarySubtotal" class="text-sm sm:text-base font-black text-white leading-tight truncate w-full">--</p>
                </div>
                <div class="flex-1 px-3 py-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[52px]">
                    <div class="flex items-center gap-2 mb-1">
                        <div class="flex items-center bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0">
                            <input type="number" step="0.1" id="discountPercentage" value="\${budget.discountPercentage || 0}" class="w-7 text-right text-[10px] font-black text-blue-600 bg-transparent outline-none">
                            <span class="text-[9px] font-black text-slate-300 ml-0.5">%</span>
                        </div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Discount</label>
                    </div>
                    <p id="summaryDiscount" class="text-sm sm:text-base font-black text-slate-800 leading-tight ml-1 truncate">--</p>
                </div>
                <div class="flex-1 px-3 py-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[52px]">
                    <div class="flex items-center gap-2 mb-1">
                        <div class="flex items-center bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0">
                            <input type="number" step="0.1" id="contingencyPercentage" value="\${budget.contingencyPercentage}" class="w-7 text-right text-[10px] font-black text-blue-600 bg-transparent outline-none">
                            <span class="text-[9px] font-black text-slate-300 ml-0.5">%</span>
                        </div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Contingency</label>
                    </div>
                    <p id="summaryContingency" class="text-sm sm:text-base font-black text-slate-800 leading-tight ml-1 truncate">--</p>
                </div>
                <div class="flex-1 px-3 py-1 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[52px]">
                    <div class="flex items-center gap-2 mb-1">
                        <div class="flex items-center bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100 shrink-0">
                            <input type="number" step="0.1" id="salesTaxPercentage" value="\${budget.salesTaxPercentage}" class="w-7 text-right text-[10px] font-black text-blue-600 bg-transparent outline-none">
                            <span class="text-[9px] font-black text-slate-300 ml-0.5">%</span>
                        </div>
                        <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Sales Tax</label>
                    </div>
                    <p id="summaryTax" class="text-sm sm:text-base font-black text-slate-800 leading-tight ml-1 truncate">--</p>
                </div>
            </div>

            <!-- Daily Burn -->
            <div class="px-4 py-2 bg-gradient-to-r from-rose-50 to-white rounded-2xl border border-rose-100 shadow-sm flex flex-row items-center justify-between min-h-[52px]">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center bg-rose-100 w-10 h-10 rounded-xl shrink-0 text-rose-500 shadow-sm">
                        \${mBTAssets.fire}
                    </div>
                    <div>
                        <label class="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-0.5">Daily Burn</label>
                        <p class="text-[8px] text-slate-400 font-bold leading-tight uppercase tracking-widest sm:line-clamp-1 max-w-[100px] truncate sm:max-w-none">Average per shooting segment</p>
                    </div>
                </div>
                <p id="summaryBurn" class="text-lg sm:text-xl font-black text-rose-600 leading-tight w-24 text-right">--</p>
            </div>
        </div>

        `;

    html = html.slice(0, start) + newContent + html.slice(end);
    fs.writeFileSync('./index.html', html);
    console.log('UI Updated successfully!');
} else {
    console.log('Could not find start/end markers.');
}

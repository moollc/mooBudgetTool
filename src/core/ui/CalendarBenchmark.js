/* ========= mBTCalendar: Production Calendar Benchmark Component ========= */
(function (window) {
    'use strict';

    var dom = document; /* benchmark tool runs in standard document context */

    var mBTCalendar = (function () {
        var state = {
            projectKey: null,
            budget: null,
            milestones: []  /* [{ id, date, title, note }] */
        };

        var STAGE_CONFIG = [
            { key: 'dev',  label: 'Development',     color: '#6366f1', text: '#fff' },
            { key: 'pre',  label: 'Pre-Production',   color: '#3b82f6', text: '#fff' },
            { key: 'prod', label: 'Production',        color: '#10b981', text: '#fff' },
            { key: 'post', label: 'Post-Production',   color: '#f59e0b', text: '#1e293b' },
            { key: 'dist', label: 'Distribution',      color: '#ec4899', text: '#fff' }
        ];

        function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

        function fmtDate(d) {
            if (!d) return '—';
            if (typeof d === 'string') { d = parseDate(d); }
            return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
        }

        function parseDate(str) {
            /* Timezone-safe parse for YYYY-MM-DD strings */
            var d = new Date(str);
            d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
            return d;
        }

        function dateToICS(d) {
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + m + day;
        }

        /* --- Phase 109.1: Weekend-skipping helper -- mirrors Stages tool addWorkDays --- */
        /* Day-by-day; counts only non-weekend per workWeek 5/6/7. Supports negative days (backward). No blackouts in v1. */
        function addWorkDays(startDate, days, workWeek) {
            var date = new Date(startDate);
            var step = days < 0 ? -1 : 1;
            var target = days < 0 ? -days : days;
            var count = 0;
            while (count < target) {
                date.setDate(date.getDate() + step);
                var dow = date.getDay();
                var isWeekend = (workWeek <= 5 && (dow === 0 || dow === 6)) || (workWeek === 6 && dow === 0);
                if (!isWeekend) count++;
            }
            return date;
        }

        /* --- Compute payable working days over true [start, end) span --- */
        function computeWorkingDays(startDate, endDate, workWeek, blackouts) {
            var calendarDays = Math.round((endDate - startDate) / 86400000);
            if (calendarDays < 0) calendarDays = 0;
            if (!workWeek || workWeek >= 7) return calendarDays;
            var working = 0;
            var cursor = new Date(startDate);
            while (cursor < endDate) {
                var dow = cursor.getDay();
                var dateStr = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0') + '-' + String(cursor.getDate()).padStart(2, '0');
                var isWeekend = (workWeek <= 5 && (dow === 0 || dow === 6)) ||
                                (workWeek === 6 && dow === 0);
                var isBlackout = blackouts && blackouts.indexOf(dateStr) > -1;
                if (!isWeekend && !isBlackout) working++;
                cursor.setDate(cursor.getDate() + 1);
            }
            return working;
        }

        /* --- Build timeline with overlapping stage support --- */
        function calcTimeline(budget) {
            if (!budget || !budget.startDate) return null;
            var cursor = parseDate(budget.startDate);
            var result = [];
            var workWeek = (budget.settings && budget.settings.workWeek) || 5;
            var blackouts = budget.blackoutDays || [];
            var prevStart = null;

            STAGE_CONFIG.forEach(function (sc) {
                var days = 0;
                var stageData = null;
                if (budget.targetLock && budget.targetLock.stages && budget.targetLock.stages[sc.key]) {
                    stageData = budget.targetLock.stages[sc.key];
                    days = parseFloat(stageData.days) || 0;
                }

                /* --- Overlapping stage offset: only when user explicitly set offsetDays --- */
                /* When workWeek < 7, offsetDays = N working days after prev start (reuse addWorkDays). */
                var offset = (stageData && stageData.offsetDays !== undefined)
                    ? parseFloat(stageData.offsetDays) : null;
                if (offset !== null && prevStart) {
                    if (workWeek < 7) {
                        cursor = addWorkDays(prevStart, offset, workWeek);
                    } else {
                        cursor = new Date(prevStart);
                        cursor.setDate(cursor.getDate() + offset);
                    }
                }

                var start = new Date(cursor);
                prevStart = new Date(start);
                /* Work-week duration when workWeek < 7; calendar add otherwise (match Stages) */
                var end;
                if (days > 0 && workWeek < 7) {
                    end = addWorkDays(start, days, workWeek);
                } else {
                    end = new Date(start);
                    end.setDate(end.getDate() + days);
                }
                cursor = new Date(end);
                var workingDays = computeWorkingDays(start, end, workWeek, blackouts);

                result.push({ key: sc.key, label: sc.label, color: sc.color, text: sc.text, start: start, end: end, days: days, workingDays: workingDays });
            });
            return result;
        }

        /* --- Minimum offsetDays so a stage cannot start before budget.startDate --- */
        function getMinStageOffset(budget, stageKey) {
            if (!budget || !budget.startDate) return 0;
            var stageIdx = -1;
            for (var i = 0; i < STAGE_CONFIG.length; i++) {
                if (STAGE_CONFIG[i].key === stageKey) { stageIdx = i; break; }
            }
            if (stageIdx <= 0) return 0;

            var timeline = calcTimeline(budget);
            if (!timeline || !timeline[stageIdx - 1]) return 0;

            var projectStart = parseDate(budget.startDate);
            var prevStart = timeline[stageIdx - 1].start;
            return Math.ceil((projectStart - prevStart) / 86400000);
        }

        /* --- Gantt 2.0: Date-scaled pixel-per-day rendering --- */
        var GANTT_PPD = 8; /* pixels per day - minimum readable scale */
        var GANTT_BAR_MIN = 36; /* min bar width (px): 10px padding each side + 9px uppercase label */
        var GANTT_ROW_H = 36;
        var GANTT_BAR_H = 28;
        var GANTT_BAR_TOP = Math.floor((GANTT_ROW_H - GANTT_BAR_H) / 2);
        /* Soft cap on idle gap before a bar (cosmetic only; bar width stays true-scale) */
        var GANTT_GAP_CAP_PX = 96; /* ~12 days at GANTT_PPD=8: full scale up to here */
        var GANTT_GAP_EXCESS_RATIO = 0.25; /* beyond cap, gap pixels render at 25% rate */

        /* Compress long idle gaps only. Short gaps unchanged; duration width never uses this. */
        function compressGapPixels(rawGapPx) {
            if (rawGapPx <= GANTT_GAP_CAP_PX) return rawGapPx;
            return GANTT_GAP_CAP_PX + (rawGapPx - GANTT_GAP_CAP_PX) * GANTT_GAP_EXCESS_RATIO;
        }

        /* True project span: min start / max end across active stages (handles negative offsets) */
        function getTimelineBounds(timeline) {
            var start = null;
            var end = null;
            timeline.forEach(function (t) {
                if (t.days === 0) return;
                if (start === null || t.start < start) start = t.start;
                if (end === null || t.end > end) end = t.end;
            });
            if (start === null) {
                start = timeline[0].start;
                end = timeline[timeline.length - 1].end;
            }
            return { start: start, end: end };
        }

        function renderGantt(timeline) {
            var totalDays = timeline.reduce(function (s, t) { return s + t.days; }, 0);
            if (totalDays === 0) {
                dom.getElementById('gantt-chart').innerHTML = '<p class="text-[10px] text-slate-400 italic">Set stage days in the Stages tool to see the timeline.</p>';
                return;
            }

            /* Calculate project date range for axis */
            var bounds = getTimelineBounds(timeline);
            var projectStart = bounds.start;
            var projectEnd = bounds.end;
            var totalSpanDays = Math.ceil((projectEnd - projectStart) / 86400000);
            if (totalSpanDays < 1) totalSpanDays = totalDays;
            var chartWidth = totalSpanDays * GANTT_PPD;

            var html = '';
            timeline.forEach(function (t) {
                if (t.days === 0) return;
                /* Bar width from calendar span (work-day units can span more calendar days) */
                var spanDays = Math.ceil((t.end - t.start) / 86400000);
                if (spanDays < 1) spanDays = 1;
                var barWidth = Math.max(GANTT_BAR_MIN, spanDays * GANTT_PPD);
                var offsetDays = Math.ceil((t.start - projectStart) / 86400000);
                var rawGapPx = offsetDays * GANTT_PPD;
                var barLeft = compressGapPixels(rawGapPx);
                var dayLabel = t.days + 'd';
                /* Side column is narrow (w-24): short fragment only (Pre / Post). Watermark spans the full chart strip: use full stage label. */
                var stageName = esc(t.label.split('-')[0].trim());
                var stageWatermarkLabel = esc(t.label);
                /* Watermark z:0 under idle (z:1) and bar (z:2); semi-transparent idle darkens text via normal compositing */
                var stageWatermark = '<div class="gantt-stage-watermark" aria-hidden="true">' + stageWatermarkLabel + '</div>';
                var idleHighlight = barLeft > 0
                    ? '<div style="position:absolute;left:0;top:' + GANTT_BAR_TOP + 'px;width:' + barLeft + 'px;height:' + GANTT_BAR_H + 'px;background:rgba(148,163,184,0.18);z-index:1;"></div>'
                    : '';

                html += '<div class="flex items-center gap-2">' +
                    '<div class="gantt-label w-24 text-[8px] font-black text-slate-500 uppercase tracking-widest text-right shrink-0">' + stageName + '</div>' +
                    '<div class="flex-1 relative" style="min-width:0;overflow-x:auto;overflow-y:hidden;">' +
                        '<div style="position:relative;width:' + chartWidth + 'px;min-width:100%;height:' + GANTT_ROW_H + 'px;">' +
                            stageWatermark +
                            idleHighlight +
                            '<div class="gantt-bar" style="position:absolute;left:' + barLeft + 'px;top:' + GANTT_BAR_TOP + 'px;width:' + barWidth + 'px;background:' + t.color + ';color:' + t.text + ';z-index:2;">' +
                                dayLabel +
                            '</div>' +
                            _renderMilestoneMarkers(t.start, t.end, projectStart, timeline) +
                        '</div>' +
                    '</div>' +
                    '<div class="gantt-date text-[8px] text-slate-400 shrink-0 w-20 text-right">' + fmtDate(t.start) + '</div>' +
                '</div>';
            });
            dom.getElementById('gantt-chart').innerHTML = html;

            renderAxis(projectStart, projectEnd, chartWidth);
        }

        /* --- Render milestone diamond markers within a stage's horizontal span --- */
        function _renderMilestoneMarkers(stageStart, stageEnd, projectStart, timeline) {
            var markers = '';
            var resolved = resolveMilestones(timeline);
            resolved.forEach(function (m) {
                if (!m.date) return;
                var mDate = parseDate(m.date);
                if (mDate >= stageStart && mDate <= stageEnd) {
                    var offsetDays = Math.ceil((mDate - projectStart) / 86400000);
                    var left = offsetDays * GANTT_PPD;
                    markers += '<div class="gantt-milestone" style="left:' + left + 'px;" title="' + esc(m.title || 'Milestone') + '">' +
                        '<div class="gantt-milestone-tooltip">' + esc(m.title || '') + '</div>' +
                    '</div>';
                }
            });
            return markers;
        }

        /* --- Render month/week tick marks along the date axis --- */
        function renderAxis(start, end, chartWidth) {
            var axisEl = dom.getElementById('gantt-axis');
            if (!start || !end || chartWidth <= 0) { axisEl.innerHTML = ''; return; }

            var html = '<div style="position:relative;width:' + chartWidth + 'px;min-width:100%;height:20px;">';
            var cursor = new Date(start);
            cursor.setDate(1); /* align to month start */
            if (cursor < start) cursor.setMonth(cursor.getMonth() + 1);

            while (cursor <= end) {
                var offsetDays = Math.ceil((cursor - start) / 86400000);
                var left = offsetDays * GANTT_PPD;
                var label = cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                html += '<div style="position:absolute;left:' + left + 'px;top:0;height:100%;border-left:1px solid #cbd5e1;">' +
                    '<span style="position:absolute;top:2px;left:4px;font-size:8px;font-weight:900;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">' + label + '</span>' +
                '</div>';
                cursor.setMonth(cursor.getMonth() + 1);
            }
            html += '</div>';
            axisEl.innerHTML = html;
        }

        /* ========= G21: Monthly Grid View ========= */

        var currentView = 'timeline';

        function setView(view) {
            currentView = view;
            var ganttSection = dom.getElementById('gantt-section');
            var calendarSection = dom.getElementById('calendar-section');
            var btnTimeline = dom.getElementById('btn-view-timeline');
            var btnCalendar = dom.getElementById('btn-view-calendar');

            if (view === 'calendar') {
                ganttSection.classList.add('hidden');
                calendarSection.classList.remove('hidden');
                btnTimeline.className = 'text-[9px] font-black uppercase tracking-widest px-3 py-1.5 transition-colors text-white/60 hover:text-white';
                btnCalendar.className = 'text-[9px] font-black uppercase tracking-widest px-3 py-1.5 transition-colors bg-blue-600 text-white';
                renderCalendarGrid();
            } else {
                ganttSection.classList.remove('hidden');
                calendarSection.classList.add('hidden');
                btnTimeline.className = 'text-[9px] font-black uppercase tracking-widest px-3 py-1.5 transition-colors bg-blue-600 text-white';
                btnCalendar.className = 'text-[9px] font-black uppercase tracking-widest px-3 py-1.5 transition-colors text-white/60 hover:text-white';
            }
            updateScrollAffordance();
        }

        function renderCalendarGrid() {
            var budget = state.budget;
            if (!budget || !budget.startDate) return;
            var timeline = calcTimeline(budget);
            if (!timeline) return;

            var gridEl = dom.getElementById('calendar-grid');
            var totalDays = timeline.reduce(function (s, t) { return s + t.days; }, 0);
            if (totalDays === 0) { gridEl.innerHTML = '<p class="text-[10px] text-slate-400 italic">Set stage days in the Stages tool to see the calendar.</p>'; return; }

            var bounds = getTimelineBounds(timeline);
            var projectStart = bounds.start;
            var projectEnd = bounds.end;
            var blackouts = budget.blackoutDays || [];
            /* workWeek drives weekend hatch only (not blackouts) — same rule as computeWorkingDays / addWorkDays */
            var workWeek = (budget.settings && budget.settings.workWeek) || 5;

            /* Build stage lookup: date string -> stage config */
            var stageMap = {};
            timeline.forEach(function (t) {
                if (t.days === 0) return;
                var d = new Date(t.start);
                while (d < t.end) {
                    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                    stageMap[key] = t;
                    d.setDate(d.getDate() + 1);
                }
            });

            /* Build milestone lookup: date string -> milestone title (resolved) */
            var milestoneMap = {};
            var resolved = resolveMilestones(timeline);
            resolved.forEach(function (m) {
                if (m.date) milestoneMap[m.date] = m.title || 'Milestone';
            });

            /* Group days by month */
            var months = [];
            var cursor = new Date(projectStart);
            cursor.setDate(1);
            while (cursor <= projectEnd) {
                months.push(new Date(cursor));
                cursor.setMonth(cursor.getMonth() + 1);
            }

            var html = '';
            months.forEach(function (monthStart) {
                var year = monthStart.getFullYear();
                var month = monthStart.getMonth();
                var monthName = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                var firstDay = new Date(year, month, 1).getDay(); /* 0=Sun */
                var daysInMonth = new Date(year, month + 1, 0).getDate();

                html += '<div class="mb-6">' +
                    '<div class="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-2">' + esc(monthName) + '</div>' +
                    '<div class="grid grid-cols-7 gap-px bg-slate-200 rounded-lg overflow-hidden">' +
                        /* Day headers */
                        '<div class="bg-slate-100 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">Sun</div>' +
                        '<div class="bg-slate-100 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">Mon</div>' +
                        '<div class="bg-slate-100 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">Tue</div>' +
                        '<div class="bg-slate-100 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">Wed</div>' +
                        '<div class="bg-slate-100 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">Thu</div>' +
                        '<div class="bg-slate-100 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">Fri</div>' +
                        '<div class="bg-slate-100 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest py-1">Sat</div>';

                /* Empty cells before first day */
                for (var e = 0; e < firstDay; e++) {
                    html += '<div class="bg-slate-50 min-h-[48px]"></div>';
                }

                /* Day cells */
                for (var d = 1; d <= daysInMonth; d++) {
                    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
                    var stage = stageMap[dateStr];
                    var isBlackout = blackouts.indexOf(dateStr) > -1;
                    var milestone = milestoneMap[dateStr];
                    var isToday = dateStr === new Date().toISOString().slice(0, 10);
                    /* workWeek weekends only — blackouts stay violet; no blackout in this check */
                    var dow = new Date(year, month, d).getDay();
                    var isNonWorkDay = (workWeek <= 5 && (dow === 0 || dow === 6)) ||
                                       (workWeek === 6 && dow === 0);

                    var cellBg = 'bg-white';
                    var cellStyle = '';
                    if (isBlackout) {
                        cellBg = 'bg-violet-100';
                    } else if (stage) {
                        if (isNonWorkDay) {
                            /* Stage ongoing but not a work day: diagonal hatch in stage hue
                               (solid weekdays use color+'18'; hatch alternates stronger/weaker alpha of same hex) */
                            cellStyle = 'background-color:#fff;background-image:repeating-linear-gradient(45deg,' +
                                stage.color + '30 0 3px,' + stage.color + '0c 3px 8px);';
                        } else {
                            cellStyle = 'background:' + stage.color + '18;';
                        }
                    }

                    var todayRing = isToday ? 'ring-2 ring-blue-500 ring-inset' : '';
                    var dayNum = '<span class="text-[9px] font-bold ' + (isToday ? 'text-blue-600' : 'text-slate-600') + '">' + d + '</span>';
                    var msDot = milestone ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mt-0.5" title="' + esc(milestone) + '"></span>' : '';
                    var stageLabel = stage ? '<span class="text-[6px] font-black uppercase tracking-widest truncate block mt-0.5" style="color:' + stage.color + ';">' + esc(stage.label.split('-')[0].trim()) + '</span>' : '';
                    var blackoutLabel = isBlackout ? '<span class="text-[6px] font-black text-violet-500 uppercase">OFF</span>' : '';

                    html += '<div onclick="mBTCalendar.toggleBlackout(\'' + dateStr + '\')" class="' + cellBg + ' ' + todayRing + ' min-h-[48px] p-1 cursor-pointer hover:brightness-95 transition-all flex flex-col items-center" style="' + cellStyle + '">' +
                        dayNum +
                        msDot +
                        stageLabel +
                        blackoutLabel +
                    '</div>';
                }

                html += '</div></div>';
            });

            gridEl.innerHTML = html;
        }

        function toggleBlackout(dateStr) {
            if (!state.budget) return;
            if (!state.budget.blackoutDays) state.budget.blackoutDays = [];
            var idx = state.budget.blackoutDays.indexOf(dateStr);
            if (idx > -1) {
                state.budget.blackoutDays.splice(idx, 1);
            } else {
                state.budget.blackoutDays.push(dateStr);
            }
            renderCalendarGrid();
            save();
            updateScrollAffordance();
        }

        function renderStageTable(timeline) {
            var html = '';
            timeline.forEach(function (t, idx) {
                var offsetVal = '';
                if (state.budget && state.budget.targetLock && state.budget.targetLock.stages && state.budget.targetLock.stages[t.key]) {
                    var ov = state.budget.targetLock.stages[t.key].offsetDays;
                    if (typeof ov === 'number') offsetVal = ov;
                }
                html += '<tr class="border-b border-slate-50">' +
                    '<td class="py-2 pr-3"><span class="inline-block w-2 h-2 rounded-full mr-2" style="background:' + t.color + ';"></span>' + esc(t.label) + '</td>' +
                    '<td class="py-2 pr-1"><input type="number" min="0" value="' + t.days + '" data-stage="' + t.key + '" onchange="mBTCalendar.updateStageDays(this.dataset.stage, this.value)" class="w-14 px-1 py-0.5 border border-slate-200 rounded text-[10px] font-bold text-center outline-none focus:border-blue-400"></td>' +
                    '<td class="py-2 pr-3 text-slate-400">' + t.workingDays + '</td>' +
                    '<td class="py-2 pr-1">' + (idx > 0 ? '<input type="number" value="' + offsetVal + '" data-stage="' + t.key + '" onchange="mBTCalendar.updateStageOffset(this.dataset.stage, this.value)" placeholder="—" class="w-14 px-1 py-0.5 border border-slate-200 rounded text-[10px] text-center outline-none focus:border-blue-400">' : '<span class="text-slate-300">—</span>') + '</td>' +
                    '<td class="py-2 pr-3 text-slate-500">' + (t.days > 0 ? fmtDate(t.start) : '—') + '</td>' +
                    '<td class="py-2 text-slate-500">' + (t.days > 0 ? fmtDate(t.end) : '—') + '</td>' +
                '</tr>';
            });
            dom.getElementById('stage-table-body').innerHTML = html;
        }

        /* --- Resolve relative milestones to absolute dates using timeline --- */
        function resolveMilestones(timeline) {
            var stageStartMap = {};
            if (timeline) {
                timeline.forEach(function (t) { stageStartMap[t.key] = t.start; });
            }
            return state.milestones.map(function (m) {
                if (m.type === 'relative' && m.stageKey && stageStartMap[m.stageKey]) {
                    var resolved = new Date(stageStartMap[m.stageKey]);
                    resolved.setDate(resolved.getDate() + (parseInt(m.offsetDays) || 0));
                    var y = resolved.getFullYear();
                    var mo = String(resolved.getMonth() + 1).padStart(2, '0');
                    var dy = String(resolved.getDate()).padStart(2, '0');
                    return { id: m.id, title: m.title, date: y + '-' + mo + '-' + dy, type: 'relative', stageKey: m.stageKey, offsetDays: m.offsetDays, _resolved: true };
                }
                return m;
            });
        }

        function renderMilestones() {
            var list = dom.getElementById('milestones-list');
            var empty = dom.getElementById('no-milestones');
            if (!state.milestones.length) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                updateScrollAffordance();
                return;
            }
            empty.classList.add('hidden');

            /* --- Build stage options for relative milestone dropdown --- */
            var stageOpts = '';
            STAGE_CONFIG.forEach(function (sc) {
                stageOpts += '<option value="' + sc.key + '">' + esc(sc.label) + '</option>';
            });

            var timeline = state.budget ? calcTimeline(state.budget) : null;
            var resolved = resolveMilestones(timeline);
            var sorted = resolved.slice().sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });

            var html = '';
            sorted.forEach(function (m) {
                var isRel = m.type === 'relative';
                var origM = state.milestones.find(function (x) { return x.id === m.id; }) || m;

                if (isRel) {
                    html += '<div class="milestone-row" style="grid-template-columns:auto 1fr auto;">' +
                        '<div class="flex items-center gap-1">' +
                            '<select data-id="' + esc(m.id) + '" data-field="stageKey" onchange="mBTCalendar.updateMilestone(this)" class="text-[9px] border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-blue-400">' +
                                STAGE_CONFIG.map(function (sc) { return '<option value="' + sc.key + '"' + (origM.stageKey === sc.key ? ' selected' : '') + '>' + sc.label.split('-')[0].trim() + '</option>'; }).join('') +
                            '</select>' +
                            '<span class="text-[8px] text-slate-400">+</span>' +
                            '<input type="number" min="0" value="' + (origM.offsetDays || 0) + '" data-id="' + esc(m.id) + '" data-field="offsetDays" onchange="mBTCalendar.updateMilestone(this)" class="w-10 text-[10px] border border-slate-200 rounded px-1 py-0.5 text-center outline-none focus:border-blue-400">' +
                            '<span class="text-[8px] text-slate-400">d</span>' +
                            '<span class="text-[8px] text-blue-500 ml-1">' + (m.date ? fmtDate(parseDate(m.date)) : '—') + '</span>' +
                        '</div>' +
                        '<input type="text" value="' + esc(m.title) + '" data-id="' + esc(m.id) + '" data-field="title" onchange="mBTCalendar.updateMilestone(this)" placeholder="Milestone name…" class="text-[10px] text-slate-700 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 w-full">' +
                        '<button data-id="' + esc(m.id) + '" onclick="mBTCalendar.deleteMilestone(this.dataset.id)" class="text-slate-300 hover:text-red-500 transition-colors ml-1" aria-label="Delete milestone">' +
                            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                        '</button>' +
                    '</div>';
                } else {
                    html += '<div class="milestone-row">' +
                        '<input type="date" value="' + esc(m.date) + '" data-id="' + esc(m.id) + '" data-field="date" onchange="mBTCalendar.updateMilestone(this)" class="text-[10px] font-bold text-slate-700 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 w-full">' +
                        '<input type="text" value="' + esc(m.title) + '" data-id="' + esc(m.id) + '" data-field="title" onchange="mBTCalendar.updateMilestone(this)" placeholder="Milestone name…" class="text-[10px] text-slate-700 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-400 w-full">' +
                        '<button data-id="' + esc(m.id) + '" onclick="mBTCalendar.deleteMilestone(this.dataset.id)" class="text-slate-300 hover:text-red-500 transition-colors ml-1" aria-label="Delete milestone">' +
                            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
                        '</button>' +
                    '</div>';
                }
            });
            list.innerHTML = html;
            updateScrollAffordance();
        }

        function save() {
            if (!state.projectKey || !state.budget) return;
            state.budget.calendarNotes = state.milestones;
            localforage.setItem(state.projectKey, state.budget).then(function () {
                /* --- Notify parent to reload calendar data --- */
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ type: 'mbt:tool-action', action: 'calendar-updated', payload: { milestones: state.milestones } }, window.location.origin);
                }
            }).catch(function (e) { console.error('[CAL] save failed', e); });
        }

        function load() {
            var params = new URLSearchParams(window.location.search);
            state.projectKey = params.get('projectKey') || null;

            if (!state.projectKey) {
                dom.getElementById('no-project-msg').classList.remove('hidden');
                var tagNone = dom.getElementById('project-tag');
                tagNone.textContent = 'No Project';
                tagNone.setAttribute('title', 'No Project');
                return;
            }

            localforage.getItem(state.projectKey).then(function (budget) {
                if (!budget) {
                    dom.getElementById('no-project-msg').classList.remove('hidden');
                    var tagMissing = dom.getElementById('project-tag');
                    tagMissing.textContent = 'Not Found';
                    tagMissing.setAttribute('title', 'Not Found');
                    return;
                }
                state.budget = budget;
                state.milestones = budget.calendarNotes || [];

                /* --- Initialize work week selector --- */
                var ww = (budget.settings && budget.settings.workWeek) || 5;
                dom.getElementById('sel-work-week').value = String(ww);

                /* Dismiss skeleton */
                var sk = dom.getElementById('calendar-skeleton');
                if (sk) sk.classList.add('hidden');
                var projectLabel = budget.projectName || '—';
                var tagEl = dom.getElementById('project-tag');
                tagEl.textContent = projectLabel;
                tagEl.setAttribute('title', projectLabel);
                dom.getElementById('label-project').textContent = budget.projectName || '—';
                dom.getElementById('label-start').textContent = budget.startDate ? fmtDate(parseDate(budget.startDate)) : 'Not set';
                dom.getElementById('label-delivery').textContent = budget.deliveryDate ? fmtDate(parseDate(budget.deliveryDate)) : 'Not set';

                var timeline = calcTimeline(budget);
                var totalDays = timeline ? timeline.reduce(function (s, t) { return s + t.days; }, 0) : 0;
                var totalWorking = timeline ? timeline.reduce(function (s, t) { return s + t.workingDays; }, 0) : 0;
                dom.getElementById('total-days-label').textContent = totalDays + ' days (' + totalWorking + ' working)';

                ['date-summary','gantt-section','milestones-section','stage-table-section'].forEach(function (id) {
                    dom.getElementById(id).classList.remove('hidden');
                });

                if (timeline) {
                    renderGantt(timeline);
                    renderStageTable(timeline);
                }
                renderMilestones();
                updateScrollAffordance();

            }).catch(function (e) { console.error('[CAL] load failed', e); });
        }

        /* --- Scroll affordance: fade when more content below fold --- */
        function updateScrollAffordance() {
            var body = dom.getElementById('calendar-body');
            var shade = dom.getElementById('scroll-shade');
            if (!body || !shade) return;
            var hasMore = body.scrollHeight > body.clientHeight + body.scrollTop + 8;
            shade.style.opacity = hasMore ? '1' : '0';
            shade.setAttribute('aria-hidden', hasMore ? 'false' : 'true');
        }

        function bindScrollAffordance() {
            var body = dom.getElementById('calendar-body');
            if (!body || body._scrollAffordanceBound) return;
            body._scrollAffordanceBound = true;
            body.addEventListener('scroll', updateScrollAffordance);
            window.addEventListener('resize', updateScrollAffordance);
        }

        /* --- Re-render all views after data change --- */
        function refreshAll() {
            if (!state.budget) return;
            var timeline = calcTimeline(state.budget);
            var totalDays = timeline ? timeline.reduce(function (s, t) { return s + t.days; }, 0) : 0;
            var totalWorking = timeline ? timeline.reduce(function (s, t) { return s + t.workingDays; }, 0) : 0;
            dom.getElementById('total-days-label').textContent = totalDays + ' days (' + totalWorking + ' working)';
            if (timeline) {
                renderGantt(timeline);
                renderStageTable(timeline);
            }
            renderMilestones();
            if (currentView === 'calendar') renderCalendarGrid();
            updateScrollAffordance();
        }

        /* --- ICS export: stages, delivery date, and user milestones --- */
        function exportICS() {
            var budget = state.budget;
            if (!budget) return;

            var timeline = calcTimeline(budget);
            var lines = [
                'BEGIN:VCALENDAR',
                'VERSION:2.0',
                'PRODID:-//mBT//Production Calendar//EN',
                'CALSCALE:GREGORIAN',
                'METHOD:PUBLISH'
            ];

            var projectName = budget.projectName || 'Production';

            /* Stage milestone events */
            if (timeline) {
                timeline.forEach(function (t) {
                    if (t.days === 0) return;
                    lines.push(
                        'BEGIN:VEVENT',
                        'DTSTART;VALUE=DATE:' + dateToICS(t.start),
                        'DTEND;VALUE=DATE:' + dateToICS(t.end),
                        'SUMMARY:' + projectName + ' — ' + t.label + ' (' + t.days + 'd)',
                        'DESCRIPTION:Stage: ' + t.label + '\\nDays: ' + t.days,
                        'END:VEVENT'
                    );
                });
            }

            /* Delivery date event */
            if (budget.deliveryDate) {
                var del = parseDate(budget.deliveryDate);
                lines.push(
                    'BEGIN:VEVENT',
                    'DTSTART;VALUE=DATE:' + dateToICS(del),
                    'DTEND;VALUE=DATE:' + dateToICS(del),
                    'SUMMARY:' + projectName + ' — Delivery Target',
                    'DESCRIPTION:Delivery/distribution target date.',
                    'END:VEVENT'
                );
            }

            /* User milestones */
            state.milestones.forEach(function (m) {
                if (!m.date) return;
                var d = parseDate(m.date);
                lines.push(
                    'BEGIN:VEVENT',
                    'DTSTART;VALUE=DATE:' + dateToICS(d),
                    'DTEND;VALUE=DATE:' + dateToICS(d),
                    'SUMMARY:' + (m.title || 'Milestone'),
                    'END:VEVENT'
                );
            });

            lines.push('END:VCALENDAR');

            var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (budget.projectName || 'production').replace(/\s+/g, '-').toLowerCase() + '-calendar.ics';
            a.click();
        }

        return {
            init: function () {
                bindScrollAffordance();
                load();

                /* Standard lifecycle: parent listens for mbt:tool-ready (e.g. quick-pay handshake) */
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage({ type: 'mbt:tool-ready', tool: 'calendar' }, window.location.origin);
                }

                /* --- Phase 50C.8: Dispatch tool focus to parent presence channel --- */
                function dispatchFocus() {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({ type: 'mbt:tool-action', action: 'user-focus-changed', payload: { tool: 'calendar' } }, window.location.origin);
                    }
                }
                dispatchFocus();
                window.addEventListener('focus', dispatchFocus);

                /* Phase 73B: receive undo/redo routing from parent monolith */
                window.addEventListener('message', function(e) {
                    if (!e || e.origin !== window.location.origin) return;
                    if (!e.data || e.data.type !== 'mbt:tool-action') return;
                });

                dom.getElementById('btn-back').addEventListener('click', function () {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({ type: 'mbt:tool-action', action: 'close-tool' }, window.location.origin);
                    } else {
                        history.back();
                    }
                });

                dom.getElementById('btn-add-milestone').addEventListener('click', function () {
                    var id = 'ms_' + Date.now();
                    state.milestones.push({ id: id, date: new Date().toISOString().slice(0, 10), title: '' });
                    renderMilestones();
                    save();
                });

                dom.getElementById('btn-export-ics').addEventListener('click', function () {
                    exportICS();
                });
            },

            setView: setView,
            toggleBlackout: toggleBlackout,

            /* --- 50C.1: Set work week type --- */
            setWorkWeek: function (val) {
                if (!state.budget) return;
                if (!state.budget.settings) state.budget.settings = {};
                state.budget.settings.workWeek = parseInt(val) || 5;
                save();
                refreshAll();
            },

            /* --- 50C.5: Bi-directional stage day editing from calendar --- */
            updateStageDays: function (stageKey, val) {
                if (!state.budget || !state.budget.targetLock || !state.budget.targetLock.stages) return;
                if (!state.budget.targetLock.stages[stageKey]) return;
                state.budget.targetLock.stages[stageKey].days = parseFloat(val) || 0;
                save();
                refreshAll();
            },

            /* --- 50C.3: Set stage offset days --- */
            updateStageOffset: function (stageKey, val) {
                if (!state.budget || !state.budget.targetLock || !state.budget.targetLock.stages) return;
                if (!state.budget.targetLock.stages[stageKey]) return;
                var parsed = val === '' ? undefined : (parseFloat(val) || 0);
                if (parsed !== undefined) {
                    var minOff = getMinStageOffset(state.budget, stageKey);
                    if (parsed < minOff) parsed = minOff;
                }
                if (parsed === undefined) {
                    delete state.budget.targetLock.stages[stageKey].offsetDays;
                } else {
                    state.budget.targetLock.stages[stageKey].offsetDays = parsed;
                }
                save();
                refreshAll();
            },

            /* --- 50C.4: Add a relative milestone --- */
            addRelativeMilestone: function () {
                var id = 'ms_' + Date.now();
                state.milestones.push({ id: id, type: 'relative', stageKey: 'prod', offsetDays: 0, title: '' });
                renderMilestones();
                save();
                updateScrollAffordance();
            },

            updateMilestone: function (input) {
                var id = input.dataset.id;
                var field = input.dataset.field;
                var m = state.milestones.find(function (x) { return x.id === id; });
                if (m) {
                    if (field === 'offsetDays') {
                        m[field] = parseInt(input.value) || 0;
                    } else {
                        m[field] = input.value;
                    }
                    save();
                    refreshAll();
                }
            },

            deleteMilestone: function (id) {
                state.milestones = state.milestones.filter(function (m) { return m.id !== id; });
                renderMilestones();
                save();
                refreshAll();
            }
        };

    })();

    window.mBTCalendar = mBTCalendar;

})(window);

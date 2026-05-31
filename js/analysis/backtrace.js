// js/analysis/backtrace.js
// [역추적 UX + sim-card 4-상태 모델] — js/analysis.js 에서 분리(2026-05-31).
//
// 책임:
//   - 점수 시뮬레이션 차트 렌더링(bar/line) — renderSimChart, updateSimBarGraph, updateSimLineGraph
//   - sim-card 4상태(default / loading / backtrace / upsell) — renderDetailedSimCard, requestBacktrace, goBackFromBacktrace
//   - sim-card 내 univ 버튼/스크롤 헬퍼 — renderSimUnivButtons, selectSimUniv
//   - 역추적 raw 스냅샷 추출 — extractBacktraceRawSnapshot
//
// 외부 의존(analysis.js 글로벌):
//   - 상태: currentUserTier, userQuantData, currentExamMode, simDisplayList, selectedSimIndex, currentSimChartType
//   - 헬퍼: escapeHtml, syncMobileHeight, triggerSubjScrollHintOnce, updateSimCardSwipeHint
//   - 상수/API: UNIV_DATA_API_URL, EXAM_DISPLAY_NAMES
//   - shared: apiFetch (shared/api.js)
//
// HTML 동적 onclick 참조 (분리 후에도 글로벌 유지 필수):
//   - requestBacktrace, goBackFromBacktrace, selectSimUniv

// ============================================================
// 역추적 UX (sim-card 4-상태 모델: default / loading / backtrace / upsell)
// ============================================================
const BT_LOADING_MIN_MS = 900;     // 분석중 애니메이션 최소 지속 시간 (기존 대비 2배)
const BT_BACKTRACE_TIERS = ['standard', 'pro']; // 역추적 기능 허용 등급

function extractBacktraceRawSnapshot(scoreData) {
    const coreKeys = ['kor', 'math', 'inq1', 'inq2'];
    const snapshot = {};
    coreKeys.forEach((key) => {
        const raw = parseInt(scoreData?.[key]?.raw, 10);
        if (Number.isFinite(raw)) snapshot[key] = raw;
    });
    return snapshot;
}

function _findSimItemByOriginalIdx(originalIdx) {
    if (!Array.isArray(simDisplayList)) return null;
    return simDisplayList.find(it => it && it.originalIdx === Number(originalIdx)) || null;
}

async function requestBacktrace(originalIdx) {
    const item = _findSimItemByOriginalIdx(originalIdx);
    if (!item || item.ineligible) return;

    // 1) Tier 게이팅 — standard/pro 외엔 upsell 모드
    if (!BT_BACKTRACE_TIERS.includes(currentUserTier)) {
        item._uiMode = 'upsell';
        renderDetailedSimCard();
        return;
    }

    // 2) Loading 모드로 전환 + 최소 딜레이
    item._uiMode = 'loading';
    renderDetailedSimCard();
    const loadingStart = Date.now();

    if (!item._backtraceBaseRaw) {
        item._backtraceBaseRaw = extractBacktraceRawSnapshot(userQuantData?.[currentExamMode]);
    }

    // 3) 이미 캐시된 backtrace_plan 있으면 API 스킵
    let plan = item.backtrace_plan || null;
    if (!plan) {
        try {
            const userId = localStorage.getItem('userId');
            const scoreData = userQuantData?.[currentExamMode]
                ? JSON.parse(JSON.stringify(userQuantData[currentExamMode]))
                : null;
            item._backtraceBaseRaw = extractBacktraceRawSnapshot(scoreData);
            const res = await apiFetch(UNIV_DATA_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'backtrace_required_raw',
                    userId,
                    targetUniv: { univ: item.univ, major: item.major },
                    userScores: scoreData,
                    examMode: currentExamMode,
                    targetUiMin: 100,
                    targetUiMax: 150,
                    maxTotalRaw: 20
                })
            });
            if (res.ok) {
                const payload = await res.json();
                plan = payload?.result || payload?.backtrace_plan || null;
            }
        } catch (e) {
            console.error('Backtrace fetch error:', e);
        }
    }

    // 4) 최소 딜레이 충족
    const elapsed = Date.now() - loadingStart;
    if (elapsed < BT_LOADING_MIN_MS) {
        await new Promise(r => setTimeout(r, BT_LOADING_MIN_MS - elapsed));
    }

    // 5) 결과 부착 후 모드 전환
    if (plan) {
        item.backtrace_plan = plan;
        item.needs_backtrace = true;
        item._uiMode = 'backtrace';
    } else {
        // 응답 없음/실패 → default로 되돌리고 에러 토스트 대용 alert
        item._uiMode = 'default';
        alert('합격권 도달 경로 분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    renderDetailedSimCard();
}

function goBackFromBacktrace(originalIdx) {
    const item = _findSimItemByOriginalIdx(originalIdx);
    if (!item) return;
    item._uiMode = 'default';
    renderDetailedSimCard();
}

let simSvgRefs = null;

function renderSimChart() {
    const container = document.getElementById('simChartArea');
    if (!container || !simDisplayList || simDisplayList.length === 0) return;
    
    const examName = EXAM_DISPLAY_NAMES[currentExamMode] || currentExamMode;
    const getBadgeHTML = () => `<div class="sim-info-badge"><span><i class="fas fa-history"></i> ${examName} 기준</span></div>`;

    if (!document.getElementById('simExtensionStyle')) {
        const style = document.createElement('style');
        style.id = 'simExtensionStyle';
        style.innerHTML = `
            .sim-extension-bar { width: 40px; background: #ffffff !important; border: 2px dashed #f59e0b; border-bottom: none; border-radius: 6px 6px 0 0; box-sizing: border-box; pointer-events: none; z-index: 2; position: absolute; }
            .sim-bar-item { -webkit-tap-highlight-color: transparent; }
            .sim-label-item { -webkit-tap-highlight-color: transparent; }
            @media (max-width: 768px) {
                .sim-extension-bar { width: 28px; }
                .sim-bar { width: 28px !important; }
            }
        `;
        document.head.appendChild(style);
    }

    const isMobile = window.innerWidth <= 768;

    if (currentSimChartType === 'bar') {
        simSvgRefs = null;
        if (!document.getElementById('simBarWrapper')) {
            container.innerHTML = ''; 
            container.style.overflow = 'visible';

            const wrapper = document.createElement('div');
            wrapper.id = 'simBarWrapper'; wrapper.className = 'chart-inner-container'; wrapper.style.height = 'auto'; wrapper.style.minHeight = '360px';
            wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());
            
            const graphArea = document.createElement('div'); graphArea.className = 'chart-graph-area';
            const labelArea = document.createElement('div'); labelArea.className = 'chart-label-area';

            const MAX_SCORE = 250; 

            if (isMobile) {
                graphArea.style.padding = '0 15px'; graphArea.style.marginTop = '40px'; graphArea.style.height = '200px'; 
            } else {
                graphArea.style.padding = '0 60px 0 20px'; graphArea.style.marginTop = '50px'; graphArea.style.height = '260px'; 
            }

            let graphHtml = ''; let labelHtml = '';
            const guideStyle100 = `bottom: ${(100 / MAX_SCORE) * 100}%; border-top-color: #3b82f6;`;
            const guideStyle150 = `bottom: ${(150 / MAX_SCORE) * 100}%; border-top-color: #10b981;`;
            
            graphHtml += `<div class="chart-guide-line guide-100" style="${guideStyle100}"><span class="chart-guide-label">합격(100)</span></div>`;
            graphHtml += `<div class="chart-guide-line guide-150" style="${guideStyle150}"><span class="chart-guide-label">안정(150)</span></div>`;

            simDisplayList.forEach((item, index) => {
                const choiceNum = item.originalIdx + 1;
                const shortUniv = item.univ.replace('학교', '');

                if (item.ineligible) {
                    graphHtml += `
                        <div class="sim-bar-item" onclick="selectSimUniv(${index})" style="flex:1; align-self:stretch; position:relative; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                            <div style="position:relative; height:100%; width:100%;">
                                <div class="sim-bar" style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:8%; background:repeating-linear-gradient(45deg,#fca5a5,#fca5a5 4px,#fee2e2 4px,#fee2e2 8px); border:1px dashed #ef4444; border-radius:6px 6px 0 0; z-index:1;">
                                    <span class="sim-score-label" style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); color:#ef4444; font-size:0.65rem; white-space:nowrap;">불가</span>
                                </div>
                            </div>
                        </div>`;
                    labelHtml += `
                        <div class="sim-label-item" onclick="selectSimUniv(${index})" style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                            <span class="label-mobile" style="word-break:keep-all; font-size:0.75rem;">${choiceNum}지망</span>
                            <span class="label-pc" style="word-break:keep-all; line-height:1.2;"><strong>${choiceNum}지망</strong><br>${escapeHtml(shortUniv)}<br><span style="color:#ef4444; font-size:0.75em;">지원불가</span></span>
                        </div>`;
                    return;
                }

                const score = item.base_ui_score;
                const currentHeightPct = `${(score / MAX_SCORE) * 100}%`;
                let color = '#ef4444';
                if (score >= 150) color = '#10b981'; else if (score >= 100) color = '#3b82f6';
                const safeScore = Math.round(score);
                let extensionHtml = ''; let maxRise = 0;

                if (item.sim_data) { Object.values(item.sim_data).forEach(sub => { if (sub && sub.uiDiff > maxRise) maxRise = sub.uiDiff; }); }

                if (maxRise > 0 && score < MAX_SCORE) {
                    const potentialScore = Math.min(score + maxRise, MAX_SCORE);
                    const riseAmount = potentialScore - score;
                    const riseHeightPct = `${(riseAmount / MAX_SCORE) * 100}%`;
                    
                    extensionHtml = `
                        <div class="sim-extension-bar" data-target-height="${riseHeightPct}" style="position:absolute; bottom:${currentHeightPct}; left:50%; transform:translateX(-50%); height:0; opacity:0; z-index:2; transition:height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease; pointer-events:none;">
                             <span style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); color:#d97706; font-size:0.8rem; font-weight:800; white-space:nowrap;">
                                +${maxRise.toFixed(1)}
                             </span>
                        </div>`;
                }

                graphHtml += `
                    <div class="sim-bar-item" onclick="selectSimUniv(${index})" style="flex:1; align-self:stretch; position:relative; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                        <div style="position:relative; height:100%; width:100%;">
                            <div class="sim-bar" style="position:absolute; bottom:0; left:50%; transform:translateX(-50%); height:${currentHeightPct}; background:${color}; border-radius:6px 6px 0 0; z-index:1; transition:border-radius 0.3s;">
                                <span class="sim-score-label" style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); font-weight:bold; color:${color}; transition:opacity 0.2s;">${safeScore}</span>
                            </div>
                            ${extensionHtml}
                        </div>
                    </div>`;

                labelHtml += `
                    <div class="sim-label-item" onclick="selectSimUniv(${index})" style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; text-align:center; cursor:pointer; -webkit-tap-highlight-color:transparent;">
                        <span class="label-mobile" style="word-break:keep-all; font-size:0.75rem;">${choiceNum}지망</span>
                        <span class="label-pc" style="word-break:keep-all; line-height:1.2;"><strong>${choiceNum}지망</strong><br>${escapeHtml(shortUniv)}<br>${escapeHtml(item.major)}</span>
                    </div>`;
            });

            graphArea.innerHTML = graphHtml; labelArea.innerHTML = labelHtml;
            wrapper.appendChild(graphArea); wrapper.appendChild(labelArea);

            const mobileLegendDiv = document.createElement('div'); mobileLegendDiv.className = 'mobile-legend-area';
            mobileLegendDiv.style.cssText = "display: flex; justify-content: center; align-items: center; gap: 20px; padding-top: 8px; margin-top: 6px; border-top: 1px dashed #cbd5e1;";
            mobileLegendDiv.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem; color:#475569; font-weight:700;"><div style="width:16px; height:4px; background:#10b981; border-radius:2px;"></div> 안정(150)</div>
                <div style="display:flex; align-items:center; gap:6px; font-size:0.85rem; color:#475569; font-weight:700;"><div style="width:16px; height:4px; background:#3b82f6; border-radius:2px;"></div> 합격(100)</div>
            `;
            container.appendChild(wrapper); container.appendChild(mobileLegendDiv);
        }
        updateSimBarGraph(selectedSimIndex || 0);
    }
    else if (currentSimChartType === 'line') {
        if (!document.getElementById('simLineWrapper')) {
            container.innerHTML = ''; container.style.overflow = 'visible';
            const wrapper = document.createElement('div'); wrapper.id = 'simLineWrapper'; wrapper.className = 'sim-line-container';
            wrapper.insertAdjacentHTML('beforeend', getBadgeHTML());

            const chartArea = document.createElement('div'); chartArea.className = 'sim-line-chart-area'; chartArea.style.overflow = "visible"; 
            wrapper.appendChild(chartArea); 
            
            // 💡 [수정] 모바일이 아닐 때만 꺾은선 하단의 대학 선택 버튼을 그립니다.
            if (!isMobile) {
                const btnBox = document.createElement('div'); btnBox.className = 'sim-univ-scroll-box'; 
                wrapper.appendChild(btnBox); 
                renderSimUnivButtons(btnBox);
            }

            container.appendChild(wrapper);
            initSimSvg(chartArea); 
        }
        updateSimLineGraph(selectedSimIndex || 0);
    }
    renderDetailedSimCard();
    
    if (window.innerWidth <= 768) {
        setTimeout(syncMobileHeight, 300); // 그래프 애니메이션 후 높이 재조정
    }
}

function updateSimBarGraph(idx) {
    const items = document.querySelectorAll('.sim-bar-item');
    const container = document.querySelector('.chart-scroll-container'); // 막대그래프 감싸는 래퍼

    items.forEach((item, i) => {
        const extBar = item.querySelector('.sim-extension-bar');
        const mainBar = item.querySelector('.sim-bar');
        const scoreLabel = item.querySelector('.sim-score-label');
        
        if (i === idx) {
            item.classList.add('active');
            if (extBar) {
                void extBar.offsetWidth; 
                extBar.style.height = extBar.getAttribute('data-target-height');
                extBar.style.opacity = '1';
                if (mainBar) mainBar.style.borderRadius = '0 0 0 0'; 
                if (scoreLabel) scoreLabel.style.opacity = '0'; 
            } else {
                if (scoreLabel) scoreLabel.style.opacity = '1';
            }
            
            // 💡 [수정된 부분] 모바일 막대그래프 강제 스크롤 동기화 로직
            if (container && window.innerWidth <= 768) {
                const scrollPos = item.offsetLeft - (container.clientWidth / 2) + (item.clientWidth / 2);
                container.scrollTo({ left: scrollPos, behavior: 'smooth' });
            }
        } else {
            item.classList.remove('active');
            if (extBar) {
                extBar.style.height = '0';
                extBar.style.opacity = '0';
            }
            if (mainBar) mainBar.style.borderRadius = '6px 6px 0 0';
            if (scoreLabel) scoreLabel.style.opacity = '1';
        }
    });
}

function initSimSvg(targetDiv) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "sim-svg-layer"); svg.style.overflow = "visible";
    const isMobile = window.innerWidth <= 768; const baseRadius = isMobile ? "4" : "6";
    
    const guides = {
        gBottom: createGuideGroup(ns, "#cbd5e1", ""), gMid: createGuideGroup(ns, "#cbd5e1", ""), gTop: createGuideGroup(ns, "#cbd5e1", ""),
        g100: createGuideGroup(ns, "#3b82f6", "100 합격"), g150: createGuideGroup(ns, "#10b981", "150 안정")
    };

    const path = document.createElementNS(ns, "path"); path.setAttribute("class", "sim-path");
    svg.appendChild(guides.gBottom.g); svg.appendChild(guides.gMid.g); svg.appendChild(guides.gTop.g);
    svg.appendChild(guides.g100.g); svg.appendChild(guides.g150.g); svg.appendChild(path);

    const points = []; const labels = []; const labelsGroup = document.createElementNS(ns, "g");
    for(let i=0; i<4; i++) {
        const c = document.createElementNS(ns, "circle"); c.setAttribute("class", "sim-point"); c.setAttribute("r", baseRadius);
        const t = document.createElementNS(ns, "text"); t.setAttribute("class", "sim-point-label");
        svg.appendChild(c); labelsGroup.appendChild(t); points.push(c); labels.push(t);
    }
    svg.appendChild(labelsGroup); targetDiv.appendChild(svg);

    const xAxis = document.createElement('div');
    xAxis.style.cssText = "position:absolute; bottom:0; left:0; width:100%; display:flex; justify-content:space-around; padding-bottom:5px; pointer-events:none;";
    const xAxisTexts = [];
    ['국어', '수학', '탐구1', '탐구2'].forEach(txt => {
        const sp = document.createElement('span'); sp.innerText = txt; sp.style.cssText = "font-size:11px; color:#64748b; font-weight:600; width:40px; text-align:center;";
        xAxis.appendChild(sp); xAxisTexts.push(sp);
    });
    targetDiv.appendChild(xAxis);
    simSvgRefs = { svg, guides, path, points, labels, xAxisTexts };
}

function createGuideGroup(ns, color, txt) {
    const g = document.createElementNS(ns, "g");
    const line = document.createElementNS(ns, "line"); line.setAttribute("class", "sim-guide-line"); line.setAttribute("stroke", color);
    const text = document.createElementNS(ns, "text"); text.setAttribute("class", "sim-guide-text"); text.setAttribute("fill", color); text.textContent = txt;
    g.appendChild(line); g.appendChild(text);
    return { g, line, text };
}

function renderSimUnivButtons(targetDiv) {
    targetDiv.innerHTML = '';
    const fragment = document.createDocumentFragment(); 

    simDisplayList.forEach((d, i) => {
        const btn = document.createElement('div'); 
        btn.className = `univ-select-btn ${i === selectedSimIndex ? 'active' : ''}`;
        
        const univName = d.univ.replace('학교', ''); 
        const deptName = d.major || '학부';
        const choiceNum = d.originalIdx + 1;

        const innerContainer = document.createElement('div');
        innerContainer.style.cssText = "flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 2px;";

        const topSpan = document.createElement('span');
        topSpan.style.cssText = "font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;";
        topSpan.textContent = `${choiceNum}지망 ${univName}`; 
        
        if (d.ineligible) {
            const inelSpan = document.createElement('span');
            inelSpan.style.cssText = "color:#ef4444; font-size:0.8em;";
            inelSpan.textContent = " (지원불가)";
            topSpan.appendChild(inelSpan);
        }

        const botSpan = document.createElement('span');
        botSpan.style.cssText = "font-size:0.85em; opacity:0.9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;";
        botSpan.textContent = deptName; 

        innerContainer.appendChild(topSpan);
        innerContainer.appendChild(botSpan);
        btn.appendChild(innerContainer);

        btn.onclick = () => {
            selectSimUniv(i);
            targetDiv.querySelectorAll('.univ-select-btn').forEach((b, idx) => { 
                if (idx === i) b.classList.add('active'); else b.classList.remove('active'); 
            });
        };
        fragment.appendChild(btn);
    });
    targetDiv.appendChild(fragment);
}

function updateSimLineGraph(idx) {
    if (!simSvgRefs) return;
    window.lastSimGraphIdx = idx;
    if (!window.simGraphResizeHandler) {
        window.simGraphResizeHandler = () => { if (typeof window.lastSimGraphIdx !== 'undefined') updateSimLineGraph(window.lastSimGraphIdx); };
        window.addEventListener('resize', window.simGraphResizeHandler);
    }

    const item = simDisplayList[idx];
    if (!item) return;
    if (item.ineligible) { simSvgRefs.svg.parentNode.style.height = '80px'; simSvgRefs.path.setAttribute("d", ""); simSvgRefs.points.forEach(p => { p.setAttribute("cx", -999); p.setAttribute("cy", -999); }); return; }
    const data = item;

    const TARGET_HEIGHT = 260; 
    simSvgRefs.svg.parentNode.style.height = `${TARGET_HEIGHT}px`; simSvgRefs.svg.parentNode.style.minHeight = `${TARGET_HEIGHT}px`;
    const svgEl = simSvgRefs.svg; const W = svgEl.clientWidth || 300; 
    
    const realNames = ['국어', '수학'];
    realNames.push(data.sim_data.inq1?.name || '탐구1'); realNames.push(data.sim_data.inq2?.name || '탐구2');
    simSvgRefs.xAxisTexts.forEach((span, i) => { span.innerText = realNames[i]; });

    const keys = ['kor', 'math', 'inq1', 'inq2'];
    const currentScore = data.base_ui_score;
    const scores = keys.map(k => {
        const rise = (data.sim_data && data.sim_data[k]) ? data.sim_data[k].uiDiff : 0;
        return Math.min(250, currentScore + rise);
    });

    let minS = Math.min(...scores); let maxS = Math.max(...scores); const scoreDiff = maxS - minS;
    let GAP = 25; if (scoreDiff > 160) GAP = 125; else if (scoreDiff > 90) GAP = 100; else if (scoreDiff > 40) GAP = 50;
    let centerScore = (minS + maxS) / 2; let midLine = Math.round(centerScore / 25) * 25;

    if (midLine + GAP < maxS) midLine += 25; if (midLine - GAP > minS) midLine -= 25;
    if (midLine - GAP < 0) midLine = GAP; if (midLine + GAP > 250) midLine = 250 - GAP;

    const midY = 130; const pixelPerGap = 90; const getY = (score) => midY - ((score - midLine) / GAP) * pixelPerGap;

    const targetGuides = [
        { obj: simSvgRefs.guides.gBottom, val: midLine - GAP, isFixed: false }, { obj: simSvgRefs.guides.gMid, val: midLine, isFixed: false },
        { obj: simSvgRefs.guides.gTop, val: midLine + GAP, isFixed: false }, { obj: simSvgRefs.guides.g100, val: 100, isFixed: true, label: "100 합격" },
        { obj: simSvgRefs.guides.g150, val: 150, isFixed: true, label: "150 안정" }
    ];

    targetGuides.forEach(guide => {
        const { obj, val, isFixed, label } = guide;
        if (val >= midLine - GAP && val <= midLine + GAP) {
            obj.g.style.opacity = 1; const y = getY(val);
            obj.line.setAttribute("x1", 0); obj.line.setAttribute("x2", W); obj.line.setAttribute("y1", y); obj.line.setAttribute("y2", y);
            obj.text.setAttribute("x", W - 5); obj.text.setAttribute("y", y - 4);
            if (isFixed) { obj.text.textContent = label; obj.line.style.opacity = 1; } 
            else { if (val === 100 || val === 150) { obj.text.textContent = ""; obj.line.style.opacity = 0; } else { obj.text.textContent = val; obj.line.style.opacity = 0.5; } }
        } else { obj.g.style.opacity = 0; }
    });

    const sectionW = W / 4; let d = ""; 
    const isFlat = (minS === maxS); const maxIdx = isFlat ? -1 : scores.indexOf(maxS); const minIdx = isFlat ? -1 : scores.indexOf(minS);

    scores.forEach((s, i) => {
        const cx = (sectionW * i) + (sectionW / 2); const cy = getY(s);
        if (i === 0) d += `M ${cx} ${cy}`; else d += ` L ${cx} ${cy}`;
        simSvgRefs.points[i].setAttribute("cx", cx); simSvgRefs.points[i].setAttribute("cy", cy);
        
        const pointEl = simSvgRefs.points[i]; const labelEl = simSvgRefs.labels[i];
        pointEl.style.fill = "#bfdbfe"; pointEl.style.stroke = "#2563EB"; 
        labelEl.style.opacity = 0; labelEl.style.fontWeight = "normal"; labelEl.style.fill = "#1e293b";

        if (!isFlat) {
            if (i === maxIdx) { pointEl.style.fill = "#10b981"; pointEl.style.stroke = "#059669"; labelEl.style.fill = "#10b981"; labelEl.style.opacity = 1; labelEl.style.fontWeight = "bold"; }
            if (i === minIdx) { pointEl.style.fill = "#ef4444"; pointEl.style.stroke = "#b91c1c"; labelEl.style.fill = "#ef4444"; labelEl.style.opacity = 1; labelEl.style.fontWeight = "bold"; }
        }
        labelEl.textContent = Math.round(s); labelEl.setAttribute("x", cx); labelEl.setAttribute("y", cy - 12);
    });
    simSvgRefs.path.setAttribute("d", d);
}

function selectSimUniv(index, fromScroll = false) {
    selectedSimIndex = index;
    if (currentSimChartType === 'bar') updateSimBarGraph(index);
    else if (currentSimChartType === 'line') {
        updateSimLineGraph(index);
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            document.querySelectorAll('.sim-univ-scroll-box .univ-select-btn').forEach((b, idx) => {
                if (idx === index) b.classList.add('active'); else b.classList.remove('active');
            });
        }
    }

    if (!fromScroll && window.innerWidth <= 768) {
        const container = document.getElementById('simDetailCard');
        if (container && container.children[index]) {
            const targetCard = container.children[index];
            container.scrollTo({ left: targetCard.offsetLeft - container.offsetLeft, behavior: 'smooth' });
        }
    } else if (window.innerWidth > 768) {
        renderDetailedSimCard(); 
    }
    
    if (window.innerWidth <= 768) {
        updateSimCardSwipeHint(index);
    }
}

function renderDetailedSimCard() {
    const cardArea = document.getElementById('simDetailCard');
    const isMobile = window.innerWidth <= 768;

    if (!simDisplayList || simDisplayList.length === 0) { 
        cardArea.innerHTML = `<div class="empty-sim-state" style="width:100%;"><p>대학을 선택해주세요.</p></div>`; 
        return; 
    }

    // 역추적 결과 표시 (확장 그래프 + 압축 narrative)
    const buildBacktraceNarrativeCard = (data, currentScore, backtrace) => {
        if (!backtrace) return '';

        const coreKeys = ['kor', 'math', 'inq1', 'inq2'];
        const labelMap = {
            kor: '국어',
            math: '수학',
            inq1: data.sim_data?.inq1?.name || '탐구1',
            inq2: data.sim_data?.inq2?.name || '탐구2'
        };
        const isReachable = backtrace.reachable === true;
        const planTotal = Number(isReachable ? backtrace.minTotalRaw : backtrace.bestEffort?.minTotalRaw);
        const planBySubject = isReachable ? backtrace.bySubject : backtrace.bestEffort?.bySubject;
        const planUi = Number(isReachable ? backtrace.expected?.uiScore : backtrace.bestEffort?.expected?.uiScore);
        const liveRawSnapshot = extractBacktraceRawSnapshot(userQuantData?.[currentExamMode]);
        const baseRawSnapshot = data._backtraceBaseRaw || {};
        const breakdownRows = planBySubject
            ? coreKeys.map(k => {
                const gain = Number(planBySubject[k]);
                if (!Number.isFinite(gain) || gain <= 0) return '';
                const roundedGain = Math.round(gain);

                const simRaw = parseInt(data.sim_data?.[k]?.raw, 10);
                const snapRaw = parseInt(baseRawSnapshot[k], 10);
                const liveRaw = parseInt(liveRawSnapshot[k], 10);
                const currentRaw = Number.isFinite(simRaw)
                    ? simRaw
                    : (Number.isFinite(snapRaw) ? snapRaw : liveRaw);
                const subjectLabel = escapeHtml(labelMap[k] || k);
                if (!Number.isFinite(currentRaw)) {
                    return `
                        <div class="bt-plan-row" role="row">
                            <span class="bt-cell bt-col-subject">${subjectLabel}</span>
                            <span class="bt-cell bt-col-current">-</span>
                            <span class="bt-cell bt-col-target">-</span>
                            <span class="bt-cell bt-col-rise">+${roundedGain}</span>
                        </div>
                    `;
                }

                const targetRaw = currentRaw + roundedGain;
                return `
                    <div class="bt-plan-row" role="row">
                        <span class="bt-cell bt-col-subject">${subjectLabel}</span>
                        <span class="bt-cell bt-col-current">${currentRaw}</span>
                        <span class="bt-cell bt-col-target">${targetRaw}</span>
                        <span class="bt-cell bt-col-rise">+${roundedGain}</span>
                    </div>
                `;
            }).filter(Boolean).join('')
            : '';
        const breakdownTable = breakdownRows
            ? `
                <div class="bt-plan-wrap">
                    <div class="bt-plan-head">
                        <span>과목별 상승 목표</span>
                        ${Number.isFinite(planTotal) ? `<span class="bt-plan-total">총 +${Math.round(planTotal)}점</span>` : ''}
                    </div>
                    <div class="bt-plan-table" role="table" aria-label="과목별 원점수 상승 계획">
                        <div class="bt-plan-row bt-plan-row-head" role="row">
                            <span class="bt-cell bt-col-subject">과목</span>
                            <span class="bt-cell bt-col-current">현재</span>
                            <span class="bt-cell bt-col-target">목표</span>
                            <span class="bt-cell bt-col-rise">상승</span>
                        </div>
                        ${breakdownRows}
                    </div>
                </div>
            `
            : '';

        // 확장 막대 그래프 (현재 → 도달, 금색 overlay)
        const markerPos = (score) => `${Math.max(0, Math.min(100, (Number(score) / 250) * 100))}%`;
        const posCurrent = markerPos(currentScore);
        const hasPlanUi = Number.isFinite(planUi);
        const posPlan = hasPlanUi ? markerPos(planUi) : posCurrent;
        const extWidthPct = hasPlanUi
            ? Math.max(0, Math.min(100, ((Number(planUi) - Number(currentScore)) / 250) * 100))
            : 0;

        const chartBlock = `
            <div class="bt-chart">
                <div class="bt-chart-axis">
                    <span>0</span>
                    <span class="bt-axis-cut">합격 100</span>
                    <span class="bt-axis-safe">안정 150</span>
                    <span>250</span>
                </div>
                <div class="bt-track">
                    <div class="bt-guide bt-guide-100" style="left:40%;"></div>
                    <div class="bt-guide bt-guide-150" style="left:60%;"></div>
                    ${hasPlanUi ? `<div class="bt-ext-fill" style="left:${posCurrent}; width:${extWidthPct}%;"></div>` : ''}
                    <div class="bt-dot bt-dot-current" style="left:${posCurrent};" title="현재 ${Number(currentScore).toFixed(1)}점"></div>
                    ${hasPlanUi ? `<div class="bt-dot bt-dot-target" style="left:${posPlan};" title="${isReachable ? '도달' : '최선'} ${Number(planUi).toFixed(1)}점"></div>` : ''}
                </div>
                <div class="bt-track-labels">
                    <span class="bt-label-current">현재 <strong>${Number(currentScore).toFixed(1)}</strong></span>
                    ${hasPlanUi ? `<span class="bt-label-target">${isReachable ? '도달 가능' : '최선'} <strong>${Number(planUi).toFixed(1)}</strong></span>` : ''}
                </div>
            </div>
        `;

        const reachableMsg = isReachable
            ? `합격권에 도달하려면 <strong>원점수 +${planTotal}점</strong>이 필요합니다.`
            : (backtrace.error
                ? escapeHtml(backtrace.error)
                : `현재 설정 범위 안에서는 합격권 도달이 어렵습니다.${Number.isFinite(planTotal) ? ` 최선 조합 기준 +${planTotal}점.` : ''}`);

        return `
            <div class="sim-backtrace-result ${isReachable ? '' : 'bt-unreachable'}">
                <div class="bt-result-title">
                    <i class="fas ${isReachable ? 'fa-route' : 'fa-exclamation-circle'}"></i>
                    ${isReachable ? '합격권 도달 경로' : '합격권 도달 어려움'}
                </div>
                ${chartBlock}
                <div class="bt-narrative">${reachableMsg}</div>
                ${breakdownTable}
            </div>
        `;
    };

    // 역추적 CTA 버튼 (default 모드 하단)
    const buildBacktraceCTA = (originalIdx) => `
        <button class="sim-backtrace-cta" type="button" onclick="requestBacktrace(${originalIdx})">
            <span class="cta-icon"><i class="fas fa-search-location"></i></span>
            <span class="cta-text">
                <span class="cta-headline">현재 점수로는 합격권 도달이 어렵습니다</span>
                <span class="cta-action">몇 점을 더 받으면 가능한지 확인하기 →</span>
            </span>
        </button>
    `;

    // Loading 본문 (loading 모드)
    const buildLoadingBlock = () => `
        <div class="sim-backtrace-loading">
            <div class="bt-loading-icon"><i class="fas fa-chart-line"></i></div>
            <div class="bt-progress-bar"><div class="bt-progress-fill"></div></div>
            <div class="bt-loading-text">합격권 도달 경로 분석 중...</div>
        </div>
    `;

    // Upsell 본문 (free/trial/basic 등에서 CTA 누른 경우)
    const buildUpsellBlock = (originalIdx) => `
        <div class="sim-backtrace-upsell">
            <button class="sim-backtrace-back" type="button" onclick="goBackFromBacktrace(${originalIdx})">
                <i class="fas fa-arrow-left"></i> 다시 보기
            </button>
            <div class="bt-upsell-icon"><i class="fas fa-lock"></i></div>
            <h4>합격권 도달 경로 분석은 Standard 이상 전용입니다</h4>
            <p>현재 점수로 어떤 과목을 몇 점 올려야 합격권에 도달하는지,
               SKY 합격생들의 루트 기반으로 정밀하게 분석해드립니다.</p>
            <ul>
                <li><i class="fas fa-check"></i> 과목별 정확한 원점수 상승 목표</li>
                <li><i class="fas fa-check"></i> 합격권 도달까지 필요한 학습 기간</li>
                <li><i class="fas fa-check"></i> 매주 어떻게 공부할지 플래너 제공</li>
            </ul>
            <button class="bt-upsell-btn" type="button" onclick="location.href='/payment'">멤버십 둘러보기 →</button>
        </div>
    `;

    // Backtrace 결과 본문 wrapper (뒤로가기 + 결과 카드)
    const buildBacktraceBlock = (data, currentScore, originalIdx) => `
        <button class="sim-backtrace-back" type="button" onclick="goBackFromBacktrace(${originalIdx})">
            <i class="fas fa-arrow-left"></i> 다시 보기
        </button>
        ${buildBacktraceNarrativeCard(data, currentScore, data.backtrace_plan)}
    `;

    // sim-card 본문이 짧은 케이스(warning/CTA 둘 다 없음)에서 하단 빈공간을 채우는 컨텍스트 힌트
    const buildSimFooterContext = (currentScore, bestSubjectKey, data) => {
        const subjMap = {
            kor: '국어',
            math: '수학',
            inq1: data.sim_data?.inq1?.name || '탐구1',
            inq2: data.sim_data?.inq2?.name || '탐구2'
        };
        const bestLabel = bestSubjectKey ? subjMap[bestSubjectKey] : null;
        let line = '';
        if (currentScore >= 150) {
            line = '이미 안정권에 안착해 있습니다. 약점 보강으로 상위 대학 도전도 고려해보세요.';
        } else if (currentScore >= 120) {
            line = '현재 안정 구간입니다. 1점 단위 상승만으로도 합격 안정성이 더욱 강화됩니다.';
        } else if (currentScore >= 100) {
            line = bestLabel
                ? `합격권에 진입한 적정 구간입니다. <strong>${escapeHtml(bestLabel)}</strong>부터 보강하면 안정권 진입 가능성이 높아집니다.`
                : '합격권에 진입한 적정 구간입니다. 약점 과목 보강이 안정권 도달의 열쇠입니다.';
        } else if (currentScore >= 60) {
            line = bestLabel
                ? `합격컷에 근접한 소신 구간입니다. <strong>${escapeHtml(bestLabel)}</strong> 위주의 전략적 상승이 합격 가능성을 좌우합니다.`
                : '합격컷에 근접한 소신 구간입니다. 효율적인 과목 선택이 합격 가능성을 좌우합니다.';
        } else {
            line = '현재 점수와 합격컷 차이가 큽니다. 과목별 효율과 학습 기간을 함께 검토해 전략적으로 접근하세요.';
        }
        return `
            <div class="sim-footer-hint">
                <i class="fas fa-lightbulb"></i><span>${line}</span>
            </div>`;
    };

    // ==========================================
    // [1] 모바일 전용 로직: 대학 카드 및 과목 카드 가로 스와이프
    // ==========================================
    if (isMobile) {
        // 대학 카드 스와이프를 위한 인라인 스타일 (CSS 파일 대신 JS에서 제어하여 꼬임 방지)
        cardArea.style.display = 'flex';
        cardArea.style.overflowX = 'auto';
        cardArea.style.scrollSnapType = 'x mandatory';
        cardArea.style.gap = '15px';
        cardArea.style.scrollbarWidth = 'none';
        cardArea.style.paddingBottom = '10px';
        
        if (simDisplayList.length > 1 && !document.getElementById('simCardSwipeHint')) {
            const hintDiv = document.createElement('div');
            hintDiv.id = 'simCardSwipeHint';
            hintDiv.style.cssText = "background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 15px; margin-bottom:15px;";
            cardArea.parentNode.insertBefore(hintDiv, cardArea);
            updateSimCardSwipeHint(selectedSimIndex || 0); // 초기화
        }

        // 스와이프 시 상단 막대/꺾은선 그래프 연동
        cardArea.onscroll = () => {
            clearTimeout(window.simScrollTimeout);
            // 💡 100ms -> 40ms로 줄여 손을 떼자마자 즉각 반응하도록 수정
            window.simScrollTimeout = setTimeout(() => {
                const card = cardArea.querySelector('.swipe-univ-card');
                if (!card) return;
                
                // 💡 카드 너비에 gap(15px)을 더해야 정확한 스와이프 인덱스가 산출됨
                const itemWidth = card.offsetWidth + 15;
                const scrollLeft = cardArea.scrollLeft;
                const index = Math.round(scrollLeft / itemWidth);

                if (index !== selectedSimIndex && simDisplayList[index]) {
                    selectSimUniv(index, true);
                }
            }, 40); 
        };

        let html = '';
        simDisplayList.forEach((item, index) => {
            const choiceNum = item.originalIdx + 1;

            if (item.ineligible) {
                html += `
                <div class="sim-result-card swipe-univ-card" style="flex: 0 0 100%; scroll-snap-align: center; box-sizing: border-box; margin-top: 0;">
                    <div class="sim-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                        <div>
                            <span class="sim-univ-title" style="display:block; font-size:1.1rem; font-weight:800; color:#1e293b;">${escapeHtml(item.univ)}</span>
                            <span class="sim-univ-dept" style="display:block; font-size:0.85rem; color:#64748b;">${escapeHtml(item.major)}</span>
                        </div>
                        <div class="sim-score-change">
                            <span class="score-badge" style="background:#fee2e2; color:#ef4444;">${choiceNum}지망</span>
                        </div>
                    </div>
                    <div style="padding:15px; text-align:center; color:#ef4444; font-weight:600; font-size:0.9rem;">
                        <i class="fas fa-ban" style="font-size:1.2rem; margin-bottom:8px; display:block;"></i>지원 불가 대학입니다.
                    </div>
                </div>`;
                return;
            }

            const data = item;
            const currentScore = Math.round(data.base_ui_score);
            if (currentScore >= 250) { Object.keys(data.sim_data).forEach(key => { if (data.sim_data[key]) data.sim_data[key].uiDiff = 0; }); }
            const getStatusText = (s) => { if (s >= 150) return "안정권"; if (s >= 100) return "적정권"; if (s >= 50) return "소신지원"; return "위험"; };
            const currentStatus = getStatusText(currentScore);

            // 💡 과목 점수 상승폭 기준 내림차순 정렬
            let subjects = [{ key: 'kor', name: '국어' }, { key: 'math', name: '수학' }, { key: 'inq1', name: '탐구1' }, { key: 'inq2', name: '탐구2' }];
            subjects.sort((a, b) => {
                const diffA = (data.sim_data[a.key] && data.sim_data[a.key].uiDiff) || 0;
                const diffB = (data.sim_data[b.key] && data.sim_data[b.key].uiDiff) || 0;
                return diffB - diffA; 
            });

            let maxRise = (data.sim_data[subjects[0].key] && data.sim_data[subjects[0].key].uiDiff) || 0;
            let bestSubjectKey = maxRise > 0 ? subjects[0].key : '';

            let subjectsHTML = '';
            subjects.forEach(sub => {
                const info = data.sim_data[sub.key];
                if (!info) return;
                const diffVal = info.uiDiff.toFixed(1);
                const isBest = (sub.key === bestSubjectKey && maxRise > 0);
                let desc = '';
                // 1. 응시하지 않은 과목 처리
                if (info.msg && info.msg.includes("응시 안 함")) {
                    desc = `<span style="color:#94a3b8;">미응시 과목입니다.</span>`;
                } 
                // 2. 실제 환산 점수(diff)가 전혀 오르지 않은 경우 (만점이거나, 반영비율이 0인 경우)
                else if (Math.abs(info.diff) < 0.01) {
                    desc = `<span style="color:#ef4444;">점수 변화 없음</span>`;
                } 
                // 3. 점수가 미세하게라도 오른 경우
                else {
                    desc = isBest ? `<strong>가장 합격 상승에 유리합니다.</strong>` : `점수 상승으로 합격 가능성이 높아집니다.`;
                }

                subjectsHTML += `
                    <div class="sim-item swipe-subj-card ${isBest ? 'best-pick' : ''}">
                        <div class="sim-item-header" style="margin-bottom:6px;">
                            <span style="font-weight:700;">${escapeHtml(info.name || sub.name)} <span style="font-size:0.75rem; font-weight:normal; color:#64748b;">1점 상승 시</span></span>
                            <span style="color:${info.uiDiff > 0 ? '#ef4444' : '#94a3b8'}; font-weight:800;">+${diffVal}점</span>
                        </div>
                        <div class="sim-item-body" style="font-size:0.85rem; line-height:1.4;">
                            <div style="margin-bottom:2px;">${desc}</div>
                        </div>
                    </div>`;
            });

            // 역추적 CTA 노출 조건: 현재 UI 점수 < 10 + 1점 상승해도 < 25 (사실상 도달 어려운 카드만)
            const uiMode = data._uiMode || 'default';
            const showBtCTA = ((window.DEV_FORCE_BT_CTA || localStorage.getItem('DEV_FORCE_BT_CTA') === '1') || (currentScore < 10 && (currentScore + maxRise) < 25)) && !data.ineligible && data.sim_data;

            // Warning 박스 — 안정권만 유지. 불합격권은 역추적 CTA가 같은 조건으로 떠서 중복 → 제거.
            let warningHTML = '';
            if (currentScore >= 225 || (currentScore + maxRise) >= 250) {
                warningHTML = `<div class="sim-warning" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534;"><h4 style="color:#166534; margin:0; line-height:1.3; font-size:0.95rem;"><i class="fas fa-check-circle"></i> 안정권입니다</h4><p style="margin:0; line-height:1.4; color:#475569; font-size:0.85rem;">상위 대학 도전을 고려해보세요.</p></div>`;
            }

            // 💡 과목 컨테이너 바로 위에 과목 스와이프 안내 표시
            const subjSwipeHint = `
                <div style="display:flex; justify-content:center; align-items:center; font-size:0.75rem; color:#94a3b8; margin-bottom:8px; gap:8px;">
                    <i class="fas fa-chevron-left" style="opacity:0.5;"></i> 과목 스와이프 <i class="fas fa-chevron-right" style="opacity:0.5;"></i>
                </div>`;
            // 1-4: warning도 CTA도 없는 "특이사항 없음" 카드에서 하단 컨텍스트 힌트로 빈공간 채움
            const showFooterHint = !showBtCTA && !warningHTML;
            const footerHintHTML = showFooterHint ? buildSimFooterContext(currentScore, bestSubjectKey, data) : '';
            const defaultBody = `${subjSwipeHint}<div class="subj-scroll-container">${subjectsHTML}</div>${showBtCTA ? buildBacktraceCTA(data.originalIdx) : ''}${footerHintHTML}`;

            let simBodyHTML;
            if (uiMode === 'loading') simBodyHTML = buildLoadingBlock();
            else if (uiMode === 'backtrace' && data.backtrace_plan) simBodyHTML = buildBacktraceBlock(data, currentScore, data.originalIdx);
            else if (uiMode === 'upsell') simBodyHTML = buildUpsellBlock(data.originalIdx);
            else simBodyHTML = defaultBody;

            html += `
            <div class="sim-result-card swipe-univ-card" style="flex: 0 0 100%; scroll-snap-align: center; box-sizing: border-box; margin-top: 0; display: flex; flex-direction: column;">
                <div class="sim-card-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; padding-bottom:12px; border-bottom:1px solid #f1f5f9;">
                    <div>
                        <span class="sim-univ-title" style="display:block; font-size:1.15rem; font-weight:800; color:#1e293b; margin-bottom:2px;">${escapeHtml(data.univ)}</span>
                        <span class="sim-univ-dept" style="display:block; font-size:0.9rem; color:#64748b;">${escapeHtml(data.major)}</span>
                    </div>
                    <div class="sim-score-change" style="text-align:right;">
                        <span class="score-badge" style="display:inline-block; background:#f1f5f9; padding:4px 8px; border-radius:6px; font-size:0.8rem; color:#64748b; margin-bottom:6px;">현재: ${currentStatus}</span>
                        <span class="score-diff" style="display:block; font-size:1.3rem; font-weight:800; color:#2563EB; margin:0;">${currentScore}점</span>
                    </div>
                </div>
                
                ${simBodyHTML}
                
                ${warningHTML}
            </div>`;
        });
        cardArea.innerHTML = html;
        // 시뮬 카드 내부 과목 스와이프 힌트 (1회) — 카드 안착 후 2초 뒤
        triggerSubjScrollHintOnce();

    } else {
        // ==========================================
        // [2] PC 전용 로직: 기존의 단일 렌더링 유지
        // ==========================================
        cardArea.style.display = 'block';
        cardArea.style.overflowX = 'visible';
        
        if (selectedSimIndex === null || !simDisplayList[selectedSimIndex]) { 
            cardArea.innerHTML = `<div class="empty-sim-state" style="display:block; height:auto;"><p>대학을 선택해주세요.</p></div>`; 
            return; 
        }

        const item = simDisplayList[selectedSimIndex];
        if (item.ineligible) {
            const choiceNum = item.originalIdx + 1;
            cardArea.innerHTML = `
                <div class="sim-result-card" style="display: block; height: auto;">
                    <div class="sim-card-header">
                        <div style="flex:1 1 60%; min-width:200px;">
                            <span class="sim-univ-title">${escapeHtml(item.univ)}</span>
                            <span class="sim-univ-dept">${escapeHtml(item.major)}</span>
                        </div>
                        <div class="sim-score-change">
                            <span class="score-badge" style="background:#fee2e2; color:#ef4444;">${choiceNum}지망</span>
                        </div>
                    </div>
                    <div style="padding:20px; text-align:center; color:#ef4444; font-weight:600;">
                        <i class="fas fa-ban" style="font-size:1.5rem; margin-bottom:10px; display:block;"></i>지원 불가 대학입니다.
                        <div style="font-size:0.85rem; color:#94a3b8; font-weight:400; margin-top:8px;">필수 과목 미응시 또는 자격 미충족으로 인해<br>분석 데이터를 제공할 수 없습니다.</div>
                    </div>
                </div>`;
            return;
        }

        const data = item;
        const currentScore = Math.round(data.base_ui_score);
        if (currentScore >= 250) { Object.keys(data.sim_data).forEach(key => { if (data.sim_data[key]) data.sim_data[key].uiDiff = 0; }); }
        const getStatusText = (s) => { if (s >= 150) return "안정권"; if (s >= 100) return "적정권"; if (s >= 50) return "소신지원"; return "위험"; };
        const currentStatus = getStatusText(currentScore);

        let maxRise = 0; let bestSubjectKey = '';
        const subjects = [{ key: 'kor', name: '국어' }, { key: 'math', name: '수학' }, { key: 'inq1', name: '탐구1' }, { key: 'inq2', name: '탐구2' }];
        subjects.forEach(sub => { const info = data.sim_data[sub.key]; if (info && info.uiDiff > maxRise) { maxRise = info.uiDiff; bestSubjectKey = sub.key; } });

        let subjectsHTML = '';
        subjects.forEach(sub => {
            const info = data.sim_data[sub.key];
            if (!info) return;
            const diffVal = info.uiDiff.toFixed(1);
            const isBest = (sub.key === bestSubjectKey && maxRise > 0);
            let desc = '';
                // 1. 응시하지 않은 과목 처리
                if (info.msg && info.msg.includes("응시 안 함")) {
                    desc = `<span style="color:#94a3b8;">미응시 과목입니다.</span>`;
                } 
                // 2. 실제 환산 점수(diff)가 전혀 오르지 않은 경우 (만점이거나, 반영비율이 0인 경우)
                else if (Math.abs(info.diff) < 0.01) {
                    desc = `<span style="color:#ef4444;">점수 변화 없음</span>`;
                } 
                // 3. 점수가 미세하게라도 오른 경우
                else {
                    desc = isBest ? `<strong>가장 합격 상승에 유리합니다.</strong>` : `점수 상승으로 합격 가능성이 높아집니다.`;
                }

            subjectsHTML += `
                <div class="sim-item ${isBest ? 'best-pick' : ''}" style="display:flex; flex-direction:column; justify-content:flex-start; height:100%;">
                    <div class="sim-item-header" style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:8px;">
                        <span style="flex:1; min-width:0; font-weight:700; color:#334155;">${escapeHtml(info.name || sub.name)} <span style="font-size:0.78rem; font-weight:normal; color:#64748b;">1점 상승 시</span></span>
                        <span style="flex-shrink:0; color:${info.uiDiff > 0 ? '#ef4444' : '#94a3b8'}; font-weight:700;">+${diffVal}점</span>
                    </div>
                    <div class="sim-item-body" style="flex:1;">
                        <div style="font-size:0.9rem; color:#475569; margin-bottom:4px;">${desc}</div>
                    </div>
                </div>
            `;
        });

        const uiMode = data._uiMode || 'default';
        const showBtCTA = (currentScore < 10 && (currentScore + maxRise) < 25 && !data.ineligible && data.sim_data);

        let warningHTML = '';
        if (currentScore >= 225 || (currentScore + maxRise) >= 250) warningHTML = `<div class="sim-warning" style="background:#f0fdf4; border-color:#bbf7d0; color:#166534;"><i class="fas fa-check-circle"></i><div><strong>이미 상당히 안정권입니다.</strong></div></div>`;

        // 1-4: warning도 CTA도 없는 "특이사항 없음" 카드에서 하단 컨텍스트 힌트로 빈공간 채움
        const showFooterHint_pc = !showBtCTA && !warningHTML;
        const footerHintHTML_pc = showFooterHint_pc ? buildSimFooterContext(currentScore, bestSubjectKey, data) : '';
        const defaultBody = `<div class="sim-grid">${subjectsHTML}</div>${showBtCTA ? buildBacktraceCTA(data.originalIdx) : ''}${footerHintHTML_pc}`;
        let simBodyHTML;
        if (uiMode === 'loading') simBodyHTML = buildLoadingBlock();
        else if (uiMode === 'backtrace' && data.backtrace_plan) simBodyHTML = buildBacktraceBlock(data, currentScore, data.originalIdx);
        else if (uiMode === 'upsell') simBodyHTML = buildUpsellBlock(data.originalIdx);
        else simBodyHTML = defaultBody;

        cardArea.innerHTML = `
            <div class="sim-result-card" style="display:block; height:auto;">
                <div class="sim-card-header">
                    <div style="flex:1 1 60%; min-width:200px;">
                        <span class="sim-univ-title">${escapeHtml(data.univ)}</span>
                        <span class="sim-univ-dept">${escapeHtml(data.major)}</span>
                    </div>
                    <div class="sim-score-change">
                        <span class="score-badge">현재: ${currentStatus}</span>
                        <span class="score-diff">${currentScore}점</span>
                    </div>
                </div>
                ${simBodyHTML}
                ${warningHTML}
            </div>
        `;
    }
}


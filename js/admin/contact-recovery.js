(() => {
    const panel = document.getElementById('contactRecoveryPanel');
    if (!panel) return;
    const list = panel.querySelector('ul'), status = panel.querySelector('[role=status]'), next = panel.querySelector('[data-next]');
    let cursor, generation = 0, loading = false;
    function button(label, action) {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'consulting-btn consulting-btn-secondary'; el.textContent = label;
        el.addEventListener('click', async () => {
            el.disabled = true;
            try { await action(); } catch (error) { status.textContent = error.message || '처리하지 못했습니다.'; }
            finally { el.disabled = false; }
        });
        return el;
    }
    function row(item) {
        const li = document.createElement('li'), evidence = document.createElement('p'), label = document.createElement('label'), input = document.createElement('input'), comparison = document.createElement('div');
        evidence.textContent = [item.studentName, '입금자 '+item.payerName, item.paidAt.replace('T',' ').slice(0,16)+' 한국시간', formatConsultingMoney(item.amount), '새 연락처 '+Object.values(item.contact).join(' · ')].join(' / ');
        label.textContent = '대조할 신청번호 '; input.value = item.applicationId || ''; input.placeholder = '학생 상세에서 확인한 APP_…'; label.append(input);
        input.addEventListener('input',()=>comparison.replaceChildren());
        const review = (decision, data={}) => requestConsultingAdmin('admin_review_contact_recovery',{requestId:item.requestId,decision,...data});
        const preview = button('신청·입금 대조',async () => {
            comparison.replaceChildren();
            const applicationId = input.value.trim(), result = await review('preview',{applicationId});
            if (input.value.trim() !== applicationId) return;
            const note = document.createElement('p');
            note.textContent = [result.studentName,result.payerName,result.paidAt ? formatConsultingDate(result.paidAt) : '입금 기록 없음',formatConsultingMoney(result.paidAmount),result.phoneMask,result.emailMask].join(' / ');
            comparison.append(note);
            if (!result.eligible) { comparison.append('신청·입금 내역 또는 기존 계정 연결을 개별 확인해주세요.'); return; }
            comparison.append(button('대조 완료 · 정정 및 초대 재발송',async () => {
                if (!confirm('실제 송금 내역과 학생을 대조했으며 같은 입금자의 다른 신청과 구분했습니까? 기존 초대를 취소하고 표시된 새 연락처로 발송합니다.')) return;
                await review('approve',{applicationId,expectedRevision:result.revision,confirmed:true}); await load(false);
            }));
        });
        li.append(evidence,label,preview,comparison,button('요청 종결',async () => {
            if (confirm('연락처를 변경하지 않고 이 요청을 종결할까요?')) { await review('dismiss'); await load(false); }
        }));
        return li;
    }
    async function load(more) {
        if (loading || !panel.open) return;
        const current = generation;
        loading = true; status.textContent = '정정 요청을 불러오고 있습니다.';
        try {
            const data = await requestConsultingAdmin('admin_list_contact_recovery',{cursor:more?cursor:null});
            if (current !== generation || !panel.open) return;
            if (!more) list.replaceChildren();
            list.append(...data.items.map(row)); cursor = data.cursor; next.hidden = !cursor;
            status.textContent = list.children.length ? '입금자명·시각·금액과 해당 학생의 신청을 대조해주세요.' : '이 페이지에 대기 요청이 없습니다.';
            if (!cursor && !list.children.length) panel.querySelector('summary').textContent='연락처 정정 요청';
        } catch (error) { if (current === generation) status.textContent = error.message || '목록을 불러오지 못했습니다.'; }
        finally { if (current === generation) loading = false; }
    }
    next.addEventListener('click', () => load(true));
    panel.addEventListener('toggle', () => {
        generation++;
        loading = false;
        list.replaceChildren();
        status.textContent = '';
        next.hidden = true;
        cursor = null;
        if (panel.open) void load(false);
    });
})();

(() => {
    const form = document.getElementById('recovery');
    const result = document.getElementById('result');
    const proofs = new Map();
    const field = key => form.elements.namedItem(key);
    const value = key => field(key).value.trim();
    let busy = false;
    async function post(url, body) {
        const response = await fetch(url, {method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        const content = await response.json();
        if (!response.ok || content.error || content.success === false) throw new Error(content.error || '요청을 처리하지 못했습니다.');
        return content;
    }
    function contact(key) {
        const input = key === 'email' ? value(key).toLowerCase() : value(key).replace(/[\s-]/g,'');
        if (!(key === 'phone' ? /^010\d{8}$/ : /^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(input)) throw new Error('인증받을 연락처를 확인해주세요.');
        return {input, auth:{[key]:key === 'phone' ? '+82'+input.slice(1) : input,purpose:'consulting-contact'}};
    }
    async function run(action) {
        if (busy) return;
        busy = true;
        const buttons = form.querySelectorAll('button');
        buttons.forEach(button => button.disabled = true);
        result.textContent = '처리 중입니다.';
        try { await action(); } catch (error) { result.textContent = error.message || '잠시 후 다시 시도해주세요.'; }
        finally { busy = false; buttons.forEach(button => button.disabled = false); }
    }
    for (const button of form.querySelectorAll('[data-send]')) {
        const key = button.dataset.send;
        field(key).addEventListener('input', () => { proofs.delete(key); field(key+'Code').value = ''; });
        button.addEventListener('click', () => run(async () => {
            const {auth} = contact(key);
            await post(CONFIG.api.auth,{type:key === 'email' ? 'send_email_auth' : 'send_sms_auth',...auth});
            proofs.delete(key); field(key+'Code').value = '';
            document.getElementById(key+'-code').hidden = false;
            field(key+'Code').focus();
            result.textContent = '받으신 6자리 인증번호를 입력해주세요.';
        }));
    }
    form.addEventListener('submit',event => {
        event.preventDefault();
        run(async () => {
            const data = {studentName:value('studentName'),payerName:value('payerName'),amount:Number(value('amount')),paidAt:value('paidAt')+'+09:00',applicationId:value('applicationId'),consent:field('consent').checked};
            const contacts = ['phone','email'].filter(key=>value(key)).map(key=>({key,...contact(key),code:value(key+'Code')}));
            if (!contacts.length) throw new Error('정정할 전화번호나 이메일을 입력해주세요.');
            for (const {key,input,auth,code} of contacts) {
                let verified = proofs.get(key);
                if (verified?.value !== input || verified.until <= Date.now()) {
                    if (!/^\d{6}$/.test(code)) throw new Error('입력한 연락처마다 6자리 인증번호가 필요합니다.');
                    const {proof} = await post(CONFIG.api.auth,{type:'verify_code',...auth,code});
                    if (!/^[a-f0-9]{64}$/.test(proof || '')) throw new Error('정정 인증을 완료하지 못했습니다. 새 인증번호를 요청해주세요.');
                    verified = {value:input,proof,until:Date.now()+240000}; proofs.set(key,verified);
                }
                data[key] = {value:input,proof:verified.proof};
            }
            await post(CONFIG.api.consultingPublic,{type:'public_submit_contact_recovery',data});
            proofs.clear(); form.reset(); form.hidden = true;
            result.textContent = '정정 요청을 접수했습니다. 운영팀이 입금 내역을 확인한 뒤 안내드리겠습니다. 다시 신청하거나 입금하실 필요가 없습니다.';
        });
    });
})();

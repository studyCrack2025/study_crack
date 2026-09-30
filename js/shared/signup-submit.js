export function signupAttributes(profile, email) {
    return Object.entries({ gender: profile.gender, given_name: profile.name, name: profile.name, phone_number: profile.cognitoPhone, email, birthdate: profile.birthdate }).map(([Name, Value]) => ({ Name, Value }));
}
export async function completeEmailSignup({ url, pool, CognitoUser, AuthenticationDetails, CognitoUserAttribute, email, password, profile, fetchImpl }) {
    if (!pool) return { ok: false, error: '회원가입 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.' };
    const signup = await new Promise(resolve => pool.signUp(email, password, signupAttributes(profile, email).map(attribute => new CognitoUserAttribute(attribute)), null,
        (error, result) => resolve({ error, userSub: result?.userSub })));
    const code = signup.error?.code || signup.error?.name;
    if (signup.error && code !== 'UsernameExistsException') {
        const messages = { InvalidPasswordException: '비밀번호 조건을 확인해주세요. 영문 대/소문자, 숫자, 특수문자 포함 8자 이상이어야 합니다.',
            InvalidParameterException: '입력 정보를 다시 확인해주세요.', TooManyRequestsException: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
            LimitExceededException: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
        return { ok: false, error: messages[code] || '회원가입 중 오류가 발생했습니다.' };
    }
    try {
        const recovered = signup.error ? await reauthenticateSignup({ CognitoUser, AuthenticationDetails, pool, email, password }) : null;
        await submitSignupProfile({ url, userId: signup.userSub, profile, recoveryAccessToken: recovered?.accessToken, fetchImpl });
        return { ok: true, userSub: signup.userSub || recovered?.userSub };
    } catch (error) { return { ok: false, afterAccountCreated: true, error: error?.message || '계정은 생성되었으나 프로필 저장에 실패했습니다.' }; }
}
export async function submitSignupProfile({ url, userId, profile, recoveryAccessToken, fetchImpl = globalThis.fetch, uuid = () => globalThis.crypto.randomUUID(), wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    const retryable = Boolean(profile.signupConsent) && !profile.promoCode;
    const body = JSON.stringify({ ...(recoveryAccessToken ? { type: 'resume_signup', accessToken: recoveryAccessToken } : { type: 'update_profile', userId }), data: { ...profile, signupAttemptId: uuid() } });
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
            const data = await response.json();
            if (!response.ok) throw Object.assign(new Error(data?.error || '가입 저장에 실패했습니다. 다시 로그인하거나 고객센터에 문의해주세요.'), { status: response.status });
            return data;
        } catch (error) {
            if (!retryable || attempt === 2 || error.status && error.status < 500 && error.status !== 429) throw error;
            await wait(300 * (attempt + 1));
        }
    }
}

export function reauthenticateSignup({ CognitoUser, AuthenticationDetails, pool, email, password,
    confirmDelivery = () => globalThis.confirm?.('아직 가입 인증이 완료되지 않았어요. 인증 코드를 다시 받아 가입을 이어갈까요?') === true,
    requestCode = () => globalThis.prompt?.('방금 받은 가입 확인 코드 6자리를 입력해주세요.') }) {
    const values = new Map();
    const Storage = { setItem: (key, value) => { values.set(key, value); return value; }, getItem: key => values.get(key) ?? null,
        removeItem: key => values.delete(key), clear: () => values.clear() };
    const user = new CognitoUser({ Username: email, Pool: pool, Storage });
    return new Promise((resolve, reject) => {
        const stop = () => { Storage.clear(); reject(new Error('가입 인증을 다시 진행하거나 고객센터에 문의해주세요.')); };
        let confirmationAttempted = false;
        const details = new AuthenticationDetails({ Username: email, Password: password });
        const callbacks = {
            onSuccess(result) {
                try {
                    const accessToken = result.getAccessToken().getJwtToken();
                    const userSub = result.getIdToken().payload.sub;
                    Storage.clear();
                    if (!accessToken || !userSub) { stop(); return; }
                    resolve({ accessToken, userSub });
                } catch { stop(); }
            },
            async onFailure(error) {
                if (confirmationAttempted || (error?.code || error?.name) !== 'UserNotConfirmedException') { stop(); return; }
                confirmationAttempted = true;
                try {
                    if (await confirmDelivery() !== true) { stop(); return; }
                    await new Promise((accept, decline) => user.resendConfirmationCode(error => error ? decline(error) : accept()));
                    const code = String(await requestCode() || '').trim();
                    if (!/^\d{6}$/.test(code)) { stop(); return; }
                    await new Promise((accept, decline) => user.confirmRegistration(code, false, error => error ? decline(error) : accept()));
                    user.authenticateUser(details, callbacks);
                } catch { stop(); }
            },
            newPasswordRequired: stop, mfaRequired: stop, totpRequired: stop,
            customChallenge: stop, selectMFAType: stop, mfaSetup: stop
        };
        user.authenticateUser(details, callbacks);
    });
}

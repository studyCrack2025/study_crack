// js/change-password.js

let cognitoUser = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 로그인 여부 확인
    if (!localStorage.getItem('userId')) {
        alert("로그인이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = '/login';
        return;
    }
    initCognitoUser();
});

function initCognitoUser() {
    const poolData = { 
        UserPoolId: CONFIG.cognito.userPoolId, 
        ClientId: CONFIG.cognito.clientId,
        Storage: createCognitoMemoryStorage()
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    cognitoUser = userPool.getCurrentUser();
    
    // 💡 캐시된 유저가 없다면 localStorage의 이메일로 수동 복구 (세션 증발 방어)
    if (!cognitoUser) {
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
            cognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: userEmail,
                Pool: userPool,
                Storage: userPool.storage
            });
        }
    }
}

function executeChangePassword() {
    const oldPw = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newChangePassword').value;
    const confirmPw = document.getElementById('newChangePasswordConfirm').value;

    if (!oldPw || !newPw || !confirmPw) { 
        alert("모든 항목을 입력해주세요."); 
        return; 
    }
    if (newPw !== confirmPw) { 
        alert("새 비밀번호가 일치하지 않습니다."); 
        return; 
    }

    // 💡 2. 강력한 비밀번호 정규식 검사 (auth.js와 동일한 기준 적용)
    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pwRegex.test(newPw)) {
        alert("비밀번호 조건을 확인해주세요.\n(영문 대/소문자, 숫자, 특수문자 포함 8자 이상)");
        document.getElementById('newChangePassword').focus();
        return;
    }

    if (!cognitoUser) {
        alert("유저 정보를 찾을 수 없습니다. 다시 로그인 해주세요.");
        window.location.href = '/login';
        return;
    }

    const details = new AmazonCognitoIdentity.AuthenticationDetails({ Username: cognitoUser.getUsername(), Password: oldPw });
    cognitoUser.authenticateUser(details, {
        onFailure: () => alert('현재 비밀번호를 확인해주세요.'),
        newPasswordRequired: () => alert('비밀번호 찾기로 다시 설정해주세요.'),
        onSuccess: session => {
            if (session.getIdToken().payload.sub !== localStorage.getItem('userId')) {
                cognitoUser.signOut();
                alert('현재 로그인한 계정을 확인해주세요.');
                return;
            }
            cognitoUser.changePassword(oldPw, newPw, async function(err, result) {
                if (err) {
                    console.error(err);
                    // 💡 3. 영어로 된 원시 에러 메시지 대신 한글로 친절하게 안내
                    if (err.name === 'NotAuthorizedException') {
                        alert("현재 비밀번호가 일치하지 않습니다.");
                    } else if (err.name === 'LimitExceededException') {
                        alert("요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.");
                    } else {
                        alert("비밀번호 변경에 실패했습니다. 올바른 비밀번호인지 확인해주세요.");
                    }
                    return;
                }
                alert("비밀번호가 성공적으로 변경되었습니다.\n안전을 위해 자동으로 로그아웃 됩니다. 새 비밀번호로 다시 로그인해주세요.");
                // Cognito 로그아웃 및 로컬 세션 클리어
                await clearServerSessionCookies();
                cognitoUser.signOut();
                clearClientSession();

                // 로그인 페이지로 강제 리다이렉트
                window.location.href = '/login';
            });
        }
    });
}

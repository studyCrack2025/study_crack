let cognitoUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const idToken = localStorage.getItem('idToken'); 
    if (!idToken) {
        alert("로그인이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = '/login';
        return;
    }
    initCognitoUser();
});

function initCognitoUser() {
    const poolData = { 
        UserPoolId: CONFIG.cognito.userPoolId, 
        ClientId: CONFIG.cognito.clientId 
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    cognitoUser = userPool.getCurrentUser();
    
    if (cognitoUser != null) {
        cognitoUser.getSession(function(err, session) {
            if (err) {
                console.error("세션 갱신 실패:", err);
            }
        });
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
    if (newPw.length < 8) { 
        alert("비밀번호는 8자 이상이어야 합니다."); 
        return; 
    }

    if (!cognitoUser) {
        alert("유저 정보를 찾을 수 없습니다. 다시 로그인 해주세요.");
        return;
    }

    cognitoUser.changePassword(oldPw, newPw, function(err, result) {
        if (err) {
            alert("비밀번호 변경 실패: 현재 비밀번호가 틀렸거나 정책에 맞지 않습니다.\n" + (err.message || err));
            return;
        }
        alert("비밀번호가 성공적으로 변경되었습니다.\n안전을 위해 자동으로 로그아웃 됩니다. 새 비밀번호로 다시 로그인해주세요.");
        
        // Cognito 로그아웃 및 로컬 세션 클리어
        cognitoUser.signOut();
        localStorage.clear();
        sessionStorage.clear();
        
        // 로그인 페이지로 강제 리다이렉트
        window.location.href = '/login';
    });
}
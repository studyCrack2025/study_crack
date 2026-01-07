// AWS Cognito 설정
const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// 1. 회원가입 처리
function handleSignUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;
    const phoneRaw = document.getElementById('phone').value;

    // 전화번호 +82 변환 (010-1234-5678 -> +821012345678)
    const phone = "+82" + phoneRaw.replace(/-/g, '').replace(/^0/, '');

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'phone_number', Value: phone })
    ];

    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            alert("가입 실패: " + err.message);
            console.error(err);
            return;
        }
        // 인증 코드 입력 받기 (간이 방식)
        const verificationCode = prompt(`${email}로 인증 코드를 보냈습니다. 코드를 입력해주세요:`);
        if (verificationCode) {
            confirmSignUp(email, verificationCode);
        }
    });
}

// 2. 인증 코드 확인
function confirmSignUp(email, code) {
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, function(err, result) {
        if (err) {
            alert("인증 실패: " + err.message);
            return;
        }
        alert("회원가입 완료! 로그인 페이지로 이동합니다.");
        window.location.href = 'login.html';
    });
}

// 3. 로그인 처리 (login.html용)
function handleSignIn() {
    // login.html에 있는 input ID 확인
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const authData = { Username: email, Password: password };
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
    
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: function(result) {
            // 토큰 저장
            localStorage.setItem('accessToken', result.getAccessToken().getJwtToken());
            localStorage.setItem('idToken', result.getIdToken().getJwtToken());
            localStorage.setItem('userEmail', email);
            
            alert("로그인되었습니다.");
            window.location.href = 'index.html';
        },
        onFailure: function(err) {
            alert("로그인 실패: " + err.message);
        }
    });
}

// 4. 로그아웃 처리
function handleSignOut() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) {
        cognitoUser.signOut();
    }
    localStorage.clear();
    window.location.href = 'index.html';
}

// 5. 로그인 상태 확인 (index.html 로드시 실행)
function checkLoginStatus() {
    const accessToken = localStorage.getItem('accessToken');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (accessToken) {
        // 로그인 상태
        if(loginBtn) loginBtn.classList.add('hidden');
        if(logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
        // 비로그인 상태
        if(loginBtn) loginBtn.classList.remove('hidden');
        if(logoutBtn) logoutBtn.classList.add('hidden');
    }
}
// js/auth.js

const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

function handleSignUp() {
    // 1. 입력값 가져오기
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    
    const name = document.getElementById('name').value;
    const gender = document.getElementById('gender').value;
    const birthdate = document.getElementById('birthdate').value; // YYYY-MM-DD
    const phoneRaw = document.getElementById('phone').value;
    
    const school = document.getElementById('school').value;
    const major = document.getElementById('major').value;
    const referral = document.getElementById('referral').value;

    // 2. 유효성 검사
    if (password !== passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }
    if (!name || !birthdate || !school) {
        alert("모든 필수 정보를 입력해주세요.");
        return;
    }

    // 전화번호 포맷 (+82...)
    const phone = "+82" + phoneRaw.replace(/-/g, '').replace(/^0/, '');

    // 3. Cognito 표준 속성 (Attributes) 구성
    // ★ 여기서 에러(gender, given_name required)를 해결합니다.
    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'phone_number', Value: phone }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),       // 전체 이름
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'given_name', Value: name }), // 이름 (필수 요구사항 대응)
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'gender', Value: gender }),   // 성별 (필수 요구사항 대응)
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'birthdate', Value: birthdate }) // 생년월일
    ];

    // 4. 세부 정보 (Metadata) 구성 - Lambda로 전달용
    const clientMetadata = {
        school: school,
        major: major,
        referral: referral
    };

    // 5. 회원가입 요청
    // signUp(username, password, attributeList, validationData, callback, clientMetadata)
    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            alert("가입 실패: " + err.message);
            console.error(err);
            return;
        }
        
        // 성공 시
        const verificationCode = prompt(`${email}로 인증 코드를 보냈습니다. 코드를 입력해주세요:`);
        if (verificationCode) {
            confirmSignUp(email, verificationCode);
        }
    }, clientMetadata); // ★ 맨 마지막에 메타데이터 전달
}

function confirmSignUp(email, code) {
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.confirmRegistration(code, true, function(err, result) {
        if (err) {
            alert("인증 실패: " + err.message);
            return;
        }
        alert("회원가입이 완료되었습니다! 로그인해주세요.");
        window.location.href = 'login.html';
    });
}

// 6. 로그인 처리 (login.html용)
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

// 7. 로그아웃 처리
function handleSignOut() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) {
        cognitoUser.signOut();
    }
    localStorage.clear();
    window.location.href = 'index.html';
}

// 8. 로그인 상태 확인 (index.html 로드시 실행)
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
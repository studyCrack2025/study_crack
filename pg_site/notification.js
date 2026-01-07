// notification.js
const { SolapiMessageService } = require("solapi");

// 환경 변수 설정
const messageService = new SolapiMessageService(
    process.env.SOLAPI_API_KEY,
    process.env.SOLAPI_API_SECRET
);

async function sendNotification(customerPhone, customerName, productName) {
    // 1. 전화번호 정리 (010 형식으로 변환)
    let phone = customerPhone.replace("+82", "0").replace(/-/g, "").replace(/ /g, "");
    if (phone.startsWith("10")) phone = "0" + phone;

    // 2. 현재 날짜 포맷팅 (YYYY-MM-DD HH:mm 형태)
    const now = new Date();
    // 템플릿 변수는 텍스트라 형식이 크게 중요하진 않지만 깔끔하게 보이도록 조정
    const dateStr = now.toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false 
    }).replace(/\./g, '.').replace(/:/g, ':'); // 포맷 단순 정리

    // 3. 메시지 내용 구성
    const msgText = `[스터디크랙] ${customerName}님, 결제가 정상적으로 완료되었습니다.

스터디크랙과 함께 입시 성공을 향한 첫걸음을 내디뎌 주셔서 감사합니다.
학생 개개인에게 최적화된 학습 전략으로 반드시 목표를 달성할 수 있도록 끝까지 함께하겠습니다.

[결제 상세 정보]
□ 구매자명 : ${customerName}
□ 구매상품 : ${productName}
□ 결제일시 : ${dateStr}

담당자가 24시간 이내에 배정되어 연락드릴 예정입니다.`;

    // 4. 발송 데이터 구성
    const messageData = {
        to: phone,
        from: process.env.SOLAPI_SENDER_NUM, // 발신번호
        text: msgText 
    };

    // 5. 알림톡 옵션 설정 (여기가 핵심 수정 부분입니다)
    if (process.env.KAKAO_PFID && process.env.KAKAO_TRANSAC_TEMPLATE_ID) {
        messageData.kakaoOptions = {
            pfId: process.env.KAKAO_PFID,          
            templateId: process.env.KAKAO_TRANSAC_TEMPLATE_ID, 
            disableSms: false,
            buttons: [
                {
                    buttonType: "AC",      // AC = 채널 추가 (Add Channel)
                    buttonName: "채널 추가" // 템플릿에 등록된 버튼 이름과 일치
                }
            ]
        };
        console.log(`📢 알림톡 발송 시도: ${customerName}`);
    } else {
        console.log(`📨 일반 문자 발송 시도: ${customerName}`);
    }

    // 6. 전송
    try {
        const result = await messageService.sendOne(messageData);
        console.log("발송 결과 ID:", result.groupId);
        return result;
    } catch (error) {
        console.error("메시지 발송 실패:", error);
    }
}

module.exports = { sendNotification };
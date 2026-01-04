const { GoogleSpreadsheet } = require('google-spreadsheet');
const { v4: uuidv4 } = require('uuid');

// [안전한 방식] 코드에 키를 적지 않고, 별도 파일에서 불러옵니다.
// 이렇게 하면 코드를 남에게 보여줘도 비밀키는 안전합니다.
const creds = require('./credentials.json');

exports.handler = async (event) => {
    // 1. 데이터 파싱
    let body;
    try {
        body = event.body ? JSON.parse(event.body) : event;
    } catch (e) {
        return { statusCode: 400, body: "Invalid JSON" };
    }

    // 2. Stripe 이벤트 확인
    if (body && body.type === 'checkout.session.completed') {
        const session = body.data.object;
        
        const customer = session.customer_details || {};
        const name = customer.name || "이름미입력";
        const phone = customer.phone || "번호없음";
        const uniqueId = uuidv4().slice(0, 8); 

        try {
            // [주의] 본인의 시트 ID는 그대로 유지하세요!
            const doc = new GoogleSpreadsheet('1XyHNce3imSuuzxr-6DAe9ZuicrMda5vVsMIIZLlebHg');
            
            // 불러온 creds 파일로 인증
            await doc.useServiceAccountAuth(creds);
            
            await doc.loadInfo();
            const sheet = doc.sheetsByIndex[0];

            await sheet.addRow({
                '고유번호': uniqueId,
                '이름': String(name),
                '전화번호': String(phone),
                '제출여부': 'X'
            });

            return { statusCode: 200, body: JSON.stringify({ message: "Success" }) };
            
        } catch (error) {
            console.error("Error:", error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
        }
    }

    return { statusCode: 200, body: "Not a checkout event" };
};
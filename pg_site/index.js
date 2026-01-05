const { GoogleSpreadsheet } = require('google-spreadsheet');
const Stripe = require('stripe');

// 설정값 입력
const creds = require('./credentials.json'); // 구글 서비스 계정 키
const SHEET_ID = process.env.SHEET_ID; 
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const doc = new GoogleSpreadsheet(SHEET_ID);
const stripe = Stripe(STRIPE_SECRET_KEY);

exports.handler = async (event) => {
    // 1. 구글 시트 인증 및 로드 함수
    async function loadSheet() {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        return doc.sheetsByIndex[0]; // 첫 번째 시트 사용
    }

    // 요청 처리
    try {
        // [CASE A] Stripe Webhook 요청인 경우 (결제 완료 알림)
        // Stripe는 헤더에 서명을 보냅니다.
        const sig = event.headers['stripe-signature'];
        if (sig) {
            let stripeEvent;
            try {
                stripeEvent = stripe.webhooks.constructEvent(event.body, sig, STRIPE_WEBHOOK_SECRET);
            } catch (err) {
                return { statusCode: 400, body: `Webhook Error: ${err.message}` };
            }

            // 결제 세션 완료 이벤트만 처리
            if (stripeEvent.type === 'checkout.session.completed') {
                const session = stripeEvent.data.object;
                const uniqueId = session.client_reference_id; // 우리가 보낸 그 ID

                if (uniqueId) {
                    const sheet = await loadSheet();
                    const rows = await sheet.getRows();
                    
                    // ID가 일치하는 행 찾기 (헤더: ID, 이름, 전화, 이메일, 상품, 결제여부)
                    const row = rows.find(r => r.ID === uniqueId);
                    
                    if (row) {
                        row.Paid = 'O'; // 결제 확인 표시 변경
                        await row.save();
                        console.log(`Order ${uniqueId} marked as paid.`);
                    }
                }
            }
            return { statusCode: 200, body: JSON.stringify({ received: true }) };
        }

        // [CASE B] 프론트엔드 폼 제출 요청인 경우
        const body = JSON.parse(event.body);
        if (body.type === 'submit_form') {
            const sheet = await loadSheet();
            
            // 시트에 행 추가 (헤더가 미리 작성되어 있어야 함: ID, Name, Phone, Email, Product, Paid)
            await sheet.addRow({
                ID: body.uniqueId,
                Name: body.name,
                Phone: body.phone,
                Email: body.email,
                Product: body.product,
                Paid: 'X', // 초기 상태는 미결제
                Date: new Date().toLocaleString('ko-KR')
            });

            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Form saved" })
            };
        }

    } catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.toString() })
        };
    }
};
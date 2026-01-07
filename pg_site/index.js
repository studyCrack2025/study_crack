// index.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const Stripe = require('stripe');
const { sendNotification } = require('./notification'); // [추가] 분리한 파일 불러오기

const creds = require('./credentials.json');

// 환경변수
const SHEET_ID = process.env.SHEET_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const doc = new GoogleSpreadsheet(SHEET_ID);
const stripe = Stripe(STRIPE_SECRET_KEY);

exports.handler = async (event) => {
    async function loadSheet() {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        return doc.sheetsByIndex[0];
    }

    try {
        // [CASE A] Stripe Webhook (결제 완료)
        const sig = event.headers['stripe-signature'];
        if (sig) {
            let stripeEvent;
            try {
                stripeEvent = stripe.webhooks.constructEvent(event.body, sig, STRIPE_WEBHOOK_SECRET);
            } catch (err) {
                return { statusCode: 400, body: `Webhook Error: ${err.message}` };
            }

            if (stripeEvent.type === 'checkout.session.completed') {
                const session = stripeEvent.data.object;
                const uniqueId = session.client_reference_id;
                
                // 고객 정보 추출
                const customerPhone = session.customer_details.phone;
                const customerName = session.customer_details.name || "고객";
                
                // 상품명은 메타데이터나 세션 정보에서 가져오거나, 
                // 지금 구조상 시트에 저장된 걸 읽어오는 게 정확함.

                if (uniqueId) {
                    const sheet = await loadSheet();
                    const rows = await sheet.getRows();
                    const row = rows.find(r => r.ID === uniqueId);
                    
                    if (row) {
                        row.Paid = 'O';
                        await row.save();
                        console.log(`Order ${uniqueId} marked as paid.`);

                        // [핵심] 메시지 발송 요청 (notification.js가 처리함)
                        // 시트에 저장된 상품명을 가져와서 보냄
                        const productName = row.Product || "스터디크랙 컨설팅";
                        await sendNotification(customerPhone, customerName, productName);
                    }
                }
            }
            return { statusCode: 200, body: JSON.stringify({ received: true }) };
        }

        // [CASE B] 프론트엔드 폼 제출
        const body = JSON.parse(event.body);
        if (body.type === 'submit_form') {
            const sheet = await loadSheet();
            await sheet.addRow({
                ID: body.uniqueId,
                Name: body.name,
                Phone: body.phone,
                Email: body.email,
                Product: body.product,
                Paid: 'X',
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
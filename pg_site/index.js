// index.js (StudyCrack_Payment)

const { GoogleSpreadsheet } = require('google-spreadsheet');
const Stripe = require('stripe');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { sendNotification } = require('./notification'); 

const creds = require('./credentials.json');

// 환경변수
const SHEET_ID = process.env.SHEET_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// DynamoDB 설정
const dbClient = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(dbClient);
const TABLE_NAME = "StudyCrack_Students";

const doc = new GoogleSpreadsheet(SHEET_ID);
const stripe = Stripe(STRIPE_SECRET_KEY);

// 한국 시간(KST) 구하는 헬퍼 함수
function getKSTDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const kstGap = 9 * 60 * 60 * 1000; // UTC+9
    const kstDate = new Date(utc + kstGap);
    
    // YYYY-MM-DD HH:mm:ss 형식으로 포맷팅
    return kstDate.toISOString().replace('T', ' ').substring(0, 19);
}

exports.handler = async (event) => {
    if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    async function loadSheet() {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        return doc.sheetsByIndex[0];
    }

    try {
        // [CASE A] Stripe Webhook (결제 완료 알림)
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
                const uniqueId = session.client_reference_id; // 주문 ID
                
                const customerPhone = session.customer_details.phone;
                const customerName = session.customer_details.name || "고객";

                if (uniqueId) {
                    const sheet = await loadSheet();
                    const rows = await sheet.getRows();
                    const row = rows.find(r => r.ID === uniqueId);
                    
                    if (row) {
                        // 1. 구글 시트 업데이트
                        row.Paid = 'O';
                        await row.save();
                        console.log(`Sheet updated: Order ${uniqueId}`);

                        const productName = row.Product || "스터디크랙 컨설팅";
                        const userId = row.UserId; // [중요] 시트에 저장해둔 userId를 꺼냄

                        // 2. DynamoDB 업데이트 (결제 내역 추가)
                        if (userId) {
                            try {
                                const newPayment = {
                                    orderId: uniqueId,
                                    product: productName,
                                    amount: session.amount_total / 100 || 0, // stripe는 cents 단위라 100 나눔
                                    status: 'paid',
                                    date: getKSTDate()
                                };

                                // 리스트에 추가 (list_append)
                                await docClient.send(new UpdateCommand({
                                    TableName: TABLE_NAME,
                                    Key: { userid: userId },
                                    UpdateExpression: "SET payments = list_append(if_not_exists(payments, :empty_list), :p)",
                                    ExpressionAttributeValues: {
                                        ":p": [newPayment],
                                        ":empty_list": []
                                    }
                                }));
                                console.log(`DynamoDB updated for user: ${userId}`);
                            } catch (dbErr) {
                                console.error("DynamoDB Update Error:", dbErr);
                                // DB 에러 나도 웹훅은 성공 처리 (시트는 저장됐으니까)
                            }
                        }

                        // 3. 알림톡 발송
                        await sendNotification(customerPhone, customerName, productName);
                    }
                }
            }
            return { statusCode: 200, body: JSON.stringify({ received: true }) };
        }

        // [CASE B] 프론트엔드 폼 제출 (결제 전 데이터 임시 저장)
        const body = JSON.parse(event.body);
        
        if (body.type === 'submit_form') {
            const sheet = await loadSheet();
            const kstTime = getKSTDate();

            await sheet.addRow({
                ID: body.uniqueId,
                Name: body.name,
                Phone: body.phone,
                Email: body.email,
                Product: body.product,
                Paid: 'X',
                Date: kstTime,
                UserId: body.userId // [추가] DynamoDB 연결을 위해 userId도 시트에 저장
            });

            // DynamoDB에도 '결제 대기중' 상태로 미리 넣어둘 수도 있지만, 
            // 깔끔하게 '결제 완료' 시에만 DB에 넣는게 관리하기 편하므로 여기선 시트에만 저장합니다.

            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Form saved to sheet" })
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
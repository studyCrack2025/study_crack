// index.js (StudyCrack_Payment)

const { GoogleSpreadsheet } = require('google-spreadsheet');
const Stripe = require('stripe');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
// ★ GetCommand 추가 (DB 조회용)
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { sendNotification } = require('./notification'); 

const creds = require('./credentials.json');

// 환경변수
const SHEET_ID = process.env.SHEET_ID;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const dbClient = new DynamoDBClient({ region: "ap-northeast-2" });
const docClient = DynamoDBDocumentClient.from(dbClient);
const TABLE_NAME = "StudyCrack_Students";

const doc = new GoogleSpreadsheet(SHEET_ID);
const stripe = Stripe(STRIPE_SECRET_KEY);

function getKSTDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    const kstGap = 9 * 60 * 60 * 1000;
    const kstDate = new Date(utc + kstGap);
    return kstDate.toISOString().replace('T', ' ').substring(0, 19);
}

exports.handler = async (event) => {
    if (event.requestContext && event.requestContext.http && event.requestContext.http.method === 'OPTIONS') {
        return { statusCode: 200, body: '' };
    }

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
                
                // ★ [수정 1] 여기서 Stripe 입력값은 안 씁니다. (삭제됨)
                
                if (uniqueId) {
                    const sheet = await loadSheet();
                    const rows = await sheet.getRows();
                    const row = rows.find(r => r.ID === uniqueId);
                    
                    if (row) {
                        row.Paid = 'O';
                        await row.save();
                        console.log(`Sheet updated: Order ${uniqueId}`);

                        const productName = row.Product || "스터디크랙 컨설팅";
                        const userId = row.UserId; 

                        if (userId) {
                            try {
                                // ★ [수정 2] DynamoDB에서 진짜 유저 정보 조회
                                const userResult = await docClient.send(new GetCommand({
                                    TableName: TABLE_NAME,
                                    Key: { userid: userId }
                                }));
                                
                                const userData = userResult.Item;
                                
                                // DB에 정보가 있으면 그걸 쓰고, 만약 없으면 시트에 저장된 거라도 씀
                                const realName = userData?.name || row.Name || "고객";
                                const realPhone = userData?.phone || row.Phone; 
                                // (DB 전화번호 형식 확인 필요: 010-1234-5678 형식이면 알림톡 전송 시 - 제거 로직이 필요할 수도 있음. 
                                // notification.js 내부에서 처리한다고 가정)

                                // 1. 결제 내역 저장 (기존 로직)
                                const newPayment = {
                                    orderId: uniqueId,
                                    product: productName,
                                    amount: session.amount_total / 100 || 0,
                                    status: 'paid',
                                    date: getKSTDate()
                                };

                                await docClient.send(new UpdateCommand({
                                    TableName: TABLE_NAME,
                                    Key: { userid: userId },
                                    UpdateExpression: "SET payments = list_append(if_not_exists(payments, :empty_list), :p)",
                                    ExpressionAttributeValues: {
                                        ":p": [newPayment],
                                        ":empty_list": []
                                    }
                                }));

                                // ★ [수정 3] DB에서 가져온 정확한 정보로 알림톡 발송
                                if (realPhone) {
                                    await sendNotification(realPhone, realName, productName);
                                    console.log(`Notification sent to ${realName} (${realPhone})`);
                                } else {
                                    console.log("No phone number found for notification.");
                                }

                            } catch (dbErr) {
                                console.error("DynamoDB Process Error:", dbErr);
                            }
                        }
                    }
                }
            }
            return { statusCode: 200, body: JSON.stringify({ received: true }) };
        }

        // [CASE B] 폼 제출 (기존 유지)
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
                UserId: body.userId
            });

            return { statusCode: 200, headers, body: JSON.stringify({ message: "Form saved" }) };
        }

    } catch (error) {
        console.error(error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.toString() }) };
    }
};
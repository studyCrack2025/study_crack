// index.js (StudyCrack_Payment)

const { GoogleSpreadsheet } = require('google-spreadsheet');
const Stripe = require('stripe');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
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
    // AWS 콘솔에서 CORS를 켰으므로, 코드 내 OPTIONS 처리와 headers 반환은 모두 제거합니다.

    async function loadSheet() {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        return doc.sheetsByIndex[0];
    }

    try {
        // [CASE A] Stripe Webhook (결제 완료 알림)
        // 웹훅은 보통 headers에 stripe-signature가 있는지로 구분합니다.
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
                                // DynamoDB에서 진짜 유저 정보 조회
                                const userResult = await docClient.send(new GetCommand({
                                    TableName: TABLE_NAME,
                                    Key: { userid: userId }
                                }));
                                
                                const userData = userResult.Item;
                                
                                const realName = userData?.name || row.Name || "고객";
                                const realPhone = userData?.phone || row.Phone; 

                                // DynamoDB에 결제 내역 추가
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

                                // 알림톡 발송
                                if (realPhone) {
                                    await sendNotification(realPhone, realName, productName);
                                    console.log(`Notification sent to ${realName}`);
                                } else {
                                    console.log("No phone number found.");
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

        // [CASE B] 폼 제출 (프론트엔드 -> 구글시트 임시 저장)
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

            // 헤더 없이 body만 반환 (AWS가 알아서 CORS 헤더 붙여줌)
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
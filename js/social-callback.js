// js/social-callback.js
// 소셜 OAuth 콜백 페이지 전용 처리 스크립트

(async function() {
    const AUTH_URL = CONFIG.api.auth;
    const USER_API_URL = CONFIG.api.user;
    const statusMsg = document.getElementById('statusMsg');
    let pendingSocialSignup = null;
    // legal-content:start
    const SOCIAL_TERM_DETAILS = {
  "standard": {
    "title": "스터디크랙 이용약관",
    "body": "제 1 장 총 칙\n제 1 조【 목 적 】\n1. 회원규칙은 공정거래법 및 기타 전기통신사업법 및 동법 시행령에 의하여 (주)스터디크랙(이하 \"회사\"라 한다)가 제공하는 스터디크랙에서 운영하는 모든 서비스(이하 \"서비스 \"라 한다)의 이용조건, 절차 그리고 회원규칙에 관한 사항을 규정함을 목적으로 합니다.\n제 2 조【 공지 및 적용 】\n1. 이 규정의 내용은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력을 발생합니다.\n2. 회사는 이 규정을 변경할 수 있으며, 변경된 규정은 제1항과 같은 방법으로 공지함으로 써 효력을 발생합니다.\n제 3 조【 규정 외 준칙 】\n1. 이 규정에 명시되지 않은 사항은 공정거래법 전기통신기본법, 전기통신사업 법 및 기타 관련법령의 규정에 의합니다.\n제 4 조【 용어의 정의 】\n1. 이 규정에서 사용하는 용어의 정의는 다음과 같습니다.\n1) 회 원 : 회사와 서비스 이용계약을 체결한 자\n2) 아이디 : 회원 식별과 회원의 서비스 이용을 위하여 회원이 선정한 문자와 숫자의 조합\n3) 비밀번호 : 회원의 비밀 보호를 위함.\n4) 운영자 : 서비스의 전반적인 관리와 원활한 운영을 위하여 회사에서 선정한 사람\n5) 해 지 : 회사 또는 회원이 서비스 개통 후 이용계약을 해약하는 것\n제 2 장 서비스 이용계약\n제 5 조【 회원 가입 】\n1. 아래 \"위의 이용약관에 동의하십니까?\" 라는 물음에 회원이 \"동의\" 단추를 누르면 이 규정에 동의하는 것으로 간주됩니다.\n2. 이용계약은 회원의 이용신청에 대하여 회사가 승낙함으로써 성립합니다.\n3. 회원으로 가입하기 위해서는 스터디크랙에서 요청하는 개인 신상정보를 제공해야 합니다.\n4. 아이디 변경 등 개인 정보의 변경은 관리자에게 온라인으로 요청함으로써 가능합니다.\n제 6 조【 서비스 이용/제한 】\n1. 회원은 특별한 사정이 없으면 연중무휴, 1일 24시간 스터디크랙을 이용할 수 있습니다. 그러나 정기점검 등 필요한 경우 미리 고지한 날/시간에는 이용이 제한될 수 있습니다.\n2. 다른 이용자 또는 제 3자를 비방하거나 중상 모략으로 명예를 손상시키거나 공공질서 혹은 법규에 위반되는 내용이 게재되어 있을 경우. 저작권 등 기타 권리를 침해하는 내용인 경우에도 삭제가 가능합니다.\n제 7 조【 스터디크랙의 의무 】\n1. 스터디크랙은 특별한 사정이 없는 한 회원가입 후 즉시 서비스를 제공하고 보다 나은 서비스를 계속적 안정적으로 서비스하기 위해 노력합니다.\n2. 스터디크랙은 이용자의 개인 신상 정보를 본인의 승낙 없이 타인에게 누설, 배포 하지 않습니다. 다만, 의료기사법, 공정거래법 ,전기통신관련법령 등 관계법령에 따른 국가기관 등의 요구가 있는 경우에는 예외로 합니다.\n3. 스터디크랙은 이용자로부터 제기되는 의견이나 불만이 정당하다고 인정할 경우에는 즉시 처리 합니다. 다만, 즉시 처리가 곤란한 경우에는 이용자에게 그 사유와 처리일정을 통보합니다.\n제 8 조【 이용자의 의무 】\n1. ID와 비밀 번호에 관한 모든 관리의 책임은 이용자에게 있습니다. 따라서 자신의 아이디가 부정하게 사용된 경우, 이용자은 반드시한국교육컨설팅에 그 사실을 통보해야 합니다. 또 이용자는 이 약관 및 관계법령에서 규정한 사항을 준수하여야 합니다.\n제 9 조【 정보의 제공 】\n1. 회사는 회원이 서비스 이용 중 필요가 있다고 인정되는 다양한 정보에 대해서 전자우편, 유선매체, 서신우편 등의 방법으로 회원에게 제공할 수 있습니다.\n제 3 장 계약해지 및 이용제한\n제10조【 계약해지 및 이용제한 】\n1. 회원이 이용계약을 해지하고자 하는 때에는 회원 본인이 온라인을 통해 회사에 해지신청을 하여야 합니다.\n2. 회사는 회원이 다음 각 호의 1에 해당하는 행위를 하였을 경우 사전통지 없이 이용계약을 해지하거나 또는 기간을 정하여 서비스 이용을 중지할 수 있습니다.\n1) 타인의 서비스 idl 및 비밀번호를 도용한 경우\n2) 서비스 운영을 고의로 방해한 경우\n3) 가입한 이름이 실명이 아닌 경우\n4) 공공질서 및 미풍양속에 저해되는 내용을 고의로 유포시킨 경우\n5) 회원이 국익 또는 사회적 공익을 저해할 목적으로 서비스 이용을 계획 또는 실행하는 경우\n6) 타인의 명예를 손상시키거나 불이익을 주는 행위를 한 경우\n7) 기타 회사가 정한 이용조건에 위반한 경우\n제 4 장 손해배상 등\n제11조【 손해배상 】\n1. 회사는 서비스 요금이 무료인 동안의 서비스 이용과 관련하여 회원에게 발생한 어떠한 손해에 관하여도 책임을 지지 않습니다.\n2. 서비스 유료화 이후에 관하여는 별도로 정합니다.\n제12조【 면책조항 】\n1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.\n2. 회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.\n3. 회사는 회원이 서비스를 이용하여 기대하는 손익이나 서비스를 통하여 얻은 자료로 인한 손해에 관하여 책임을 지지 않습니다.\n4. 회사는 회원이 서비스에 게재한 정보, 자료, 사실의 신뢰도, 정확성 등 내용에 관하여는 책임을 지지 않습니다.\n제13조【 관할법원 】\n1. 요금 등 서비스 이용으로 발생한 분쟁에 대해 소송이 제기될 경우 회사의 본사 소재지를 관할하는 법원을 관할법원으로 합니다.",
    "revision": "legacy-9d9bcf1b20bb"
  },
  "privacy": {
    "title": "스터디크랙 개인정보 처리방침",
    "body": "스터디크랙은 회원 가입과 선택한 서비스 이용에 필요한 개인정보를 처리합니다. 아래 처리 원칙과 현재 제공되는 권리 행사 방법을 안내합니다.\n1. 처리 항목과 목적\n- 회원 가입·로그인·본인 확인: 가입 방식에 따라 이름, 이메일, 전화번호, 계정 식별정보, 인증 정보, 약관 및 마케팅 동의 내역을 처리합니다. 일반 로그인 비밀번호는 인증 서비스에서 처리합니다.\n- 소셜 로그인 선택 시: Google 또는 Naver에서 제공하는 계정 식별정보, 이메일, 이름, 프로필 이미지를 받아 계정 연결과 로그인에 이용합니다. 제공 범위는 이용자가 선택한 로그인 방식과 제공자 설정에 따라 달라집니다.\n- 성적 분석·코칭 이용 시: 이용자가 입력한 학년·성적·선택 과목·희망 대학, 학습 성향·조사서, 상담 내용, 첨부파일 및 보고서를 해당 분석과 상담 제공에 이용합니다. 이 자료 전체를 모든 회원의 가입 필수 항목으로 수집하는 것은 아닙니다.\n- 플래너·학습 기록·수조 이용 시: 계획, 공부 시간, 완료 기록과 보상·물고기 내역을 해당 기능 제공에 이용합니다.\n- 구매·고객 문의 시: 구매 상품, 결제 금액·일시·거래 식별정보·처리 상태, 문의 및 답변 내용을 결제 확인, 서비스 제공, 환불 및 분쟁 처리에 이용합니다.\n- 광고성 안내는 별도 선택 동의에 따라 이메일·전화번호를 이용합니다. 동의하지 않아도 일반 서비스 이용에는 제한이 없습니다.\n2. 수집 방법과 처리 근거\n- 이용자가 가입 화면·설문·서비스 화면·고객 문의를 통해 입력하거나 첨부한 정보, 선택한 소셜 로그인 제공자로부터 받은 정보 및 서비스 이용 과정에서 생성된 기록을 처리합니다.\n- 목적에 따라 정보주체의 동의, 계약 체결·이행에 필요한 처리, 관계 법령상 의무를 근거로 처리합니다. 선택 동의는 해당 목적과 구분하며, 방침을 읽는 것만으로 새로운 동의를 받은 것으로 처리하지 않습니다.\n3. 보유 및 이용 기간\n- 일반 회원·학습·상담 자료는 회원 탈퇴 또는 해당 처리 목적 달성 시 삭제하는 것을 원칙으로 합니다. 법정 보존이 필요한 기록은 일반 서비스 자료와 구분하여 해당 목적과 기간에 한해 보관하는 원칙을 적용합니다.\n- 마케팅 목적의 연락처 이용은 회원 탈퇴 또는 동의 철회 시까지입니다.\n- 전자상거래 등에서의 소비자보호에 관한 법률 시행령 제6조에 따른 보존 대상: 계약 또는 청약철회 등에 관한 기록 5년, 대금결제 및 재화 등의 공급에 관한 기록 5년, 소비자의 불만 또는 분쟁처리에 관한 기록 3년, 표시·광고에 관한 기록 6개월.\n- 위 기간은 해당 거래·분쟁 등 기록에 적용되며 모든 성적·상담·첨부자료를 일괄 5년 보관한다는 뜻이 아닙니다. 다른 법령에 따른 보존이 필요한 경우에도 해당 근거와 필요한 범위로 한정합니다.\n4. 파기 원칙과 현재 삭제 요청 안내\n- 삭제 대상 전자자료는 복구할 수 없는 삭제를, 종이 자료가 있는 경우 분쇄 또는 소각을 원칙으로 합니다.\n- 현재 앱의 회원 탈퇴 기능만으로 모든 연관 자료가 자동 정리되지는 않습니다. 학습·수조·문의·파일·보고서·알림 등 연관 자료의 삭제도 요청할 수 있으며, 고객센터에서 실제 처리 범위와 결과를 확인해야 합니다.\n- 백업·로그·외부 서비스 기록을 포함한 삭제 범위와 처리 일정은 요청 시 확인해주세요. 즉시 전체 삭제 또는 특정 완료 기한을 보장하는 안내는 아닙니다.\n- 법정 보존 대상이 있는 경우 일반 서비스 자료와 구분하여 적용 근거·보존 범위·기간을 확인해야 합니다. 계정 삭제 요청과 환불 신청은 별도입니다.\n5. 외부 서비스 이용과 처리 업무\n- AWS(Amazon Web Services): 서비스 실행, 자료 저장, 회원 인증 및 인증 이메일·문자 발송에 이용합니다.\n- NICEPAY: 결제 처리와 거래 확인에 이용합니다.\n- Solapi: 문자·알림톡 등 서비스 안내 발송에 이용하며, 발송 대상 연락처와 메시지 내용이 처리됩니다.\n- Google·Naver: 이용자가 선택한 소셜 로그인과 계정 정보 확인에 이용합니다.\n- 위 서비스 연동과 법령상 필요한 처리를 포함하므로 외부 처리나 제공이 전혀 없다는 의미로 안내하지 않습니다. 위탁 처리와 각 제공자의 독립적인 서비스 처리는 구분하여 확인해야 합니다.\n6. 기기 저장 및 웹 태그\n- 로그인 상태, 서비스 설정, 작성 중인 계획과 화면 상태 등을 유지하기 위해 쿠키와 브라우저 저장 공간을 사용합니다.\n- 브라우저 설정에서 쿠키와 사이트 저장 정보를 삭제하거나 제한할 수 있습니다. 이 경우 로그인 유지나 저장 중인 기능이 정상 동작하지 않을 수 있으며, 기기 저장 정보 삭제는 서버 계정 삭제와 다릅니다.\n- 웹에는 Google Tag Manager가 포함되어 있습니다. 태그 관리 도구와 개별 분석·광고 도구는 서로 다르며, 태그 관리 도구가 있다는 사실만으로 모든 분석·광고 도구를 사용한다는 뜻은 아닙니다.\n7. 이용자의 권리와 요청 방법\n- 본인의 개인정보 열람, 정정·삭제, 처리정지 및 동의 철회를 아래 문의처로 요청할 수 있습니다.\n- 가입 이메일과 요청 내용을 알려주세요. 본인 확인 후 처리 범위와 결과를 확인할 수 있습니다. 비밀번호, 인증번호, 신분증 원본이나 결제수단 전체 정보를 이메일로 보내지 마세요.\n- 법령에 따라 요청이 제한되거나 일부 기록 보존이 필요한 경우 해당 사유와 범위를 확인할 수 있습니다.\n- 계정 삭제 방법은 /delete-account 안내에서도 확인할 수 있습니다. 페이지 열람 또는 이메일 버튼 클릭만으로 접수·삭제가 완료되지는 않습니다.\n8. 개인정보 보호책임자 및 문의처\n- 개인정보 보호책임자: 김태윤\n- 이메일: contact@studycrack.co.kr\n- 전화: 070-8128-1126",
    "revision": "clarified-1cd9185b761f"
  },
  "service": {
    "title": "스터디크랙 서비스 이용약관",
    "body": "제1조 (서비스 성격)\n스터디크랙은 수험생의 성적, 지원 성향, 대학별 전형 구조 및 공개된 입시 자료를 기반으로 입시 전략 및 학습 방향에 대한 분석과 자문을 제공하는 컨설팅 서비스입니다.\n본 서비스는 합격을 보장하거나 특정 결과를 약속하는 서비스가 아닙니다.\n제2조 (서비스 내용)\n제공되는 서비스는 다음을 포함할 수 있습니다.\n1. 성적 자료 기반 대학 지원 전략 분석\n2. 대학별 전형 구조 해석 및 비교\n3. 학습 방향 및 과목 전략에 대한 자문\n4. 참고용 분석 자료 및 보고서 제공\n※ 모든 내용은 의사결정을 돕기 위한 참고 자료이며, 최종 지원 및 선택의 책임은 이용자 본인에게 있습니다.\n제3조 (합격 비보장)\n스터디크랙은 입시 결과에 대한 합격, 불합격, 충원 여부 등 어떠한 결과도 보장하지 않습니다.\n입시는 매년 지원자 동향, 모집 인원, 외부 변수에 따라 달라질 수 있으며, 이에 대한 결과 책임은 이용자 본인에게 귀속됩니다.\n제4조 (자료 제공의 정확성)\n이용자가 제공한 성적, 지원 정보, 희망 사항 등이 사실과 다르거나 누락된 경우, 분석 결과의 정확성은 보장되지 않습니다.\n제5조 (데이터 출처 및 해석의 한계)\n본 서비스는 공개된 입시 자료 및 이용자가 제공한 정보를 기반으로 분석을 수행합니다.\n제공되는 분석, 비교, 시뮬레이션 결과는 스터디크랙의 해석 및 산출 방식에 따른 참고 자료이며,\n특정 대학, 교육기관, 입시 기관의 공식 입장이나 결과를 대변하지 않습니다.\n입시 제도, 전형 방식, 모집 인원, 데이터 기준은 변동될 수 있으며,\n이로 인해 실제 결과와 차이가 발생할 수 있습니다.\n제6조 (지적재산권)\n스터디크랙이 제공한 보고서, 분석 자료, 문서의 저작권은 스터디크랙에 있으며,\n이용자는 개인적 목적 외 제3자 제공, 복제, 배포를 할 수 없습니다.\n제7조 (분쟁 해결)\n본 약관에 명시되지 않은 사항은 관계 법령 및 일반 상관례를 따릅니다.\n제8조 (자동화 서비스의 한계)\n스터디크랙이 제공하는 자동 분석, 추천, 시뮬레이션 결과는\n공개된 데이터와 입력 정보를 기반으로 산출된 참고 자료이며,\n실제 입시 결과와 차이가 발생할 수 있습니다.\n제9조 (시스템 오류 면책)\n다음 사유로 발생한 손해에 대해 책임을 지지 않습니다.\n1. 시스템 오류, 서버 장애\n2. 데이터 지연, 누락\n3. 외부 기관 데이터 변경\n단, 본 조항은 별도 환불 규정의 회사 귀책 사유에 따른 환불 및 관계 법령에 따른 이용자의 권리를 제한하지 않습니다.\n제10조 (책임 제한)\n스터디크랙의 손해배상 책임은\n해당 이용자가 지급한 최근 3개월 이용 요금 총액을 초과하지 않습니다.\n단, 스터디크랙의 고의 또는 중과실로 인한 손해는 본 조항의 제한을 적용하지 않습니다\n상품 이용 및 환불 안내\n제1조 (현재 판매 상품)\n- BASIC은 분석 이용권, STARTER는 1회 플래너 진단(1주 계획), STANDARD와 PRO는 4주 이용권입니다.\n- 현재 판매 상품은 단건 결제이며 자동 갱신되지 않습니다. 이용 기간과 제공 범위는 구매한 상품의 안내를 확인해주세요.\n- 결제 완료 자체를 분석 착수로 간주하지 않으며, 실제 자료 검토·전략 설계·분석 작업의 개시 여부로 확인합니다.\n제2조 (환불 기준)\n- 환불은 별도 「스터디크랙 환불 규정」에 따릅니다. 분석 착수 전 요청은 전액 환불하고, 착수 후 또는 보고서·분석 자료 전달 후에는 해당 규정의 환불 제한과 예외 사항을 적용합니다.\n- 회사 귀책 사유 및 관계 법령에 따른 청약철회·환불 권리는 위 기준으로 제한되지 않습니다.\n- 이 약관의 다른 일반적 면책·책임 제한 문구와 환불 규정이 상충하는 경우 환불 규정을 우선 적용하며, 관계 법령을 우선합니다.\n제3조 (접수 및 확인)\n- 환불 신청은 contact@studycrack.co.kr 또는 070-8128-1126으로 접수할 수 있습니다.\n- 가입 이메일, 구매 상품과 결제일을 알려주세요. 비밀번호, 인증번호, 결제수단의 전체 정보를 보내지 마세요.\n- 계정 삭제와 환불 신청은 별도이며, 기존 구매 건은 구매 당시 약정과 관계 법령을 함께 확인합니다.\n제4조 (결과 책임)\n서비스에서 제공되는 정보는 참고용이며, 입시 결과 및 의사결정에 대한 책임은 이용자 본인에게 있습니다.",
    "revision": "clarified-e32dc9934385"
  },
  "refund": {
    "title": "스터디크랙 환불 규정",
    "body": "스터디크랙은 맞춤형 분석 및 컨설팅 서비스 특성상\n아래와 같은 환불 규정을 적용합니다.\n1. 분석 착수 전\n- 결제 완료 후 분석 착수 이전에 환불을 요청한 경우: 전액 환불\n※ 분석 착수란 이용자가 제공한 자료를 기반으로\n자료 검토, 전략 설계, 분석 작업 중 하나라도 개시된 시점을 의미합니다.\n※ 결제 완료 자체를 분석 착수로 간주하지 않습니다.\n2. 분석 진행 중\n- 분석이 이미 개시된 경우: 환불 불가\n(자료 검토, 전략 설계, 분석 작업이 포함됩니다)\n3. 보고서 제공 후\n- 보고서 또는 분석 자료가 이용자에게 전달 완료된 경우: 환불 불가\n4. 분석 착수 후 적용되는 환불 제한 사유\n- 단순 변심\n- 결과에 대한 주관적 불만족\n- 합격, 불합격, 충원 여부 등 입시 결과에 따른 환불 요청\n※ 본 서비스는 의사결정을 돕기 위한 분석 및 자문 서비스로,\n입시 결과에 대한 책임은 이용자 본인에게 있습니다.\n※ 분석 착수 전 요청은 단순 변심을 포함하여 제1항의 전액 환불 기준을 적용합니다.\n5. 예외 사항\n- 스터디크랙의 귀책 사유로 인해\n서비스 제공이 불가능하거나 중대한 하자가 발생한 경우에는\n관련 법령에 따라 환불이 이루어질 수 있습니다.\n- 위 환불 제한은 관계 법령에 따른 청약철회·환불 권리를 제한하지 않습니다. 가분적 서비스의 미제공 부분 등 법령상 환불 대상은 별도로 확인합니다.\n6. 적용 기준 및 접수\n- 환불 안내와 다른 일반적 면책·책임 제한 문구가 상충하면 이 환불 규정을 우선 적용하며, 관계 법령을 우선합니다.\n- 기존 구매 건은 구매 당시 약정과 관계 법령을 함께 확인합니다.\n- 접수: contact@studycrack.co.kr / 070-8128-1126\n- 가입 이메일, 구매 상품과 결제일을 알려주세요. 비밀번호, 인증번호, 결제수단의 전체 정보를 보내지 마세요.\n- 계정 삭제와 환불 신청은 별도입니다.",
    "revision": "clarified-973d15aef093"
  },
  "marketing": {
    "title": "마케팅 정보 수신 동의",
    "body": "“스터디크랙”(이하 “회사”)는 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 및 「개인정보 보호법」 등 관계 법령에 따라 광고성 정보를 전송하기 위해 이용자의 사전 동의를 받고 있습니다.\n\n1. 목적\n- 이메일 및 문자(SMS/LMS)를 통한 광고성 정보 전송\n- 스터디크랙 서비스, 이벤트, 혜택, 맞춤 입시 전략 및 합격 사례 안내\n\n2. 이용 항목\n- 휴대폰번호, 이메일주소\n\n3. 보유 및 이용 기간\n- 회원 탈퇴 또는 동의 철회 시까지\n\n※ 본 동의는 선택 사항이며, 동의하지 않아도 서비스 이용에는 제한이 없습니다.\n※ 이용자는 언제든지 수신 거부를 할 수 있습니다.",
    "revision": "legacy-546ccf247d0c"
  }
};
    // legal-content:end

    // innerHTML 대신 안전한 DOM 조작 (XSS 방지)
    function showError(msg) {
        const returnUrl = getSafeSocialReturnUrl();
        clearSocialReturnState();
        statusMsg.textContent = '';
        const span = document.createElement('span');
        span.style.color = '#dc2626';
        span.textContent = msg;
        const link = document.createElement('a');
        link.href = returnUrl || '/login';
        link.style.color = '#2563eb';
        link.textContent = returnUrl ? '앱으로 돌아가 다시 로그인하기' : '로그인 페이지로 돌아가기';
        statusMsg.appendChild(span);
        statusMsg.appendChild(document.createElement('br'));
        statusMsg.appendChild(document.createElement('br'));
        statusMsg.appendChild(link);
    }

    function getSafeSocialReturnUrl() {
        let value = '';
        let entry = '';
        try {
            value = sessionStorage.getItem('socialReturnUrl') || localStorage.getItem('socialReturnUrl') || '';
            entry = sessionStorage.getItem('socialEntry') || localStorage.getItem('socialEntry') || '';
        } catch (_) {
            value = '';
            entry = '';
        }
        if (entry !== 'mobile') return '';
        if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '';
        if (value.startsWith('/social-callback')) return '';
        return value;
    }

    function clearSocialReturnState() {
        try {
            sessionStorage.removeItem('socialReturnUrl');
            sessionStorage.removeItem('socialEntry');
            localStorage.removeItem('socialReturnUrl');
            localStorage.removeItem('socialEntry');
        } catch (_) {}
    }

    function setPendingSignupModalVisible(visible) {
        const modal = document.getElementById('socialSignupTermsModal');
        if (!modal) return;
        modal.classList.toggle('hidden', !visible);
    }

    function getSocialTermCheckboxes() {
        return Array.from(document.querySelectorAll('.social-required-term, #socialSignupMarketingConsent'));
    }

    function syncSocialAllConsentState() {
        const allConsent = document.getElementById('socialSignupAllConsent');
        if (!allConsent) return;
        const checkboxes = getSocialTermCheckboxes();
        allConsent.checked = checkboxes.length > 0 && checkboxes.every(chk => chk.checked);
    }

    function setupSocialTermsAllConsent() {
        const allConsent = document.getElementById('socialSignupAllConsent');
        const checkboxes = getSocialTermCheckboxes();
        if (allConsent) {
            allConsent.addEventListener('change', () => {
                checkboxes.forEach(chk => { chk.checked = allConsent.checked; });
            });
        }
        checkboxes.forEach(chk => {
            chk.addEventListener('change', syncSocialAllConsentState);
        });
    }

    function setupSocialTermDetailLinks() {
        document.querySelectorAll('[data-social-term-detail]').forEach(link => {
            link.addEventListener('click', event => {
                event.preventDefault();
                window.openSocialTermDetailModal(link.dataset.socialTermDetail);
            });
        });
    }

    window.openSocialTermDetailModal = function(termKey) {
        const detail = SOCIAL_TERM_DETAILS[termKey];
        const modal = document.getElementById('socialTermDetailModal');
        const titleEl = document.getElementById('socialTermDetailTitle');
        const textEl = document.getElementById('socialTermDetailText');
        if (!detail || !modal || !titleEl || !textEl) return;
        titleEl.textContent = detail.title;
        textEl.textContent = detail.body;
        textEl.scrollTop = 0;
        modal.classList.remove('hidden');
    };

    window.closeSocialTermDetailModal = function() {
        const modal = document.getElementById('socialTermDetailModal');
        if (modal) modal.classList.add('hidden');
    };

    async function finishSocialLogin(result, { isLinkMode = false } = {}) {
        const { userId, isNewUser } = result;

        if (!userId) {
            showError('로그인 처리에 실패했습니다. (사용자 ID 누락)');
            return;
        }

        if (typeof clearClientSession === 'function') {
            clearClientSession();
        } else if (typeof clearSharedClientSession === 'function') {
            clearSharedClientSession();
        }
        if (result.accessToken && typeof setAccessToken === 'function') {
            setAccessToken(result.accessToken);
        } else if (result.accessToken) {
            sessionStorage.setItem('accessToken', result.accessToken);
        }
        if (result.idToken && typeof setIdToken === 'function') {
            setIdToken(result.idToken);
        } else if (result.idToken) {
            sessionStorage.setItem('idToken', result.idToken);
        }
        if (result.refreshToken && typeof registerRefreshCookie === 'function') {
            try {
                await registerRefreshCookie(result.refreshToken, {
                    accessToken: result.accessToken,
                    idToken: result.idToken,
                    replaceExisting: true
                });
            } catch (_) {}
        }
        localStorage.setItem('userId', userId);
        localStorage.setItem('userRole', 'student');

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'login', user_id: userId });

        statusMsg.textContent = isLinkMode ? '연동 완료! 마이페이지로 이동 중...' : '로그인 완료! 이동 중입니다...';

        const userRes = await fetch(USER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(result.accessToken ? { Authorization: `Bearer ${result.accessToken}` } : {})
            },
            credentials: 'include',
            body: JSON.stringify({ type: 'get_login_profile' })
        });

        if (userRes.ok) {
            const userData = await userRes.json();
            localStorage.setItem('userName', userData.name || '');
            if (userData.computedTier) localStorage.setItem('userTier', userData.computedTier);
        }

        const socialReturnUrl = getSafeSocialReturnUrl() || (startedFromMobile ? '/studycrack-mobile.html' : '');
        clearSocialReturnState();

        if (isLinkMode) {
            window.location.href = socialReturnUrl || '/mypage';
            return;
        }

        window.location.href = socialReturnUrl || (isNewUser ? '/welcome' : '/');
    }

    window.closePendingSocialSignupTermsModal = function() {
        setPendingSignupModalVisible(false);
        showError('소셜 회원가입이 완료되지 않았습니다.');
    };

    window.confirmPendingSocialSignupTerms = async function() {
        const requiredTerms = Array.from(document.querySelectorAll('.social-required-term'));
        const allRequiredChecked = requiredTerms.length > 0 && requiredTerms.every(chk => chk.checked);
        if (!allRequiredChecked) {
            alert('소셜 회원가입을 진행하려면 필수 약관에 모두 동의해주세요.');
            return;
        }
        if (!pendingSocialSignup || !pendingSocialSignup.pendingSignupToken) {
            showError('소셜 회원가입 대기 정보가 없습니다. 다시 시도해주세요.');
            return;
        }

        const marketingEl = document.getElementById('socialSignupMarketingConsent');
        setPendingSignupModalVisible(false);
        statusMsg.textContent = '회원가입을 완료하고 있습니다...';

        try {
            const completeRes = await fetch(AUTH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    type: 'social_complete_signup',
                    pendingSignupToken: pendingSocialSignup.pendingSignupToken,
                    termsAgreed: true,
                    signupConsent: { schema: 1, age14Confirmed: document.getElementById('socialSignupAge14')?.checked === true, documents: Object.fromEntries(Object.entries(SOCIAL_TERM_DETAILS).map(([id, doc]) => [id, { revision: doc.revision, accepted: id === 'marketing' ? marketingEl?.checked === true : true }])) },
                    marketingAgreed: marketingEl && marketingEl.checked === true
                })
            });
            const completeResult = await completeRes.json().catch(() => ({}));
            if (!completeRes.ok) {
                showError(completeResult.error || `회원가입 처리에 실패했습니다. (HTTP ${completeRes.status})`);
                return;
            }
            await finishSocialLogin(completeResult);
        } catch (e) {
            showError('가입 처리 결과를 확인하지 못했어요. 같은 소셜 계정으로 다시 로그인해주세요. 이미 저장된 가입 정보와 동의는 유지됩니다.');
        }
    };

    setupSocialTermsAllConsent();
    setupSocialTermDetailLinks();

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const errorParam = params.get('error');

    // 1. 오류 파라미터 확인
    if (errorParam) {
        showError('소셜 로그인이 취소되었습니다.');
        sessionStorage.removeItem('socialState');
        clearSocialReturnState();
        return;
    }

    if (!code || !returnedState) {
        showError('인증 처리 중 오류가 발생했습니다. (파라미터 누락)');
        return;
    }

    // 2. CSRF state 검증
    const savedState = sessionStorage.getItem('socialState');
    const isLinkMode = sessionStorage.getItem('socialLinkMode') === 'true';
    sessionStorage.removeItem('socialState');
    sessionStorage.removeItem('socialLinkMode');

    if (!savedState || savedState !== returnedState) {
        showError('보안 검증에 실패했습니다. 다시 시도해 주세요.');
        clearSocialReturnState();
        return;
    }

    // state 형식: {nonce}|{provider}[|{purpose}]
    // purpose를 state에 인코딩해 OAuth 리다이렉트 후에도 의도 보존
    const stateParts = savedState.split('|');
    if (stateParts.length < 2) {
        showError('인증 처리 중 오류가 발생했습니다. (state 오류)');
        return;
    }
    const provider = stateParts[1];
    const statePurpose = stateParts[2] || '';
    const startedFromMobile = statePurpose === 'mobile';

    if (!['google', 'naver'].includes(provider)) {
        showError('지원하지 않는 로그인 방식입니다.');
        return;
    }
    const callbackUrl = CONFIG.social.callbackUrl;

    // 3. 서버에 인증 code 전달.
    try {
        statusMsg.textContent = statePurpose === 'delete_reauth' ? '본인 확인 중입니다...' : '계정 정보를 확인하고 있습니다...';

        const res = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                type: 'social_callback',
                provider,
                code,
                redirectUri: callbackUrl,
                ...(statePurpose === 'delete_reauth' && { purpose: statePurpose })
            })
        });

        let result;
        try {
            result = await res.json();
        } catch (jsonErr) {
            console.error('[SocialCallback] JSON parse error:', jsonErr, 'HTTP status:', res.status);
            showError(`인증 처리 중 오류가 발생했습니다. (응답 파싱 실패, HTTP ${res.status})`);
            return;
        }

        if (res.ok && result.requiresTerms && result.pendingSignupToken) {
            pendingSocialSignup = { pendingSignupToken: result.pendingSignupToken };
            statusMsg.textContent = '신규 회원가입을 완료하려면 약관 동의가 필요합니다.';
            setPendingSignupModalVisible(true);
            return;
        }

        if (!res.ok) {
            console.warn('[SocialCallback] Request failed:', { status: res.status });
            if (res.status === 409) {
                showError(result.error || '이미 동일 이메일로 가입된 계정이 있습니다. 기존 이메일/비밀번호로 로그인해 주세요.');
            } else {
                showError(result.error || `로그인 처리에 실패했습니다. (HTTP ${res.status})`);
            }
            return;
        }

        // 3-a. 탈퇴 재인증 응답 처리 (full login 없이 deleteConfirmToken만 발급)
        if (result.deleteReauthVerified && result.deleteConfirmToken) {
            sessionStorage.setItem('deleteConfirmToken', result.deleteConfirmToken);
            window.location.href = getSafeSocialReturnUrl() || '/mypage?reauth=success&purpose=delete_account';
            return;
        }

        // 4. 연동 모드 + 새 계정 생성된 경우: 기존 세션 보관 후 확인
        if (isLinkMode && result.isNewUser) {
            const prevUserId = localStorage.getItem('userId');
            const socialReturnUrl = getSafeSocialReturnUrl() || (startedFromMobile ? '/studycrack-mobile.html' : '');

            const confirmed = confirm(
                '연동하려는 소셜 계정의 이메일이 현재 계정과 달라\n새로운 별도 계정이 생성되었습니다.\n\n' +
                '새 계정으로 계속 진행하시겠습니까?\n(취소 시 기존 계정을 유지합니다)'
            );

            if (!confirmed) {
                if (prevUserId) localStorage.setItem('userId', prevUserId);
                clearSocialReturnState();
                window.location.href = socialReturnUrl || '/mypage';
                return;
            }

            localStorage.setItem('userId', result.userId);
            localStorage.setItem('userRole', 'student');
            clearSocialReturnState();
            window.location.href = socialReturnUrl || '/welcome';
            return;
        }

        await finishSocialLogin(result, { isLinkMode });

    } catch (e) {
        console.error('[SocialCallback] Unhandled error:', {
            name: e.name,
            message: e.message
        });
        const hint = e.name === 'TypeError' ? ' (네트워크 문제 의심)' : e.name === 'SyntaxError' ? ' (서버 응답 파싱 실패)' : '';
        showError(`인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.${hint}`);
    }
})();

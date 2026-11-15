# AWS 적용 대기 — SEO edge 설정

현재 파일은 로컬 후보이며 운영 적용 완료가 아닙니다. 대상 정적 사이트 배포 ID는 기존 배포 workflow의 `EV58SGU5XCI3O`입니다. API 배포와 혼동하지 마세요.

1. 현재 CloudFront DistributionConfig, ETag, Function/Lambda@Edge 연결, 응답 헤더 정책, ACM 인증서와 DNS 레코드를 먼저 저장합니다. 기존 정책과 기능은 보존합니다.
2. 코드 배포로 `/404.html`, `/css/not-found.css`, 새 공유 이미지가 200 응답하는지 확인합니다.
3. `error-responses.json`의 두 항목을 현재 CustomErrorResponses에 병합합니다. 403→404는 S3의 없는 객체 응답을 위한 설정입니다. WAF 차단이나 별도 인증 경로에 같은 정책을 무조건 적용하지 마세요. 나머지 5xx 설정은 유지합니다. 없는 주소의 최종 응답은 404여야 하며 200으로 바꾸지 않습니다.
4. `viewer-request.js`의 정규화 로직을 기존 viewer-request 처리의 **맨 앞**에 통합합니다. 기존 `.html` 재작성과 비공개 경로 차단을 제거하면 안 됩니다. 이미 Lambda@Edge를 사용 중이면 같은 코드 취지를 기존 처리에 통합합니다. 단독 교체용 코드가 아닙니다. 중복 쿼리 값과 인코딩된 값을 보존합니다. 로그인·결제 콜백 POST는 정규화하지 않습니다.
5. 응답 정책 JSON은 HSTS·nosniff·Referrer-Policy 후보입니다. 기존 CSP·CORS 정책에 병합하고 각 정적 behavior와 오류 응답을 확인합니다. `includeSubDomains`·preload는 활성화하지 않습니다. CSP는 실제 로그인·결제·업로드 의존성을 검증하기 전 전역 강제하지 않습니다.
6. www: us-east-1 ACM 인증서에 `studycrack.co.kr`과 `www.studycrack.co.kr`을 포함하고 DNS 검증을 마칩니다. 검증 완료 인증서를 CloudFront에 연결하고 Alternate domain name에 www를 추가합니다. 그 후 Route 53에서 www A/AAAA Alias를 해당 배포 도메인으로 연결합니다. 등록 DNS가 Route 53이 아니면 해당 제공자의 www CNAME을 사용합니다. 루트 도메인 레코드는 바꾸지 않습니다.
7. 배포 완료 후 `/service/`, `/service.html`, `/service.html/?utm_source=test`가 단일 301로 canonical로 이동하고 쿼리가 보존되는지 확인합니다. 정규 URL·정적 자산은 계속 200, 없는 임의 주소는 한국어 404, www는 인증서 오류 없이 루트로 이동해야 합니다.
8. 문제가 생기면 저장한 ETag/설정으로 기존 function 연결·헤더·오류 설정·DNS를 복구합니다. 설정별로 단계 적용하고 공개 응답 확인 후 다음 단계로 진행합니다.

공식 근거:
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/creating-custom-error-pages.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
- https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https-alternate-domain-names.html

AWS OTP 접근이 가능해진 뒤 실제 설정을 읽고 병합해야 합니다.

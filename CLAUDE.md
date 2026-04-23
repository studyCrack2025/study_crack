# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 가장 먼저 읽어야 하는 최상위 목차(Map)이자 필수 지침입니다. 구체적인 도메인 지식은 `docs/` 폴더의 문서를 참조합니다.

## 핵심 원칙 (Golden Principles)
- 보안 최우선: 코드를 작성하거나 수정할 때 보안상 취약하거나 불안정한 방식은 절대 배제합니다. 반드시 검증되고 안전한 방식으로만 코드를 제공합니다. (세부 지침: `docs/security/`)
- CSS 컨벤션: 각 클래스는 서로 다른 줄로 나누어 작성하며, 동일한 클래스 내부의 속성들은 줄바꿈이나 들여쓰기 없이 띄어쓰기만 유지한 채 한 줄로 이어서 작성합니다. (세부 지침: `docs/design-docs/index.md`)

## 지식 베이스 (Knowledge Base Map)
- `ARCHITECTURE.md` — 프론트엔드/백엔드 아키텍처, API 엔드포인트 전체 목록, DynamoDB 테이블, S3 버킷, Cognito 그룹, LocalStorage 구조, 등급 시스템
- `docs/frontend-reference.md` — JS 파일별 상세 명세 (함수 목록, API 호출 패턴, DOM 요소, 주의사항)
- `docs/backend-reference.md` — Lambda 함수별 상세 명세 (DynamoDB 스키마, S3 폴더 구조, 환경변수, 외부 서비스 API, 보안 패턴, EventBridge 스케줄)
- `docs/design-docs/index.md` — UI/UX 디자인 가이드 및 CSS 코딩 규칙
- `docs/exec-plans/active/` — 현재 진행 중인 핵심 개발 목표 4가지
- `docs/exec-plans/completed/` — 완료된 배포 내역
- `docs/exec-plans/tech-debt-tracker.md` — 해결해야 할 기술 부채 및 보안/구조적 이슈
- `docs/security/` — 프론트엔드 및 백엔드 필수 보안 검증 체크리스트
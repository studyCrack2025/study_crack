/**
 * 로컬 디자인 테스트용 mock 데이터 템플릿
 *
 * 사용법:
 *   1. 이 파일을 같은 폴더에 dev-mock.local.js 로 복사
 *   2. 필요한 값 수정 후 로컬 서버 실행
 *
 * dev-mock.local.js 는 .gitignore 처리되어 절대 커밋/배포되지 않습니다.
 * 이 example 파일만 git에 존재합니다.
 */
window.DEV_MOCK = {
    enabled: true,   // false 로 바꾸면 mock 전체 비활성화

    // 공통 유저 정보 (mypage / survey / analysis 등에서 공유)
    user: {
        name: '디자인 테스트',
        email: 'test@studycrack.co.kr',
        phone: '010-0000-0000',
        mbti: 'INTJ',
        tier: 'pro'   // 'basic' | 'standard' | 'pro'
    },

    // /analysis 전용
    analysis: {
        targetUnivs: [
            { univ: '서울대학교', major: '컴퓨터공학부' },
            { univ: '연세대학교', major: '경영학과' },
            null, null, null, null
        ],
        qualitative: { status: '재수생', stream: 'natural' },
        quantitative: { csat: { kor: 90, math: 95, eng: 1 } },
        univChangeRemaining: 30,
        // 목표대학 기본분석 카드
        cards: [
            { idx: 0, univ: '서울대학교', major: '컴퓨터공학부', color: '#ef4444', status: '소신 지원 (C-)', msg: '문닫고 합격 가능성', converted_score: 88 },
            { idx: 1, univ: '연세대학교', major: '경영학과',    color: '#10b981', status: '안정 (A)',       msg: '무난한 합격 예상',   converted_score: 155 }
        ],
        // 점수 시뮬레이션
        simData: [
            { univ: '서울대학교', major: '컴퓨터공학부', base_ui_score: 88,  sim_data: { kor: { uiDiff: 10 }, math: { uiDiff: 15 } } },
            { univ: '연세대학교', major: '경영학과',    base_ui_score: 155, sim_data: { kor: { uiDiff: 5  }, math: { uiDiff: 8  } } }
        ]
    }
};

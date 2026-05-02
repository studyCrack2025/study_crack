// js/shared/store.js
// sessionStorage 기반 경량 공유 스토어
// 탭 내 페이지 이동 시 상태 유지 (탭/창 닫으면 자동 소멸)

const Store = (() => {
    const PREFIX = 'scStore_';

    return {
        /**
         * 값 저장
         * @param {string} key
         * @param {*} value
         * @param {number} ttlSec  만료 시간(초). 0이면 만료 없음.
         */
        set(key, value, ttlSec = 0) {
            const entry = { v: value, ts: Date.now(), ttl: ttlSec * 1000 };
            try {
                sessionStorage.setItem(PREFIX + key, JSON.stringify(entry));
            } catch (e) {
                console.warn('[Store] 저장 실패 (용량 초과 등):', e);
            }
        },

        /**
         * 값 조회. 만료된 경우 null 반환 및 자동 삭제.
         * @param {string} key
         * @returns {*|null}
         */
        get(key) {
            try {
                const raw = sessionStorage.getItem(PREFIX + key);
                if (!raw) return null;
                const entry = JSON.parse(raw);
                if (entry.ttl > 0 && Date.now() - entry.ts > entry.ttl) {
                    sessionStorage.removeItem(PREFIX + key);
                    return null;
                }
                return entry.v;
            } catch (e) {
                return null;
            }
        },

        /**
         * 특정 키 삭제
         * @param {string} key
         */
        clear(key) {
            sessionStorage.removeItem(PREFIX + key);
        },

        /**
         * Store 전체 초기화 (다른 sessionStorage 항목은 유지)
         */
        clearAll() {
            Object.keys(sessionStorage)
                .filter(k => k.startsWith(PREFIX))
                .forEach(k => sessionStorage.removeItem(k));
        }
    };
})();

import { defineConfig } from 'vite';

// Phase 7 스캐폴드: 모듈 소스를 단일 번들로 빌드(런타임 셸 엔트리).
// 산출물 경로/HTML 연결은 별도 스위치 커밋에서 deploy.yml 캐시 패턴과 함께 확정한다.
// 현재는 빌드 파이프라인 동작 검증용으로 dist/에 출력.
export default defineConfig({
  // .jsx 화면 컴포넌트(JSX 점진 이관)를 자동 런타임으로 트랜스파일. react/jsx-runtime 사용 → 파일별 React import 불필요.
  esbuild: {
    jsx: 'automatic'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/runtime/main.js',
      output: {
        entryFileNames: 'studycrack-mobile.bundle.js',
        format: 'iife'
      }
    }
  }
});

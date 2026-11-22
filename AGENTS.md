# ASHEN CITY · 잔해의 도시

- 프로젝트 키: CITY. 도시 봉건 아포칼립스 싱글플레이 브라우저 게임.
- 명령·사건은 `src/engine.ts`, 1시간 원장·배정은 `src/economy.ts`, 시간은 `src/time.ts`, 저장 검증·이관은 `src/save.ts`, 브라우저 I/O는 `src/storage.ts`에 둔다. 초기 데이터는 `src/data.ts`, 건물 프로필은 `src/buildings.ts`, 수치는 `src/config.ts`, 타입은 `src/model.ts`다. React UI와 시뮬레이션을 분리한다.
- 저장은 v2이며 기존 v1 슬롯 이름·원본 백업·마이그레이션을 유지한다. UI 복원은 중복 부재 계산을 막는 `resumeGame`을 사용한다. `docs/STAGE_ONE.md`에 시간·작업·경제 처리 순서와 한계를 기록했다.
- `npm test`는 핵심 시뮬레이션과 운영 서버 검사, `npm run build`는 타입 검사와 Vite 빌드다. 변경 동작에 필요한 최소 검사만 수행하며 관련 변경 없이 통과한 검사를 반복하지 않는다.
- 화면 검증은 기본적으로 사용자에게 맡긴다. 전체 화면·전체 사이트 캡처/회귀 검사는 금지한다.
- 운영은 `ecosystem.config.js`의 PM2 앱 `city`, 루프백 `127.0.0.1:8402`, 공개 주소 `https://city.lomebrote.com`이다. Node 정적 서버 `server.mjs`가 `dist/`만 제공한다. `/api/health`는 빌드 진입점과 번들 존재를 확인한다.
- 배포 시 `npm ci` → `npm run build` → PM2 앱 재시작 순서를 지킨다. DNS·공용 Cloudflare 터널 변경은 dev의 서비스 연결 기능을 사용한다.
- 새 외부 서비스·서버 DB·게임 시스템을 임의로 확장하지 않는다. 저장은 브라우저별 localStorage와 JSON 파일이다.
- `.env`와 키·자격 증명을 커밋하거나 로그에 출력하지 않는다. 원본 기획은 `PROJECT_SPEC.md`, 플레이 안내와 현재 한계는 `README.md`에 보관한다.

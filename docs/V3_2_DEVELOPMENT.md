# ASHEN CITY v3.2 구현 및 검증 기록

2026-11-22 · 제품 0.3.2 · 저장 버전 2 유지. 기준 `2df03ec`(0.3.1), 작업 브랜치 `feat/v3-2-city-overlays`. 운영 빌드 보존을 위해 `.release-stage`에서 검증했다.

## 단계별 결과

| 단계 | 결과 | 검증 |
| --- | --- | --- |
| A 카메라 | 완료 | 수정 전 오른쪽 드래그 무변화 재현 → 수정 후 실제 왼쪽/오른쪽/휠 입력, 회전 후 이동, 일시정지 카메라, 드래그 오선택 방지 통과 |
| B 영구 도시 | 완료 | Canvas DOM 동일성, 카메라 위치/목표/줌 유지, 오버레이에서 프레임 정지와 종료 후 재개 |
| C 건물 라이트박스 | 완료 | 대형 내부·선택 주민/방·카메라 세션·복귀·Escape·모바일 |
| D 운영실 오버레이 | 완료 | 기존 기능·탭·입력·스크롤 유지, 단일 HUD, 건물 복귀, 가이드 종료 후 복귀 |
| E 실제 상태 피드백 | 완료 | 엔진 복구 명령부터 완공, 전력 배분·잔여 출력·수요 미충족·주민 욕구·v2 JSON 가져오기 검증 |
| F 안정화 | 기능 검증 완료, 성능 목표 미확인 | 71 단위 테스트·브라우저 9개 검사·타입·빌드. 소프트웨어 렌더링에서는 30 FPS 미달 |

## 실제 원인과 카메라 수정

기준 빌드에서 동일한 네이티브 마우스 입력으로 우측 드래그 전후 카메라 위치·목표가 동일한 것을 재현했다. 팬도 부분적으로만 이동했다. 설치된 Drei `MapControls`는 onChange/onStart 등의 콜백이 변경되면 effect를 정리하고 controls.dispose/connect를 다시 실행한다. 기존 인라인 콜백은 FPS 보고 등 React 재렌더마다 새로 생성됐다. 기준 빌드의 EventTarget 계측에서 약 3.7초 동안 wheel 리스너 제거가 초기화를 포함해 3회 관찰됐다. 조작 도중에도 리스너/controls가 재설정되는 문제가 있었다.

콜백을 useCallback으로 고정하고 controls를 실제 `gl.domElement`에 명시적으로 연결했다. Three MOUSE 상수로 LEFT=PAN, RIGHT=ROTATE, MIDDLE=DOLLY를 지정했다. 프레임마다 중복 호출하던 controls.update는 경계 보정이 실제 필요한 때만 호출한다. 수정 후 동일 입력 테스트에서 리스너 재연결 0회, 팬·회전·줌과 회전 후 팬 모두 통과했다. 투명 HTML이 덮고 있었다고 추정해서 처리하지 않았다.

PointerGesture는 누른 위치로부터 최대 거리가 6 CSS px 이상이면 클릭을 억제한다. 원래 위치로 되돌아오는 드래그도 클릭으로 간주하지 않는다. 방향키·Q/E·F·+/−와 기존 보조 버튼은 유지한다. 오버레이에서는 입력을 끄고 카메라 감속 잔여분을 제거해 덮기 전 카메라를 보존한다.

## 화면 구조와 상태 보존

```
App (단일 GameState·시간 루프·저장)
└─ GameShell (단일 overlay 상태·선택 건물·UI session)
   ├─ CityView / Canvas (계속 마운트)
   └─ OverlayHost (도시 HUD 또는 활성 dialog)
      ├─ GameHUD / 단일 GameNavigation
      ├─ OverlayHeader (닫기·도시·다른 오버레이)
      └─ BuildingView 또는 ManagementView
```

`overlay=none|building|management`만 화면 상태로 소유하고 기존 GameView는 여기서 파생한다. CityView는 교체하지 않는다. 가려진 도시는 inert/aria-hidden·포인터 차단 및 R3F frameloop=never로 입력·렌더링을 멈추지만 App의 시뮬레이션은 계속된다. 종료 시 현재 상태의 도시가 같은 카메라로 재개된다. BuildingView는 열 때 Pixi를 만들고 종료 때 Application·ticker·자식·리스너를 정리한다. 임시 내부 카메라/주민 위치는 UI session에 보관한다.

ManagementView는 숨겨진 상태로 유지해 기존 탭·필터·입력·스크롤을 보존한다. 건물에서 관리로 진입할 때 기존 건물 관리 탭을 연다. 새 캠페인에서는 세션과 ManagementView를 재생성하고 잘못된 건물 ID는 거점으로 보정한다. 별도 GameState나 시뮬레이션 타이머를 만들지 않았다.

오버레이는 한 개만 표시하며 건물 약 90%, 관리 약 94%, 모바일 전체 크기다. 배경은 0.55 어두움, 전환 180ms, reduced-motion에서는 즉시 전환한다. 기존 대시보드의 중복 헤더/화면 내비게이션 대신 공통 HUD와 운영실 헤더를 사용한다. 관리 자체 탭·저장·불러오기·JSON·외교·정책·로그는 유지한다.

OverlayHost가 포커스를 dialog로 이동·제한하고 닫을 때 열었던 컨트롤로 돌려준다. Escape는 가이드/초기화 확인창을 먼저 닫는다. 계승처럼 필수 선택은 기존 규칙을 유지한다. 주요 오버레이 배경 클릭 닫기는 없다. 같은 URL의 history state 한 항목을 사용해 뒤로 가기는 오버레이를 닫으며 내부 전환은 replace한다. 빠른 닫기/재열기의 비동기 popstate도 처리한다.

## 시뮬레이션 피드백

읽기 전용 Presentation Adapter가 기존 economy 원장·배정·복구 수치를 읽는다. 경제/전투/외교/작위/시간/저장 규칙은 변경하지 않았다.

- 복구 중인 도시 건물에 비계·자재·작업등·실제 진행 막대. 완공 후 비계/파손을 제거하고 시설 옥상 구조물과 운영 외형으로 갱신한다. 시설 전환 중에는 기존 생산을 표시하지 않는다.
- 전력은 저장 재고가 아닌 실제 시설별 공급 비율을 사용한다. 창문과 실내 조명의 점등 비율, 실제 효율에 따른 기계 활동을 반영한다. 잔여 생산이 있으면 완전 중단으로 표시하지 않는다.
- 주민은 실제 ID·현장 배정·부상에 연결한다. 작업자 없는 시설의 생산 애니메이션을 끄며, 미점령 건물에는 플레이어 주민을 표시하지 않는다. 사망자는 기존 연결에 따라 사라진다.
- HUD의 자원 경고는 실제 `unmet`을 기준으로 한다. 재고 0만으로 부족을 단정하지 않는다. 주민의 실제 허기/갈증 수치와 표식을 제공하지만 새로운 생산 중단 규칙은 추가하지 않는다.
- 복구가 끝난 건물의 여분 구획은 예비 구획으로 표시한다. 기존 경제에 없는 연구·추가 층별 생산을 만들어내지 않는다. 일반 거점에 대표 쉘터 이름을 붙이던 렌더링 제목도 수정했다.

기존 렌더러·레이아웃을 재사용하고 최소 상태 피드백만 보강했다. 새로운 주민 AI, 생활 주기, 물류, 관계, 연구와 대규모 사건은 구현하지 않았다.

## 테스트와 측정

Node 26.7 / npm 12 / TypeScript 5.9 / Playwright 1.65.1 / Chromium 159.0.8154.6. 렌더링 라이브러리는 기존 Three 0.187 / R3F 9.8.2 / Drei 10.7.9 / Pixi 8.23을 유지했다.

- `npm ci` 성공. `npm test`: **11 파일, 71개 통과**. 기존 경제·전투·외교·남작 경로·저장 이관 회귀 포함.
- `npm run build -- --outDir .release-stage`: **TypeScript 검사와 프로덕션 빌드 통과**, Vite 7.3.8, 2936 모듈. 성능 검사 코드의 optional CDP 속성 타입 오류 1건을 수정했다. 도시 지연 로딩 번들 971.33kB(압축 263.17kB)로 500kB 경고가 남지만 빌드 오류는 없다.
- Playwright 주요 검사 **8개 통과(3.3분)**: 실제 마우스, 엔진 복구/완공, v2 JSON 전력·욕구 부족, 오버레이/스크롤/포커스, Escape/히스토리, 반복 안정성, 390px 모바일, 실제 WebGL 비지원 대체.
- 별도 워밍업 후 연속 성능 검사 **1개 통과(17.7초)**. 이는 측정 성공이며 FPS 목표 통과를 의미하지 않는다.
- 반복 경로를 각각 **20회**, 총 **160번 전환**했다. 도시 Canvas가 동일하고 active=1/disposed=0. 건물 이탈 시 Pixi 종료, 도시 복귀 후 실제 마우스 세 동작 정상. 가려진 도시 프레임 카운터는 정지한다.
- 반복 전후 canvas/document/window 네이티브 이벤트 리스너 수 동일. GPU geometry **411**, texture **4** 유지. 오류 및 WebGL context 초과 경고 0건.
- 명시적 GC 후 JS heap: 준비 후 **18,743,664B**, 건물 경로 후 **20,897,176B**, 관리 경로 후 **21,145,852B**, 복합 경로 후 **21,989,596B**. 약 3.1 MiB 증가했으므로 장시간 메모리 누수 부재를 단정하지 않는다.
- 전체 화면 캡처/회귀는 하지 않았다. 건물 일부·헤더·복구 전후·부족 상태·모바일 헤더의 작은 영역만 확인했다. 테스트용 독립 브라우저 프로필을 사용했으며 실제 사용자 저장을 가져오거나 덮어쓰지 않았다.

### 성능 한계

1280×800 headless Chrome은 CDP SystemInfo에서 **ANGLE / Vulkan SwiftShader (SwANGLE 5.0)** 소프트웨어 렌더러로 확인됐다. 워밍업 이후 세 번째 측정 표본은 도시 **10 FPS, p95 102ms**, 내부 실행 상태 **28 FPS, p95 50ms**. 반복 전환 직후는 도시11·내부27 FPS였다. 실제 GPU 가속 데스크톱에서 30/60 FPS를 달성했다고 주장하지 않는다. GPU 장치에서의 추가 실측, 그림자/DPR 품질 옵션과 재질·메시 공유 최적화가 다음 우선순위다. 이 성능 목표는 이번 인수의 미충족/미확인 항목으로 남긴다.

원시 결과는 git 제외 `.dev-checks/playwright-results.json`, `stability-measurements.json`, `steady-performance.json`에 보관한다. 브라우저 테스트는 `npm run test:browser`; `.release-stage`를 먼저 빌드해야 한다. 특정 배포 검사는 `CITY_BROWSER_URL`을 설정해 서버 자동 기동 없이 실행한다.

## 저장 호환성

GameState 버전은 2이며 스키마를 바꾸지 않았다. v1→v2 이관과 기존 localStorage 슬롯/백업·JSON 왕복을 유지한다. 카메라/오버레이/history·프레임·주민 이동은 저장에 추가하지 않는다. v2 JSON을 실제 가져오기 UI로 읽어 상태와 시각화 연결을 검증했다. 여러 탭 동시 저장과 계정 동기화는 기존처럼 지원하지 않는다.

## 변경 파일

| 영역 | 파일 |
| --- | --- |
| 공통 셸 | `src/App.tsx`, `src/game/GameShell.tsx`, `OverlayHost.tsx`, `OverlayHeader.tsx`, `useOverlayNavigation.ts`, `overlays.css`, `src/management/ManagementView.tsx` |
| 도시 입력/생명주기 | `src/game/city/CityCamera.tsx`, `CityInteraction.ts`, `CityView.tsx`, `CityScene.tsx` |
| 도시 피드백 | `src/game/city/CityBuilding.tsx`, `CityEffects.tsx` |
| 내부 피드백/배치 | `src/game/building/BuildingScene.ts`, `BuildingView.tsx`, `FloorRenderer.ts`, `RoomRenderer.ts`, `ResidentRenderer.ts` |
| 투영/HUD/측정 | `src/game/presentation/GamePresentation.ts`, `src/game/hud/GameHUD.tsx`, `RendererStats.tsx`, `src/game/performance.ts` |
| 단위 테스트 | `tests/city-interaction.test.ts`, `navigation.test.tsx`, `simulation-feedback.test.ts` |
| 브라우저 | `tests/browser/helpers.ts`, `camera.spec.ts`, `overlays.spec.ts`, `feedback.spec.ts`, `stability.spec.ts`, `performance.spec.ts`, `playwright.config.ts` |
| 실행/문서 | `package.json`, `package-lock.json`, `vitest.config.ts`, `server.mjs`, `README.md`, `AGENTS.md`, 이 기록 |

## 남은 항목과 다음 단계

GPU 가속 장치의 FPS 목표 확인과 저사양 품질 조절이 남았다. 60회 경로 반복은 장시간 누수 검증을 대신하지 않는다. 내부 방은 여전히 표시용 고정 레이아웃이며 층별 독립 경제가 아니다. 오버레이 복귀는 UI 세션만 보존하고 새로고침 시 초기화한다. 다음은 렌더링 비용 최적화 및 GPU 프로파일링을 먼저 수행하고, 이후 별도 기획으로 생활 주기·누적 도시 변화·위기 대응을 다룬다.

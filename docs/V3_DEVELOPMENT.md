# ASHEN CITY v3 개발 기록

2026-11-22. 기준 `fedb4ef`(v2), 개발 브랜치 `feature/v3-spatial-world`. 제품 버전은 0.3.0이며 **게임 저장 버전은 2**다. 최종 검증 전까지 운영 `dist/`를 교체하지 않고 `.release-stage/`에 빌드했다.

## 단계별 결과

| 단계 | 결과 | 검증 |
| --- | --- | --- |
| A 공유 기반 | 완료 | 단일 상태·화면 전환·기존 관리 통합, 48개 테스트·타입·빌드 통과 |
| B 3D 도시 | 완료 | 실제 20개 ID/위치·유형별 건축·도로·카메라·선택·명령·상태 표현, 52개 테스트·타입·빌드 통과 |
| C 건물 내부 | 완료 | Pixi 5층 쉘터·계단·시설 설비·방/층 선택·이동/줌, 관련 11개 테스트·타입·빌드·브라우저 확인 |
| D 주민 | 완료 | 실제 10명 인체 리깅·6종 상태·작업별 동작·BFS 계단 경로, 관련 15개 테스트·타입·빌드 통과 |
| E 엔진 연결 | 완료 | 배정·외근·부상·사망·복구/전환·출력·경고·정지·저장 왕복, 전체 61개 테스트 통과 |
| F 프로토타입 품질 | 완료 | 라벨/레이아웃/관리 진입 개선·실제 프레임 측정·반복 전환·리소스 정리·브라우저 검증 |

단계 A의 연결용 임시 화면은 B/C에서 실제 렌더러로 교체했다. 위 완료는 이번 소규모 시각화 프로토타입 범위다. 상용 아트 완성도, 모든 장치의 60 FPS, 장시간 누수 부재까지 검증했다는 의미는 아니다.

## 아키텍처와 주요 결정

`App.tsx`가 기존 GameState·시간 루프·저장을 계속 소유한다. GameShell은 City/Building/Management를 전환할 뿐 경제를 실행하지 않는다. 선택 건물도 App의 기존 상태를 공유한다. 일반 관리 진입은 이전 탭을 유지하고, 건물 관리 버튼은 선택 건물의 기존 지도/상세 탭을 연다.

`GamePresentation.ts`는 `economy()`의 실제 원장·배정·시설 정보를 읽어 도시/방/주민 투영을 계산하는 순수 함수다. 렌더러에는 생산·전투 결과를 변경하는 규칙을 두지 않았다. 이동 도착 시점도 생산과 무관하다. 기존 엔진·경제·시간·저장·데이터·수치 모듈은 변경하지 않았다.

도시는 R3F로 유형별 모듈 메시와 instancing을 구성하고 Drei MapControls로 상공 카메라를 제한한다. 지면/보도/차선/교차로, 버려진 차, 고가 구조물, 나무/관목/잔해, 안개·그림자·작업등, 손상된 외벽/창문/출입구/옥상 설비를 직접 제작했다. 확보 표식, 공사 비계, 운영 조명/농장/발전 활동으로 상태를 구별한다. 도시 버튼은 기존 ActionButton/actionInfo를 사용한다.

내부는 Pixi Application 한 개와 고정 층/방/계단 그래프다. 방마다 재배대·식물·급수관·작업대·공구·발전기·필터·탱크·침상·보관함·모니터·잔해 등 별도 설비를 그린다. 주민은 원/아이콘 대신 머리/몸/팔/다리/장구를 가진 2D 리깅이며 실제 Person ID에 연결한다. 실제 배정이 바뀌면 현재 위치부터 계단 경로로 이동한다. 경비는 현장 순찰, 회수자는 방 안 운반을 수행한다. 부상자는 회복 위치로 이동하고 사망자는 제거한다.

주민 위치·진행 중 경로는 화면 전환 동안만 표시 캐시에 보관한다. 캠페인이 달라지면 비우고 최대 500항목으로 제한한다. 새로고침하면 다시 파생하며 저장에는 넣지 않는다. 애니메이션은 실시간으로 보간하고 일시정지 시 이동·작업·시설 효과의 위상을 모두 멈춘다. 카메라는 계속 동작한다.

픽시 초기화 중 화면을 나가는 경우도 취소 플래그로 처리한다. 화면 종료 시 Application/자식, ticker, ResizeObserver, 포인터/휠 리스너를 정리한다. Three의 텍스처/파티클 형상도 정리한다. 초기 DOM 포털 라벨에서 발견한 개발 모드 정리 오류는 캔버스 텍스처 스프라이트로 교체해 해결했다. WebGL2 미지원 또는 도시 초기화 실패 시 관리 화면으로 진행할 수 있다. 내부 초기화 실패도 관리 경로를 제공한다.

## 라이브러리와 에셋

| 라이브러리 | 고정 버전 | 용도/라이선스 |
| --- | --- | --- |
| Three.js | 0.187.0 | 3D 메시·조명·그림자 / MIT |
| React Three Fiber | 9.8.2 | React 19 장면 통합 / MIT |
| Drei | 10.7.9 | MapControls / MIT |
| PixiJS | 8.23.0 | 2D 단면과 인체 리깅 / MIT |
| Testing Library React / jsdom | 16.3.2 / 27.4.0 | UI 계약 테스트 / MIT |

외부 게임의 이미지·모델·스프라이트를 사용하지 않았다. 게임 아트는 모두 저장소 코드에서 직접 생성한다. 기존 Lucide 아이콘과 글꼴 사용은 유지한다. 구현 참고 문서는 [R3F](https://r3f.docs.pmnd.rs/getting-started/introduction), [Drei](https://drei.docs.pmnd.rs/controls/introduction), [Pixi Application](https://pixijs.com/8.x/guides/components/application)이다.

## 테스트와 빌드

`npm ci` 성공. 최초 재설치 때 실행 중 Vite의 Windows esbuild 잠금으로 실패했으며, 이번 작업의 개발/미리보기 프로세스만 종료한 뒤 해결했다. 운영 앱은 최종 교체 전까지 유지했다.

전체 `npm test`: **9개 파일, 61개 통과**. 기존 엔진 14개(남작 획득 포함), 1단계 24개(시간·경제·전투·이관 등), 서버 3개를 유지한다. 신규는 투영 5개, 화면 전환 2개, 렌더링 경계 4개, 주민 이동/리깅 4개, 엔진 동기화 4개, WebGL 대체 UI 1개다. HUD/관리 진입 변경 후 관련 UI 3개, 복구 인원 표시 보강 후 관련 투영/동기화/경로 13개도 통과했다. 변경과 무관한 엔진 검사를 반복하지 않았다.

`npm run build -- --outDir .release-stage`의 TypeScript `tsc --noEmit`와 Vite 빌드 모두 통과했다. 도시·내부는 lazy import로 분리한다. 최종 도시 청크 약 969 KB(빌드의 gzip 추정 약 262 KB), 내부 약 314 KB(약 99 KB)이며 도시 청크에 Vite의 500 KB 경고가 남는다. 화면 실행 오류는 아니다.

검증 층을 구분했다. 엔진은 기존 순수 테스트, 투영/경로는 새 순수 테스트, 화면 전환/대체 UI는 jsdom + Testing Library, 실제 그래픽/픽킹/리소스는 아래 브라우저 조작으로 확인했다. jsdom에서는 GPU를 렌더링했다고 주장하지 않는다. 전용 Playwright 자동 실행 스위트는 추가하지 않았다.

## 실제 브라우저 검증

로컬 프로덕션 미리보기 `http://127.0.0.1:5176`, 내장 브라우저 1280×720에서 수행했다. 앱의 상태를 스크립트로 주입하지 않고 실제 버튼/선택/캔버스 클릭을 사용했다. 전체 화면/전체 사이트 캡처는 하지 않고 필요한 장면 일부만 관찰했다.

- 기본 City, 20개 건물 목록과 렌더링, 메시 클릭으로 관측 타워(ID 19) 선택 및 미탐사 행동 제한 확인.
- 전체 보기/건물 집중/회전, 5층 내부와 설비 구별, 방 목록/주민 목록과 카메라 확인.
- 캔버스의 주민 해솔(p9)을 직접 클릭해 실제 이름/작업 표시. 작업장 직접 클릭해 배정 2명과 기초 자재 1.6/h 확인.
- 관리에서 도윤을 재배→기술로 변경한 후 내부의 실제 식수 배정과 이동 반영. 현장 주민 수 10, 이동 중 수 1과 증가하는 애니메이션 카운터 확인.
- 일시정지 후 이동 카운터 1121이 유지되는 동안 카메라 전체 보기가 동작함을 확인.
- D01 18:00 정지 상태로 새로고침한 뒤 시간·자원·속도가 그대로 유지됨을 확인.
- Building→Management→City를 3회 반복. 내부 캔버스 1개/활성 내부 1·도시 0, 관리 캔버스 0개/활성 모두 0. 정리 횟수가 증가하고 도시 재진입 시 활성 도시 1로 복원됨.
- 도시에서 옛 식료품점 보급 협상(식량/식수 각각 12)→실제 건물 관리 진입→수경 농장 지정→도시 복구 시작(자재 19)→내부 복구 인력 2명→5시간 단계 진행→운영 중 전환을 확인했다. 관리에서 돌아온 선택 건물 ID도 유지됐다. 이 과정에서 복구 인원을 도시 카드에도 포함하도록 실제 assignment 기준을 보강했다.
- 최종 프로덕션 미리보기 URL의 콘솔 오류 0개. 과거 개발/HMR 로그와 구분했다.

WebGL 미지원은 실제 GPU 설정을 바꾸지 않고 대체 UI 자동 테스트와 지원 판정 함수로 검증했다. Firefox/Safari·실제 모바일·장시간 힙 프로파일링은 수행하지 않았다.

## 성능 실측

| 화면 | 관찰 평균 FPS | 표본 p95 프레임 시간 | 추가 계측 |
| --- | --- | --- | --- |
| 도시 20동 | 약 57 | 18.2~18.9 ms | 763 draw calls, 412 geometries, 4 textures |
| 5층 내부, 실제 주민 10명 | 약 57 | 18.1 ms | Pixi GPU 객체/호출 수는 미계측으로 명시 |

각 표시 표본은 약 1.5초/86프레임의 실제 렌더러 간격이다. 반복 전환 전후 도시 도형/텍스처 표본이 412/4로 같았다. 다른 장치의 60 FPS나 모든 순간의 최소 FPS를 보장하지 않는다. 이 검사는 장면 수명주기와 제한된 자원 표본을 확인한 것이며 장시간 메모리 누수 부재를 증명하는 힙 프로파일은 아니다.

## 저장 호환성과 범위 한계

기존 v2 슬롯·v1 이관·원본 백업·중복 부재 계산 방지는 그대로다. 새 저장 필드는 없다. 주민·영토·시설·진행·관계·작위·계약·시간·우선순위는 기존 직렬화 경로로 보존한다. 투영 후 저장 왕복 일치와 기존 이관 테스트가 통과했다.

대표 쉘터의 여러 생산 방은 기존 기초 생산의 표시 위치이며 별도의 설치 시설이 아니다. 마지막 미복구 구획은 확장 미구현 공간으로 명시한다. 실제 복구/전환 현장은 해당 외부 건물의 단면에서 표시한다. 다른 건물은 건물당 기존 시설 1개를 유지한 3층 공용 축소 내부도이며 전용 아트는 아직 없다. 회복 공간은 기존 자동 회복의 표시이며 신규 의료/연구 생산이 아니다. 외근자를 쉘터 안의 장식 노동자로 중복 표시하지 않는다.

실제 공간 충돌, 주민 관계, 층별 독립 경제, 자유 건설, 도시 전체 물리 이동, 새 정치/전투/서버 저장은 범위 밖이다. 아트는 방향성을 검토할 수 있는 절차적 프로토타입이며 손으로 제작한 고해상도 최종 에셋은 아니다.

알려진 개발 도구 사항: 기존 Vitest 3 계열에 대해 npm audit가 개발 의존성 취약점 3개(critical 2, moderate 1)를 보고한다. 이번 그래픽 런타임 패키지의 보고가 아니며, 강제 메이저 업데이트는 하지 않았다. 테스트 도구 업그레이드는 별도 호환성 검증이 필요하다. 테스트 로더의 Three CJS 및 R3F의 Clock 폐기 예정 경고도 남는다.

## 다음 권장 작업

1. 대표 쉘터 아트/주민 동작을 플레이 피드백으로 다듬고 다른 건물 유형별 전용 내부도를 추가한다.
2. 반복 건축 메시·재질/그림자 호출을 더 합치고 저사양 품질 옵션, 청크/전송 크기 개선을 진행한다.
3. 실제 모바일/다른 브라우저, 오랜 화면 전환과 힙/GPU 프로파일, 재현 가능한 자동 브라우저 검증을 추가한다.
4. 기존 테스트 도구 업그레이드와 다중 탭 저장 보호를 별도 변경으로 검증한다.

## 운영 반영

2026-11-22 13:29 KST에 검증한 v0.3.0 번들을 기존 `dist/`로 교체하고 PM2 앱 `city`만 재시작했다. 이전 배포는 `.release-prev-v2-20261122-132933/`에 보관했다. 캐시된 이전 진입점도 계속 동작하도록 이전 해시 자산을 새 배포에 함께 보존했다. DNS·터널·계정·저장 슬롯은 변경하지 않았다.

단계별 개발 커밋 6개를 `feature/v3-spatial-world`에 푸시하고, `main`에 fast-forward 반영·푸시했다. 소스 완료 커밋은 `03af4a4`다. 이 배포 기록은 후속 문서 커밋이다.

로컬과 공개 `https://city.lomebrote.com/api/health` 모두 `ok:true`, `version:0.3.0` 응답을 확인했다. 공개 HTTPS의 실제 브라우저에서도 기본 3D 도시와 실제 주민 10명의 쉘터 내부, 다시 도시로 전환을 확인했고 해당 URL의 콘솔 오류는 없었다. 공개 도시 첫 계측 표본은 52 FPS / p95 18.3 ms, 내부 표시는 57 FPS였다. 로컬 안정 표본 약 57 FPS와 구분한다. 실제 하드웨어 전반의 성능 보장은 아니다.

## 변경 파일 전체 목록

```text
AGENTS.md
README.md
docs/V3_DEVELOPMENT.md
package-lock.json
package.json
server.mjs
src/App.tsx
src/game/GameNavigation.tsx
src/game/GameShell.tsx
src/game/VisualLifecycle.tsx
src/game/building/BuildingLayout.ts
src/game/building/BuildingScene.ts
src/game/building/BuildingView.tsx
src/game/building/FloorRenderer.ts
src/game/building/ResidentAnimator.ts
src/game/building/ResidentMovement.ts
src/game/building/ResidentRenderer.ts
src/game/building/RoomRenderer.ts
src/game/building/building.css
src/game/city/CityBuilding.tsx
src/game/city/CityCamera.tsx
src/game/city/CityEffects.tsx
src/game/city/CityGeometry.tsx
src/game/city/CityLabel.tsx
src/game/city/CityScene.tsx
src/game/city/CityTerrain.tsx
src/game/city/CityView.tsx
src/game/city/WebGLSupport.ts
src/game/city/city.css
src/game/hud/GameHUD.tsx
src/game/hud/RendererStats.tsx
src/game/performance.ts
src/game/presentation/GamePresentation.ts
src/game/world.css
src/management/ManagementView.tsx
tests/navigation.test.tsx
tests/presentation.test.ts
tests/rendering.test.ts
tests/resident-movement.test.ts
tests/visual-sync.test.ts
tests/webgl-fallback.test.tsx
```


## v3 P0 화면 통합 및 운영실 UX 수정 (0.3.1)

제품 버전 0.3.1. 작업 브랜치 `fix/unified-management-navigation`, 기준 `99d16df`. 게임 엔진·경제·배정·전투·외교·저장 스키마·건축 모델·주민 애니메이션·내부 레이아웃은 변경하지 않았다.

### 실제 원인과 구조 변경

기존 GameShell은 management일 때 조기 반환해 공통 셸/HUD를 제거했다. ManagementView가 별도의 GameNavigation을 렌더링했고, `.management-return .world-navigation`이 `position:static`이어서 문서와 함께 스크롤됐다. 관리 페이지의 문서 스크롤은 공간 화면의 고정 높이/overflow 구조와도 일치하지 않았다. 화면 전환 콜백 자체가 없는 문제가 아니며, 복귀 UI를 화면 밖으로 보내는 구조가 원인이었다.

이제 구조는 App → GameShell → 공통 HUD/내비게이션/오버레이 + ViewContainer → 도시/건물 또는 운영실이다. `GameView`는 GameShell 한 곳에서 소유하고 `data-game-view`도 공통 루트 한 곳에만 둔다. ManagementView는 전역 내비게이션을 렌더링하지 않는다. 기존 대시보드의 ASHEN 타이틀/시간/속도/단계 진행 헤더를 제거하고 공통 HUD로 통합했다. 플레이 가이드는 운영실 헤더로 옮겼다. 기존 내부 관리 탭과 상세 자원 원장·저장·JSON·로그·정책·외교는 유지한다.

운영실은 금속 계열 프레임/작은 상태등/어두운 통제실 헤더를 사용한다. 콘텐츠만 독립적으로 스크롤하고 글로벌 UI는 스크롤 밖에 있다. 내비게이션 z-index 60, 일반 경고 56 이하, 기존 모달 100으로 구분했다. 운영실 진입은 180ms의 가벼운 어두운 페이드이며 reduced-motion에서는 비활성화한다. 화면 전체에 transform을 걸지 않아 모달의 fixed 기준과 내비게이션 우선순위를 깨뜨리지 않는다.

### 상태와 생명주기

기존 App의 GameState·시간 루프와 UI의 선택 건물/관리 탭은 유지한다. GameShell은 유효한 건물 ID만 각 화면에 전달하고 잘못된 선택은 초기 거점으로 대체한다. 관리 콘텐츠는 숨김/inert 상태로 마운트를 유지해 입력과 펼친 패널을 보존하며, 스크롤 위치도 복원한다.

`ViewSession.ts`는 저장하지 않는 UI 세션이다. 도시 카메라 position/target/zoom, 건물별 내부 카메라 x/y/scale, 선택한 주민/방을 보관하며 캠페인이 달라지면 새 세션을 사용한다. 새로고침 후까지 저장하는 데이터는 아니다. 내부 ResizeObserver는 크기를 갱신하면서 사용자의 카메라를 전체 보기로 되돌리지 않는다.

공간 렌더러는 비활성화 화면에서 계속 돌리지 않고 기존 방식대로 해제한다. 복귀 시 현재 GameState와 UI 세션으로 재생성한다. 게임 시간을 처리하는 새 타이머는 추가하지 않았다.

### 단계와 검증

Phase 1 원인/복귀 구조 수정, Phase 2 단일 내비게이션, Phase 3 운영실/공통 HUD, Phase 4 세션/카메라/정리, Phase 5 테스트/빌드/브라우저 검증을 수행했다.

- 전체 자동 테스트 **65개 통과**. 기존 61개를 유지하고 단일 전역 UI·관리 입력 보존·30쌍 왕복 상태 불변·잘못된 ID 대체·스크롤 복원 회귀 검사를 보강했다(기존 navigation 2개 + 신규 4개). 그래픽을 모킹한 jsdom 검사와 실제 브라우저 검사는 구분한다.
- npm ci 성공, TypeScript와 Vite 프로덕션 빌드 통과. 마지막 작은 변경 후 관련 UI/서버 9개도 통과했다. CSS/불필요 import 정리 후 타입/빌드를 다시 확인했다. 관련 없는 엔진 검사를 반복하지 않았다.
- 프로덕션 미리보기, 실제 내장 브라우저 1280×720에서 도시↔관리 10회, 도시↔건물 10회, 건물↔관리 10회(60회 화면 이동)를 실제 클릭했다. 각 이동의 data-game-view, 단일 내비게이션, 기대 활성 장면 수/캔버스 수를 검사했다. 정지 중 시간·자원·관리 콘텐츠가 동일했다.
- 관리 콘텐츠 scrollTop 1107.333을 만든 후 도시 복귀·재진입 시 동일 값이 복원됐고 문서 scrollY는 0, 내비게이션 top은 95px로 유지됐다. 실제 가이드 모달을 열고 닫은 뒤 복귀 버튼이 작동했다.
- 도시 회전 후 관리 왕복 시 카메라 position/target/zoom이 동일했다. 내부에서 윤서 선택·확대한 뒤 관리 왕복 시 x=-104, y=179.8736842105263, scale=1.305263157894737 및 선택 주민 p0/건물 ID 0이 복원됐다.
- 390×844에서 HUD/내비게이션 충돌을 실제 발견해 두 행 그리드로 수정했다. 최종 HUD bottom 115px, 내비게이션 top 130px로 분리되고 가로 스크롤이 없었다. 키보드 End로 관리 콘텐츠를 스크롤한 뒤 내부 복귀도 확인했다. 임시 뷰포트 설정은 해제했다.

- 진행 중 검증: 1배속에서 화면을 전환하며 현실 66.043초가 경과했을 때 게임 22시간이 진행됐다(예상 22.014시간). 중복 시간 진행 징후가 없었고 공통 HUD로 다시 정지했다. 실제 관리의 주민 탭을 보존한 채 도시에서 식료품점을 선택한 후 관리→내부로 전환했을 때 건물 ID 1이 유지됐다.
- 브라우저 콘솔 오류는 0개였다. 실제 클릭과 렌더러 준비/정리 상태까지 확인했으며 단순 DOM 버튼 존재 검사에 그치지 않았다. 독립 Playwright CLI 스위트를 추가한 것은 아니고 내장 브라우저의 Playwright 조작으로 수행했다.

### 변경 파일

- `src/App.tsx`: 중복 헤더 제거, 가이드 연결, 선택 ID 방어.
- `src/game/GameShell.tsx`, `world.css`: 공통 셸/내비게이션/HUD, 경고, 화면 전환, 레이아웃과 모바일 겹침 수정.
- `src/management/ManagementView.tsx`, `management.css`: 운영실 헤더·독립 스크롤·상태 보존·모달 우선순위.
- `src/game/ViewSession.ts`: 저장과 분리한 카메라/주민/방 UI 상태.
- `src/game/city/CityCamera.tsx`, `CityScene.tsx`, `CityView.tsx`: 카메라 세션 전달/복원. 건축물 모델은 그대로다.
- `src/game/building/BuildingScene.ts`, `BuildingView.tsx`: 카메라/선택 복원과 뷰포트 수명주기. 레이아웃/주민 애니메이션 규칙은 그대로다.
- `tests/navigation.test.tsx`: 관리 복귀와 불변성 회귀 검사.
- `package.json`, `package-lock.json`, `server.mjs`: 버전 0.3.1 표시. 의존성 버전/저장 스키마는 변경하지 않았다.
- `README.md`, 이 문서: 사용법과 검증 기록.

### 남아 있는 한계

UI 세션은 새로고침 후 복원하지 않는다. 실제 브라우저 검증은 내장 브라우저와 위 두 크기에 한정하며 Firefox/Safari·장시간 힙 프로파일링은 수행하지 않았다. 기존 큰 3D 청크 경고와 테스트 도구 audit 경고는 이 UI 수정 범위에서 바꾸지 않았다. 화면 이미지는 필요한 일부 영역만 확인했고 전체 화면/전체 사이트 캡처는 하지 않았다.

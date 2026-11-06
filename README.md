# Flight Shade

공항 코드와 출발 날짜·시간으로 비행 중 태양의 위치를 계산하고, 그늘·햇빛·일출·일몰 선호에 맞는 왼쪽 또는 오른쪽 창가 좌석을 추천하는 단일 페이지입니다. 한국어와 영어를 지원합니다.

## 실행

Node.js 22.12 이상이 필요합니다.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

API 키나 별도 서버는 필요하지 않습니다. 좌석 계산과 공항 검색은 브라우저에서 처리합니다. 지도 타일(OpenStreetMap)과 웹 폰트는 인터넷 연결이 필요합니다.

## 화면 구성

한 페이지 안에서 경로 설정·지도·추천 결과·공유를 사용합니다. 데스크톱은 지도 옆에 입력 패널을 고정하고, 960px 이하에서는 경로 설정을 바텀 시트로 표시합니다.

- 첫 진입: 중간 높이로 열림. 공유 URL로 진입하면 결과를 바로 볼 수 있도록 접힘.
- 공항 검색: 코드·도시 검색 후 Enter로 첫 검색 결과를 선택하고 즉시 적용. 방향키로 다른 결과를 선택할 수 있음.
- 자동 적용: 공항 선택과 날짜·시간·비행시간·선호 변경 시 결과와 URL 갱신. 별도 검색 버튼 없이 사용.
- 모바일: 입력 중 시트를 유지하며 Enter 또는 ‘결과 보기’로 출도착 공항·출발 시간 요약 바로 접힘.
- 조작: 요약 바 클릭과 핸들 드래그로 열고 접기, Esc로 접기. 입력에 포커스하면 시트 확장.
- 시트 내부만 스크롤하며 ‘결과 보기’ 버튼은 하단에 고정. 모바일 키보드의 가시 영역과 하단 안전 영역 반영.

Wanted Sans와 Space Grotesk, 종이색·포레스트·앰버를 사용하며 주요 정보와 기능을 중심으로 구성합니다.

비행 중 일출·일몰이 발생하면 Lucide 아이콘과 예상 시각을 표시합니다. 배지나 타임라인 표시를 선택하면 해당 시점으로 이동합니다. 시각은 출발 공항의 현지 시간 기준이며 공유 URL에서도 같은 결과가 복원됩니다.

좌석 선호는 ‘햇빛을 피하고 싶어요·햇빛이 좋아요·일출을 보고 싶어요·일몰을 보고 싶어요’로 선택합니다. 그늘·햇빛은 전체 구간의 좌우 노출 비율을, 일출·일몰은 해당 현상이 발생하는 시점의 태양 방향을 사용합니다. 현상이 없으면 ‘일출 없음·일몰 없음’을 표시하고, 기수·꼬리 방향이면 앞·뒤라고 표시합니다.

## GitHub Pages 배포

기본 배포 대상은 `https://yheun03.github.io/flight-shade/`입니다. 경로는 저장소의 `origin` 또는 GitHub Actions의 `GITHUB_REPOSITORY`에서 계산하므로 저장소 이름이 바뀌어도 코드에 경로를 고정할 필요가 없습니다.

### 자동 배포 — 권장

1. GitHub 저장소의 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.
2. 소스를 `main`에 push합니다.
3. **Actions → Deploy Flight Shade to GitHub Pages**에서 진행 상황을 확인합니다. 수동 실행도 지원합니다.

워크플로는 테스트 후 Pages 전용 빌드와 언어별 정적 HTML 검사를 실행하고 `dist/`를 배포합니다. [Vite의 GitHub Pages 배포 방식](https://vite.dev/guide/static-deploy.html#github-pages)을 따릅니다.

배포 전에 실제 하위 경로로 미리 확인할 수 있습니다.

```sh
npm run build:pages
npm run check:build
npm run preview:pages
# http://localhost:4173/flight-shade/
```

### gh-pages 브랜치로 직접 배포

planearby처럼 로컬에서 직접 배포하려면 다음 명령을 사용합니다. GitHub에 Git push할 수 있는 인증이 필요합니다.

```sh
npm run deploy
```

이 방식을 선택한 경우 **Settings → Pages → Source**를 **Deploy from a branch → gh-pages / (root)**로 설정합니다. 자동 배포 워크플로와 직접 배포 중 한 방식을 선택해 사용하세요. `npm run build`와 `npm run dev`는 `/`에서 동작하는 일반 로컬 빌드입니다.

## 공유 주소

```text
https://yheun03.github.io/flight-shade/?from=ICN&to=KIX&date=2026-11-07&time=14%3A50&duration=85
```

- `from`, `to`: IATA 공항 코드
- `date`: 출발 공항의 현지 날짜, YYYY-MM-DD
- `time`: 출발 공항의 현지 시간, HH:mm
- `duration`: 비행시간(분), 15~1440
- `preference`: `shade`(기본), `sun`, `sunrise`, `sunset`. 생략하면 그늘 추천.

입력하면 주소가 갱신됩니다. 링크 복사·결과 공유 버튼으로 선호까지 같은 결과를 열 수 있습니다. 영어 주소는 `/flight-shade/en/`이며 언어 전환 시 항공편 파라미터를 유지합니다. 예: `https://yheun03.github.io/flight-shade/en/?from=ICN&to=KIX&date=2026-11-07&time=16%3A00&duration=85&preference=sunset`.

공항의 IANA 시간대를 사용하므로 방문자의 기기 시간대에 영향을 받지 않고 서머타임을 반영합니다. 존재하지 않는 현지 시간은 오류를 표시하고, 반복되는 시간은 먼저 도래하는 시간을 선택합니다. 쿼리 파라미터와 실제 언어별 HTML 파일을 사용하므로 정적 호스팅에서도 별도의 경로 재작성 설정 없이 열립니다.

## 검색 노출·접근성·성능

- 빌드 시 한국어 `/`와 영어 `/en/`를 Vue SSR로 미리 렌더링합니다. 두 주소 모두 동일한 단일 페이지의 번역본이며, 별도 서버가 필요하지 않습니다.
- 언어별 title·description·canonical·hreflang·Open Graph·WebApplication JSON-LD를 제공합니다. 개별 항공편 쿼리 주소는 해당 언어의 기본 주소로 canonical을 통합합니다.
- 계산 기준과 한계를 안내 대화상자의 실제 HTML에 포함하며 `sitemap.xml`, `robots.txt`, `llms.txt`를 생성합니다. `llms.txt`는 서비스·계산 방법을 설명하는 보조 문서이며 AI 검색 노출을 보장하는 표준은 아닙니다. GEO·AEO도 [Google의 AI 검색 안내](https://developers.google.com/search/docs/appearance/ai-features)에 따라 크롤링 가능한 콘텐츠와 정확한 구조화 데이터를 기본으로 합니다.
- GitHub 프로젝트 Pages의 `/flight-shade/robots.txt`는 도메인 루트의 `/robots.txt`가 아닙니다. Search Console에는 전체 sitemap URL을 직접 제출할 수 있습니다. 루트 robots 설정이 필요하면 계정 Pages 저장소 또는 별도 도메인 루트에서 관리해야 합니다.
- 공항 검색 combobox의 방향키·Enter·Esc, IME 입력 보호, 로딩·오류 안내, 결과 갱신 알림, 입력 오류 연결, 포커스 표시, 모바일 시트 포커스 제한·복귀, reduced-motion 스타일을 지원합니다. 브라우저가 제공하는 날짜·시간 선택기의 언어는 기기 설정에 따릅니다.
- 주요 공항만 초기 번들에 포함하고 전체 7,917개 공항 데이터는 검색하거나 공유 주소의 공항을 복원할 때 한 번 불러옵니다. 지도와 지도 스타일은 별도 청크로 로드합니다. 입력 갱신은 150ms로 모으고, 시간·선호 변경 시 경로를 다시 그리지 않습니다.
- `npm test`는 태양 방향·이벤트 선호·공유 URL·시간대·언어·메타데이터를 검사합니다. `npm run check:build`는 양 언어 HTML·배포 경로·구조화 데이터·sitemap·초기 JavaScript 250kB 예산을 검사합니다.

## 프로젝트 구조

[planearby](https://github.com/yheun03/planearby)의 Vue 3 + Vite 파일 배치, script setup, BEM 클래스, 전역 SCSS 구조를 따릅니다.

```text
app.vue, main.js                   앱·스타일 진입점
pages/index.vue                    입력·좌석 추천·타임라인·공유
layouts/default.vue                화면 외곽
components/projects/flight-shade/   공항 입력·Leaflet 지도·항공기 아이콘
assets/scss/                       abstract/base/layout/projects
assets/data/                       공항 데이터·한국어 표기
utils/geo.js                       거리·대권 경로·방위
utils/flight.js                    태양 계산·시간대·URL
utils/metadata.js                  언어별 검색·공유 메타데이터
i18n/                             한국어·영어 문구
scripts/build.mjs                  언어별 정적 HTML·sitemap 생성
scripts/check-build.mjs            정적 결과·경로·초기 JS 예산 검증
tests/                            좌우·이벤트 선호·시간대·URL·언어·메타데이터
```

## 계산 기준

최단 대권 경로를 240개 동일 시간 구간으로 나누어 SunCalc 1.9.0으로 태양 고도와 방위를 계산합니다. 해당 지점의 기체 진행 방위와 비교해 왼쪽·오른쪽·앞뒤·야간으로 분류합니다. 앞뒤는 기수·꼬리 방향 각각 15도 이내입니다. 약 10.7km 순항 고도의 지평선 하강각과 대기 굴절을 근사하며, 비행 시작·끝 15% 구간은 상승·하강으로 근사합니다. 좌우 노출 차이가 2% 미만이면 양쪽을 추천합니다.

경로 샘플의 주야 전환을 찾고, 이동 좌표와 근사 고도의 지평선 통과 시점을 이분 탐색으로 보정해 일출·일몰을 표시합니다.

실제 항로·운항 속도·구름·기체 자세·창문 구조는 반영하지 않습니다. 비행시간 자동 추정은 거리/780km/h + 20분을 5분 단위로 반올림한 값이므로 실제 일정으로 수정할 수 있습니다. 수치는 전체 비행 구간 중 태양 방향의 비율이며 실제 창문을 통과하는 일사량 측정값은 아닙니다.

## 데이터와 참고

- UI·경험 참고: [FlightSide](https://flightside.app/)
- 구조 참고: [planearby](https://github.com/yheun03/planearby)
- 공항 데이터: [mwgg/Airports](https://github.com/mwgg/Airports), 2026-11-06 다운로드. 유효한 IATA 코드·좌표·IANA 시간대를 가진 중복 없는 7,917개 항목을 포함합니다. [MIT 라이선스](public/licenses/airports-MIT.txt)
- 아이콘: Lucide (`@lucide/vue`), [ISC 라이선스](public/licenses/lucide-ISC.txt)
- 태양 위치: [SunCalc 1.9.0](https://github.com/mourner/suncalc/tree/v1.9.0), BSD-2-Clause
- 지도: [Leaflet](https://leafletjs.com/), [OpenStreetMap](https://www.openstreetmap.org/copyright). [타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/)을 따릅니다. 대규모 서비스로 운영할 때는 사용량에 맞는 타일 공급자를 선택하세요.

계산 결과는 URL에만 포함되며 계정·DB·쿠키에 저장하지 않습니다. 지도 공급자는 화면에 표시할 지역의 타일 좌표를, Google Fonts와 jsDelivr는 폰트 요청을 받습니다.

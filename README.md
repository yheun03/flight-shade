# Flight Shade

공항 코드와 출발 날짜·시간으로 비행 중 태양의 위치를 계산하고, 햇빛이 적은 왼쪽 또는 오른쪽 창가 좌석을 추천하는 단일 페이지입니다.

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

## 공유 주소

```text
/?from=ICN&to=KIX&date=2026-11-07&time=14%3A50&duration=85
```

- `from`, `to`: IATA 공항 코드
- `date`: 출발 공항의 현지 날짜, YYYY-MM-DD
- `time`: 출발 공항의 현지 시간, HH:mm
- `duration`: 비행시간(분), 15~1440

검색하면 주소가 갱신됩니다. 링크 복사·결과 공유 버튼으로 같은 결과를 열 수 있습니다. 공항의 IANA 시간대를 사용하므로 방문자의 기기 시간대에 영향을 받지 않고 서머타임을 반영합니다. 존재하지 않는 현지 시간은 오류를 표시하고, 반복되는 시간은 먼저 도래하는 시간을 선택합니다. 쿼리 파라미터를 사용하므로 정적 호스팅에서도 별도의 경로 재작성 설정 없이 열립니다.

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
tests/flight.test.js               좌우 방향·야간·서머타임·URL·날짜변경선
```

## 계산 기준

최단 대권 경로를 240개 동일 시간 구간으로 나누어 SunCalc 1.9.0으로 태양 고도와 방위를 계산합니다. 해당 지점의 기체 진행 방위와 비교해 왼쪽·오른쪽·앞뒤·야간으로 분류합니다. 앞뒤는 기수·꼬리 방향 각각 15도 이내입니다. 약 10.7km 순항 고도의 지평선 하강각과 대기 굴절을 근사하며, 비행 시작·끝 15% 구간은 상승·하강으로 근사합니다. 좌우 노출 차이가 2% 미만이면 양쪽을 추천합니다.

실제 항로·운항 속도·구름·기체 자세·창문 구조는 반영하지 않습니다. 비행시간 자동 추정은 거리/780km/h + 20분을 5분 단위로 반올림한 값이므로 실제 일정으로 수정할 수 있습니다. 수치는 전체 비행 구간 중 태양 방향의 비율이며 실제 창문을 통과하는 일사량 측정값은 아닙니다.

## 데이터와 참고

- UI·경험 참고: [FlightSide](https://flightside.app/)
- 구조·항공기 아이콘 참고: [planearby](https://github.com/yheun03/planearby)
- 공항 데이터: [mwgg/Airports](https://github.com/mwgg/Airports), 2026-11-06 다운로드. 유효한 IATA 코드·좌표·IANA 시간대를 가진 중복 없는 7,917개 항목을 포함합니다. [MIT 라이선스](public/licenses/airports-MIT.txt)
- 태양 위치: [SunCalc 1.9.0](https://github.com/mourner/suncalc/tree/v1.9.0), BSD-2-Clause
- 지도: [Leaflet](https://leafletjs.com/), [OpenStreetMap](https://www.openstreetmap.org/copyright). [타일 이용 정책](https://operations.osmfoundation.org/policies/tiles/)을 따릅니다. 대규모 서비스로 운영할 때는 사용량에 맞는 타일 공급자를 선택하세요.

계산 결과는 URL에만 포함되며 계정·DB·쿠키에 저장하지 않습니다. 지도 공급자는 화면에 표시할 지역의 타일 좌표를, Google Fonts는 폰트 요청을 받습니다.

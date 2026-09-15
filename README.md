# cortis-rps-chart

릴리즈 노트
https://www.postype.com/@chovhub/post/21315991

원본 프로젝트: https://github.com/en-chovy/cortis-rps-chart

라이선스가 요구하는 출처 표기:

> Based on cortis-rps-chart by en-chovy

## Analytics

이 저장소에는 사람 유입과 에이전트 유입을 분리해서 기록하는 선택형 분석기가
포함되어 있다. 현재 수집기는
`https://cortis-rps-analytics.0103x0214.workers.dev/v1/event`에 연결되어 있다.

브라우저 이벤트는 쿠키 없이 페이지뷰, 탭 단위 세션 ID, UTM 값, 리퍼러의 도메인,
언어, 공식 사이트/미러 여부만 기록한다. URL 쿼리 전체, 리퍼러 경로, IP 주소,
전체 User-Agent는 저장하지 않으며 Do Not Track과 Global Privacy Control을 따른다.

에이전트 이벤트는 알려진 AI 크롤러 User-Agent, 브라우저 자동화 신호, 또는
`/v1/agent` 전용 엔드포인트로 분류한다. User-Agent는 원문 대신 제품군만 저장한다.

### 수집기 배포

수집기는 Cloudflare Workers Analytics Engine을 사용한다.

```sh
cd analytics-worker
npm install
npx wrangler login
npm run check
npm run deploy
```

배포 후 `index.html`의 `cortis-analytics-endpoint` 값을 배포 URL의 `/v1/event`로
설정한다. 예시는 `https://example.workers.dev/v1/event` 형식이다.

GitHub Pages를 그대로 쓰면 브라우저에서 실행되는 사람/에이전트만 집계된다.
HTML을 직접 가져가는 크롤러까지 집계하려면 사용자 도메인을 Worker에 연결하고,
Worker가 `ORIGIN_BASE_URL`의 GitHub Pages 사이트를 프록시하도록 구성한다. 이 경우
`agent_request`는 서버에서 잡히며, `/v1/agent?surface=llms`를 에이전트용 문서에
연결하면 명시적인 에이전트 컨텍스트 요청도 `agent_context`로 남는다.

### 필드와 조회 예시

Analytics Engine의 필드는 다음 순서로 기록된다.

| 필드 | 의미 |
|---|---|
| `blob1` | 이벤트 (`pageview`, `agent_request`, `agent_context`) |
| `blob2` | 행위자 (`human`, `automation`, `agent`) |
| `blob3` | 에이전트/런타임 제품군 |
| `blob4`–`blob7` | source, medium, campaign, referrer host |
| `blob8`–`blob10` | page host, path, official/mirror 상태 |
| `blob11`–`blob14` | 언어, 탭 세션 ID, surface, provenance ID |
| `double1` | 이벤트 수 (`1`) |

사람 유입량:

```sql
SELECT
  SUM(_sample_interval) AS pageviews,
  count(DISTINCT blob12) AS sessions
FROM cortis_rps_traffic
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND blob1 = 'pageview'
  AND blob2 = 'human'
```

유입 경로:

```sql
SELECT
  blob4 AS source,
  blob5 AS medium,
  SUM(_sample_interval) AS visits
FROM cortis_rps_traffic
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND blob1 = 'pageview'
GROUP BY source, medium
ORDER BY visits DESC
```

에이전트 통계:

```sql
SELECT
  blob1 AS event,
  blob3 AS agent_family,
  SUM(_sample_interval) AS requests
FROM cortis_rps_traffic
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND blob2 IN ('agent', 'automation')
GROUP BY event, agent_family
ORDER BY requests DESC
```

복제되어 다른 호스트에서 실행된 흔적:

```sql
SELECT
  blob8 AS host,
  SUM(_sample_interval) AS pageviews
FROM cortis_rps_traffic
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND blob1 = 'pageview'
  AND blob10 = 'mirror'
GROUP BY host
ORDER BY pageviews DESC
```

Analytics Engine 조회는 Cloudflare SQL API를 사용한다. 계정 토큰은 브라우저 코드나
저장소에 넣지 말고 Cloudflare API 토큰으로 별도 보관한다.

## Provenance

`NOTICE`, `provenance.json`, `llms.txt`, HTML 메타데이터와 분석 모듈에 동일한 고유
provenance ID가 들어 있다. 이는 악성 동작이나 프롬프트 인젝션이 아니라 공개적인
출처 표식이다. 복제 방지를 완전히 보장하지는 않지만, 그대로 복제된 공개 코드와
비공식 배포 호스트를 찾을 수 있는 검색 가능한 증거가 된다. 라이선스 의무는
`LICENSE` 원문을 따른다.

## Third-party assets

Pretendard 1.3.9 is redistributed under the SIL Open Font License 1.1.
See [`assets/fonts/pretendard/1.3.9/OFL.txt`](assets/fonts/pretendard/1.3.9/OFL.txt)
and [`SOURCE.md`](assets/fonts/pretendard/1.3.9/SOURCE.md).

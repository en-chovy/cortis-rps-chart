# Analytics collector

Cloudflare Workers Analytics Engine을 사용해 사람·에이전트 유입, 유입 경로와
비공식 미러 호스트를 기록한다.

브라우저 이벤트는 쿠키 없이 페이지뷰, 탭 단위 세션 ID, UTM 값, 리퍼러 도메인,
언어와 공식 사이트/미러 여부만 전송한다. URL 쿼리 전체, 리퍼러 경로, IP 주소와
전체 User-Agent는 저장하지 않으며 Do Not Track과 Global Privacy Control을 따른다.

## 배포

```sh
npm install
npx wrangler login
npm run check
npm run deploy
```

배포 URL 뒤에 `/v1/event`를 붙여 루트 `index.html`의
`cortis-analytics-endpoint`에 설정한다.

현재 설정값:

```text
https://cortis-rps-analytics.0103x0214.workers.dev/v1/event
```

GitHub Pages를 그대로 사용하면 브라우저에서 실행되는 방문만 집계된다. HTML을
직접 가져가는 에이전트까지 집계하려면 사용자 도메인을 Worker에 연결해
`ORIGIN_BASE_URL`의 사이트를 프록시해야 한다.

## 필드

| 필드 | 의미 |
|---|---|
| `blob1` | 이벤트 (`pageview`, `agent_request`, `agent_context`) |
| `blob2` | 행위자 (`human`, `automation`, `agent`) |
| `blob3` | 에이전트/런타임 제품군 |
| `blob4`–`blob7` | source, medium, campaign, referrer host |
| `blob8`–`blob10` | page host, path, official/mirror 상태 |
| `blob11`–`blob14` | 언어, 탭 세션 ID, surface, provenance ID |
| `double1` | 이벤트 수 (`1`) |

## 조회 예시

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

미러 호스트:

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

Analytics Engine 조회에는 Cloudflare SQL API를 사용한다. API 토큰은 브라우저 코드나
저장소에 넣지 않는다.

# Architecture – IT-Security_Blog

## 1. 개요 (Overview)
IT-Security_Blog는 **정적 프론트엔드(Static Frontend)** 에서 **직접 서버리스 데이터베이스(Serverless SQL)** 를 호출하는 구조를 가진다.
별도의 백엔드 API 서버를 두지 않고, Neon Serverless Driver를 통해 브라우저에서 안전하게 DB를 조회한다.

## 2. 시스템 구성 요소 (System Components)

```mermaid
graph LR
    User[Browser / User] -->|HTTPS / WebSocket| Neon[Neon Serverless Postgres]
    Neon -->|SQL Query| DB[(PostgreSQL Storage)]
    User -->|Static Assets| Host[Static Host (GitHub Pages)]
```

### 2.1 Static Frontend (GitHub Pages)
- **역할**: UI 렌더링, 라우팅, SQL 쿼리 실행
- **기술**: Vanilla JS, ES Modules
- **주요 라이브러리**:
  - `@neondatabase/serverless`: 브라우저에서 PostgreSQL 직접 연결
  - `marked`: Markdown 렌더링
  - `prismjs`: 코드 하이라이팅

### 2.2 Serverless Database (Neon)
- **역할**: 데이터 저장 및 조회
- **기술**: PostgreSQL
- **특징**:
  - **Direct Connection**: 중간 API 서버 없이 프론트엔드에서 직접 쿼리
  - **Read-Only(논리적으로)**: 프론트엔드 코드에는 `SELECT` 쿼리만 존재. (보안상 DB User 권한 분리 권장)

---

## 3. 데이터 흐름 (Data Flow)

1. **페이지 로드**: 브라우저가 정적 파일(HTML/JS/CSS)을 호스팅 서버에서 다운로드.
2. **DB 연결**: `api.js` 내부의 `neondatabase` 드라이버가 Neon 엔드포인트와 연결 수립.
3. **쿼리 실행**: 필요한 데이터(게시글 목록, 상세 내용)에 대한 SQL `SELECT` 쿼리 전송.
4. **렌더링**: DB로부터 받은 JSON 데이터를 클라이언트에서 HTML로 변환하여 표시.

---

## 4. 캐싱 전략 (Caching Strategy)
별도의 API Gateway 캐시 계층이 없으므로, 클라이언트 측 캐싱과 브라우저 캐싱에 의존한다.

- **브라우저 캐시**: 정적 자산(CSS, JS)은 서버 설정 및 쿼리 파라미터(`?v=xx`)를 통해 갱신 관리.
- **데이터 캐시**: 현재 구조는 실시간 조회(Live Query) 방식이다. 데이터 신선도가 높으나 트래픽 비용이 발생할 수 있다.

---

## 5. 보안 모델 (Security Model)
- **DB 접속 정보**: 환경 변수로 주입되거나, 제한된 권한의 역할(Role) 사용을 전제로 한다.
- **공개 데이터**: 블로그 특성상 모든 데이터가 공개(Public)되므로, 읽기 전용 접속 정보를 사용하는 것이 핵심 방어 기제이다.

---

## 6. 확장성 (Scalability)
- **Stateless**: 별도의 백엔드 상태 관리가 불필요하다.
- **Serverless DB**: Neon 아키텍처가 트래픽에 따라 자동 확장된다.

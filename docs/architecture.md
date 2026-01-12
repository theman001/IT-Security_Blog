# Architecture – IT-Security_Blog

## 1. 개요 (Overview)

IT-Security_Blog는 **정적 프론트엔드 + 외부 데이터 소스** 구조를 가진  
**재빌드 없는 콘텐츠 반영(Read-only Headless Blog)** 아키텍처를 따른다.

본 문서는 다음을 명확히 정의한다.

- 시스템 구성 요소
- 각 컴포넌트의 책임 범위
- 데이터 흐름
- 캐시 계층 구조
- 플랫폼 독립성 원칙

---

## 2. 설계 원칙 (Design Principles)

### 2.1 플랫폼 중립성

- 프론트엔드 배포 위치는 **고정하지 않는다**
- 특정 서비스(Netlify, Vercel 등)에 종속된 설정 파일을 두지 않는다
- API와 프론트는 완전히 분리된다

---

### 2.2 재빌드 없는 콘텐츠 반영

- 게시글 추가 / 수정 / 삭제 시
  - 프론트엔드 재배포 ❌
  - 브라우저 새로고침만으로 반영 ⭕

---

### 2.3 단방향 데이터 흐름

```
Browser → API → Database
```

- 프론트는 데이터를 **요청만** 한다
- 데이터 수정은 관리자 파이프라인에서만 발생한다

---

## 3. 시스템 구성 요소

```
+---------------------+
|   Static Frontend   |
|  (GitHub Pages 등)  |
+----------+----------+
           |
           | HTTPS (fetch)
           v
+----------+----------+
|        API          |
| (Edge / Serverless)|
+----------+----------+
           |
           | SQL
           v
+----------+----------+
|      Neon DB        |
|  (PostgreSQL)       |
+---------------------+
```

---

## 4. 컴포넌트별 책임

---

### 4.1 Static Frontend

#### 역할
- 사용자 인터페이스 제공
- API 호출
- Markdown 렌더링
- 클라이언트 캐싱

#### 특징
- 정적 파일만 포함
- 서버 로직 없음
- 배포 위치 변경 가능

#### 예시
- GitHub Pages
- Cloudflare Pages
- Vercel (static mode)

---

### 4.2 API Layer

#### 역할
- 데이터 조회(Read-only)
- 캐시 제어
- DB 추상화

#### 특징
- `/v1/*` API 제공
- DB 구조 노출 금지
- Cache-Control 헤더 관리

#### 구현 후보
- Cloudflare Workers
- Vercel Serverless / Edge Functions
- Fly.io
- Render

---

### 4.3 Database (Neon)

#### 역할
- 게시글 원본 저장소
- 카테고리 / 태그 관리
- 콘텐츠 변경 트리거

#### 특징
- PostgreSQL 호환
- Auto-suspend (Free Tier)
- DB 직접 접근은 API만 허용

---

## 5. 데이터 흐름 (Read Path)

```
1. 사용자가 페이지 접속
2. 프론트엔드가 API 호출
3. API 캐시 확인
   - HIT → 즉시 응답
   - MISS → DB 조회
4. API 응답 반환
5. 프론트엔드에서 Markdown 렌더링
```

---

## 6. 캐시 아키텍처

### 6.1 캐시 계층

```
Browser Cache
     ↓
Edge / API Cache
     ↓
Database Cache
```

- 상위 캐시일수록 비용 감소 효과 큼
- DB는 최후의 원본(Source of Truth)

---

### 6.2 캐시 무효화 전략

- API 요청은 `v` (version) 파라미터 허용
- 콘텐츠 변경 시:
  - `v` 증가
  - URL 변경 → 캐시 자동 무효화
- 명시적 purge API 사용 ❌

---

## 7. API 버전 전략

```
/v1/posts
/v1/posts/{slug}
```

- Breaking Change 발생 시 `/v2`로 분기
- 프론트는 특정 버전에만 의존

---

## 8. 보안 고려사항

### 8.1 DB 보안

- DB 접속 정보는 브라우저에 노출되지 않는다
- API 서버에서만 DB 접근 가능

---

### 8.2 API 보안

- Read-only API
- 인증/인가 없음 (공개 블로그)
- Rate Limit은 API 계층에서 처리

---

## 9. Out of Scope

본 아키텍처는 다음을 다루지 않는다.

- 사용자 인증
- 관리자 UI
- 게시글 작성/수정 UI
- 실시간 협업 기능

---

## 10. 확장 가능성

- API 캐시 강화
- 검색 엔진 연동
- 관리자 전용 API 추가
- SSR 프론트엔드로 전환

> 본 구조는 **블로그 → 문서 플랫폼 → 기술 아카이브**로의 확장을 전제로 설계되었다.

---

## 11. 요약

- 프론트는 정적
- 데이터는 외부
- 캐시는 API에서 제어
- DB는 Neon
- 재빌드 없는 콘텐츠 반영

> **플랫폼은 바뀌어도, 아키텍처는 바뀌지 않는다**

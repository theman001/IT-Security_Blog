# API Contract – IT-Security_Blog

## 1. 목적 (Purpose)

이 문서는 **IT-Security_Blog 프로젝트의 API 계약서**이다.

- 프론트엔드는 이 문서에 정의된 **응답 형식만 신뢰**한다.
- API 구현체(Cloudflare Workers, Vercel, Fly.io 등)는  
  **이 계약을 반드시 만족해야 한다.**
- DB(Neon PostgreSQL)는 이 계약의 내부 구현 사항일 뿐,  
  프론트엔드와 직접적인 연관이 없다.

> ❗ 이 문서는 배포 플랫폼과 무관하며,  
> 프론트 재빌드 없는 콘텐츠 반영을 전제로 한다.

---

## 2. 공통 규칙 (Global Rules)

### 2.1 Base URL

```
/v1
```

모든 API는 `/v1` prefix를 가진다.

---

### 2.2 Content-Type

```
Content-Type: application/json; charset=utf-8
```

---

### 2.3 시간 포맷

모든 시간 값은 **ISO 8601 (UTC)** 형식을 사용한다.

```
2026-01-12T03:57:09Z
```

---

### 2.4 공통 응답 래퍼

단순성을 위해 **기본적으로 래핑하지 않는다**.

```
{
  "data": ...
}
```

❌ 사용하지 않음  
👉 API 응답은 **최상위 JSON이 실제 데이터**

---

## 3. Post (게시글) 모델

### 3.1 Post Object

```
{
  "id": 1,
  "slug": "contents/TEST/test",
  "title": "정적 웹 호스팅 테스트용 글",
  "summary": "AI가 생성한 테스트용 보고서",
  "content_md": "# 개요\n이 문서는 ...",
  "category": {
    "id": 10,
    "name": "TEST",
    "slug": "TEST"
  },
  "tags": ["test", "ai"],
  "author_type": "ai",
  "created_at": "2026-01-12T03:57:09Z",
  "updated_at": "2026-01-12T03:57:09Z"
}
```

---

### 3.2 필드 설명

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 내부 식별자 |
| slug | string | URL 식별자 |
| title | string | 게시글 제목 |
| summary | string | 목록용 요약 |
| content_md | string | Markdown 원문 |
| category | object | 1-depth 카테고리 |
| tags | string[] | 태그 |
| author_type | string | ai / human |
| created_at | string | 생성 시각 |
| updated_at | string | 수정 시각 |

---

## 4. API 목록

### 4.1 게시글 목록 조회

```
GET /v1/posts
```

#### Query Parameters

| 이름 | 타입 | 설명 |
|---|---|---|
| category | string | 카테고리 slug |
| tag | string | 태그 |
| limit | number | 기본 20 |
| offset | number | 기본 0 |
| v | number | 캐시 무효화 버전 |

#### Response 200

```
[
  {
    "id": 1,
    "slug": "contents/TEST/test",
    "title": "정적 웹 호스팅 테스트용 글",
    "summary": "AI가 생성한 테스트용 보고서",
    "category": {
      "id": 10,
      "name": "TEST",
      "slug": "TEST"
    },
    "tags": ["test"],
    "created_at": "2026-01-12T03:57:09Z",
    "updated_at": "2026-01-12T03:57:09Z"
  }
]
```

📌 목록 API에서는 `content_md`를 포함하지 않는다.

---

### 4.2 게시글 상세 조회

```
GET /v1/posts/{slug}
```

#### Response 200

```
{
  "id": 1,
  "slug": "contents/TEST/test",
  "title": "정적 웹 호스팅 테스트용 글",
  "summary": "AI가 생성한 테스트용 보고서",
  "content_md": "# 개요\n이 문서는 ...",
  "category": {
    "id": 10,
    "name": "TEST",
    "slug": "TEST"
  },
  "tags": ["test"],
  "author_type": "ai",
  "created_at": "2026-01-12T03:57:09Z",
  "updated_at": "2026-01-12T03:57:09Z"
}
```

---

### 4.3 카테고리 목록

```
GET /v1/categories
```

```
[
  {
    "id": 10,
    "name": "TEST",
    "slug": "TEST",
    "depth": 1,
    "parent_id": null
  }
]
```

---

### 4.4 태그 목록

```
GET /v1/tags
```

```
[
  {
    "name": "test",
    "count": 5
  }
]
```

---

## 5. 캐시 계약 (Cache Contract)

### 5.1 Cache-Control 정책

| API | Cache-Control |
|---|---|
| /v1/posts | public, max-age=60 |
| /v1/posts/{slug} | public, max-age=300 |
| /v1/categories | public, max-age=3600 |
| /v1/tags | public, max-age=3600 |

---

### 5.2 캐시 무효화 전략

- 모든 읽기 API는 `v` 파라미터를 허용
- 콘텐츠 변경 시 `v` 증가
- URL 변경으로 캐시 자동 무효화
- 명시적 purge API는 사용하지 않음

---

## 6. 에러 응답 규격

### 6.1 공통 에러 형식

```
{
  "error": {
    "code": "POST_NOT_FOUND",
    "message": "Post not found"
  }
}
```

---

### 6.2 에러 코드

| HTTP | code | 설명 |
|---|---|---|
| 400 | BAD_REQUEST | 잘못된 요청 |
| 404 | POST_NOT_FOUND | 게시글 없음 |
| 404 | CATEGORY_NOT_FOUND | 카테고리 없음 |
| 500 | INTERNAL_ERROR | 서버 오류 |

---

## 7. Out of Scope

- 인증 / 권한
- 쓰기 API
- 관리자 API
- DB 스키마

---

## 8. 변경 정책

- 본 문서 변경은 Breaking Change
- 변경 시 `/v2`로 버전 분기

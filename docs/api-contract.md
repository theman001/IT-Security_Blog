# Data Model Contract – IT-Security_Blog

## 1. 목적 (Purpose)
이 문서는 **IT-Security_Blog** 프론트엔드가 사용하는 **데이터 모델(Data Model)과 스키마(Schema)** 를 정의한다.
REST API가 아닌 **Direct Serverless SQL** 방식을 사용하므로, API 엔드포인트 대신 **SQL 쿼리 결과(JSON Object)** 와 **DB 테이블 스키마**가 프론트엔드와 데이터 계층 간의 계약(Contract) 역할을 한다.

---

## 2. 데이터 모델 (Domain Objects)

프론트엔드(`api.js`)가 반환하는 핵심 도메인 객체의 형태이다.

### 2.1 Post (게시글)

게시글 목록 또는 상세 조회 시 반환되는 객체.

```json
{
  "id": 101,
  "title": "KakaoTalk Analysis Part 1",
  "slug": "contents/Security/Reverse/kakao-analysis",
  "content_md": "# Introduction...",
  "created_at": "2026-01-12T03:57:09.987Z",
  "tags": ["reversing", "android"],
  "author_type": "ai",
  "category_id": 10,
  "category_name": "Security"
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | Integer | 게시글 고유 ID (PK) |
| `title` | String | 게시글 제목 |
| `slug` | String | URL Path 및 고유 식별자 |
| `content_md` | String | Markdown 원본 (목록 조회시 일부만 가져오거나 제외될 수 있음) |
| `created_at` | DateTime (ISO) | 작성 일시 |
| `tags` | Array\<String\> | 태그 목록 |
| `author_type` | String | 작성자 유형 (`ai`, `human`) |
| `category_id` | Integer | 카테고리 ID |
| `category_name`| String | (JOIN 결과) 카테고리 이름 |
| `previous_post`| Object (Optional) | 이전 글 정보 (상세 조회 시) |
| `next_post` | Object (Optional) | 다음 글 정보 (상세 조회 시) |

### 2.2 Category (카테고리)

카테고리 트리 구조를 구성하는 객체.

```json
{
  "id": 10,
  "name": "Security",
  "slug": "Security",
  "parent_id": null,
  "path": "Security",
  "level": 1,
  "post_count": 5,
  "sub_category_count": 2,
  "children": []
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | Integer | 카테고리 ID (PK) |
| `name` | String | 표시 이름 |
| `slug` | String | URL Segment |
| `parent_id` | Integer | 상위 카테고리 ID (Root는 null) |
| `path` | String | 전체 계층 경로 (예: `Security/Reversing`) |
| `level` | Integer | 계층 깊이 (1-based) |
| `children` | Array\<Category\> | 하위 카테고리 목록 (재귀적 구조) |
| `post_count` | Integer | 해당 카테고리의 게시글 수 |

---

## 3. Database Schema (Expectations)

프론트엔드 SQL이 정상 작동하기 위해 필요한 Neon DB 테이블 구조.

### 3.1 `reports` Table (게시글)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | SERIAL | NO | Primary Key |
| `title` | VARCHAR | NO | 제목 |
| `slug` | VARCHAR | NO | URL 식별자 (Unique) |
| `content_md` | TEXT | YES | Markdown 본문 |
| `created_at` | TIMESTAMP | NO | 생성일 (Default: NOW()) |
| `category_id` | INTEGER | YES | FK -> `categories.id` |
| `tags` | JSONB / TEXT[] | YES | 태그 배열 |
| `author_type` | VARCHAR | YES | 'ai' or 'human' |

### 3.2 `categories` Table (카테고리)

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | SERIAL | NO | Primary Key |
| `name` | VARCHAR | NO | 카테고리명 |
| `slug` | VARCHAR | NO | URL Segment |
| `parent_id` | INTEGER | YES | FK -> `categories.id` (Self Reference) |

---

## 4. Query Interface (Frontend Usage)

`public/assets/js/api.js` 참조.

- **`fetchCategories()`**: Recursive CTE를 사용하여 트리 구조 조회.
- **`fetchPosts(category, tag, page)`**: 조건부 `WHERE` 절 동적 생성.
- **`fetchPostBySlug(slug)`**: 단일 게시글 및 인접 게시글(Lead/Lag) 조회.

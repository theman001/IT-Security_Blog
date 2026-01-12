# IT-Security_Blog

# Blog Content API (v1)

정적 블로그 프론트엔드를 위한 **Headless Content API**입니다.  
API는 **Netlify Functions**로 제공되며,  
콘텐츠 데이터는 **Neon(PostgreSQL)** 에서 조회합니다.

- 콘텐츠 생성/수정/삭제: **GitHub Repository 기반**
- API 역할: **읽기 전용(Read-only)**

---

## 📐 API Versioning

모든 API는 **버전 prefix**를 사용합니다.

```
/v1/...
```

향후 변경 사항은 `/v2` 로 분리합니다.

---

## 🧭 Base URL

```
/.netlify/functions
```

예시:
```
/.netlify/functions/v1/posts
```

---

## 🔐 Authentication

- ❌ 인증 없음
- ❌ 토큰 없음
- ❌ 사용자 권한 관리 없음

> 이 API는 공개 읽기 전용 API입니다.

---

## 📖 OpenAPI Style Specification (v1)

### 🔹 Category Object

```yaml
Category:
  type: object
  properties:
    id:
      type: integer
    slug:
      type: string
      example: "SECURITY/cloud"
    name:
      type: string
      example: "cloud"
    parent_id:
      type: integer
      nullable: true
    depth:
      type: integer
```

---

### 🔹 Post Summary Object

```yaml
PostSummary:
  type: object
  properties:
    slug:
      type: string
      example: "contents/TEST/test"
    title:
      type: string
    created_at:
      type: string
      format: date-time
    category:
      type: string
```

---

### 🔹 Post Detail Object

```yaml
PostDetail:
  type: object
  properties:
    slug:
      type: string
    title:
      type: string
    content_md:
      type: string
    created_at:
      type: string
      format: date-time
    category:
      type: string
```

---

## 📂 API Endpoints

### 1️⃣ 카테고리 목록 조회

**Endpoint**
```
GET /v1/categories
```

**Response 200**
```json
[
  {
    "id": 1,
    "slug": "TEST",
    "name": "TEST",
    "parent_id": null,
    "depth": 1
  }
]
```

**curl**
```bash
curl -X GET https://<site>/.netlify/functions/v1/categories
```

---

### 2️⃣ 게시글 목록 조회

**Endpoint**
```
GET /v1/posts
```

**Query Parameters**
| name | required | description |
|---|---|---|
| category | ❌ | category slug |

**curl**
```bash
curl -X GET "https://<site>/.netlify/functions/v1/posts?category=TEST"
```

---

### 3️⃣ 게시글 상세 조회

**Endpoint**
```
GET /v1/post
```

**Query Parameters**
| name | required | description |
|---|---|---|
| slug | ✅ | post slug |

**curl**
```bash
curl -X GET "https://<site>/.netlify/functions/v1/post?slug=contents/TEST/test"
```

---

## ❌ Error Handling

| Status | Meaning |
|---|---|
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Internal Server Error |

---

## 🧠 Design Principles

- GitHub Repository = CMS
- Neon PostgreSQL = Source of Truth
- API = Read-only
- Folder structure = Category structure

---

## ✅ Summary

> Production-ready Headless Content API for static sites.

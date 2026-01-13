# Architecture

이 문서는 IT-Security Blog의 **기술적 구성과 동작 구조**를 설명합니다.  
콘텐츠의 성격이나 운영 목적에 대한 설명은 About 문서에서 다루며,  
여기서는 아키텍처 구성 요소와 흐름에만 집중합니다.

---

## Overall Structure

블로그는 정적 웹을 기반으로 다음과 같은 흐름으로 구성되어 있습니다.

```
[Git Repository]
   └─ Markdown Contents
        ↓
[Sync Script]
        ↓
[Database]
        ↓
[Static Frontend]
        ↓
[Cloudflare Pages]
        ↓
[User Browser]
```

Markdown 파일이 콘텐츠의 기준이 되며,  
데이터베이스는 조회 및 구조화를 위한 보조 저장소 역할을 합니다.

---

## Components

### 1. Contents (Markdown)

- 모든 게시글은 Markdown 파일로 관리
- Front Matter를 통해 메타데이터 정의
- 파일 시스템이 콘텐츠의 단일 기준(Source of Truth)

```
contents/
 ├─ security/
 │   ├─ web/
 │   │   └─ post.md
 │   └─ infra/
 └─ ai/
```

---

### 2. Sync Script

- Markdown 파일을 순회하며 DB와 동기화
- 생성 / 수정 / 삭제를 모두 감지
- 트랜잭션 기반으로 처리하여 중간 실패 방지
- 내용 변경이 없는 경우 UPDATE 생략

주요 동작:
- 파일 생성 → DB INSERT
- 파일 수정 → DB UPDATE (변경 감지)
- 파일 삭제 → DB DELETE

---

### 3. Database

- 게시글 메타데이터 및 카테고리 구조 저장
- Markdown 원문은 `content_md`로 저장
- 카테고리는 폴더 구조 기반으로 자동 생성/삭제

주요 테이블:
- reports
- categories

데이터베이스는 **언제든 Markdown 기준으로 재구성 가능**하도록 설계되었습니다.

---

### 4. Static Frontend

- 정적 HTML / CSS / JavaScript로 구성
- 서버 사이드 로직 없음
- 데이터 조회는 정적 리소스 또는 사전 생성된 데이터 사용

---

### 5. Hosting (Cloudflare Pages)

- GitHub `main` 브랜치 기준 자동 배포
- HTTPS 기본 제공
- CDN 캐싱을 통한 빠른 응답

배포 흐름:
1. GitHub main 브랜치 업데이트
2. Cloudflare Pages 빌드 트리거
3. 정적 파일 CDN 반영

---

## Front Matter Structure

게시글 메타데이터는 Front Matter로 관리합니다.

```
---
title: "Post Title"
tags: ["security", "ai"]
author_type: "admin"
date: 2026-01-12
---
```

- title: 게시글 제목
- tags: 분류용 태그
- author_type: 작성자 유형
- date: 게시일 기준

---

## Category Handling

- 카테고리는 폴더 구조를 그대로 반영
- 폴더 생성 → 카테고리 생성
- 폴더 삭제 → 카테고리 삭제
- depth는 폴더 깊이 기준으로 자동 계산

별도의 관리 UI 없이도 구조가 유지되도록 설계되었습니다.

---

## Security Considerations

- 서버 사이드 실행 코드 없음
- 인증 / 세션 / 쿠키 미사용
- 사용자 입력 처리 없음
- 정적 리소스만 제공

웹 애플리케이션 자체가 공격 대상이 되지 않도록  
구조적으로 공격면을 최소화했습니다.

---

## Summary

이 아키텍처는 다음을 전제로 설계되었습니다.

- 콘텐츠는 파일 시스템이 기준
- 정적 웹 중심의 단순한 구성
- 배포 및 운영 흐름의 예측 가능성
- 구조 변경 시 전체 재동기화 가능

Architecture 문서는  
블로그의 **기술적 구조를 이해하기 위한 참고 자료** 역할을 합니다.

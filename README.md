# Nerd

Electron + Vue 3 로컬 ERD 설계 앱입니다. MariaDB, Oracle, PostgreSQL DDL 내보내기를 지원합니다.

## 실행

```bash
npm install
npm run dev
```

## 기능

- 테이블/컬럼/관계를 캔버스에서 직접 설계
- `*.nerd.json` 문서로 저장하고 다시 열기
- 선택한 dialect로 `CREATE TABLE` / FK DDL 생성
- 협업 서버 호스트 골격 (실시간 동기화는 아직 없음)
- DB 스키마 import는 어댑터 자리만 있음

## 협업 서버만 따로 띄우기

```bash
npm run collab
```

기본 주소는 `http://127.0.0.1:4780` 입니다. `GET /health`, `POST /rooms`, `WS /ws` 엔드포인트가 준비되어 있습니다.

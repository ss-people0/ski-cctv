# 스키장 CCTV

Vue 3 + Vite + TypeScript. 스키장 웹캠을 모아 보는 개인용 정적 페이지. 배경과 조사 기록은 `../HANDOFF.md`에 있다. 사용자에게는 한국어로 답한다.

## 설명 방식

지금 개발하는 사람은 개발자가 아니다. 설명은 **간단하고, 명료하고, 이해하기 쉽게** 한다.

- 결론부터 짧게 말한다.
- 전문 용어는 쉬운 말로 바꾸고, 꼭 필요하면 한 줄로 뜻을 붙인다.
- 코드보다 화면에서 무엇이 달라지는지, 무엇을 하면 되는지를 설명한다.

## 명령

- `npm test`: Vitest (jsdom)
- `npm run build`: 타입 체크 + 빌드
- `npm run dev -- --host --port 5199`: 휴대폰 확인용 서버

## 구조

- `src/data/cams.ts`: 웹캠 데이터와 타입. 주소는 여기서만 관리한다.
- `src/data/sortResorts.ts`: `isPlayable`과 정렬 (재생 → 링크 → `investigate` → `pending`)
- `src/playingCam.ts`: 재생 중인 카드 id. 모든 카드가 공유한다.
- `src/components/CamCard.vue`: type·status별 카드, 크게 보기(Popover API)
- `src/components/HlsPlayer.vue`: hls.js 재생, 시간 제한, 스트림 정리

## 지킬 것

- 막힌 스트림은 프록시나 토큰 추출로 우회하지 않고 링크로 둔다. 강촌(서명 토큰)이 여기에 해당한다.
- HLS의 `playLimitSec`을 없애지 않는다. 용평(15초)과 하이원(30초)은 공식 플레이어의 제한이고, 웰리힐리 15초는 임의로 정한 값이다.
- 자동 재생하지 않는다. 클릭해야 시작하고, 동시에 하나만 재생한다.
- 하이원은 `http` + IP 주소라 `https` 배포에서는 `isPlayable`이 자동으로 링크 카드로 바꾼다.
- `main`에 푸시하면 `.github/workflows/deploy.yml`이 테스트·빌드 후 GitHub Pages에 배포한다.
- 공개 배포 전에 웰리힐리·용평 등 리조트의 임베드 허락과 약관을 확인한다. 지금은 개인용이라 보류했다.

## 함정

- 크게 보기는 `.screen`을 옮기지 않고 Popover로 올린다. DOM을 옮기면 유튜브가 다시 로딩될 수 있다.
- `popover` 요소는 기본이 `display: none`이라 `.screen`의 `display: grid`가 필요하다. 테스트도 `css: true`가 있어야 포커스 테스트가 통과한다.
- jsdom에는 `showPopover`가 없어 `CamCard.test.ts`에서 목으로 채운다.
- 재생 상태가 전역이라 테스트마다 카드를 언마운트한다(`enableAutoUnmount`).
- 웰리힐리 공식 사이트는 개발자 도구를 감지해 차단한다.

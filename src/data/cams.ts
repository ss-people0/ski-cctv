// 스키장 웹캠 데이터
// - 시즌마다 주소가 바뀌므로 코드가 아니라 이 파일만 고치면 되게 관리한다.
// - status: 'active'(사용 중) | 'pending'(주소 미공개/오픈 전) | 'investigate'(방식 확인 필요)

export type CamStatus = 'active' | 'pending' | 'investigate';

export type Cam = { id: string; name: string; status: CamStatus } & (
  | { type: 'hls'; url: string; playLimitSec: number; popupUrl?: string } // .m3u8 스트림 → hls.js (Safari는 네이티브 재생)
  | { type: 'youtube'; videoId: string }
  | { type: 'link'; url: string | null }               // 직접 재생 불가 → 새 창 링크 (null이면 officialPage)
);

export interface Resort {
  id: string;
  name: string;
  region: string;
  officialPage: string;
  note?: string;
  coord?: { lat: number; lon: number }; // 날씨 조회용 스키장 위치
  emergency?: { label: string; tels: string[] }[]; // 사고 시 스키장 내 연락처(라벨당 번호 1개 이상)
  cams: Cam[];
}

// 용평 공식 플레이어가 트래픽 절감을 위해 15초 뒤 스트림을 끊으므로 웰리힐리에도 같은 제한을 쓴다.
const PLAY_LIMIT_SEC = 15;
// 하이원 공식 팝업은 30초 뒤 닫힌다.
const HIGH1_PLAY_LIMIT_SEC = 30;
// 강촌 공식 페이지와 open-ski-data에 공개된 서명 토큰(2027-10-30 만료). 막히면 링크로 되돌린다.
const GANGCHON_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRoIjoiL21haW4uc3RyZWFtIiwiZXhwIjoxODI0ODcyNDAwfQ.ZQxQ30C3ZxdlaA88LHJTN1dhdMhxxjPUAEI1ymZnB1g';

// 화면에는 이 순서대로 나온다.
export const resorts: readonly Resort[] = [
  // ───────────────────────── 모나용평 ─────────────────────────
  {
    id: 'yongpyong',
    name: '모나용평',
    region: '강원 평창',
    officialPage: 'https://www.yongpyong.co.kr/kor/guide/realTimeNews/ypResortWebcam.do',
    coord: { lat: 37.6459, lon: 128.6815 }, // 평창 대관령면
    emergency: [
      { label: '본부', tels: ['033-330-7362'] },
      { label: '상황실', tels: ['033-330-8253'] },
      { label: '레인보우', tels: ['033-330-7195'] },
    ],
    note: 'cam09·03·07은 공식 웹캠 페이지에 없고 SkiWatch(open-ski-data)에서 확인한 주소다(2026-11-24). 언제든 막힐 수 있다.',
    cams: [
      { id: 'yongpyong-cam08', name: '베이스전경 / 레드 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam08/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam10', name: '핑크 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam10/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam11', name: '옐로우 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam11/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam04', name: '메가그린 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam04/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam09', name: '골드 베이스', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam09/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam03', name: '골드 정상', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam03/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam07', name: '레인보우 베이스', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam07/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam01', name: '발왕산 氣 스카이워크', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam01/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam02', name: '발왕산 천년주목숲길', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam02/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam05', name: '모나용평 진입로', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam05/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
    ],
  },

  // ───────────────────────── 지산리조트 ─────────────────────────
  {
    id: 'jisan',
    name: '지산리조트',
    region: '경기 이천',
    officialPage: 'https://www.jisanresort.co.kr/w/ski/slopes/webcam.asp',
    coord: { lat: 37.2566, lon: 127.3607 }, // 이천 마장면
    emergency: [{ label: '응급후송', tels: ['031-644-1570'] }],
    note: 'jisan1~3 스트림(livecity)은 신호가 들어와 재생한다(2026-11-24, CORS *). 공식 버튼은 아직 "26/27시즌에 뵙겠습니다"로 막혀 있다. 블루·실버는 아직 신호가 없어 오픈 준비 중.',
    cams: [
      { id: 'jisan-lemon',  name: '레몬 탑승장',            type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan1.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'jisan-orange', name: '오렌지/뉴오렌지 탑승장', type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan2.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'jisan-5-6',    name: '5번/6번 슬로프',         type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan3.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'jisan-blue',   name: '블루 탑승장',            type: 'link', status: 'pending', url: null },
      { id: 'jisan-silver', name: '실버 탑승장',            type: 'link', status: 'pending', url: null },
    ],
  },

  // ───────────────────────── 웰리힐리파크 ─────────────────────────
  {
    id: 'wellihilli',
    name: '웰리힐리파크',
    region: '강원 횡성',
    officialPage: 'https://www.wellihillipark.com/home/customer/webcam',
    coord: { lat: 37.5066, lon: 128.2707 }, // 횡성 둔내면
    emergency: [{ label: '패트롤실', tels: ['033-340-3696'] }],
    note: 'HLS(Wowza), CORS * (2026-11-24 확인). cam05는 404라 investigate. cam01은 목록에 없음.',
    cams: [
      { id: 'wellihilli-d1',     name: 'D1',        type: 'hls', status: 'active', url: 'https://live.wellihillipark.com/wellihillipark/_definst_/cam02.stream/playlist.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'wellihilli-base',   name: '베이스 광장', type: 'hls', status: 'active', url: 'https://live.wellihillipark.com/wellihillipark/_definst_/cam03.stream/playlist.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'wellihilli-b2',     name: 'B2',        type: 'hls', status: 'active', url: 'https://live.wellihillipark.com/wellihillipark/_definst_/cam04.stream/playlist.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'wellihilli-top',    name: '정상광장',   type: 'hls', status: 'investigate', url: 'https://live.wellihillipark.com/wellihillipark/_definst_/cam05.stream/playlist.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'wellihilli-dplus',  name: 'D+',        type: 'hls', status: 'active', url: 'https://live.wellihillipark.com/wellihillipark/_definst_/cam06.stream/playlist.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'wellihilli-water',  name: '워터 플라넷', type: 'hls', status: 'active', url: 'https://live.wellihillipark.com/wellihillipark/_definst_/cam07.stream/playlist.m3u8', playLimitSec: PLAY_LIMIT_SEC },
    ],
  },

  // ───────────────────────── 하이원리조트 ─────────────────────────
  {
    id: 'high1',
    name: '하이원리조트',
    region: '강원 정선',
    officialPage: 'https://www.high1.com/ski/slopeView.do?key=748&mode=p',
    coord: { lat: 37.2096, lon: 128.8257 }, // 정선 고한읍
    emergency: [{ label: '패트롤', tels: ['033-590-7119'] }],
    note: 'HLS가 http+IP 주소라 앱을 http로 열 때만 재생된다. https에서는 공식 팝업(popupUrl)을 새 창으로 연다.',
    cams: [
      { id: 'high1-ch1',  name: '제우스 2번 슬로프 입구', type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch1.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=1' },
      { id: 'high1-ch2',  name: '헤라 2번 슬로프 입구',   type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch2.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=2' },
      { id: 'high1-ch3',  name: '하이원탑',              type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch3.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=3' },
      { id: 'high1-ch4',  name: '아테나 1번 슬로프',      type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch4.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=4' },
      { id: 'high1-ch5',  name: '마운틴 허브 베이스',     type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch5.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=5' },
      { id: 'high1-ch6',  name: '아테나 2번 슬로프',      type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch6.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=6' },
      { id: 'high1-ch7',  name: '마운틴 베이스',          type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch7.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=7' },
      { id: 'high1-ch8',  name: '아테나 2번 슬로프 하단', type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch8.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=8' },
      { id: 'high1-ch9',  name: '빅토리아 상단',          type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch9.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=9' },
      { id: 'high1-ch10', name: '제우스 2번',             type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch10.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=10' },
      { id: 'high1-ch11', name: '밸리 허브 베이스',       type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch11.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=11' },
      { id: 'high1-ch12', name: '빅토리아 1번 슬로프',    type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch12.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=12' },
      { id: 'high1-ch13', name: '제우스 3번 슬로프',      type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch13.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=13' },
      { id: 'high1-ch14', name: '제우스 3번 중단부',      type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch14.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=14' },
      { id: 'high1-ch15', name: '아폴로 4번 중단부',      type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch15.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=15' },
      { id: 'high1-ch16', name: '아폴로 베이스',          type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch16.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=16' },
      { id: 'high1-ch17', name: '제우스 3번 하단',        type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch17.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=17' },
      { id: 'high1-ch18', name: '밸리 베이스',            type: 'hls', status: 'active', url: 'http://59.30.12.195:1935/live/ch18.stream/playlist.m3u8', playLimitSec: HIGH1_PLAY_LIMIT_SEC, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=18' },
    ],
  },

  // ───────────────────────── 휘닉스 평창 ─────────────────────────
  {
    id: 'phoenix',
    name: '휘닉스 평창',
    region: '강원 평창',
    officialPage: 'https://phoenixhnr.co.kr/page/pyeongchang/guide/operation/sketchMovie',
    coord: { lat: 37.5847, lon: 128.3233 }, // 평창 봉평면
    emergency: [{ label: '패트롤', tels: ['033-330-3126', '033-330-3127', '033-330-6373'] }],
    note: 'HLS(streaming.phoenixhnr.co.kr), CORS *. 주소는 사용자가 준 목록(2026-11-24, 7개 모두 신호 확인). 심볼은 공식 파비콘(P 마크).',
    cams: [
      { id: 'phoenix-bulsae', name: '불새마루', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/ht_01_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-penguin', name: '펭귄', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/bc_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-hawk', name: '호크/스패로우', type: 'hls', status: 'pending', url: 'https://streaming.phoenixhnr.co.kr/hls/yh_02_02.m3u8', playLimitSec: PLAY_LIMIT_SEC }, // 2026-11-25 세그먼트 404라 보류, 복구되면 active
      { id: 'phoenix-snowvillage', name: '스노우 빌리지', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/yh_01_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-dodo', name: '도도', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/sp_01_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-montblanc', name: '몽블랑 광장', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/mb_03_02.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-base', name: '베이스', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/bc_02_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
    ],
  },

  // ───────────────────────── 알펜시아 ─────────────────────────
  {
    id: 'alpensia',
    name: '알펜시아',
    region: '강원 평창',
    officialPage: 'https://www.alpensia.com/guide/web-cam.do',
    coord: { lat: 37.6565, lon: 128.6815 }, // 평창 대관령면
    emergency: [{ label: '패트롤 상황실', tels: ['033-339-0305'] }],
    note: '방송이 새로 시작되면 videoId가 바뀔 수 있다. 채널: UCrmFQpznvkrLQSjJG1wGdGg',
    cams: [
      { id: 'alpensia-live', name: '알펜시아 실시간', type: 'youtube', status: 'active', videoId: 'IBGo-_Y3-g4' },
    ],
  },

  // ───────────────────────── 엘리시안강촌 ─────────────────────────
  {
    id: 'gangchon',
    name: '엘리시안강촌',
    region: '강원 춘천',
    officialPage: 'https://www.elysian.co.kr/about-gangchon/ski#guide-to-using-slopes',
    coord: { lat: 37.8139, lon: 127.6386 }, // 춘천 남산면
    emergency: [{ label: '패트롤', tels: ['033-260-2000'] }],
    note: 'HLS에 공식이 발급한 서명 토큰이 필요. 토큰은 공식 페이지와 open-ski-data에 공개돼 있고 2027-10-30까지 유효하다(2026-11-24 확인). 만료/교체되면 재생이 끊기니 GANGCHON_TOKEN을 갱신한다.',
    cams: [
      { id: 'gangchon-webcam01', name: '챌린지하우스 광장', type: 'hls', status: 'active', url: `https://webcam01.elysian.co.kr/main.stream/playlist.m3u8?token=${GANGCHON_TOKEN}`, playLimitSec: PLAY_LIMIT_SEC },
      { id: 'gangchon-webcam02', name: '페가수스 슬로프', type: 'hls', status: 'active', url: `https://webcam02.elysian.co.kr/main.stream/playlist.m3u8?token=${GANGCHON_TOKEN}`, playLimitSec: PLAY_LIMIT_SEC },
      { id: 'gangchon-webcam03', name: '디어 슬로프', type: 'hls', status: 'active', url: `https://webcam03.elysian.co.kr/main.stream/playlist.m3u8?token=${GANGCHON_TOKEN}`, playLimitSec: PLAY_LIMIT_SEC },
      { id: 'gangchon-webcam04', name: '래빗 슬로프', type: 'hls', status: 'active', url: `https://webcam04.elysian.co.kr/main.stream/playlist.m3u8?token=${GANGCHON_TOKEN}`, playLimitSec: PLAY_LIMIT_SEC },
      { id: 'gangchon-webcam05', name: '드래곤 슬로프', type: 'hls', status: 'active', url: `https://webcam05.elysian.co.kr/main.stream/playlist.m3u8?token=${GANGCHON_TOKEN}`, playLimitSec: PLAY_LIMIT_SEC },
      { id: 'gangchon-webcam06', name: '알프하우스 광장', type: 'hls', status: 'active', url: `https://webcam06.elysian.co.kr/main.stream/playlist.m3u8?token=${GANGCHON_TOKEN}`, playLimitSec: PLAY_LIMIT_SEC },
    ],
  },
];

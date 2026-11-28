// 스키장 웹캠 데이터
// - 시즌마다 주소가 바뀌므로 코드가 아니라 이 파일만 고치면 되게 관리한다.
// - status: 'active'(사용 중) | 'pending'(주소 미공개/오픈 전) | 'investigate'(방식 확인 필요)
import type { CatalogSlope, NightStart, SlopeHour, UpcomingOpening } from './slopeStatus';

export type CamStatus = 'active' | 'pending' | 'investigate';

export type Cam = { id: string; name: string; status: CamStatus; group?: string } & ( // group: 상세 CCTV 목록 묶음 이름
  | { type: 'hls'; url: string; playLimitSec: number; popupUrl?: string; previewOnly?: true } // previewOnly: 상단 플레이어에서도 playLimitSec 뒤 멈춘다(중계 캠, 트래픽 절감). .m3u8 스트림 → hls.js (Safari는 네이티브 재생)
  | { type: 'vivaldi'; channel: number; serial: string; playLimitSec: number } // 비발디파크: hls가 아니라 소노 WESP SDK(WebSocket)로 재생한다
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
  symbol?: string; // 상세 상단의 공식 페이지 링크에 쓰는 리조트 심볼(public 기준 경로). 없으면 링크를 숨긴다
  hours?: SlopeHour[]; // 공식 공지에서 옮긴 운영시간. 자동 수집(slopes.json)이 없는 리조트에만 쓴다
  season?: string; // 시즌 안내 한 줄(개장일·첫 개방 슬로프 등 공식 공지 사실). 자동 수집이 없는 리조트에만 쓴다
  upcoming?: UpcomingOpening[]; // 공지된 슬로프 오픈 예정(손으로 입력, 날짜 지나면 화면에서 자동으로 빠짐)
  nightStart?: NightStart; // 공지된 야간 운영 시작일(손으로 입력, 시작일이 되면 화면에서 자동으로 빠짐)
  slopeCatalog?: CatalogSlope[]; // 공식 슬로프 안내에서 옮긴 전체 목록. 실시간 목록이 비어 있을 때만 화면에 쓴다
  cams: Cam[];
}

// 용평 공식 플레이어가 트래픽 절감을 위해 15초 뒤 스트림을 끊으므로 웰리힐리에도 같은 제한을 쓴다.
const PLAY_LIMIT_SEC = 15;
// 하이원 공식 팝업은 30초 뒤 닫힌다.
const HIGH1_PLAY_LIMIT_SEC = 30;
// 하이원 원본(http :1935)을 https로 넘겨주는 Vercel 중계(relay/). 원본 url로 되돌리면 https에서 다시 새 창(popupUrl)으로 열린다.
const RELAY = 'https://relay-rho-pearl.vercel.app/api';
const HIGH1_RELAY = `${RELAY}/high1`;
// 곤지암·무주·오투도 같은 중계(relay/api/konjiam·muju·o2.js)로 http 원본을 https로 받는다.
const KONJIAM_RELAY = `${RELAY}/konjiam`;
const MUJU_RELAY = `${RELAY}/muju`;
const O2_RELAY = `${RELAY}/o2`;
// 중계를 거치는 캠은 Vercel 무료 대역폭을 아끼려고 미리보기 시간 뒤 멈춘다(공식 팝업도 25~30초에서 끊는다).
const RELAY_PLAY_LIMIT_SEC = 30;
// 비발디파크 공식 온라인캠은 20초 뒤 스스로 끊는다. 우리도 비슷한 길이(30초)만 보여 준다.
const VIVALDI_PLAY_LIMIT_SEC = 30;
// 비발디파크 온라인캠은 소노호텔리조트 페이지에 평문으로 박힌 고정 라이선스 문자열을 그대로 쓴다(WESP SDK용).
const VIVALDI_TOKEN =
  ';b64707e34a200ee658255a03b96b6fb175ab8122aaed3462f8bb9f162ceab445e2ea8e66c0a0e7035c03354d7df4ff4b0a25a4519cbd8a11a5851fd6f71fef597d786574210744785c5bced6b51b7295da116039f706d42e87001761f1ba197ba91707dfb5f8ef49643e10ca4510cdcdbbfe7dbca96af5961b7265c27533c0fde1bbb7d09fe329b921da6b36a37ded7851cd4e1c7ed48db6e7a08f693331782c';
export { VIVALDI_TOKEN };
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
    symbol: 'symbols/yongpyong.png',
    emergency: [
      { label: '본부', tels: ['033-330-7362'] },
      { label: '상황실', tels: ['033-330-8253'] },
      { label: '레인보우', tels: ['033-330-7195'] },
    ],
    upcoming: [
      { name: '옐로우', date: '2026-11-27', time: '08:30' }, // 홈페이지 메인 이미지로만 공지(2026-11-26 사용자 전달)
      { name: '레드', date: '2026-12-02', time: '08:30' }, // 모나용평 인스타그램 공지 "2026.12.2.Wed. 08:30AM RED, OPEN"(2026-11-27 확인)
    ],
    // 운영시간: 공식 26/27시즌 리프트&렌탈요금 안내(rentCharge.do) 기준, 2026-11-28 확인.
    // '스키장 운영시간은 08:30-22:00이며, 정설 시간(16:30~18:00)에는 이용이 불가합니다.'
    // (같은 페이지의 '발권 가능 시간 08:00~21:00'은 무인발권기 시간이라 운영시간이 아니다.)
    // 자동 수집(slopes.json)이 있으면 그쪽이 우선이고, 수집이 실패한 날 이 값을 쓴다.
    hours: [
      { label: '주간', value: '08:30~16:30' },
      { label: '정설', value: '16:30~18:00' },
      { label: '야간', value: '18:00~22:00' },
    ],
    note: 'cam09·03·07은 공식 웹캠 페이지에 없고 SkiWatch(open-ski-data)에서 확인한 주소다(2026-11-24). 언제든 막힐 수 있다.',
    cams: [
      { id: 'yongpyong-cam08', group: '슬로프', name: '베이스전경 / 레드 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam08/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam10', group: '슬로프', name: '핑크 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam10/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam11', group: '슬로프', name: '옐로우 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam11/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam04', group: '슬로프', name: '메가그린 슬로프', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam04/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam09', group: '베이스·정상', name: '골드 베이스', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam09/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam03', group: '베이스·정상', name: '골드 정상', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam03/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam07', group: '베이스·정상', name: '레인보우 베이스', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam07/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam01', group: '발왕산·진입로', name: '발왕산 氣 스카이워크', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam01/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam02', group: '발왕산·진입로', name: '발왕산 천년주목숲길', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam02/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'yongpyong-cam05', group: '발왕산·진입로', name: '모나용평 진입로', type: 'hls', status: 'active', url: 'https://live.yongpyong.co.kr/cam05/index.m3u8', playLimitSec: PLAY_LIMIT_SEC },
    ],
  },

  // ───────────────────────── 지산리조트 ─────────────────────────
  {
    id: 'jisan',
    name: '지산리조트',
    region: '경기 이천',
    officialPage: 'https://www.jisanresort.co.kr/w/ski/slopes/webcam.asp',
    coord: { lat: 37.2566, lon: 127.3607 }, // 이천 마장면
    symbol: 'symbols/jisan.png',
    emergency: [{ label: '응급후송', tels: ['031-644-1570'] }],
    // 공식 '슬로프 오픈 현황' 표의 난이도 줄 + '슬로프 맵' 코스 소개에서 옮김(2026-11-27 확인).
    // 자동 수집이 같은 표를 읽으므로 실시간 목록이 있으면 그쪽을 쓰고, 없을 때만 이 목록을 쓴다.
    // 코스 이름의 하이픈은 코스 구분처럼 보여 화면에서는 가운뎃점으로 쓴다(1-1 → 1·1). 수집기도 같은 이름으로 맞춘다.
    slopeCatalog: [
      { name: '1·1', level: '초급' },
      { name: '1', level: '초급' },
      { name: '2', level: '중급' },
      { name: '뉴 오렌지', level: '중급' },
      { name: '3(어린이 전용)', level: '중급' },
      { name: '5', level: '상급' },
      { name: '6', level: '최상급' },
      { name: '7', level: '중상급' },
    ],
    note: 'jisan1~3 스트림(livecity)은 신호가 들어와 재생한다(2026-11-24, CORS *). 공식 버튼은 아직 "26/27시즌에 뵙겠습니다"로 막혀 있다. 블루·실버는 공식 페이지 cam_sel(4)/(5) 순서대로 jisan4·5(2026-11-26 신호·CORS * 확인).',
    cams: [
      { id: 'jisan-lemon',  name: '레몬 탑승장',            type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan1.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'jisan-orange', name: '오렌지/뉴오렌지 탑승장', type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan2.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'jisan-5-6',    name: '5번/6번 슬로프',         type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan3.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'jisan-blue',   name: '블루 탑승장',            type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan4.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'jisan-silver', name: '실버 탑승장',            type: 'hls',  status: 'active',  url: 'https://ant.livecity.co.kr:5443/jisancam/streams/jisan5.m3u8', playLimitSec: PLAY_LIMIT_SEC },
    ],
  },

  // ───────────────────────── 휘닉스 평창 ─────────────────────────
  {
    id: 'phoenix',
    name: '휘닉스 평창',
    region: '강원 평창',
    officialPage: 'https://phoenixhnr.co.kr/page/pyeongchang/guide/operation/sketchMovie',
    coord: { lat: 37.5847, lon: 128.3233 }, // 평창 봉평면
    symbol: 'symbols/phoenix.png',
    emergency: [{ label: '패트롤', tels: ['033-330-3126', '033-330-3127', '033-330-6373'] }],
    note: 'HLS(streaming.phoenixhnr.co.kr), CORS *. 주소는 사용자가 준 목록(2026-11-24, 7개 모두 신호 확인). 심볼은 공식 파비콘(P 마크).',
    nightStart: { date: '2026-12-04' }, // 공식 공지 14515(2026-11-26): 야간 운영 12/4~ 주중·주말, 정설 16:00~18:00
    cams: [
      { id: 'phoenix-bulsae', name: '불새마루', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/ht_01_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-penguin', name: '펭귄', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/bc_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-hawk', name: '호크/스패로우', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/yh_02_02.m3u8', playLimitSec: PLAY_LIMIT_SEC }, // 11-25 저녁~11-26 오후 끊겼다가 17:43 복구 확인
      { id: 'phoenix-snowvillage', name: '스노우 빌리지', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/yh_01_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-dodo', name: '도도', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/sp_01_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-montblanc', name: '몽블랑 광장', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/mb_03_02.m3u8', playLimitSec: PLAY_LIMIT_SEC },
      { id: 'phoenix-base', name: '베이스', type: 'hls', status: 'active', url: 'https://streaming.phoenixhnr.co.kr/hls/bc_02_01.m3u8', playLimitSec: PLAY_LIMIT_SEC },
    ],
  },

  // ───────────────────────── 하이원리조트 ─────────────────────────
  {
    id: 'high1',
    name: '하이원리조트',
    region: '강원 정선',
    officialPage: 'https://www.high1.com/ski/slopeView.do?key=748&mode=p',
    coord: { lat: 37.2096, lon: 128.8257 }, // 정선 고한읍
    symbol: 'symbols/high1.png',
    emergency: [{ label: '패트롤', tels: ['033-590-7119'] }],
    note: '원본 HLS가 http+IP(:1935)라 https에서 막혀, Vercel 중계(relay/)를 거쳐 https로 받는다. 중계가 죽으면 원본 url로 되돌리면 popupUrl 새 창으로 돌아간다.',
    cams: [
      { id: 'high1-ch1',  name: '제우스 2번 슬로프 입구', type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=1&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=1' },
      { id: 'high1-ch2',  name: '헤라 2번 슬로프 입구',   type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=2&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=2' },
      { id: 'high1-ch3',  name: '하이원탑',              type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=3&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=3' },
      { id: 'high1-ch4',  name: '아테나 1번 슬로프',      type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=4&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=4' },
      { id: 'high1-ch5',  name: '마운틴 허브 베이스',     type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=5&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=5' },
      { id: 'high1-ch6',  name: '아테나 2번 슬로프',      type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=6&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=6' },
      { id: 'high1-ch7',  name: '마운틴 베이스',          type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=7&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=7' },
      { id: 'high1-ch8',  name: '아테나 2번 슬로프 하단', type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=8&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=8' },
      { id: 'high1-ch9',  name: '빅토리아 상단',          type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=9&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=9' },
      { id: 'high1-ch10', name: '제우스 2번',             type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=10&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=10' },
      { id: 'high1-ch11', name: '밸리 허브 베이스',       type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=11&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=11' },
      { id: 'high1-ch12', name: '빅토리아 1번 슬로프',    type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=12&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=12' },
      { id: 'high1-ch13', name: '제우스 3번 슬로프',      type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=13&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=13' },
      { id: 'high1-ch14', name: '제우스 3번 중단부',      type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=14&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=14' },
      { id: 'high1-ch15', name: '아폴로 4번 중단부',      type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=15&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=15' },
      { id: 'high1-ch16', name: '아폴로 베이스',          type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=16&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=16' },
      { id: 'high1-ch17', name: '제우스 3번 하단',        type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=17&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=17' },
      { id: 'high1-ch18', name: '밸리 베이스',            type: 'hls', status: 'active', url: `${HIGH1_RELAY}?ch=18&f=playlist.m3u8`, playLimitSec: HIGH1_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.high1.com/webcam/pop_webcam.do?ch=18' },
    ],
  },

  // ───────────────────────── 웰리힐리파크 ─────────────────────────
  {
    id: 'wellihilli',
    name: '웰리힐리파크',
    region: '강원 횡성',
    officialPage: 'https://www.wellihillipark.com/home/customer/webcam',
    coord: { lat: 37.5066, lon: 128.2707 }, // 횡성 둔내면
    symbol: 'symbols/wellihilli.png',
    emergency: [{ label: '패트롤실', tels: ['033-340-3696'] }],
    // 공식 공지 "26/27 WINTER SEASON OPEN 2026.12.4. FRI. 09:00"(사용자 휴대폰 캡처, 2026-11-26).
    upcoming: [{ name: '스키장', date: '2026-12-04', time: '09:00' }],
    // 개장 공지 포스터의 운영시간 "주간 09:00~16:30 / 야간 18:30~22:00"(2026-11-27 인스타그램 @wellihillipark). 개장일부터 야간 운영.
    nightStart: { date: '2026-12-04' },
    // 공식 홈페이지 '슬로프안내' 표에서 옮김(사용자 휴대폰 캡처, 2026-11-26). 사이트가 자동 접근을 막아 수집 대상이 아니다.
    slopeCatalog: [
      { name: 'A1 펀파크', level: '최상급' },
      { name: 'A2 비기너파크', level: '초급' },
      { name: 'A3 펀슬로프', level: '초급' },
      { name: 'B1 기문코스', level: '중급' },
      { name: 'B2 중급 모글', level: '중급' },
      { name: 'C1', level: '최상급' },
      { name: 'C2', level: '최상급' },
      { name: 'C3', level: '최상급' },
      { name: 'C4', level: '상급' },
      { name: 'C5', level: '상급' },
      { name: 'D1', level: '초급' },
      { name: 'D2 하프파이프', level: '최상급' },
      { name: 'D3 상급 모글', level: '상급' },
      { name: 'D+', level: '초급' },
      { name: 'E1', level: '최상급' },
      { name: 'E2 기문코스', level: '상급' },
      { name: 'E3', level: '최상급' },
      { name: 'S1', level: '중급' },
      { name: 'S2', level: '초급' },
    ],
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

  // ───────────────────────── 알펜시아 ─────────────────────────
  {
    id: 'alpensia',
    name: '알펜시아',
    region: '강원 평창',
    officialPage: 'https://www.alpensia.com/guide/web-cam.do',
    coord: { lat: 37.6565, lon: 128.6815 }, // 평창 대관령면
    symbol: 'symbols/alpensia.png',
    emergency: [{ label: '패트롤 상황실', tels: ['033-339-0305'] }],
    // 공식 공지 10734(2026-11-27) "26/27 동계시즌 스키장 운영 일정 안내": 스키장 2026.11.28(토)~2027.3.7(일).
    // 인스타그램(@alpensia_official)도 같은 날 "드디어 내일 개장" 공지. 시각은 어디에도 없음.
    upcoming: [{ name: '스키장', date: '2026-11-28' }],
    note: '방송이 새로 시작되면 videoId가 바뀔 수 있다. 채널: UCrmFQpznvkrLQSjJG1wGdGg',
    cams: [
      { id: 'alpensia-live', name: '알펜시아 실시간', type: 'youtube', status: 'active', videoId: 'hU6FtSnVEyw' }, // 2026-11-24 11:11 UTC 시작한 방송(이전 IBGo-_Y3-g4는 종료)
    ],
  },

  // ───────────────────────── 엘리시안강촌 ─────────────────────────
  {
    id: 'gangchon',
    name: '엘리시안강촌',
    region: '강원 춘천',
    officialPage: 'https://www.elysian.co.kr/about-gangchon/ski#guide-to-using-slopes',
    coord: { lat: 37.8139, lon: 127.6386 }, // 춘천 남산면
    symbol: 'symbols/gangchon.png',
    emergency: [{ label: '패트롤', tels: ['033-260-2000'] }],
    // 공식 스키장 소개 '슬로프 운영안내' 운영 기간 "2026년 11월 28일 ~"(2026-11-26 확인, 시각은 공지에 없음).
    upcoming: [{ name: '스키장', date: '2026-11-28' }],
    // 공식 스키장 소개 > 슬로프 맵의 난이도 필터(초급/중급/최상급)에서 옮김(2026-11-26). "전체 10면, 초·중급 8면"과 일치.
    // 슬로프 현황 API가 26/27 시즌 값을 아직 비워 둬서, 값이 들어오기 전까지 이 목록을 전부 미개방으로 보여준다.
    slopeCatalog: [
      { name: '래빗', level: '초급' },
      { name: '팬더', level: '초급' },
      { name: '드래곤', level: '중급' },
      { name: '퓨마', level: '중급' },
      { name: '호스', level: '중급' },
      { name: '디어', level: '중급' },
      { name: '페가수스', level: '중급' },
      { name: '제브라', level: '중급' },
      { name: '재규어', level: '최상급' },
      { name: '래퍼드', level: '최상급' },
    ],
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

  // ───────────────────────── 비발디파크 ─────────────────────────
  // 2026-11-27 추가. 라이브 캠 주소는 아직 없어서 캠 자리에 준비 중 안내를 띄운다.
  {
    id: 'vivaldi',
    name: '비발디파크',
    region: '강원 홍천',
    officialPage: 'https://www.sonohotelsresorts.com/skiboard/info',
    coord: { lat: 37.6481, lon: 127.6841 }, // 홍천 서면 팔봉리
    // 공식 스키&보드 이용안내(2026-11-27 확인): 운영기간 2026.11.27~2027.3.1, 정설 17:30~19:00,
    // 심야 23:00~다음 날 03:00은 12/18~2/13(월요일 미운영).
    hours: [
      { label: '주간', value: '09:00~17:30' },
      { label: '정설', value: '17:30~19:00' },
      { label: '야간', value: '19:00~23:00' },
      { label: '심야', value: '23:00~03:00' },
    ],
    season: '26/27 시즌 11월 27일 09:00 개장 · 3월 1일까지',
    // 공식 '스키&보드 소개 > 슬로프 안내' 표에서 옮김(2026-11-27 확인). 난이도는 공식 표기 그대로.
    // 블루스는 공식 표기가 '초심'이라 그대로 두고, 락은 24/25 시즌부터 미운영이라 이름에 붙여 둔다.
    slopeCatalog: [
      { name: '블루스', level: '초심' },
      { name: '발라드', level: '초급' },
      { name: '재즈', level: '중급' },
      { name: '레게', level: '중상급' },
      { name: '클래식', level: '중상급' },
      { name: '펑키', level: '중상급' },
      { name: '테크노Ⅰ', level: '중상급' },
      { name: '테크노Ⅱ', level: '상급' },
      { name: '힙합Ⅰ', level: '중상급' },
      { name: '힙합Ⅱ', level: '중상급' },
      { name: '락(미운영)', level: '최상급' },
    ],
    // 패트롤: 슬로프 안내판·현수막의 '부상자 발생 제보 전화 033-439-8484'.
    // 리프트권 안내 후기(2023.02), 렌탈샵 후기(2025.02), 사고 후기 현수막 사진(2026.02)에서 같은 번호 확인.
    emergency: [
      { label: '패트롤', tels: ['033-439-8484'] },
      { label: '리조트 대표', tels: ['1588-4888'] },
    ],
    note: '공식 온라인캠 16대 중 클래식은 레게와 같은 카메라(채널·시리얼 동일)라 15개만 보여 준다. hls가 아니라 소노 WESP SDK로 WebSocket 영상을 그리며, 공식 페이지처럼 30초 미리보기 뒤 멈춘다(2026-11-28).',
    // 공식 카메라 목록 API(mice.sonohotelsresorts.com front.main.getCamListDataAjax)의 chn·remark를 그대로 썼다.
    // 한 카메라를 여러 각도로 쓰는 곳(블루스·재즈 상단 등)은 시리얼이 달라 따로 재생된다.
    cams: [
      { id: 'vivaldi-skiworld', group: '슬로프', name: '슬로프 전경(Ski World)', type: 'vivaldi', status: 'active', channel: 8, serial: 'TW0014A15451', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-ballad-top', group: '슬로프', name: '발라드 상단', type: 'vivaldi', status: 'active', channel: 11, serial: 'TD0314A17496', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-ballad-bottom', group: '슬로프', name: '발라드 하단', type: 'vivaldi', status: 'active', channel: 2, serial: 'TW0014A15451', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-jazz-top', group: '슬로프', name: '재즈 상단', type: 'vivaldi', status: 'active', channel: 4, serial: 'XU0121A37907', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-jazz-bottom', group: '슬로프', name: '재즈 하단', type: 'vivaldi', status: 'active', channel: 1, serial: 'TW0014A15451', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-techno-top', group: '슬로프', name: '테크노 상단', type: 'vivaldi', status: 'active', channel: 2, serial: 'XU0121A37904', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-techno-bottom', group: '슬로프', name: '테크노 하단', type: 'vivaldi', status: 'active', channel: 5, serial: 'XU0121A37904', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-blues', group: '슬로프', name: '블루스', type: 'vivaldi', status: 'active', channel: 4, serial: 'TW0014A15451', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-reggae', group: '슬로프', name: '레게', type: 'vivaldi', status: 'active', channel: 10, serial: 'TD0314A17496', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-funky-top', group: '슬로프', name: '펑키 상단', type: 'vivaldi', status: 'active', channel: 5, serial: 'TW0014A15451', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-funky-bottom', group: '슬로프', name: '펑키 하단', type: 'vivaldi', status: 'active', channel: 8, serial: 'XU0121A37904', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-hiphop', group: '슬로프', name: '힙합', type: 'vivaldi', status: 'active', channel: 6, serial: 'TW0014A15451', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-summit', group: '정상', name: '스키월드 정상', type: 'vivaldi', status: 'active', channel: 9, serial: 'TW0014A15451', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-snowyland1', group: '스노위랜드', name: '스노위랜드 1', type: 'vivaldi', status: 'active', channel: 16, serial: 'TD0314A17496', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
      { id: 'vivaldi-snowyland2', group: '스노위랜드', name: '스노위랜드 2', type: 'vivaldi', status: 'active', channel: 12, serial: 'TD0314A17496', playLimitSec: VIVALDI_PLAY_LIMIT_SEC },
    ],
  },

  // ───────────────────────── 무주덕유산리조트 ─────────────────────────
  {
    id: 'muju',
    name: '무주 덕유산',
    region: '전북 무주',
    officialPage: 'https://www.mdysresort.com/',
    coord: { lat: 35.8931, lon: 127.7435 }, // 무주 설천면 심곡리
    // 공식 홈페이지 공지(2026-11-25 17:30): 11/27(금) 09:00 오픈, 오픈 슬로프 '설천 스피츠 하단', 09:00~22:00.
    // 정설 16:00~18:00, 주간 09:00~16:00 / 야간 18:00~22:00.
    // 공식 '슬로프 오픈일정' popup(convert_main_slope_221207.asp)의 시간표가 주간 09:00~16:00·야간 18:00~22:00,
    // 요금안내(m.mdysresort.com/price/price_01.asp)가 '정설시간(16:00~18:00)'으로 밝힌다(2026-11-27 확인).
    // 새벽 07:00~09:00·자정 22:00~24:00은 시즌별 운영이라 넣지 않는다.
    hours: [
      { label: '주간', value: '09:00~16:00' },
      { label: '정설', value: '16:00~18:00' },
      { label: '야간', value: '18:00~22:00' },
    ],
    season: '26/27 시즌 11월 27일 09:00 개장 · 이번 시즌 25면',
    // 공식 '오픈슬로프 현황' popup(convert_main_slope_221207.asp)의 코스 목록에서 옮김(2026-11-27 확인).
    // 수집기(collect_slopes.py muju)와 이름·난이도를 똑같이 맞춰 두어야 칩이 한 슬로프로 묶인다
    // (상단·하단은 띄어 쓰고, 이번 시즌 새로 여는 '안단테' 포함 25면).
    slopeCatalog: [
      { name: '이스턴 하단', level: '초급' },
      { name: '서역기행 상단', level: '초급' },
      { name: '서역기행 하단', level: '초급' },
      { name: '스피츠 하단', level: '초급' },
      { name: '스키학교 강습장', level: '초급' },
      { name: '이스턴 상단', level: '중급' },
      { name: '웨스턴', level: '중급' },
      { name: '실크로드 상단', level: '중급' },
      { name: '실크로드 하단', level: '중급' },
      { name: '루키힐', level: '중급' },
      { name: '터보', level: '중급' },
      { name: '커넥션', level: '중급' },
      { name: '미뉴에트', level: '상급' },
      { name: '프리웨이', level: '상급' },
      { name: '야마가', level: '상급' },
      { name: '파노라마', level: '상급' },
      { name: '레이더스 하단', level: '상급' },
      { name: '왈츠', level: '상급' },
      { name: '알레그로', level: '상급' },
      { name: '썬다운', level: '상급' },
      { name: '레이더스 상단', level: '최상급' },
      { name: '폴카', level: '최상급' },
      { name: '카덴자', level: '최상급' },
      { name: '안단테', level: '최상급' },
      { name: '모차르트', level: '최상급' },
    ],
    // 공식 '슬로프119' 페이지(현재): 안내 패트롤 7331 / 의무실 7330, 부상자 제보전화 063-320-7333.
    // 7332(만선본부)는 2003년 '주요 전화번호 안내'에만 있어 현재 확인되지 않아 넣지 않았다.
    emergency: [
      { label: '패트롤', tels: ['063-320-7331'] },
      { label: '패트롤 제보', tels: ['063-320-7333'] },
      { label: '의무실', tels: ['063-320-7330'] },
      { label: '리조트 대표', tels: ['063-322-9000'] },
    ],
    note: '원본이 http라 https에서 막혀 Vercel 중계(relay/api/muju.js)를 거친다. 주소에 붙는 9시간짜리 서명 토큰은 중계가 팝업 페이지에서 그때그때 뽑아 쓴다. 공식 팝업(30초)도 함께 열 수 있다.',
    // 공식 웹캠 페이지(webcam.asp)의 이름과 cam_num 그대로(2026-11-28 확인). 무주는 밤에도 화면이 밝게 나온다.
    cams: [
      { id: 'muju-cam01', name: '만선하우스', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=01&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=01' },
      { id: 'muju-cam02', name: '만선봉 정상', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=02&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=02' },
      { id: 'muju-cam03', name: '하이디 하우스', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=03&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=03' },
      { id: 'muju-cam04', name: '서역기행·썬다운', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=04&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=04' },
      { id: 'muju-cam05', name: '설천하우스', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=05&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=05' },
      { id: 'muju-cam06', name: '설천상단슬로프', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=06&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=06' },
      { id: 'muju-cam07', name: '설천봉 정상', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=07&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=07' },
      { id: 'muju-cam08', name: '모차르트·미뉴에트', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=08&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=08' },
      { id: 'muju-cam09', name: '폴카', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=09&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=09' },
      { id: 'muju-cam10', name: '실크로드', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=10&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=10' },
      { id: 'muju-cam11', name: '커넥션', type: 'hls', status: 'active', url: `${MUJU_RELAY}?cam=11&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://www.mdysresort.com/guide/webcam_popup_jh.asp?cam_num=11' },
    ],
  },

  // ───────────────────────── 오투리조트 ─────────────────────────
  {
    id: 'o2',
    name: '오투',
    region: '강원 태백',
    officialPage: 'https://o2resort.com/SKI/slopeOpen.jsp',
    coord: { lat: 37.1706, lon: 128.9475 }, // 태백 서학로
    // 공식 슬로프 오픈현황: 주간(오전) 09:00~13:00 / (오후) 13:00~16:30 / 야간 18:00~21:30.
    // 11/26 09:00 개장(드림1부터), 11/28 글로리2 추가. 26/27 시즌 슬로프 10면(신설 챌린지2·3).
    hours: [
      { label: '주간(오전)', value: '09:00~13:00' },
      { label: '주간(오후)', value: '13:00~16:30' },
      { label: '야간', value: '18:00~21:30' },
    ],
    season: '26/27 시즌 11월 26일 개장 · 드림1부터 순차 개방 · 챌린지2·3 신설',
    // 공식 '슬로프 오픈현황' 페이지의 슬로프 제원 표에서 옮김(2026-11-27 확인).
    // 표에 함께 있는 하프파이프·눈썰매장·익스트림파크는 슬로프가 아니라 뺀다.
    slopeCatalog: [
      { name: '드림1', level: '초급' },
      { name: '드림2', level: '초급' },
      { name: '헤드', level: '중급' },
      { name: '해피', level: '중급' },
      { name: '글로리1', level: '상급' },
      { name: '글로리2', level: '상급' },
      { name: '글로리3', level: '상급' },
      { name: '패션1', level: '최상급' },
      { name: '패션2', level: '최상급' },
      { name: '첼린지1', level: '최상급' },
      { name: '첼린지2', level: '최상급' },
      { name: '첼린지3', level: '최상급' },
    ],
    emergency: [
      { label: '패트롤', tels: ['033-580-7420'] },
      { label: '의무실', tels: ['033-580-7412'] },
    ],
    note: '원본이 http:8080이라 Vercel 중계(relay/api/o2.js)를 거친다. 채널 이름은 SkiWatch(open-ski-data) 목록에서 옮겼다(2026-11-28).',
    // 공식 웹캠 페이지는 깨졌지만 플레이어 페이지(streamhls2.jsp?ch=0~7)는 살아 있다(2026-11-28 확인).
    // ch0~3 → cam0~3, ch4~7 → cam20~23처럼 번호가 이어지지 않아 중계가 페이지에서 실제 파일 이름을 확인해 준다.
    // 공식 웹캠 팝업(cam-01~12.htm)이 모두 404라 채널 이름은 공식 자료로 확인할 수 없어, SkiWatch(powder-nomad/SkiWatch)의 오투 채널 목록에서 옮겼다(2026-11-28).
    cams: [
      { id: 'o2-ch0', name: '스키하우스', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=0&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=0' },
      { id: 'o2-ch1', name: '드림1', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=1&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=1' },
      { id: 'o2-ch2', name: '버금마루', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=2&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=2' },
      { id: 'o2-ch3', name: '으뜸마루', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=3&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=3' },
      { id: 'o2-ch4', name: '글로리1', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=4&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=4' },
      { id: 'o2-ch5', name: '해피', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=5&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=5' },
      { id: 'o2-ch6', name: '드림2', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=6&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=6' },
      { id: 'o2-ch7', name: '글로리3', type: 'hls', status: 'active', url: `${O2_RELAY}?ch=7&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true, popupUrl: 'http://118.46.149.144:8080/streaming/streamhls2.jsp?ch=7' },
    ],
  },

  // ───────────────────────── 곤지암리조트 ─────────────────────────
  {
    id: 'konjiam',
    name: '곤지암',
    region: '경기 광주',
    officialPage: 'https://m.konjiamresort.co.kr/ski/skiLift.dev',
    coord: { lat: 37.3372, lon: 127.2953 }, // 광주 도척면
    // 공식 공지(2026-11-19): 개장 일정은 제설·기상·안전 점검 후 공지 → 11-27 기준 날짜 미공지.
    // 공식 스키장 안내: 개장일~12/27 08:00~24:00, 12/28~ 주중 08:00·주말/공휴일 07:00에 열어 다음 날 01:00까지, 정설 18:00~19:00.
    hours: [
      { label: '운영', value: '08:00~24:00' },
      { label: '12/28~', value: '08:00~01:00' },
      { label: '정설', value: '18:00~19:00' },
    ],
    season: '12월 중 개장 예정 · 공식 개장일은 아직 공지 전이에요',
    // 공식 '슬로프/리프트' 표(이용자수준)에서 옮김(2026-11-27 확인). 표의 '초/중급'·'중/상급'은 초중급·중상급으로 쓴다.
    slopeCatalog: [
      { name: '그램', level: '초급' },
      { name: '익시오', level: '초중급' },
      { name: '씽큐1', level: '상급' },
      { name: '씽큐2', level: '중급' },
      { name: '홈봇 1/2', level: '중상급' },
      { name: '홈봇 3', level: '초중급' },
      { name: '홈봇 4', level: '중급' },
      { name: 'CNP 1', level: '초중급' },
      { name: 'CNP 2', level: '상급' },
    ],
    // 공식 '안내 동영상'(스키장 이용 에티켓): 충돌·부상 시 SOS 번호 031-8026-5678.
    // 공식 '고객문의': 의무실 031-8026-5766(스키하우스 1F).
    emergency: [
      { label: '패트롤(SOS)', tels: ['031-8026-5678'] },
      { label: '의무실', tels: ['031-8026-5766'] },
      { label: '리조트 대표', tels: ['1661-8787'] },
    ],
    note: '원본이 http라 https에서 막혀 Vercel 중계(relay/api/konjiam.js)를 거친다(하이원과 같은 방식). 공식 웹캠은 24시간 송출한다.',
    // 공식 웹캠 페이지(m.konjiamresort.co.kr/ski/skiLveCam.dev)의 이름과 cam 번호 그대로(2026-11-28 확인).
    cams: [
      { id: 'konjiam-cam01', name: '정상 휴게소', type: 'hls', status: 'active', url: `${KONJIAM_RELAY}?cam=cam01&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true },
      { id: 'konjiam-cam02', name: '정상부 슬로프', type: 'hls', status: 'active', url: `${KONJIAM_RELAY}?cam=cam02&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true },
      { id: 'konjiam-cam05', name: '중간 슬로프', type: 'hls', status: 'active', url: `${KONJIAM_RELAY}?cam=cam05&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true },
      { id: 'konjiam-cam03', name: '초중급 베이스', type: 'hls', status: 'active', url: `${KONJIAM_RELAY}?cam=cam03&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true },
      { id: 'konjiam-cam04', name: '중상급 베이스', type: 'hls', status: 'active', url: `${KONJIAM_RELAY}?cam=cam04&f=playlist.m3u8`, playLimitSec: RELAY_PLAY_LIMIT_SEC, previewOnly: true },
    ],
  },

  // ───────────────────────── 오크밸리 ─────────────────────────
  {
    id: 'oakvalley',
    name: '오크밸리',
    region: '강원 원주',
    officialPage: 'https://www.oakvalley.co.kr/',
    coord: { lat: 37.4343, lon: 127.8175 }, // 원주 지정면 오크밸리1길 66
    // 공식 26/27 시즌권 공지: 스키장 2026.12.11~2027.2.20, 일반 활주 I·F·G + I-1 퍼니런파크·D 게이트, 리프트 2기.
    upcoming: [{ name: '스키장', date: '2026-12-11' }],
    // 26/27 운영시간은 아직 공지 전 → 지난 시즌 시간(주간 09:00~17:00 / 정설 17:00~18:30 / 야간 18:30~22:00).
    hours: [
      { label: '주간', value: '09:00~17:00' },
      { label: '정설', value: '17:00~18:30' },
      { label: '야간', value: '18:30~22:00' },
    ],
    season: '개장일은 12월 11일 예정 · 26/27 운영시간은 아직 공지 전이에요(지난 시즌 기준)',
    // 공식 '슬로프 / 리프트' 표에서 옮김(2026-11-27 확인). 슬로프는 I·F·G 3면(+I-1 퍼니런파크는 파크라 뺀다).
    slopeCatalog: [
      { name: 'I', level: '초급' },
      { name: 'F', level: '중급' },
      { name: 'G', level: '중급' },
    ],
    emergency: [{ label: '리조트 대표', tels: ['033-730-3500'] }],
    cams: [],
  },

  // ───────────────────────── 에덴밸리 ─────────────────────────
  {
    id: 'edenvalley',
    name: '에덴밸리',
    region: '경남 양산',
    officialPage: 'https://www.edenvalley.co.kr/',
    coord: { lat: 35.4291, lon: 128.9845 }, // 양산 원동면 어실로
    // 공식 26/27 시즌권 안내: 12월 중순 개장 예정, 첫 개방은 베이직(초급)·우라누스(중급), 운영 13:30~23:00(정설 17:30~19:00).
    hours: [
      { label: '운영', value: '13:30~23:00' },
      { label: '정설', value: '17:30~19:00' },
    ],
    season: '12월 중순 개장 예정 · 베이직·우라누스부터 개방',
    // 공식 스키장 소개의 '슬로프 제원' 표에서 옮김(2026-11-27 확인). 새턴은 표에 '루지트랙으로 변경'이라 빼다.
    slopeCatalog: [
      { name: '베이직', level: '초급' },
      { name: '메인', level: '초급' },
      { name: '쥬피터', level: '중급' },
      { name: '우라누스', level: '중급' },
      { name: '머큐리', level: '상급' },
      { name: '비너스', level: '상급' },
    ],
    emergency: [
      { label: '종합안내', tels: ['055-379-8159', '055-379-8160'] },
      { label: '리조트 대표', tels: ['055-379-8000'] },
    ],
    cams: [],
  },
];

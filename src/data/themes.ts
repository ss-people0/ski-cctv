// 스키장별 테마 색 (출처: TalkFile_ski-resort-theme-guide.md, 2026-11-26).
// - background: 카드 이름 영역 배경 + 일러스트 산 색의 기준
// - foreground: 그 위 글자색. 가이드 후보값이 대비 4.5:1에 못 미쳐 같은 색을 조금 어둡게 맞췄다.
// - id는 cams.ts 기준(가이드의 elysian → gangchon). 아직 캠이 없는 6곳은 등록용 데이터만 둔다.

export interface ResortTheme {
  name: string
  concept: string
  colorName: string
  background: string
  foreground: string
}

export const themes: Readonly<Record<string, ResortTheme>> = {
  yongpyong: { name: '모나용평', concept: '시계탑과 레드 리프트', colorName: '스카이블루', background: '#A4CFF2', foreground: '#305676' },
  high1: { name: '하이원', concept: '제우스·주피터 승강장', colorName: '라벤더', background: '#C9BDE5', foreground: '#564970' },
  phoenix: { name: '휘닉스 평창', concept: '몽블랑', colorName: '피치 핑크', background: '#F2C4C5', foreground: '#80454E' },
  jisan: { name: '지산', concept: '가로로 긴 베이스', colorName: '애프리콧', background: '#F4C39B', foreground: '#794927' },
  wellihilli: { name: '웰리힐리', concept: '추억의 하프파이프', colorName: '민트', background: '#A8DDCB', foreground: '#2D6152' },
  alpensia: { name: '알펜시아', concept: '스키점프대', colorName: '버터 옐로우', background: '#F8E3A5', foreground: '#79601F' },
  gangchon: { name: '엘리시안 강촌', concept: '백양리역과 경춘선', colorName: '세이지 그린', background: '#B8CDA6', foreground: '#425734' },
  // ── 아직 사이트에 없는 스키장(등록용) ──
  muju: { name: '무주 덕유산', concept: '설천봉 상제루', colorName: '더스티 로즈', background: '#E8B5BA', foreground: '#703E49' },
  vivaldi: { name: '비발디파크', concept: '대형 리조트와 베이스', colorName: '아쿠아 블루', background: '#9DD5E0', foreground: '#295C68' },
  konjiam: { name: '곤지암', concept: '정상 휴게소와 리프트 하차장', colorName: '파스텔 인디고', background: '#A6B9E5', foreground: '#34476E' },
  oakvalley: { name: '오크밸리', concept: '콘도 시계탑과 야간 설경', colorName: '더스크 블루', background: '#9FA9C6', foreground: '#313C59' },
  o2: { name: '오투', concept: '노란 곤돌라와 강풍·강설', colorName: '프로스트 블루', background: '#B5C9D9', foreground: '#3B5364' },
  edenvalley: { name: '에덴밸리', concept: '풍력발전기와 올해도 만나요!!', colorName: '샌드 베이지', background: '#DEC3AC', foreground: '#6A4C36' },
}

export const themeOf = (id: string): ResortTheme => themes[id] ?? themes.yongpyong

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// a와 b를 ratio(0=a, 1=b) 비율로 섞은 색. 일러스트 하늘·산 명암을 테마색 하나로 만든다.
export function mixHex(a: string, b: string, ratio: number): string {
  const [ca, cb] = [channels(a), channels(b)]
  return `#${ca.map((v, i) => Math.round(v + (cb[i] - v) * ratio).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

// WCAG 대비(1~21). 글자 4.5 이상이 기준.
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = channels(hex).map((v) => {
      const c = v / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

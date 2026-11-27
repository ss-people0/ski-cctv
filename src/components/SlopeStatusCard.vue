<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { levelColor, type ChipStatus, type SlopeBoard, type SlopeHourLine } from '../data/slopeStatus'

// 상세 화면 슬로프 운영 현황: 개방 수·진행률 → 난이도별 칩(전체 하나의 토글로 접힘) → 범례 → 운영시간.
// hours는 자동 수집값(board.hours)이 없을 때 Resort에 손으로 넣은 공식 운영시간이다.
const props = defineProps<{
  board: SlopeBoard | null
  hours?: SlopeHourLine[]
  season?: string | null
  upcomingLines: string[]
  nightLine?: string | null
}>()

// 색만으로 구분하지 않도록 칩마다 기호 + 숨김 글자를 붙인다.
const STATUS: Record<ChipStatus, { icon: string; label: string }> = {
  open: { icon: '✓', label: '개방' },
  closed: { icon: '–', label: '미개방' },
  upcoming: { icon: '◷', label: '개방 예정' },
  unknown: { icon: '?', label: '정보 미확인' },
}
const LEGEND = Object.entries(STATUS) as [ChipStatus, { icon: string; label: string }][]

// 상세에 들어올 때마다 접힌 상태로 시작한다(CCTV까지 빨리 내려가도록). 상태는 기억하지 않는다.
const collapsed = shallowRef(true)
const toggle = () => {
  collapsed.value = !collapsed.value
}

// 운영시간: 넘겨받은 값(자동 수집이 없는 스키장의 공식 시간)이 있으면 그걸, 없으면 수집값(board.hours).
const hourRows = computed<SlopeHourLine[]>(() => (props.hours?.length ? props.hours : (props.board?.hours ?? [])))

const countText = computed(() => {
  const b = props.board
  if (!b) return ''
  return b.openCount === b.total ? '전 슬로프 개방' : `${b.openCount} / ${b.total}개 개방`
})
const asOfText = computed(() => {
  const d = props.board?.asOf
  return d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일` : ''
})
const percent = computed(() => (props.board?.total ? (props.board.openCount / props.board.total) * 100 : 0))
</script>

<template>
  <div class="slope-info" :class="{ empty: !board }">
    <template v-if="board">
      <button
        type="button"
        class="slope-head"
        :aria-expanded="!collapsed"
        aria-controls="slope-list"
        @click="toggle"
      >
        <span class="slope-title">슬로프 운영 현황</span>
        <span class="slope-count">{{ countText }}</span>
        <span class="arrow" :class="{ up: !collapsed }" aria-hidden="true">▾</span>
      </button>
      <div class="progress" aria-hidden="true"><span :style="{ width: `${percent}%` }" /></div>
      <p v-if="board.preseason" class="preseason">올 시즌 오픈 전이에요. 공식 현황이 올라오면 자동으로 바뀌어요.</p>
      <p v-else-if="board.asOf" class="preseason">{{ asOfText }} 기준이에요. 오늘 현황은 아침 8시쯤 바뀌어요.</p>

      <div v-show="!collapsed" id="slope-list" class="slope-list">
        <div v-for="group in board.groups" :key="group.level" class="level-row" :class="{ 'no-level': !group.level }">
          <span v-if="group.level" class="level" :style="{ color: levelColor(group.level) }">{{ group.level }}</span>
          <ul class="chips">
            <li v-for="chip in group.chips" :key="chip.name" class="chip" :class="chip.status">
              <span aria-hidden="true">{{ STATUS[chip.status].icon }}</span>{{ chip.name
              }}<span v-if="chip.nightOnly" title="야간만 개방"> 🌙</span>
              <span class="sr-only">{{ STATUS[chip.status].label }}</span>
            </li>
          </ul>
        </div>
        <ul class="legend" aria-label="운영 상태 범례">
          <li v-for="[status, s] in LEGEND" :key="status" class="chip" :class="status">
            <span aria-hidden="true">{{ s.icon }}</span>{{ s.label }}
          </li>
        </ul>
      </div>
    </template>
    <span v-else>아직 오픈 현황 정보가 없어요.</span>
    <p v-if="season" class="season-note">{{ season }}</p>
    <dl v-if="hourRows.length" class="hours">
      <div v-for="hour in hourRows" :key="hour.label" :class="{ off: hour.off }">
        <dt>{{ hour.label }}</dt>
        <dd>{{ hour.value }}<small v-if="hour.off">미운영</small></dd>
      </div>
    </dl>
    <p v-if="nightLine" class="slope-upcoming night">🌙 {{ nightLine }}</p>
    <p v-for="line in upcomingLines" :key="line" class="slope-upcoming">🎿 {{ line }}</p>
  </div>
</template>

<style scoped>
.slope-head { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 8px; width: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.slope-title { font-size: 1rem; font-weight: 800; letter-spacing: -0.02em; }
.slope-count { color: #316D50; font-size: 0.9rem; font-weight: 700; }
.arrow { color: var(--muted); transition: transform 0.2s; }
.arrow.up { transform: rotate(180deg); }
.progress { height: 4px; margin: 8px 0 10px; border-radius: 999px; background: #F0EFF3; overflow: hidden; }
.progress span { display: block; height: 100%; border-radius: inherit; background: #4FA77A; }

.level-row { display: grid; grid-template-columns: 3.6em 1fr; align-items: start; gap: 6px; padding: 3px 0; }
.level-row.no-level { grid-template-columns: 1fr; } /* 난이도 정보가 없는 곳(지산)은 칩을 왼쪽부터 */
.level { padding-top: 3px; font-size: 0.8rem; font-weight: 800; white-space: nowrap; }
.chips, .legend { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; padding: 0; list-style: none; }
.chip { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; line-height: 1.3; }
.chip.open { background: #E4F2E9; color: #316D50; }
.chip.closed { background: #F0EFF3; color: #92909A; }
.chip.upcoming { background: #FFF0D9; color: #A87532; }
.chip.unknown { background: #E8EDF3; color: #64748B; }
.legend { margin: 8px 0 2px; padding-top: 8px; border-top: 1px solid var(--line); }
.legend .chip { padding: 1px 6px; font-size: 0.72rem; }

.hours { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 6px; margin: 10px 0 0; }
.hours > div { padding: 6px 8px; border-radius: 10px; background: var(--ice-light); }
.hours dt { color: var(--muted); font-size: 0.75rem; font-weight: 700; }
.hours dd { margin: 0; font-size: 0.85rem; font-weight: 700; }
.hours .off dd { color: #b0b4c6; }
.hours small { display: block; font-size: 0.7rem; font-weight: 600; }
.preseason { margin: -4px 0 8px; color: var(--muted); font-size: 0.8rem; }
.season-note { margin: 8px 0 0; color: var(--text); font-size: 0.85rem; font-weight: 600; }
.slope-upcoming { margin: 8px 0 0; color: var(--blue-dark); font-size: 0.9rem; font-weight: 700; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>

import { ref } from 'vue'

// 한 번에 하나만 재생하도록 모든 카드가 공유한다.
export const playingCamId = ref<string | null>(null)

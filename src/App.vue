<script setup lang="ts">
import CamCard from './components/CamCard.vue'
import { resorts } from './data/cams'
import { sortResorts } from './data/sortResorts'

const sortedResorts = sortResorts(resorts)
</script>

<template>
  <main>
    <h1>스키장 CCTV</h1>
    <section v-for="resort in sortedResorts" :key="resort.id">
      <h2>{{ resort.name }} <small>{{ resort.region }}</small></h2>
      <div class="cams">
        <CamCard v-for="cam in resort.cams" :key="cam.id" :resort="resort" :cam="cam" />
      </div>
    </section>
  </main>
</template>

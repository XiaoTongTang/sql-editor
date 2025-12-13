<template>
  <div class="counter-component">
    <span class="count">{{ count }}</span>
    <button @click="increment" class="increment-btn">+</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)

const increment = () => {
  count.value++
}
</script>

<style scoped>
.counter-component {
  display: flex;
  align-items: center;
}

.count {
  font-size: 24px;
  margin-right: 10px;
}

.increment-btn {
  padding: 5px 10px;
  font-size: 16px;
}
</style>

<template>
  <div class="object-array-component">
    <h3>对象数组组件</h3>
    <div class="items">
      <div v-for="(item, index) in data.items" :key="item.id" class="item">
        <span>{{ item.name }}</span>
        <span class="value">{{ item.value }}</span>
        <button @click="updateItemLocal(index)" class="local-btn">本地修改</button>
      </div>
    </div>
    <div class="update-log">
      <p>组件更新次数: {{ updateCount }}</p>
      <p>最后更新时间: {{ lastUpdateTime }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUpdated, watch } from 'vue'

// 定义props类型
interface Item {
  id: number
  name: string
  value: string
}

interface DataProps {
  items: Item[]
  title: string
}

// 接收props
const props = defineProps<{
  data: DataProps
}>()

// 组件内部状态
const updateCount = ref(0)
const lastUpdateTime = ref('')

// 监听组件更新
onUpdated(() => {
  //   updateCount.value++
  //   lastUpdateTime.value = new Date().toLocaleTimeString()
  console.log('组件更新了！')
})

// 监听props变化
watch(
  () => props.data,
  (newVal, oldVal) => {
    console.log('props.data 变化了:', oldVal, '->', newVal)
  },
  { deep: true },
)

// 本地修改函数（演示用）
const updateItemLocal = (index: number) => {
  console.log('尝试本地修改，这会失败因为props是只读的')
}
</script>

<style scoped>
.object-array-component {
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 20px;
}

.items {
  margin-bottom: 15px;
}

.item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}

.item span {
  margin-right: 10px;
}

.item .value {
  font-weight: bold;
  margin-right: 20px;
}

.local-btn {
  background: #1890ff;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.update-log {
  background: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
}
</style>

<template>
  <div class="container">
    <!-- 第一部分：key问题演示 -->
    <h3>对比：原生元素vs自定义组件的key问题</h3>

    <!-- 示例1：原生input元素 -->
    <div class="example-section">
      <h4>原生input元素（使用索引key，表现正常）</h4>
      <div v-for="(item, index) in items" :key="index" class="item">
        <span>{{ item.name }}</span>
        <input type="text" placeholder="请输入内容" v-model="item.value" />
        <button @click="removeItem(0)" class="remove-btn">删除第一个</button>
      </div>
    </div>

    <!-- 示例2：自定义组件 -->
    <div class="example-section">
      <h4>自定义计数器组件（使用索引key，内部状态错误）</h4>
      <div v-for="(item, index) in items" :key="index" class="item">
        <span>{{ item.name }}</span>
        <!-- 自定义计数器组件 -->
        <counter-component />
        <button @click="removeItem(0)" class="remove-btn">删除第一个</button>
      </div>
    </div>

    <!-- 示例3：自定义组件使用ID作为key -->
    <div class="example-section">
      <h4>自定义计数器组件（使用ID作为key，表现正常）</h4>
      <div v-for="(item, index) in itemsWithId" :key="item.id" class="item">
        <span>{{ item.name }}</span>
        <!-- 自定义计数器组件 -->
        <counter-component />
        <button @click="removeItemWithId(0)" class="remove-btn">删除第一个</button>
      </div>
    </div>

    <!-- 第二部分：对象数组变化演示 -->
    <h3 style="margin-top: 50px">对象数组变化演示</h3>

    <!-- 示例4：演示props对象数组变化 -->
    <div class="example-section">
      <h4>演示：当props中的对象数组元素变化时</h4>
      <object-array-component :data="complexData" />
      <div class="control-buttons">
        <button @click="updateArrayItem" class="control-btn">修改数组中的一个元素</button>
        <button @click="addArrayItem" class="control-btn">添加新元素</button>
        <button @click="replaceArray" class="control-btn">替换整个数组</button>
      </div>
    </div>

    <div class="notice">
      <h4>测试步骤：</h4>
      <ol>
        <li>在示例2的第三个计数器组件中点击几次，使其计数增加</li>
        <li>点击示例2的"删除第一个"按钮</li>
        <li>观察示例2和示例3的结果差异</li>
        <li>在示例4中点击各个按钮，观察组件更新次数和控制台输出</li>
      </ol>
      <h4>结果说明：</h4>
      <ul>
        <li><strong>原生input</strong>：使用v-model绑定后，即使key是index，内容也能正确显示</li>
        <li><strong>自定义组件（索引key）</strong>：删除元素后，计数器的内部状态会错误保留</li>
        <li><strong>自定义组件（ID key）</strong>：删除元素后，计数器的内部状态正确重置</li>
        <li>
          <strong>对象数组变化</strong
          >：当props中的对象数组元素变化时，组件会触发更新，但只会重绘变化的部分
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineComponent } from 'vue'
import CounterComponent from './component/CountTest.vue'
import ObjectArrayComponent from './component/ObjectArrayComponent.vue'

// 初始数据 - 用于key对比演示
const items = ref([
  { id: 1, name: 'A', value: '' },
  { id: 2, name: 'B', value: '' },
  { id: 3, name: 'C', value: '' },
  { id: 4, name: 'D', value: '' },
])

// 初始数据 - 使用ID作为key（用于对比）
const itemsWithId = ref([
  { id: 1, name: 'A', value: '' },
  { id: 2, name: 'B', value: '' },
  { id: 3, name: 'C', value: '' },
  { id: 4, name: 'D', value: '' },
])

// 删除项目 - 使用索引作为key的情况
const removeItem = (index: number) => {
  items.value.splice(index, 1)
}

// 删除项目 - 使用ID作为key的情况
const removeItemWithId = (index: number) => {
  itemsWithId.value.splice(index, 1)
}

// 用于演示props对象数组变化的状态
const complexData = ref({
  title: '测试数据',
  items: [
    { id: 1, name: '项目1', value: '初始值1' },
    { id: 2, name: '项目2', value: '初始值2' },
    { id: 3, name: '项目3', value: '初始值3' },
  ],
})

// 修改对象数组中的一个元素
const updateArrayItem = () => {
  // 修改第三个元素的值
  complexData.value.items[2].value = `修改后的值`
  console.log('已修改对象数组中的元素')
}

// 添加新元素到对象数组
const addArrayItem = () => {
  const newId = complexData.value.items.length + 1
  complexData.value.items.push({
    id: newId,
    name: `项目${newId}`,
    value: `新值${newId}`,
  })
  console.log('已添加新元素到对象数组')
}

// 修改整个对象数组
const replaceArray = () => {
  complexData.value.items = [
    { id: 1, name: '新项目1', value: '替换值1' },
    { id: 2, name: '新项目2', value: '替换值2' },
  ]
  console.log('已替换整个对象数组')
}
</script>

<style scoped>
.container {
  width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.example-section {
  margin-bottom: 30px;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.item span {
  width: 50px;
  margin-right: 10px;
}

.item input {
  flex: 1;
  padding: 5px;
  margin-right: 10px;
}

.remove-btn {
  background: #ff4d4f;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

/* 控制按钮样式 */
.control-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  flex-wrap: wrap;
}

.control-btn {
  background: #1890ff;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.control-btn:hover {
  background: #40a9ff;
}

.notice {
  background: #f0f0f0;
  padding: 15px;
  border-radius: 4px;
}

.notice ol {
  margin: 10px 0;
  padding-left: 20px;
}

/* 自定义计数器组件样式 */
.counter-component {
  display: flex;
  align-items: center;
  margin-right: 10px;
  padding: 5px;
  background: #f5f5f5;
  border-radius: 4px;
}

.count {
  width: 30px;
  text-align: center;
  margin-right: 5px;
}

.increment-btn {
  background: #1890ff;
  color: white;
  border: none;
  width: 25px;
  height: 25px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

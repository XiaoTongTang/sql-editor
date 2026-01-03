<template>
  <div class="about-view">
    <div class="sql-visualization-section">
      <div style="display: flex; gap: 10px; margin-bottom: 10px">
        <el-button size="small" @click="scrollTable('left')">← 向左滚动</el-button>
        <el-button size="small" @click="scrollTable('right')">向右滚动 →</el-button>
      </div>
      <el-table
        class="custom-padding"
        v-if="tableData.length > 0"
        :data="tableData"
        style="width: 100%"
        border
        ref="tableRef"
      >
        <el-table-column
          v-for="(column, index) in tableColumns"
          :key="index"
          :width="120"
        >
          <template #header>
            <el-input
              :model-value="tableColumns[index]"
              @input="handleHeaderInput(index, $event)"
              placeholder="列名"
            />
          </template>
          <template #default="{ row }">
            <el-input
              v-if="row[tableColumns[index] as string].type === 'single_quote_string'"
              :model-value="row[tableColumns[index] as string].value"
              @input="handleCellInput(index, $event)"
              placeholder="请输入值"
            />
            <el-input-number
              v-if="row[tableColumns[index] as string].type === 'number'"
              :model-value="row[tableColumns[index] as string].value"
              @input="handleCellInput(index, $event as number)"
              controls-position="right"
              style="width: 100%"
              placeholder="请输入值"
            />
            <el-input
              v-if="row[tableColumns[index] as string].type === 'null'"
              :model-value="'NULL'"
              disabled 
            />
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无数据"></el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { type Update as UpdateAst } from 'node-sql-parser'
import {
  ElInput,
  ElButton,
  ElTable,
  ElTableColumn,
  ElEmpty,
  ElInputNumber,
} from 'element-plus'
import { useEditorTreeStore } from '@/stores/editorTree'

const tableRef = ref()

const editorTreeStore = useEditorTreeStore()

const props = defineProps({
  astIndex: {
    type: Number,
    required: true,
  },
  astId: {
    type: String,
    required: true,
  },
})
// v-model值，这个值就是一条update语句的AST
const parsedAst = defineModel<UpdateAst | null>({ required: true })

interface BlockData {
  type: 'single_quote_string' | 'number' | 'null'
  value: string | number | null
}

/**
 * 解析update语句的字段值
 * @param valueAST AST中的值对象
 * @returns 解析后的值
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseValue = (valueAST: any): BlockData => {
  if (!valueAST || !valueAST.type) {
    return {
      type: 'single_quote_string',
      value: '无法解析',
    }
  }

  if (!(valueAST.type === 'single_quote_string' || valueAST.type === 'number' || valueAST.type === 'null')) {
    return {
      type: valueAST.type,
      value: '无法解析',
    }
  }
  return {
    type: valueAST.type,
    value: valueAST.value,
  }
}

/**
 * 从update AST中提取列名
 */
const tableColumns = computed(() => {
  if (!parsedAst.value || !parsedAst.value.set || !Array.isArray(parsedAst.value.set)) {
    return []
  }

  return parsedAst.value.set.map((item) => item.column)
})

/**
 * 从update AST中提取数据行
 */
const tableData = computed(() => {
  if (!parsedAst.value || !parsedAst.value.set || !Array.isArray(parsedAst.value.set)) {
    return []
  }

  // 创建一个数据行对象
  const row: Record<string, BlockData> = {}

  // 遍历set数组，填充行数据
  parsedAst.value.set.forEach((item) => {
    if (item.column && item.value) {
      row[item.column] = parseValue(item.value)
    }
  })

  return [row]
})

/**
 * 处理表头输入事件，修改AST中的列名
 * @param index 列索引
 * @param newValue 新的列名
 */
const handleHeaderInput = (index: number, newValue: string) => {
  console.log('修改列名:', index, newValue)
  editorTreeStore.updSqlSetAstColumn(props.astId, index, newValue)
}

/**
 * 处理单元格输入事件，修改AST中的字段值
 * @param columnIndex 列索引
 * @param newValue 新的字段值
 */
const handleCellInput = (columnIndex: number, newValue: string | number) => {
  console.log('修改字段值:', columnIndex, newValue)
  editorTreeStore.updSqlModifyAstValue(props.astId, columnIndex, newValue)
}

// 滚动控制函数
const scrollTable = (direction: 'left' | 'right' | 'up' | 'down') => {
  if (!tableRef.value) return
  const scrollBarWrap = tableRef.value.$el.querySelector('.el-scrollbar__wrap')
  if (!scrollBarWrap) return
  // 获取当前的滚动坐标
  const currentLeft = scrollBarWrap.scrollLeft
  const currentTop = scrollBarWrap.scrollTop
  // 获取一个表格元素，用于计算滚动距离
  const tableBlockElement = tableRef.value.$el.querySelector('.el-table__body tr td')
  // 水平滚动距离
  const horizontalScrollDistance = tableBlockElement ? tableBlockElement.offsetWidth : 100
  // 垂直滚动距离
  const verticalScrollDistance = tableBlockElement ? tableBlockElement.offsetHeight : 100

  // 计算目标坐标
  let targetLeft = currentLeft
  let targetTop = currentTop

  if (direction === 'left') {
    targetLeft = Math.max(0, currentLeft - horizontalScrollDistance)
  } else if (direction === 'right') {
    targetLeft = currentLeft + horizontalScrollDistance
  } else if (direction === 'up') {
    targetTop = Math.max(0, currentTop - verticalScrollDistance)
  } else if (direction === 'down') {
    targetTop = currentTop + verticalScrollDistance
  }
  tableRef.value.scrollTo({
    left: targetLeft,
    top: targetTop,
    behavior: 'smooth',
  })
}
</script>

<style scoped>
.about-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.sql-input-section {
  margin-bottom: 20px;
}

.el-textarea {
  margin-bottom: 10px;
  width: 100%;
}

.sql-visualization-section {
  margin-top: 20px;
}

.sql-output-section {
  margin-top: 20px;
}

.sql-output-section .el-button {
  margin-bottom: 10px;
}
.clickableText {
  cursor: pointer;
}
.clickableText:hover {
  color: blue;
}

:deep(.el-table .cell) {
  padding: 0 !important;
}
:deep(.el-table .el-table__cell) {
  padding: 0 !important;
}
</style>

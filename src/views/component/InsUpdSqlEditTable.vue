<template>
  <div class="about-view">
    <div class="sql-visualization-section">
      <el-table class="custom-padding" v-if="tableData.length > 0" :data="tableData" style="width: 100%" border>
        <el-table-column v-for="(column, index) in tableColumns" :key="index" :width="120">
          <template #header>
            <div style="display: flex; flex-direction: column; gap: 2px; width: 100%">
              <div style="display: flex; justify-content: space-between; width: 100%">
                <el-button type="success" size="small" @click="addColumn(index)"> 加列 </el-button>
                <el-button type="danger" size="small" @click="deleteColumn(index)">
                  删列
                </el-button>
              </div>
              <el-input
                :model-value="tableColumns[index]"
                @input="handleHeaderInput(index, $event)"
                placeholder="列名"
                style="width: 100%"
              />
            </div>
          </template>
          <template #default="{ $index }">
            <el-input
              v-if="tableData[$index]?.[index]?.type === 'single_quote_string'"
              :model-value="tableData[$index]?.[index]?.value ?? ''"
              @input="handleTableDataInput($index, index, $event)"
              placeholder="请输入值"
            />
            <el-input-number
              v-if="tableData[$index]?.[index]?.type === 'number'"
              :model-value="tableData[$index]?.[index]?.value ?? 0"
              @input="handleTableDataInput($index, index, $event)"
              controls-position="right"
              style="width: 100%"
              placeholder="请输入值"
            />
            <el-input
              v-if="tableData[$index]?.[index]?.type === 'null'"
              :model-value="'NULL'"
              disabled 
            />
            <select
              v-if="fullDataEditButton"
              :name="'changeTypeSelector' + $index + '-' + index"
              :value="tableData[$index]?.[index]?.type"
              @change="handleChangeType($index, index, ($event.target as HTMLSelectElement).value as ('null' | 'single_quote_string' | 'number'))"
            >
              <option value="null">NULL</option>
              <option value="single_quote_string">STR</option> <!-- 无需手动写 selected，v-model 自动控制 -->
              <option value="number">NUM</option>
            </select>
          </template>
        </el-table-column>
        <el-table-column fixed="right" width="140">
          <template #header>
            <div style="display: flex; flex-direction: column; gap: 5px; text-align: center">
              <div style="font-weight: bold">操作
                <el-switch v-model="fullDataEditButton" />
              </div>
              <div style="display: flex; gap: 5px">
                <el-button type="success" size="small" @click="addColumn(tableColumns.length - 1)">
                  加列
                </el-button>
                <el-button type="primary" size="small" @click="insertRow(-1)">加行</el-button>
              </div>
            </div>
          </template>
          <template #default="{ $index }">
            <el-button
              type="danger"
              size="small"
              @click="deleteRow($index)"
              style="margin-right: 5px"
              >删行</el-button
            >
            <el-button type="primary" size="small" @click="insertRow($index)">加行</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无数据"></el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { type Insert_Replace } from 'node-sql-parser'
import { ElInput, ElButton, ElTable, ElTableColumn, ElEmpty, ElSwitch, ElInputNumber } from 'element-plus'
import { useEditorTreeStore } from '@/stores/editorTree'

const editorTreeStore = useEditorTreeStore()

const props = defineProps({
  astIndex: {
    type: Number,
    required: true,
  },
  astId: {
    type: String,
    required: true,
  }
})
// v-model值，这个值就是一条insert语句的AST
const parsedAst = defineModel<Insert_Replace | null>({ required: true })
// 是否展开完整编辑按钮
const fullDataEditButton = ref(false)

interface BlockData {
  type: 'single_quote_string' | 'number' | 'null'
  value: string | number | null
}

/**
 * 从AST中提取表格列名
 */
const tableColumns = computed(() => {
  if (!parsedAst.value || !parsedAst.value.columns || !Array.isArray(parsedAst.value.columns)) {
    return []
  }
  return parsedAst.value.columns
})
/**
 * 处理表头输入事件，修改AST中的列名
 * @param index 列索引
 * @param newValue 新的列名
 */
const handleHeaderInput = (index: number, newValue: string) => {
  editorTreeStore.setAstColumn(props.astId, index, newValue)
}

// 添加列
const addColumn = (index: number) => {
  editorTreeStore.addColumnToAst(props.astId, index)
}

// 删除列
const deleteColumn = (index: number) => {
  editorTreeStore.deleteColumnFromAst(props.astId, index)
}

// 删除行
const deleteRow = (rowIndex: number) => {
  // 调用删除行函数
  editorTreeStore.deleteRowFromAst(props.astId, rowIndex)
}

// 插入行
const insertRow = (rowIndex: number) => {
  // 调用插入行函数
  editorTreeStore.insertRowToAst(props.astId, rowIndex)
}

/**
 * 计算属性：表格数据
 * @returns 表格数据数组
 */
const tableData = computed(() => {
  if (!parsedAst.value || !parsedAst.value.values) {
    return []
  }

  // 如果values是select语句，则返回空数据
  if (parsedAst.value.values.type !== 'values') {
    return []
  }

  return parsedAst.value.values.values.map((valueItem) => {
    const row: Record<number, BlockData> = {}
    if (valueItem.value && Array.isArray(valueItem.value)) {
      valueItem.value.forEach((val, index) => {
        // 处理不同类型的值
        if (val.type === 'single_quote_string') {
          row[index] = val
        } else if (val.type === 'number') {
          row[index] = val
        } else if (val.type === 'null') {
          row[index] = val
        } else {
          row[index] = {
            type: 'single_quote_string',
            value: '无法解析',
          }
        }
      })
    }
    return row
  })
})
/**
 * 处理表格数据输入事件(直接修改AST)
 * @param rowIndex 行索引
 * @param colIndex 列索引
 * @param value 输入值
 */
const handleTableDataInput = (rowIndex: number, colIndex: number, value: string | number | null | undefined) => {
  editorTreeStore.modifyAstRowData(props.astId, rowIndex, colIndex, value)
}

/**
 * 处理指定行指定列的数据类型变更(直接修改AST)
 * @param rowIndex 行索引
 * @param colIndex 列索引
 * @param type 新的数据类型
 */
const handleChangeType = (rowIndex: number, colIndex: number, type: 'number' | 'single_quote_string' | 'null') => {
  editorTreeStore.handleChangeType(props.astId, rowIndex, colIndex, type)
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

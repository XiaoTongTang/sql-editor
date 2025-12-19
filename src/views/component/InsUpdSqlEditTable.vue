<template>
  <div class="about-view">
    <div class="sql-visualization-section">
      <el-table v-if="tableData.length > 0" :data="tableData" style="width: 100%" border>
        <el-table-column v-for="(column, index) in tableColumns" :key="index" :width="150">
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
                size="small"
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
            <div v-if="tableData[$index]?.[index]?.type === 'null'">NULL</div>
            <div v-if="fullDataEditButton" style="display: flex; justify-content: space-between; width: 100%">
              <el-button type="default" size="small" @click="handleSetNull($index, index)" >NULL</el-button>
              <el-button type="default" size="small" @click="handleSetStr($index, index)" >STR</el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column fixed="right" width="150">
          <template #header>
            <div style="display: flex; flex-direction: column; gap: 5px; text-align: center">
              <div style="font-weight: bold">操作
                <el-switch v-model="fullDataEditButton" />
              </div>
              <div style="display: flex; gap: 5px">
                <el-button type="success" size="small" @click="addColumn(tableColumns.length - 1)"
                  >加列</el-button
                >
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
import { type Insert_Replace, type InsertReplaceValue } from 'node-sql-parser'
import { ElInput, ElButton, ElTable, ElTableColumn, ElEmpty, ElSwitch } from 'element-plus'

// v-model值，这个值就是一条insert语句的AST
const parsedAst = defineModel<Insert_Replace | null>({ required: true })
// 是否展开完整编辑按钮
const fullDataEditButton = ref(false)

interface BlockData {
  type: 'single_quote_string' | 'null'
  value: string | null
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
  if (!parsedAst.value || !parsedAst.value.columns || !Array.isArray(parsedAst.value.columns)) {
    return
  }
  parsedAst.value.columns[index] = newValue
}

// 添加列
const addColumn = (index: number) => {
  if (!parsedAst.value || !parsedAst.value.columns || !Array.isArray(parsedAst.value.columns)) {
    return
  }

  // 复制当前的列数组
  const newColumns = [...tableColumns.value]
  // 在指定位置插入新的列名
  newColumns.splice(index + 1, 0, '新列')
  // 更新列头
  parsedAst.value.columns = newColumns

  // 同步更新数据部分
  if (parsedAst.value.values && parsedAst.value.values.type === 'values') {
    // 遍历所有数据行
    parsedAst.value.values.values.forEach((row) => {
      if (row.value && Array.isArray(row.value)) {
        // 在对应位置插入空值
        row.value.splice(index + 1, 0, {
          type: 'single_quote_string',
          value: '',
        })
      }
    })
  }
}

// 删除列
const deleteColumn = (index: number) => {
  if (!parsedAst.value || !parsedAst.value.columns || !Array.isArray(parsedAst.value.columns)) {
    return
  }

  // 确保至少保留一列
  if (tableColumns.value.length <= 1) {
    console.error('至少需要保留一列')
    return
  }

  // 复制当前的列数组
  const newColumns = [...tableColumns.value]
  // 删除指定位置的列名
  newColumns.splice(index, 1)
  // 更新列头
  parsedAst.value.columns = newColumns

  // 同步更新数据部分
  if (parsedAst.value.values && parsedAst.value.values.type === 'values') {
    // 遍历所有数据行
    parsedAst.value.values.values.forEach((row) => {
      if (row.value && Array.isArray(row.value)) {
        // 删除对应位置的数据
        row.value.splice(index, 1)
      }
    })
  }
}

// 删除行
const deleteRow = (rowIndex: number) => {
  if (!parsedAst.value || !parsedAst.value.values || parsedAst.value.values.type !== 'values') {
    return
  }

  // 从AST中删除对应的行
  parsedAst.value.values.values.splice(rowIndex, 1)
}

// 插入行
const insertRow = (rowIndex: number) => {
  if (!parsedAst.value || !parsedAst.value.values || parsedAst.value.values.type !== 'values') {
    return
  }

  const columnCount = parsedAst.value.columns ? parsedAst.value.columns.length : 0
  // 创建一个有columnCount 个元素的数组，每个元素要求完全独立，互不影响
  const emptyRow = Array(columnCount)
    .fill(undefined)
    .map(() => ({
      type: 'single_quote_string',
      value: '',
    }))

  // 创建新的行元素
  const newRow: InsertReplaceValue = {
    type: 'expr_list',
    prefix: undefined,
    value: emptyRow,
  }

  // 在当前行下方插入新行
  parsedAst.value.values.values.splice(rowIndex + 1, 0, newRow)
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
const handleTableDataInput = (rowIndex: number, colIndex: number, value: string) => {
  if (!parsedAst.value || !parsedAst.value.values || parsedAst.value.values.type !== 'values') {
    console.log('AST树不存在:', parsedAst.value)
    return
  }

  if (parsedAst.value!.values!.values[rowIndex]?.value) {
    // 找到对应的行与列
    const valueNode = parsedAst.value!.values!.values[rowIndex].value[colIndex]
    // 判断是否为字符串或数字类型
    if (valueNode.type === 'single_quote_string') {
      valueNode.value = value
    } else {
      console.log('不支持的类型:', valueNode.type)
    }
  }
}
/**
 * 设置指定行指定列的值为NULL(直接修改AST)
 * @param rowIndex 行索引
 * @param colIndex 列索引
 */
const handleSetNull = (rowIndex: number, colIndex: number) => {
  if (!parsedAst.value || !parsedAst.value.values || parsedAst.value.values.type !== 'values') {
    console.log('AST树不存在:', parsedAst.value)
    return
  }

  if (parsedAst.value!.values!.values[rowIndex]?.value) {
    // 找到对应的行与列,将这一列的值设置为NULL
    parsedAst.value!.values!.values[rowIndex].value[colIndex] = {
      type: 'null',
      value: null,
    }
  }
}
/**
 * 设置指定行指定列的值为字符串(直接修改AST)
 * @param rowIndex 行索引
 * @param colIndex 列索引
 */
const handleSetStr = (rowIndex: number, colIndex: number) => {
  if (!parsedAst.value || !parsedAst.value.values || parsedAst.value.values.type !== 'values') {
    console.log('AST树不存在:', parsedAst.value)
    return
  }

  if (parsedAst.value!.values!.values[rowIndex]?.value) {
    // 如果此列已经是字符串类型,则无需处理
    if (parsedAst.value!.values!.values[rowIndex].value[colIndex].type === 'single_quote_string') {
      return
    }
    // 否则，将这一列的值设置为字符串
    parsedAst.value!.values!.values[rowIndex].value[colIndex] = {
      type: 'single_quote_string',
      value: '',
    }
  }
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
</style>

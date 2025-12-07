<template>
  <div class="about-view">
    <div class="sql-input-section">
      <el-input v-model="sqlContent" placeholder="Enter SQL query" type="textarea" />
      <el-button type="primary" @click="handleSubmit">提交可视化编辑</el-button>
    </div>

    <div class="sql-visualization-section">
      <h3>SQL可视化编辑区域</h3>
      <el-table v-if="tableData.length > 0" :data="tableData" style="width: 100%">
        <el-table-column v-for="(column, index) in tableColumns" :key="index" :label="column">
          <template #default="{ row, $index }">
            <el-input
              :model-value="tableData[$index][index.toString()]"
              @input="handleInput($index, index.toString(), $event)"
              placeholder="请输入值"
            />
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无数据"></el-empty>
    </div>

    <div class="sql-output-section">
      <el-button type="success" @click="generateModifiedSql">输出修改后sql</el-button>
      <el-input v-model="generatedSql" placeholder="生成的SQL语句" type="textarea" readonly />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import NodeSQLParser, { type Insert_Replace } from 'node-sql-parser'
import { ElInput, ElButton, ElTable, ElTableColumn, ElEmpty } from 'element-plus'

const sqlContent = ref('')
const parsedAst = ref<Insert_Replace | null>(null)
const generatedSql = ref('')

const handleSubmit = () => {
  try {
    const parser = new NodeSQLParser.Parser()
    const astList = parser.astify(sqlContent.value)
    const ast = astList[0]
    console.log(astList)

    // 检查是否为INSERT语句
    if (ast && ast.type === 'insert') {
      parsedAst.value = ast as Insert_Replace
    } else {
      parsedAst.value = null
      console.error('请输入有效的INSERT语句')
    }
  } catch (error) {
    console.error('SQL解析错误:', error)
    parsedAst.value = null
  }
}

// 计算属性：表格列
const tableColumns = computed(() => {
  if (!parsedAst.value || !parsedAst.value.columns || !Array.isArray(parsedAst.value.columns)) {
    return []
  }
  return parsedAst.value.columns
})

// 处理输入事件
const handleInput = (rowIndex: number, colIndex: string, value: string) => {
  // 创建tableData的副本
  const newData = [...tableData.value]
  // 更新对应的值
  newData[rowIndex][colIndex] = value
  // 赋值回tableData，触发setter
  tableData.value = newData
}

// 生成修改后的SQL
const generateModifiedSql = () => {
  try {
    if (parsedAst.value) {
      const parser = new NodeSQLParser.Parser()
      const sql = parser.sqlify(parsedAst.value)
      generatedSql.value = sql
    }
  } catch (error) {
    console.error('生成SQL错误:', error)
    generatedSql.value = '生成SQL失败: ' + (error as Error).message
  }
}

// 计算属性：表格数据（可写）
const tableData = computed({
  get: () => {
    if (!parsedAst.value || !parsedAst.value.values) {
      return []
    }

    // 如果values是select语句，则返回空数据
    if (parsedAst.value.values.type !== 'values') {
      return []
    }

    return parsedAst.value.values.values.map((valueItem) => {
      const row: any = {}
      if (valueItem.value && Array.isArray(valueItem.value)) {
        valueItem.value.forEach((val, index) => {
          // 处理不同类型的值
          if (val.type === 'single_quote_string' || val.type === 'number') {
            row[index.toString()] = val.value
          } else {
            row[index.toString()] = '无法解析'
          }
        })
      }
      return row
    })
  },
  set: (newData) => {
    console.log(newData)
    if (!parsedAst.value || !parsedAst.value.values || parsedAst.value.values.type !== 'values') {
      return
    }

    // 更新AST中的values
    newData.forEach((row: any, rowIndex: number) => {
      if (parsedAst.value!.values!.values[rowIndex]?.value) {
        Object.keys(row).forEach((colIndexStr: string) => {
          const colIndex = parseInt(colIndexStr)
          if (!isNaN(colIndex) && parsedAst.value!.values!.values[rowIndex].value[colIndex]) {
            const valueNode = parsedAst.value!.values!.values[rowIndex].value[colIndex]
            // 根据当前值的类型更新
            if (valueNode.type === 'single_quote_string' || valueNode.type === 'number') {
              valueNode.value = row[colIndexStr]
            }
          }
        })
      }
    })
  },
})
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

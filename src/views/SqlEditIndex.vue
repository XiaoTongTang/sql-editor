<template>
  <div>
    <div class="sql-input-section">
      <el-input v-model="sqlContent" placeholder="Enter SQL query" type="textarea" />
      <el-button type="primary" @click="sqlToAst">提交可视化编辑</el-button>
    </div>

    <div class="sql-output-section">
      <el-button type="success" @click="astToSql">输出修改后sql</el-button>
      <el-input v-model="generatedSql" placeholder="生成的SQL语句" type="textarea" readonly />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElInput, ElButton } from 'element-plus'
import NodeSQLParser, { type Insert_Replace } from 'node-sql-parser'
import shortUuid from 'short-uuid'

interface AstItem {
  id: string
  type: string
  ast: Insert_Replace
}

const sqlContent = ref('')
const parsedAstList = ref<AstItem[] | null>(null)
const generatedSql = ref('')

const sqlToAst = () => {
  try {
    const parser = new NodeSQLParser.Parser()
    const astList = parser.astify(sqlContent.value, { parseOptions: { includeLocations: true } })
    // 遍历astList从中挑出insert语句
    // 确保 astList 是数组后再过滤
    const list = Array.isArray(astList) ? astList : [astList]
    parsedAstList.value = list
      .filter((item) => item.type === 'insert')
      .map((item) => ({
        id: shortUuid.generate(),
        type: item.type,
        ast: item as Insert_Replace,
      })) as AstItem[]
  } catch (error) {
    console.error('SQL解析错误:', error)
    parsedAstList.value = null
  }
}
// 生成修改后的SQL
const astToSql = () => {
  try {
    const astList = parsedAstList.value?.map((item) => {
      return item.ast
    })
    if (astList) {
      console.log(astList)
      const parser = new NodeSQLParser.Parser()
      const sql = parser.sqlify(astList)
      generatedSql.value = sql
    }
  } catch (error) {
    console.error('生成SQL错误:', error)
    generatedSql.value = '生成SQL失败: ' + (error as Error).message
  }
}
</script>

<style scoped>
.sql-input-section {
  margin-bottom: 20px;
}

.sql-output-section {
  margin-top: 20px;
}

.sql-output-section .el-button {
  margin-bottom: 10px;
}
</style>

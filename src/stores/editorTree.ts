import { ref } from 'vue'
import { defineStore } from 'pinia'
import NodeSQLParser, { type Insert_Replace } from 'node-sql-parser'
import { generate as shortUuidGenerate } from 'short-uuid';

export interface AstItem {
  id: string
  type: string
  ast: Insert_Replace
}

export const useEditorTreeStore = defineStore('editorTree', () => {
  const editorAstList = ref<AstItem[] | null>(null)

  const getAstItem = (id: string) => {
    if (!editorAstList.value) {
      return undefined
    }
    return editorAstList.value.find((item) => item.id === id)
  }
  // 解析SQL字符串为AST
  const sqlToAst = (sql: string) => {
    try {
      const parser = new NodeSQLParser.Parser()
      const astList = parser.astify(sql, { parseOptions: { includeLocations: true } })
      console.log(astList)
      // 遍历astList从中挑出insert语句
      // 确保 astList 是数组后再过滤
      const list = Array.isArray(astList) ? astList : [astList]
      editorAstList.value = list
        .filter((item) => item.type === 'insert')
        .map((item) => ({
          id: shortUuidGenerate(),
          type: item.type,
          ast: item as Insert_Replace,
        })) as AstItem[]
    } catch (error) {
      console.error('SQL解析错误:', error)
      editorAstList.value = null
    }
  }

  // 生成修改后的SQL
  const astToSql = () => {
    try {
      const astList = editorAstList.value?.map((item) => {
        return item.ast
      })
      if (astList) {
        console.log(astList)
        const parser = new NodeSQLParser.Parser()
        const sql = parser.sqlify(astList)
        // 遍历所有sql，给每个分号后面添加换行
        return sql.replace(/;/g, ';\n')
      }
    } catch (error) {
      console.error('生成SQL错误:', error)
      return
    }
  }

  return { editorAstList, getAstItem, sqlToAst, astToSql }
})

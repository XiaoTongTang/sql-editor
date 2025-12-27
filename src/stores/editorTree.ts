import { ref } from 'vue'
import { defineStore } from 'pinia'
import NodeSQLParser, { type Insert_Replace } from 'node-sql-parser'
import { generate as shortUuidGenerate } from 'short-uuid';
import { JSONPath } from 'jsonpath-plus';
import { editOperates, type EditHeaderOperate } from './editOperates';

export interface AstItem {
  id: string
  type: string
  ast: Insert_Replace
}
// 编辑坐标
export interface EditCoordinate {
  valueExp: string // 取值表达式（json path 表达式）（ 比如： $.columns[0]  或  $.values.values[0].type ）
}

export interface OptStackItem {
  thisOperate: EditOperate // 本次操作
  inverseOperate: EditOperate // 本次操作的逆操作(用于撤销本次操作)
}

export interface EditOperate {
  coordinate: EditCoordinate // 编辑坐标
  operateType: string // 操作类型 （ 比如： set 或 add 或 remove ）
  value: EditHeaderOperate // 编辑值
}

export interface OperateStack {
  stack: OptStackItem[] // 操作栈
  pointer: number // 操作栈指针(撤销时，不会直接删除栈顶元素，而是将指针减一（以备可能的重做操作），只有撤销后再执行一次新编辑后，才会将指针以上的所有操作出栈)
}

export const useEditorTreeStore = defineStore('editorTree', () => {
  const editorAstList = ref<AstItem[] | null>(null)
  const optStack = ref<OperateStack>({
    stack: [],
    pointer: -1,
  })

  const getAstItem = (id: string) => {
    if (!editorAstList.value) {
      return { astItem: undefined, index: -1 }
    }
    const astItem = editorAstList.value.find((item) => item.id === id)
    if (!astItem) {
      return { astItem: undefined, index: -1 }
    }
    return { astItem, index: editorAstList.value.indexOf(astItem) }
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
  // =================操作栈使用的函数======================
  /**
   * 供给普通编辑操作使用的操作栈入栈函数
   * @param optItem 
   */
  const otherOptPushOptStack = (optItem: OptStackItem) => {
    // 将当前pointer以上的操作出栈（因为产生了一次新的操作后，指针以上的操作就全部会变得“无法重做”，因此需要全部出栈）
    optStack.value.stack.splice(optStack.value.pointer + 1)
    // 将本次操作入栈
    optStack.value.stack.push(optItem)
    // 如果栈中元素超过50，就将最早的操作删除
    if (optStack.value.stack.length > 50) {
      optStack.value.stack.shift()
    }
    // 将指针指向栈顶
    optStack.value.pointer = optStack.value.stack.length - 1
  }
  /**
   * 重做操作
   * @returns
   */
  const redoOpt = () => {
    if (optStack.value.pointer < optStack.value.stack.length - 1) {
      optStack.value.pointer++
      const optItem = optStack.value.stack[optStack.value.pointer]
      if (!optItem) {
        return
      }
      const opFunction = editOperates[optItem.thisOperate.operateType]
      if (!opFunction) {
        return
      }
      opFunction(editorAstList, optItem.thisOperate.coordinate, optItem.thisOperate.value)
    }
  }
  /**
   * 撤销操作
   * @returns 
   */
  const undoOpt = () => {
    if (optStack.value.pointer >= 0) {
      const optItem = optStack.value.stack[optStack.value.pointer]
      if (!optItem) {
        return
      }
      const opFunction = editOperates[optItem.inverseOperate.operateType]
      if (!opFunction) {
        return
      }
      opFunction(editorAstList, optItem.inverseOperate.coordinate, optItem.inverseOperate.value)
      optStack.value.pointer--
    }
  }
  // =================编辑单个AST使用的函数====================
  /**
   * 处理表头输入事件，修改AST中的列名
   * @param index 列索引
   * @param newValue 新的列名
   */
  const setAstColumn = (astId: string, operate: EditHeaderOperate) => {
    // 用astId查询这是第几个AST项
    const { index } = getAstItem(astId)
    if (index === -1) {
      return false
    }
    // 构建编辑坐标
    const editCoord: EditCoordinate = { valueExp: `$[${index}]` }
    // 通过编辑坐标，从editorAstList中获取到当前AST项
    const astItem: AstItem | undefined = JSONPath({path: editCoord.valueExp, json: editorAstList.value})[0];
    if (!astItem || !astItem.ast || !astItem.ast.columns || !Array.isArray(astItem.ast.columns)) {
      return false
    }
    // 记录操作栈
    otherOptPushOptStack({
      thisOperate: {
        coordinate: {...editCoord}, // 深拷贝
        operateType: 'setAstColumn',
        value: operate,
      },
      inverseOperate: {
        coordinate: {...editCoord}, // 深拷贝
        operateType: 'setAstColumn',
        value: {
          index: operate.index,
          newValue: astItem.ast.columns[operate.index] || '',
        },
      },
    })
    if(!editOperates.setAstColumn) {
      return false
    }
    // 执行编辑操作
    editOperates.setAstColumn(editorAstList, editCoord, operate)
    return true
  }

  return { editorAstList, optStack, getAstItem, sqlToAst, astToSql, setAstColumn, undoOpt, redoOpt }
})

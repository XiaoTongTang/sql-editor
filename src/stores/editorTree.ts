import { ref } from 'vue'
import { defineStore } from 'pinia'
import NodeSQLParser, { type Insert_Replace } from 'node-sql-parser'
import { generate as shortUuidGenerate } from 'short-uuid';
import { JSONPath } from 'jsonpath-plus';
import { editOperates, type EditHeaderOperateParam } from './editOperates';
import { coordSet, coordSplice, isCoordSetParams, isCoordSpliceParams, type CoordSetParams, type CoordSpliceParams } from '@/utils/coordCrudFunc';

export interface AstItem {
  id: string
  type: string
  ast: Insert_Replace
}
// 操作栈中的元素
export interface OptStackItem2 {
  thisOperate: EditOperate2 // 本次操作（按顺序从前往后执行即可复现业务操作）
  inverseOperate: EditOperate2 // 本次操作的逆操作(用于撤销本次操作)（按顺序从前往后执行即可复现逆业务操作）
}
// 一次业务编辑操作（备注：一次业务编辑操作下面会有很多原子crud操作，存放在operArray数组中，按顺序执行operArray等价于一次业务编辑操作）
export interface EditOperate2 {
  operArray: (CoordSpliceParams | CoordSetParams)[]
}
// 操作栈
export interface OperateStack2 {
  stack: OptStackItem2[] // 操作栈
  pointer: number // 操作栈指针(撤销时，不会直接删除栈顶元素，而是将指针减一（以备可能的重做操作），只有撤销后再执行一次新编辑后，才会将指针以上的所有操作出栈)
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
  value: EditHeaderOperateParam // 编辑值
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
  const optStack2 = ref<OperateStack2>({
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
  /**
   * 重做操作栈2
   * @returns 
   */
  const redo2 = () => {
    if (optStack2.value.pointer < optStack2.value.stack.length - 1) {
      optStack2.value.pointer++
      const stackItem = optStack2.value.stack[optStack2.value.pointer]
      if (!stackItem) {
        return
      }
      // 遍历stackItem的thisOperate，逐一执行 “坐标crud” 操作
      stackItem.thisOperate.operArray.forEach((operate) => {
        if(isCoordSpliceParams(operate)) {
          coordSplice(operate)
        }
        if(isCoordSetParams(operate)) {
          coordSet(operate)
        }
      })
    }
  }
  /**
   * 撤销操作栈2
   * @returns 
   */
  const undo2 = () => {
    if (optStack2.value.pointer >= 0) {
      const stackItem = optStack2.value.stack[optStack2.value.pointer]
      if (!stackItem) {
        return
      }
      // 遍历stackItem的inverseOperate，逐一执行 “坐标crud” 操作
      stackItem.inverseOperate.operArray.forEach((operate) => {
        if(isCoordSpliceParams(operate)) {
          coordSplice(operate)
        }
        if(isCoordSetParams(operate)) {
          coordSet(operate)
        }
      })
      optStack2.value.pointer--
    }
  }
  /**
   * 供给普通编辑操作使用的操作栈入栈函数
   * @param optItem 
   */
  const otherOptPushOptStack2 = (optItem: OptStackItem2) => {
    // 将当前pointer以上的操作出栈（因为产生了一次新的操作后，指针以上的操作就全部会变得“无法重做”，因此需要全部出栈）
    optStack2.value.stack.splice(optStack2.value.pointer + 1)
    // 将本次操作入栈
    optStack2.value.stack.push(optItem)
    // 如果栈中元素超过50，就将最早的操作删除
    if (optStack2.value.stack.length > 50) {
      optStack2.value.stack.shift()
    }
    // 将指针指向栈顶
    optStack2.value.pointer = optStack2.value.stack.length - 1
  }
  // =================编辑单个AST使用的函数====================
  /**
   * 处理表头输入事件，修改AST中的列名
   * @param index 列索引
   * @param newValue 新的列名
   */
  const setAstColumn = (astId: string, operateParam: EditHeaderOperateParam) => {
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
        value: operateParam,
      },
      inverseOperate: {
        coordinate: {...editCoord}, // 深拷贝
        operateType: 'setAstColumn',
        value: {
          index: operateParam.index,
          newValue: astItem.ast.columns[operateParam.index] || '',
        },
      },
    })
    if(!editOperates.setAstColumn) {
      return false
    }
    // 执行编辑操作
    editOperates.setAstColumn(editorAstList, editCoord, operateParam)
    return true
  }
  /**
   * 处理表头输入事件，修改AST中的列名
   * @param index 列索引
   * @param newValue 新的列名
   */
  const setAstColumn2 = (astId: string, index: number, newValue: string) => {
    // 用astId查询这是第几个AST项
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !astItem.ast.columns || !Array.isArray(astItem.ast.columns)) {
      return false
    }
    if(!editorAstList.value) {
      return false
    }
    // 算出正向操作的参数
    const posSetOper = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.columns[${index}]`, // 编辑坐标：修改表头的列名
      newValue,
    }
    // 执行修改表头的操作（设置表头只需要调用一次coordSet即可完成，没有更多的操作）
    const coordSetResult = coordSet(posSetOper)
    if(!coordSetResult.reverseParams) {
      return false
    }
    // 记录操作栈
    otherOptPushOptStack2({
      thisOperate: { operArray: [posSetOper] },
      inverseOperate: { operArray: [coordSetResult.reverseParams] }
    })
    return true
  }

  /**
   * 添加列到AST中
   * @param astId AST项ID
   * @param index 要添加的列索引位置（注意：是要添加到该索引的后面）
   * @returns 是否添加成功
   */
  const addColumnToAst = (astId: string, index: number) => {
    // 用astId查询这是第几个AST项
    if (!editorAstList.value) {
      return false
    }
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast) {
      return false
    }
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem2 = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] }
    }

    const addColumnOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.columns`,
      start: index + 1,
      deleteCount: 0,
      items: ['新列'], // 插入的新列头
    }
    // STEP1 调用splice函数更新列头，并计算出逆操作的参数
    const addColumnsResult = coordSplice(addColumnOp)
    if (!addColumnsResult.reverseParams) {
      return false
    }
    // STEP1.1 向操作栈item中记录crud操作
    optStackItem.thisOperate.operArray.push(addColumnOp) // 向 ”正向操作列表“ 中，添加 ”添加列“ 操作
    optStackItem.inverseOperate.operArray.unshift(addColumnsResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”删除列“（即添加列的逆操作） 操作
    
    if (astItem.ast.values && astItem.ast.values.type === 'values') {
      // STEP2 遍历所有数据行
      astItem.ast.values.values.forEach((row, rowIndex) => {
        if (row.value && Array.isArray(row.value)) {
          // STEP2.1 逐一插入新增的这一列的数据
          const addValueDataOp = {
            rootObj: editorAstList.value,
            editCoord: `[${astIndex}].ast.values.values[${rowIndex}].value`,
            start: index + 1,
            deleteCount: 0,
            items: [{
              type: 'single_quote_string',
              value: '',
            }] // 新的数据（注意，这里是每次都新建完全不同的一个新对象）
          }
          const addDataResult = coordSplice(addValueDataOp)
          if (!addDataResult.reverseParams) {
            return false
          }
          // STEP2.2 向操作栈item中记录插入行数据的crud操作
          optStackItem.thisOperate.operArray.push(addValueDataOp) // 向 ”正向操作列表“ 中，添加 ”添加数据“ 操作
          optStackItem.inverseOperate.operArray.unshift(addDataResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”删除数据“（即删除数据的逆操作） 操作
        }
      })
    }
    // STEP3 将操作栈item push进操作栈中
    otherOptPushOptStack2(optStackItem)
    return true
  }
  /**
   * 从AST中删除列
   * @param astId AST项ID
   * @param index 要删除的列索引位置
   * @returns 是否删除成功
   */
  const deleteColumnFromAst = (astId: string, index: number): boolean => {
    if (!editorAstList.value) {
      return false
    }
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !astItem.ast.columns || !Array.isArray(astItem.ast.columns)) {
      return false
    }
    if (astItem.ast.columns.length <= 1) {
      console.error('至少需要保留一列')
      return false
    }
    if (!astItem || !astItem.ast) {
      return false
    }
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem2 = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] }
    }

    // STEP1 调用splice函数删除列头，并计算出逆操作的参数
    const deleteColumnOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.columns`,
      start: index,
      deleteCount: 1,
      items: [],
    }
    const deleteColumnResult = coordSplice(deleteColumnOp)
    if (!deleteColumnResult.reverseParams) {
      return false
    }
    // STEP1.1 向操作栈item中记录crud操作
    optStackItem.thisOperate.operArray.push(deleteColumnOp) // 向 ”正向操作列表“ 中，添加 ”删除列“ 操作
    optStackItem.inverseOperate.operArray.unshift(deleteColumnResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”添加列“（即删除列的逆操作） 操作

    // STEP2 遍历所有数据行
    if (astItem.ast.values && astItem.ast.values.type === 'values') {
      // 遍历所有数据行
      astItem.ast.values.values.forEach((row, rowIndex) => {
        if (row.value && Array.isArray(row.value)) {
          const deleteValueDataOp = {
            rootObj: editorAstList.value,
            editCoord: `[${astIndex}].ast.values.values[${rowIndex}].value`,
            start: index,
            deleteCount: 1,
            items: []
          }
          // STEP2.1 删除对应列位置的数据
          const deleteDataResult = coordSplice(deleteValueDataOp)
          if (!deleteDataResult.reverseParams) {
            return false
          }
          // STEP2.2 向操作栈item中记录删除行数据的crud操作
          optStackItem.thisOperate.operArray.push(deleteValueDataOp) // 向 ”正向操作列表“ 中，添加 ”删除数据“ 操作
          optStackItem.inverseOperate.operArray.unshift(deleteDataResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”添加数据“（即删除数据的逆操作） 操作
        }
      })
    }
    // STEP3 将操作栈item push进操作栈中
    otherOptPushOptStack2(optStackItem)
    return true
  }

  return { editorAstList, optStack, optStack2, getAstItem, sqlToAst, astToSql, setAstColumn, undoOpt, redoOpt, undo2, redo2, setAstColumn2, addColumnToAst, deleteColumnFromAst }
})

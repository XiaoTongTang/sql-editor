import { ref } from 'vue'
import { defineStore } from 'pinia'
import NodeSQLParser, { type AST, type Insert_Replace, type InsertReplaceValue, type Update as UpdateAst } from 'node-sql-parser'
import { generate as shortUuidGenerate } from 'short-uuid'
import {
  coordSet,
  coordSplice,
  isCoordSetParams,
  isCoordSpliceParams,
  type CoordSetParams,
  type CoordSpliceParams,
} from '@/utils/coordCrudFunc'
import { getSandboxSql } from '@/utils/plainTextEditUtils'

export interface AstItem {
  id: string
  type: string
  ast: Insert_Replace | UpdateAst
}
// 操作栈中的元素
export interface OptStackItem {
  thisOperate: EditOperate // 本次操作（按顺序从前往后执行即可复现业务操作）
  inverseOperate: EditOperate // 本次操作的逆操作(用于撤销本次操作)（按顺序从前往后执行即可复现逆业务操作）
}
// 一次业务编辑操作（备注：一次业务编辑操作下面会有很多原子crud操作，存放在operArray数组中，按顺序执行operArray等价于一次业务编辑操作）
export interface EditOperate {
  operArray: (CoordSpliceParams | CoordSetParams)[]
}
// 操作栈
export interface OperateStack {
  stack: OptStackItem[] // 操作栈
  pointer: number // 操作栈指针(撤销时，不会直接删除栈顶元素，而是将指针减一（以备可能的重做操作），只有撤销后再执行一次新编辑后，才会将指针以上的所有操作出栈)
}

interface BlockData {
  type: 'single_quote_string' | 'number' | 'null'
  value: string | number | null
}
/*
请大模型编程助手阅读后再修改此文件
修改函数的设计思想：
- 由于此sql编辑器本质上是直接编辑SQL的AST，所以本质上我的编辑都直接操作AST这个Object，而不是直接操作SQL字符串
撤消重做的技术设计：
- 我将编辑器API分为2层架构
- - 底层是 coordCrudFunc.ts 文件中的 “坐标编辑函数”；这些函数只负责对一个Object内部字段的增删改操作；这些函数总是接收 “JSONpath + 编辑参数” 两个参数。JSONpath用于确定需要操作的字段，编辑参数则用于确定具体的操作（如splice的start、deleteCount、items等）。这些坐标编辑函数在运行成功后，总会返回本次操作的逆操作的入参。只需要将逆操作的入参传入坐标编辑函数，即可实现撤销本次操作。
- - 上层是 editorTree.ts 文件中的 “业务编辑函数”；这些函数负责接收用户的业务操作指令（如新增insert语句、删除insert语句、修改insert语句等），并调用底层的坐标编辑函数来实现业务操作
- - 由于底层的坐标编辑函数有着统一的参数格式，并且其运行成功后会自动算出逆操作入参，所以上层业务函数只需在调用底层编辑函数后将正向操作参数与逆向操作参数全部存入操作栈，即可实现撤销重做功能。
*/
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
        .filter((item) => item.type === 'insert' || item.type === 'update')
        .map((item) => ({
          id: shortUuidGenerate(),
          type: item.type,
          ast: item as Insert_Replace,
        })) as AstItem[]
      // 成功解析并替换editorAstList后，清空操作栈
      clearOperationStack()
    } catch (error) {
      console.error('SQL解析错误:', error)
      editorAstList.value = null
      throw new Error('SQL解析错误')
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
        let sql = parser.sqlify(astList)
        // 为最后一条sql后面补上分号
        sql = sql.concat(';')
        // 遍历所有sql，给每个分号后面添加换行
        sql = sql.replace(/;/g, ';\n')
        // 删除sql内部每行的行首行尾空格
        sql = sql.replace(/^\s+|\s+$/gm, '')
        // 给最后一条sql后方拼上换行
        sql = sql.concat('\n')
        return sql
      }
    } catch (error) {
      console.error('生成SQL错误:', error)
      return
    }
  }
  // =================操作栈使用的函数======================
  /**
   * 重做操作栈
   * @returns
   */
  const redo = () => {
    if (optStack.value.pointer < optStack.value.stack.length - 1) {
      optStack.value.pointer++
      const stackItem = optStack.value.stack[optStack.value.pointer]
      if (!stackItem) {
        return
      }
      // 遍历stackItem的thisOperate，逐一执行 “坐标crud” 操作
      stackItem.thisOperate.operArray.forEach((operate) => {
        if (isCoordSpliceParams(operate)) {
          coordSplice(operate)
        }
        if (isCoordSetParams(operate)) {
          coordSet(operate)
        }
      })
    }
  }
  /**
   * 撤销操作栈
   * @returns
   */
  const undo = () => {
    if (optStack.value.pointer >= 0) {
      const stackItem = optStack.value.stack[optStack.value.pointer]
      if (!stackItem) {
        return
      }
      // 遍历stackItem的inverseOperate，逐一执行 “坐标crud” 操作
      stackItem.inverseOperate.operArray.forEach((operate) => {
        if (isCoordSpliceParams(operate)) {
          coordSplice(operate)
        }
        if (isCoordSetParams(operate)) {
          coordSet(operate)
        }
      })
      optStack.value.pointer--
    }
  }
  /**
   * 供给普通编辑操作使用的操作栈入栈函数
   * @param optItem
   */
  const otherOptPushOptStack = (optItem: OptStackItem) => {
    // 将当前pointer以上的操作出栈（因为产生了一次新的操作后，指针以上的操作就全部会变得"无法重做"，因此需要全部出栈）
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
   * 清空操作栈
   */
  const clearOperationStack = () => {
    optStack.value.stack.splice(0)
    optStack.value.pointer = -1
  }
  // =================编辑单个AST使用的函数====================
  // ======================insert语句函数=====================
  /**
   * 处理表头输入事件，修改AST中的列名
   * @param index 列索引
   * @param newValue 新的列名
   */
  const setAstColumn = (astId: string, index: number, newValue: string) => {
    // 用astId查询这是第几个AST项
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isInsertAst(astItem.ast) || !astItem.ast.columns || !Array.isArray(astItem.ast.columns)) {
      return false
    }
    if (!editorAstList.value) {
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
    if (!coordSetResult.reverseParams) {
      return false
    }
    // 记录操作栈
    otherOptPushOptStack({
      thisOperate: { operArray: [posSetOper] },
      inverseOperate: { operArray: [coordSetResult.reverseParams] },
    })
    return true
  }

  /**
   * 修改表名
   * @param astId AST项ID
   * @param newValue 新的表名
   * @returns 是否修改成功
   */
  const setAstTableName = (astId: string, newValue: string) => {
    // 用astId查询这是第几个AST项
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !astItem.ast.table) {
      return false
    }
    if (!editorAstList.value) {
      return false
    }
    // 算出正向操作的参数
    const posSetOper = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.table[0].table`, // 编辑坐标：修改表名
      newValue,
    }
    // 执行修改表名的操作
    const coordSetResult = coordSet(posSetOper)
    if (!coordSetResult.reverseParams) {
      return false
    }
    // 记录操作栈
    otherOptPushOptStack({
      thisOperate: { operArray: [posSetOper] },
      inverseOperate: { operArray: [coordSetResult.reverseParams] },
    })
    return true
  }

  /**
   * 修改数据库名
   * @param astId AST项ID
   * @param newValue 新的数据库名
   * @returns 是否修改成功
   */
  const setAstDbName = (astId: string, newValue: string) => {
    // 用astId查询这是第几个AST项
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !astItem.ast.table) {
      return false
    }
    if (!editorAstList.value) {
      return false
    }
    // 算出正向操作的参数
    const posSetOper = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.table[0].db`, // 编辑坐标：修改数据库名
      newValue,
    }
    // 执行修改数据库名的操作
    const coordSetResult = coordSet(posSetOper)
    if (!coordSetResult.reverseParams) {
      return false
    }
    // 记录操作栈
    otherOptPushOptStack({
      thisOperate: { operArray: [posSetOper] },
      inverseOperate: { operArray: [coordSetResult.reverseParams] },
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
    if (!astItem || !astItem.ast || !isInsertAst(astItem.ast)) {
      return false
    }
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
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
            items: [
              {
                type: 'single_quote_string',
                value: '',
              },
            ], // 新的数据（注意，这里是每次都新建完全不同的一个新对象）
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
    otherOptPushOptStack(optStackItem)
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
    if (!astItem || !astItem.ast || !isInsertAst(astItem.ast) || !astItem.ast.columns || !Array.isArray(astItem.ast.columns)) {
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
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
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
            items: [],
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
    otherOptPushOptStack(optStackItem)
    return true
  }

  // 删除行
  const deleteRowFromAst = (astId: string, rowIndex: number) => {
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isInsertAst(astItem.ast) || !astItem.ast.values || astItem.ast.values.type !== 'values') {
      return
    }
    // 检查是否整个AST只剩一行
    if (astItem.ast.values.values.length <= 1) {
      console.error('至少需要保留一行')
      return false
    }
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
    }
    // STEP1 调用splice函数删除行，并计算出逆操作的参数
    const deleteRowOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.values.values`,
      start: rowIndex,
      deleteCount: 1,
      items: [],
    }
    const deleteRowResult = coordSplice(deleteRowOp)
    if (!deleteRowResult.reverseParams) {
      return false
    }
    // STEP2 向操作栈item中记录插入行数据的crud操作
    optStackItem.thisOperate.operArray.push(deleteRowOp) // 向 ”正向操作列表“ 中，添加 ”删除行“ 操作
    optStackItem.inverseOperate.operArray.unshift(deleteRowResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”添加行“（即删除行的逆操作） 操作
    // STEP3 将操作栈item push进操作栈中
    otherOptPushOptStack(optStackItem)
    return true
  }

  // 插入行
  const insertRowToAst = (astId: string, rowIndex: number) => {
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isInsertAst(astItem.ast) || !astItem.ast.values || astItem.ast.values.type !== 'values') {
      return
    }
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
    }
    const columnCount = astItem.ast.columns ? astItem.ast.columns.length : 0
    // STEP1 创建一个有columnCount 个元素的数组，每个元素要求完全独立，互不影响
    const emptyRow = Array(columnCount)
      .fill(undefined)
      .map(() => ({
        type: 'single_quote_string',
        value: '',
      }))
    // STEP2 创建新的行元素
    const newRow: InsertReplaceValue = {
      type: 'expr_list',
      prefix: undefined,
      value: emptyRow,
    }
    // STEP3 调用splice函数插入行，并计算出逆操作的参数
    const insertRowOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.values.values`,
      start: rowIndex + 1,
      deleteCount: 0,
      items: [newRow],
    }
    const insertRowResult = coordSplice(insertRowOp)
    if (!insertRowResult.reverseParams) {
      return false
    }
    // STEP4 向操作栈item中记录插入行数据的crud操作
    optStackItem.thisOperate.operArray.push(insertRowOp) // 向 ”正向操作列表“ 中，添加 ”插入行“ 操作
    optStackItem.inverseOperate.operArray.unshift(insertRowResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”删除行“（即插入行的逆操作） 操作

    // STEP4 将操作栈item push进操作栈中
    otherOptPushOptStack(optStackItem)
  }
  /**
   * 处理表格数据输入事件(直接修改AST)
   * @param rowIndex 行索引
   * @param colIndex 列索引
   * @param value 输入值
   */
  const modifyAstRowData = (astId: string, rowIndex: number, colIndex: number, value: string | number | null | undefined) => {
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isInsertAst(astItem.ast) || !astItem.ast.values || astItem.ast.values.type !== 'values') {
      console.log('AST树不存在')
      return
    }
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
    }
    if (!astItem.ast.values.values[rowIndex]?.value) {
      console.log('行不存在')
      return false
    }
    // STEP1 找到对应的行与列
    const valueNode: BlockData = astItem.ast.values.values[rowIndex].value[colIndex]
    let tempValue = value
    // STEP2 判断是否为字符串或数字类型，进行强制转换处理
    if (valueNode.type === 'single_quote_string') {
      tempValue = String(value)
    } else if(valueNode.type === 'number') {
      tempValue = Number(value)
    } else {
      console.log('不支持的类型:', valueNode.type)
      return false
    }
    // STEP3 构建 ”坐标“ + 新值 操作项
    const modifyRowDataOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.values.values[${rowIndex}].value[${colIndex}].value`,
      newValue: tempValue
    }
    // STEP4 调用 ”坐标“ + 新值 操作项 进行修改
    const modifyResult = coordSet(modifyRowDataOp)
    if (!modifyResult.reverseParams) {
      return false
    }
    // STEP5 向操作栈item中记录修改行数据的crud操作
    optStackItem.thisOperate.operArray.push(modifyRowDataOp) // 向 ”正向操作列表“ 中，添加 ”修改行数据“ 操作
    optStackItem.inverseOperate.operArray.unshift(modifyResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”修改行数据“（即修改行数据的逆操作） 操作
    // STEP6 将操作栈item push进操作栈中
    otherOptPushOptStack(optStackItem)
    return true
  }

  /**
   * 处理指定行指定列的数据类型变更(直接修改AST)
   * @param rowIndex 行索引
   * @param colIndex 列索引
   * @param type 新的数据类型
   */
  const handleChangeType = (astId: string, rowIndex: number, colIndex: number, type: 'number' | 'single_quote_string' | 'null') => {
    const { astItem, index: astIndex } = getAstItem(astId)
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
    }
    if (!astItem || !astItem.ast || !isInsertAst(astItem.ast) || !astItem.ast.values || astItem.ast.values.type !== 'values') {
      console.log('AST树不存在:', astId)
      return
    }
    if (!astItem.ast.values.values[rowIndex]?.value || !astItem.ast.values.values[rowIndex].value[colIndex]) {
      console.log('此行列数据不存在:', rowIndex, colIndex)
      return
    }
    // STEP1 如果此列已经是指定类型,则无需处理
    if (astItem.ast.values.values[rowIndex].value[colIndex].type === type) {
      console.log('此行列数据已为指定类型:', type)
      return
    }
    // STEP2 否则，将这一列的值设置为指定类型
    // STEP2.1 构造新值
    let newValue = null;
    switch (type) {
      case 'number':
        newValue = 0;
        break;
      case 'single_quote_string':
        newValue = '';
        break;
      case 'null':
        newValue = null;
        break;
    }
    // STEP2.1 构建 ”坐标“ + 新值 操作项
    const modifyDataTypeOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.values.values[${rowIndex}].value[${colIndex}]`,
      newValue: {
        type: type,
        value: newValue,
      }
    }
    // STEP2.2 将这一列的值设置为新类型
    const modifyResult = coordSet(modifyDataTypeOp)
    if (!modifyResult.reverseParams) {
      return false
    }
    // STEP2.3 向操作栈item中记录修改数据类型的crud操作
    optStackItem.thisOperate.operArray.push(modifyDataTypeOp) // 向 ”正向操作列表“ 中，添加 ”修改数据类型“ 操作
    optStackItem.inverseOperate.operArray.unshift(modifyResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”修改数据类型“（即修改数据类型的逆操作） 操作
    // STEP2.4 将操作栈item push进操作栈中
    otherOptPushOptStack(optStackItem)
    return true
  }
  // ======================update语句函数=====================
    /**
   * 处理update语句表头输入事件，修改AST中的列名
   * @param astId AST项ID
   * @param index 列索引
   * @param newValue 新的列名
   * @returns 是否修改成功
   */
  const updSqlSetAstColumn = (astId: string, index: number, newValue: string) => {
    // 用astId查询这是第几个AST项
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isUpdateAst(astItem.ast) || !astItem.ast.set || !Array.isArray(astItem.ast.set)) {
      return false
    }
    if (!editorAstList.value) {
      return false
    }
    // 检查索引是否越界
    if (index < 0 || index >= astItem.ast.set.length) {
      return false
    }
    // 算出正向操作的参数
    const posSetOper = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.set[${index}].column`, // 编辑坐标：修改update语句的set中的列名
      newValue,
    }
    // 执行修改列名的操作（设置列名只需要调用一次coordSet即可完成，没有更多的操作）
    const coordSetResult = coordSet(posSetOper)
    if (!coordSetResult.reverseParams) {
      return false
    }
    // 记录操作栈
    otherOptPushOptStack({
      thisOperate: { operArray: [posSetOper] },
      inverseOperate: { operArray: [coordSetResult.reverseParams] },
    })
    return true
  }

  /**
   * 处理update语句字段值输入事件，修改AST中的字段值
   * @param astId AST项ID
   * @param columnIndex 列索引
   * @param newValue 新的字段值
   * @returns 是否修改成功
   */
  const updSqlModifyAstValue = (astId: string, columnIndex: number, newValue: string | number | null | undefined) => {
    // 用astId查询这是第几个AST项
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isUpdateAst(astItem.ast) || !astItem.ast.set || !Array.isArray(astItem.ast.set)) {
      return false
    }
    if (!editorAstList.value) {
      return false
    }
    // 检查索引是否越界
    if (columnIndex < 0 || columnIndex >= astItem.ast.set.length) {
      return false
    }
    
    // 获取当前字段的类型和值
    const currentSetItem = astItem.ast.set[columnIndex]
    if (!currentSetItem || !currentSetItem.value) {
      return false
    }
    
    let processedValue = newValue
    const valueType = currentSetItem.value.type
    
    // 根据当前类型处理值
    if (valueType === 'single_quote_string') {
      processedValue = newValue
    } else if (valueType === 'number') {
      // 尝试转换为数字，如果失败则保持原样
      const numValue = Number(newValue)
      if (!isNaN(numValue)) {
        processedValue = numValue
      }
    } else {
      console.log('不支持的类型:', valueType)
      return false
    }
    
    // 算出正向操作的参数
    const posSetOper = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.set[${columnIndex}].value`, // 编辑坐标：修改update语句的set中的值
      newValue: {
        type: valueType,
        value: processedValue
      },
    }
    // 执行修改字段值的操作
    const coordSetResult = coordSet(posSetOper)
    if (!coordSetResult.reverseParams) {
      return false
    }
    // 记录操作栈
    otherOptPushOptStack({
      thisOperate: { operArray: [posSetOper] },
      inverseOperate: { operArray: [coordSetResult.reverseParams] },
    })
    return true
  }

  /**
   * 为update语句添加新字段
   * @param astId AST项ID
   * @param index 要添加的字段索引位置（注意：是要添加到该索引的后面）
   * @returns 是否添加成功
   */
  const updSqlAddField = (astId: string, index: number) => {
    // 用astId查询这是第几个AST项
    if (!editorAstList.value) {
      return false
    }
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isUpdateAst(astItem.ast) || !astItem.ast.set || !Array.isArray(astItem.ast.set)) {
      return false
    }
    
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
    }

    // STEP1 创建新的字段对象（必须是single_quote_string类型）
    const newField = {
      column: '新字段',
      value: {
        type: 'single_quote_string',
        value: ''
      }
    }

    const addFieldOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.set`,
      start: index + 1,
      deleteCount: 0,
      items: [newField], // 插入的新字段
    }
    
    // STEP2 调用splice函数添加新字段，并计算出逆操作的参数
    const addFieldResult = coordSplice(addFieldOp)
    if (!addFieldResult.reverseParams) {
      return false
    }
    
    // STEP3 向操作栈item中记录crud操作
    optStackItem.thisOperate.operArray.push(addFieldOp) // 向 "正向操作列表" 中，添加 "添加字段" 操作
    optStackItem.inverseOperate.operArray.unshift(addFieldResult.reverseParams) // 向 "逆操作列表" 中，添加 "删除字段"（即添加字段的逆操作） 操作
    
    // STEP4 将操作栈item push进操作栈中
    otherOptPushOptStack(optStackItem)
    return true
  }

  /**
   * 为update语句删除字段
   * @param astId AST项ID
   * @param index 要删除的字段索引位置
   * @returns 是否删除成功
   */
  const updSqlDeleteField = (astId: string, index: number) => {
    if (!editorAstList.value) {
      return false
    }
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isUpdateAst(astItem.ast) || !astItem.ast.set || !Array.isArray(astItem.ast.set)) {
      return false
    }
    
    // 检查是否至少保留一个字段
    if (astItem.ast.set.length <= 1) {
      console.error('至少需要保留一个字段')
      return false
    }
    
    // 检查索引是否越界
    if (index < 0 || index >= astItem.ast.set.length) {
      console.error('字段索引越界:', index)
      return false
    }
    
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
    }

    // STEP1 调用splice函数删除字段，并计算出逆操作的参数
    const deleteFieldOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.set`,
      start: index,
      deleteCount: 1,
      items: [],
    }
    
    const deleteFieldResult = coordSplice(deleteFieldOp)
    if (!deleteFieldResult.reverseParams) {
      return false
    }
    
    // STEP2 向操作栈item中记录crud操作
    optStackItem.thisOperate.operArray.push(deleteFieldOp) // 向 "正向操作列表" 中，添加 "删除字段" 操作
    optStackItem.inverseOperate.operArray.unshift(deleteFieldResult.reverseParams) // 向 "逆操作列表" 中，添加 "添加字段"（即删除字段的逆操作） 操作
    
    // STEP3 将操作栈item push进操作栈中
    otherOptPushOptStack(optStackItem)
    return true
  }
  /**
   * 更新update语句的WHERE条件
   * Step1 将WHERE条件字符串拼接进“沙盒SQL”
   * Step2 将“沙盒SQL”解析为临时AST
   * Step3 从临时AST中截取where子树，拼接进AST中
   * @param astId 
   * @param whereCond 
   * @returns 
   */
  const updSqlModifyWhereCond = (astId: string, whereCond: string) => {
    if (!editorAstList.value) {
      throw new Error('editorAstList 为空')
    }
    const { astItem, index: astIndex } = getAstItem(astId)
    if (!astItem || !astItem.ast || !isUpdateAst(astItem.ast)) {
      throw new Error('astItem 不是 update 类型')
    }
    const sandboxSql = getSandboxSql()
    // Step1 将WHERE条件字符串拼接进“沙盒SQL”
    const updateWhereSql = sandboxSql.replace(/WHERE .*/, `WHERE ${whereCond}`)
    // Step2 将“沙盒SQL”解析为临时AST
    const parser = new NodeSQLParser.Parser()
    let sandboxAST: AST | undefined = undefined
    try {
      const sandboxASTList = parser.astify(updateWhereSql)
      sandboxAST = Array.isArray(sandboxASTList) ? sandboxASTList[0] : sandboxASTList
    } catch (error) {
      console.error('WHERE条件语法解析失败:', error)
      throw new Error('WHERE条件语法解析失败')
    }
    // Step3 从临时AST中截取where子树
    if (!sandboxAST || !isUpdateAst(sandboxAST) || !sandboxAST.where ) {
      throw new Error('WHERE条件字符串解析错误:' + whereCond)
    }
    const whereSubTree = {...sandboxAST.where}
    // Step4 将新的where子树使用coordSet拼接进AST中
    // 算出正向操作的参数
    const posSetOper = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.where`, // 编辑坐标：修改update语句的where中的值
      newValue: whereSubTree
    }
    // 执行修改字段值的操作
    const coordSetResult = coordSet(posSetOper)
    if (!coordSetResult.reverseParams) {
      throw new Error('coordSet执行失败' + JSON.stringify(coordSetResult))
    }
    // 记录操作栈
    otherOptPushOptStack({
      thisOperate: { operArray: [posSetOper] },
      inverseOperate: { operArray: [coordSetResult.reverseParams] },
    })
  }
  /**
   * 更新update语句指定列的数据类型(直接修改AST)
   * @param colIndex 列索引
   * @param type 新的数据类型
   */
  const updSqlDataChangeType = (astId: string, colIndex: number, type: 'number' | 'single_quote_string' | 'null') => {
    const { astItem, index: astIndex } = getAstItem(astId)
    // STEP0 创建一个空的栈项，用于记录操作栈
    const optStackItem: OptStackItem = {
      thisOperate: { operArray: [] },
      inverseOperate: { operArray: [] },
    }
    if (!astItem || !astItem.ast || !isUpdateAst(astItem.ast)) {
      throw new Error('AST树不存在')
    }
    if (!astItem.ast.set[colIndex] || !astItem.ast.set[colIndex].value) {
      throw new Error('此列数据不存在')
    }
    // STEP1 如果此列已经是指定类型,则无需处理
    if (astItem.ast.set[colIndex].value.type === type) {
      throw new Error('此列数据已为指定类型:' + type)
    }
    // STEP2 否则，将这一列的值设置为指定类型
    // STEP2.1 构造新值
    let newValue = null;
    switch (type) {
      case 'number':
        newValue = 0;
        break;
      case 'single_quote_string':
        newValue = '';
        break;
      case 'null':
        newValue = null;
        break;
    }
    // STEP2.1 构建 ”坐标“ + 新值 操作项
    const modifyDataTypeOp = {
      rootObj: editorAstList.value,
      editCoord: `[${astIndex}].ast.set[${colIndex}].value`,
      newValue: {
        type: type,
        value: newValue,
      }
    }
    // STEP2.2 将这一列的值设置为新类型
    const modifyResult = coordSet(modifyDataTypeOp)
    if (!modifyResult.reverseParams) {
      throw new Error('coordSet执行失败' + JSON.stringify(modifyResult))
    }
    // STEP2.3 向操作栈item中记录修改数据类型的crud操作
    optStackItem.thisOperate.operArray.push(modifyDataTypeOp) // 向 ”正向操作列表“ 中，添加 ”修改数据类型“ 操作
    optStackItem.inverseOperate.operArray.unshift(modifyResult.reverseParams) // 向 ”逆操作列表“ 中，添加 ”修改数据类型“（即修改数据类型的逆操作） 操作
    // STEP2.4 将操作栈item push进操作栈中
    otherOptPushOptStack(optStackItem)
  }
  return {
    editorAstList,
    optStack,
    getAstItem,
    sqlToAst,
    astToSql,
    undo,
    redo,
    clearOperationStack,
    setAstColumn,
    setAstTableName,
    setAstDbName,
    addColumnToAst,
    deleteColumnFromAst,
    insertRowToAst,
    deleteRowFromAst,
    modifyAstRowData,
    handleChangeType,
    updSqlSetAstColumn,
    updSqlModifyAstValue,
    updSqlAddField,
    updSqlDeleteField,
    updSqlModifyWhereCond,
    updSqlDataChangeType
  }
})

// 类型守卫：检查是否是UpdateAst类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isUpdateAst = (ast: any): ast is UpdateAst => {
  return ast && typeof ast === 'object' && ast.type === 'update'
}
// 类型守卫：检查是否是Insert_Replace类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isInsertAst = (ast: any): ast is Insert_Replace => {
  return ast && typeof ast === 'object' && ast.type === 'insert'
}

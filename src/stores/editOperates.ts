import { type Ref } from 'vue'
import { JSONPath } from 'jsonpath-plus'
import type { AstItem, EditCoordinate } from './editorTree'

export interface EditHeaderOperateParam {
  index: number // 列索引
  newValue: string // 新的列名
}
// 编辑操作函数类型，editorAstList为AST列表，editCoord为编辑坐标，operateParam为编辑参数
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditOperateFunc = (editorAstList: Ref<AstItem[] | null>, editCoord: EditCoordinate, operateParam: any) => boolean

/**
 * 处理表头输入事件，修改AST中的列名
 * 此函数为 “编辑坐标” 版本
 * 经过思考后，我认为“编辑坐标”并不是真的要精细覆盖到这个 handleHeaderInput 这类业务函数具体修改的值（比如精细到 ast[0].columns[0] 这样）
 * 而是应该按照每个业务函数自己的语义去决定这个坐标要到第几层。
 * 比如在 handleHeaderInput 中，只需要细致到 .value[0] 即可(只需要确定修改的是哪颗AST即可)，而 “要修改第几列的列名” 这个index 反而应该作为 “编辑参数”
 * 因为这个 handleHeaderInput 函数本身的命名就是 “我要去改这颗AST树的第index列的列名” 所以其坐标只需要精细到 .value[0] 即可
 * 在记录操作栈的时候，也只是记录 “这个坐标，执行了handleHeaderInput操作，参数为index，newValue” 即可
 * @param editCoord 编辑坐标，此坐标预期结构为 .value[0] ,用于指定 “修改第几颗AST树的列名”
 * @param operateParam 列索引 + 新的列名
 * @param isStackOpt 是否记录操作栈，默认记录
 */
const setAstColumn = (
  editorAstList: Ref<AstItem[] | null>,
  editCoord: EditCoordinate,
  operateParam: EditHeaderOperateParam,
) => {
  const astItem: AstItem | undefined = JSONPath({
    path: editCoord.valueExp,
    json: editorAstList.value,
  })[0]
  if (!astItem || !astItem.ast || !astItem.ast.columns || !Array.isArray(astItem.ast.columns)) {
    return false
  }
  // 执行操作
  astItem.ast.columns[operateParam.index] = operateParam.newValue
  return true
}

export const editOperates: Record<string, EditOperateFunc> = {
  setAstColumn,
}

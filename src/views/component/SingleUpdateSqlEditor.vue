<template>
  <div class="about-view">
    <div class="sql-visualization-section">
            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="white-space: nowrap;">SQL类型:</label>
          {{ sqlType }}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="white-space: nowrap;">表名:</label>
          <el-input
            :model-value="tableAndDb.tableName"
            @input="editorTreeStore.setAstTableName(props.astId, $event)"
            placeholder="请输入表名"
            size="small"
            style="width: 140px;"
          />
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="white-space: nowrap;">数据库名:</label>
          <el-input
            :model-value="tableAndDb.dbName"
            @input="editorTreeStore.setAstDbName(props.astId, $event)"
            placeholder="请输入数据库名"
            size="small"
            style="width: 140px;"
          />
        </div>
      </div>
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
              />
            </div>
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
      <div style="display: flex; gap: 10px; margin-bottom: 8px; margin-top: 10px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="white-space: nowrap;">WHERE条件:</label>
          <el-input
            v-model="whereCondInputText"
            @blur="handleWhereCondBlur"
            @focus="handleWhereCondFocus"
            placeholder="请输入WHERE条件"
            style="width: 200px;"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import NodeSQLParser, { type BaseFrom, type Update as UpdateAst } from 'node-sql-parser'
import {
  ElInput,
  ElButton,
  ElTable,
  ElTableColumn,
  ElEmpty,
  ElInputNumber,
  ElMessage,
} from 'element-plus'
import { useEditorTreeStore } from '@/stores/editorTree'
import { getSandboxAst } from '@/utils/plainTextEditUtils'

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

const parser = new NodeSQLParser.Parser()

/*
Where条件文本框这样子截取出来的东西绝对不能用v-model直接绑定，因为那样会导致输入框内容被锁死，根本无法编辑。（因为where条件编辑方式和直接编辑字符串不同，where条件总是要经过编译器才能存入AST中，而直接的简单v-bind只能适应最普通的直接字符编辑）
将AST中where条件子树与 “输入框” 解耦，避免输入框绑死的整体技术方案为：
Step1输入框绑定一个组件内自己的变量whereCondInputText
Step2增加一个watch，监听editorTreeStore中AST的where子树，一旦where子树发生变化，则更新whereCondInputText
Step3为输入框增加onBlur事件，onBlur时写入AST中的where子树
*/
const whereCondInputText = ref('')
const whereCondInputTextOldValue = ref('') // 在聚焦输入框前，记录当前输入框的内容。如果where解析失败，就用这个值恢复输入框
/*
从AST中提取where条件字符串的工具函数
背景：where条件语法非常复杂，不可能100%实现可视化编辑。所以需要直接编辑where条件的plain text
实现手段：
  将AST转化为SQL文本方案：
    STEP1 将语法树的where条件子树切割出来
    STEP2 将where子树拼接到“沙盒AST”
    STEP3 将“沙盒AST”解析为SQL
    STEP4 截取 WHERE 字段和 LIMIT字段中间部分的字符串，作为SQL文本展示在文本框中
 */
const getWhereCondInputTextFromAst = () => {
  if (!parsedAst.value || !parsedAst.value.where) {
    return ''
  }
  // 沙盒AST
  const sandboxAst = getSandboxAst()
  // STEP1 将语法树的where条件子树切割出来
  const whereAST = parsedAst.value.where
  // STEP2 将where子树拼接到“沙盒AST”
  sandboxAst.where = {...whereAST}
  // STEP3 将“沙盒AST”解析为SQL
  const sql = parser.sqlify(sandboxAst)
  // STEP4 截取 WHERE 字段后方所有字符串，作为SQL文本展示在文本框中
  const whereIndex = sql.indexOf('WHERE')
  whereCondInputText.value = sql.substring(whereIndex + 5).trim()
}

watch(
  // 监听AST中，where子树的变化
  () => (parsedAst.value as UpdateAst).where,
  () => {
    // 一旦where子树发生变化，则更新whereCondInputText
    getWhereCondInputTextFromAst()
  }
)

/**
 * 处理WHERE条件文本框失去焦点事件
 */
const handleWhereCondBlur = () => {
  // 调用更新WHERE条件的函数
  try {
    editorTreeStore.updSqlModifyWhereCond(props.astId, whereCondInputText.value)
  } catch (error) {
    // 如果更新WHERE条件失败，就用旧值恢复输入框
    whereCondInputText.value = whereCondInputTextOldValue.value
    ElMessage.error(String(error))
  }
}
/**
 * 处理WHERE条件文本框获得焦点事件
 */
const handleWhereCondFocus = () => {
  // 记录当前输入框的内容
  whereCondInputTextOldValue.value = whereCondInputText.value
}



onMounted(() => {
  // 组件挂载时，初始化whereCondInputText
  getWhereCondInputTextFromAst()
})


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

// 添加列
const addColumn = (index: number) => {
  editorTreeStore.updSqlAddField(props.astId, index)
}

// 删除列
const deleteColumn = (index: number) => {
  editorTreeStore.updSqlDeleteField(props.astId, index)
}

/**
 * 从AST中提取数据库名
 */
const sqlType = computed(() => {
  if (!parsedAst.value || !parsedAst.value.type) {
    return ''
  }
  // 转换为大写
  return parsedAst.value.type.toUpperCase() || ''
})
/**
 * 从AST中提取表名
 */
const tableAndDb = computed(() => {
  if (!parsedAst.value || !parsedAst.value.table || !parsedAst.value.table[0]) {
    return {
      tableName: '无法解析',
      dbName: '无法解析',
    }
  }
  if (parsedAst.value.table.length > 1) {
    return {
      tableName: '无法解析多表',
      dbName: '无法解析多表',
    }
  }
  return {
    tableName: (parsedAst.value.table[0] as BaseFrom).table || '',
    dbName: (parsedAst.value.table[0] as BaseFrom).db || '',
  }
})

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

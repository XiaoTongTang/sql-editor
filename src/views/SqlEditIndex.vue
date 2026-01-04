<template>
  <div>
    <div class="sql-input-section">
      <el-input v-model="sqlContent" placeholder="Enter SQL query" type="textarea" :rows=10 />
      <el-button type="primary" @click="sqlToAst">提交可视化编辑</el-button>
    </div>
    <div class="sql-input-section">
      <el-button type="primary" @click="editorTreeStore.undo">撤销</el-button>
      <el-button type="primary" @click="editorTreeStore.redo">重做</el-button>
      备注:对于update语句的where条件输入框,是失去输入框焦点时才视为更新动作
    </div>
    <template v-for="(item, index) in editorTreeStore.editorAstList" :key="item.id">
      <InsUpdSqlEditTable v-if="item.type == 'insert'" :astIndex="index" :astId="item.id" v-model="item.ast as Insert_Replace" />
      <SingleUpdateSqlEditor v-if="item.type == 'update'" :astIndex="index" :astId="item.id" v-model="item.ast as UpdateAst" />
    </template>

    <div class="sql-output-section">
      <el-button type="success" @click="astToSql">输出修改后sql</el-button>
      <el-button type="primary" @click="sendSqlToEditor">发送到编辑器</el-button>
      <el-input v-model="generatedSql" placeholder="生成的SQL语句" type="textarea" readonly :rows=10 />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElInput, ElButton, ElMessage } from 'element-plus'
import InsUpdSqlEditTable from '@/views/component/InsUpdSqlEditTable.vue'
import { type Insert_Replace, type Update as UpdateAst } from 'node-sql-parser'
import SingleUpdateSqlEditor from '@/views/component/SingleUpdateSqlEditor.vue'
import { useEditorTreeStore } from '@/stores/editorTree';

const sqlContent = ref('')
const generatedSql = ref('')
const editorTreeStore = useEditorTreeStore()

const sqlToAst = () => {
  editorTreeStore.sqlToAst(sqlContent.value)
}
// 生成修改后的SQL
const astToSql = () => {
  const genSql = editorTreeStore.astToSql()
  if(genSql) {
    generatedSql.value = genSql
  } else {
    ElMessage.error('生成SQL失败')
  }
}

const messageListener = (event: MessageEvent) => {
  console.log('收到消息:', event.data);
  const message = event.data;

  switch (message.msgType) {
    case 'sendSqlText':
      sqlContent.value = message.sqlText;
      break;
    case 'themeColor':
      if(message.color.kind == 2) {
        document.documentElement.classList.add('dark'); // 将主题设置为暗色（直接为根<html>标签添加class='dark'，参考https://element-plus.org/zh-CN/guide/dark-mode）
      }
      break;
  }
}

onMounted(() => {
  window.addEventListener('message', messageListener);
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    vscode.postMessage({
      msgType: 'sqlEditorOnMount',
    });
  } catch (error) {
    console.error('Error acquiring VS Code API:', error);
  } finally {
    
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('message', messageListener);
})

/**
 * 发送修改后的SQL语句到编辑器
 */
const sendSqlToEditor = () => {
  if(generatedSql.value) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const vscode = acquireVsCodeApi();
      vscode.postMessage({
        msgType: 'resultSqlText',
        resultSqlText: generatedSql.value,
      });
    } catch (error) {
      console.error('Error acquiring VS Code API:', error);
    } finally {
      
    }
  } else {
    ElMessage.error('请先输出修改后SQL语句')
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

import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')

// import * as vscode from 'vscode'

// const editor: vscode.TextEditor = window.activeTextEditor
// if (editor) {
//   editor.edit((editBuilder) => {
//     // 如果光标有选中某区域，则替换选中区域文本，如果未选中，则直接在光标处插入
//     if (editor.selection.isEmpty) {
//       // 直接在光标处插入文本，并选中刚刚插入的sql语句
//       editBuilder.insert(editor.selection.active, message.resultSqlText)
//     } else {
//       // 替换选中区域的文本
//       editBuilder.replace(editor.selection, message.resultSqlText)
//     }
//   })
// }

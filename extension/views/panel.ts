import type { Disposable, ExtensionContext, WebviewPanel } from 'vscode';
import { ViewColumn, window } from 'vscode';
import { WebviewHelper } from './helper';

export class MainPanel {
  public static currentPanel: MainPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];

  private constructor(panel: WebviewPanel, context: ExtensionContext) {
    this._panel = panel;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = WebviewHelper.setupHtml(this._panel.webview, context);

    WebviewHelper.setupWebviewHooks(this._panel.webview, this._disposables);
  }

  public static render(context: ExtensionContext) {
    if (MainPanel.currentPanel) {
      MainPanel.currentPanel._panel.reveal(ViewColumn.Beside);
    }
    else {
      const panel = window.createWebviewPanel('txt-sql-editor', 'Sql-editor', ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true
      });
      // 监听“sql编辑器加载成功”消息，一旦加载成功，则发送主题颜色消息给编辑器
      panel.webview.onDidReceiveMessage(
        message => {
          switch (message.msgType) {
            case 'sqlEditorOnMount':
              panel.webview.postMessage({ msgType: 'themeColor', color: window.activeColorTheme });
              return;
            case 'resultSqlText':
              if (window.visibleTextEditors.length != 1) {
                console.log('当前可见文本编辑器数量不是1个,不知道往哪里插入sql')
                return;
              }
              const editor: vscode.TextEditor = window.visibleTextEditors[0]
              if (editor) {
                editor.edit((editBuilder) => {
                  // 如果光标有选中某区域，则替换选中区域文本，如果未选中，则直接在光标处插入
                  if (editor.selection.isEmpty) {
                    // 直接在光标处插入文本，并选中刚刚插入的sql语句
                    editBuilder.insert(editor.selection.active, message.resultSqlText)
                  } else {
                    // 替换选中区域的文本
                    editBuilder.replace(editor.selection, message.resultSqlText)
                  }
                })
              }
              return;
          }
        },
        undefined,
        context.subscriptions
      );

      MainPanel.currentPanel = new MainPanel(panel, context);
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    MainPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
  public getPanel() {
    return this._panel;
  }
}

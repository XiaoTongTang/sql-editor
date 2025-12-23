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
      });
      // 监听“sql编辑器加载成功”消息，一旦加载成功，则发送主题颜色消息给编辑器
      panel.webview.onDidReceiveMessage(
        message => {
          switch (message.msgType) {
            case 'sqlEditorOnMount':
              panel.webview.postMessage({ msgType: 'themeColor', color: window.activeColorTheme });
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

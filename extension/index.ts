import type { ExtensionContext } from 'vscode';
import { commands, window } from 'vscode';
import { MainPanel, MainPanel2 } from './views';

export function activate(context: ExtensionContext) {
  // Add command to the extension context
  context.subscriptions.push(
    commands.registerCommand('txt-sql-editor.openEditor', async () => {
      MainPanel.render(context);
    }),
  );
  context.subscriptions.push(
    commands.registerCommand('hello-world.showPage2', async () => {
      MainPanel2.render(context);
    }),
  );
  context.subscriptions.push(
    commands.registerCommand('txt-sql-editor.sendSqlText', async () => {
      const editor = window.activeTextEditor;
      const panel = MainPanel.currentPanel?.getPanel();
      if (editor && panel) {
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        panel.webview.postMessage({ msgType: 'sendSqlText', sqlText:text });
        console.log("被发送的sqlText");
        console.log(text);
      }
    }),
  );
}

export function deactivate() {}

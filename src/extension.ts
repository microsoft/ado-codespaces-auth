import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as http from "http";
import { TOKEN_LISTENER_PORT } from "./constants";

const outputChannel = vscode.window.createOutputChannel("ADO Auth");

const log = (...args: { toString: () => string }[]) => {
  outputChannel.appendLine(new Date().toISOString() + ": " + args.join(" "));
};

const server = http
  .createServer(async (_, res) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    res.writeHead(200, { "Content-Type": "application/json" });
    log("Got request for token");
    res.write(
      JSON.stringify({
        accessToken: await getAccessToken(),
      })
    );
    res.end();
  })
  .listen(TOKEN_LISTENER_PORT, "localhost");

const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  100
);

const getAccessToken = async () => {
  let session = await vscode.authentication.getSession(
    "microsoft",
    ["499b84ac-1321-427f-aa17-267ca6975798/.default"],
    { silent: true }
  );
  if (!session) {
    session = await vscode.authentication.getSession(
      "microsoft",
      ["499b84ac-1321-427f-aa17-267ca6975798/.default"],
      { createIfNone: true }
    );
  }
  if (session.accessToken) {
    log("Got access token from VSCode");
  }
  return session.accessToken;
};

const showStatusBarIcon = (authenticated: boolean) => {
  statusBarItem.text = "$(azure-devops) Authenticated";
  statusBarItem.command = "ado-auth-code.authenticate";
  if (!authenticated) {
    statusBarItem.color = "statusBarItem.errorForeground";
    statusBarItem.text = "$(azure-devops) Click to authenticate";
  }
  statusBarItem.show();
};

const authenticateAdo = async (context: vscode.ExtensionContext) => {
  try {
    await getAccessToken();

    const authHelperExecutablePath = path.join(os.homedir(), "ado-auth-helper");

    const authHelperJsPath = path.join(
      context.extensionPath,
      "out",
      "ado-auth-helper.js"
    );

    fs.writeFileSync(
      authHelperExecutablePath,
      `#!${process.execPath}\n\nrequire("${authHelperJsPath}")\n`
    );
    fs.chmodSync(authHelperExecutablePath, 0o755);

    child_process.execSync(
      `git config --global credential.helper '${authHelperExecutablePath}'`
    );

    log(
      "Executed",
      `git config --global credential.helper '${authHelperExecutablePath}'`
    );

    try {
      child_process.execSync(
        `sudo -n ln -sf ${authHelperExecutablePath} /usr/local/bin/ado-auth-helper`
      );
      log(
        "Executed",
        `sudo -n ln -sf ${authHelperExecutablePath} /usr/local/bin/ado-auth-helper`
      );
    } catch (err) {
      log("Could not create symlink in /usr/local/bin");
    }

    showStatusBarIcon(true);

    const authScript = vscode.workspace.getConfiguration("postAuthScript");
  } catch (err) {
    log("Error", err || "");
    showStatusBarIcon(false);
  }
};

export async function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "ado-auth-code.authenticate",
    async () => {
      outputChannel.appendLine("ado-auth-code.authenticate called");
      await authenticateAdo(context);
    }
  );

  const authDisposable = vscode.authentication.onDidChangeSessions(
    async (change) => {
      if (change.provider.id === "microsoft") {
        outputChannel.appendLine("Auth changed");
        await authenticateAdo(context);
      }
    }
  );

  await authenticateAdo(context);

  context.subscriptions.push(disposable);
  context.subscriptions.push(authDisposable);
}

export function deactivate() {
  outputChannel.dispose();
  server.close();
}

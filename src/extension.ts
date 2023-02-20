import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { v4 as uuidV4 } from "uuid";
import { IPC } from "node-ipc";

const outputChannel = vscode.window.createOutputChannel("ADO Codespaces Auth");

const authVsCodeCommand = "ado-codespaces-auth.authenticate";

const log = (...args: { toString: () => string }[]) => {
  outputChannel.appendLine(new Date().toISOString() + ": " + args.join(" "));
};

const ipc = new IPC();
ipc.config.silent = true;

const startServer = (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const socketPath = `/tmp/ado-auth-${uuidV4()}.sock`;

    log("Using socketPath", socketPath, "for auth token server");

    ipc.serve(socketPath, () => {
      ipc.server.on("getAccessToken", async (_, socket) => {
        log("Got request for token");
        ipc.server.emit(socket, "accessToken", await getAccessToken());
      });
    });

    ipc.server.on("start", () => {
      resolve();
    });

    ipc.server.on("error", (err) => {
      reject(err);
    });

    ipc.server.start();
  });
};

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
  statusBarItem.command = authVsCodeCommand;
  statusBarItem.backgroundColor = undefined;
  if (!authenticated) {
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
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
  } catch (err) {
    log("Error", err || "");
    showStatusBarIcon(false);
  }
};

export async function activate(context: vscode.ExtensionContext) {
  await startServer();

  const disposable = vscode.commands.registerCommand(
    authVsCodeCommand,
    async () => {
      log(authVsCodeCommand, "called");
      await authenticateAdo(context);
    }
  );

  const authDisposable = vscode.authentication.onDidChangeSessions(
    async (change) => {
      if (change.provider.id === "microsoft") {
        log("Auth changed");
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
  ipc.server.stop();
}

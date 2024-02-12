import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { v4 as uuidV4 } from "uuid";
import { IPC } from "node-ipc";

const DEFAULT_ADO_SCOPE = "499b84ac-1321-427f-aa17-267ca6975798/.default";
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
      ipc.server.on("getAccessToken", async ({ scopes }, socket) => {
        log("Got request for token with scopes:", scopes);
        ipc.server.emit(
          socket,
          "accessToken",
          await getAccessToken(scopes?.split(" "))
        );
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

const getAccessToken = async (
  scopes = [DEFAULT_ADO_SCOPE]
) => {
  const tenantID = vscode.workspace.getConfiguration("adoCodespacesAuth").get('tenantID');
  if (tenantID && tenantID !== '') {
    scopes.push(`VSCODE_TENANT:${tenantID}`);
  }

  let session = await vscode.authentication.getSession("microsoft", scopes, {
    silent: true,
  });
  if (!session) {
    session = await vscode.authentication.getSession("microsoft", scopes, {
      createIfNone: true,
    });
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

const createHelperExecutable = (
  context: vscode.ExtensionContext,
  executableName: string
) => {
  const authHelperExecutablePath = path.join(os.homedir(), executableName);

  const authHelperJsPath = path.join(
    context.extensionPath,
    "out",
    "auth-helper.js"
  );

  fs.writeFileSync(
    authHelperExecutablePath,
    `#!${process.execPath}\n\nrequire("${authHelperJsPath}")\n`
  );
  fs.chmodSync(authHelperExecutablePath, 0o755);

  try {
    const command = `sudo -n ln -sf ${authHelperExecutablePath} /usr/local/bin/${executableName}`;
    log("Executing", command);
    child_process.execSync(command);
  } catch (err) {
    log("Could not create symlink in /usr/local/bin");
  }
};

const authenticateAdo = async (context: vscode.ExtensionContext) => {
  try {
    await getAccessToken();

    createHelperExecutable(context, "ado-auth-helper");
    createHelperExecutable(context, "azure-auth-helper");

    showStatusBarIcon(true);
  } catch (err) {
    log("Error", err || "");
    showStatusBarIcon(false);
  }
};

const checkAndWarnIfEnvUnsupported = (): boolean => {
  const supportedRemotes = [
    "codespaces",
    "dev-container",
    "attached-container",
  ];
  if (supportedRemotes.includes(vscode.env.remoteName || "")) {
    return true;
  }
  vscode.window
    .showWarningMessage(
      "ADO Codespaces Auth extension is only supported in Github Codespaces",
      "Uninstall"
    )
    .then(async (data) => {
      if (data === "Uninstall") {
        try {
          await vscode.commands.executeCommand(
            "workbench.extensions.uninstallExtension",
            "ms-codespaces-tools.ado-codespaces-auth"
          );
        } catch (err) {
          log(err || "");
        }
      }
    });
  return false;
};

export async function activate(context: vscode.ExtensionContext) {
  if (!checkAndWarnIfEnvUnsupported()) {
    log("Unsupported env, not enabling extension");
    return;
  }

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
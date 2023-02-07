import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

const outputChannel = vscode.window.createOutputChannel("ADO Auth");

interface AdoWorkspace {
  fsPath: string;
  gitRemote: string;
}

const getAdoWorkspaces = async (): Promise<AdoWorkspace[]> => {
  if (!vscode.workspace.workspaceFolders) {
    return [];
  }
  return vscode.workspace.workspaceFolders
    .map((workspaceFolder) => {
      const gitRemote = child_process
        .execSync("git config --get remote.origin.url", {
          cwd: workspaceFolder.uri.fsPath,
        })
        .toString()
        .trim();
      return {
        fsPath: workspaceFolder.uri.fsPath,
        gitRemote,
      };
    })
    .filter((workspace) => {
      return (
        workspace.gitRemote.includes("dev.azure.com") ||
        workspace.gitRemote.includes("visualstudio.com")
      );
    });
};

const approveAccessTokenForGit = async (
  token: string,
  adoWorkspaces: AdoWorkspace[]
) => {
  adoWorkspaces.forEach((workspace) => {
    outputChannel.appendLine(
      "Storing Oauth credentials for " + workspace.gitRemote
    );
    child_process.execSync(
      "git config --global credential.azreposCredentialType oauth"
    );
    child_process.execSync(
      `echo "url=${workspace.gitRemote}\nusername=token\npassword=${token}\n\n" | git credential approve`
    );
  });
};

const storeNpmAuth = async (
  accessToken: string,
  adoWorkspaces: AdoWorkspace[]
) => {
  const npmRegistries = (
    await Promise.all(
      adoWorkspaces.map(async (workspace) => {
        const npmrcPath = path.join(workspace.fsPath, ".npmrc");
        try {
          await fs.promises.access(npmrcPath);
        } catch (error) {
          return []; // does not exist/no access
        }
        const npmrcContent = await fs.promises.readFile(npmrcPath);
        const registries = npmrcContent.toString().match(/https.+registry\//g);
        return registries || [];
      })
    )
  ).flat();

  let homeNpmRcContent = "\n\n";
  npmRegistries?.forEach((registry) => {
    const registryPath = registry.split("https://")[1];
    homeNpmRcContent += `//${registryPath}:_authToken=${accessToken}\n`;
  });

  outputChannel.appendLine("Found registries: " + npmRegistries.toString());
  await fs.promises.appendFile(
    path.join(os.homedir(), ".npmrc"),
    homeNpmRcContent
  );
};

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
    outputChannel.appendLine(
      "Got access token: " + session.accessToken.slice(-7)
    );
  }
  return session.accessToken;
};

const authenticateAdo = async () => {
  const adoWorkspaces = await getAdoWorkspaces();
  if (adoWorkspaces.length === 0) {
    outputChannel.appendLine("No workspace folder found");
    return;
  }
  const accessToken = await getAccessToken();
  await approveAccessTokenForGit(accessToken, adoWorkspaces);
  await storeNpmAuth(accessToken, adoWorkspaces);
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = "$(azure-devops) Authenticated!";
  statusBarItem.show();
};

export async function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "ado-auth-code.authenticate",
    async () => {
      outputChannel.appendLine("Command called");
      await authenticateAdo();
    }
  );

  const authDisposable = vscode.authentication.onDidChangeSessions(
    async (change) => {
      if (change.provider.id === "microsoft") {
        outputChannel.appendLine("Auth changed");
        await authenticateAdo();
      }
    }
  );

  await authenticateAdo();

  context.subscriptions.push(disposable);
  context.subscriptions.push(authDisposable);
}

export function deactivate() {
  outputChannel.dispose();
}

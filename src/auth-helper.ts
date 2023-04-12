import { IPC } from "node-ipc";
import * as readline from "readline";
import * as child_process from "child_process";

const getAccessTokenFromSocket = (socketPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const ipc = new IPC();

    ipc.config.silent = true;

    const timeout = setTimeout(() => {
      ipc.disconnect("extension");
      reject(new Error("timed-out waiting for auth"));
    }, 60 * 1000);

    function connecting() {
      ipc.of.extension.on("error", (err) => {
        ipc.disconnect("extension");
        reject(err);
      });
      ipc.of.extension.on("connect", () => {
        ipc.of.extension.emit("getAccessToken", { scopes: process.argv[3] });
      });
      ipc.of.extension.on("accessToken", (data) => {
        ipc.disconnect("extension");
        clearTimeout(timeout);
        resolve(data);
      });
    }

    ipc.connectTo("extension", socketPath, connecting);
  });
};

const getAccessToken = async (): Promise<string> => {
  // ss- lx gets list of listening unix sockets
  const data = child_process.execSync("ss -lx").toString();
  // Find all sockets which start with /tmp/ado-auth
  // Our extension will listen on sockets on /tmp/ado-auth-<uuid>.sock path
  const openSockets = data.match(/\/tmp\/ado-auth\S*/g);
  if (!openSockets) {
    // No open listening sockets with /tmp/ado-auth - meaning no vscode connected
    // Exit with exit-code 1
    process.exit(1);
  }
  // Return as soon as any sockets gets us an access token
  return Promise.any(
    openSockets.map((socket) => getAccessTokenFromSocket(socket))
  );
};

const isGitAskingForAdoRepo = async (): Promise<boolean> => {
  let input = "";
  const rl = readline.createInterface({
    input: process.stdin,
  });
  for await (const line of rl) {
    input += line + "\n";
  }
  return input.includes("dev.azure.com") || input.includes(".visualstudio.com");
};

const run = async () => {
  const command = process.argv[2];
  // get - is for git credential helper, it will output in a format git understands
  // get-access-token will just print the access token - for other tools which want to integrate this
  if (command !== "get" && command !== "get-access-token") {
    return;
  }

  const isForGitAdoRepo = command === "get" && (await isGitAskingForAdoRepo());

  if (isForGitAdoRepo) {
    const token = await getAccessToken();
    process.stdout.write("username=token\n");
    process.stdout.write("password=" + token + "\n");
  } else if (command === "get-access-token") {
    const token = await getAccessToken();
    process.stdout.write(token + "\n");
  }

  // Need explicit exit as some of the socket io may still be happening
  process.exit(0);
};

run();

import axios from "axios";
import * as readline from "readline";
import { TOKEN_LISTENER_PORT } from "./constants";

const getAccessToken = async (): Promise<string> => {
  try {
    const response = await axios.get(
      `http://localhost:${TOKEN_LISTENER_PORT}/`
    );
    return response.data.accessToken;
  } catch (err) {
    process.exit(1);
  }
};

const delay = async (delayMs: number) => {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
};

const retry = <T>(
  fn: () => Promise<T>,
  retry = 3,
  delayMs = 10000
): (() => Promise<T>) => {
  return async (...args) => {
    while (true) {
      try {
        return await fn(...args);
      } catch (err) {
        retry = retry - 1;
        if (retry === 0) {
          throw err;
        }
        await delay(delayMs);
      }
    }
  };
};

const run = async () => {
  if (process.argv[2] !== "get" && process.argv[2] !== "get-access-token") {
    return;
  }
  let input = "";
  // Take stdin input for git credential helper
  if (process.argv[2] === "get") {
    const rl = readline.createInterface({
      input: process.stdin,
    });
    for await (const line of rl) {
      input += line + "\n";
    }
  }
  const token = await retry(getAccessToken)();
  if (
    process.argv[2] === "get" &&
    (input.includes("dev.azure.com") || input.includes(".visualstudio.com"))
  ) {
    process.stdout.write("username=token\n");
    process.stdout.write("password=" + token + "\n");
  } else if (process.argv[2] === "get-access-token") {
    process.stdout.write(token + "\n");
  }
};

run();

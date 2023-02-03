// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from "axios";


const checkRequiredAuth = () => {
	const settings = vscode.workspace.getConfiguration("ado-auth-code");
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log(process.env);
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('ado-auth-code.authenticate', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		const value = await vscode.window.showInformationMessage("You need to sign in to ADO", { modal: true }, "Sign in");
		if (value === "Sign in") {
			const session = await vscode.authentication.getSession("microsoft", ["499b84ac-1321-427f-aa17-267ca6975798/.default"], { createIfNone: true });
			try {
				const response = await axios.post("https://vssps.dev.azure.com/testorg/_apis/tokens/pats?api-version=7.0-preview.1", {
					"displayName": "new_token",
					"scope": "vso.code",
					"validTo": "2023-02-04T23:46:23.319Z",
					"allOrgs": false			  
				}, {
					headers: {
						Authorization: "Bearer " + session.accessToken,
					}
				});
				console.log(response);	
			} catch (err) {
				console.error(err);
			}
		}

	});

	const statusBarItem = vscode.window.createStatusBarItem("ado-auth-code", vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = "ado-auth-code.authenticate";
	statusBarItem.text = "$(azure-devops) Click to Authenticate";
	statusBarItem.show();

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

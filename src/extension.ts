// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { isAbsolute } from 'node:path';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let envButton: vscode.StatusBarItem;
	const noEnv = "no env";

	const refreshChooseEnvButton = () => {
		let currentEnvFile: string | undefined = context.workspaceState.get("hurl-runner.envFile");
		if (currentEnvFile) {
			envButton.text = `$(key) Hurl: ${currentEnvFile}`;
		} else {
			envButton.text = `$(key) Hurl: ${noEnv}`;
		}
		envButton.show();
	};

	const getFullEnvFilePath = (): string | undefined => {
		if(!vscode.workspace.workspaceFolders) {
			return;
		}
		let currentEnvFile: string | undefined = context.workspaceState.get("hurl-runner.envFile");
		if (!currentEnvFile) {
			return;
		}

		let config = vscode.workspace.getConfiguration('hurl-runner');
		let envDir: string | undefined = config.envDir;

		if (!envDir) {
			return;
		}

		let envDirUri: vscode.Uri;
		if (!isAbsolute(envDir)) {
			let workspace = vscode.workspace.workspaceFolders[0];
			envDirUri = vscode.Uri.joinPath(workspace.uri, envDir);
		} else {
			envDirUri = vscode.Uri.parse(envDir);
		}

		let envFileUri = vscode.Uri.joinPath(envDirUri, currentEnvFile);
		return envFileUri.fsPath;
	};

	if(vscode.workspace.workspaceFolders) {
		envButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
		envButton.command = 'hurl-runner.chooseEnv';

		context.subscriptions.push(envButton);
		refreshChooseEnvButton();
	}

	const runFile = (commandLineArguments: string) => {
		let terminal = vscode.window.activeTerminal || vscode.window.createTerminal();
		let editor = vscode.window.activeTextEditor;
    if(!editor || !editor.document || !editor.document.fileName || editor.document.languageId !== 'hurl') {
			return;
		}

		let currentEnvFile = getFullEnvFilePath();

		let fileName = editor.document.fileName;

		let command = `hurl ${fileName} ${commandLineArguments}`;
		if (currentEnvFile) {
			command += ` --variables-file ${currentEnvFile}`;
		}

		terminal.show();
		terminal.sendText(command);
	};

	const runFileCommand = vscode.commands.registerCommand('hurl-runner.runFile', () => {
		let config = vscode.workspace.getConfiguration('hurl-runner');
		let commandLineArguments: string = config.commandLineArguments;
		runFile(commandLineArguments);
	});
	context.subscriptions.push(runFileCommand);

	const runFileInteractivelyCommand = vscode.commands.registerCommand('hurl-runner.runFileInteractively', () => {
		let config = vscode.workspace.getConfiguration('hurl-runner');
		let commandLineArguments: string = config.commandLineArguments;
		runFile(commandLineArguments + " --interactive --very-verbose");
	});
	context.subscriptions.push(runFileInteractivelyCommand);

	const chooseEnvCommand = vscode.commands.registerCommand('hurl-runner.chooseEnv', async () => {
		let config = vscode.workspace.getConfiguration('hurl-runner');
		let envDir: string | undefined = config.envDir;
		if(!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage("You must be in a workspace to use hurl environments");
			return;
		}
		if (!envDir) {
			vscode.window.showErrorMessage("You should configure hurl-runner.envDir");
			return;
		}

		let envDirUri: vscode.Uri;
		if (!isAbsolute(envDir)) {
			let workspace = vscode.workspace.workspaceFolders[0];
			envDirUri = vscode.Uri.joinPath(workspace.uri, envDir);
		} else {
			envDirUri = vscode.Uri.parse(envDir);
		}
		let envNames: string[];

		try {
			let envs = await vscode.workspace.fs.readDirectory(envDirUri);
			envNames = envs.map(([name, _]) => name).filter((name) => name.split('.').pop() === "env");
		} catch {
			vscode.window.showErrorMessage(`There are no defined environments under ${envDir}`);
			return;
		}

		envNames.push(noEnv);
		let selection = await vscode.window.showQuickPick(envNames);
		if (!selection) {
			return;
		}
		if (selection === noEnv) {
			context.workspaceState.update("hurl-runner.envFile", undefined);
			refreshChooseEnvButton();
			return;
		}

		context.workspaceState.update("hurl-runner.envFile", selection);
		refreshChooseEnvButton();
	});
	context.subscriptions.push(chooseEnvCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}

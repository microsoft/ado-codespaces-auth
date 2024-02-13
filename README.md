# Azure Devops Codespaces Authentication

- This VSCode extension is used for authenticating to Azure Devops in GitHub Codespaces.
- It authenticates using in-built microsoft auth provider to authenticate to ADO using Entra ID login.
- User is prompted for login on opening a codespace with this extension installed.
- The default is to sign in to the common Entra ID tenant. The setting `adoCodespacesAuth.tenantID` allows to specify tenant to sign in to.
- The OAuth access token is then shared with the codespace using a credential helper which is installed at `~/ado-auth-helper`. The credential helper supports two commands
  - `get` - This command is used by git credential helper to get auth credentials for git. You can configure the helper by running `git config --global credential.helper '<absolutePathToHelper>'`.
  - `get-access-token` - This command will print an access token to stdout. Other tools can integrate this for getting ADO credentials, for eg, authenticating to ADO Artifact Feeds (NPM, Nuget). 
- This extension is not recommended to be installed by itself. You should instead use the [external-repository](https://github.com/microsoft/codespace-features/tree/main/src/external-repository) and [artifacts-helper](https://github.com/microsoft/codespace-features/tree/main/src/artifacts-helper) devcontainer features which will ensure this extension is preinstalled on your Codespace with proper configuration.

### New in version 1.2
- Add the `adoCodespacesAuth.tenantID` setting 

### New in version 1.1
- Credential helper for managed identities, installed at `~/azure-auth-helper`.
- This one allows specifying custom scopes for the access token, like so:
```bash
$ ~/azure-auth-helper get-access-token "https://management.azure.com/.default"
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft 
trademarks or logos is subject to and must follow 
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.

# Change Log

All notable changes to the "ado-codespaces-code" extension will be documented in this file.

## [1.1.0] - 2023-04-12
- Credential helper for managed identities, installed at `~/azure-auth-helper`.
- This one allows specifying custom scopes for the access token, like so:
```bash
$ ~/azure-auth-helper get-access-token "https://management.azure.com/.default"
```

## [1.0.1] - 2023-02-20

- Add icon
- Update description, repository url

## [1.0.0] - 2023-02-20

- Initial release

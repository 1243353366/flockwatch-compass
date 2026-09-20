# Corpora AI Direct-Share Bundle

This archive contains the source-controlled Corpora AI self-hosted Worker and its local launch configuration. It is intended for private sharing, local evaluation, GitHub Codespaces, or a compatible third-party development environment.

## Important limitation

A ZIP archive is **not** an Apple App Store package, Google Play package, or Microsoft Store submission. It does not bypass store review, signing, developer-account, identity, privacy-policy, or platform security requirements. It is a source/self-host bundle for people who want to run the application themselves.

## Quick start

Requirements: Node.js 24 LTS and npm.

```sh
npm ci
npm start
```

Open `http://localhost:8787` in a browser.

The self-hosted preview runs without Workers AI and D1 bindings in algorithmic/stateless mode. Do not place Cloudflare tokens, database credentials, customer data, or other secrets in the archive or in a public code-sharing project.

## GitHub browser launch

The same source is available at:

- https://github.com/1243353366/corpora-ai
- https://github.com/codespaces/new?hide_repo_select=true&ref=main&repo=1243353366%2Fcorpora-ai

## Safety boundary

The included browser research, reasoning, telemetry, and synthetic-emulator features are bounded by explicit authorization, provenance, human review, and isolated-simulation controls. The synthetic emulator does not create sockets, execute malware, propagate, scan external systems, or operate real command-and-control infrastructure.

## Provenance

The bundle includes the upstream attribution and licensing files. Aadi's Digital Lab is referenced as an MIT-licensed upstream reasoning source; it is not copied into this archive as executable code.

## Recommended sharing

Send this archive only to people who understand that they are receiving source code. For a zero-install browser experience, share the GitHub Codespaces link instead. For a third-party browser workspace, use the repository URL with the provider's official GitHub import flow.

# Lighthouse MCP

A Model Context Protocol (MCP) server that enables Claude to interact with your Lighthouse.one portfolio data. This integration allows you to query and analyze your crypto portfolio directly through Claude.

## Features

- **Authentication**: Securely authenticate with Lighthouse using transfer token URLs
- **Portfolio Overview**: Get detailed breakdowns of your portfolio including:
  - Total portfolio value
  - Asset type distribution
  - Major holdings (≥ $1,000)
  - List of connected wallets/accounts

## Installation

```bash
npm install
```

## Running Locally

1. Build the project:

```bash
npm run build
```

2. Start the MCP server:

```bash
npm start
```

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lighthouse": {
      "command": "npx",
      "args": ["-y", "mcp-lighthouse"]
    }
  }
}
```

Then restart the CLaude app. If you don't get any errors on startup, then the MCP server is working.

## Authentication Walkthrough

To authenticate with Lighthouse, follow these steps:

1. Go to the Settings page on Lighthouse.one
2. Click on "Link Mobile Device" option
3. Take a screenshot of the displayed QR code
4. Visit a QR code decoder (e.g., [ZXing Decoder](https://zxing.org/w/decode.jspx)) and upload your screenshot
5. Copy the decoded URL and ask Claude to authenticate with Lighthouse by pasting the URL into the chat

Note: The URL will be in the format of a Lighthouse transfer token URL which Claude can use to authenticate your session.

## Available Commands

Once connected, you can use the following commands with Claude:

1. **Authenticate**

   ```
   Use the authenticate command with a Lighthouse transfer token URL to log in.
   ```

2. **Get Portfolio Overview**
   ```
   Use the getLighthousePortfolio command to view your current portfolio status.
   ```

## Session Management

- The server maintains a session file (`.lighthouse_session`) to persist your authentication
- You only need to authenticate once unless you explicitly log out or the session expires
- Session data is stored securely on your local machine

NOTE: You can always revoke the session key from the Lighthouse dashboard.

## Security Note

This MCP server runs locally on your machine and communicates directly with Lighthouse's API. Your authentication credentials are never shared with Claude or any third-party services.

## Development

The project is built with TypeScript and uses the FastMCP framework for MCP server implementation. To modify or extend the functionality:

1. Make changes to `index.ts`
2. Rebuild the project: `npm run build`
3. Restart the server

## Requirements

- Node.js 16 or higher
- npm or yarn
- A Lighthouse.one account

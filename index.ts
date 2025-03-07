#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { ApiResponse, Account, Position, Asset } from "./lighthouse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new FastMCP({
  name: "Lighthouse MCP",
  version: "0.0.3",
});

const SESSION_FILE = path.join(__dirname, ".lighthouse_session");
let sessionCookie: string | null = null;

// Function to load session from file
async function loadSession(): Promise<string | null> {
  try {
    const data = await fs.readFile(SESSION_FILE, "utf-8");
    return data.trim() || null;
  } catch (error) {
    return null;
  }
}

// Function to save session to file
async function saveSession(cookie: string | null): Promise<void> {
  if (cookie) {
    await fs.writeFile(SESSION_FILE, cookie, "utf-8");
  } else {
    try {
      await fs.unlink(SESSION_FILE);
    } catch (error) {
      // Ignore error if file doesn't exist
    }
  }
}

// Initialize session from file
loadSession().then((cookie) => {
  sessionCookie = cookie;
});

server.addTool({
  name: "authenticate",
  description: "Authenticate with Lighthouse using a transfer token URL",
  parameters: z.object({
    url: z.string().url(),
  }),
  execute: async (args) => {
    try {
      // Extract token from URL
      const url = new URL(args.url);
      const token = url.searchParams.get("token");

      if (!token) {
        throw new Error("No token found in URL");
      }

      // Make the login request
      const response = await fetch("https://lighthouse.one/v1/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.api+json",
        },
        body: JSON.stringify({
          type: "TRANSFER_TOKEN",
          token: token,
        }),
      });

      if (!response.ok) {
        throw new Error(`Login failed with status ${response.status}`);
      }

      // Extract and store the session cookie
      const cookies = response.headers.get("set-cookie");
      if (cookies) {
        const sessionCookieMatch = cookies.match(/lh_session=([^;]+)/);
        if (sessionCookieMatch) {
          sessionCookie = sessionCookieMatch[1];
          // Save the session cookie to file
          await saveSession(sessionCookie);
          return {
            content: [
              {
                type: "text",
                text: "Successfully authenticated with Lighthouse",
              },
            ],
          };
        }
      }

      throw new Error("No session cookie found in response");
    } catch (error: any) {
      // Clear session cookie on error
      sessionCookie = null;
      await saveSession(null);
      return {
        content: [
          { type: "text", text: `Authentication failed: ${error.message}` },
        ],
      };
    }
  },
});

// Tool to fetch and format Lighthouse portfolio data
server.addTool({
  name: "getLighthousePortfolio",
  description:
    "Fetch and display your Lighthouse portfolio with breakdown by asset types and major holdings",
  parameters: z.object({}),
  execute: async () => {
    try {
      if (!sessionCookie) {
        return {
          content: [
            {
              type: "text",
              text: "No session cookie available. Please authenticate first.",
            },
          ],
        };
      }

      // Fetch the latest snapshot from Lighthouse API
      // Using the URL from the comment in lighthouse.d.ts
      const response = await fetch(
        "https://lighthouse.one/v1/workspaces/neckbeard-ido/snapshots/latest",
        {
          headers: {
            Cookie: `lh_session=${sessionCookie}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      // Calculate total USD value
      const totalUsdValue = data.usdValue;

      // Get wallets/accounts
      const wallets = Object.values(data.accounts).map((account: Account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
      }));

      // Calculate asset type breakdown
      const assetTypeMap = new Map<string, number>();

      data.positions.forEach((position: Position) => {
        position.assets.forEach((asset: Asset) => {
          const currentValue = assetTypeMap.get(asset.type) || 0;
          assetTypeMap.set(asset.type, currentValue + asset.usdValue);
        });
      });

      // Convert to array and sort by value
      const assetTypeBreakdown = Array.from(assetTypeMap.entries())
        .map(([type, value]) => ({
          type,
          value,
          percentage: (value / totalUsdValue) * 100,
        }))
        .sort((a, b) => b.value - a.value);

      // Get major assets (>= $1000)
      const majorAssets = data.positions
        .flatMap((position) =>
          position.assets
            .filter((asset) => asset.usdValue >= 1000)
            .map((asset) => ({
              name: asset.name,
              symbol: asset.symbol,
              value: asset.usdValue,
              amount: asset.amount,
            }))
        )
        .sort((a, b) => b.value - a.value);

      // Format the response
      const assetTypeTable = `
| Asset Type | Net Value | % of Portfolio |
|------------|-----------|----------------|
${assetTypeBreakdown
  .map(
    (item) =>
      `| ${item.type} | $${item.value.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      })} | ${item.percentage.toFixed(2)}% |`
  )
  .join("\n")}
`;

      const assetsTable = `
| Asset | Value | Amount |
|-------|-------|--------|
${majorAssets
  .map(
    (asset) =>
      `| ${asset.name} (${asset.symbol}) | $${asset.value.toLocaleString(
        undefined,
        { maximumFractionDigits: 2 }
      )} | ${asset.amount.toLocaleString(undefined, {
        maximumFractionDigits: 6,
      })} |`
  )
  .join("\n")}
`;

      return {
        content: [
          {
            type: "text",
            text: `# Lighthouse Portfolio Summary\n\n## Total Portfolio Value: $${totalUsdValue.toLocaleString()}\n\n## Wallets (${
              wallets.length
            }):\n${wallets
              .map((w) => `- ${w.name} (${w.type})`)
              .join(
                "\n"
              )}\n\n## Asset Type Breakdown:\n${assetTypeTable}\n\n## Major Holdings (>= $1,000):\n${assetsTable}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch Lighthouse portfolio: ${error.message}`,
          },
        ],
      };
    }
  },
});

server.start({
  transportType: "stdio",
});

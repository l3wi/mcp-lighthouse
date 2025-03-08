#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { z } from "zod";
import {
  Account,
  Lighthouse,
  Position,
  LighthouseAsset,
} from "./lighthouse.js";
import { formatNumber, formatPercentage } from "./utils.js";

export const version = "0.0.5";
export const scriptName = "Lighthouse MCP";

const server = new FastMCP({
  name: scriptName,
  version: version,
});

server.addTool({
  name: "authenticate",
  description: "Authenticate with Lighthouse using a transfer token URL",
  parameters: z.object({
    url: z.string().url(),
  }),
  execute: async (args) => {
    try {
      const result = await lighthouse.authenticate(args.url);

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: result.message,
            },
          ],
        };
      } else {
        return {
          content: [{ type: "text", text: result.message }],
        };
      }
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `Authentication failed: ${error.message}` },
        ],
      };
    }
  },
});

server.addTool({
  name: "listLighthousePortfolios",
  description:
    "List all Lighthouse portfolios, their total portfolio value, the wallets within each portfolio and their total value",
  parameters: z.object({}),
  execute: async () => {
    const portfolios = await lighthouse.getUserData();
    const porfolioData = await Promise.all(
      portfolios.user.portfolios.map(async (portfolio) => {
        return await lighthouse.getPortfolioData(portfolio.slug);
      })
    );

    //Sum the portfolios
    const totalPortfolioValue = porfolioData.reduce(
      (acc, data) => acc + data.usdValue,
      0
    );

    /// Format the porfolio data
    const formattedPorfolioData = porfolioData.map((data, i) => {
      return `# ${i + 1}. ${
        portfolios.user.portfolios[i].name
      }\n\n## Total Portfolio Value: $${data.usdValue.toLocaleString()}\n\n## Wallets (${
        Object.keys(data.accounts).length
      }):\n${Object.entries(data.accounts)
        .map(([accountId, account]) => `- ${account.name} (${account.type})`)
        .join("\n")}`;
    });

    return {
      content: [
        {
          type: "text",
          text: `# Lighthouse Portfolios\n\n${formattedPorfolioData.join(
            "\n"
          )}\n\n## Total Portfolio Value: $${totalPortfolioValue.toLocaleString()}`,
        },
      ],
    };
  },
});

// Tool to fetch and format Lighthouse portfolio data
server.addTool({
  name: "getLighthousePortfolio",
  description:
    "Fetch and display a detailed summary of a Lighthouse portfolio with breakdown by asset types and major holdings.",
  parameters: z.object({
    portfolio: z
      .string()
      .optional()
      .describe(
        "Optional portfolio name to select a specific portfolio to display a summary for"
      ),
  }),
  execute: async (args) => {
    try {
      if (!lighthouse.isAuthenticated()) {
        return {
          content: [
            {
              type: "text",
              text: "No session cookie available. Please authenticate first.",
            },
          ],
        };
      }

      // Find the portfolio
      const portfolio = await lighthouse.findPortfolio(args.portfolio);

      // Get the portfolio data
      const data = await lighthouse.getPortfolioData(portfolio.slug);

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
        position.assets.forEach((asset: LighthouseAsset) => {
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
      `| ${item.type} | $${formatNumber(item.value)} | ${formatPercentage(
        item.percentage
      )}% |`
  )
  .join("\n")}
`;

      const assetsTable = `
| Asset | Value | Amount |
|-------|-------|--------|
${majorAssets
  .map(
    (asset) =>
      `| ${asset.name} (${asset.symbol}) | $${formatNumber(
        asset.value
      )} | ${formatNumber(asset.amount)} |`
  )
  .join("\n")}
`;

      return {
        content: [
          {
            type: "text",
            text: `# Lighthouse Portfolio Summary: ${
              portfolio.name
            }\n\n## Total Portfolio Value: $${formatNumber(
              totalUsdValue
            )}\n\n## Wallets (${wallets.length}):\n${wallets
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

server.addTool({
  name: "getLighthouseYieldData",
  description: "Get yield data for a Lighthouse portfolio",
  parameters: z.object({
    portfolio: z
      .string()
      .optional()
      .describe(
        "Optional portfolio name to select a specific portfolio to display a summary for"
      ),
  }),
  execute: async (args) => {
    if (!lighthouse.isAuthenticated()) {
      return {
        content: [
          {
            type: "text",
            text: "Not authenticated. Please authenticate first.",
          },
        ],
      };
    }

    const portfolio = args.portfolio
      ? await lighthouse.findPortfolio(args.portfolio)
      : await lighthouse.findPortfolio();

    const yieldData = await lighthouse.getYieldData(portfolio.slug);

    // Calulate USD values
    // Iterate through each pool
    // Iterate through each supply, receive, borrow, pay
    // Calculate the USD value of each receive & pay
    // Sum the USD values of each receive & pay
    // Return an array of pools with the USD values
    const formattedYieldData = yieldData.pools.map((pool) => {
      return {
        ...pool,
        receiveUSD: pool.supply.map((supply, index) => {
          return {
            asset: supply.asset.symbol,
            assetUSD: supply.amount * supply.asset.price,
            apy: pool.receive[index].apy,
            receiveUSD:
              (pool.receive[index].apy / 100) *
              supply.amount *
              supply.asset.price,
          };
        }),
        payUSD: pool.borrow.map((borrow, index) => {
          return {
            asset: borrow.asset.symbol,
            assetUSD: borrow.amount * borrow.asset.price,
            apy: pool.pay[index].apy,
            payUSD:
              (pool.pay[index].apy / 100) * borrow.amount * borrow.asset.price,
          };
        }),
      };
    });

    const formattedYieldDataWithUsdValues = formattedYieldData.map((pool) => {
      return {
        ...pool,
        netYieldUSD:
          pool.receiveUSD.reduce(
            (acc, receive) => acc + receive.receiveUSD,
            0
          ) - pool.payUSD.reduce((acc, pay) => acc + pay.payUSD, 0),
      };
    });

    // Format the yield data
    const responseFormattedYieldData = formattedYieldDataWithUsdValues
      .map((pool) => {
        return `# ${pool.platform.name} (${
          pool.network.name
        }) - Annual Yield: $${formatNumber(pool.netYieldUSD)} \n${
          pool.receiveUSD.length > 0
            ? `## Receive: \n${pool.receiveUSD
                .map(
                  (supply) =>
                    `${supply.asset} - $${formatNumber(
                      supply.receiveUSD
                    )} per year`
                )
                .join("\n")}`
            : ""
        }${
          pool.payUSD.length > 0
            ? `## Pay: \n${pool.payUSD
                .map(
                  (pay) =>
                    `${pay.asset} - $${formatNumber(pay.payUSD)} per year`
                )
                .join("\n")}`
            : ""
        }`;
      })
      .join("\n\n");

    const totalSupplyUSD = formattedYieldDataWithUsdValues.reduce(
      (acc, pool) => {
        return (
          acc +
          pool.receiveUSD.reduce((acc, receive) => {
            return acc + receive.assetUSD;
          }, 0)
        );
      },
      0
    );

    const totalBorrowUSD = formattedYieldDataWithUsdValues.reduce(
      (acc, pool) => {
        return acc + pool.payUSD.reduce((acc, pay) => acc + pay.assetUSD, 0);
      },
      0
    );

    const totalYieldUSD = formattedYieldDataWithUsdValues.reduce(
      (acc, pool) => {
        return acc + pool.netYieldUSD;
      },
      0
    );

    return {
      content: [
        {
          type: "text",
          text:
            `${portfolio.name} \n Total Yield: $${formatNumber(totalYieldUSD)}
            ## Total Supplied: $${formatNumber(totalSupplyUSD)}
            ## Total Borrowed: $${formatNumber(totalBorrowUSD)}
            ## Avg APY: ${formatPercentage(
              totalYieldUSD / totalSupplyUSD
            )}% \n\n
            ` + responseFormattedYieldData,
        },
      ],
    };
  },
});

server.addTool({
  name: "getLighthousePerformanceData",
  description: "Get performance data for a Lighthouse portfolio",
  parameters: z.object({
    portfolio: z.string().optional().describe("Optional portfolio name"),
    startDate: z
      .string()
      .optional()
      .describe("Optional start date. Formatted as YYYY-MM-DD"),
  }),
  execute: async (args) => {
    const portfolio = args.portfolio
      ? await lighthouse.findPortfolio(args.portfolio)
      : await lighthouse.findPortfolio();

    const startDate = args.startDate
      ? new Date(args.startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const performanceData = await lighthouse.getPerformanceData(
      portfolio.slug,
      startDate.toISOString().split("T")[0]
    );

    return {
      content: [
        {
          type: "text",
          text: `# ${portfolio.name} Performance Data
          Timeframe: ${performanceData.startsAt} - ${performanceData.endsAt}
          Period Return: ${formatNumber(
            performanceData.usdValueChange
          )} (${formatPercentage(
            (performanceData.usdValueChange /
              performanceData.lastSnapshotUsdValue) *
              100
          )})
          ----
          Performance by asset type:
          ${performanceData.changeByType
            .sort((a, b) => b.diffUsdValue - a.diffUsdValue)
            .map((asset) => {
              return `- ${asset.type}: ${formatNumber(
                asset.diffUsdValue
              )} (${formatPercentage(
                asset.prevUsdValue / asset.currUsdValue
              )}%)`;
            })
            .join("\n")}
          ----
          Top 5 Gainers:
          ${performanceData.gainers
            .sort((a, b) => b.diffUsdValue - a.diffUsdValue)
            .slice(0, 5)
            .map((gainer) => {
              return `- ${gainer.symbol}: ${formatNumber(
                gainer.diffUsdValue
              )} (${formatPercentage(
                gainer.diffUsdValue / gainer.prevUsdValue
              )}%)`;
            })
            .join("\n")}
          ----
          Top 5 Losers:
          ${performanceData.losers
            .sort((a, b) => a.diffUsdValue - b.diffUsdValue)
            .slice(0, 5)
            .map((loser) => {
              return `- ${loser.symbol}: ${formatNumber(
                loser.diffUsdValue
              )} (${formatPercentage(
                loser.diffUsdValue / loser.prevUsdValue
              )}%)`;
            })
            .join("\n")}
          `,
        },
      ],
    };
  },
});

// Create and initialize the Lighthouse client
const lighthouse = new Lighthouse();

// Initialize the Lighthouse client before starting the server
(async () => {
  await lighthouse.initialize();
  console.log("Lighthouse initialized");

  server.start({
    transportType: "stdio",
  });
})();

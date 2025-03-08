/// Response from the Lighthouse API /latest endpoint
// https://lighthouse.one/v1/workspaces/neckbeard-ido/snapshots/latest
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { scriptName, version } from "./index.js";

// Base Interfaces - Common properties
interface BasePlatform {
  id: string;
  name: string;
  logoUrl: string;
  slug?: string; // Slug is optional as it might not be always present
}

interface BaseNetwork {
  id: string;
  name: string;
  logoUrl: string;
}

interface BaseAccount {
  id: string;
  name: string;
}

interface BaseAsset {
  id: string;
  symbol: string;
  name: string;
  logoUrl: string | null; // logoUrl can be null in some cases
  type: string; // Keeping as string for flexibility, can be made into a more specific enum if needed
  price?: number; // Price is optional as it's not always present in BaseAsset, but in derived interfaces
}

interface BaseSnapshot {
  id: string;
  timestamp: string;
  value: number;
}

interface BaseTimeRangePresets {
  "1d": string | null;
  "7d": string | null;
  "30d": string | null;
  "90d": string | null;
}

interface BaseGainerLoserItem {
  id: string;
  symbol: string;
  logoUrl: string;
  type: string;
  currAmount: number;
  currPrice: number;
  currUsdValue: number;
  prevAmount: number;
  prevPrice: number;
  prevUsdValue: number;
  diffUsdValue: number;
}

interface BaseChangeByTypeItem {
  type: string;
  currUsdValue: number;
  prevUsdValue: number;
  diffUsdValue: number;
}

// Interfaces for PortfolioLatestResponse - Lighthouse API /latest endpoint
export interface PortfolioLatestResponse {
  id: string;
  status: string;
  usdValue: number;
  takenAt: string;
  finishedAt: string;
  accounts: {
    [accountId: string]: Account;
  };
  networks: {
    [networkId: string]: Network;
  };
  platforms: {
    [platformId: string]: Platform;
  };
  positions: Position[];
  nftCollections: {
    [collectionId: string]: NftCollection;
  };
}

export interface Account extends BaseAccount {
  type: string;
}

export interface Network extends BaseNetwork {}

export interface Platform extends BasePlatform {
  slug?: string; // Make slug optional here if it's not always present in this context
}

export interface Position {
  id: string;
  type: string;
  ref: string;
  usdValue: number;
  assets: LighthouseAsset[]; // Renamed to avoid conflict and clarify context
  accountId: string;
  networkId: string;
  platformId: string;
  customPosition: null;
  healthFactor: HealthFactor | null;
}

export interface LighthouseAsset extends BaseAsset {
  // Renamed to avoid conflict and clarify context
  logoUrl: string | null;
  context: string;
  amount: number;
  price: number;
  usdValue: number;
  ids: {
    [idName: string]: string;
  };
  collectionId?: string; // Optional, only for NFT type
}

export interface HealthFactor {
  value: number;
  method: string;
}

export interface NftCollection {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  ids: {
    [idName: string]: string;
  };
}

export interface UserResponse {
  user: {
    id: string;
    portfolios: {
      id: string;
      name: string;
      role: string;
      slug: string;
    }[];
  };
}

// Interfaces for Yield Data - Based on your first request
enum AssetTypeEnum { // Renamed to avoid conflict with interface name
  STABLECOIN = "STABLECOIN",
  ETH_EQUIVALENT = "ETH_EQUIVALENT",
  POOL = "POOL",
  NATIVE = "NATIVE",
}

enum PoolItemTypeEnum { // Renamed to avoid conflict with interface name
  NATIVE = "NATIVE",
  POOL = "POOL",
}

export interface YieldAsset extends BaseAsset {
  // Using BaseAsset and extending it with price
  logoUrl: string; // logoUrl is not nullable here based on your example
  price: number;
  type: AssetTypeEnum;
}

interface SupplyElement {
  asset: YieldAsset;
  amount: number;
}

interface ReceiveElement {
  asset: YieldAsset;
  apy: number;
  type: PoolItemTypeEnum;
}

interface BorrowElement {
  asset: YieldAsset;
  amount: number;
}

interface PayElement {
  asset: YieldAsset;
  apy: number;
  type: PoolItemTypeEnum;
}

export interface Pool {
  // Renamed from YieldPool to Pool as it seems to represent the same concept
  platform: Platform; // Using Platform interface here, assuming platform info is consistent
  network: Network; // Using Network interface here, assuming network info is consistent
  account: BaseAccount; // Using BaseAccount, as 'type' is not present in your example
  name: string;
  supply: SupplyElement[];
  receive: ReceiveElement[];
  borrow: BorrowElement[];
  pay: PayElement[];
}

export interface YieldResponse {
  // Renamed from YieldResponse to ApiResponse
  pools: Pool[];
  platforms: Platform[]; // Using Platform interface here
}

// Interfaces for PortfolioPerformanceResponse - Based on your second request
export interface PortfolioPerformanceResponse {
  startsAt: string;
  endsAt: string;
  presets: TimeRangePresets; // Reusing TimeRangePresets
  usdValueChange: number;
  lastSnapshotUsdValue: number;
  snapshots: Snapshot[]; // Reusing Snapshot
  gainers: GainerLoserItem[]; // Reusing GainerLoserItem
  losers: GainerLoserItem[]; // Reusing GainerLoserItem
  changeByType: ChangeByTypeItem[]; // Reusing ChangeByTypeItem
}

export interface TimeRangePresets extends BaseTimeRangePresets {}
export interface Snapshot extends BaseSnapshot {}
export interface GainerLoserItem extends BaseGainerLoserItem {}
export interface ChangeByTypeItem extends BaseChangeByTypeItem {}

export class Lighthouse {
  private sessionCookie: string | null = null;
  private sessionFile: string;

  constructor(sessionFilePath?: string) {
    // If no session file path is provided, use the default location
    if (!sessionFilePath) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      this.sessionFile = path.join(__dirname, ".lighthouse_session");
    } else {
      this.sessionFile = sessionFilePath;
    }
  }

  private async fetcher(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Cookie: `lh_session=${this.sessionCookie}`,
        "User-Agent": `${scriptName}/${version}`,
      },
    });

    return response;
  }

  /**
   * Initialize the session from the session file
   */
  public async initialize(): Promise<void> {
    this.sessionCookie = await this.loadSession();
  }

  /**
   * Get the current session cookie
   */
  public getSessionCookie(): string | null {
    return this.sessionCookie;
  }

  /**
   * Check if the user is authenticated
   */
  public isAuthenticated(): boolean {
    return this.sessionCookie !== null;
  }

  /**
   * Load session from file
   */
  private async loadSession(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.sessionFile, "utf-8");
      return data.trim() || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save session to file
   */
  private async saveSession(cookie: string | null): Promise<void> {
    if (cookie) {
      await fs.writeFile(this.sessionFile, cookie, "utf-8");
    } else {
      try {
        await fs.unlink(this.sessionFile);
      } catch (error) {
        // Ignore error if file doesn't exist
      }
    }
  }

  /**
   * Authenticate with Lighthouse using a transfer token URL
   */
  public async authenticate(
    url: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Extract token from URL
      const parsedUrl = new URL(url);
      const token = parsedUrl.searchParams.get("token");

      if (!token) {
        return { success: false, message: "No token found in URL" };
      }

      // Make the login request
      // Use the native fetch function to avoid cookie application
      const response = await fetch("https://lighthouse.one/v1/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/vnd.api+json",
          "User-Agent": `${scriptName}/${version}`,
          body: JSON.stringify({
            type: "TRANSFER_TOKEN",
            token: token,
          }),
        },
      });

      if (!response.ok) {
        throw new Error(`Login failed with status ${response.status}`);
      }

      // Extract and store the session cookie
      const cookies = response.headers.get("set-cookie");
      if (cookies) {
        const sessionCookieMatch = cookies.match(/lh_session=([^;]+)/);
        if (sessionCookieMatch) {
          this.sessionCookie = sessionCookieMatch[1];
          // Save the session cookie to file
          await this.saveSession(this.sessionCookie);
          return {
            success: true,
            message: "Successfully authenticated with Lighthouse",
          };
        }
      }

      throw new Error("No session cookie found in response");
    } catch (error: any) {
      // Clear session cookie on error
      this.sessionCookie = null;
      await this.saveSession(null);
      return {
        success: false,
        message: `Authentication failed: ${error.message}`,
      };
    }
  }

  /**
   * Logout and clear the session
   */
  public async logout(): Promise<void> {
    this.sessionCookie = null;
    await this.saveSession(null);
  }

  /**
   * Get user data including portfolios
   */
  public async getUserData(): Promise<UserResponse> {
    if (!this.sessionCookie) {
      throw new Error("Not authenticated. Please authenticate first.");
    }

    const response = await this.fetcher("https://lighthouse.one/v1/user");

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * List all portfolios
   */
  public async listPortfolios(): Promise<string[]> {
    const userData = await this.getUserData();
    return userData.user.portfolios.map((p) => p.name);
  }

  /**
   * Find a portfolio by name or partial match
   */
  public async findPortfolio(
    portfolioName?: string
  ): Promise<{ slug: string; name: string }> {
    const userData = await this.getUserData();

    if (userData.user.portfolios.length <= 0) {
      throw new Error("The user has no portfolios. Please create one.");
    }

    // If no portfolio name provided, return the first one
    if (!portfolioName) {
      return {
        slug: userData.user.portfolios[0].slug,
        name: userData.user.portfolios[0].name,
      };
    }

    // Try exact match first
    const exactMatch = userData.user.portfolios.find(
      (p) => p.name.toLowerCase() === portfolioName.toLowerCase()
    );

    if (exactMatch) {
      return { slug: exactMatch.slug, name: exactMatch.name };
    }

    // Try partial match
    const partialMatch = userData.user.portfolios.find((p) =>
      p.name.toLowerCase().includes(portfolioName.toLowerCase())
    );

    if (partialMatch) {
      return { slug: partialMatch.slug, name: partialMatch.name };
    }

    // No match found
    throw new Error(
      `Portfolio "${portfolioName}" not found. Available portfolios: ${userData.user.portfolios
        .map((p) => p.name)
        .join(", ")}`
    );
  }

  /**
   * Get portfolio data by slug
   */
  public async getPortfolioData(
    portfolioSlug: string
  ): Promise<PortfolioLatestResponse> {
    if (!this.sessionCookie) {
      throw new Error("Not authenticated. Please authenticate first.");
    }

    const response = await this.fetcher(
      `https://lighthouse.one/v1/workspaces/${portfolioSlug}/snapshots/latest`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get yield data for a portfolio
   */
  public async getYieldData(portfolioSlug: string): Promise<YieldResponse> {
    if (!this.sessionCookie) {
      throw new Error("Not authenticated. Please authenticate first.");
    }

    const response = await this.fetcher(
      `https://lighthouse.one/v1/workspaces/${portfolioSlug}/yields`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get performance data for a portfolio
   */
  public async getPerformanceData(
    portfolioSlug: string,
    startDate: string
  ): Promise<PortfolioPerformanceResponse> {
    const response = await this.fetcher(
      `https://lighthouse.one/v1/workspaces/${portfolioSlug}/performance?startsAt=${startDate}`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
  }
}

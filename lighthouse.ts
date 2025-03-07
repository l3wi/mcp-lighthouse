/// Response from the Lighthouse API /latest endpoint
// https://lighthouse.one/v1/workspaces/neckbeard-ido/snapshots/latest

export interface ApiResponse {
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

export interface Account {
  id: string;
  name: string;
  type: string;
}

export interface Network {
  id: string;
  name: string;
  logoUrl: string;
}

export interface Platform {
  id: string;
  name: string;
  logoUrl: string;
}

export interface Position {
  id: string;
  type: string;
  ref: string;
  usdValue: number;
  assets: Asset[];
  accountId: string;
  networkId: string;
  platformId: string;
  customPosition: null;
  healthFactor: HealthFactor | null;
}

export interface Asset {
  id: string;
  name: string;
  symbol: string;
  logoUrl: string | null;
  context: string;
  amount: number;
  price: number;
  type: string;
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

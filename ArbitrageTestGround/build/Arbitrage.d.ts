import { BigNumber, Contract, Wallet } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { EthMarket } from "./EthMarket";
export interface CrossedMarketDetails {
    profit: BigNumber;
    volume: BigNumber;
    tokenAddress: string;
    buyFromMarket: EthMarket;
    sellToMarket: EthMarket;
}
export declare type MarketsByToken = {
    [tokenAddress: string]: Array<EthMarket>;
};
export declare function getBestCrossedMarket(crossedMarkets: Array<EthMarket>[], tokenAddress: string): CrossedMarketDetails | undefined;
export declare class Arbitrage {
    private flashbotsProvider;
    private bundleExecutorContract;
    private executorWallet;
    constructor(executorWallet: Wallet, flashbotsProvider: FlashbotsBundleProvider, bundleExecutorContract: Contract);
    static printCrossedMarket(crossedMarket: CrossedMarketDetails): void;
    evaluateMarkets(marketsByToken: MarketsByToken): Promise<Array<CrossedMarketDetails>>;
    takeCrossedMarkets(bestCrossedMarkets: CrossedMarketDetails[], blockNumber: number, minerRewardPercentage: number): Promise<void>;
}

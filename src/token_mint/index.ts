import WebSocket from 'ws';
import ethers from 'ethers';
import type { providers, Signer, BigNumber } from 'ethers';
import { FlashbotsBundleProvider, FlashbotsBundleResolution } from '@flashbots/ethers-provider-bundle';
import type { FlashbotsBundleTransaction } from '@flashbots/ethers-provider-bundle';
import { logError, logInfo, logSuccess, logWarn } from "../utils/log";
import { promiseAll } from "../utils/concurrency";
import { doWithConfig } from '../utils/config';
import * as Lodash from "../utils/lodash";

interface PayloadData {
  abi: Array<string>;
  // mint function
  func: string;
  // mint function params
  payload: Array<any>;
}
interface OriginData {
  // support origin input data
  data: string;
}
interface InputData {
  input: PayloadData | OriginData;
  // mint price, ether
  price: string | number;
}

interface GAS {
  // EIP-1559, gwei
  maxPriorityFeePerGas: number;
  maxFeePerGas: number;
  gasLimit?: number;
}

interface SingleTransaction extends InputData, GAS {
  contract: string;
  // wallet secret
  secret: string;
}

interface ListenPool {
  // JSON RPC interface
  wss: string;
  // RPC subscribe message
  subscribe: string;
  // the attribute chain of the response message to get tx
  txChain: string;
  // support listening the corresponding contract and input data
  contract: string;
  // match input data
  input: PayloadData | OriginData;
}

interface Config {
  defaultProvider?: Array<any>;
  RPCProvider?: Array<any>;
  bundles: Array<SingleTransaction>;
  // use flashbot bundle
  flashbot?: boolean;
  // send bundle at special block
  blockNumber?: number;
  // send bundle after latest block
  blockNumberInFuture?: number;
  // listen mempool pending tx 
  listenPool?: ListenPool;
  // flashbot bundle simulate
  debug?: boolean;
  // flashbot network endpoint
  endpoint?: string;
};

const _N = "\n";
const signerStore: Record<string, Signer> = {};
let bundleStore: Array<FlashbotsBundleTransaction> = [];
let provider: providers.BaseProvider | providers.StaticJsonRpcProvider = null;
let flashbot: FlashbotsBundleProvider = null;
let pendingTx: string = '';
let MINT_FLAG: boolean = false;
let config = {} as Config;

function cookedInputData(input: PayloadData | OriginData): string {
  if ((<OriginData>input)?.data) {
    return (<OriginData>input)?.data;
  } else {
    const iface = new ethers.utils.Interface((<PayloadData>input)?.abi);
    return iface.encodeFunctionData((<PayloadData>input)?.func, (<PayloadData>input)?.payload);
  }
}

async function checkSimulation (signedBundle: Array<string>): Promise<BigNumber> {
  const simulationResponse = await flashbot.simulate(signedBundle, "latest");

  if ("results" in simulationResponse) {
    let msg = '';
    simulationResponse?.results?.forEach((tx, i) => {
      if ("error" in tx) {
        msg += `${
          _N}  TX #${i} : ${tx?.error}${
          _N}  Reason: ${tx?.revert}${
          _N}  Metadata: ${JSON.stringify(tx, null, 4)}
        `;
      }
    });

    if (msg?.length) {
      throw new Error(msg);
    }
    if (simulationResponse?.coinbaseDiff?.eq?.(0)) {
      throw new Error("Does not pay coinbase");
    }

    const gasUsed = simulationResponse?.results?.reduce?.(
      (acc: number, tx) => acc + tx.gasUsed,
      0
    );
    const gasPrice = simulationResponse?.coinbaseDiff?.div?.(gasUsed);
    return gasPrice;
  }

  throw new Error(`${
    _N}  Similuation failed, error code: ${simulationResponse?.error?.code}${
    _N}  ${simulationResponse?.error?.message}
  `);
}

async function sendBundle(signedBundle: Array<string>) {
  let blockNumber = config?.blockNumber;
  if (!blockNumber) {
    const block = await provider.getBlock("latest");
    blockNumber = block.number + (config?.blockNumberInFuture || 1);
  }
  logInfo("Send bundle at block: ", blockNumber);
  const bundleReceipt = await flashbot.sendRawBundle(
    pendingTx ? [pendingTx, ...signedBundle] : signedBundle,
    blockNumber
  );

  if ('error' in bundleReceipt) {
    throw new Error(bundleReceipt?.error?.message)
  }

  const bundleResolution = await bundleReceipt.wait();
  if (bundleResolution === FlashbotsBundleResolution.BundleIncluded) {
    logSuccess("Mint bundle successful with flash bot, Block number: ", blockNumber);
    if (config?.debug) {
      logInfo(JSON.stringify(bundleReceipt, null, 2));
    }
  } else if (bundleResolution === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
    logWarn("Block passed: ", blockNumber);
    logWarn("Restart mint...");
    return sendBundle(signedBundle);
  } else if (bundleResolution === FlashbotsBundleResolution.AccountNonceTooHigh) {
    logWarn("Listen tx has been minted");
    logWarn("Restart mint...");
    pendingTx = '';
    return sendBundle(signedBundle);
  }
}

async function dealWithBundle() {
  try {
    const toSend = bundleStore;
    bundleStore = [];

    logInfo('Start mint...');
    if (config?.flashbot) {
      const signedBundle = await flashbot?.signBundle?.(toSend);

      if (config?.debug) {
        const simulatedGasPrice = await checkSimulation(signedBundle);
        logInfo(`Simulate gasPrice: ${ethers.utils.formatUnits(simulatedGasPrice, 'gwei')} gwei`);
      }

      await sendBundle(signedBundle);
    } else {
      toSend?.forEach?.(async ({ signer, transaction }) => {
        const res = await signer?.sendTransaction?.(transaction);
        const info = await res?.wait?.();
        logSuccess("Mint success: ", info?.transactionHash);
        if (config?.debug) {
          logInfo(JSON.stringify(info, null, 2))
        }
      })
    }
  } catch(err) {
    logError("Send flashbot bundle abort: ", err);
  }
}

async function mint(info: SingleTransaction): Promise<void> {
  try {
    let wallet = signerStore[info?.secret];
    if (!wallet) {
      wallet = signerStore[info?.secret] = new ethers.Wallet(info.secret, provider);
    }

    const { chainId } = await provider.getNetwork();
    const transactionRequest = {
      chainId,
      to: info?.contract,
      data: cookedInputData(info?.input),
      value: ethers.utils.parseUnits(String(info?.price), 'ether'),
      type: 2,
      gasLimit: info?.gasLimit,
      maxPriorityFeePerGas: ethers.utils.parseUnits(String(info?.maxPriorityFeePerGas), 'gwei'),
      maxFeePerGas: ethers.utils.parseUnits(String(info?.maxFeePerGas), 'gwei'),
    }

    bundleStore.push({
      signer: wallet,
      transaction: transactionRequest
    });
  } catch(err) {
    logError("Get mint info fail: ", err);
    logWarn("Mint contract address: ", info?.contract);
    logWarn("Mint wallet secret: ", info?.secret);
  }
}

async function runFlashBot(conf) {
  try {
    config = conf;
    if (config?.RPCProvider?.length) {
      // Standard json rpc provider directly from ethers.js. For example you can use Infura, Alchemy, or your own node.
      provider = new ethers.providers.StaticJsonRpcProvider(...config?.RPCProvider);
    } else {
      provider = ethers.getDefaultProvider(...config?.defaultProvider);
    }

    if (config?.flashbot) {
      // Flashbots provider requires passing in a standard provider and an auth signer
      flashbot = await FlashbotsBundleProvider.create(provider, ethers.Wallet.createRandom(), config?.endpoint)
    }

    if (config?.listenPool) {
      const pool = config?.listenPool;
      const ws = new WebSocket(pool?.wss);

      ws.on('open', () => {
        ws.send(pool?.subscribe);
      });
      ws.on('message', async (data: string) => {
        try {
          if (MINT_FLAG) {
            return;
          }

          const o = JSON.parse(data);
          const tx = Lodash.get(o, pool?.txChain);
    
          if (tx) {
            const tran = await provider.getTransaction(tx);
    
            if (tran?.to === pool?.contract) {
              const data = cookedInputData(pool?.input);
              if (data === tran?.data) {
                MINT_FLAG = true;
                const { r, s, v } = tran;
                const signature = { r, s, v };
                pendingTx = ethers.utils.serializeTransaction(tran, signature);
                await dealWithBundle();
                ws.close();
                MINT_FLAG = false;
              }
            }
          }
        } catch(err) {
          logError('Wrong parse response: ', err);
        }
      });
    }

    await promiseAll(config?.bundles, mint, 10);

    if (bundleStore?.length && (!config?.listenPool || pendingTx)) {
      await dealWithBundle();
    }
  } catch(err) {
    logError('Exec mint crash: ', err);
  }
}

doWithConfig(runFlashBot);

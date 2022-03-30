import ethers from 'ethers';
import chalk from 'chalk';
import { doWithConfig } from '../utils/config';
import { logError, logInfo, logSuccess, logWarn } from '../utils/log';
import { promiseAll } from "../utils/concurrency";
import { sleep } from '../utils/sleep';

interface SwapInfo {
  // swap factory contract address
  factory: string;
  // swap router contract address
  router: string;
  // token send contract address
  tokenSend: string;
  // token receive contract address
  tokenReceive: string;
  // token send amount
  amountSend: string | number;
  // token receive MIN amount to swap
  amountReceiveMIN?: string | number;
  // tokenReceive min liquidity added to swap
  liquidityMIN?: string | number;
  // approve swap balance, default Infinity
  approveMIN?: string | number;
  gasLimit?: number;
  // gwei
  gasPrice?: string | number;
  // listen time interval, default 1s
  interval?: string | number;
}

interface Config {
  // use provider for getting the number of transactions
  defaultProvider?: Array<any>;
  RPCProvider?: Array<any>;
  // wallet secret
  secret: string;
  // token infos
  infos: Array<SwapInfo>;
};

const liquidABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)'
];
const routerABI = [
  'function getAmountsOut(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountOut, uint amountInMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
];
const tokenABI = [
  'function symbol() external view returns (string memory)',
  'function decimals() external view returns (uint8)',
  'function balanceOf(address owner) external view returns (uint)',
  'function allowance(address account, address spender) external view returns (uint)',
  'function approve(address guy, uint wad) public returns (bool)',
]

let provider, wallet: ethers.ethers.Wallet, config: Config;

async function swap(info: SwapInfo) {
  try {
    const tokenSend = new ethers.Contract(info?.tokenSend, tokenABI, wallet);
    const sendSymbol = await tokenSend?.symbol?.();
    const sendDecimal = await tokenSend?.decimal?.();

    const tokenReceive = new ethers.Contract(info?.tokenReceive, tokenABI, wallet);
    const receiveSymbol = await tokenReceive?.symbol?.();
    const receiveDecimal = await tokenReceive?.decimal?.();

    const router = new ethers.Contract(info?.router, routerABI, wallet);
    const [_, amountReceive] = await router.getAmountsOut(
      ethers.utils.parseUnits(String(info?.amountSend), sendDecimal),
      [info?.tokenSend, info?.tokenReceive]
    );
    const amountReceiveFormat = ethers.utils.formatUnits(amountReceive, receiveDecimal);

    if (!info?.amountReceiveMIN || parseFloat(String(amountReceiveFormat)) >= parseFloat(String(info?.amountReceiveMIN))) {
      logInfo(`TokenReceive min balance: ${chalk.green(amountReceiveFormat, receiveSymbol)}. Ready to buy...`);
      logInfo('===========================');
      logInfo(`address: ${wallet?.address}`);
      logInfo(`tokenSend: ${chalk.green(info?.amountSend, sendSymbol)}`);
      logInfo(`tokenReceiveMin: ${chalk.green(amountReceiveFormat, receiveSymbol)}`);
      logInfo(`gasLimit: ${info?.gasLimit}`);
      logInfo(`gasPrice: ${info?.gasPrice}`);
      logInfo('===========================');

      const allowance = await tokenSend?.allowance?.(wallet?.address, info?.router);
      const allowanceFormat = ethers.utils.formatUnits(allowance, sendDecimal);
      const approveAmount = info?.approveMIN ?? ethers.constants.MaxUint256;
      if (parseFloat(allowanceFormat) < parseFloat(String(info?.amountSend))) {
        logInfo(`Approve swap router for operating ${chalk.green(approveAmount, sendSymbol)} balance`);
        const approveTx = await tokenSend?.approve?.(info?.router, approveAmount);
        await approveTx.wait();
      }

      const GAS = {
        gasLimit: info?.gasLimit ?? 300000,
      };
      if (info?.gasPrice) {
        GAS.gasPrice = ethers.utils.parseUnits(String(info?.gasPrice), 'gwei');
      }

      const tx = await router?.swapExactTokensForTokensSupportingFeeOnTransferTokens?.(
        ethers.utils.parseUnits(String(info?.amountSend), sendDecimal),
        ethers.utils.parseUnits(String(info?.amountReceiveMIN), receiveDecimal),
        [info?.tokenSend, info?.tokenReceive],
        wallet?.address,
        // 5 minutes
        Date.now() + 1000 * 60 * 5,
        GAS
      );
      const receipt = await tx.wait();
      logSuccess(`Transaction receipt: ${receipt.logs[1].transactionHash}`);
    } else {
      logWarn(`TokenReceive amount: ${chalk.green(amountReceiveFormat, receiveSymbol)}, less than: ${chalk.green(info?.amountReceiveMIN, receiveSymbol)}. Auto restart...`);
      await sleep((parseFloat(String(info?.interval ?? 1)) * 1000));
      return await listen(info);
    }
  } catch(err) {
    logError("Swap token error:", err);
    logInfo("Auto restart...");
    await sleep((parseFloat(String(info?.interval ?? 1)) * 1000));
    return await swap(info);
  }
}

async function listen(info: SwapInfo) {
  if (info?.factory) {
    try {
      const liquid = new ethers.Contract(info?.factory, liquidABI, wallet);
      logInfo(`Check liquid: { ${info?.tokenSend} -> ${info?.tokenReceive} }`);

      const pairAddress = await liquid?.getPair?.(info?.tokenSend, info?.tokenReceive);

      if (pairAddress === ethers.constants.AddressZero) {
        logWarn(`Token liquid not detected in ${info?.factory}. Auto restart...`);
      } else {
        logInfo(`Token liquid found at ${pairAddress}.`);
        const tokenReceive = new ethers.Contract(info?.tokenReceive, tokenABI, wallet);
        const pairAddressBalance = await tokenReceive?.balanceOf?.(pairAddress);
        const tokenSymbol = await tokenReceive?.symbol?.();
        const tokenDecimal = await tokenReceive?.decimal?.();
        const tokenBalance = ethers.utils.formatUnits(pairAddressBalance, tokenDecimal);

        if (!info?.liquidityMIN || parseFloat(String(tokenBalance)) >= parseFloat(String(info?.liquidityMIN))) {
          logInfo(`Liquid available balance found: ${chalk.green(tokenBalance, tokenSymbol)}`);
          return await swap(info);
        } else {
          logWarn(`Liquid balance: ${chalk.green(tokenBalance, tokenSymbol)}, less than: ${chalk.green(info?.liquidityMIN, tokenSymbol)}. Auto restart...`);
        }
      }

      await sleep((parseFloat(String(info?.interval ?? 1)) * 1000));
      return await listen(info);
    } catch(err) {
      logError("Listen token liquid error:", err);
    }
  } else {
    return await swap(info);
  }
}


async function init(conf): Promise<void> {
  config = conf;
  if (config?.RPCProvider?.length) {
    provider = new ethers.providers.StaticJsonRpcProvider(...config?.RPCProvider);
  } else {
    provider = ethers.getDefaultProvider(...config?.defaultProvider);
  }

  wallet = new ethers.Wallet(config?.secret, provider);
  logSuccess(`Wallet connected: ${wallet?.address}`);

  await promiseAll(config?.infos, listen, 5);
}

doWithConfig(init);

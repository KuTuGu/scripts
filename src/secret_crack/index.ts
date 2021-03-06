import ethers from 'ethers';
import path from 'path';
import fs from 'fs';
import axios from "axios";
import { doWithConfig } from '../utils/config';
import { logError, logInfo, logSuccess } from '../utils/log';
import { promiseAll } from "../utils/concurrency";

interface Config {
  // use provider for getting the number of transactions
  defaultProvider?: Array<any>;
  RPCProvider?: Array<any>;
  // use entry not provider for multiCall balance roughly
  multiCallEntry?: string;
  // up to x addresses per call, only for multiCall
  addrPerCall?: number;
  // total call count
  callCount?: number;
  // concurrency limit
  limit?: number;
};

let provider, config;
let count = 0;

const base = '0123456789abcdef';
const secretLen = 64;
function randomString(): string {
  let res = '';

  for (let i = 1;i <= secretLen;i++) {
    res += base.charAt(Math.floor(Math.random() * base?.length));
  }
  return res;
}

async function getRandomAddr(): Promise<[string, string]> {
  const secret = randomString();
  const wallet = new ethers.Wallet(secret);

  return [await wallet?.getAddress?.(), secret];
}

async function singleCheck(): Promise<string> {
  const [addr, secret] = await getRandomAddr();
  const nonce = await provider.getTransactionCount(addr);

  if (nonce > 0) {
    return `${addr} ${secret} ${await provider.getBalance(addr)}`;
  }
}

async function multiCheck(): Promise<string> {
  const KVmap = {};
  const res = []

  for (let i = 1;i <= (config?.addrPerCall || 20);i++) {
    const [addr, secret] = await getRandomAddr();
    KVmap[addr] = secret;
  }

  const resp = await axios?.get?.(config?.multiCallEntry + Object?.keys?.(KVmap)?.join(','), {
    headers: {
      "content-type": "application/json"
    }
  });
  resp?.data?.result?.forEach?.(({ account, balance }) => {
    if (parseFloat(balance) > 0) {
      res.push(`${account} ${KVmap[account]} ${balance}`);
    }
  })

  return res?.join?.('\n');
}


async function crack(): Promise<void> {
  count++;
  if (config?.callCount && count > config?.callCount) {
    return;
  }

  try {
    const res = await (config?.multiCallEntry ? multiCheck() : singleCheck());

    if (res?.length) {
      logSuccess('My god, you get it!');

      const file = path.join(__dirname, 'out.log')
      fs.writeFileSync(file, res + '\n', { encoding: 'utf8', flag: 'a' });
      logInfo(`Save info at ${file}`);
    }
  } catch(err) {
    logError('Error: ', err);
  }

  return crack();
}

async function init(conf: Config): Promise<void> {
  config = conf;
  if (config?.RPCProvider?.length) {
    provider = new ethers.providers.StaticJsonRpcProvider(...config?.RPCProvider);
  } else if (config?.defaultProvider?.length) {
    provider = ethers.getDefaultProvider(...config?.defaultProvider);
  }

  const limit = config?.limit || 5;
  await promiseAll(new Array(limit), crack, limit);

  logInfo('Game over.');
}

doWithConfig(init);

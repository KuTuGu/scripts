## Introduce

Listen token price and mint.

**NOTE**

Be careful to send too many tx in parallel, which will cause nonce coverage problems.

Protect your funds, **At your own risk**.
     
## How to use
    
add a config.json:
```ts
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
```

```bash
npm i
npm run listen <path-to-config>    
npm run listen:build
```


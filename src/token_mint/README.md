## Introduce
    
**Learning version, not suitable for production environment.**  

Token mint script directly or by flashbot bundle.      
      
Protect your funds, **At your own risk**.    
     
## How to use
    
add a config.json:
```ts
{
  defaultProvider?: Array<any>;
  RPCProvider?: Array<any>;
  bundles: Array<{
    contract: string;
    // wallet secret
    secret: string;
    input: {
      abi?: Array<string>;
      // mint function
      func?: string;
      // mint function params
      payload?: Array<any>;
      // support origin input data
      data?: string;
    }
    // mint price, ether
    price: string | number;
    // EIP-1559, gwei
    maxPriorityFeePerGas: number;
    maxFeePerGas: number;
    gasLimit?: number;
  }>;
  // use flashbot bundle
  flashbot?: boolean;
  // send bundle at special block
  blockNumber?: number;
  // send bundle after latest block
  blockNumberInFuture?: number;
  // listen mempool pending tx
  listenPool?: {
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
  // flashbot bundle simulate
  debug?: boolean;
  // flashbot network endpoint
  endpoint?: string;
};
```

```bash
npm i
npm run mint <path-to-config>    
npm run mint:build
```


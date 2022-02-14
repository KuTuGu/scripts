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
    abi?: Array<string>;
    // mint function
    func?: string;
    // mint function params
    payload?: Array<any>;
    // support origin input data
    data?: string;
    // mint price, ether
    price: string | number;
    // EIP-1559, gwei
    maxPriorityFeePerGas: number;
    maxFeePerGas: number;
    gasLimit?: number;
  }>;
  // use flashbot bundle
  flashbot?: boolean;
  // bundle tx mount
  limit?: number;
  // send bundle at special block
  blockNumber?: number;
  // send bundle after latest block
  blockNumberInFuture?: number;
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


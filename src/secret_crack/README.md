## Introduce
    
The most powerful hacker with just the simplest tools :)

Free lottery of 64-bit secret key cracking.  
     
## How to use
    
add a config.json:
```ts
{
  defaultProvider?: Array<any>;
  RPCProvider?: Array<any>;
  // use entry not provider for multiCall
  multiCallEntry?: string;
  // up to x addresses per call, only for multiCall
  addrPerCall?: number;
  // total call count
  callCount?: number;
  // concurrency limit
  limit?: number;
};
```

```bash
npm i
npm run crack <path-to-config>    
npm run crack:build
```


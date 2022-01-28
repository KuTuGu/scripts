## Introduce

Discord chat script at low level.    
    
Only stupid chat, no warning detection, no automatic reply, no AI. **At your own risk**.  
Maybe later, or you can expand it freely, welcome PR.  
   
It may have endless bugs, welcome **Quality** issues.    
   
## How to use

add a config.json:
```ts
{
  infos: Array<{
    // use browser, safe
    account?: string;
    password?: string;
    // use API, block risk
    token?: string;
    // server info
    server: string;
    channel: string;
    proxy?: {
      host: string;
      port: string;
    }
    // interval: num * 2 ~ 4s(default)
    interval?: number;
    // only listen, no chat
    listen?: boolean;
    // listen, copy and chat
    copy?: boolean;
    // listen rule
    reg?: Array<string>;
    // chat using browser
    browser?: boolean;
    // open window or not
    headless?: boolean;
  }>;
  messages: Array<string>;
}
```

```bash
npm i    
npm run chat <path-to-config>    
```


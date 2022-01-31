import fs from "fs";
import path from "path";
import puppeteer from 'puppeteer';
import axios from "axios";
import { logSuccess, logError, logInfo } from "../utils/log";
import { getRandomOne, getRandomFactor } from "../utils/random";
import { sleep } from "../utils/sleep";
import { promiseAll } from "../utils/concurrency";
import { doWithConfig } from "../utils/config";

interface Config {
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
}

async function listenOthersMessage(info): Promise<Array<string>> {
	try {
		const url = `https://discord.com/api/v9/channels/${info?.channel}/messages?limit=100`;
		const res = await axios.get(url, {
			headers: {
				"content-type": "application/json",
				"authorization": info?.token,
        "referer": `https://discord.com/channels/${info?.server}/${info?.channel}`,
			},
			proxy: info?.proxy
		})

    const texts = [];
    res?.data?.forEach?.(o => {
      const text = o?.content;

      if (info?.reg) {
        const reg = new RegExp(...info?.reg);
        const arr = reg?.exec?.(text);

        if (arr?.length > 1) {
          arr?.shift?.();
        }

        arr?.forEach?.(t => {
          if (t?.length) {
            texts.push(t);
            messages.add(t);
          }
        });
      } else if (text?.length) {
        texts.push(text);
        messages.add(text);
      }
    })

    return texts;
	} catch (err) {
		logError('Get others message fail: ', err);
	}

	return [];
}

async function doBrowser(info, text: string): Promise<void> {
  try {
    const URI = `${info?.server}/${info?.channel}`;
    pagesStore[URI] = pagesStore[URI] || {};
    let { browser, page } = pagesStore[URI];

    if (!browser) {
      browser = pagesStore[URI].browser = await puppeteer.launch({ headless: info?.headless });
    }
    if (!page) {
      page = pagesStore[URI].page = await browser.newPage();
      await page.bringToFront();
      await page.goto(`https://discord.com/channels/${URI}`);

      await page.focus(`input[name='email']`);
      await page.keyboard.type(info?.account, { delay: getRandomFactor(100, 100) });

      await page.focus(`input[name='password']`);
      await page.keyboard.type(info?.password, { delay: getRandomFactor(200, 200) });

      const submitBtn = await page.$(`button[type='submit']`);
      await submitBtn.click();
      await page.waitForTimeout(getRandomFactor(5000, 5000));
    }

    await page.keyboard.type(text, { delay: getRandomFactor(500, 500) });
    await page.waitForTimeout(getRandomFactor(1000, 1000));
    await page.keyboard.press('Enter');
    logSuccess(`Send message <${text}> success.`);
  } catch(err) {
    logError('Page interact error: ', err);
  }
}

async function sendMessage(info, text: string): Promise<void> {
  if (info?.browser) {
    return await doBrowser(info, text);
  }

  try {
    const url = `https://discord.com/api/v9/channels/${info?.channel}/messages`;
    await axios.post(url,
      { content: text },
      {
        headers: {
          "content-type": "application/json",
          "authorization": info?.token,
          "referer": `https://discord.com/channels/${info?.server}/${info?.channel}`,
        },
        proxy: info?.proxy
      }
    );

    logSuccess(`Send message <${text}> success.`);
	} catch (err) {
		logError(`Send message <${text}> fail: `, err);
	}
}

async function chat(msg: Array<string>, info: Config): Promise<void> {
	let text = '';

  if (info?.listen) {
    await listenOthersMessage(info);
    return;
  }
  if (info?.copy) {
    text = getRandomOne(
      await listenOthersMessage(info)
    );
  } else {
    text = getRandomOne(msg);
  }

	if (text) {
		await sendMessage(info, text);
	}
	await sleep(info?.interval * getRandomFactor(2000, 2000));
}

async function infinite(config) {
  try {
    await promiseAll(config?.infos, chat.bind(null, config?.messages), 5);
  } catch(err) {
    logError('Exec send message fail: ', err);
  }

  return infinite(config);
}

process.on('SIGINT', () => {
  Object.values(pagesStore)?.forEach?.(p => p?.browser?.disconnect?.());

  const msg = Array.from(messages);

  if (msg?.length) {
    const file = path.join(__dirname, 'out.log')
    fs.writeFileSync(file, msg?.map?.(t => `"${t}",\n`)?.join(''), { encoding: 'utf8', flag: 'a' });
    logInfo(`Save others messages at ${file}`);
  }
  process.exit(0);
});

const pagesStore = {};
const messages = new Set();

doWithConfig(infinite);

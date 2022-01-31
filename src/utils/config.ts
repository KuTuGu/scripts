import fs from "fs";
import { logError } from "./log";

export const doWithConfig = (func?: (config: Object) => void, path?: string): Object => {
  const file = path || process?.argv?.[process?.argv?.length - 1];

  try {
    const str = fs.readFileSync(file, 'utf-8');
    const config = JSON.parse(str);

    if (config && func) {
      func?.(config);
    }

    return config;
  } catch(err) {
    logError(`Read config <${file}> fail: `, err);
  }

  return {}
}

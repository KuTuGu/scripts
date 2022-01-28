export async function promiseAll<T>(arr: Array<T>, callback: (p: T) => unknown, limit = 5): Promise<Array<unknown>> {
  const resultArr = [], execArr = [];

  for (let i of arr) {
    const p = Promise.resolve().then(() => callback(i));
    resultArr.push(p);

    const e = p.then(() => execArr.splice(execArr.indexOf(e), 1));
    execArr.push(e);

    if (execArr.length >= limit) {
      await Promise.race(execArr);
    }
  };

  return await Promise.all(resultArr);
}

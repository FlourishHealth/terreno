declare module "ioredis" {
  export default class Redis {
    constructor(url: string);
    incr: (key: string) => Promise<number>;
    pexpire: (key: string, milliseconds: number) => Promise<number>;
    pttl: (key: string) => Promise<number>;
  }
}

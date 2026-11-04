declare module "player.js" {
  type Callback<T = unknown> = (value: T) => void;
  export class Player {
    constructor(elem: HTMLIFrameElement | string);
    on(event: "ready" | "play" | "pause" | "ended", cb: () => void): void;
    on(event: "timeupdate", cb: Callback<{ seconds: number; duration: number }>): void;
    off(event: string, cb?: (...args: unknown[]) => void): void;
    play(): void;
    pause(): void;
    setCurrentTime(seconds: number): void;
    getCurrentTime(cb: Callback<number>): void;
    getDuration(cb: Callback<number>): void;
  }
  const playerjs: { Player: typeof Player };
  export default playerjs;
}

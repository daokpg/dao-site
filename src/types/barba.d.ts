// @barba/core ships typings at a path its package.json does not resolve; this covers what the site uses.
declare module '@barba/core' {
  interface BarbaTransition {
    name?: string;
    once?(data: any): Promise<void> | void;
    leave?(data: any): Promise<void> | void;
    afterLeave?(data: any): void;
    beforeEnter?(data: any): void;
    enter?(data: any): Promise<void> | void;
    afterEnter?(data: any): void;
  }
  interface Barba {
    init(options: { transitions: BarbaTransition[]; preventRunning?: boolean; timeout?: number; prevent?: (args: { el: Element; href: string }) => boolean }): void;
    go(href: string): Promise<void>;
    prefetch(href: string): void;
  }
  const barba: Barba;
  export default barba;
}

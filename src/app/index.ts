// App module: the contracts between modules and the controller that runs the game flow (src/main.ts boots it).
export * from './contracts';
export { App, type AppDeps, type MetaLoader, type Screen } from './controller';
export type { AppUi, SessionHost } from './host';
export { Session, type SessionEnd } from './session';
export { Tutorial, TUTORIAL_TEXT } from './tutorial';
export { Autopilot } from './autoplay';

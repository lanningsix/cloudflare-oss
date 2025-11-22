/// <reference types="@cloudflare/workers-types" />

declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {}
	export const env: ProvidedEnv;
	export const SELF: {
		fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	};
	export function createExecutionContext(): ExecutionContext;
	export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
}

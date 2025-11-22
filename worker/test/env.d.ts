
// Removed /// <reference types="@cloudflare/workers-types" />

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

// Minimal definitions to satisfy tests
interface D1Database {
    prepare(query: string): any;
}
interface R2Bucket {
    put(key: string, value: any): Promise<any>;
    get(key: string): Promise<any>;
}

interface Env {
	DB: D1Database;
	MY_BUCKET: R2Bucket;
}

declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {}
	export const env: ProvidedEnv;
	export const SELF: {
		fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	};
	export function createExecutionContext(): ExecutionContext;
	export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
}

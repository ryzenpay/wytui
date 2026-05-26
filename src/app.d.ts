// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: {
				user?: {
					id: string;
					email?: string;
					name?: string;
					image?: string;
					isAdmin?: boolean;
				};
			} | null;
		}
		interface PageData {
			csrfToken?: string;
			session?: {
				user?: {
					id: string;
					email?: string;
					name?: string;
					image?: string;
					isAdmin?: boolean;
				};
			} | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

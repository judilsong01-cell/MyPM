// Copy to `appwrite.secrets.ts` and fill with your Appwrite project values.
// Never commit the real file.

export const APPWRITE_ENDPOINT = 'https://<REGION>.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = '<YOUR_PROJECT_ID>';

// Appwrite Databases (create these in the Console)
export const APPWRITE_DATABASE_ID = '<YOUR_DATABASE_ID>';
export const APPWRITE_COLLECTIONS = {
  transactions: '<TRANSACTIONS_COLLECTION_ID>',
  debts: '<DEBTS_COLLECTION_ID>',
  products: '<PRODUCTS_COLLECTION_ID>',
} as const;

// Redirect URL used by email verification + OAuth token flows.
// Must match an allowed hostname in your Appwrite project platforms.
// For mobile deep links, prefer an https URL that forwards into the app (Universal Links / App Links).
export const APPWRITE_AUTH_REDIRECT_URL = 'https://example.com/appwrite/auth';
// Alternative (if your Appwrite setup allows deep links directly):
// export const APPWRITE_AUTH_REDIRECT_URL = 'mypme://auth';

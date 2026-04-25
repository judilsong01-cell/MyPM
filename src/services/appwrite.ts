import 'react-native-url-polyfill/auto';

import {
  Account,
  Client,
  Databases,
  ID,
  OAuthProvider,
  Permission,
  Query,
  Role,
} from 'appwrite';

import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from './appwrite.secrets';

export const appwriteClient = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

export const appwriteAccount = new Account(appwriteClient);
export const appwriteDatabases = new Databases(appwriteClient);

export { ID, OAuthProvider, Permission, Query, Role };


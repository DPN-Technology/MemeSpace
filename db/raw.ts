import {openDatabase,adapter} from '@/lib/local-database.mjs';
const local=globalThis as typeof globalThis & {memespaceDatabase?:ReturnType<typeof adapter>;memespaceRawDatabase?:ReturnType<typeof openDatabase>};
export function rawDatabase(){return local.memespaceRawDatabase ??= openDatabase();}
export function database(){return local.memespaceDatabase ??= adapter(rawDatabase());}

import {openDatabase,adapter} from '@/lib/local-database.mjs';
const local=globalThis as typeof globalThis & {memespaceDatabase?:ReturnType<typeof adapter>};
export function database(){return local.memespaceDatabase ??= adapter(openDatabase());}

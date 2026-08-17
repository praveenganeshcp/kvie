import { Injectable } from '@nestjs/common';

@Injectable()
export class KVStoreService {

  private readonly store = new Map<string, unknown>();

  put(key: string, value: unknown) {
    this.store.set(key, value);
  }

  get(key: string) {
    return this.store.get(key);
  }

  delete(key: string) {
    this.store.delete(key);
  }
}

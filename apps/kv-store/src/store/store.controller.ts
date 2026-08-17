import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { KVStoreService } from './store.service';

@Controller()
export class KVStoreController {
  constructor(private readonly storeService: KVStoreService) {}

  @Get(':key')
  getValue(
    @Param('key') key: string
  ) {
    return this.storeService.get(key)
  }

  @Delete(':key')
  deleteKey(
    @Param('key') key: string
  ) {
    return this.storeService.delete(key)
  }

  @Patch()
  putValue(
    @Body('key') key: string,
    @Body('value') value: unknown
  ) {
    return this.storeService.put(key, value)
  }
  
}

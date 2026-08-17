import { Module } from '@nestjs/common';
import { KVStoreController } from './store.controller';
import { KVStoreService } from './store.service';

@Module({
  imports: [],
  controllers: [KVStoreController],
  providers: [KVStoreService],
})
export class KVStoreModule {}

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  getClient() {
    return this.client;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    return this.client.set(key, value, 'EX', ttlSeconds, 'NX');
  }

  async del(key: string) {
    return this.client.del(key);
  }

  async exists(key: string) {
    return this.client.exists(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}

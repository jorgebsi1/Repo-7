import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB } from '../../common/tokens';
import type { Db } from '../../db/client';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async health() {
    await this.db.execute(sql`select 1`);
    return { ok: true };
  }
}

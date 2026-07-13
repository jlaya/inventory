import { Module } from '@nestjs/common';
import { ClosureLogsService } from './closure_logs.service';
import { ClosureLogsController } from './closure_logs.controller';
import { ClosuresController } from './closures.controller';

@Module({
  controllers: [ClosureLogsController, ClosuresController],
  providers: [ClosureLogsService],
})
export class ClosureLogsModule {}

import { Controller, Post, Body } from '@nestjs/common';
import { ClosureLogsService } from './closure_logs.service';

@Controller('closures')
export class ClosuresController {
  constructor(private readonly closureLogsService: ClosureLogsService) {}

  @Post()
  async createClosure(@Body() body: any) {
    return this.closureLogsService.create(body);
  }
}

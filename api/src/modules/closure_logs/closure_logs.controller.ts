import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ClosureLogsService } from './closure_logs.service';
import { CreateClosureLogDto } from './dto/create-closure_log.dto';
import { UpdateClosureLogDto } from './dto/update-closure_log.dto';

@Controller('closure-logs')
export class ClosureLogsController {
  constructor(private readonly closureLogsService: ClosureLogsService) {}

  @Post()
  create(@Body() createClosureLogDto: CreateClosureLogDto) {
    return this.closureLogsService.create(createClosureLogDto);
  }

  @Get()
  findAll() {
    return this.closureLogsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.closureLogsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClosureLogDto: UpdateClosureLogDto) {
    return this.closureLogsService.update(id, updateClosureLogDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.closureLogsService.remove(id);
  }
}

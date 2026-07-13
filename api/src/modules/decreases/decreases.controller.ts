import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DecreasesService } from './decreases.service';
import { CreateDecreaseDto } from './dto/create-decrease.dto';
import { UpdateDecreaseDto } from './dto/update-decrease.dto';

@Controller('decreases')
export class DecreasesController {
  constructor(private readonly decreasesService: DecreasesService) {}

  @Post()
  create(@Body() createDecreaseDto: CreateDecreaseDto) {
    return this.decreasesService.create(createDecreaseDto);
  }

  @Get()
  findAll() {
    return this.decreasesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.decreasesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDecreaseDto: UpdateDecreaseDto) {
    return this.decreasesService.update(id, updateDecreaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.decreasesService.remove(id);
  }
}

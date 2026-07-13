import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DecreaseDetailsService } from './decrease_details.service';
import { CreateDecreaseDetailDto } from './dto/create-decrease_detail.dto';
import { UpdateDecreaseDetailDto } from './dto/update-decrease_detail.dto';

@Controller('decrease-details')
export class DecreaseDetailsController {
  constructor(private readonly decreaseDetailsService: DecreaseDetailsService) {}

  @Post()
  create(@Body() createDecreaseDetailDto: CreateDecreaseDetailDto) {
    return this.decreaseDetailsService.create(createDecreaseDetailDto);
  }

  @Get()
  findAll() {
    return this.decreaseDetailsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.decreaseDetailsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDecreaseDetailDto: UpdateDecreaseDetailDto) {
    return this.decreaseDetailsService.update(+id, updateDecreaseDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.decreaseDetailsService.remove(+id);
  }
}

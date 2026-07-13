import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RequisitionDetailsService } from './requisition_details.service';
import { CreateRequisitionDetailDto } from './dto/create-requisition_detail.dto';
import { UpdateRequisitionDetailDto } from './dto/update-requisition_detail.dto';

@Controller('requisition-details')
export class RequisitionDetailsController {
  constructor(private readonly requisitionDetailsService: RequisitionDetailsService) {}

  @Post()
  create(@Body() createRequisitionDetailDto: CreateRequisitionDetailDto) {
    return this.requisitionDetailsService.create(createRequisitionDetailDto);
  }

  @Get()
  findAll() {
    return this.requisitionDetailsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requisitionDetailsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRequisitionDetailDto: UpdateRequisitionDetailDto) {
    return this.requisitionDetailsService.update(+id, updateRequisitionDetailDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requisitionDetailsService.remove(+id);
  }
}

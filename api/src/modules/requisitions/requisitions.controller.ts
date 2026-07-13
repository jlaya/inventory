import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { Requisition } from './entities/requisition.entity';
import { RequisitionsService } from './requisitions.service';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { UpdateRequisitionDto } from './dto/update-requisition.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  @Post()
  create(@Body() createRequisitionDto: CreateRequisitionDto) {
    return this.requisitionsService.create(createRequisitionDto);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
      }
    })
  }))
  createFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any
  ) {
    return this.requisitionsService.createFromExcel(file, body);
  }

  @Get()
  findAll(@Query('status') status?: Requisition['status']) {
    if (status) {
      return this.requisitionsService.findAllByStatus(status);
    }
    return this.requisitionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.requisitionsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRequisitionDto: UpdateRequisitionDto) {
    return this.requisitionsService.update(+id, updateRequisitionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.requisitionsService.remove(+id);
  }
}

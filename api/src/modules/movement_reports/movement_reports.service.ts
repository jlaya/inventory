import { Injectable } from '@nestjs/common';
import { CreateMovementReportDto } from './dto/create-movement_report.dto';
import { UpdateMovementReportDto } from './dto/update-movement_report.dto';

@Injectable()
export class MovementReportsService {
  create(createMovementReportDto: CreateMovementReportDto) {
    return 'This action adds a new movementReport';
  }

  findAll() {
    return `This action returns all movementReports`;
  }

  findOne(id: number) {
    return `This action returns a #${id} movementReport`;
  }

  update(id: number, updateMovementReportDto: UpdateMovementReportDto) {
    return `This action updates a #${id} movementReport`;
  }

  remove(id: number) {
    return `This action removes a #${id} movementReport`;
  }
}

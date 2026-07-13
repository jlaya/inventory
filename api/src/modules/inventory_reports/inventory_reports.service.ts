import { Injectable } from '@nestjs/common';
import { CreateInventoryReportDto } from './dto/create-inventory_report.dto';
import { UpdateInventoryReportDto } from './dto/update-inventory_report.dto';

@Injectable()
export class InventoryReportsService {
  create(createInventoryReportDto: CreateInventoryReportDto) {
    return 'This action adds a new inventoryReport';
  }

  findAll() {
    return `This action returns all inventoryReports`;
  }

  findOne(id: number) {
    return `This action returns a #${id} inventoryReport`;
  }

  update(id: number, updateInventoryReportDto: UpdateInventoryReportDto) {
    return `This action updates a #${id} inventoryReport`;
  }

  remove(id: number) {
    return `This action removes a #${id} inventoryReport`;
  }
}

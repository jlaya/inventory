import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) { }

  async findAll(): Promise<Category[]> {
    return await this.categoryRepo.find({
      order: { name: 'ASC' }
    });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });
    if (!category) throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
    return category;
  }

  async create(createDto: CreateCategoryDto): Promise<Category> {
    const { ...rest } = createDto;
    const newCategory = this.categoryRepo.create(rest);
    return await this.categoryRepo.save(newCategory);
  }

  async update(id: number, updateDto: any): Promise<Category> {
    const category = await this.findOne(id);
    
    for (const key of Object.keys(updateDto)) {
      if (updateDto[key] !== null && updateDto[key] !== undefined) {
        (category as any)[key] = updateDto[key];
      }
    }

    return await this.categoryRepo.save(category);
  }

  async remove(id: number): Promise<any> {
    const category = await this.findOne(id);
    await this.categoryRepo.remove(category);
    return { success: true };
  }
}
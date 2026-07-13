import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Ingredient } from './entities/ingredient.entity';
import { Inventory } from '../inventory/entities/inventory.entity';
import { TelegramService } from '../alerts/telegram.service';
import { Sale } from '../sales/entities/sale.entity';

@Injectable()
export class IngredientsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly telegramService: TelegramService,
  ) { }

  async create(dto: any) {
    let items = dto.items || [];
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (err) {
        throw new BadRequestException('El campo items debe ser un JSON string válido');
      }
    }

    const ingredient = new Ingredient();
    ingredient.name = dto.name;
    ingredient.code = dto.code || 'S/C';
    ingredient.categorie = dto.categorie || 'General';
    ingredient.items = items;
    ingredient.image = dto.image || null;

    const saved = await this.dataSource.getRepository(Ingredient).save(ingredient);
    const result = await this.findOne(Number(saved.id));

    // Send Telegram notification
    try {
      const itemsCount = saved.items?.length || 0;
      await this.telegramService.sendMessage(
        `🍳 *Nueva Receta Registrada*\n` +
        `• *Nombre:* ${saved.name}\n` +
        `• *Código:* ${saved.code || 'N/A'}\n` +
        `• *Categoría:* ${saved.categorie}\n` +
        `• *Ingredientes:* ${itemsCount} insumos`
      );
    } catch (e) {
      console.error('Error sending Telegram notification for recipe creation:', e);
    }

    return result;
  }

  async findAll() {
    const list = await this.dataSource.getRepository(Ingredient).find({
      order: { createdAt: 'DESC' }
    });
    return list;
  }

  async findOne(id: number) {
    const ing = await this.dataSource.getRepository(Ingredient).findOne({ where: { id } });
    if (!ing) throw new NotFoundException('Receta no encontrada');

    let totalCost = 0;
    if (ing.items && Array.isArray(ing.items)) {
      for (const item of ing.items) {
        const invId = Number(item?.inventory_id);
        if (!invId || isNaN(invId)) continue;
        const prod = await this.dataSource.getRepository(Inventory).findOne({ where: { id: invId } });
        const cost = prod ? Number(prod.reference_cost) : 0;
        totalCost += (item.quantity * cost);
      }
    }

    return {
      id: Number(ing.id),
      name: ing.name,
      code: ing.code,
      categorie: ing.categorie,
      items: ing.items,
      image: ing.image,
      created_at: ing.createdAt,
      updated_at: ing.updatedAt,
      cost: Number(totalCost.toFixed(2))
    };
  }

  async update(id: number, dto: any) {
    const ing = await this.dataSource.getRepository(Ingredient).findOne({ where: { id } });
    if (!ing) throw new NotFoundException('Receta no encontrada');

    if (dto.name !== undefined) ing.name = dto.name;
    if (dto.code !== undefined) ing.code = dto.code || 'S/C';
    if (dto.categorie !== undefined) ing.categorie = dto.categorie;
    if (dto.image !== undefined) ing.image = dto.image;

    if (dto.items !== undefined) {
      let items = dto.items;
      if (typeof items === 'string') {
        try {
          items = JSON.parse(items);
        } catch (err) {
          throw new BadRequestException('El campo items debe ser un JSON string válido');
        }
      }
      ing.items = items;
    }

    const saved = await this.dataSource.getRepository(Ingredient).save(ing);
    const result = await this.findOne(Number(saved.id));

    // Send Telegram notification
    try {
      const itemsCount = saved.items?.length || 0;
      await this.telegramService.sendMessage(
        `✏️ *Receta Actualizada*\n` +
        `• *Nombre:* ${saved.name}\n` +
        `• *Código:* ${saved.code || 'N/A'}\n` +
        `• *Categoría:* ${saved.categorie}\n` +
        `• *Ingredientes:* ${itemsCount} insumos`
      );
    } catch (e) {
      console.error('Error sending Telegram notification for recipe update:', e);
    }

    return result;
  }

  async remove(id: number) {
    const ing = await this.dataSource.getRepository(Ingredient).findOne({ where: { id } });
    if (!ing) throw new NotFoundException('Receta no encontrada');

    // Check if ingredient is referenced by any sales
    const count = await this.dataSource.getRepository(Sale).count({ where: { ingredient: { id } } });
    if (count > 0) {
      throw new BadRequestException('No se puede eliminar la receta porque está relacionada a una o más ventas.');
    }

    await this.dataSource.getRepository(Ingredient).remove(ing);

    // Send Telegram notification
    try {
      await this.telegramService.sendMessage(
        `🗑️ *Receta Eliminada*\n` +
        `• *Nombre:* ${ing.name}\n` +
        `• *Código:* ${ing.code || 'N/A'}\n` +
        `• *Categoría:* ${ing.categorie}`
      );
    } catch (e) {
      console.error('Error sending Telegram notification for recipe removal:', e);
    }

    return { success: true };
  }
}

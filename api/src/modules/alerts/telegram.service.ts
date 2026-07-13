import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(message: string): Promise<boolean> {
    try {
      const token = this.configService.get<string>('TELEGRAM_TOKEN')?.trim();
      const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID')?.trim();
      const telegramSendMessage = this.configService.get<string>('TELEGRAM_SEND_MESSAGE');
      const apiBase = this.configService.get<string>('TELEGRAM_API_BASE_URL')?.trim() || 'https://api.telegram.org';

      if (telegramSendMessage === 'false') {
        this.logger.log('Envío de mensajes por Telegram deshabilitado (TELEGRAM_SEND_MESSAGE=false).');
        return false;
      }

      if (!token || !chatId) {
        this.logger.error('Configuración de Telegram faltante (TELEGRAM_TOKEN o TELEGRAM_CHAT_ID).');
        return true; // Indica que hubo un error
      }

      // Limpieza básica para evitar errores de parseo Markdown en Telegram
      const safeMessage = message.replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1');

      const response = await fetch(`${apiBase}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: safeMessage,
          parse_mode: 'MarkdownV2',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      this.logger.log('Mensaje enviado exitosamente a Telegram.');
      return false; // Indica que fue exitoso
    } catch (err: any) {
      this.logger.error(`❌ Error enviando mensaje a Telegram: ${err.message || err}`);
      if (err.cause) {
        this.logger.error(`❌ Detalle del error de red (cause): ${err.cause.message || err.cause}`);
      }
      return true; // Indica que hubo un error
    }
  }

  async sendDocument(buffer: Buffer, filename: string, caption?: string): Promise<boolean> {
    try {
      const token = this.configService.get<string>('TELEGRAM_TOKEN')?.trim();
      const chatId = this.configService.get<string>('TELEGRAM_CHAT_ID')?.trim();
      const telegramSendMessage = this.configService.get<string>('TELEGRAM_SEND_MESSAGE');
      const apiBase = this.configService.get<string>('TELEGRAM_API_BASE_URL')?.trim() || 'https://api.telegram.org';

      if (telegramSendMessage === 'false') {
        this.logger.log('Envío de documentos por Telegram deshabilitado (TELEGRAM_SEND_MESSAGE=false).');
        return false;
      }

      if (!token || !chatId) {
        this.logger.error('Configuración de Telegram faltante (TELEGRAM_TOKEN o TELEGRAM_CHAT_ID).');
        return true; // Indica que hubo un error
      }

      const safeCaption = caption ? caption.replace(/([_\[\]()~`>#+\-=|{}.!])/g, '\\$1') : undefined;

      const formData = new FormData();
      formData.append('chat_id', chatId);
      
      const blob = new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      formData.append('document', blob, filename);

      if (safeCaption) {
        formData.append('caption', safeCaption);
        formData.append('parse_mode', 'MarkdownV2');
      }

      const response = await fetch(`${apiBase}/bot${token}/sendDocument`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
      }

      this.logger.log('Documento enviado exitosamente a Telegram.');
      return false; // Indica que fue exitoso
    } catch (err: any) {
      this.logger.error(`❌ Error enviando documento a Telegram: ${err.message || err}`);
      if (err.cause) {
        this.logger.error(`❌ Detalle del error de red (cause): ${err.cause.message || err.cause}`);
      }
      return true; // Indica que hubo un error
    }
  }
}

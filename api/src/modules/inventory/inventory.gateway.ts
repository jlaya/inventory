import { WebSocketGateway, WebSocketServer, OnGatewayConnection, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'inventory',
})
export class InventoryGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('InventoryGateway');

  constructor(
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  emitAlert(alert: any) {
    this.server.emit('inventory_alert', alert);
  }

  emitCronAudit(auditData: any) {
    this.server.emit('cron_audit_completed', auditData);
  }

  emitRestockingNeeded(restockData: any) {
    this.server.emit('restocking_needed', restockData);
  }
}
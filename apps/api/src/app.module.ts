import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseService } from './database';
import { RunnerService } from './runner.service';
import { StoreService } from './store.service';

@Module({ controllers: [AppController], providers: [DatabaseService, StoreService, RunnerService] })
export class AppModule {}

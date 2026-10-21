import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { createValidationPipe } from './common/validation/validation-pipe';

export function configureApp(app: NestExpressApplication) {
  app.use(helmet());
  app.useBodyParser('json', { limit: '100kb' });
  app.enableCors({
    origin: [/^http:\/\/(?:localhost|127\.0\.0\.1):517\d$/],
    methods: ['GET', 'POST'],
  });
  app.useGlobalPipes(createValidationPipe());
}

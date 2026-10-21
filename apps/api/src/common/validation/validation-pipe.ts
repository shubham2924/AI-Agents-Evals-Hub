import { Type, ValidationPipe } from '@nestjs/common';

export function createValidationPipe(expectedType?: Type<unknown>) {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    expectedType,
  });
}

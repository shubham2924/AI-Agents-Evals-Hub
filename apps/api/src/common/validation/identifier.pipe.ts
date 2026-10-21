import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const ROUTE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

@Injectable()
export class IdentifierPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!ROUTE_IDENTIFIER.test(value)) throw new BadRequestException('Invalid resource identifier.');
    return value;
  }
}

import { ApiProperty } from '@nestjs/swagger';

export class NormalResponseDto<T> {
  data: T;

  @ApiProperty()
  message: string;
}

export class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class PaginationResponseDto<T> {
  @ApiProperty()
  message: string;

  data: T[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

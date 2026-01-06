import { NormalResponseDto, PaginationResponseDto } from './dto';

/**
 * Create a paginated response
 */
export const toPaginationResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message: string = 'Success',
): PaginationResponseDto<T> => ({
  message,
  data,
  total,
  page,
  limit,
});

/**
 * Create a normal response with data wrapper
 */
export const toNormalResponse =
  (message: string = 'Success') =>
  <T>(data: T): NormalResponseDto<T> => ({
    message,
    data,
  });

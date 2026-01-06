import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { NormalResponseDto, PaginationResponseDto } from './dto';

/**
 * Swagger decorator for normal response with data wrapper
 * @param dataDto - The DTO class for the data property
 * @param isArray - Whether the data is an array
 * @param isOptional - Whether the data can be null
 */
export const ApiOkResponseNormal = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
  isArray: boolean = false,
  isOptional: boolean = false,
) =>
  applyDecorators(
    ApiExtraModels(NormalResponseDto, dataDto),
    ApiOkResponse({
      description: 'Successful response',
      schema: {
        allOf: [
          { $ref: getSchemaPath(NormalResponseDto) },
          {
            properties: {
              message: {
                type: 'string',
                example: 'Success',
              },
              data: {
                ...(isArray
                  ? {
                      type: 'array',
                      items: { $ref: getSchemaPath(dataDto) },
                    }
                  : { $ref: getSchemaPath(dataDto) }),
                ...(isOptional ? { nullable: true } : {}),
              },
            },
          },
        ],
      },
    }),
  );

export const ApiOkResponsePaginated = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
) =>
  applyDecorators(
    ApiExtraModels(PaginationResponseDto, dataDto),
    ApiOkResponse({
      description: 'Successful paginated response',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginationResponseDto) },
          {
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
            },
          },
        ],
      },
    }),
  );

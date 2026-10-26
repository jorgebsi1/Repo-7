import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';

@ApiTags('catálogo')
@Controller('v1')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('ubicaciones')
  ubicaciones() {
    return this.catalog.ubicaciones();
  }

  @Get('ubicaciones/:id/catalogo')
  catalogo(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.catalogo(id);
  }

  @Get('productos/:id')
  producto(@Param('id', ParseUUIDPipe) id: string, @Query('ubicacionId') ubicacionId?: string) {
    return this.catalog.producto(id, ubicacionId);
  }
}

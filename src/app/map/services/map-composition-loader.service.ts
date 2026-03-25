import { Injectable } from '@angular/core';

import {
  DEFAULT_FALLBACK_BASEMAP,
  MapComposition,
  MapConfig
} from '../models/layer-config.model';
import { validateMapConfig } from '../utils/map-config.utils';
import { MapBasemapFactoryService } from './map-basemap-factory.service';
import { MapConfigService } from './map-config.service';
import { MapLayerLoaderService } from './map-layer-loader.service';

@Injectable({
  providedIn: 'root'
})
export class MapCompositionLoaderService {
  constructor(
    private readonly configService: MapConfigService,
    private readonly basemapFactory: MapBasemapFactoryService,
    private readonly layerLoader: MapLayerLoaderService
  ) {}

  async loadComposition(): Promise<MapComposition> {
    const config = this.configService.getConfig();

    validateMapConfig(config);

    const basemap = await this.loadBasemap(config, config.fallbackBasemap ?? DEFAULT_FALLBACK_BASEMAP);
    const operationalLayers = await this.layerLoader.loadLayers(config.operationalLayers);

    return {
      basemap,
      operationalLayers
    };
  }

  private async loadBasemap(config: MapConfig, fallbackBasemap: string): Promise<MapComposition['basemap']> {
    try {
      return await this.basemapFactory.createBasemap(config.basemap);
    } catch (error) {
      console.warn('Basemap load failed. Falling back to configured default basemap.', error);
      return fallbackBasemap;
    }
  }
}
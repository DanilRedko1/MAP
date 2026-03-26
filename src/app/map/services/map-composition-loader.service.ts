import { Injectable } from '@angular/core';

import {
  DEFAULT_FALLBACK_BASEMAP,
  MapComposition,
  MapConfig
} from '../models/layer-config.model';
import { MapBasemapStatusService } from './map-basemap-status.service';
import { MapBasemapFactoryService } from './map-basemap-factory.service';
import { MapConfigService } from './map-config.service';
import { MapLayerLoaderService } from './map-layer-loader.service';

@Injectable({
  providedIn: 'root'
})
export class MapCompositionLoaderService {
  constructor(
    private readonly basemapStatus: MapBasemapStatusService,
    private readonly configService: MapConfigService,
    private readonly basemapFactory: MapBasemapFactoryService,
    private readonly layerLoader: MapLayerLoaderService
  ) {}

  async loadComposition(): Promise<MapComposition> {
    this.basemapStatus.clear();

    const config = await this.configService.getConfig();

    const basemap = await this.loadBasemap(config, config.fallbackBasemap ?? DEFAULT_FALLBACK_BASEMAP);
    const operationalLayers = await this.layerLoader.loadLayers(config.operationalLayers);

    return {
      basemap,
      operationalLayers,
      config
    };
  }

  private async loadBasemap(config: MapConfig, fallbackBasemap: string): Promise<MapComposition['basemap']> {
    try {
      return await this.basemapFactory.createBasemap(config.basemap);
    } catch (error) {
      console.warn('Basemap load failed. Falling back to configured default basemap.', error);
      this.basemapStatus.markFallbackBasemap(fallbackBasemap, error);
      return fallbackBasemap;
    }
  }
}

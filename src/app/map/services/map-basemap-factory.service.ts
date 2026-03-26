import { Injectable } from '@angular/core';
import Basemap from '@arcgis/core/Basemap';

import {
  BasemapConfig,
  BasemapLayerConfig,
  PortalItemBasemapConfig
} from '../models/layer-config.model';
import { sortByOrder } from '../utils/map-config.utils';
import { MapLayerFactoryService } from './map-layer-factory.service';
import { MapResourceAuthService } from './map-resource-auth.service';
import { MapResourceResolverService } from './map-resource-resolver.service';

@Injectable({
  providedIn: 'root'
})
export class MapBasemapFactoryService {
  constructor(
    private readonly authService: MapResourceAuthService,
    private readonly resolverService: MapResourceResolverService,
    private readonly layerFactory: MapLayerFactoryService
  ) {}

  async createBasemap(config: BasemapConfig): Promise<Basemap | string> {
    switch (config.mode) {
      case 'well-known':
        return config.id;
      case 'portal-item':
        return this.createPortalItemBasemap(config);
      case 'custom':
        return this.createCustomBasemap(config);
    }
  }

  private async createPortalItemBasemap(config: PortalItemBasemapConfig): Promise<Basemap> {
    const authContext = await this.authService.prepare(config);
    const resolved = await this.resolverService.resolveBasemapDefinition(config, authContext);
    const portalItemId = resolved?.portalItemId ?? config.id;

    return new Basemap({
      id: config.id,
      title: resolved?.title ?? config.title,
      portalItem: {
        id: portalItemId
      }
    });
  }

  private async createCustomBasemap(config: Extract<BasemapConfig, { mode: 'custom' }>): Promise<Basemap> {
    const basemap = new Basemap({
      id: config.id,
      title: config.title,
      ...(config.spatialReferenceWkid ? {
        spatialReference: {
          wkid: config.spatialReferenceWkid
        }
      } : {})
    });
    const baseLayers = await Promise.all(sortByOrder(config.baseLayers).map((layer) => this.loadBasemapLayer(layer)));
    const referenceLayers = await Promise.all(
      sortByOrder(config.referenceLayers ?? []).map((layer) => this.loadBasemapLayer(layer))
    );

    if (baseLayers.length > 0) {
      basemap.baseLayers.addMany(baseLayers);
    }

    if (referenceLayers.length > 0) {
      basemap.referenceLayers.addMany(referenceLayers);
    }

    return basemap;
  }

  private async loadBasemapLayer(config: BasemapLayerConfig): Promise<__esri.Layer> {
    const authContext = await this.authService.prepare(config);
    const resolved = await this.resolverService.resolveLayerDefinition(config, authContext);
    return this.layerFactory.createBasemapLayer(config, resolved, authContext);
  }
}

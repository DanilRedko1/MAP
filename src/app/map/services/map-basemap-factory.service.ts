import { Injectable } from '@angular/core';
import Basemap from '@arcgis/core/Basemap';
import Layer from '@arcgis/core/layers/Layer';
import MapImageLayer from '@arcgis/core/layers/MapImageLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';

import {
  BasemapConfig,
  BasemapLayerConfig,
  PortalItemBasemapConfig,
  PreparedAuthContext,
  ResolvedLayerDefinition
} from '../models/layer-config.model';
import { sortByOrder } from '../utils/map-config.utils';
import { MapResourceAuthService } from './map-resource-auth.service';
import { MapResourceResolverService } from './map-resource-resolver.service';

@Injectable({
  providedIn: 'root'
})
export class MapBasemapFactoryService {
  constructor(
    private readonly authService: MapResourceAuthService,
    private readonly resolverService: MapResourceResolverService
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
    const baseLayers = await Promise.all(sortByOrder(config.baseLayers).map((layer) => this.createBasemapLayer(layer)));
    const referenceLayers = await Promise.all(
      sortByOrder(config.referenceLayers ?? []).map((layer) => this.createBasemapLayer(layer))
    );

    if (baseLayers.length > 0) {
      basemap.baseLayers.addMany(baseLayers);
    }

    if (referenceLayers.length > 0) {
      basemap.referenceLayers.addMany(referenceLayers);
    }

    return basemap;
  }

  private async createBasemapLayer(config: BasemapLayerConfig): Promise<Layer> {
    const authContext = await this.authService.prepare(config);
    const resolved = await this.resolverService.resolveLayerDefinition(config, authContext);
    const props = this.buildLayerProps(config, resolved, authContext);

    switch (config.kind) {
      case 'tile':
        return new TileLayer(props as __esri.TileLayerProperties);
      case 'vector-tile':
        return new VectorTileLayer(props as __esri.VectorTileLayerProperties);
      case 'map-image':
        return new MapImageLayer(props as __esri.MapImageLayerProperties);
    }
  }

  private buildLayerProps(
    config: BasemapLayerConfig,
    resolved: ResolvedLayerDefinition | undefined,
    authContext: PreparedAuthContext | undefined
  ): Record<string, unknown> {
    const url = resolved?.url ?? config.url;

    if (!url) {
      throw new Error(`Basemap layer "${config.id}" could not be created because no url was resolved.`);
    }

    const customParameters = this.getLayerCustomParameters(authContext);

    return {
      ...(config.layerProps ?? {}),
      ...(resolved?.layerProps ?? {}),
      id: config.id,
      title: config.title ?? resolved?.title,
      url,
      ...(typeof config.opacity === 'number' ? { opacity: config.opacity } : {}),
      ...(customParameters ? { customParameters } : {})
    };
  }

  private getLayerCustomParameters(authContext: PreparedAuthContext | undefined): Record<string, string> | undefined {
    if (!authContext?.auth || authContext.auth.mode !== 'token') {
      return undefined;
    }

    if (authContext.auth.appliesTo === 'resolver') {
      return undefined;
    }

    return Object.keys(authContext.query).length > 0 ? authContext.query : undefined;
  }
}
import { Injectable } from '@angular/core';
import Basemap from '@arcgis/core/Basemap';

import {
  BasemapConfig,
  BasemapLayerSlot,
  BasemapLayerConfig,
  PortalItemBasemapConfig
} from '../models/layer-config.model';
import { sortByOrder } from '../utils/map-config.utils';
import { buildBasemapLayerCandidates } from '../utils/map-fallback.utils';
import { MapBasemapStatusService } from './map-basemap-status.service';
import { MapLayerFactoryService } from './map-layer-factory.service';
import { MapResourceAuthService } from './map-resource-auth.service';
import { MapResourceResolverService } from './map-resource-resolver.service';

@Injectable({
  providedIn: 'root'
})
export class MapBasemapFactoryService {
  constructor(
    private readonly basemapStatus: MapBasemapStatusService,
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
    const baseLayers = await Promise.all(sortByOrder(config.baseLayers).map((layer) => this.loadBasemapLayer(layer, 'base')));
    const referenceLayers = await Promise.all(
      sortByOrder(config.referenceLayers ?? []).map((layer) => this.loadBasemapLayer(layer, 'reference'))
    );

    if (baseLayers.length > 0) {
      basemap.baseLayers.addMany(baseLayers);
    }

    if (referenceLayers.length > 0) {
      basemap.referenceLayers.addMany(referenceLayers);
    }

    return basemap;
  }

  private async loadBasemapLayer(config: BasemapLayerConfig, slot: BasemapLayerSlot): Promise<__esri.Layer> {
    this.basemapStatus.start(config, slot);

    const attemptErrors: string[] = [];
    let lastError: unknown = new Error(`Basemap layer "${config.id}" could not be loaded.`);

    for (const [candidateIndex, candidate] of buildBasemapLayerCandidates(config).entries()) {
      try {
        const authContext = await this.authService.prepare(candidate);
        const resolved = await this.resolverService.resolveLayerDefinition(candidate, authContext);
        const layer = this.layerFactory.createBasemapLayer(candidate, resolved, authContext);

        await layer.load();
        this.basemapStatus.markLoaded(config, slot, this.buildLoadMetadata(candidateIndex, attemptErrors));
        return layer;
      } catch (error) {
        lastError = error;
        attemptErrors.push(this.toErrorMessage(error));
      }
    }

    this.basemapStatus.markFailed(config, slot, lastError, {
      attemptErrors
    });
    throw lastError;
  }

  private buildLoadMetadata(candidateIndex: number, attemptErrors: string[]) {
    if (candidateIndex === 0) {
      return {
        loadedViaFallback: false,
        attemptErrors: [...attemptErrors]
      };
    }

    return {
      loadedViaFallback: true,
      fallbackIndex: candidateIndex - 1,
      attemptErrors: [...attemptErrors]
    };
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error && error.message.trim() ? error.message : String(error);
  }
}

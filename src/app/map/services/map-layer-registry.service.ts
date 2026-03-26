import { Injectable } from '@angular/core';
import Layer from '@arcgis/core/layers/Layer';

import { LayerConfig, LayerRuntimeRecord } from '../models/layer-config.model';

@Injectable({
  providedIn: 'root'
})
export class MapLayerRegistryService {
  private readonly records = new Map<string, LayerRuntimeRecord>();

  clear(): void {
    this.records.clear();
  }

  start(config: LayerConfig): void {
    this.records.set(config.id, {
      id: config.id,
      config,
      status: 'loading',
      childIds: this.readChildIds(config)
    });
  }

  markLoaded(config: LayerConfig, layer: Layer): void {
    this.records.set(config.id, {
      id: config.id,
      config,
      layer,
      status: 'loaded',
      childIds: this.readChildIds(config)
    });
  }

  markFailed(config: LayerConfig, error: unknown): void {
    this.records.set(config.id, {
      id: config.id,
      config,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      childIds: this.readChildIds(config)
    });
  }

  getSnapshot(): LayerRuntimeRecord[] {
    return Array.from(this.records.values());
  }

  private readChildIds(config: LayerConfig): string[] {
    return config.type === 'group' ? config.layers.map((child) => child.id) : [];
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  DEFAULT_FALLBACK_BASEMAP,
  MapConfig
} from '../models/layer-config.model';
import { validateMapConfig } from '../utils/map-config.utils';
import { hasOwn, readPlainObject } from '../utils/map-object.utils';

export const MAP_CONFIG_ASSET_PATH = '/assets/config/map-config.json';

@Injectable({
  providedIn: 'root'
})
export class MapConfigService {
  constructor(private readonly http: HttpClient) {}

  async getConfig(): Promise<MapConfig> {
    const payload = await firstValueFrom(this.http.get<unknown>(MAP_CONFIG_ASSET_PATH));
    return this.normalizeConfig(payload);
  }

  private normalizeConfig(payload: unknown): MapConfig {
    const record = readPlainObject(payload, 'Map config payload must be an object.');
    const config: MapConfig = {
      basemap: record['basemap'] as unknown as MapConfig['basemap'],
      operationalLayers: record['operationalLayers'] as unknown as MapConfig['operationalLayers'],
      fallbackBasemap: hasOwn(record, 'fallbackBasemap')
        ? record['fallbackBasemap'] as unknown as MapConfig['fallbackBasemap']
        : DEFAULT_FALLBACK_BASEMAP
    };

    validateMapConfig(config);
    return config;
  }
}

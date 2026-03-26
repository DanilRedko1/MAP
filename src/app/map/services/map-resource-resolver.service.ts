import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  BasemapLayerConfig,
  GraphicItemConfig,
  LeafLayerConfig,
  PortalItemBasemapConfig,
  PreparedAuthContext,
  ResolvedBasemapDefinition,
  ResolvedLayerDefinition,
  ResourceSourceConfig
} from '../models/layer-config.model';
import { toStringRecord } from '../utils/map-config.utils';
import {
  readNumber,
  readOptionalArray,
  readOptionalPlainObject,
  readPlainObject,
  readString
} from '../utils/map-object.utils';

@Injectable({
  providedIn: 'root'
})
export class MapResourceResolverService {
  constructor(private readonly http: HttpClient) {}

  async resolveLayerDefinition(
    config: LeafLayerConfig | BasemapLayerConfig,
    authContext?: PreparedAuthContext
  ): Promise<ResolvedLayerDefinition | undefined> {
    if (!config.source || config.source.mode !== 'resolved') {
      return undefined;
    }

    const payload = await this.request(config.source, authContext);
    return this.normalizeResolvedLayerDefinition(config.id, payload);
  }

  async resolveBasemapDefinition(
    config: PortalItemBasemapConfig,
    authContext?: PreparedAuthContext
  ): Promise<ResolvedBasemapDefinition | undefined> {
    if (!config.source || config.source.mode !== 'resolved') {
      return undefined;
    }

    const payload = await this.request(config.source, authContext);
    return this.normalizeResolvedBasemapDefinition(config.id, payload);
  }

  private async request(source: ResourceSourceConfig, authContext?: PreparedAuthContext): Promise<unknown> {
    if (source.mode !== 'resolved') {
      return undefined;
    }

    const applyAuthToResolver = !authContext?.auth?.appliesTo
      || authContext.auth.appliesTo === 'resolver'
      || authContext.auth.appliesTo === 'both';
    const headers = new HttpHeaders(applyAuthToResolver ? authContext?.headers : undefined);
    const params = new HttpParams({
      fromObject: {
        ...toStringRecord(source.params),
        ...(applyAuthToResolver ? authContext?.query : {})
      }
    });

    return firstValueFrom(
      this.http.request<unknown>(source.method ?? 'GET', source.endpoint, {
        body: source.method === 'POST' ? source.body : undefined,
        headers,
        params
      })
    );
  }

  private normalizeResolvedLayerDefinition(id: string, payload: unknown): ResolvedLayerDefinition {
    const record = readPlainObject(payload, 'Resolved resource payload must be an object.');

    return {
      id: readString(record['id']) ?? id,
      title: readString(record['title']),
      url: readString(record['url']),
      layerProps: readOptionalPlainObject(record['layerProps']) ?? readOptionalPlainObject(record['properties']),
      auth: readOptionalPlainObject(record['auth']) as Partial<ResolvedLayerDefinition['auth']>,
      graphics: readGraphics(record['graphics'])
    };
  }

  private normalizeResolvedBasemapDefinition(id: string, payload: unknown): ResolvedBasemapDefinition {
    const record = readPlainObject(payload, 'Resolved resource payload must be an object.');

    return {
      id: readString(record['id']) ?? id,
      title: readString(record['title']),
      portalItemId: readString(record['portalItemId']) ?? readString(record['id']),
      baseLayers: readOptionalArray<BasemapLayerConfig>(record['baseLayers']),
      referenceLayers: readOptionalArray<BasemapLayerConfig>(record['referenceLayers']),
      spatialReferenceWkid: readNumber(record['spatialReferenceWkid'])
    };
  }
}

function readGraphics(value: unknown): GraphicItemConfig[] | undefined {
  return readOptionalArray<GraphicItemConfig>(value);
}

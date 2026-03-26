import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import IdentityManager from '@arcgis/core/identity/IdentityManager';
import ServerInfo from '@arcgis/core/identity/ServerInfo';
import { firstValueFrom } from 'rxjs';

import {
  PreparedAuthContext,
  ResourceAuthConfig
} from '../models/layer-config.model';
import { toStringRecord } from '../utils/map-config.utils';
import { readOptionalPlainObject, readString } from '../utils/map-object.utils';

@Injectable({
  providedIn: 'root'
})
export class MapResourceAuthService {
  constructor(private readonly http: HttpClient) {}

  async prepare(resource: { auth?: ResourceAuthConfig }): Promise<PreparedAuthContext | undefined> {
    const auth = resource.auth;

    if (!auth || auth.mode === 'none') {
      return undefined;
    }

    if (auth.mode === 'identity-manager') {
      this.registerServer(auth);

      const token = auth.token ?? await this.fetchToken(auth, false);

      if (!token) {
        return undefined;
      }

      const server = this.resolveServer(auth);

      if (!server) {
        throw new Error('Identity-manager auth requires a server or resourceUrl when a token is supplied.');
      }

      IdentityManager.registerToken({
        server,
        token,
        expires: auth.expiresAt,
        ssl: auth.ssl,
        userId: auth.userId
      });

      return {
        token,
        headers: {},
        query: {
          token
        },
        auth
      };
    }

    const token = auth.token ?? await this.fetchToken(auth, true);

    if (!token) {
      throw new Error('Token auth requires a token or a tokenEndpoint.');
    }

    const headerName = auth.headerName ?? 'Authorization';
    const headerValue = headerName.toLowerCase() === 'authorization' && !token.toLowerCase().startsWith('bearer ')
      ? `Bearer ${token}`
      : token;

    return {
      token,
      headers: {
        [headerName]: headerValue
      },
      query: {
        token
      },
      auth
    };
  }

  private registerServer(auth: ResourceAuthConfig): void {
    const server = this.resolveServer(auth);

    if (!server && !auth.tokenEndpoint) {
      return;
    }

    IdentityManager.registerServers([
      new ServerInfo({
        server,
        tokenServiceUrl: auth.tokenEndpoint
      })
    ]);
  }

  private resolveServer(auth: ResourceAuthConfig): string | undefined {
    return auth.server ?? auth.resourceUrl;
  }

  private async fetchToken(auth: ResourceAuthConfig, required: boolean): Promise<string | undefined> {
    if (!auth.tokenEndpoint) {
      if (required) {
        throw new Error('Auth configuration requires tokenEndpoint when a static token is not provided.');
      }

      return undefined;
    }

    const method = auth.method ?? 'GET';
    const headers = new HttpHeaders();
    const params = new HttpParams({ fromObject: toStringRecord(auth.params) });
    const response = await firstValueFrom(
      this.http.request<unknown>(method, auth.tokenEndpoint, {
        body: method === 'POST' ? auth.body : undefined,
        headers,
        params
      })
    );

    return this.readToken(response);
  }

  private readToken(response: unknown): string | undefined {
    if (typeof response === 'string') {
      return response;
    }

    const record = readOptionalPlainObject(response);

    if (!record) {
      return undefined;
    }

    return readString(record['token']) ?? readString(record['accessToken']) ?? readString(record['access_token']);
  }
}

import { promises as dns } from 'node:dns';
import { Injectable } from '@nestjs/common';
import { CMP_CONFIG } from '@cmp/config';
import type { DomainVerificationMethod } from '@cmp/database';

@Injectable()
export class DomainVerificationService {
  async verify(
    hostname: string,
    token: string,
    method: DomainVerificationMethod,
    sdkLastSeenAt?: Date | null,
  ): Promise<{ verified: boolean; message: string }> {
    switch (method) {
      case 'DNS_TXT':
        return this.verifyDns(hostname, token);
      case 'HTML_FILE':
        return this.verifyHtmlFile(hostname, token);
      case 'META_TAG':
        return this.verifyMetaTag(hostname, token);
      case 'CMP_SCRIPT':
        return this.verifyCmpScript(sdkLastSeenAt);
      case 'MANUAL':
        return { verified: true, message: 'Manually approved by administrator' };
      default:
        return { verified: false, message: 'Unknown verification method' };
    }
  }

  private async verifyDns(hostname: string, token: string): Promise<{ verified: boolean; message: string }> {
    try {
      const records = await dns.resolveTxt(`_cmp-verify.${hostname}`);
      const flat = records.flat();
      const expected = `cmp-verify=${token}`;
      const found = flat.some((r) => r.includes(expected));
      return found
        ? { verified: true, message: 'DNS TXT record verified' }
        : {
            verified: false,
            message: `DNS TXT record not found. Add "${expected}" to _cmp-verify.${hostname}`,
          };
    } catch {
      return {
        verified: false,
        message: `Could not resolve DNS TXT record at _cmp-verify.${hostname}`,
      };
    }
  }

  private async verifyHtmlFile(hostname: string, token: string): Promise<{ verified: boolean; message: string }> {
    try {
      const urls = [
        `https://${hostname}/.well-known/cmp-verify.html`,
        `http://${hostname}/.well-known/cmp-verify.html`,
      ];
      for (const url of urls) {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          const body = await response.text();
          if (body.includes(token)) {
            return { verified: true, message: 'HTML verification file found' };
          }
        }
      }
      return {
        verified: false,
        message: `Place file at https://${hostname}/.well-known/cmp-verify.html containing token ${token}`,
      };
    } catch {
      return { verified: false, message: 'Could not fetch HTML verification file' };
    }
  }

  private async verifyMetaTag(hostname: string, token: string): Promise<{ verified: boolean; message: string }> {
    try {
      const urls = [`https://${hostname}`, `http://${hostname}`];
      for (const url of urls) {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (response.ok) {
          const html = await response.text();
          const pattern = new RegExp(
            `<meta[^>]+name=["']cmp-verify["'][^>]+content=["']${token}["']`,
            'i',
          );
          if (pattern.test(html)) {
            return { verified: true, message: 'Meta verification tag found' };
          }
        }
      }
      return {
        verified: false,
        message: `Add <meta name="cmp-verify" content="${token}"> to your homepage`,
      };
    } catch {
      return { verified: false, message: 'Could not fetch homepage for meta tag verification' };
    }
  }

  private verifyCmpScript(sdkLastSeenAt?: Date | null): { verified: boolean; message: string } {
    if (!sdkLastSeenAt) {
      return {
        verified: false,
        message: 'CMP script has not reported installation yet. Install the script and reload your site.',
      };
    }
    const age = Date.now() - sdkLastSeenAt.getTime();
    if (age < 24 * 60 * 60 * 1000) {
      return { verified: true, message: 'CMP script detected via heartbeat' };
    }
    return { verified: false, message: 'CMP script heartbeat is stale. Reinstall or reload your site.' };
  }

  buildInstructions(hostname: string, token: string, domainKey: string) {
    const apiBase = CMP_CONFIG.sdkUrl.replace('/sdk.js', '');
    return {
      dns_txt: {
        host: `_cmp-verify.${hostname}`,
        type: 'TXT',
        value: `cmp-verify=${token}`,
        instructions: `Add a TXT record to _cmp-verify.${hostname} with value: cmp-verify=${token}`,
      },
      html_file: {
        path: `/.well-known/cmp-verify.html`,
        content: token,
        instructions: `Upload a file to https://${hostname}/.well-known/cmp-verify.html containing: ${token}`,
      },
      meta_tag: {
        tag: `<meta name="cmp-verify" content="${token}">`,
        instructions: `Add the meta tag to the <head> of https://${hostname}`,
      },
      cmp_script: {
        snippet: this.buildInstallSnippet(domainKey),
        instructions: 'Install the CMP script on your website, then click Verify using CMP JavaScript',
      },
      manual: {
        instructions: 'Contact your platform administrator to manually approve this domain',
      },
      verifyUrl: `${apiBase}/verify/${domainKey}.html`,
    };
  }

  buildInstallSnippet(domainKey: string, options?: { debug?: boolean; environment?: string }) {
    const attrs = [
      `src="${CMP_CONFIG.sdkUrl}"`,
      `data-domain-key="${domainKey}"`,
      `data-env="${options?.environment ?? 'production'}"`,
      'async',
    ];
    if (options?.debug) attrs.push('data-debug="true"');
    return `<script ${attrs.join(' ')}></script>`;
  }
}

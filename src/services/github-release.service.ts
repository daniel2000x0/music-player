import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { logError } from '@/services/error-log.service';

export type GithubReleaseAsset = {
  name: string;
  browserDownloadUrl: string;
  size: number;
  contentType: string | null;
};

export type GithubReleaseInfo = {
  tagName: string;
  version: string;
  name: string;
  body: string;
  htmlUrl: string;
  publishedAt: string | null;
  apkAsset: GithubReleaseAsset | null;
};

export type ReleaseCheckResult =
  | { status: 'up-to-date'; currentVersion: string; latest: GithubReleaseInfo }
  | { status: 'available'; currentVersion: string; latest: GithubReleaseInfo }
  | { status: 'invalid'; currentVersion: string; reason: string };

export type ReleaseDownloadProgress = {
  totalBytes: number | null;
  downloadedBytes: number;
  fraction: number | null;
};

const DEFAULT_REPO = 'daniel2000x0/music-player';

function repoFromExpoConfig(): string {
  const extra = Constants.expoConfig?.extra as { githubRepo?: string } | undefined;
  if (typeof extra?.githubRepo === 'string' && extra.githubRepo.includes('/')) {
    return extra.githubRepo;
  }
  return DEFAULT_REPO;
}

export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '0.0.0';
}

export function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
}

export function compareSemver(a: string, b: string): number {
  const pa = normalizeVersion(a).split(/[.-]/).map((n) => Number.parseInt(n, 10));
  const pb = normalizeVersion(b).split(/[.-]/).map((n) => Number.parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const na = Number.isFinite(pa[i]) ? pa[i] : 0;
    const nb = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function pickApkAsset(assets: unknown): GithubReleaseAsset | null {
  if (!Array.isArray(assets)) return null;
  for (const item of assets) {
    const asset = item as Record<string, unknown>;
    const name = typeof asset.name === 'string' ? asset.name : '';
    const url = typeof asset.browser_download_url === 'string' ? asset.browser_download_url : '';
    if (!name.toLowerCase().endsWith('.apk') || !url) continue;
    const size = typeof asset.size === 'number' && Number.isFinite(asset.size) ? asset.size : 0;
    const contentType = typeof asset.content_type === 'string' ? asset.content_type : null;
    return { name, browserDownloadUrl: url, size, contentType };
  }
  return null;
}

export async function fetchLatestGithubRelease(repo = repoFromExpoConfig()): Promise<GithubReleaseInfo> {
  const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mi-music-player-update-check',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub Releases respondió ${response.status}`);
  }
  const data = (await response.json()) as Record<string, unknown>;
  const tagName = typeof data.tag_name === 'string' ? data.tag_name : '';
  const version = normalizeVersion(tagName);
  return {
    tagName,
    version: version || tagName,
    name: typeof data.name === 'string' && data.name ? data.name : tagName,
    body: typeof data.body === 'string' ? data.body : '',
    htmlUrl: typeof data.html_url === 'string' ? data.html_url : `https://github.com/${repo}/releases/latest`,
    publishedAt: typeof data.published_at === 'string' ? data.published_at : null,
    apkAsset: pickApkAsset(data.assets),
  };
}

export async function checkLatestGithubRelease(): Promise<ReleaseCheckResult> {
  const currentVersion = getCurrentAppVersion();
  try {
    const latest = await fetchLatestGithubRelease();
    if (!latest.version) {
      return { status: 'invalid', currentVersion, reason: 'missing-version' };
    }
    const cmp = compareSemver(latest.version, currentVersion);
    return cmp > 0
      ? { status: 'available', currentVersion, latest }
      : { status: 'up-to-date', currentVersion, latest };
  } catch (error) {
    logError('updates', 'github-release-check', error);
    throw error;
  }
}

export function canInstallApkInCurrentRuntime(): boolean {
  // Instalar APK externo requiere build instalada/Android; Expo Go no puede.
  return Platform.OS === 'android' && !Constants.appOwnership?.includes('expo');
}

export function getApkDownloadTarget(version: string): File {
  const safeVersion = normalizeVersion(version).replace(/[^0-9A-Za-z.-]/g, '_') || 'latest';
  return new File(Paths.cache, `mi-music-player-${safeVersion}.apk`);
}

export async function downloadReleaseApk(
  release: GithubReleaseInfo,
  onProgress?: (progress: ReleaseDownloadProgress) => void
): Promise<File> {
  const asset = release.apkAsset;
  if (!asset) {
    throw new Error('missing-apk-asset');
  }
  if (Platform.OS !== 'android') {
    throw new Error('unsupported-platform');
  }

  const target = getApkDownloadTarget(release.version);
  try {
    if (target.exists) target.delete();
  } catch {
    // Si no se puede borrar, se intenta sobreescribir con descarga nueva.
  }

  onProgress?.({ totalBytes: asset.size || null, downloadedBytes: 0, fraction: asset.size ? 0 : null });

  const downloaded = await File.downloadFileAsync(asset.browserDownloadUrl, target, {
    idempotent: true,
    headers: { 'User-Agent': 'mi-music-player-update-check' },
  });

  const size = downloaded.size;
  if (asset.size > 0 && typeof size === 'number' && size > 0 && size !== asset.size) {
    // Validación básica de integridad por tamaño reportado por GitHub.
    try {
      downloaded.delete();
    } catch {
      // noop
    }
    throw new Error('apk-size-mismatch');
  }

  onProgress?.({
    totalBytes: asset.size || (typeof size === 'number' ? size : null),
    downloadedBytes: typeof size === 'number' ? size : asset.size || 0,
    fraction: 1,
  });

  return downloaded;
}

/**
 * Doble en memoria de `expo-file-system` (`File`, `Directory`, `FileHandle`).
 *
 * Implementa solo la superficie que usan los servicios de carátulas, tags y
 * widget: existence/size, lectura por offsets, escritura, copia, borrado y
 * listado de directorios. Se usa desde un factory de `jest.mock`:
 *
 * ```ts
 * jest.mock('expo-file-system', () => require('@/testing/mocks/expo-file-system'));
 * ```
 */

export const Paths = {
  cache: 'file:///cache',
  document: 'file:///documents',
  documentDirectory: 'file:///documents',
};

export const FileMode = {
  ReadOnly: 'r',
  WriteOnly: 'w',
} as const;

type Node = FakeFile | FakeDirectory;

const files = new Map<string, FakeFile>();
const directories = new Map<string, FakeDirectory>();

function parentUri(uri: string): string | null {
  const slash = uri.lastIndexOf('/');
  if (slash <= 'file://'.length) {
    return null;
  }
  return uri.slice(0, slash);
}

function join(parent: string, name: string): string {
  return `${parent.replace(/\/$/, '')}/${name.replace(/^\//, '')}`;
}

/** Igual que el constructor real: acepta una URI o varios segmentos. */
function uriOf(parts: (string | FakeFile | FakeDirectory)[]): string {
  if (parts.length === 0) {
    return 'file:///';
  }
  if (parts.length === 1 && typeof parts[0] === 'string' && parts[0].includes('://')) {
    return parts[0];
  }
  return parts
    .map((part) => (typeof part === 'string' ? part : part.uri))
    .reduce((parent, part) => join(parent, part));
}

export class FakeFileHandle {
  offset = 0;
  readonly size: number;
  closed = false;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.size = bytes.length;
  }

  async readBytes(length: number): Promise<Uint8Array> {
    const end = Math.min(this.offset + length, this.bytes.length);
    const result = this.bytes.slice(this.offset, end);
    this.offset = end;
    return result;
  }

  close(): void {
    this.closed = true;
  }
}

export class FakeFile {
  readonly uri: string;
  readonly name: string;
  exists: boolean;
  bytes: Uint8Array;

  constructor(...parts: (string | FakeDirectory)[]) {
    this.uri = uriOf(parts);
    this.name = this.uri.slice(this.uri.lastIndexOf('/') + 1);
    const seeded = files.get(this.uri);
    this.exists = seeded?.exists ?? false;
    this.bytes = seeded?.bytes ?? new Uint8Array(0);
    files.set(this.uri, this);
  }

  get size(): number {
    return this.exists ? this.bytes.length : 0;
  }

  open(): FakeFileHandle {
    if (!this.exists) {
      throw new Error(`File does not exist: ${this.uri}`);
    }
    return new FakeFileHandle(this.bytes);
  }

  async write(data: Uint8Array | string): Promise<void> {
    this.bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.exists = true;
    const parent = parentUri(this.uri);
    if (parent) {
      ensureDirectory(parent);
    }
  }

  async copy(destination: FakeFile, options?: { overwrite?: boolean }): Promise<void> {
    if (destination.exists && !options?.overwrite) {
      throw new Error(`Destination exists: ${destination.uri}`);
    }
    await destination.write(this.bytes.slice());
  }

  delete(): void {
    this.exists = false;
    this.bytes = new Uint8Array(0);
  }
}

export class FakeDirectory {
  readonly uri: string;
  readonly name: string;
  exists: boolean;

  constructor(...parts: (string | FakeDirectory)[]) {
    this.uri = uriOf(parts);
    this.name = this.uri.slice(this.uri.lastIndexOf('/') + 1);
    this.exists = directories.get(this.uri)?.exists ?? false;
    directories.set(this.uri, this);
  }

  create(): void {
    this.exists = true;
  }

  list(): Node[] {
    if (!this.exists) {
      throw new Error(`Directory does not exist: ${this.uri}`);
    }
    const prefix = `${this.uri.replace(/\/$/, '')}/`;
    return [
      ...[...directories.values()].filter(
        (entry) => entry !== this && entry.uri.startsWith(prefix) && entry.exists
      ),
      ...[...files.values()].filter(
        (entry) => entry.uri.startsWith(prefix) && entry.exists
      ),
    ].filter((entry) => parentUri(entry.uri) === this.uri.replace(/\/$/, ''));
  }
}

function ensureDirectory(uri: string): FakeDirectory {
  const existing = directories.get(uri);
  if (existing) {
    existing.exists = true;
    return existing;
  }
  const directory = new FakeDirectory(uri);
  directory.create();
  const parent = parentUri(uri);
  if (parent) {
    ensureDirectory(parent);
  }
  return directory;
}

/** Crea (o reemplaza) un archivo con bytes concretos. */
export function __seedFile(uri: string, data: Uint8Array | string): FakeFile {
  const parent = parentUri(uri);
  if (parent) {
    ensureDirectory(parent);
  }
  const file = new FakeFile(uri);
  file.bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  file.exists = true;
  return file;
}

/** Crea un directorio y sus padres. */
export function __seedDirectory(uri: string): FakeDirectory {
  return ensureDirectory(uri);
}

export function __getFile(uri: string): FakeFile | undefined {
  return files.get(uri);
}

export function __reset(): void {
  files.clear();
  directories.clear();
  ensureDirectory(Paths.cache);
  ensureDirectory(Paths.document);
  ensureDirectory(Paths.documentDirectory);
}

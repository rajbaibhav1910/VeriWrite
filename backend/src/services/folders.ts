/**
 * Folders: the grouping labels beside the library.
 *
 * A folder is a name, a parent and nothing else — deleting one must never take a document
 * with it, which is why the delete in `store/memory.ts` sets `folder_id` back to null
 * rather than reaching for the rows inside.
 */
import { store } from "../store/memory.ts";
import { BadRequest, type FolderWire, folderToWire, NotFound } from "../schemas/wire.ts";

/** The client's own limit on a folder name, so a name it would trim to nothing is refused. */
const MAX_NAME = 60;

export function listFolders(userId: string): FolderWire[] {
  return store
    .listFolders(userId)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(folderToWire);
}

export function createFolder(userId: string, raw: unknown): FolderWire {
  const body = asObject(raw, "The folder body");
  const name = readName(body.name);
  const parentId = body.parentId === undefined || body.parentId === null ? null : String(body.parentId);
  if (parentId !== null && !store.getFolder(userId, parentId)) {
    throw new BadRequest(`parentId "${parentId}" does not name a folder in this library.`);
  }
  // `folders_name_per_user`: two folders at one level cannot share a name.
  if (store.folderNameTaken(userId, name, parentId)) {
    throw new BadRequest(`A folder called "${name}" already sits at that level.`);
  }
  return folderToWire(store.addFolder({ user_id: userId, name, parent_id: parentId }));
}

export function renameFolder(userId: string, folderId: string, raw: unknown): FolderWire {
  const body = asObject(raw, "The folder patch");
  const name = readName(body.name);
  const existing = store.getFolder(userId, folderId);
  if (!existing) throw new NotFound(`No folder called "${folderId}" is in this library.`);
  if (name === existing.name) return folderToWire(existing);
  if (store.folderNameTaken(userId, name, existing.parent_id)) {
    throw new BadRequest(`A folder called "${name}" already sits at that level.`);
  }
  const row = store.renameFolder(userId, folderId, name);
  if (!row) throw new NotFound(`No folder called "${folderId}" is in this library.`);
  return folderToWire(row);
}

export function deleteFolder(userId: string, folderId: string): void {
  if (!store.deleteFolder(userId, folderId)) {
    throw new NotFound(`No folder called "${folderId}" is in this library.`);
  }
}

function readName(value: unknown): string {
  if (typeof value !== "string") throw new BadRequest("name must be a string.");
  const name = value.trim();
  if (!name) throw new BadRequest("A folder needs a name.");
  if (name.length > MAX_NAME) throw new BadRequest(`A folder name is at most ${MAX_NAME} characters.`);
  return name;
}

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequest(`${what} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface NewNoteInput {
  trip_id: string
  author_member_id: string
  body: string
  observed_at: string
}

interface QueuedOp {
  id: string
  createdAt: number
  tripId: string
  op:
    | { type: 'insert'; localId: string; item: NewNoteInput }
    | { type: 'update'; noteId: string; patch: Partial<NewNoteInput> }
    | { type: 'delete'; noteId: string }
}

interface OfflineDB extends DBSchema {
  queue: {
    key: string
    value: QueuedOp
    indexes: { 'by-createdAt': number }
  }
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('travelnote-offline', 1, {
      upgrade(db) {
        const store = db.createObjectStore('queue', { keyPath: 'id' })
        store.createIndex('by-createdAt', 'createdAt')
      },
    })
  }
  return dbPromise
}

function randomId() {
  return crypto.randomUUID()
}

export async function enqueueInsert(tripId: string, item: NewNoteInput): Promise<string> {
  const db = await getDB()
  const localId = randomId()
  await db.add('queue', {
    id: randomId(),
    createdAt: Date.now(),
    tripId,
    op: { type: 'insert', localId, item },
  })
  return localId
}

export async function enqueueUpdate(tripId: string, noteId: string, patch: Partial<NewNoteInput>) {
  const db = await getDB()
  await db.add('queue', {
    id: randomId(),
    createdAt: Date.now(),
    tripId,
    op: { type: 'update', noteId, patch },
  })
}

export async function enqueueDelete(tripId: string, noteId: string) {
  const db = await getDB()
  await db.add('queue', {
    id: randomId(),
    createdAt: Date.now(),
    tripId,
    op: { type: 'delete', noteId },
  })
}

export async function getQueuedOps(tripId: string): Promise<QueuedOp[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex('queue', 'by-createdAt')
  return all.filter((op) => op.tripId === tripId)
}

export async function removeQueuedOp(id: string) {
  const db = await getDB()
  await db.delete('queue', id)
}

export async function hasQueuedOps(tripId: string): Promise<boolean> {
  const ops = await getQueuedOps(tripId)
  return ops.length > 0
}

export type { QueuedOp }

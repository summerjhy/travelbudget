import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { NewEntryInput } from './useEntries'

interface QueuedOp {
  id: string
  createdAt: number
  tripId: string
  op:
    | { type: 'insert'; localId: string; item: NewEntryInput }
    | { type: 'update'; entryId: string; patch: Partial<NewEntryInput> }
    | { type: 'delete'; entryId: string }
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
    dbPromise = openDB<OfflineDB>('travelbudget-offline', 1, {
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

export async function enqueueInsert(tripId: string, item: NewEntryInput): Promise<string> {
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

export async function enqueueUpdate(tripId: string, entryId: string, patch: Partial<NewEntryInput>) {
  const db = await getDB()
  await db.add('queue', {
    id: randomId(),
    createdAt: Date.now(),
    tripId,
    op: { type: 'update', entryId, patch },
  })
}

export async function enqueueDelete(tripId: string, entryId: string) {
  const db = await getDB()
  await db.add('queue', {
    id: randomId(),
    createdAt: Date.now(),
    tripId,
    op: { type: 'delete', entryId },
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

// Almacén de archivos: IndexedDB en modo local; Supabase Storage cuando hay servidor conectado.
import { cloud } from './cloud'
import { uid } from './rng'

const DB = 'aura-files'
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore('files')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

/** Guarda un archivo y devuelve su identificador. `owner` = id de empleado o "empresa". */
export async function putFile(blob: Blob, name: string, owner = 'empresa'): Promise<string> {
  const c = cloud.getState()
  const safe = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_')
  if (c.client && c.companyId) {
    const path = `${c.companyId}/${owner}/${uid()}-${safe}`
    const { error } = await c.client.storage.from('documentos').upload(path, blob, { contentType: blob.type || 'application/octet-stream' })
    if (error) throw error
    return 'sb:' + path
  }
  const id = 'idb:' + uid()
  const db = await idb()
  await new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite')
    tx.objectStore('files').put(blob, id)
    tx.oncomplete = res
    tx.onerror = () => rej(tx.error)
  })
  return id
}

export async function getFile(id: string): Promise<Blob | null> {
  if (id.startsWith('sb:')) {
    const c = cloud.getState()
    if (!c.client) return null
    const { data } = await c.client.storage.from('documentos').download(id.slice(3))
    return data
  }
  const db = await idb()
  return new Promise((res) => {
    const r = db.transaction('files').objectStore('files').get(id)
    r.onsuccess = () => res((r.result as Blob) ?? null)
    r.onerror = () => res(null)
  })
}

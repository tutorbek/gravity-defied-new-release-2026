import { RecordEnumerationImpl } from './RecordEnumerationImpl.ts'
import type { RecordEnumeration } from './RecordEnumeration.ts'

function toStorageKey(name: string): string {
  return `gravity_defied_record_store:${name}`
}

export class RecordStore {
  private static opened = new Map<string, RecordStore>()
  private readonly name: string
  private readonly records: RecordEnumerationImpl

  private constructor(name: string, records: RecordEnumerationImpl) {
    this.name = name
    this.records = records
  }

  static setRecordStoreDir(_progName: string): void {}

  static openRecordStore(name: string, createIfNecessary: boolean): RecordStore {
    const existing = RecordStore.opened.get(name)
    if (existing !== undefined) {
      return existing
    }

    const item = window.localStorage.getItem(toStorageKey(name))
    if (item === null) {
      if (!createIfNecessary) {
        throw new Error('RecordStoreException')
      }
      const created = new RecordStore(name, new RecordEnumerationImpl())
      created.save()
      RecordStore.opened.set(name, created)
      return created
    }

    const parsed = JSON.parse(item) as number[][]
    const records = new RecordEnumerationImpl(parsed.map((entry) => Int8Array.from(entry)))
    const store = new RecordStore(name, records)
    RecordStore.opened.set(name, store)
    return store
  }

  closeRecordStore(): void {}

  static deleteRecordStore(name: string): void {
    window.localStorage.removeItem(toStorageKey(name))
    RecordStore.opened.delete(name)
  }

  static listRecordStores(): string[] {
    const result: string[] = []
    for (let i = 0; i < window.localStorage.length; ++i) {
      const key = window.localStorage.key(i)
      if (key !== null && key.startsWith('gravity_defied_record_store:')) {
        result.push(key.substring('gravity_defied_record_store:'.length))
      }
    }
    return result
  }

  enumerateRecords(_filter: unknown, _comparator: unknown, _keepUpdated: boolean): RecordEnumeration {
    return this.records
  }

  addRecord(arr: Int8Array | number[], offset: number, numBytes: number): number {
    if (offset !== 0) {
      throw new Error('RecordStoreException')
    }
    const bytes = Int8Array.from(Array.from(arr).slice(0, numBytes))
    const id = this.records.addRecord(bytes)
    this.save()
    return id
  }

  setRecord(recordId: number, arr: Int8Array | number[], offset: number, numBytes: number): void {
    void offset
    const bytes = Int8Array.from(Array.from(arr).slice(0, numBytes))
    this.records.setRecord(recordId, bytes)
    this.save()
  }

  private save(): void {
    const payload = JSON.stringify(this.records.data.map((entry) => Array.from(entry)))
    window.localStorage.setItem(toStorageKey(this.name), payload)
  }
}

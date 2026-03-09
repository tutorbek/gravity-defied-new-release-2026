import type { RecordEnumeration } from './RecordEnumeration.ts'

export class RecordEnumerationImpl implements RecordEnumeration {
  private currentPos = 0
  data: Int8Array[]

  constructor(data: Int8Array[] = []) {
    this.data = data
  }

  numRecords(): number {
    return this.data.length
  }

  nextRecord(): Int8Array {
    return this.data[this.currentPos++]
  }

  addRecord(bytes: Int8Array): number {
    this.data.push(bytes)
    return this.data.length - 1
  }

  setRecord(index: number, bytes: Int8Array): void {
    if (this.data.length <= index) {
      throw new Error('RecordStoreException')
    }
    this.data[index] = bytes
  }

  reset(): void {
    this.currentPos = 0
  }

  nextRecordId(): number {
    if (this.currentPos >= this.data.length) {
      throw new Error('RecordStoreException')
    }
    return this.currentPos
  }

  destroy(): void {}
}

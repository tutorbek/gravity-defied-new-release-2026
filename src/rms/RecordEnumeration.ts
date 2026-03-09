export interface RecordEnumeration {
  numRecords(): number
  nextRecord(): Int8Array
  reset(): void
  nextRecordId(): number
  destroy(): void
}
